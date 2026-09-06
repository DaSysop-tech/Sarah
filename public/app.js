(function () {
  const chatLog = document.getElementById("chatLog");
  const textInput = document.getElementById("textInput");
  const sendBtn = document.getElementById("sendBtn");
  const micBtn = document.getElementById("micBtn");
  const gameInput = document.getElementById("gameInput");
  const voiceOutToggle = document.getElementById("voiceOutToggle");
  const resetBtn = document.getElementById("resetBtn");
  const voiceStatus = document.getElementById("voiceStatus");
  const voiceStatusText = document.getElementById("voiceStatusText");
  const statusText = document.getElementById("statusText");
  const statusPulse = document.getElementById("statusPulse");
  const ttsAudio = document.getElementById("ttsAudio");
  const hint = document.getElementById("hint");
  const stageCaption = document.getElementById("stageCaption");

  const companionVisuals = () => document.querySelectorAll(".companion-visual");
  const companionPhotos = () => document.querySelectorAll(".companion-photo");
  const stageParticleLayer = document.getElementById("particleLayer");
  const callParticleLayer = document.getElementById("callParticleLayer");

  const styleToggle = document.getElementById("styleToggle");

  const callBtn = document.getElementById("callBtn");
  const callOverlay = document.getElementById("callOverlay");
  const callStatusText = document.getElementById("callStatusText");
  const callCaption = document.getElementById("callCaption");
  const callMuteBtn = document.getElementById("callMuteBtn");
  const endCallBtn = document.getElementById("endCallBtn");
  const callTextInput = document.getElementById("callTextInput");
  const callSendBtn = document.getElementById("callSendBtn");

  const SESSION_KEY = "sarah_session_id";
  let sessionId = localStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, sessionId);
  }

  const GAME_KEY = "sarah_game_context";
  gameInput.value = localStorage.getItem(GAME_KEY) || "";
  gameInput.addEventListener("change", () => {
    localStorage.setItem(GAME_KEY, gameInput.value.trim());
  });

  let ttsKnownUnavailable = false;
  let isSpeaking = false;
  let isSending = false;
  let inCallMode = false;

  // ---------- Avatar style (Human / Anthro) ----------

  const STYLE_KEY = "sarah_avatar_style";
  let avatarStyle = localStorage.getItem(STYLE_KEY) || "human";

  function applyAvatarStyle(style) {
    avatarStyle = style;
    localStorage.setItem(STYLE_KEY, style);
    companionPhotos().forEach((img) => {
      img.src = `assets/sarah_${style}.jpg`;
    });
    styleToggle.querySelectorAll(".style-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.style === style);
    });
  }

  styleToggle.addEventListener("click", (e) => {
    const btn = e.target.closest(".style-btn");
    if (btn) applyAvatarStyle(btn.dataset.style);
  });

  // ---------- Living avatar: mood aura, particles, breathing, lip-synced voice ----------

  function setMood(mood) {
    if (!mood) return;
    companionVisuals().forEach((el) => {
      el.dataset.mood = mood;
    });
    // Always play the reaction pop + particles, even if the mood label is
    // the same as before (e.g. two excited replies in a row, or tapping her
    // photo while already "happy") — every reaction should feel alive.
    companionVisuals().forEach((el) => {
      el.classList.remove("mood-pop");
      void el.offsetWidth;
      el.classList.add("mood-pop");
    });
    reactWithParticles(mood);
  }

  const MOOD_PARTICLES = {
    excited: "✨",
    happy: "💕",
    comforting: "💜",
    caring: "💜",
    curious: "❔",
  };

  function spawnParticles(layer, emoji, count) {
    if (!layer) return;
    for (let i = 0; i < count; i++) {
      const p = document.createElement("span");
      p.className = "particle";
      p.textContent = emoji;
      p.style.left = 40 + Math.random() * 20 + "%";
      p.style.setProperty("--dx", Math.random() * 160 - 80 + "px");
      p.style.setProperty("--dur", (1 + Math.random() * 0.7).toFixed(2) + "s");
      p.style.animationDelay = (Math.random() * 0.25).toFixed(2) + "s";
      layer.appendChild(p);
      setTimeout(() => p.remove(), 2200);
    }
  }

  function reactWithParticles(mood) {
    const emoji = MOOD_PARTICLES[mood];
    if (!emoji) return;
    const layer = inCallMode ? callParticleLayer : stageParticleLayer;
    spawnParticles(layer, emoji, 6);
  }

  // ---------- Status + chat log ----------

  function setStatus(text, mode) {
    statusText.textContent = text;
    statusPulse.classList.remove("speaking", "listening");
    if (mode) statusPulse.classList.add(mode);
    if (inCallMode) callStatusText.textContent = text;
  }

  function setCaption(text) {
    stageCaption.textContent = text;
    if (inCallMode) callCaption.textContent = text;
  }

  function addBubble(role, text) {
    const bubble = document.createElement("div");
    bubble.className = `bubble ${role}`;
    bubble.textContent = text;
    chatLog.appendChild(bubble);
    chatLog.scrollTop = chatLog.scrollHeight;
    if (role === "user" || role === "sarah") setCaption(text);
    return bubble;
  }

  function addTypingBubble() {
    const bubble = document.createElement("div");
    bubble.className = "bubble sarah typing";
    bubble.innerHTML = "<span></span><span></span><span></span>";
    chatLog.appendChild(bubble);
    chatLog.scrollTop = chatLog.scrollHeight;
    return bubble;
  }

  // ---------- Speaking (TTS with a live voice waveform, browser fallback) ----------

  let audioCtx = null;
  let analyser = null;
  let analyserData = null;
  let audioGraphReady = false;
  let waveformRAF = null;
  let fallbackWaveformInterval = null;

  function ensureAudioGraph() {
    if (audioGraphReady) {
      if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
      return true;
    }
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtx.createMediaElementSource(ttsAudio);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyserData = new Uint8Array(analyser.frequencyBinCount);
      source.connect(analyser);
      analyser.connect(audioCtx.destination);
      audioGraphReady = true;
      return true;
    } catch (err) {
      console.warn("Voice-reactive waveform unavailable, using a simple talk animation:", err);
      return false;
    }
  }

  function setSpeakingVisual(active) {
    companionVisuals().forEach((el) => el.classList.toggle("is-speaking", active));
  }

  function setWaveformBars(intensity) {
    document.querySelectorAll(".waveform span").forEach((bar, i) => {
      const jitter = 0.6 + Math.sin(Date.now() / 90 + i) * 0.4;
      bar.style.transform = `scaleY(${(0.4 + intensity * 2.2 * jitter).toFixed(2)})`;
    });
  }

  function resetWaveformBars() {
    document.querySelectorAll(".waveform span").forEach((bar) => {
      bar.style.transform = "";
    });
  }

  function startRealWaveform() {
    setSpeakingVisual(true);
    if (!analyser) return;
    const tick = () => {
      analyser.getByteTimeDomainData(analyserData);
      let sum = 0;
      for (let i = 0; i < analyserData.length; i++) {
        const v = (analyserData[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / analyserData.length);
      setWaveformBars(rms * 3.2);
      waveformRAF = requestAnimationFrame(tick);
    };
    tick();
  }

  function stopRealWaveform() {
    if (waveformRAF) cancelAnimationFrame(waveformRAF);
    waveformRAF = null;
    setSpeakingVisual(false);
    resetWaveformBars();
  }

  function startFallbackWaveform() {
    setSpeakingVisual(true);
    fallbackWaveformInterval = setInterval(() => {
      setWaveformBars(Math.random() * 0.5 + 0.2);
    }, 110);
  }

  function stopFallbackWaveform() {
    if (fallbackWaveformInterval) clearInterval(fallbackWaveformInterval);
    fallbackWaveformInterval = null;
    setSpeakingVisual(false);
    resetWaveformBars();
  }

  async function speak(text) {
    if (!voiceOutToggle.checked) return;
    isSpeaking = true;
    setStatus("speaking...", "speaking");
    pauseListeningForSpeech();

    if (!ttsKnownUnavailable) {
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          ttsAudio.src = url;
          const graphReady = ensureAudioGraph();
          await ttsAudio.play();
          if (graphReady) startRealWaveform();
          else startFallbackWaveform();
          await new Promise((resolve) => {
            ttsAudio.onended = resolve;
            ttsAudio.onerror = resolve;
          });
          if (graphReady) stopRealWaveform();
          else stopFallbackWaveform();
          URL.revokeObjectURL(url);
          finishSpeaking();
          return;
        }
        if (res.status === 501) {
          ttsKnownUnavailable = true;
        }
      } catch (err) {
        console.warn("TTS request failed, falling back to browser voice:", err);
      }
    }

    speakWithBrowser(text);
  }

  function speakWithBrowser(text) {
    if (!("speechSynthesis" in window)) {
      finishSpeaking();
      return;
    }
    const utter = new SpeechSynthesisUtterance(text);
    utter.pitch = 1.15;
    utter.rate = 1.02;
    const voices = window.speechSynthesis.getVoices();
    const femaleVoice = voices.find((v) => /female|samantha|victoria|zira|karen/i.test(v.name));
    if (femaleVoice) utter.voice = femaleVoice;
    utter.onstart = startFallbackWaveform;
    utter.onend = () => {
      stopFallbackWaveform();
      finishSpeaking();
    };
    utter.onerror = () => {
      stopFallbackWaveform();
      finishSpeaking();
    };
    window.speechSynthesis.speak(utter);
  }

  function finishSpeaking() {
    isSpeaking = false;
    setStatus(voiceMode ? "listening..." : "online · here for you", voiceMode ? "listening" : null);
    resumeListeningAfterSpeech();
    markActivity();
  }

  // ---------- Sending messages ----------

  async function sendMessage(rawText) {
    const text = (rawText ?? textInput.value).trim();
    if (!text || isSending) return;

    markActivity();
    textInput.value = "";
    addBubble("user", text);
    isSending = true;
    const typingBubble = addTypingBubble();
    setStatus("thinking...", null);
    setMood("curious");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          message: text,
          gameContext: gameInput.value.trim(),
        }),
      });
      const data = await res.json();
      typingBubble.remove();

      if (!res.ok) {
        addBubble("system", "Something went wrong reaching Sarah. Try again in a moment.");
        return;
      }

      setMood(data.emotion || "neutral");
      addBubble("sarah", data.reply);
      speak(data.reply);
    } catch (err) {
      typingBubble.remove();
      addBubble("system", "Connection hiccup — Sarah didn't hear that.");
      console.error(err);
    } finally {
      isSending = false;
      if (!isSpeaking) {
        setStatus(voiceMode ? "listening..." : "online · here for you", voiceMode ? "listening" : null);
      }
    }
  }

  sendBtn.addEventListener("click", () => sendMessage());
  textInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMessage();
  });

  document.querySelectorAll(".quick-btn").forEach((btn) => {
    btn.addEventListener("click", () => sendMessage(btn.dataset.msg));
  });

  resetBtn.addEventListener("click", async () => {
    await fetch("/api/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    chatLog.innerHTML = "";
    setMood("happy");
    greet();
  });

  function greet() {
    addBubble(
      "sarah",
      "Hey, I'm Sarah! I'm so glad you're here. Tell me what we're playing tonight, or just talk to me — I love keeping you company."
    );
  }

  // ---------- Tap-to-react: she's a companion, not a static picture ----------

  const BOOP_LINES = [
    "Hey! I felt that.",
    "Aww, hi there.",
    "You just wanted my attention, didn't you?",
    "I'm right here, silly.",
    "Careful, I might get used to that.",
  ];

  function boop() {
    if (isSending) return;
    const line = BOOP_LINES[Math.floor(Math.random() * BOOP_LINES.length)];
    setMood("happy");
    addBubble("sarah", line);
    speak(line);
  }

  document.querySelectorAll(".companion-photo").forEach((img) => {
    img.addEventListener("click", boop);
  });

  // ---------- Voice input (Web Speech API) ----------
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognizer = null;
  let voiceMode = false;
  let recognizerRunning = false;

  if (SpeechRecognition) {
    recognizer = new SpeechRecognition();
    recognizer.continuous = true;
    recognizer.interimResults = false;
    recognizer.lang = "en-US";

    recognizer.onresult = (event) => {
      const last = event.results[event.results.length - 1];
      const transcript = last[0].transcript.trim();
      if (transcript) sendMessage(transcript);
    };

    recognizer.onend = () => {
      recognizerRunning = false;
      if (voiceMode && !isSpeaking) {
        startRecognizer();
      }
    };

    recognizer.onerror = (event) => {
      console.warn("Speech recognition error:", event.error);
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        // Don't tear down an active call just because the mic is
        // unavailable — keep the call screen open (with its text
        // fallback) so the conversation can continue.
        stopVoiceMode();
        const msg = "Microphone access was blocked, so voice chat is off. You can still type to Sarah.";
        addBubble("system", msg);
        setCaption(msg);
      }
    };
  } else {
    micBtn.disabled = true;
    micBtn.title = "Voice input isn't supported in this browser — try Chrome.";
    hint.textContent = "Voice input isn't supported in this browser, but you can still type and hear Sarah reply.";
  }

  function startRecognizer() {
    if (!recognizer || recognizerRunning) return;
    try {
      recognizer.start();
      recognizerRunning = true;
    } catch (err) {
      console.warn("Recognizer start failed:", err);
    }
  }

  function pauseListeningForSpeech() {
    if (recognizer && recognizerRunning) {
      recognizer.stop();
    }
  }

  function resumeListeningAfterSpeech() {
    if (voiceMode && !micMuted) startRecognizer();
  }

  function startVoiceMode() {
    if (!recognizer) return;
    voiceMode = true;
    micBtn.classList.add("active");
    hint.textContent = "Voice chat is on — just talk, Sarah is listening.";
    setStatus("listening...", "listening");
    startRecognizer();
  }

  function stopVoiceMode() {
    voiceMode = false;
    micBtn.classList.remove("active");
    hint.textContent = "Tap the mic to talk hands-free, or tap her photo to say hi.";
    setStatus("online · here for you", null);
    if (recognizer && recognizerRunning) recognizer.stop();
  }

  micBtn.addEventListener("click", () => {
    if (voiceMode) {
      stopVoiceMode();
    } else {
      startVoiceMode();
    }
  });

  // ---------- "Call Sarah" full-screen mode + proactive check-ins ----------

  let micMuted = false;
  let idleCheckInTimer = null;
  const IDLE_CHECKIN_MS = 22000;

  function markActivity() {
    if (!inCallMode) return;
    clearTimeout(idleCheckInTimer);
    idleCheckInTimer = setTimeout(maybeProactiveCheckIn, IDLE_CHECKIN_MS);
  }

  async function maybeProactiveCheckIn() {
    if (!inCallMode || isSpeaking || isSending) {
      markActivity();
      return;
    }
    try {
      const res = await fetch("/api/proactive-line");
      const data = await res.json();
      setMood(data.emotion || "caring");
      addBubble("sarah", data.reply);
      speak(data.reply);
    } catch (err) {
      console.warn("Proactive check-in failed:", err);
    }
    markActivity();
  }

  function startCall() {
    inCallMode = true;
    callOverlay.hidden = false;
    callCaption.textContent = "\u00a0";
    micMuted = false;
    callMuteBtn.classList.remove("muted");
    if (!voiceMode) startVoiceMode();
    markActivity();
  }

  function endCall() {
    if (!inCallMode) return;
    inCallMode = false;
    clearTimeout(idleCheckInTimer);
    callOverlay.hidden = true;
    stopVoiceMode();
  }

  callBtn.addEventListener("click", startCall);
  endCallBtn.addEventListener("click", endCall);
  callSendBtn.addEventListener("click", () => {
    sendMessage(callTextInput.value);
    callTextInput.value = "";
  });
  callTextInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      sendMessage(callTextInput.value);
      callTextInput.value = "";
    }
  });
  callMuteBtn.addEventListener("click", () => {
    micMuted = !micMuted;
    callMuteBtn.classList.toggle("muted", micMuted);
    if (micMuted) {
      pauseListeningForSpeech();
    } else {
      resumeListeningAfterSpeech();
    }
  });

  // ---------- Voice engine status badge ----------

  const VOICE_PROVIDER_LABELS = {
    elevenlabs: "ElevenLabs — breathy, human voice",
    openai: "OpenAI TTS",
    browser: "Browser voice (basic) — add an ELEVENLABS_API_KEY for a real voice",
  };

  async function checkVoiceEngine() {
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      const provider = data.voiceProvider || "browser";
      voiceStatusText.textContent = `Voice: ${VOICE_PROVIDER_LABELS[provider] || provider}`;
      voiceStatus.dataset.provider = provider;
    } catch (err) {
      voiceStatusText.textContent = "Voice: unable to check status";
      voiceStatus.dataset.provider = "browser";
    }
  }

  checkVoiceEngine();
  applyAvatarStyle(avatarStyle);
  greet();
})();
