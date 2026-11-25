import dns from 'node:dns';
import { GoogleGenAI } from '@google/genai';

// Prefer IPv4 on Windows networks where IPv6 sockets to Google APIs can stall/reset
dns.setDefaultResultOrder('ipv4first');

const MODEL_CANDIDATES = [
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.8-flash',
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Call Gemini with JSON output, retrying/falling back across models on transient/free-tier errors. */
export async function generateJsonWithGemini<T>(apiKey: string, prompt: string): Promise<T> {
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { timeout: 25_000 },
  });
  let lastError: unknown;

  for (let i = 0; i < MODEL_CANDIDATES.length; i++) {
    const model = MODEL_CANDIDATES[i];
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });
      if (!response.text) {
        throw new Error(`Empty response from ${model}`);
      }
      return JSON.parse(response.text) as T;
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isTransient =
        msg.includes('503') ||
        msg.includes('429') ||
        msg.includes('404') ||
        msg.includes('RESOURCE_EXHAUSTED') ||
        msg.includes('fetch failed') ||
        msg.includes('timeout') ||
        msg.includes('UND_ERR');
      if (!isTransient) throw err;

      // Brief backoff before trying the next model on free-tier rate limits / demand spikes
      if (i < MODEL_CANDIDATES.length - 1) {
        await sleep(1500);
      }
    }
  }

  throw lastError;
}
