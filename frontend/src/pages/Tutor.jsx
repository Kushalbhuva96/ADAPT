import React, { useEffect, useRef, useState } from "react";
import { Send, Sparkles, BookOpenCheck, Lightbulb, Image, TimerReset, Plus, Download, Trash2, Cpu, Cloud } from "lucide-react";
import { Link } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import { api } from "../services/api";
import { apiClient } from "../services/api/apiClient";
import { getDownloadedCourses } from "../services/offlineCourseStore";
import { readRuntimeValue, writeRuntimeValue } from "../services/runtimeCache";
import { generateLocalTutorReply, getLocalTutorRuntime, inspectWebGpu, isLocalTutorModelCached, loadLocalTutor, LOCAL_TUTOR_MODEL, removeLocalTutorModel } from "../services/localTutor";
import { getLocalTutorEngine, getTutorMode, setLocalTutorEngine, setTutorMode } from "../services/tutorMode";

const actions = [["Explain simply", Lightbulb], ["Give a real-world example", BookOpenCheck], ["Make a visual explanation", Image], ["Help me prepare an exam answer", BookOpenCheck], ["Quiz me", Sparkles], ["Give me a short revision", TimerReset]];

export default function Tutor() {
  const [context, setContext] = useState(null);
  const [messages, setMessages] = useState(() => readRuntimeValue(`learner:${apiClient.getUserId()}:tutor`) || []);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [failedRequest, setFailedRequest] = useState(null);
  const requestInFlight = useRef(false);
  const [localRuntime, setLocalRuntime] = useState(() => getLocalTutorRuntime());
  const [localMode, setLocalMode] = useState(() => getTutorMode() === "local" && Boolean(getLocalTutorEngine()));
  const [modelCached, setModelCached] = useState(false);
  const [modelCacheChecked, setModelCacheChecked] = useState(false);
  const [modelState, setModelState] = useState("LOADING");
  const [localCapability, setLocalCapability] = useState({ supported: null, reason: "Checking this device…" });
  const [modelBusy, setModelBusy] = useState(false);
  const [modelProgress, setModelProgress] = useState("");
  const [modelError, setModelError] = useState("");
  const [consentOpen, setConsentOpen] = useState(false);
  const cancelModelLoad = useRef(null);
  useEffect(() => {
    let active = true;
    api.dashboard().then((dashboard) => { if (active) setContext(dashboard); }).catch(async (err) => {
      const learnerId = apiClient.getUserId();
      let downloads = [];
      try { downloads = await getDownloadedCourses(learnerId); } catch { /* Keep Server AI available if local course storage is unavailable. */ }
      if (!active) return;
      const preferredId = localStorage.getItem("adapt_active_course_id");
      const selected = downloads.find((record) => record.courseId === preferredId) || downloads[0];
      if (selected) setContext({ course: selected.course });
      else setError(err.message);
    });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    let active = true;
    const restoreModel = async () => {
      try {
        const cached = await isLocalTutorModelCached();
        if (!active) return;
        setModelCached(cached);
        setModelCacheChecked(true);
        setModelState(cached ? "DOWNLOADED" : "NOT_DOWNLOADED");
        if (!cached) {
          if (getTutorMode() === "local" && !getLocalTutorEngine()) setTutorMode("hosted");
          return;
        }
        if (getTutorMode() !== "local") return;

        setModelState("LOADING");
        setModelBusy(true);
        setModelProgress("Restoring Local AI from this device’s saved model…");
        const runtime = await loadLocalTutor({
          modelCached: true,
          onProgress: (report) => {
            if (active) setModelProgress(`${report?.text || "Loading the local model…"}${Number.isFinite(report?.progress) ? ` (${Math.round(report.progress * 100)}%)` : ""}`);
          },
        });
        if (!active) return;
        setLocalRuntime(runtime);
        setLocalTutorEngine(runtime.engine);
        setLocalMode(true);
        setModelState("READY");
        setModelProgress("");
      } catch (err) {
        if (!active) return;
        setModelState("ERROR");
        setModelError(err.message || "The saved model could not be loaded.");
        setModelProgress("");
      } finally {
        if (active) setModelBusy(false);
      }
    };
    void restoreModel();
    return () => { active = false; };
  }, []);
  useEffect(() => { const learnerId = apiClient.getUserId(); if (learnerId) writeRuntimeValue(`learner:${learnerId}:tutor`, messages.slice(-20)); }, [messages]);
  useEffect(() => {
    let active = true;
    setLocalCapability({ supported: null, reason: "Checking this device…" });
    inspectWebGpu().then((result) => {
      if (active) setLocalCapability({ supported: result.supported, reason: result.reason || "" });
    }).catch((err) => {
      if (active) setLocalCapability({ supported: false, reason: err.message || "WebGPU could not be initialized." });
    });
    return () => { active = false; };
  }, []);

  const course = context?.course;
  const topic = course?.topics?.find((item) => item.id === (course.activeTopicId || course.recommendedTopicId));
  const sendMessage = async (message, history) => {
    if (!message || requestInFlight.current) return;
    requestInFlight.current = true;
    setError("");
    setFailedRequest(null);
    setBusy(true);
    try {
      const response = localMode
        ? await generateLocalTutorReply(localRuntime?.engine, { message, history, course, topic })
        : await api.tutorMessage({ message, mode: "explain", topicId: topic?.id, topicName: topic?.name, courseName: course?.title, history });
      setMessages((current) => [...current, { role: "user", content: message }, response]);
      setInput((current) => current.trim() === message ? "" : current);
    } catch (err) {
      setFailedRequest({ message, history, retryable: !localMode && Boolean(err.retryable) });
      setError(err.message || "ADAPT could not answer. Please retry.");
    } finally {
      requestInFlight.current = false;
      setBusy(false);
    }
  };
  const beginLocalSetup = async () => {
    setModelError("");
    if (modelCacheChecked) {
      if (modelCached) void startLocalTutor();
      else setConsentOpen(true);
      return;
    }
    setModelBusy(true);
    setModelState("LOADING");
    setModelProgress("Checking for a previously downloaded model…");
    try {
      const cached = await isLocalTutorModelCached();
      setModelCached(cached);
      setModelCacheChecked(true);
      setModelState(cached ? "DOWNLOADED" : "NOT_DOWNLOADED");
      setModelProgress("");
      if (cached) await startLocalTutor(true);
      else setConsentOpen(true);
    } catch (err) {
      setModelState("ERROR");
      setModelError(err.message || "The saved model could not be checked.");
      setModelProgress("");
    } finally {
      setModelBusy(false);
    }
  };
  const startLocalTutor = async (cachedModel = modelCached) => {
    setConsentOpen(false);
    setModelBusy(true);
    setModelState(cachedModel ? "LOADING" : "DOWNLOADING");
    setModelError("");
    setModelProgress(modelCached ? "Loading the saved model on this device…" : "Preparing the on-device model…");
    try {
      const existingEngine = getLocalTutorEngine();
      if (existingEngine) {
        setLocalRuntime(getLocalTutorRuntime() || { engine: existingEngine });
        setLocalMode(true);
        setTutorMode("local");
        setModelState("READY");
        setModelProgress("");
        return;
      }
      const runtime = await loadLocalTutor({
        modelCached: cachedModel,
        onProgress: (report) => setModelProgress(`${report?.text || "Loading the local model…"}${Number.isFinite(report?.progress) ? ` (${Math.round(report.progress * 100)}%)` : ""}`),
        onCancelReady: (cancel) => { cancelModelLoad.current = cancel; },
      });
      cancelModelLoad.current = null;
      setLocalRuntime(runtime);
      setLocalTutorEngine(runtime.engine);
      setModelCached(true);
      setModelCacheChecked(true);
      setLocalMode(true);
      setTutorMode("local");
      setModelState("READY");
      setModelProgress("");
    } catch (err) {
      cancelModelLoad.current = null;
      if (err.message === "Local model download cancelled.") {
        setModelState(cachedModel ? "DOWNLOADED" : "NOT_DOWNLOADED");
        setModelProgress("");
        setModelError("Model download cancelled. No local reply was generated.");
      } else {
        setModelState("ERROR");
        setModelError(String(err?.message || err || "The local model could not be loaded on this device."));
        setModelProgress("");
      }
    } finally {
      setModelBusy(false);
    }
  };
  const cancelLocalSetup = () => cancelModelLoad.current?.();
  const removeLocalModel = async () => {
    setModelBusy(true);
    setModelError("");
    try {
      await removeLocalTutorModel(localRuntime);
      setLocalRuntime(null);
      setLocalTutorEngine(null);
      setLocalMode(false);
      setTutorMode("hosted");
      setModelCached(false);
      setModelCacheChecked(true);
      setModelState("NOT_DOWNLOADED");
      setModelProgress("");
    } catch (err) {
      setModelState("ERROR");
      setModelError(err.message || "The saved model could not be removed.");
    } finally {
      setModelBusy(false);
    }
  };
  const send = () => {
    const message = input.trim();
    if (!message || busy) return;
    const history = messages.slice(-8).map(({ role, content }) => ({ role, content: content.slice(0, 1200) }));
    void sendMessage(message, history);
  };
  const retryFailedRequest = () => {
    if (!failedRequest?.retryable || busy) return;
    void sendMessage(failedRequest.message, failedRequest.history);
  };
  const buildCourse = () => {
    const request = input.trim() || [...messages].reverse().find((message) => message.role === "user")?.content;
    if (request) sessionStorage.setItem("adapt_course_request", request);
  };

  return <AppShell breadcrumb="TUTOR"><div className="page">
    <div className="eyebrow">AI TEACHING WORKSPACE</div><h1 className="page-title" style={{ marginTop: 8 }}>ADAPT Tutor</h1><p className="page-subtitle">Ask a question with or without a course. ADAPT can help independently.</p>
    <div className="chips" style={{ marginTop: 15 }}><span className="chip">{course?.title || "INDEPENDENT TUTOR"}</span>{topic && <span className="chip">{topic.name.toUpperCase()}</span>}{context?.assessment?.level && <span className="chip">{context.assessment.level.toUpperCase()} LEVEL</span>}</div>
    {error && <div className="form-error" role="alert" style={{ marginTop: 15 }}>{error}{failedRequest?.retryable && <button type="button" className="btn" style={{ marginLeft: 10 }} onClick={retryFailedRequest} disabled={busy}>Retry last message</button>}</div>}
    <div className="tutor-layout" style={{ marginTop: 18 }}>
      <section className="card card-pad">
        <div className="teaching-block" data-model-state={modelState} style={{ marginBottom: 18, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div className="eyebrow">TUTOR MODE</div>
              <div style={{ display: "flex", gap: 7, marginTop: 8, flexWrap: "wrap" }}>
                <span className="chip">{localMode ? <><Cpu size={12} /> LOCAL AI · ON THIS DEVICE</> : <><Cloud size={12} /> SERVER AI · ONLINE</>}</span>
                {localMode && <span className="mini">Prompts stay on this device.</span>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {!localMode && <button type="button" className="btn" onClick={beginLocalSetup} disabled={modelBusy || localCapability.supported === false} title={localCapability.reason}>
                <Cpu size={13} /> {modelCached ? "Load Local AI" : "Set up Local AI"}
              </button>}
              {localMode && <button type="button" className="btn" onClick={() => { setLocalMode(false); setTutorMode("hosted"); }}><Cloud size={13} /> Switch to Server AI</button>}
              {modelCached && <button type="button" className="btn" onClick={removeLocalModel} disabled={modelBusy || busy}><Trash2 size={13} /> Remove model</button>}
            </div>
          </div>
          {localCapability.supported === false && <p className="mini" style={{ marginTop: 8 }}>{localCapability.reason} Server AI remains available when online.</p>}
          {localCapability.supported === true && <p className="mini" style={{ marginTop: 8 }}>Optional {LOCAL_TUTOR_MODEL.name}; first download is about 207 MB. Apache-2.0. Local answers can use downloaded topic summaries, objectives, and subtopics; full lesson bodies are not stored offline. Browser storage may be cleared by device settings.</p>}
          {modelBusy && <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}><span className="mini" role="status">{modelProgress || "Loading Local AI…"}</span><button type="button" className="btn" onClick={cancelLocalSetup}>Cancel</button></div>}
          {modelError && <div className="form-error" role="alert" style={{ marginTop: 9 }}>{modelError}{!modelCached && <button type="button" className="btn" style={{ marginLeft: 8 }} onClick={beginLocalSetup}>Retry setup</button>}</div>}
        </div>
        {consentOpen && <div role="dialog" aria-modal="true" aria-labelledby="local-model-consent-title" className="card card-pad" style={{ marginBottom: 18, border: "1px solid var(--border)" }}>
          <div className="eyebrow">OPTIONAL ON-DEVICE MODEL</div>
          <h3 id="local-model-consent-title" style={{ marginTop: 8, fontSize: 16 }}>Download {LOCAL_TUTOR_MODEL.name}?</h3>
          <p className="mini" style={{ marginTop: 8, lineHeight: 1.6 }}>This downloads about 207 MB from Hugging Face and uses around 300 MB of browser storage including runtime headroom. Inference requires WebGPU with shader-f16 and roughly 376 MB of GPU memory plus browser overhead. Prompts sent to Local AI stay on this device. Browser storage can be cleared by your browser or device.</p>
          <p className="mini" style={{ marginTop: 6 }}>The model is Apache-2.0. Its small size means answers can be less accurate than Server AI.</p>
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}><button type="button" className="btn btn-primary" onClick={() => void startLocalTutor()}><Download size={13} /> Download 207 MB and use Local AI</button><button type="button" className="btn" onClick={() => setConsentOpen(false)}>Cancel</button></div>
        </div>}
        <div className="quick-actions">{actions.map(([label, Icon]) => <button className="btn" key={label} onClick={() => setInput(`${label}: ${topic?.name || ""}`.trim())}><Icon size={13} />{label}</button>)}</div>
        <div style={{ marginTop: 24, display: "grid", gap: 12, minHeight: 100 }}>
          {!messages.length && <div className="mini">Ask ADAPT anything you're trying to understand. Your first question can be about any subject.</div>}
          {messages.map((message, index) => <div key={`${message.role}-${index}`} className={message.role === "assistant" ? "teaching-block" : ""} style={message.role === "user" ? { padding: "14px 16px", background: "rgba(124,60,255,.08)", border: "1px solid var(--border)", borderRadius: 15, marginLeft: "14%" } : {}}><div className="eyebrow" style={{ marginBottom: 6 }}>{message.role === "assistant" ? (message.provider === "local" ? "LOCAL AI · ON THIS DEVICE" : "ADAPT · SERVER AI") : "YOU"}</div><div style={{ fontSize: 13, lineHeight: 1.7 }}>{message.content}</div></div>)}
          {busy && <div className="mini" role="status">{localMode ? "Local AI is preparing an explanation on this device…" : "ADAPT is preparing an explanation…"}</div>}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 20 }}><input value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => event.key === "Enter" && send()} placeholder="Ask ADAPT a question…" style={{ flex: 1, background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px", color: "var(--text)", outline: "none" }} /><button className="btn btn-primary" onClick={send} disabled={busy || !input.trim()}><Send size={14} /></button></div>
        <Link className="btn" style={{ marginTop: 12 }} to="/onboarding" onClick={buildCourse}><Plus size={13} /> Build a course from this</Link>
      </section>
      <aside className="card card-pad"><div className="eyebrow">LEARNER CONTEXT</div><h3 style={{ marginTop: 7, fontSize: 16 }}>{course ? course.title : "No course selected"}</h3>{course ? <><div className="mini" style={{ marginTop: 10 }}>Current topic: {topic?.name || "Not selected"}</div><div className="mini" style={{ marginTop: 6 }}>Assessment: {context.assessment ? `${context.assessment.level}, ${context.assessment.accuracy}%` : "Not completed"}</div><div style={{ marginTop: 14 }}><Link className="btn" to="/course">Open Course</Link></div></> : <p className="mini" style={{ lineHeight: 1.6, marginTop: 9 }}>Tutor is available without creating a course. If you want a structured learning path, choose “Build a course from this.”</p>}</aside>
    </div>
  </div></AppShell>;
}
