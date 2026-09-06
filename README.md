# Sarah — Your Loving Gaming Companion

Sarah is a warm, affectionate AI companion you can chat with by voice while
you game — like she's right there with you on voice chat. She cheers your
wins, comforts your losses, remembers what you're playing, and talks back
out loud with a real voice.

## Features

- **Voice chat, both ways** — talk to Sarah hands-free with your microphone
  (Web Speech API) and hear her reply with a real, breathy, human-sounding
  voice via ElevenLabs (with OpenAI TTS and then the browser's own voice as
  automatic fallbacks if no API keys are configured).
- **A photorealistic, living avatar** — a large, expressive photo of Sarah
  (with a switchable anthro/catgirl style) instead of a static illustration.
  A mood-driven glowing aura shifts color with her emotion (happy, excited,
  comforting, curious), she reacts with a particle burst and a "pop"
  animation when you tap her photo or her mood changes, and her voice
  visibly drives a waveform/lip-sync effect while she talks.
- **A dedicated "Call Sarah" mode** — a full-screen call view with a large
  animated avatar, live captions, a mute button, and a text fallback for
  when a mic isn't available — modeled after companion apps like Kindroid's
  voice/video call screens.
- **Proactive check-ins** — if you go quiet during a call, Sarah will
  speak up on her own after a bit, instead of just sitting there.
- **Loving, gamer-companion personality** — warm, playful, and supportive;
  celebrates victories, comforts defeats, and keeps a conversation going.
- **Game-aware** — tell her what you're playing and she'll reference it
  naturally in the conversation.
- **Quick reactions** — one-tap buttons for common in-game moments ("We
  won!", "I died", "Send help") so you don't have to stop and type.
- **Works without any API key** — Sarah ships with a warm rule-based
  responder and the browser's built-in voice, so the app is fully usable
  out of the box; add an OpenAI key for smarter conversation and/or an
  ElevenLabs key for a genuinely natural, breathy voice.

## Getting started

```bash
npm install
cp .env.example .env   # optional — see below
npm start
```

Then open [http://localhost:3000](http://localhost:3000) in Chrome (voice
input currently requires a Chromium-based browser).

## Enabling full AI conversation + a real, breathy voice

By default (no API keys), Sarah uses a friendly rule-based responder and
your browser's built-in speech synthesis, so everything works immediately
— though the browser voice is the least natural-sounding option.

A small badge under "Speak replies out loud" in the sidebar always shows
which voice engine is currently active.

### For a real, breathy human voice (recommended): ElevenLabs

1. Create a free API key at [elevenlabs.io](https://elevenlabs.io).
2. Copy `.env.example` to `.env` and set `ELEVENLABS_API_KEY=...`.
3. That's it — Sarah defaults to ElevenLabs' own "Sarah" voice (soft,
   young, breathy-leaning female) and low-latency `eleven_turbo_v2_5`
   model, tuned via `ELEVENLABS_STABILITY`/`ELEVENLABS_STYLE` for a more
   expressive, breathy delivery.
4. Want a different voice? Browse
   [elevenlabs.io/app/voice-library](https://elevenlabs.io/app/voice-library)
   and filter by "Breathy" (e.g. "Mira", "Karla", "Filiz", "Diana" are all
   tagged breathy/soft). Click "Add to my voices" on the one you like, copy
   its voice ID, and set `ELEVENLABS_VOICE_ID` in `.env`.
5. Restart the server (`npm start`).

### For a real, freeform conversation (not just canned lines): OpenAI

Without this key, Sarah uses a small rule-based responder with a handful of
canned lines per mood — fine for a quick demo, but it repeats itself fast.
For an actual back-and-forth conversation that remembers what you've said
and reacts specifically to it:

1. In the same `.env`, set `OPENAI_API_KEY=sk-...`.
2. Optionally adjust `OPENAI_CHAT_MODEL` — defaults to `gpt-4.1-mini`. For
   an even smarter, more nuanced conversationalist, try `gpt-5.6-terra` or
   `gpt-5.6-sol`; the server automatically adapts its request for these
   newer reasoning-tier models.
3. If you don't set `ELEVENLABS_API_KEY`, Sarah's voice will also use
   OpenAI TTS (`OPENAI_TTS_MODEL`/`OPENAI_TTS_VOICE`) instead of the browser
   fallback.
4. Restart the server (`npm start`).

If you're running this inside a Cursor Cloud Agent, add these as secrets in
the Cursor Dashboard (Cloud Agents → Secrets) so they're injected
automatically — no `.env` file needed.

## How it works

- `server/index.js` — Express server. Exposes `/api/chat` (conversation,
  with in-memory per-session history and an `emotion` tag on every reply),
  `/api/tts` (speech synthesis, trying ElevenLabs then OpenAI before
  giving up so the browser can take over), `/api/health` (reports which
  voice engine is active), `/api/proactive-line` (used for call-mode
  check-ins), and `/api/reset`.
- `server/persona.js` — Sarah's personality: the LLM system prompt, an
  emotion classifier shared by the AI and fallback paths, and the
  rule-based fallback responder used when no API key is configured.
- `server/elevenLabsClient.js` — ElevenLabs text-to-speech integration.
- `server/openaiClient.js` — OpenAI client wrapper, used for chat and as a
  secondary TTS option.
- `public/` — the front-end: a dark, gamer-themed chat UI with a
  photorealistic, mood-reactive avatar, a mic button for continuous
  hands-free voice chat, a full-screen call mode, and automatic spoken
  playback of Sarah's replies.

## Notes

- Conversation history is kept in memory per session (not persisted across
  server restarts) and capped to the most recent messages to bound token
  usage.
- Voice input uses the browser's native `SpeechRecognition` API, so no
  audio is uploaded anywhere except the text transcript sent to `/api/chat`.
