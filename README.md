# Sarah — Your Loving Gaming Companion

Sarah is a warm, affectionate AI companion you can chat with by voice while
you game — like she's right there with you on voice chat. She cheers your
wins, comforts your losses, remembers what you're playing, and talks back
out loud with a real voice.

## Features

- **Voice chat, both ways** — talk to Sarah hands-free with your microphone
  (Web Speech API) and hear her reply out loud (OpenAI text-to-speech, with
  an automatic browser-voice fallback if no API key is configured).
- **A live, reactive avatar** — Sarah blinks on her own, and her expression
  visibly reacts to the conversation: a colored ring, eyebrows, and mouth
  shape change between happy, excited, comforting, caring, and curious
  moods (with a quick "pop" animation on every change), and her mouth
  animates in sync with her voice while she talks.
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
  responder so the app is fully usable out of the box; add an OpenAI key to
  unlock smarter, freeform conversation and natural spoken replies.

## Getting started

```bash
npm install
cp .env.example .env   # optional — see below
npm start
```

Then open [http://localhost:3000](http://localhost:3000) in Chrome (voice
input currently requires a Chromium-based browser).

## Enabling full AI conversation + spoken voice

By default (no API key), Sarah uses a friendly rule-based responder and
your browser's built-in speech synthesis, so everything works immediately.

For real freeform conversation and a natural TTS voice, add an OpenAI API
key:

1. Copy `.env.example` to `.env`.
2. Set `OPENAI_API_KEY=sk-...`.
3. Optionally adjust `OPENAI_CHAT_MODEL`, `OPENAI_TTS_MODEL`, and
   `OPENAI_TTS_VOICE` (voice options: `alloy`, `echo`, `fable`, `onyx`,
   `nova`, `shimmer`, `coral`, `sage`).
4. Restart the server (`npm start`).

If you're running this inside a Cursor Cloud Agent, add `OPENAI_API_KEY` as
a secret in the Cursor Dashboard (Cloud Agents → Secrets) so it's injected
automatically.

## How it works

- `server/index.js` — Express server. Exposes `/api/chat` (conversation,
  with in-memory per-session history and an `emotion` tag on every reply),
  `/api/tts` (OpenAI speech synthesis), `/api/proactive-line` (used for
  call-mode check-ins), and `/api/reset`.
- `server/persona.js` — Sarah's personality: the LLM system prompt, an
  emotion classifier shared by the AI and fallback paths, and the
  rule-based fallback responder used when no API key is configured.
- `public/` — the front-end: a dark, gamer-themed chat UI with an animated,
  mood-reactive avatar, a mic button for continuous hands-free voice chat,
  a full-screen call mode, and automatic spoken playback of Sarah's
  replies.

## Notes

- Conversation history is kept in memory per session (not persisted across
  server restarts) and capped to the most recent messages to bound token
  usage.
- Voice input uses the browser's native `SpeechRecognition` API, so no
  audio is uploaded anywhere except the text transcript sent to `/api/chat`.
