const Recognition = () => globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;

export function createVoiceSessionController({
  onState = () => {},
  onPartial = () => {},
  onAudioLevel = () => {},
  onInterruptionAvailability = () => {},
  diagnostics = false,
  onUtterance = async () => "",
  onError = () => {},
  recognitionFactory = () => {
    const Constructor = Recognition();
    return Constructor ? new Constructor() : null;
  },
  synthesis = globalThis.speechSynthesis,
  utteranceFactory = (text) => new SpeechSynthesisUtterance(text),
  mediaDevices = globalThis.navigator?.mediaDevices,
  audioContextFactory = () => {
    const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
    return Context ? new Context() : null;
  },
  documentObject = globalThis.document,
  windowObject = globalThis.window,
  recognitionLanguage = globalThis.navigator?.language || "en-US",
  iosPwa = false,
  maxRestarts = 3,
  restartDelayMs = 350,
  responseTimeoutMs = 60_000,
  speechStartTimeoutMs = 10_000,
  vadThreshold = 0.025,
  vadReleaseThreshold = 0.016,
  vadNoiseMultiplier = 2.5,
  vadConsecutiveWindows = 6,
  vadWindowMs = 40,
  vadCooldownMs = 1500,
} = {}) {
  let active = false;
  let disposed = false;
  let generation = 0;
  let recognition = null;
  let playbackMonitorRecognition = null;
  let restartTimer = null;
  let connectTimer = null;
  let restartCount = 0;
  let handlingTurn = false;
  let currentUtterance = null;
  let currentSpeechResolve = null;
  let speechStartTimer = null;
  let voiceOutput = true;
  let speechSequence = 0;
  let lastResponse = "";
  let state = "IDLE";
  let meterStream = null;
  let meterContext = null;
  let meterSource = null;
  let meterNode = null;
  let meterFrame = null;
  let meterFrameIsRaf = false;
  let meterStarting = false;
  let meterTick = null;
  let vadLastWindow = 0;
  let vadAboveThreshold = 0;
  let lastInterruptionAt = -Infinity;
  let interruptionPending = false;
  let ambientNoiseRms = 0.008;
  let lastMeterDiagnosticAt = 0;
  let trackRecognitionUnsupported = false;
  let recoveryUsingNativeMicrophone = false;
  let learnerSpeechActive = false;
  let interruptionHasLearnerEvidence = false;
  const pendingRequests = new Map();

  const isCurrent = (token) => active && generation === token;
  const debug = (event, details = {}) => {
    if (diagnostics) globalThis.console?.debug?.("[ADAPT Voice Tutor]", event, details);
  };
  const clearRestart = () => { if (restartTimer !== null) clearTimeout(restartTimer); restartTimer = null; };
  const clearConnect = () => { if (connectTimer !== null) clearTimeout(connectTimer); connectTimer = null; };
  const clearSpeechStart = () => { if (speechStartTimer !== null) clearTimeout(speechStartTimer); speechStartTimer = null; };
  const clearPendingRequests = () => {
    for (const [timer, reject] of pendingRequests) {
      clearTimeout(timer);
      reject(new Error("Voice request was cancelled."));
    }
    pendingRequests.clear();
  };
  const emitState = (next) => {
    debug("state", { from: state, to: next });
    state = next;
    onState(next);
    if (["LISTENING", "SPEAKING"].includes(next) && meterNode && meterFrame === null) meterTick?.();
  };
  const isTutorEcho = (text) => {
    const tokens = (value) => String(value || "").toLocaleLowerCase().match(/[\p{L}\p{N}']+/gu) || [];
    const heard = tokens(lastResponse);
    const candidate = tokens(text);
    if (!candidate.length || !heard.length) return false;
    if (candidate.length === heard.length && candidate.every((word, index) => word === heard[index])) return true;
    if (candidate.length >= 4 && candidate.length <= heard.length) {
      for (let start = 0; start <= heard.length - candidate.length; start += 1) {
        if (candidate.every((word, index) => word === heard[start + index])) return true;
      }
    }
    if (candidate.length < 5) return false;
    let previous = new Uint16Array(heard.length + 1);
    for (const word of candidate) {
      const current = new Uint16Array(heard.length + 1);
      for (let index = 1; index <= heard.length; index += 1) {
        current[index] = word === heard[index - 1]
          ? previous[index - 1] + 1
          : Math.max(previous[index], current[index - 1]);
      }
      previous = current;
    }
    const orderedOverlap = previous[heard.length] / candidate.length;
    return orderedOverlap >= 0.8;
  };
  const isCompleteTutorResponse = (text) => {
    const tokens = (value) => String(value || "").toLocaleLowerCase().match(/[\p{L}\p{N}']+/gu) || [];
    const heard = tokens(lastResponse);
    const candidate = tokens(text);
    return candidate.length === heard.length && candidate.length > 0
      && candidate.every((word, index) => word === heard[index]);
  };

  const stopMeter = () => {
    if (meterFrame !== null) {
      if (meterFrameIsRaf) globalThis.cancelAnimationFrame?.(meterFrame);
      else clearTimeout(meterFrame);
    }
    meterFrame = null;
    meterFrameIsRaf = false;
    meterStarting = false;
    meterTick = null;
    try { meterSource?.disconnect?.(); } catch { /* Audio nodes may already be disconnected. */ }
    meterSource = null;
    try { meterNode?.disconnect?.(); } catch { /* Audio nodes may already be disconnected. */ }
    meterNode = null;
    for (const track of meterStream?.getTracks?.() || []) track.stop();
    meterStream = null;
    const context = meterContext;
    meterContext = null;
    if (context && context.state !== "closed") void context.close?.().catch?.(() => {});
    onAudioLevel(null);
  };

  const startMeter = async (token) => {
    if (!mediaDevices?.getUserMedia || meterStarting || meterStream || !isCurrent(token)) {
      if (!mediaDevices?.getUserMedia) onInterruptionAvailability(false);
      return;
    }
    meterStarting = true;
    let stream = null;
    let context = null;
    try {
      stream = await mediaDevices.getUserMedia({ audio: {
        echoCancellation: { ideal: true },
        noiseSuppression: { ideal: true },
        autoGainControl: { ideal: true },
      } });
      if (!isCurrent(token)) {
        for (const track of stream.getTracks?.() || []) track.stop();
        meterStarting = false;
        return;
      }
      context = audioContextFactory();
      if (!context) {
        for (const track of stream.getTracks?.() || []) track.stop();
        meterStarting = false;
        onInterruptionAvailability(false);
        return;
      }
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      meterStream = stream;
      meterContext = context;
      meterSource = source;
      meterNode = analyser;
      meterStarting = false;
      onInterruptionAvailability(true);
      const audioTrack = stream.getAudioTracks?.()[0];
      const audioSettings = audioTrack?.getSettings?.() || {};
      debug("analyser-ready", {
        contextState: context.state,
        trackState: audioTrack?.readyState || "unavailable",
        trackMuted: Boolean(audioTrack?.muted),
        echoCancellation: audioSettings.echoCancellation ?? "unknown",
        noiseSuppression: audioSettings.noiseSuppression ?? "unknown",
        autoGainControl: audioSettings.autoGainControl ?? "unknown",
      });
      const samples = new Uint8Array(analyser.fftSize);
      const tick = () => {
        if (!isCurrent(token) || !["LISTENING", "SPEAKING"].includes(state) || meterNode !== analyser) { meterFrame = null; return; }
        analyser.getByteTimeDomainData(samples);
        let sumSquares = 0;
        for (const sample of samples) {
          const normalized = (sample - 128) / 128;
          sumSquares += normalized * normalized;
        }
        const rms = Math.sqrt(sumSquares / samples.length);
        const sampleNow = globalThis.performance?.now?.() ?? Date.now();
        if (diagnostics && sampleNow - lastMeterDiagnosticAt >= 250) {
          lastMeterDiagnosticAt = sampleNow;
          debug("meter-rms", { rms: Number(rms.toFixed(4)), state, contextState: meterContext?.state || "unavailable", trackState: meterStream?.getAudioTracks?.()[0]?.readyState || "unavailable" });
        }
        if (state === "LISTENING") {
          onAudioLevel(Math.max(0, Math.min(1, (rms - 0.012) / 0.16)));
          vadAboveThreshold = 0;
          if (!learnerSpeechActive) {
            if (rms <= ambientNoiseRms * 1.8) ambientNoiseRms = ambientNoiseRms * 0.92 + rms * 0.08;
            else ambientNoiseRms = ambientNoiseRms * 0.998 + Math.min(rms, 0.08) * 0.002;
          }
        } else {
          onAudioLevel(null);
        }
        meterFrameIsRaf = Boolean(globalThis.requestAnimationFrame);
        meterFrame = meterFrameIsRaf ? globalThis.requestAnimationFrame(tick) : setTimeout(tick, 40);
      };
      meterTick = tick;
      if (context.state === "suspended") void context.resume?.().catch?.(() => {});
      if (["LISTENING", "SPEAKING"].includes(state)) tick();
      return true;
    } catch (error) {
      debug("microphone-analyser-failure", { name: error?.name || "unknown" });
      for (const track of stream?.getTracks?.() || []) track.stop();
      if (context && context.state !== "closed") void context.close?.().catch?.(() => {});
      meterStarting = false;
      onAudioLevel(null);
      onInterruptionAvailability(false);
      return false;
    } finally {
      meterStarting = false;
    }
  };

  const stopRecognition = (abort = false) => {
    const current = recognition;
    recognition = null;
    if (playbackMonitorRecognition === current) playbackMonitorRecognition = null;
    if (!current) return;
    learnerSpeechActive = false;
    current.onstart = current.onresult = current.onerror = current.onend = current.onspeechstart = null;
    try { abort ? current.abort() : current.stop(); } catch { /* Recognition may already have ended. */ }
  };

  const cancelSpeech = () => {
    speechSequence += 1;
    clearSpeechStart();
    if (currentUtterance) currentUtterance.onend = currentUtterance.onerror = null;
    currentUtterance = null;
    try { synthesis?.cancel?.(); } catch { /* Synthesis may already be idle. */ }
    const resolveCurrentSpeech = currentSpeechResolve;
    currentSpeechResolve = null;
    resolveCurrentSpeech?.(false);
  };

  const confirmInterruption = (token, source, instance = recognition) => {
    if (!isCurrent(token) || state !== "SPEAKING" || interruptionPending) return false;
    debug("interruption-confirmed", { source, consecutive: vadAboveThreshold, threshold: vadThreshold });
    interruptionPending = true;
    interruptionHasLearnerEvidence = source.startsWith("recognition-") || source === "manual";
    restartCount = 0;
    lastInterruptionAt = globalThis.performance?.now?.() ?? Date.now();
    vadAboveThreshold = 0;
    cancelSpeech();
    handlingTurn = false;
    if (source === "manual") {
      clearConnect();
      stopRecognition(true);
      stopMeter();
      recoveryUsingNativeMicrophone = true;
      onInterruptionAvailability(false);
      debug("manual-interruption-restarting-browser-microphone", { reason: "discard playback monitor and start a fresh learner recognizer" });
      if (iosPwa && mediaDevices?.getUserMedia) {
        emitState("CONNECTING");
        let restartScheduled = false;
        const scheduleRecognition = () => {
          if (restartScheduled || !isCurrent(token)) return;
          restartScheduled = true;
          clearRestart();
          restartTimer = setTimeout(() => {
            if (isCurrent(token) && interruptionPending) listen(token);
          }, 350);
        };
        // iOS WebKit can leave SpeechRecognition hung after TTS. Re-prime its mic
        // route, release that temporary stream, then start a fresh recognizer.
        let micPrimeTimeout = setTimeout(scheduleRecognition, 2500);
        try {
          void mediaDevices.getUserMedia({ audio: {
            echoCancellation: { ideal: true },
            noiseSuppression: { ideal: true },
            autoGainControl: { ideal: true },
          } }).then((stream) => {
            for (const track of stream.getTracks?.() || []) track.stop();
            clearTimeout(micPrimeTimeout);
            debug("ios-interruption-microphone-reprimed");
            scheduleRecognition();
          }).catch((error) => {
            clearTimeout(micPrimeTimeout);
            debug("ios-interruption-microphone-reprime-failed", { name: error?.name || "unknown" });
            scheduleRecognition();
          });
        } catch (error) {
          clearTimeout(micPrimeTimeout);
          debug("ios-interruption-microphone-reprime-failed", { name: error?.name || "unknown" });
          scheduleRecognition();
        }
      } else listen(token);
      return true;
    }
    if (instance && recognition === instance && playbackMonitorRecognition === instance) emitState("LISTENING");
    else if (recognition) emitState("LISTENING");
    else listen(token);
    return true;
  };

  const fail = (message, token = generation) => {
    if (!isCurrent(token)) return;
    active = false;
    clearRestart();
    clearConnect();
    clearPendingRequests();
    stopRecognition(true);
    stopMeter();
    cancelSpeech();
    handlingTurn = false;
    emitState("ERROR");
    onError(message);
  };

  const listen = (token, duringPlayback = false) => {
    if (!isCurrent(token) || (handlingTurn && !duringPlayback) || disposed || recognition) return;
    clearRestart();
    let instance;
    try { instance = recognitionFactory(); } catch { instance = null; }
    if (!instance) {
      fail("Speech recognition is not supported in this browser. You can still ask by typing.", token);
      return;
    }
    recognition = instance;
    let bestInterim = "";
    instance.continuous = false;
    instance.interimResults = true;
    instance.lang = recognitionLanguage;
    instance.onstart = () => {
      if (!isCurrent(token) || recognition !== instance) return;
      clearConnect();
      learnerSpeechActive = false;
      if (duringPlayback && !interruptionPending && state === "SPEAKING") playbackMonitorRecognition = instance;
      debug("recognition-started", { source: trackRecognitionUnsupported ? "browser-microphone" : (meterStream ? "provided-audio-track" : "browser-microphone"), duringPlayback });
      emitState(duringPlayback && !interruptionPending && state === "SPEAKING" ? "SPEAKING" : "LISTENING");
    };
    instance.onspeechstart = () => {
      if (!isCurrent(token) || recognition !== instance) return;
      learnerSpeechActive = true;
      if (duringPlayback) debug("recognition-speechstart-candidate", { awaitingNonEchoTranscript: true });
    };
    instance.onspeechend = () => { if (recognition === instance) learnerSpeechActive = false; };
    instance.onresult = (event) => {
      if (!isCurrent(token) || recognition !== instance) return;
      let partial = "";
      let finalText = "";
      for (let index = event.resultIndex || 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = result?.[0]?.transcript?.trim() || "";
        if (result?.isFinal) finalText += `${finalText ? " " : ""}${text}`;
        else partial += `${partial ? " " : ""}${text}`;
      }
      onPartial(partial);
      const utterance = finalText.trim();
      if (partial || utterance) {
        learnerSpeechActive = true;
        restartCount = 0;
      }
      debug("recognition-result", { hasFinal: Boolean(utterance), transcriptLength: utterance.length });
      if (partial && !isTutorEcho(partial)) bestInterim = partial;
      if (duringPlayback && state === "SPEAKING" && playbackMonitorRecognition === instance && !interruptionPending) {
        if (partial) debug("learner-speech-heard-during-playback", { transcriptLength: partial.length, action: "manual-interrupt-required" });
      }
      if (interruptionPending && partial.trim().split(/\s+/).filter(Boolean).length >= 2 && !isTutorEcho(partial)) {
        interruptionHasLearnerEvidence = true;
        bestInterim = partial;
      }
      if (!utterance) return;
      if (duringPlayback && state === "SPEAKING" && playbackMonitorRecognition === instance && !interruptionPending) {
        if (isTutorEcho(utterance)) {
          debug("playback-echo-discarded", { transcriptLength: utterance.length });
          stopRecognition();
          listen(token, true);
          return;
        }
        debug("learner-speech-during-playback", { transcriptLength: utterance.length, action: "manual-interrupt-required" });
        onPartial("");
        stopRecognition();
        listen(token, true);
        return;
      }
      if (interruptionPending && !interruptionHasLearnerEvidence && isCompleteTutorResponse(utterance)) {
        stopRecognition();
        listen(token, state === "SPEAKING");
        return;
      }
      if (utterance && recoveryUsingNativeMicrophone) {
        recoveryUsingNativeMicrophone = false;
        debug("interruption-native-microphone-recovered", { transcriptLength: utterance.length });
      }
      if (handlingTurn) return;
      handlingTurn = true;
      stopRecognition();
      void processUtterance(utterance, token);
    };
    instance.onerror = (event) => {
      if (!isCurrent(token) || recognition !== instance) return;
      debug("recognition-error", { error: event?.error || "unknown", source: meterStream ? "provided-audio-track" : "browser-microphone", duringPlayback });
      if (event?.error === "audio-capture" && meterStream && !trackRecognitionUnsupported) {
        trackRecognitionUnsupported = true;
        clearConnect();
        stopRecognition(true);
        stopMeter();
        onInterruptionAvailability(false);
        debug("track-recognition-unavailable", { fallback: "browser microphone; automatic interruption disabled" });
        if (!duringPlayback) restartTimer = setTimeout(() => listen(token), 0);
        return;
      }
      if (["not-allowed", "service-not-allowed", "audio-capture"].includes(event?.error)) {
        fail(event.error === "audio-capture" ? "No microphone was available. Check your microphone and try again." : "Microphone access was denied. Allow microphone access in your browser, then press Start to try again.", token);
      } else if (event?.error === "network") {
        fail("Browser speech recognition lost its network connection. Reconnect, then press Start to try again.", token);
      }
    };
    instance.onend = () => {
      if (!isCurrent(token) || handlingTurn || recognition !== instance) return;
      debug("recognition-ended", { source: meterStream ? "provided-audio-track" : "browser-microphone" });
      clearConnect();
      if (interruptionPending && interruptionHasLearnerEvidence && bestInterim.trim() && !isTutorEcho(bestInterim)) {
        const recoveredUtterance = bestInterim.trim();
        debug("interruption-partial-recovered", { transcriptLength: recoveredUtterance.length });
        recoveryUsingNativeMicrophone = false;
        handlingTurn = true;
        stopRecognition();
        void processUtterance(recoveredUtterance, token);
        return;
      }
      recognition = null;
      learnerSpeechActive = false;
      if (playbackMonitorRecognition === instance) playbackMonitorRecognition = null;
      if (interruptionPending && meterStream && !trackRecognitionUnsupported && restartCount >= 2) {
        recoveryUsingNativeMicrophone = true;
        stopMeter();
        onInterruptionAvailability(false);
        restartCount = 0;
        debug("interruption-switch-to-native-microphone", { reason: "repeated empty track-recognition endings" });
      }
      if (restartCount >= maxRestarts && !interruptionPending) {
        fail("Speech recognition stopped repeatedly. Press Start to try again.", token);
        return;
      }
      restartCount += 1;
      const retryDelay = interruptionPending
        ? Math.min(restartDelayMs * (restartCount + 1), 2000)
        : restartDelayMs;
      restartTimer = setTimeout(() => listen(token, state === "SPEAKING"), retryDelay);
    };
    try {
      if (!duringPlayback) emitState("CONNECTING");
      else debug("recognition-monitor-start-request", { state, trackState: meterStream?.getAudioTracks?.()[0]?.readyState || "unavailable" });
      connectTimer = setTimeout(() => {
        if (isCurrent(token) && recognition === instance && (duringPlayback ? state === "SPEAKING" : state === "CONNECTING")) {
          if (duringPlayback) {
            stopRecognition(true);
            stopMeter();
            onInterruptionAvailability(false);
            debug("recognition-monitor-timeout", { fallback: "barge-in disabled until next session" });
          } else fail("The microphone did not start. Check browser permission and device settings, then press Start to try again.", token);
        }
      }, 15_000);
      const track = meterStream?.getAudioTracks?.()[0];
      if (track && !trackRecognitionUnsupported && !recoveryUsingNativeMicrophone) {
        debug("recognition-start-request", { source: "provided-audio-track", trackState: track.readyState, contextState: meterContext?.state || "unavailable" });
        try { instance.start(track); }
        catch {
          trackRecognitionUnsupported = true;
          stopMeter();
          onInterruptionAvailability(false);
          debug("track-recognition-unavailable", { reason: "synchronous start() exception", fallback: "browser microphone; automatic interruption disabled" });
          if (duringPlayback) stopRecognition(true);
          else instance.start();
        }
      } else {
        if (meterStream) {
          stopMeter();
          onInterruptionAvailability(false);
        }
        debug("recognition-start-request", { source: "browser-microphone" });
        instance.start();
      }
    } catch (error) {
      fail(error?.name === "NotAllowedError" ? "Microphone access was denied. Allow microphone access in your browser, then press Start to try again." : "The microphone could not be started. Check browser permissions and try again.", token);
    }
  };

  const runRequest = (text, token, allowInactive = false) => new Promise((resolve, reject) => {
    let timeout;
    const request = Promise.resolve().then(() => onUtterance(text, () => generation === token && (allowInactive || active)));
    const limit = new Promise((_, rejectTimeout) => {
      timeout = setTimeout(() => {
        pendingRequests.delete(timeout);
        if (generation === token && (allowInactive || active)) {
          active = false;
          generation += 1;
          clearRestart();
          stopRecognition(true);
          stopMeter();
          handlingTurn = false;
          emitState("ERROR");
          onError("The tutor took too long to respond. Check your connection or device, then press Start to try again.");
        }
        rejectTimeout(new Error("Tutor request timed out."));
      }, responseTimeoutMs);
      pendingRequests.set(timeout, rejectTimeout);
    });
    Promise.race([request, limit]).then(resolve, reject).finally(() => {
      clearTimeout(timeout);
      pendingRequests.delete(timeout);
    });
  });

  const speak = (text, token, allowIdle = false) => new Promise((resolve) => {
    lastResponse = String(text || "").trim();
    const valid = () => generation === token && (allowIdle || active);
    if (!lastResponse || !voiceOutput || !synthesis || !valid()) {
      handlingTurn = false;
      if (lastResponse && voiceOutput && !synthesis) onError("Speech playback is not supported in this browser. The response is visible on screen.");
      if (isCurrent(token)) listen(token);
      resolve(false);
      return;
    }
    let utterance;
    try { utterance = utteranceFactory(lastResponse); }
    catch { active = false; handlingTurn = false; emitState("ERROR"); onError("Speech playback is unavailable. Your tutor response is still shown."); resolve(false); return; }
    emitState("THINKING");
    const utteranceSequence = ++speechSequence;
    const finish = (error = false) => {
      if (utteranceSequence !== speechSequence || !valid()) { resolve(false); return; }
      clearSpeechStart();
      currentUtterance = null;
      currentSpeechResolve = null;
      debug(error ? "speech-playback-failed" : "speech-playback-finished");
      if (error) onError("The tutor response is shown, but speech playback failed in this browser.");
      handlingTurn = false;
      if (active) {
        if (recognition) stopRecognition(true);
        clearConnect();
        listen(token);
      }
      else emitState("IDLE");
      resolve(!error);
    };
    currentUtterance = utterance;
    currentSpeechResolve = resolve;
    utterance.onstart = () => {
      if (utteranceSequence !== speechSequence || !valid()) return;
      clearSpeechStart();
      interruptionPending = false;
      interruptionHasLearnerEvidence = false;
      lastInterruptionAt = -Infinity;
      vadAboveThreshold = 0;
      vadLastWindow = globalThis.performance?.now?.() ?? Date.now();
      stopRecognition(true);
      stopMeter();
      playbackMonitorRecognition = null;
      debug("speech-playback-started-with-microphone-released");
      emitState("SPEAKING");
    };
    utterance.onend = () => finish(false);
    utterance.onerror = (event) => {
      debug("speech-synthesis-error", { error: event?.error || "unknown" });
      finish(true);
    };
    speechStartTimer = setTimeout(() => {
      if (utteranceSequence !== speechSequence || !valid()) return;
      cancelSpeech();
      handlingTurn = false;
      onError("Speech playback did not start. The response remains available on screen.");
      if (active) listen(token);
      else emitState("IDLE");
      resolve(false);
    }, speechStartTimeoutMs);
    try {
      if (synthesis.paused) {
        debug("speech-synthesis-resume-requested");
        try { synthesis.resume?.(); } catch { /* Some engines expose resume but do not implement it. */ }
      }
      debug("speech-synthesis-utterance-queued", { textLength: lastResponse.length });
      synthesis.speak(utterance);
    }
    catch { finish(true); }
  });

  const processUtterance = async (text, token) => {
    if (!isCurrent(token)) return;
    emitState("THINKING");
    onPartial("");
    try {
      const response = await runRequest(text, token);
      if (!isCurrent(token)) return;
      await speak(response, token);
    } catch (error) {
      if (!isCurrent(token)) return;
      active = false;
      stopRecognition(true);
      stopMeter();
      handlingTurn = false;
      emitState("ERROR");
      onError(error?.message || "ADAPT could not answer. Check your connection and try again.");
    }
  };

  const start = () => {
    if (active || disposed) return;
    active = true;
    generation += 1;
    restartCount = 0;
    handlingTurn = false;
    interruptionPending = false;
    interruptionHasLearnerEvidence = false;
    lastInterruptionAt = -Infinity;
    trackRecognitionUnsupported = false;
    recoveryUsingNativeMicrophone = false;
    ambientNoiseRms = 0.008;
    learnerSpeechActive = false;
    onPartial("");
    const token = generation;
    debug("session-start", { vadThreshold, vadReleaseThreshold, vadNoiseMultiplier, vadConsecutiveWindows, vadWindowMs, vadCooldownMs });
    if (!mediaDevices?.getUserMedia) {
      onInterruptionAvailability(false);
      listen(token);
      return;
    }
    emitState("CONNECTING");
    void startMeter(token).finally(() => { if (isCurrent(token)) listen(token); });
  };

  const stop = () => {
    active = false;
    generation += 1;
    handlingTurn = false;
    clearRestart();
    clearConnect();
    clearPendingRequests();
    stopRecognition(true);
    stopMeter();
    cancelSpeech();
    onPartial("");
    emitState("IDLE");
  };

  const submitText = async (text) => {
    const value = String(text || "").trim();
    if (!value || disposed) return;
    if (handlingTurn && state === "SPEAKING") {
      handlingTurn = false;
    } else if (handlingTurn) return;
    const token = generation;
    const wasActive = active;
    handlingTurn = true;
    clearRestart();
    stopRecognition(true);
    cancelSpeech();
    emitState("THINKING");
    try {
      const response = await runRequest(value, token, !wasActive);
      if (wasActive && isCurrent(token)) await speak(response, token);
      else if (generation === token) { handlingTurn = false; emitState("IDLE"); }
    } catch (error) {
      if (wasActive && !isCurrent(token)) return;
      if (wasActive) { active = false; stopRecognition(true); stopMeter(); }
      handlingTurn = false;
      if (generation === token) emitState("ERROR");
      if (generation === token) onError(error?.message || "ADAPT could not answer. Check your connection and try again.");
    }
  };

  const setVoiceOutput = (enabled) => {
    voiceOutput = Boolean(enabled);
    if (!voiceOutput && currentUtterance) {
      cancelSpeech();
      handlingTurn = false;
      if (active && recognition) {
        playbackMonitorRecognition = null;
        interruptionPending = true;
        interruptionHasLearnerEvidence = true;
        emitState("LISTENING");
      } else if (active) listen(generation);
      else emitState("IDLE");
    }
  };

  const interruptAndListen = () => {
    if (!active || state !== "SPEAKING") return false;
    return confirmInterruption(generation, "manual");
  };

  const repeatLast = () => {
    if (!lastResponse || !voiceOutput || !synthesis || state === "THINKING") return false;
    const token = generation;
    const wasActive = active;
    handlingTurn = true;
    clearRestart();
    stopRecognition(true);
    cancelSpeech();
    void speak(lastResponse, token, true).then(() => { if (!wasActive && generation === token) { handlingTurn = false; emitState("IDLE"); } });
    return true;
  };

  const onVisibilityChange = () => {
    if (documentObject?.visibilityState === "hidden" && active) {
      fail("Voice conversation paused because this tab is in the background. Return to the page and press Start to continue.");
    }
  };
  const onOffline = () => { if (active) fail("Connection lost during the voice conversation. Reconnect, then press Start to try again."); };
  documentObject?.addEventListener?.("visibilitychange", onVisibilityChange);
  windowObject?.addEventListener?.("offline", onOffline);

  const dispose = () => {
    stop();
    disposed = true;
    documentObject?.removeEventListener?.("visibilitychange", onVisibilityChange);
    windowObject?.removeEventListener?.("offline", onOffline);
  };

  return { start, stop, dispose, submitText, setVoiceOutput, repeatLast, interruptAndListen, getState: () => state, isActive: () => active };
}
