import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

// ─────────────────────────────────────────────────────────────────────────────
// WHY LAZY INIT:
// Same ES-module hoisting issue as upload.js — genAI is initialised lazily so
// process.env.GEMINI_API_KEY is guaranteed to be set by the time we use it.
// ─────────────────────────────────────────────────────────────────────────────
let _genAI = null;
const getGenAI = () => {
  if (!_genAI) {
    const key = process.env.GEMINI_API_KEY?.trim();
    if (key) _genAI = new GoogleGenerativeAI(key);
  }
  return _genAI;
};

/**
 * Model priority list — ordered from best free-tier availability to worst.
 *
 * Free-tier quotas (Google AI Studio, as of June 2025):
 *   gemini-2.5-flash        → 10 RPM,  500 RPD  (works in tests ✓)
 *   gemini-2.0-flash        → 15 RPM, 1500 RPD
 *   gemini-2.0-flash-lite   → 30 RPM, 1500 RPD
 *   gemini-1.5-flash-8b     → 15 RPM, 1500 RPD  (last-resort fallback)
 *
 * gemini-1.5-flash is REMOVED — deprecated by Google, returns 404.
 * gemini-2.5-flash is FIRST because empirical testing shows it's least
 * likely to be rate-limited in this project's usage pattern.
 */
const MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash-8b',
];

/** Race a promise against a hard timeout. */
const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timed out')), ms)
    ),
  ]);

/** Pause for `ms` ms — used for rate-limit backoff. */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Classify a Gemini API error so we can decide: retry, skip, or give up.
 */
const classifyError = (msg = '') => {
  const m = msg.toLowerCase();
  if (m.includes('429') || m.includes('quota') || m.includes('resource_exhausted') || m.includes('too many requests'))
    return 'rate_limit';
  if (m.includes('404') || m.includes('not found') || m.includes('invalid model') || m.includes('deprecated') || m.includes('does not exist'))
    return 'model_unavailable';
  if (m.includes('timed out'))
    return 'timeout';
  if (m.includes('503') || m.includes('overloaded') || m.includes('service unavailable'))
    return 'overloaded';
  return 'unknown';
};

/**
 * Analyze an incident with Gemini AI.
 *
 * Always resolves — never throws.
 * Returns `{ aiAvailable: false }` when all models fail, so the caller
 * stores no triage data and the UI shows "unavailable" instead of spinning.
 *
 * Retry strategy (per model):
 *  - rate_limit / overloaded → 1 retry after 2 s backoff, then next model
 *  - model_unavailable       → skip immediately
 *  - timeout / unknown       → skip immediately
 *
 * With 1 retry the worst-case total wait before falling back is:
 *   4 models × (1 attempt + 1 retry × 2 s) = ~8 s maximum
 * In practice the first working model is usually reached in < 2 s.
 */
export const analyzeIncident = async (title, description, type = 'other', mediaUrIs = []) => {
  const genAI = getGenAI();
  if (!genAI) {
    console.warn('[aiTriage] GEMINI_API_KEY not set — skipping AI analysis');
    return { aiAvailable: false };
  }

  let prompt = `You are an emergency response AI triage assistant.
Analyze this incident and respond ONLY with valid JSON — no markdown, no code fences, no extra text.

Incident type: ${type.replace(/_/g, ' ')}
Title: ${title}
Description: ${description}

Required JSON format (respond with this exact structure):
{
  "summary": "2-3 sentence clear actionable summary of the situation and immediate risks",
  "urgency": "low | medium | high | critical",
  "recommendedActions": ["action 1", "action 2", "action 3", "action 4"],
  "estimatedAffected": <integer, best estimate from context, minimum 1 if any people involved>,
  "riskScore": <integer 0-100, must reflect actual urgency: low=10-30, medium=35-55, high=60-80, critical=85-100>
}`;

  let contents = [prompt];

  // If there are uploaded images (Cloudinary URLs), try to download and pass them to Gemini vision
  if (mediaUrIs && mediaUrIs.length > 0) {
    console.log(`[aiTriage] Attempting to fetch ${mediaUrIs.length} media item(s) for vision analysis.`);
    try {
      const fetchPromises = mediaUrIs
        .filter(url => typeof url === 'string')
        .slice(0, 3) // limit to 3 images max to avoid payload size limits/timeouts
        .map(async url => {
          try {
            const response = await fetch(url);
            if (!response.ok) return null;
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const mimeType = response.headers.get('content-type') || 'image/jpeg';
            if (!mimeType.startsWith('image/')) return null;
            return {
              inlineData: {
                data: buffer.toString('base64'),
                mimeType
              }
            };
          } catch (e) {
            console.error(`[aiTriage] Failed to fetch image ${url} for AI:`, e.message);
            return null;
          }
        });
      
      const imageParts = (await Promise.all(fetchPromises)).filter(p => p !== null);
      if (imageParts.length > 0) {
        console.log(`[aiTriage] Successfully appended ${imageParts.length} image(s) to prompt.`);
        prompt += `\n\nThere are also ${imageParts.length} image(s) provided. Please meticulously visually inspect the attached images to evaluate the disaster scope, risk score, and urgency.`;
        contents = [prompt, ...imageParts];
      }
    } catch (e) {
      console.error('[aiTriage] Media preparation error:', e);
    }
  }

  const VALID_URGENCY   = ['low', 'medium', 'high', 'critical'];
  const MAX_RETRIES     = 1;    // 1 retry per model before moving on (keeps total wait ≤ 8 s)
  const BACKOFF_MS      = 2000; // 2 s wait on first rate-limit hit

  for (const modelName of MODELS) {
    let attempt = 0;

    while (attempt <= MAX_RETRIES) {
      try {
        const model  = genAI.getGenerativeModel({ model: modelName });
        const result = await withTimeout(model.generateContent(contents), 15000);

        // Strip any accidental markdown fences from the response
        const raw = result.response.text().trim()
          .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

        const parsed = JSON.parse(raw);

        console.log(`[aiTriage] ✓ model: ${modelName} | urgency: ${parsed.urgency} | riskScore: ${parsed.riskScore}`);

        return {
          aiAvailable:        true,
          modelUsed:          modelName,
          summary:            typeof parsed.summary === 'string' && parsed.summary.trim()
                                ? parsed.summary.trim()
                                : null,
          urgency:            VALID_URGENCY.includes(parsed.urgency)
                                ? parsed.urgency
                                : 'medium',
          recommendedActions: Array.isArray(parsed.recommendedActions)
                                ? parsed.recommendedActions.slice(0, 5)
                                : [],
          estimatedAffected:  Number.isFinite(parsed.estimatedAffected)
                                ? Math.max(0, Math.round(parsed.estimatedAffected))
                                : 0,
          riskScore:          Number.isFinite(parsed.riskScore)
                                ? Math.min(100, Math.max(0, Math.round(parsed.riskScore)))
                                : null,
        };
      } catch (err) {
        const errType  = classifyError(err.message || '');
        const canRetry = (errType === 'rate_limit' || errType === 'overloaded') && attempt < MAX_RETRIES;

        if (canRetry) {
          console.warn(`[aiTriage] ${errType} on ${modelName} (attempt ${attempt + 1}) — retrying in ${BACKOFF_MS / 1000}s`);
          await sleep(BACKOFF_MS);
          attempt++;
          continue;
        }

        // Log and move on to the next model
        if (errType === 'model_unavailable') {
          console.warn(`[aiTriage] ${modelName} unavailable/deprecated — trying next model`);
        } else if (errType === 'rate_limit' || errType === 'overloaded') {
          console.warn(`[aiTriage] ${errType} on ${modelName} — exhausted retries, trying next model`);
        } else {
          console.error(`[aiTriage] ${errType} on ${modelName}: ${err.message} — trying next model`);
        }
        break;
      }
    }
  }

  console.error('[aiTriage] All models exhausted — AI triage unavailable for this incident');
  return { aiAvailable: false };
};
