import OpenAI from "openai";

let client = null;

export function isAiEnabled() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function getOpenAiClient() {
  if (!isAiEnabled()) return null;
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}
