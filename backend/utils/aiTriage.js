import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

// Initialize the Gemini AI client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'placeholder_key');

// Using gemini-1.5-flash as it is fast and efficient for standard text and JSON tasks
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

/**
 * Analyzes an incident description and returns structured JSON output.
 * @param {string} description - The civilian's report description.
 * @param {string} title - The title of the incident.
 * @returns {Promise<Object>} - The structured AI triage data.
 */
export const analyzeIncident = async (title, description) => {
  try {
    const prompt = `
      You are an emergency response AI triage assistant. 
      Analyze the following incident report and provide a structured assessment.

      Incident Title: ${title}
      Incident Description: ${description}
      
      Respond with ONLY valid JSON matching this structure:
      {
        "summary": "A concise 1-2 sentence summary of the incident",
        "urgency": "low | medium | high | critical",
        "recommendedActions": ["action 1", "action 2"],
        "estimatedAffected": <number, estimate based on description, 0 if unknown>,
        "riskScore": <number 0-100>
      }
    `;

    // Using JSON mode
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            summary: { type: SchemaType.STRING },
            urgency: { 
              type: SchemaType.STRING, 
              enum: ['low', 'medium', 'high', 'critical'] 
            },
            recommendedActions: { 
              type: SchemaType.ARRAY, 
              items: { type: SchemaType.STRING } 
            },
            estimatedAffected: { type: SchemaType.INTEGER },
            riskScore: { type: SchemaType.INTEGER }
          },
          required: ["summary", "urgency", "recommendedActions", "estimatedAffected", "riskScore"]
        }
      }
    });

    const responseText = result.response.text();
    return JSON.parse(responseText);
  } catch (error) {
    console.error('Error during AI triage:', error);
    // Fallback if AI fails
    return {
      summary: 'AI analysis failed. Please review manually.',
      urgency: 'high', // default safe fallback
      recommendedActions: ['Review incident details manually', 'Dispatch scout team'],
      estimatedAffected: 0,
      riskScore: 50
    };
  }
};
