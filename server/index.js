import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

import { buildSystemPrompt, generateFallbackReply } from "./persona.js";
import { getOpenAiClient, isAiEnabled } from "./openaiClient.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

const PORT = process.env.PORT || 3000;
const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";
const TTS_MODEL = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";
const TTS_VOICE = process.env.OPENAI_TTS_VOICE || "shimmer";
const MAX_HISTORY_MESSAGES = 20;

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

app.get("/api/health", (req, res) => {
  res.json({ ok: true, aiEnabled: isAiEnabled(), ttsEnabled: isAiEnabled() });
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

    const client = getOpenAiClient();
    if (client) {
      try {
        const completion = await client.chat.completions.create({
          model: CHAT_MODEL,
          messages: [
            { role: "system", content: buildSystemPrompt(session.gameContext) },
            ...session.history.slice(-MAX_HISTORY_MESSAGES),
          ],
          temperature: 0.9,
          max_tokens: 200,
        });
        reply = completion.choices?.[0]?.message?.content?.trim();
        usedAI = Boolean(reply);
      } catch (err) {
        console.error("OpenAI chat error, falling back:", err.message);
      }
    }

    if (!reply) {
      reply = generateFallbackReply(message, session.gameContext);
    }

    session.history.push({ role: "assistant", content: reply });
    if (session.history.length > MAX_HISTORY_MESSAGES) {
      session.history = session.history.slice(-MAX_HISTORY_MESSAGES);
    }

    res.json({ sessionId: id, reply, usedAI });
  } catch (err) {
    console.error("Chat endpoint error:", err);
    res.status(500).json({ error: "internal_error" });
  }
});

app.post("/api/tts", async (req, res) => {
  try {
    const { text } = req.body || {};
    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "text is required" });
    }

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
    res.send(buffer);
  } catch (err) {
    console.error("TTS endpoint error:", err.message);
    res.status(501).json({ error: "tts_unavailable" });
  }
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
});
