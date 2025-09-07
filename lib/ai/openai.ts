import OpenAI from "openai";

// Simple singleton OpenAI client factory
let _client: OpenAI | null = null;

export function openai(): OpenAI {
  if (_client) return _client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  _client = new OpenAI({ apiKey });
  return _client;
}

// Use a model compatible with the Assistants API
export const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini"; // fast + cost‑effective
