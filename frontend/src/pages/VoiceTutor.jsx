import React, { useEffect, useRef, useState } from "react";
import { Cloud, Cpu, Ear, Mic, RotateCcw, Send, Square, Volume2, VolumeX } from "lucide-react";
import AppShell from "../components/layout/AppShell";
import AIOrb from "../components/ui/AIOrb";
import { api } from "../services/api";
import { apiClient } from "../services/api/apiClient";
import { getDownloadedCourses } from "../services/offlineCourseStore";
import { readRuntimeValue, writeRuntimeValue } from "../services/runtimeCache";
import { generateLocalTutorReply } from "../services/localTutor";
import { getLocalTutorEngine, getTutorMode, subscribeTutorMode } from "../services/tutorMode";
import { createVoiceSessionController } from "../services/voiceSessionController";
import { requestVoiceTutorReply } from "../services/voiceTutorService";
import { readSpeechVoicePreference, resolveSpeechVoice, speechVoiceId, writeSpeechVoicePreference } from "../services/speechVoicePreference";

const stateCopy = {
  IDLE: ["Ready", "Start a conversation when you are ready."],
  CONNECTING: ["Connecting microphone", "Allow microphone access if your browser asks."],
  LISTENING: ["Listening", "Speak naturally. ADAPT will respond and listen again."],
  THINKING: ["Thinking", "Your selected tutor is preparing a response."],
  SPEAKING: ["Speaking", "ADAPT is reading its response aloud."],
  ERROR: ["Needs attention", "Review the message below, then try again."],
};

const isInstalledIOSPwa = () => {
  const browserNavigator = globalThis.navigator;
  const userAgent = browserNavigator?.userAgent || "";
  const isIOS = /iPhone|iPad|iPod/i.test(userAgent)
    || (browserNavigator?.platform === "MacIntel" && (browserNavigator?.maxTouchPoints || 0) > 1);
  const standalone = browserNavigator?.standalone === true
    || globalThis.window?.matchMedia?.("(display-mode: standalone)")?.matches === true;
  return isIOS && standalone;
};

export default function VoiceTutor() {
  const learnerId = apiClient.getUserId();
  const [messages, setMessages] = useState(() => readRuntimeValue(`learner:${learnerId}:tutor`) || []);
  const [state, setState] = useState("IDLE");
  const [partial, setPartial] = useState("");
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [voiceOutput, setVoiceOutputState] = useState(true);
  const [mode, setMode] = useState(() => getTutorMode());
  const [online, setOnline] = useState(() => globalThis.navigator?.onLine !== false);
  const [meterAvailable, setMeterAvailable] = useState(false);
  const [availableSpeechVoices, setAvailableSpeechVoices] = useState([]);
  const [preferredSpeechVoice, setPreferredSpeechVoice] = useState(() => readSpeechVoicePreference());
  const [context, setContext] = useState(null);
  const messagesRef = useRef(messages);
  const activeLearnerRef = useRef(learnerId);
  const modeRef = useRef(mode);
  const orbRef = useRef(null);
  const meterAvailableRef = useRef(false);
  const callbacks = useRef({});
  const controllerRef = useRef(null);
  const preferredSpeechVoiceRef = useRef(preferredSpeechVoice);
  const busyRef = useRef(false);
  const requestSequenceRef = useRef(0);
  const [lastAssistant, setLastAssistant] = useState(() => [...messages].reverse().find((item) => item.role === "assistant")?.content || "");

  preferredSpeechVoiceRef.current = preferredSpeechVoice;

  const primeSpeechOutput = () => {
    const synthesis = globalThis.speechSynthesis;
    if (!synthesis || typeof SpeechSynthesisUtterance === "undefined") return;
    try {
      synthesis.resume?.();
      const primingUtterance = new SpeechSynthesisUtterance("ADAPT voice ready.");
      primingUtterance.volume = 0;
      synthesis.speak(primingUtterance);
    } catch { /* Regular playback below will show a visible error if this browser cannot speak. */ }
  };

  const addMessage = (message) => {
    const next = [...messagesRef.current, message].slice(-40);
    messagesRef.current = next;
    setMessages(next);
    const currentLearner = apiClient.getUserId();
    if (currentLearner) writeRuntimeValue(`learner:${currentLearner}:tutor`, next.slice(-20));
  };

  callbacks.current = {
    onState: (nextState) => {
      setState(nextState);
      if (nextState === "IDLE" || nextState === "ERROR") {
        requestSequenceRef.current += 1;
        busyRef.current = false;
        setBusy(false);
      }
    },
    onPartial: setPartial,
    onError: setError,
    onAudioLevel: (level) => {
      const activeOrb = orbRef.current;
      if (activeOrb) {
        activeOrb.style.setProperty("--voice-level", String(level ?? 0));
        activeOrb.style.setProperty("--voice-scale", String(level === null ? 1 : 1 + level * 0.14));
      }
      const available = level !== null;
      if (meterAvailableRef.current !== available) {
        meterAvailableRef.current = available;
        setMeterAvailable(available);
      }
    },
    onUtterance: async (text, isCurrent) => {
      if (!isCurrent()) return "";
      if (busyRef.current) throw new Error("ADAPT is still preparing the previous answer. Please wait a moment.");
      const requestSequence = ++requestSequenceRef.current;
      const requestLearnerId = apiClient.getUserId();
      busyRef.current = true;
      setBusy(true);
      setError("");
      addMessage({ role: "user", content: text, voice: true });
      const history = messagesRef.current.slice(0, -1).slice(-8).map(({ role, content }) => ({ role, content: String(content || "").slice(0, 1200) }));
      const selectedMode = modeRef.current;
      try {
        const course = context?.course;
        const topic = course?.topics?.find((item) => item.id === (course.activeTopicId || course.recommendedTopicId));
        const response = await requestVoiceTutorReply({ mode: selectedMode, engine: getLocalTutorEngine(), message: text, history, course, topic }, { hostedRequest: api.tutorMessage, localReply: generateLocalTutorReply });
        if (apiClient.getUserId() !== requestLearnerId || activeLearnerRef.current !== requestLearnerId) {
          controllerRef.current?.stop();
          return "";
        }
        const answer = String(response?.content || "").trim();
        if (!answer) throw new Error("The selected tutor returned an empty response. Please try again.");
        if (isCurrent()) {
          const assistant = { role: "assistant", content: answer, provider: selectedMode === "local" ? "local" : "hosted" };
          addMessage(assistant);
          setLastAssistant(answer);
        }
        return answer;
      } finally {
        if (requestSequence === requestSequenceRef.current) {
          busyRef.current = false;
          setBusy(false);
        }
      }
    },
  };

  useEffect(() => {
    const synthesis = globalThis.speechSynthesis;
    if (!synthesis?.getVoices) return undefined;
    const refreshVoices = () => setAvailableSpeechVoices(synthesis.getVoices());
    refreshVoices();
    synthesis.addEventListener?.("voiceschanged", refreshVoices);
    return () => synthesis.removeEventListener?.("voiceschanged", refreshVoices);
  }, []);

  useEffect(() => {
    controllerRef.current = createVoiceSessionController({
      onState: (...args) => callbacks.current.onState(...args),
      onPartial: (...args) => callbacks.current.onPartial(...args),
      onAudioLevel: (...args) => callbacks.current.onAudioLevel(...args),
      onError: (...args) => callbacks.current.onError(...args),
      onUtterance: (...args) => callbacks.current.onUtterance(...args),
      iosPwa: isInstalledIOSPwa(),
      utteranceFactory: (text) => {
        const utterance = new SpeechSynthesisUtterance(text);
        const voices = globalThis.speechSynthesis?.getVoices?.() || availableSpeechVoices;
        const voice = resolveSpeechVoice(voices, preferredSpeechVoiceRef.current);
        if (voice) {
          utterance.voice = voice;
          utterance.lang = voice.lang || globalThis.navigator?.language || "en-US";
        } else {
          utterance.lang = globalThis.navigator?.language || "en-US";
        }
        return utterance;
      },
      diagnostics: import.meta.env.DEV,
    });
    return () => {
      controllerRef.current?.dispose();
      controllerRef.current = null;
    };
  }, []);

  useEffect(() => subscribeTutorMode((nextMode) => {
    const previousMode = modeRef.current;
    if (previousMode === nextMode) return;
    modeRef.current = nextMode;
    setMode(nextMode);
    if (controllerRef.current?.isActive()) {
      controllerRef.current.stop();
      setError(`Tutor mode changed to ${nextMode === "local" ? "Local AI" : "Server AI"}. The voice session stopped; press Start to continue in the newly selected mode.`);
    }
  }), []);
  useEffect(() => {
    const updateNetwork = () => setOnline(globalThis.navigator?.onLine !== false);
    globalThis.window?.addEventListener("online", updateNetwork);
    globalThis.window?.addEventListener("offline", updateNetwork);
    return () => {
      globalThis.window?.removeEventListener("online", updateNetwork);
      globalThis.window?.removeEventListener("offline", updateNetwork);
    };
  }, []);
  useEffect(() => {
    if (activeLearnerRef.current === learnerId) return;
    activeLearnerRef.current = learnerId;
    controllerRef.current?.stop();
    const nextMessages = readRuntimeValue(`learner:${learnerId}:tutor`) || [];
    messagesRef.current = nextMessages;
    setMessages(nextMessages);
    setLastAssistant([...nextMessages].reverse().find((item) => item.role === "assistant")?.content || "");
    setError("");
  }, [learnerId]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => {
    let current = true;
    api.dashboard().then((result) => { if (current) setContext(result); }).catch(async () => {
      let downloads = [];
      try { downloads = await getDownloadedCourses(apiClient.getUserId()); } catch { /* Course context is optional for general tutoring. */ }
      if (!current) return;
      const preferredId = localStorage.getItem("adapt_active_course_id");
      const selected = downloads.find((record) => record.courseId === preferredId) || downloads[0];
      if (selected) setContext({ course: selected.course });
    });
    return () => { current = false; };
  }, []);

  const course = context?.course;
  const topic = course?.topics?.find((item) => item.id === (course.activeTopicId || course.recommendedTopicId));
  const [stateTitle, stateHint] = stateCopy[state] || stateCopy.IDLE;
  const modeLabel = mode === "local" ? "Local AI · on this device" : "Hosted AI · server";

  const start = () => {
    setError("");
    if (modeRef.current === "local" && !getLocalTutorEngine()) {
      setState("ERROR");
      setError("Local AI is selected, but its on-device model is not loaded. Open Tutor to load the model, or switch back to Server AI.");
      return;
    }
    if (modeRef.current === "hosted" && !online) {
      setState("ERROR");
      setError("Server AI needs an internet connection. Reconnect, or select Local AI in Tutor if its model is loaded.");
      return;
    }
    // Some installed WebKit PWAs require the first speech call to occur in a tap handler.
    if (voiceOutput) primeSpeechOutput();
    controllerRef.current?.start();
  };
  const stop = () => controllerRef.current?.stop();
  const setVoiceOutput = () => {
    const next = !voiceOutput;
    setVoiceOutputState(next);
    if (next) primeSpeechOutput();
    controllerRef.current?.setVoiceOutput(next);
  };
  const changeSpeechVoice = (event) => {
    const id = event.target.value;
    setPreferredSpeechVoice(id);
    preferredSpeechVoiceRef.current = id;
    writeSpeechVoicePreference(id);
  };
  const sendText = (event) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || busyRef.current) return;
    setInput("");
    setError("");
    controllerRef.current?.submitText(text);
  };

  return <AppShell breadcrumb="VOICE AI"><main className="continuous-voice-page">
    <header className="continuous-voice-header">
      <div><div className="eyebrow">VOICE INTELLIGENCE</div><h1 className="page-title" style={{ marginTop: 8 }}>Voice Tutor</h1><p className="page-subtitle">A hands-free conversation with your selected ADAPT tutor.</p></div>
      <div className="voice-context"><span className="chip">{mode === "local" ? <Cpu size={12} /> : <Cloud size={12} />}{modeLabel}</span><span className={`chip voice-network ${online ? "is-online" : "is-offline"}`}>{online ? "Online" : "Offline"}</span><span className="chip">{course?.title || "General tutoring"}{topic ? ` · ${topic.name}` : ""}</span></div>
    </header>
    <section className={`voice-stage voice-stage-${state.toLowerCase()}`} aria-label="Voice conversation controls">
      <AIOrb variant="voice" voiceState={state} orbRef={orbRef} />
      <div className={`voice-state-label voice-state-${state.toLowerCase()}`} role="status" aria-live="polite">{stateTitle}</div>
      <p className="voice-state-hint">{stateHint}</p>
      {state === "LISTENING" && meterAvailable && <span className="voice-meter-note">Live microphone level is processed on this device</span>}
      {state === "SPEAKING" && <span className="voice-meter-note">Use Stop speaking &amp; listen to interrupt</span>}
      {partial && <div className="voice-live-partial" aria-live="polite"><span>HEARING</span> “{partial}”</div>}
      {error && <div className="form-error voice-error" role="alert">{error}</div>}
      <label className="voice-output-select">Spoken voice
        <select value={preferredSpeechVoice} onChange={changeSpeechVoice} aria-label="Select spoken voice">
          <option value="">Browser default</option>
          {availableSpeechVoices.map((voice) => <option key={speechVoiceId(voice)} value={speechVoiceId(voice)}>{voice.name} ({voice.lang})</option>)}
        </select>
      </label>
      {preferredSpeechVoice && !resolveSpeechVoice(availableSpeechVoices, preferredSpeechVoice) && <p className="voice-privacy-note">The saved voice is unavailable here. Browser default is being used. Choose the same voice on desktop and this device when it appears in both lists.</p>}
      <div className="voice-action-row">
        {state === "IDLE" || state === "ERROR" ? <button type="button" className="btn btn-primary" onClick={start}><Mic size={15} /> Start conversation</button> : <button type="button" className="btn btn-danger" onClick={stop}><Square size={14} /> Stop conversation</button>}
        {state === "SPEAKING" && controllerRef.current?.isActive() && <button type="button" className="btn voice-interrupt" onClick={() => controllerRef.current?.interruptAndListen()}><Ear size={15} /> Stop speaking &amp; listen</button>}
        <button type="button" className={`btn ${voiceOutput ? "" : "voice-muted"}`} onClick={setVoiceOutput} aria-pressed={voiceOutput} title={voiceOutput ? "Mute spoken responses" : "Enable spoken responses"}>{voiceOutput ? <Volume2 size={15} /> : <VolumeX size={15} />}{voiceOutput ? "Voice on" : "Voice off"}</button>
        <button type="button" className="btn" onClick={() => controllerRef.current?.repeatLast()} disabled={!lastAssistant || !voiceOutput || state === "THINKING"} title="Repeat the latest tutor response"><RotateCcw size={14} /> Repeat</button>
      </div>
      <p className="voice-privacy-note">Your microphone is requested only after Start. Audio level is analyzed locally and not recorded. Press Stop speaking &amp; listen before asking a question during playback. Browser speech recognition may process audio under your browser provider’s policies.</p>
    </section>
    <section className="voice-conversation card card-pad" aria-label="Conversation history">
      <div className="voice-conversation-heading"><div><div className="eyebrow">CONVERSATION</div><p className="mini">Your turns stay visible while you learn.</p></div><span className="voice-mode-indicator">{modeLabel}</span></div>
      <div className="voice-message-list" aria-live="polite">
        {!messages.length && <div className="voice-empty-state">Ask a question out loud, or type below to begin.</div>}
        {messages.slice(-16).map((message, index) => <article key={`${message.role}-${index}`} className={`voice-message voice-message-${message.role}`}>
          <div className="eyebrow">{message.role === "assistant" ? (message.provider === "local" ? "LOCAL AI · ON THIS DEVICE" : "SERVER AI") : "YOU"}</div><p>{message.content}</p>
        </article>)}
      </div>
      <form className="voice-text-form" onSubmit={sendText}><label className="sr-only" htmlFor="voice-tutor-text">Ask ADAPT by typing</label><input id="voice-tutor-text" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Speech unavailable? Type a question…" /><button type="submit" className="btn btn-primary" disabled={!input.trim() || busy}><Send size={14} /> Send</button></form>
    </section>
  </main></AppShell>;
}
