import React, { useRef, useState } from "react";
import { Mic, Square, RotateCcw, Pencil, MessageCircle } from "lucide-react";
import AppShell from "../components/layout/AppShell";
import AIOrb from "../components/ui/AIOrb";
import { api } from "../services/api";

export default function VoiceTutor() {
  const [state, setState] = useState("IDLE");
  const [transcript, setTranscript] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retryable, setRetryable] = useState(false);
  const requestInFlight = useRef(false);

  const start = async () => {
    setError("");
    setRetryable(false);
    try {
      await api.voiceStart({ topicId: "deadlocks" });
      setState("LISTENING");
    } catch (err) {
      setError(err.message || "ADAPT could not start voice mode. Please retry.");
      setRetryable(Boolean(err.retryable));
    }
  };

  const simulate = async () => {
    if (busy || requestInFlight.current) return;
    requestInFlight.current = true;
    setBusy(true);
    setError("");
    setRetryable(false);
    setState("THINKING");
    try {
      const response = await api.voiceMessage({ text: "I don't understand deadlock.", topicId: "deadlocks" });
      setTranscript(response.session.transcript);
      setState("SPEAKING");
    } catch (err) {
      setState("ERROR");
      setError(err.message || "ADAPT could not prepare a voice response. Please retry.");
      setRetryable(Boolean(err.retryable));
    } finally {
      requestInFlight.current = false;
      setBusy(false);
    }
  };

  return <AppShell breadcrumb="VOICE AI"><div className="voice-page">
    <div className="eyebrow">VOICE INTELLIGENCE</div><h1 className="page-title" style={{ marginTop: 8 }}>Talk to ADAPT</h1><p className="page-subtitle">Ask. Interrupt. Explore. Learn.</p>
    <div className="chips" style={{ marginTop: 8 }}><span className="chip">DEADLOCKS</span><span className="chip">EXAMPLE-FIRST</span><span className="chip">MEDIUM</span></div>
    <AIOrb variant="voice" voiceState={state} />
    <div className="eyebrow" style={{ marginTop: 25, color: state === "LISTENING" ? "var(--cyan)" : "var(--bright)" }}>{state}</div>
    <div className="mini" style={{ marginTop: 7 }}>{state === "IDLE" ? "Press the microphone to start." : state === "LISTENING" ? "Go ahead, I'm with you." : state === "THINKING" ? "ADAPT is using your learning profile..." : state === "ERROR" ? "Your voice message was not saved. Retry to ask it again." : "Go ahead, I'm with you."}</div>
    {error && <div className="form-error" role="alert" style={{ marginTop: 10 }}>{error}{retryable && <button type="button" className="btn" style={{ marginLeft: 10 }} onClick={simulate} disabled={busy}>Retry voice response</button>}</div>}
    <div className="waveform">{Array.from({ length: 38 }).map((_, i) => <span key={i} />)}</div>
    <div className="voice-controls" style={{ marginTop: 12 }}><button className="voice-control" onClick={start} disabled={busy}><Mic size={16} /></button><button className="voice-control active" onClick={simulate} disabled={busy}><Square size={14} /></button><button className="voice-control" onClick={() => setState("IDLE")} disabled={busy}><RotateCcw size={16} /></button><button className="voice-control" disabled={busy}><Pencil size={16} /></button></div>
    <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={simulate} disabled={busy}><MessageCircle size={14} /> Simulate learner question</button>
    <div className="transcript card card-pad"><div className="tiny">LIVE TRANSCRIPT</div>{transcript.length === 0 ? <div className="mini" style={{ marginTop: 12 }}>Your conversation will appear here.</div> : <div style={{ marginTop: 15, display: "grid", gap: 12, fontSize: 10 }}>{transcript.map((m, i) => <div key={`${m.role}-${m.timestamp || i}`}><span className="eyebrow" style={{ fontSize: 8 }}>{m.role.toUpperCase()}</span><span style={{ marginLeft: 14 }}>{m.text}</span></div>)}</div>}</div>
  </div></AppShell>;
}
