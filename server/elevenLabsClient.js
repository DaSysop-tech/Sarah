// ElevenLabs gives Sarah a genuinely human, breathy voice instead of a
// robotic TTS read — this is the preferred voice provider when configured,
// ahead of OpenAI TTS and the browser's speechSynthesis fallback.

// "Sarah" is ElevenLabs' own premade voice, described by ElevenLabs as
// soft/young/female — a fittingly on-the-nose default for our companion.
const DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";
const DEFAULT_MODEL = "eleven_turbo_v2_5";

export function isElevenLabsEnabled() {
  return Boolean(process.env.ELEVENLABS_API_KEY);
}

export async function synthesizeWithElevenLabs(text) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return null;

  const voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;
  const modelId = process.env.ELEVENLABS_MODEL || DEFAULT_MODEL;

  // Lower stability + a touch of style pushes the delivery toward a more
  // expressive, breathy, less "read aloud" performance. These are tunable
  // via env if a different voice needs different settings to sound its best.
  const stability = Number(process.env.ELEVENLABS_STABILITY ?? 0.4);
  const similarityBoost = Number(process.env.ELEVENLABS_SIMILARITY_BOOST ?? 0.8);
  const style = Number(process.env.ELEVENLABS_STYLE ?? 0.45);

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: {
        stability,
        similarity_boost: similarityBoost,
        style,
        use_speaker_boost: true,
      },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`ElevenLabs TTS failed (${res.status}): ${detail.slice(0, 300)}`);
  }

  return Buffer.from(await res.arrayBuffer());
}
