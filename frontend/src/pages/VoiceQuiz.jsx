import React, { useRef, useState } from "react";
import { ArrowRight, CheckCircle2, Mic, Play } from "lucide-react";
import { Link } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import AIOrb from "../components/ui/AIOrb";
import { api } from "../services/api";

export default function VoiceQuiz() {
  const [transcript, setTranscript] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retryable, setRetryable] = useState(false);
  const requestInFlight = useRef(false);

  const analyze = async () => {
    const answer = transcript.trim();
    if (!answer || busy || requestInFlight.current) return;
    requestInFlight.current = true;
    setBusy(true);
    setError("");
    setRetryable(false);
    setResult(null);
    try {
      const response = await api.voiceQuizEvaluate({ transcript: answer });
      setResult(response);
    } catch (err) {
      setError(err.message || "ADAPT could not analyze this explanation.");
      setRetryable(Boolean(err.retryable));
    } finally {
      requestInFlight.current = false;
      setBusy(false);
    }
  };

  return <AppShell breadcrumb="VOICE QUIZ"><div className="page">
    <div className="eyebrow">VOICE QUIZ</div>
    <h1 className="page-title" style={{ marginTop: 8 }}>Explain it in your own words.</h1>
    <p className="page-subtitle">Explain the four necessary conditions for deadlock. Enter your transcript below, or use your device’s voice typing. ADAPT will assess the words you provide.</p>
    <section className="card card-pad glow" style={{ maxWidth: 900, margin: "28px auto 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}><AIOrb variant="voice" size="small" voiceState={busy ? "THINKING" : "IDLE"} /><div><div className="eyebrow">YOUR EXPLANATION</div><p className="mini" style={{ marginTop: 5 }}>Your transcript is sent to ADAPT for evaluation.</p></div></div>
      <label className="field-label" htmlFor="voice-quiz-transcript" style={{ marginTop: 20 }}>TRANSCRIPT</label>
      <textarea id="voice-quiz-transcript" className="learning-request" rows={5} maxLength={4000} value={transcript} onChange={(event) => setTranscript(event.target.value)} placeholder="Explain the concepts in your own words…" />
      {error && <div className="form-error" role="alert" style={{ marginTop: 12 }}>{error}</div>}
      <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={analyze} disabled={busy || !transcript.trim()}><Mic size={14} />{busy ? "Analyzing your explanation…" : retryable ? "Retry analysis" : "Analyze explanation"}</button>
    </section>
    {result && <div className="grid grid-2" style={{ marginTop: 16 }}>
      <section className="card card-pad"><div className="eyebrow">ANALYSIS</div><div style={{ fontFamily: "Space Grotesk", fontSize: 38, marginTop: 8 }}>{result.score} / {result.total}</div><div className="mini">concepts identified</div><div style={{ marginTop: 17 }}><div className="tiny">IDENTIFIED</div>{result.identifiedConcepts.map((concept) => <div key={concept} style={{ fontSize: 12, marginTop: 7, color: "var(--success)" }}><CheckCircle2 size={12} /> {concept.replaceAll("_", " ")}</div>)}<div className="tiny" style={{ marginTop: 15 }}>MISSING</div>{result.missingConcepts.map((concept) => <div key={concept} style={{ fontSize: 12, marginTop: 7, color: "var(--warning)" }}>· {concept.replaceAll("_", " ")}</div>)}</div></section>
      <section className="card card-pad"><div className="eyebrow">ADAPT RESPONSE</div><p style={{ fontSize: 14, lineHeight: 1.7, marginTop: 10 }}>{result.feedback}</p><Link className="btn btn-primary" style={{ marginTop: 18 }} to="/tutor">Teach Me <ArrowRight size={14} /></Link></section>
    </div>}
    <div style={{ display: "flex", justifyContent: "center", marginTop: 15 }}><Link className="btn" to="/voice"><Play size={13} /> Open Voice Tutor</Link></div>
  </div></AppShell>;
}
