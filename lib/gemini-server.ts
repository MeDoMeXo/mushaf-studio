import { GoogleGenAI } from '@google/genai';

/**
 * Shared server-only Gemini SDK factory.
 * Reads process.env.GEMINI_API_KEY exclusively on the backend and sends the
 * required telemetry header per platform guidelines.
 */
export function getGeminiServerClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}
