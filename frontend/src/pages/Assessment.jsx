import React, { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, BrainCircuit } from "lucide-react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import { api } from "../services/api";
import { topics } from "../data/mock";

export default function Assessment() {
  const course = JSON.parse(localStorage.getItem("adapt_course") || "null");
  const subjectId = course?.subject?.id;
  const [assessmentQuestions, setAssessmentQuestions] = useState([]);
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (!subjectId) { setLoading(false); return; }
    api.diagnosticQuestions({ subjectId, courseId: course.id, selectedTopicId: course.selectedTopicId }).then(setAssessmentQuestions).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [subjectId, course?.id, course?.selectedTopicId]);

  const q = assessmentQuestions[step];
  const submit = async () => {
    if (!selected || !q) return;
    const topic = course.topics?.find((item) => item.id === q.topicId) || topics.find((item) => item.id === q.topicId);
    const answer = { questionId: q.id, questionNumber: step + 1, topicId: q.topicId, topic: topic?.name || q.topicId, difficulty: q.difficulty, selectedAnswer: selected, correct: selected === q.correctOptionId };
    const nextAnswers = [...answers.filter((item) => item.questionId !== q.id), answer];
    setAnswers(nextAnswers);
    setSelected(null);
    if (step === assessmentQuestions.length - 1) {
      try { setResult(await api.evaluateDiagnostic({ subjectId: course.subject.id, courseId: course.id, answers: nextAnswers })); }
      catch (e) { setError(e.message); }
    } else setStep((value) => value + 1);
  };

  if (!course?.subject) return <AppShell breadcrumb="ASSESSMENT"><div className="page"><div className="card card-pad"><h1 className="page-title">Choose a subject first.</h1><p className="page-subtitle">ADAPT will create your course before the diagnostic begins.</p><button className="btn btn-primary" style={{ marginTop: 15 }} onClick={() => navigate("/onboarding")}>Choose a subject <ArrowRight size={14} /></button></div></div></AppShell>;
  if (result) return <AppShell breadcrumb="ASSESSMENT"><div className="page"><div className="card card-pad glow" style={{ maxWidth: 850, margin: "30px auto" }}>
    <div style={{ textAlign: "center" }}><BrainCircuit size={34} color="var(--lavender)" /><div className="eyebrow" style={{ marginTop: 15 }}>DIAGNOSTIC COMPLETE · {result.accuracy}%</div><h1 className="page-title" style={{ marginTop: 8 }}>Your starting point is ready.</h1><p className="page-subtitle">{result.subject.name} · {result.level} level</p></div>
    <div className="grid grid-2" style={{ marginTop: 25 }}><div className="metric card"><div className="metric-label">STRENGTHS</div><div style={{ marginTop: 9 }}>{result.strengths.length ? result.strengths.join(", ") : "No clear strengths yet; this is your baseline."}</div></div><div className="metric card"><div className="metric-label">KNOWLEDGE GAPS</div><div style={{ marginTop: 9 }}>{result.weaknesses.length ? result.weaknesses.join(", ") : "No major gaps found in assessed topics."}</div></div></div>
    <div className="card card-pad" style={{ marginTop: 14 }}><div className="eyebrow">TOPIC-WISE PERFORMANCE</div><div style={{ display: "grid", gap: 10, marginTop: 13 }}>{result.topicPerformance.map((item) => <div key={item.topicId} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center" }}><span>{item.name}</span><span className="mini">{item.total ? `${item.correct}/${item.total} · ${item.accuracy}%` : "Not assessed"}</span></div>)}</div></div>
    <div className="insight" style={{ marginTop: 14 }}><BrainCircuit size={16} /><div><div className="eyebrow">RECOMMENDED START · {result.recommendedTopic}</div><div className="mini" style={{ marginTop: 5 }}>{result.explanation}</div></div></div>
    <div style={{ textAlign: "center", marginTop: 22 }}><button className="btn btn-primary" onClick={() => navigate("/course")}>Open {result.subject.name} course <ArrowRight size={14} /></button></div>
  </div></div></AppShell>;

  return <AppShell breadcrumb="ASSESSMENT"><div className="page">
    <div className="assessment-head"><div><div className="eyebrow">{course.subject.name.toUpperCase()} · DIAGNOSTIC</div><h1 className="page-title" style={{ marginTop: 8 }}>Before we begin, let’s find your current level.</h1><p className="page-subtitle">Answer a few questions so ADAPT can personalize your course.</p></div><div className="question-counter"><strong>{q ? step + 1 : 0}</strong><span>/ {assessmentQuestions.length || "—"}</span></div></div>
    {loading ? <div className="card card-pad" style={{ marginTop: 25 }}>Preparing questions for your course…</div> : error ? <div className="form-error">{error}</div> : q && <>
      <div className="assessment-progress"><span style={{ width: `${((step + 1) / assessmentQuestions.length) * 100}%` }} /></div>
      <div className="assessment-index" style={{ gridTemplateColumns: `repeat(${assessmentQuestions.length},1fr)` }}>{assessmentQuestions.map((item, i) => <span key={item.id} className={i === step ? "current" : i < step ? "done" : ""}>{i + 1}</span>)}</div>
      <div className="grid grid-2" style={{ marginTop: 18 }}>
        <div className="card card-pad">
          <div className="question-meta"><span className="badge">QUESTION {String(step + 1).padStart(2, "0")} / {assessmentQuestions.length}</span><span className="badge">{q.difficulty.toUpperCase()}</span></div>
          <div className="tiny" style={{ marginTop: 13 }}>{course.topics?.find((item) => item.id === q.topicId)?.name || topics.find((item) => item.id === q.topicId)?.name || q.topicId}</div>
          <h2 style={{ fontSize: 28, lineHeight: 1.2, marginTop: 12 }}>{q.question}</h2>
          <div className="question-options" style={{ marginTop: 22 }}>{q.options.map((o) => <button key={o.id} className={`option ${selected === o.id ? "selected" : ""}`} onClick={() => setSelected(o.id)}><span className="option-key">{o.id.toUpperCase()}</span>{o.text}{selected === o.id && <Check size={14} style={{ marginLeft: "auto" }} />}</button>)}</div>
          <div className="question-nav"><button className="btn" disabled={step === 0} onClick={() => { setStep((v) => Math.max(0, v - 1)); setSelected(null); }}><ArrowLeft size={14} /> Back</button><button className="btn btn-primary" disabled={!selected} onClick={submit}>{step === assessmentQuestions.length - 1 ? "Finish Assessment" : "Next Question"} <ArrowRight size={14} /></button></div>
        </div>
        <div className="card card-pad"><div className="eyebrow">PERSONALIZED COURSE CHECK-IN</div><p className="mini" style={{ lineHeight: 1.7, marginTop: 14 }}>This short assessment samples topics in {course.subject.name}. Your answers help ADAPT choose a useful starting topic; unanswered modules remain available in your course.</p><div className="insight" style={{ marginTop: 15 }}><BrainCircuit size={15} /><div className="mini">Each response records its selected answer, correctness, topic, difficulty and question number.</div></div></div>
      </div>
    </>}
  </div></AppShell>;
}
