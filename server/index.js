import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

import { buildSystemPrompt, generateFallbackReply, classifyEmotion, pickProactiveLine } from "./persona.js";
import { getOpenAiClient, isAiEnabled } from "./openaiClient.js";
import { isElevenLabsEnabled, synthesizeWithElevenLabs } from "./elevenLabsClient.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

const PORT = process.env.PORT || 3000;
// gpt-4.1-mini is a solid, fast, conversational default that works with the
// classic Chat Completions params below (temperature + max_tokens). Newer
// reasoning-tier models (gpt-5.6-*, gpt-6-*, o-series) use different params
// (no temperature, max_completion_tokens instead of max_tokens) — if you set
// OPENAI_CHAT_MODEL to one of those for an even smarter Sarah, isReasoningModel()
// below automatically adapts the request so it still works.
const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4.1-mini";
const TTS_MODEL = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";
const TTS_VOICE = process.env.OPENAI_TTS_VOICE || "shimmer";
// A real conversation needs real memory — keep enough recent turns that
// Sarah can reference things you said a few minutes ago, not just the last
// couple of lines.
const MAX_HISTORY_MESSAGES = 40;

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

/** sessionId -> { history: [{role, content}], gameContext: string } */
const sessions = new Map();

function getSession(sessionId) {
  const id = sessionId || crypto.randomUUID();
  if (!sessions.has(id)) {
    sessions.set(id, { history: [], gameContext: "" });
  }
  return { id, session: sessions.get(id) };
}

// Reasoning-tier models (OpenAI's gpt-5.6 family, gpt-6-*, and the o-series)
// reject `temperature` and use `max_completion_tokens` instead of
// `max_tokens`. Detecting them lets Sarah support either a classic chat
// model (the default) or a newer reasoning model, just by changing the env var.
function isReasoningModel(model) {
  return /^(o\d|gpt-5(\.\d+)?(-|$)|gpt-6)/.test(model);
}

function activeVoiceProvider() {
  if (isElevenLabsEnabled()) return "elevenlabs";
  if (isAiEnabled()) return "openai";
  return "browser";
}

app.get("/api/health", (req, res) => {
  const voiceProvider = activeVoiceProvider();
  res.json({
    ok: true,
    aiEnabled: isAiEnabled(),
    ttsEnabled: voiceProvider !== "browser",
    voiceProvider,
  });
});

app.post("/api/chat", async (req, res) => {
  try {
    const { sessionId, message, gameContext } = req.body || {};

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "message is required" });
    }

    const { id, session } = getSession(sessionId);
    if (typeof gameContext === "string") {
      session.gameContext = gameContext.trim();
    }

    session.history.push({ role: "user", content: message.trim() });

    let reply;
    let usedAI = false;
    // The emotion classifier runs on the user's message regardless of which
    // path answers it, so the avatar's expression stays consistent whether
    // Sarah is powered by the LLM or the rule-based fallback.
    const emotion = classifyEmotion(message);

    const client = getOpenAiClient();
    if (client) {
      try {
        const reasoning = isReasoningModel(CHAT_MODEL);
        const completion = await client.chat.completions.create({
          model: CHAT_MODEL,
          messages: [
            { role: "system", content: buildSystemPrompt(session.gameContext) },
            ...session.history.slice(-MAX_HISTORY_MESSAGES),
          ],
          // Reasoning-tier models fix temperature at 1 (passing a custom
          // value errors out) and use max_completion_tokens instead of
          // max_tokens; classic chat models use the params below as-is.
          ...(reasoning
            ? { max_completion_tokens: 260, reasoning_effort: "low" }
            : { temperature: 0.9, max_tokens: 260 }),
        });
        reply = completion.choices?.[0]?.message?.content?.trim();
        usedAI = Boolean(reply);
      } catch (err) {
        console.error("OpenAI chat error, falling back:", err.message);
      }
    }

    if (!reply) {
      reply = generateFallbackReply(message, session.gameContext).reply;
    }

    session.history.push({ role: "assistant", content: reply });
    if (session.history.length > MAX_HISTORY_MESSAGES) {
      session.history = session.history.slice(-MAX_HISTORY_MESSAGES);
    }

    res.json({ sessionId: id, reply, usedAI, emotion });
  } catch (err) {
    console.error("Chat endpoint error:", err);
    res.status(500).json({ error: "internal_error" });
  }
});

app.post("/api/tts", async (req, res) => {
  const { text } = req.body || {};
  if (!text || typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "text is required" });
  }

  // Prefer ElevenLabs for a genuinely breathy, human voice; fall back to
  // OpenAI TTS if that's the only key configured, then to a 501 so the
  // browser's own speechSynthesis can take over client-side.
  if (isElevenLabsEnabled()) {
    try {
      const buffer = await synthesizeWithElevenLabs(text);
      res.set("Content-Type", "audio/mpeg");
      res.set("X-Voice-Provider", "elevenlabs");
      return res.send(buffer);
    } catch (err) {
      console.error("ElevenLabs TTS error, falling back:", err.message);
    }
  }

  try {
    const client = getOpenAiClient();
    if (!client) {
      return res.status(501).json({ error: "tts_unavailable" });
    }

    const speech = await client.audio.speech.create({
      model: TTS_MODEL,
      voice: TTS_VOICE,
      input: text,
    });

    const buffer = Buffer.from(await speech.arrayBuffer());
    res.set("Content-Type", "audio/mpeg");
    res.set("X-Voice-Provider", "openai");
    res.send(buffer);
  } catch (err) {
    console.error("TTS endpoint error:", err.message);
    res.status(501).json({ error: "tts_unavailable" });
  }
});

// Used during a live "call" when the user has gone quiet for a while, so
// Sarah can proactively say something instead of just sitting there —
// mirrors the "live/proactive" check-ins of companion call apps.
app.get("/api/proactive-line", (req, res) => {
  res.json({ reply: pickProactiveLine(), emotion: "caring" });
});

app.post("/api/reset", (req, res) => {
  const { sessionId } = req.body || {};
  if (sessionId && sessions.has(sessionId)) {
    sessions.set(sessionId, { history: [], gameContext: "" });
  }
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Sarah is listening on http://localhost:${PORT}`);
  console.log(`AI conversation: ${isAiEnabled() ? "enabled (OpenAI)" : "disabled — using warm fallback responses"}`);
  const provider = activeVoiceProvider();
  const providerLabel =
    provider === "elevenlabs"
      ? "enabled (ElevenLabs — breathy, human voice)"
      : provider === "openai"
      ? "enabled (OpenAI TTS)"
      : "disabled — using the browser's built-in voice";
  console.log(`Voice: ${providerLabel}`);
});
