import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, BrainCircuit } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import { api } from "../services/api";
import { getRecommendationExplanation } from "../utils/assessment";

export default function Assessment() {
  const [course, setCourse] = useState(null);
  const [assessmentId, setAssessmentId] = useState(null);
  const [assessmentQuestions, setAssessmentQuestions] = useState([]);
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [retryable, setRetryable] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const submitInFlight = useRef(false);
  const [searchParams] = useSearchParams();
  const selectedTopicId = searchParams.get("topicId");
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError("");
      setRetryable(false);
      try {
        const dashboard = await api.dashboard();
        const courseId = dashboard.activeCourseId || localStorage.getItem("adapt_active_course_id");
        if (!courseId) { if (active) setError("Create a course before taking its level assessment."); return; }
        const savedCourse = await api.course(courseId);
        if (!active) return;
        setCourse(savedCourse);
        localStorage.setItem("adapt_active_course_id", savedCourse.id);
        const session = await api.assessment(courseId, selectedTopicId);
        if (!active) return;
        if (session.status === "COMPLETED") { setResult(session.result); setAssessmentId(session.assessmentId); return; }
        setAssessmentId(session.assessmentId);
        const questions = session.questions || [];
        const resumedAnswers = (session.answers || []).map((answer) => {
          const question = questions.find((item) => item.id === answer.questionId);
          const topic = savedCourse.topics.find((item) => item.id === question?.topicId);
          return {
            ...answer,
            questionNumber: questions.findIndex((item) => item.id === answer.questionId) + 1,
            topicId: question?.topicId,
            topic: topic?.name || question?.topicId,
            difficulty: question?.difficulty,
          };
        });
        setAssessmentQuestions(questions);
        setAnswers(resumedAnswers);
        const firstUnanswered = questions.findIndex((question) => !resumedAnswers.some((answer) => answer.questionId === question.id));
        const nextStep = firstUnanswered < 0 ? Math.max(0, questions.length - 1) : firstUnanswered;
        setStep(nextStep);
        const savedAnswer = resumedAnswers.find((answer) => answer.questionId === questions[nextStep]?.id);
        setSelected(savedAnswer?.selectedAnswer || null);
      } catch (err) {
        if (active) {
          setError(err.message || "ADAPT could not load this assessment. Please retry.");
          setRetryable(Boolean(err.retryable));
        }
      }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [selectedTopicId, loadAttempt]);

  const retryLoad = () => {
    setError("");
    setRetryable(false);
    setLoading(true);
    setLoadAttempt((attempt) => attempt + 1);
  };

  const question = assessmentQuestions[step];
  const submit = async () => {
    if (!selected || !question || !assessmentId || !course || saving || submitInFlight.current) return;
    submitInFlight.current = true;
    const topic = course.topics.find((item) => item.id === question.topicId);
    const answer = { questionId: question.id, questionNumber: step + 1, topicId: question.topicId, topic: topic?.name || question.topicId, difficulty: question.difficulty, selectedAnswer: selected, ...(question.correctOptionId ? { correct: selected === question.correctOptionId } : {}) };
    const nextAnswers = [...answers.filter((item) => item.questionId !== question.id), answer];
    setSaving(true); setError("");
    try {
      await api.saveAssessmentProgress(assessmentId, nextAnswers);
      setAnswers(nextAnswers);
      if (step === assessmentQuestions.length - 1) {
        const evaluated = await api.evaluateDiagnostic({ subjectId: course.subject.id, courseId: course.id, assessmentId, answers: nextAnswers });
        setResult(evaluated);
      } else {
        setStep((value) => value + 1);
        setSelected(null);
        submitInFlight.current = false;
      }
    } catch (err) { submitInFlight.current = false; setError(err.message); }
    finally { setSaving(false); }
  };

  if (loading) return <AppShell breadcrumb="ASSESSMENT"><div className="page"><div className="card card-pad">Loading the saved course assessment…</div></div></AppShell>;
  if (!course) return <AppShell breadcrumb="ASSESSMENT"><div className="page"><div className="card card-pad"><h1 className="page-title">{error || "A course is needed before assessment."}</h1>{retryable && <button className="btn btn-primary" style={{ marginTop: 15 }} onClick={retryLoad}>Retry assessment generation</button>}<Link className="btn" style={{ marginTop: 15 }} to="/course">Open Course <ArrowRight size={14} /></Link></div></div></AppShell>;

  if (result) return <AppShell breadcrumb="ASSESSMENT"><div className="page"><div className="card card-pad glow" style={{ maxWidth: 850, margin: "30px auto" }}>
    <div style={{ textAlign: "center" }}><BrainCircuit size={34} color="var(--lavender)" /><div className="eyebrow" style={{ marginTop: 15 }}>ASSESSMENT COMPLETE · {result.accuracy}%</div><h1 className="page-title" style={{ marginTop: 8 }}>Your starting point is ready.</h1><p className="page-subtitle">{result.subject.name} · {result.level} level</p></div>
    <div className="grid grid-2" style={{ marginTop: 25 }}><div className="metric card"><div className="metric-label">STRENGTHS</div><div style={{ marginTop: 9 }}>{result.strengths.length ? result.strengths.join(", ") : "Your baseline is recorded."}</div></div><div className="metric card"><div className="metric-label">AREAS TO WORK ON</div><div style={{ marginTop: 9 }}>{result.weaknesses.length ? result.weaknesses.join(", ") : "No assessed gaps were found."}</div></div></div>
    <div className="card card-pad" style={{ marginTop: 14 }}><div className="eyebrow">RECOMMENDED START · {result.recommendedTopic}</div><p className="mini" style={{ marginTop: 7 }}>{getRecommendationExplanation(result)}</p></div>
    {selectedTopicId && (() => { const topicResult = result.topicPerformance?.find((item) => item.topicId === selectedTopicId); return <div className="metric card" style={{ marginTop: 14 }}><div className="metric-label">TOPIC MASTERY · {course.topics.find((topic) => topic.id === selectedTopicId)?.name || result.recommendedTopic}</div><div style={{ marginTop: 8 }}>{topicResult?.accuracy ?? result.accuracy}% · {topicResult?.correct ?? 0} of {topicResult?.total ?? result.total} correct</div></div>; })()}
    <div style={{ textAlign: "center", marginTop: 22 }}><button className="btn btn-primary" onClick={async () => { if (!selectedTopicId) { navigate("/course"); return; } try { await api.activateTopic(course.id, selectedTopicId); navigate("/practice"); } catch (err) { setError(err.message); } }}>Start Learning <ArrowRight size={14} /></button>{error && <div className="form-error" role="alert">{error}</div>}</div>
  </div></div></AppShell>;

  if (error && !assessmentQuestions.length) return <AppShell breadcrumb="ASSESSMENT"><div className="page"><div className="form-error" role="alert">{error}</div>{retryable && <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={retryLoad}>Retry assessment generation</button>}<Link className="btn" style={{ marginTop: 12 }} to="/course">Back to Course</Link></div></AppShell>;
  if (!question) return <AppShell breadcrumb="ASSESSMENT"><div className="page"><div className="card card-pad">No assessment questions are available yet.</div></div></AppShell>;

  return <AppShell breadcrumb="ASSESSMENT"><div className="page">
    {error && <div className="form-error" role="alert" style={{ marginBottom: 15 }}>{error}</div>}
    <div className="assessment-head"><div><div className="eyebrow">{course.title.toUpperCase()} · {selectedTopicId ? "TOPIC DIAGNOSTIC" : "LEVEL ASSESSMENT"}</div><h1 className="page-title" style={{ marginTop: 8 }}>{selectedTopicId ? `Explore ${course.topics.find((topic) => topic.id === selectedTopicId)?.name || "this topic"}.` : "Find your current level."}</h1><p className="page-subtitle">{selectedTopicId ? "Before you start, ADAPT wants to understand what you already know. Your answers will set this topic's starting point." : "Your answers are saved as you go. You can leave and resume this assessment later."}</p></div><div className="question-counter"><strong>{step + 1}</strong><span>/ {assessmentQuestions.length}</span></div></div>
    <div className="assessment-progress"><span style={{ width: `${((step + 1) / assessmentQuestions.length) * 100}%` }} /></div>
    <div className="assessment-index" style={{ gridTemplateColumns: `repeat(${assessmentQuestions.length},1fr)` }}>{assessmentQuestions.map((item, index) => <span key={item.id} className={index === step ? "current" : answers.some((answer) => answer.questionId === item.id) ? "done" : ""}>{index + 1}</span>)}</div>
    <div className="grid grid-2" style={{ marginTop: 18 }}>
      <div className="card card-pad"><div className="question-meta"><span className="badge">QUESTION {String(step + 1).padStart(2, "0")} / {assessmentQuestions.length}</span><span className="badge">{question.difficulty.toUpperCase()}</span></div><div className="tiny" style={{ marginTop: 13 }}>{course.topics.find((item) => item.id === question.topicId)?.name || question.topicId}</div><h2 style={{ fontSize: 28, lineHeight: 1.2, marginTop: 12 }}>{question.question}</h2>
        <div className="question-options" style={{ marginTop: 22 }}>{question.options.map((option) => <button key={option.id} className={`option ${selected === option.id ? "selected" : ""}`} onClick={() => setSelected(option.id)}><span className="option-key">{option.id.toUpperCase()}</span>{option.text}{selected === option.id && <Check size={14} style={{ marginLeft: "auto" }} />}</button>)}</div>
        <div className="question-nav"><button className="btn" disabled={step === 0 || saving} onClick={() => { setStep((value) => Math.max(0, value - 1)); setSelected(answers.find((answer) => answer.questionId === assessmentQuestions[step - 1]?.id)?.selectedAnswer || null); }}><ArrowLeft size={14} /> Back</button><button className="btn btn-primary" disabled={!selected || saving} onClick={submit}>{saving ? "Saving…" : step === assessmentQuestions.length - 1 ? "Finish Assessment" : "Save and Continue"} <ArrowRight size={14} /></button></div>
      </div>
      <div className="card card-pad"><div className="eyebrow">{selectedTopicId ? "TOPIC KNOWLEDGE CHECK" : "PERSONALIZED COURSE CHECK-IN"}</div><p className="mini" style={{ lineHeight: 1.7, marginTop: 14 }}>{selectedTopicId ? "This diagnostic is specific to your selected topic. ADAPT saves the result and mastery to your learner record before opening the learning activity." : `This assessment samples the topics in ${course.title}. ADAPT uses your saved answers to recommend where to begin.`}</p><div className="insight" style={{ marginTop: 15 }}><BrainCircuit size={15} /><div className="mini">Answers are saved as you go. You can leave and resume this assessment later.</div></div></div>
    </div>
  </div></AppShell>;
}
