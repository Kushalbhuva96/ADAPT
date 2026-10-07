import React, { useEffect, useState } from "react";
import { ArrowRight, Check, ChevronDown, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import { api } from "../services/api";

export default function Practice() {
  const [question, setQuestion] = useState(null);
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const [why, setWhy] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sequence, setSequence] = useState(1);

  const loadQuestion = async () => {
    setLoading(true); setError(""); setSelected(null); setResult(null);
    try { setQuestion(await api.nextPractice()); }
    catch (err) { setQuestion(null); setError(err.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { loadQuestion(); }, []);

  const submit = async () => {
    if (!selected || !question || busy) return;
    setBusy(true); setError("");
    try { setResult(await api.answerPractice({ questionId: question.id, selectedOptionId: selected, timeTakenSeconds: 18 })); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const next = async () => { setSequence((value) => value + 1); await loadQuestion(); };

  return <AppShell breadcrumb="CHALLENGE ME"><div className="page">
    <div className="eyebrow">ADAPTIVE CHALLENGE</div><h1 className="page-title" style={{ marginTop: 8 }}>Challenge Me</h1><p className="page-subtitle">Let's work on what ADAPT has identified from your course and learning history.</p>
    {error && !question && !loading && <div className="card card-pad glow" style={{ marginTop: 20 }}><h2 style={{ fontSize: 20 }}>{error}</h2><p className="mini" style={{ marginTop: 7 }}>Create a course and complete its level assessment to give ADAPT learner context for a targeted challenge.</p><Link className="btn btn-primary" style={{ marginTop: 14 }} to="/course">Open Course <ArrowRight size={14} /></Link></div>}
    {error && question && <div className="form-error" role="alert" style={{ marginTop: 16 }}>{error}</div>}
    {loading && <div className="card card-pad" style={{ marginTop: 20 }}><div className="eyebrow">ADAPT IS THINKING…</div><p className="mini" style={{ marginTop: 8 }}>Selecting a question from your current course and saved learner signals.</p></div>}
    {question && <>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 15, alignItems: "end", marginTop: 20 }}><div><div className="eyebrow">{question.topicName} · {question.difficulty.toUpperCase()}</div><h2 className="page-title" style={{ fontSize: 30, marginTop: 8 }}>{question.title || `${question.topicName} Challenge`}</h2><p className="page-subtitle">{question.adaptiveContext?.reason}</p></div><span className="badge">CHALLENGE {String(sequence).padStart(2, "0")}</span></div>
      <div className="lab-grid" style={{ marginTop: 22 }}><section className="card card-pad hero-panel">
        <h3 style={{ fontSize: 23, lineHeight: 1.35 }}>{question.question}</h3><p className="mini" style={{ marginTop: 8 }}>Choose the answer that best completes the concept.</p>
        <div className="question-options" style={{ marginTop: 20 }}>{question.options.map((option) => <button key={option.id} className={`option ${selected === option.id ? "selected" : ""}`} onClick={() => !result && setSelected(option.id)} disabled={Boolean(result)}><span className="option-key">{option.id.toUpperCase()}</span><span>{option.text}</span>{selected === option.id && <Check size={15} style={{ marginLeft: "auto", color: "var(--lavender)" }} />}</button>)}</div>
        {!result ? <button className="btn btn-primary" style={{ marginTop: 18, float: "right" }} disabled={!selected || busy} onClick={submit}>{busy ? "Checking…" : "Submit Answer"} <ArrowRight size={14} /></button> : <div className="card card-pad" style={{ marginTop: 20, background: "rgba(13,6,24,.35)" }}>
          <div className="eyebrow" style={{ color: result.attempt.correct ? "var(--success)" : "var(--warning)" }}>{result.attempt.correct ? "CORRECT" : "INCORRECT"}</div><h3 style={{ fontSize: 19, marginTop: 8 }}>{result.feedback.whatAdaptLearned}</h3><p className="mini" style={{ lineHeight: 1.7, marginTop: 7 }}>{result.feedback.explanation}</p>
          <div className="insight" style={{ marginTop: 12 }}><Sparkles size={14} /><div><div className="eyebrow">ADAPT DECISION</div><div className="mini" style={{ marginTop: 4 }}>{result.adaptation.reason} Next difficulty: {result.adaptation.nextDifficulty} · strategy: {result.adaptation.nextStrategy.replaceAll("_", " ")}.</div></div></div>
          <div className="question-nav"><span className="badge">MASTERY {result.feedback.mastery.previous}% → {result.feedback.mastery.current}%</span><button className="btn btn-primary" onClick={next}>Next Challenge <ArrowRight size={14} /></button></div>
        </div>}
      </section>
      <aside className="why-box"><button style={{ display: "flex", justifyContent: "space-between", width: "100%", background: "none", border: 0, color: "inherit", padding: 0 }} onClick={() => setWhy((value) => !value)}><span className="eyebrow">WHY THIS CHALLENGE?</span><ChevronDown size={15} style={{ transform: why ? "rotate(180deg)" : "none", transition: ".2s" }} /></button>{why && <div>
        <p className="mini" style={{ lineHeight: 1.7, marginTop: 12 }}>{question.adaptiveContext.reason}</p>
        <div className="why-step"><div className="why-number">01</div><div><div className="tiny">TARGET AREA</div><div style={{ fontSize: 10, marginTop: 3 }}>{question.topicName}</div></div></div>
        <div className="why-step"><div className="why-number">02</div><div><div className="tiny">RECENT PRACTICE SIGNAL</div><div style={{ fontSize: 10, marginTop: 3 }}>{question.adaptiveContext.practiceAttempts ? `${question.adaptiveContext.accuracy}% accuracy over ${question.adaptiveContext.practiceAttempts} recent attempts` : "No practice answers recorded yet"}</div></div></div>
        <div className="why-step"><div className="why-number">03</div><div><div className="tiny">ADAPT STRATEGY</div><div style={{ fontSize: 10, marginTop: 3 }}>{question.adaptiveContext.strategy.replaceAll("_", " ")} · {question.difficulty} difficulty</div></div></div>
        {result && <div className="insight" style={{ marginTop: 8 }}><Sparkles size={14} /><div className="mini">Your answer was saved. ADAPT will use it to select the next challenge.</div></div>}
      </div>}</aside></div>
    </>}
  </div></AppShell>;
}
