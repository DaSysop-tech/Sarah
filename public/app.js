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

  function setStatus(text, mode) {
    statusText.textContent = text;
    statusPulse.classList.remove("speaking", "listening");
    if (mode) statusPulse.classList.add(mode);
  }

  function addBubble(role, text) {
    const bubble = document.createElement("div");
    bubble.className = `bubble ${role}`;
    bubble.textContent = text;
    chatLog.appendChild(bubble);
    chatLog.scrollTop = chatLog.scrollHeight;
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
          await ttsAudio.play();
          await new Promise((resolve) => {
            ttsAudio.onended = resolve;
            ttsAudio.onerror = resolve;
          });
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
    utter.onend = finishSpeaking;
    utter.onerror = finishSpeaking;
    window.speechSynthesis.speak(utter);
  }

  function finishSpeaking() {
    isSpeaking = false;
    setStatus(voiceMode ? "listening..." : "online · here for you", voiceMode ? "listening" : null);
    resumeListeningAfterSpeech();
  }

  async function sendMessage(rawText) {
    const text = (rawText ?? textInput.value).trim();
    if (!text || isSending) return;

    textInput.value = "";
    addBubble("user", text);
    isSending = true;
    const typingBubble = addTypingBubble();
    setStatus("thinking...", null);

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
        stopVoiceMode();
        addBubble("system", "Microphone access was blocked, so voice chat is off. You can still type to Sarah.");
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
    if (voiceMode) startRecognizer();
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

  greet();
})();
