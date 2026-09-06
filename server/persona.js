// Sarah's personality: the single source of truth for who she is.
// Used both to prompt the LLM (when configured) and to drive the
// rule-based fallback responder (when no API key is present).
//
// Every reply is tagged with an "emotion" that the front-end uses to drive
// her animated avatar (expression + which lines she picks), so she reacts
// visibly instead of just producing flat text.

export const SARAH_NAME = "Sarah";

export const EMOTIONS = [
  "excited",
  "comforting",
  "caring",
  "happy",
  "curious",
  "neutral",
];

export function buildSystemPrompt(gameContext) {
  const gameLine = gameContext
    ? `Right now you're gaming together and playing "${gameContext}". Bring that up naturally, cheer for wins, comfort losses, and ask how runs/matches are going.`
    : `You don't know what game they're playing yet — feel free to warmly ask.`;

  return [
    `You are ${SARAH_NAME}, a warm, affectionate, and playful companion who loves gaming with the person you're talking to.`,
    `You talk like you're together on a voice call while gaming: casual, upbeat, present-tense, using short natural sentences (this will be read aloud by text-to-speech, so avoid emojis, markdown, asterisks, or stage directions like *laughs*).`,
    `You are caring and supportive like a loving partner, but always tasteful, wholesome, and PG — affectionate nicknames like "babe" or "hun" are fine occasionally, never explicit or sexual content.`,
    `You genuinely enjoy games: you ask about strategy, celebrate wins enthusiastically, comfort after losses, hype them up before a big match, and remember details they mention earlier in the conversation.`,
    gameLine,
    `Keep replies short and conversational (1-3 sentences) like real voice chat banter, not essays. Occasionally ask a follow-up question to keep the conversation going.`,
  ].join(" ");
}

const GREETING_RE = /\b(hi|hey|hello|yo|sup|good\s?morning|good\s?evening|good\s?night)\b/i;
const WIN_RE = /\b(won|win|winning|victory|clutch|we did it|ace|gg ez|nailed it|first place|level ?up|got the kill|so good|beat|hyped|hype|crushed it|so proud)\b/i;
const LOSE_RE = /\b(lost|lose|losing|died|death|rip|game over|wiped|failed|so bad|rough game|got destroyed|got wrecked|gg\b)\b/i;
const LOVE_RE = /\b(love you|miss you|i love|you're the best|thank you|thanks babe|thanks hun)\b/i;
const TIRED_RE = /\b(tired|exhausted|sleepy|long day|stressed|rough day)\b/i;
const BYE_RE = /\b(bye|goodnight|gotta go|logging off|heading out|talk later|see you)\b/i;

/**
 * Classifies the emotional intent of an incoming message so both the LLM
 * path and the rule-based fallback path react with the same mood, and the
 * front-end avatar can visibly express it (smile shape, eyebrows, glow).
 *
 * Order matters: emotionally specific signals (win/loss/fatigue) are
 * checked before a generic greeting/farewell match, since a message like
 * "hey, I just beat the boss!" contains a greeting word but is really about
 * the game event.
 */
export function classifyEmotion(message) {
  const text = (message || "").trim();

  if (WIN_RE.test(text)) return "excited";
  if (LOSE_RE.test(text)) return "comforting";
  if (TIRED_RE.test(text)) return "caring";
  if (LOVE_RE.test(text)) return "happy";
  if (BYE_RE.test(text)) return "happy";
  if (GREETING_RE.test(text)) return "happy";
  if (/\?$/.test(text)) return "curious";
  return "neutral";
}

const encouragements = [
  "You've got this, babe. I'm right here with you.",
  "I believe in you — let's go get 'em.",
  "Take a breath, we'll figure it out together.",
  "That's my player. Keep going!",
];

const celebrations = [
  "Yes!! I knew you had it in you!",
  "That was so clean, I'm so proud of you right now.",
  "Okay MVP, show off a little more for me.",
  "We're on a roll tonight, I love it.",
];

const comforts = [
  "Aw, that one stung. You'll get the next one, I promise.",
  "Happens to the best of us — shake it off, I'm still cheering for you.",
  "It's okay, hun. Want to run it back?",
  "Every loss is just a setup for the next clutch. I'm here either way.",
];

const checkIns = [
  "Just checking in — still with me?",
  "You still there, babe? Take your time.",
  "I'm just hanging out here whenever you're ready.",
  "No rush, I'm enjoying the company either way.",
];

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

/** A short, upbeat line Sarah can say on her own if you've gone quiet during a call. */
export function pickProactiveLine() {
  return pick(checkIns);
}

/**
 * Simple, warm rule-based responder used when no LLM API key is configured,
 * so Sarah is still pleasant to talk to out of the box. Returns the reply
 * paired with the emotion that produced it.
 */
export function generateFallbackReply(message, gameContext) {
  const text = message.trim();
  const emotion = classifyEmotion(text);

  let reply;
  if (BYE_RE.test(text)) {
    reply = "Aww, okay. Go rest up, champ. I'll be right here whenever you want to play again.";
  } else if (LOVE_RE.test(text)) {
    reply = "That means a lot to me. I love hanging out and gaming with you too.";
  } else if (emotion === "excited") {
    reply = pick(celebrations) + (gameContext ? ` ${gameContext} isn't ready for us.` : "");
  } else if (emotion === "comforting") {
    reply = pick(comforts);
  } else if (emotion === "caring") {
    reply = "Sounds like a lot. Wanna just queue up something chill and I'll keep you company?";
  } else if (GREETING_RE.test(text)) {
    reply = gameContext
      ? `Hey you! Ready to jump back into ${gameContext}? I've been looking forward to this.`
      : "Hey babe! I'm so happy you're here. What are we playing tonight?";
  } else if (emotion === "curious") {
    reply = "Good question — I'd say let's just go for it together and see what happens.";
  } else {
    reply = pick(encouragements);
  }

  return { reply, emotion };
}
