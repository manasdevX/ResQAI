import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// gemini-2.0-flash — confirmed working with this API key
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

/**
 * Analyzes an incident and returns structured triage data.
 * @param {string} title
 * @param {string} description
 * @returns {Promise<{summary, urgency, recommendedActions, estimatedAffected, riskScore}>}
 */
export const analyzeIncident = async (title, description) => {
  try {
    const prompt = `You are an emergency response AI triage assistant.
Analyze the following incident report and respond with ONLY valid JSON — no markdown, no code fences.

Incident Title: ${title}
Incident Description: ${description}

JSON format (respond with this exact structure):
{
  "summary": "A concise 1-2 sentence summary of the incident",
  "urgency": "low | medium | high | critical",
  "recommendedActions": ["action 1", "action 2", "action 3"],
  "estimatedAffected": <number, estimate based on description, 0 if unknown>,
  "riskScore": <integer 0-100>
}`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();

    // Strip markdown code fences if model wraps response
    const cleaned = responseText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const parsed = JSON.parse(cleaned);

    // Validate required fields
    const urgencyValues = ['low', 'medium', 'high', 'critical'];
    return {
      summary:            parsed.summary            || 'No summary provided',
      urgency:            urgencyValues.includes(parsed.urgency) ? parsed.urgency : 'medium',
      recommendedActions: Array.isArray(parsed.recommendedActions) ? parsed.recommendedActions : [],
      estimatedAffected:  Number.isFinite(parsed.estimatedAffected) ? parsed.estimatedAffected : 0,
      riskScore:          Number.isFinite(parsed.riskScore) ? Math.min(100, Math.max(0, parsed.riskScore)) : 50,
    };
  } catch (error) {
    const msg = error.message || String(error);
    if (msg.includes('429') || msg.toLowerCase().includes('quota') || msg.includes('Too Many Requests')) {
      console.warn('[aiTriage] Rate limited by Gemini API — using fallback triage');
    } else {
      console.error('[aiTriage] AI triage error:', msg);
    }
    // Safe fallback — incident is always saved regardless of AI status
    return {
      summary:            'AI analysis unavailable. Please review manually.',
      urgency:            'high',
      recommendedActions: ['Review incident details manually', 'Dispatch scout team'],
      estimatedAffected:  0,
      riskScore:          50,
    };
  }
};
