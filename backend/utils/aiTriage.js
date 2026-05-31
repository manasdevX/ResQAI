import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const API_KEY = process.env.GEMINI_API_KEY || '';
const genAI   = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

// gemini-1.5-flash first — free tier available; gemini-2.0-flash as upgrade fallback
const MODELS = ['gemini-1.5-flash', 'gemini-2.0-flash'];

const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timed out')), ms)),
  ]);

/**
 * Analyze an incident with Gemini AI.
 * Always resolves — never throws. Returns { aiAvailable: false } on any failure
 * so the caller can decide whether to store triage data or leave it null.
 */
export const analyzeIncident = async (title, description, type = 'other') => {
  if (!genAI) {
    console.warn('[aiTriage] GEMINI_API_KEY is not set — skipping AI analysis');
    return { aiAvailable: false };
  }

  const prompt = `You are an emergency response AI triage assistant.
Analyze this incident and respond ONLY with valid JSON — no markdown, no code fences, no extra text.

Incident type: ${type.replace(/_/g, ' ')}
Title: ${title}
Description: ${description}

Required JSON format (respond with this exact structure):
{
  "summary": "1-2 sentence clear, actionable summary of the emergency situation",
  "urgency": "low | medium | high | critical",
  "recommendedActions": ["specific action 1", "specific action 2", "specific action 3"],
  "estimatedAffected": <integer — best estimate from context, 0 if truly unknown>,
  "riskScore": <integer 0-100 where 100 is maximum risk>
}`;

  for (const modelName of MODELS) {
    try {
      const model  = genAI.getGenerativeModel({ model: modelName });
      const result = await withTimeout(model.generateContent(prompt), 10000);
      const raw    = result.response.text().trim()
        .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

      const parsed = JSON.parse(raw);
      const VALID_URGENCY = ['low', 'medium', 'high', 'critical'];

      return {
        aiAvailable:        true,
        modelUsed:          modelName,
        summary:            typeof parsed.summary === 'string' && parsed.summary.trim() ? parsed.summary.trim() : null,
        urgency:            VALID_URGENCY.includes(parsed.urgency) ? parsed.urgency : 'medium',
        recommendedActions: Array.isArray(parsed.recommendedActions) ? parsed.recommendedActions.slice(0, 5) : [],
        estimatedAffected:  Number.isFinite(parsed.estimatedAffected) ? Math.max(0, Math.round(parsed.estimatedAffected)) : 0,
        riskScore:          Number.isFinite(parsed.riskScore) ? Math.min(100, Math.max(0, Math.round(parsed.riskScore))) : null,
      };
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('429') || msg.toLowerCase().includes('quota') || msg.includes('Too Many Requests')) {
        console.warn(`[aiTriage] Rate limited on ${modelName} — trying fallback model`);
        continue;
      }
      if (msg.includes('404') || msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('invalid model')) {
        console.warn(`[aiTriage] Model ${modelName} unavailable — trying fallback model`);
        continue;
      }
      // Unexpected error — log and bail
      console.error(`[aiTriage] Error with model ${modelName}: ${msg}`);
      break;
    }
  }

  return { aiAvailable: false };
};
