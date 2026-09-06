(function () {
  const chatLog = document.getElementById("chatLog");
  const textInput = document.getElementById("textInput");
  const sendBtn = document.getElementById("sendBtn");
  const micBtn = document.getElementById("micBtn");
  const gameInput = document.getElementById("gameInput");
  const voiceOutToggle = document.getElementById("voiceOutToggle");
  const resetBtn = document.getElementById("resetBtn");
  const statusText = document.getElementById("statusText");
  const statusPulse = document.getElementById("statusPulse");
  const ttsAudio = document.getElementById("ttsAudio");
  const hint = document.getElementById("hint");

  const avatarEl = document.getElementById("avatar");
  const mouthTalk = document.getElementById("mouthTalk");
  const avatarHomeParent = avatarEl.parentNode;
  const avatarHomeNextSibling = avatarEl.nextSibling;

  const callBtn = document.getElementById("callBtn");
  const callOverlay = document.getElementById("callOverlay");
  const callAvatarSlot = document.getElementById("callAvatarSlot");
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

  // ---------- Expressive avatar: mood, blinking, lip-sync ----------

  function setMood(mood) {
    if (!mood || mood === avatarEl.dataset.mood) return;
    avatarEl.dataset.mood = mood;
    // Restart the "reaction pop" animation every time her mood actually
    // changes, so the shift is obvious even at a glance.
    avatarEl.classList.remove("mood-pop");
    void avatarEl.offsetWidth;
    avatarEl.classList.add("mood-pop");
  }

  function startBlinking() {
    setInterval(() => {
      avatarEl.classList.add("is-blinking");
      setTimeout(() => avatarEl.classList.remove("is-blinking"), 140);
    }, 2600 + Math.random() * 3200);
  }

  let audioCtx = null;
  let analyser = null;
  let analyserData = null;
  let audioGraphReady = false;
  let lipSyncRAF = null;
  let fallbackTalkInterval = null;

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
      console.warn("Lip-sync audio graph unavailable, using simple talk animation:", err);
      return false;
    }
  }

  function setMouthOpenness(v) {
    mouthTalk.setAttribute("ry", (1.5 + Math.max(0, Math.min(1, v)) * 8.5).toFixed(2));
  }

  function startLipSync() {
    avatarEl.classList.add("is-speaking");
    if (!analyser) return;
    const tick = () => {
      analyser.getByteTimeDomainData(analyserData);
      let sum = 0;
      for (let i = 0; i < analyserData.length; i++) {
        const v = (analyserData[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / analyserData.length);
      setMouthOpenness(rms * 4.5);
      lipSyncRAF = requestAnimationFrame(tick);
    };
    tick();
  }

  function stopLipSync() {
    if (lipSyncRAF) cancelAnimationFrame(lipSyncRAF);
    lipSyncRAF = null;
    avatarEl.classList.remove("is-speaking");
    setMouthOpenness(0);
  }

  function startFallbackTalkAnimation() {
    avatarEl.classList.add("is-speaking");
    fallbackTalkInterval = setInterval(() => {
      setMouthOpenness(Math.random() * 0.9 + 0.1);
    }, 110);
  }

  function stopFallbackTalkAnimation() {
    if (fallbackTalkInterval) clearInterval(fallbackTalkInterval);
    fallbackTalkInterval = null;
    avatarEl.classList.remove("is-speaking");
    setMouthOpenness(0);
  }

  // ---------- Status + chat log ----------

  function setStatus(text, mode) {
    statusText.textContent = text;
    statusPulse.classList.remove("speaking", "listening");
    if (mode) statusPulse.classList.add(mode);
    if (inCallMode) callStatusText.textContent = text;
  }

  function setCaption(text) {
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

  // ---------- Speaking (TTS with lip-sync, browser fallback) ----------

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
          if (graphReady) startLipSync();
          else startFallbackTalkAnimation();
          await new Promise((resolve) => {
            ttsAudio.onended = resolve;
            ttsAudio.onerror = resolve;
          });
          if (graphReady) stopLipSync();
          else stopFallbackTalkAnimation();
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
    utter.onstart = startFallbackTalkAnimation;
    utter.onend = () => {
      stopFallbackTalkAnimation();
      finishSpeaking();
    };
    utter.onerror = () => {
      stopFallbackTalkAnimation();
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
    hint.textContent = "Tap the mic to talk hands-free, like real voice chat.";
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
    callAvatarSlot.appendChild(avatarEl);
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
    avatarHomeParent.insertBefore(avatarEl, avatarHomeNextSibling);
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

  startBlinking();
  setMood("happy");
  greet();
})();
