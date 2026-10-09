import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, ChevronDown, Download, Sparkles, WifiOff } from "lucide-react";
import { Link } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import { api } from "../services/api";
import { apiClient } from "../services/api/apiClient";
import { getDownloadedPracticePacks, getPracticeActivities, getPracticeActivity, getUnconfirmedPracticeAnswers, savePendingPracticeAnswer, saveDownloadedPractice } from "../services/offlinePracticeStore";
import { syncPendingPracticeAnswers } from "../services/offlinePracticeSync";

export default function Practice() {
  const [question, setQuestion] = useState(null);
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const [why, setWhy] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [nextError, setNextError] = useState("");
  const [retryAvailable, setRetryAvailable] = useState(false);
  const [sequence, setSequence] = useState(1);
  const [offlineMode, setOfflineMode] = useState(false);
  const [offlineSaved, setOfflineSaved] = useState(false);
  const [offlineActivityId, setOfflineActivityId] = useState(null);
  const [downloadedPack, setDownloadedPack] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadMessage, setDownloadMessage] = useState("");
  const [questionStartedAt, setQuestionStartedAt] = useState(Date.now());
  const loadPromise = useRef(null);
  const nextQuestionPromise = useRef(null);
  const submittedQuestionId = useRef(null);
  const canAnswer = Boolean(question && !loading && !busy && !result && !offlineSaved && submittedQuestionId.current !== question.id);

  const loadQuestion = async ({ preserveCurrent = false } = {}) => {
    if (!navigator.onLine) return loadOfflineQuestion();
    if (loadPromise.current) return loadPromise.current;
    const keepResult = preserveCurrent && Boolean(result);
    setLoading(true); setError(""); setNextError(""); setRetryAvailable(false);
    if (!keepResult) {
      setQuestion(null); setSelected(null); setResult(null);
      submittedQuestionId.current = null;
    }
    const pendingQuestion = nextQuestionPromise.current;
    nextQuestionPromise.current = null;
    const request = (async () => {
      try {
        const userId = apiClient.getUserId();
        if (userId && (await getUnconfirmedPracticeAnswers(userId)).length) {
          const sync = await syncPendingPracticeAnswers(userId);
          if (sync.pendingCount > 0) {
            throw Object.assign(new Error("A saved offline answer is still pending server confirmation. Retry sync before requesting another challenge."), { retryable: true });
          }
        }
        const nextQuestion = await (pendingQuestion || api.nextPractice());
        setQuestion(nextQuestion);
        setOfflineMode(false);
        setOfflineSaved(false);
        setOfflineActivityId(null);
        setQuestionStartedAt(Date.now());
        setSelected(null);
        setResult(null);
        submittedQuestionId.current = null;
        return nextQuestion;
      } catch (err) {
        setError(err.message);
        setRetryAvailable(Boolean(err.retryable));
        if (keepResult) setNextError(err.message);
        return null;
      } finally {
        setLoading(false);
        loadPromise.current = null;
      }
    })();
    loadPromise.current = request;
    return request;
  };
  const loadOfflineQuestion = async () => {
    setLoading(true); setError(""); setRetryAvailable(false); setResult(null); setOfflineSaved(false); setOfflineActivityId(null); setOfflineMode(true);
    try {
      const userId = apiClient.getUserId();
      const preferredCourseId = localStorage.getItem("adapt_active_course_id");
      const packs = await getDownloadedPracticePacks(userId);
      const pack = packs.find((item) => item.courseId === preferredCourseId) || packs[0] || null;
      setDownloadedPack(pack);
      if (!pack) {
        setQuestion(null);
        setError("Challenge Me requires a connection until you download eligible practice questions.");
        return;
      }
      localStorage.setItem("adapt_active_course_id", pack.courseId);
      const activities = await getPracticeActivities(userId, pack.courseId);
      const attemptedIds = new Set(activities.map((activity) => activity.questionId));
      const nextQuestion = pack.questions.find((item) => !attemptedIds.has(item.id));
      if (!nextQuestion) {
        setQuestion(null);
        setError(activities.some((item) => item.status !== "synced")
          ? "All downloaded questions have been answered. Your saved answers are pending server sync. Connect to ADAPT to sync them or download more questions."
          : "All downloaded questions have been answered. Connect to ADAPT to download more practice questions.");
        return;
      }
      setQuestion({
        ...nextQuestion,
        title: `${nextQuestion.topicName} Challenge`,
        adaptiveContext: { reason: "Downloaded question. ADAPT will grade this answer after it syncs.", accuracy: null, practiceAttempts: 0, strategy: "offline_practice" },
      });
      setSelected(null);
      setQuestionStartedAt(Date.now());
      setSequence(activities.length + 1);
    } catch (err) {
      setQuestion(null);
      setError(err.message || "Saved practice questions could not be opened.");
    } finally { setLoading(false); }
  };
  useEffect(() => {
    if (navigator.onLine) void loadQuestion();
    else void loadOfflineQuestion();
  }, []);

  useEffect(() => {
    if (!offlineActivityId) return undefined;
    const refreshActivity = async () => {
      const activity = await getPracticeActivity(apiClient.getUserId(), offlineActivityId).catch(() => null);
      if (activity?.status === "synced" && activity.result) {
        setResult(activity.result);
        setOfflineSaved(false);
        setOfflineMode(true);
      }
    };
    const onActivityChanged = (event) => {
      if (event.detail?.userId === apiClient.getUserId()) void refreshActivity();
    };
    window.addEventListener("adapt:offline-activities-changed", onActivityChanged);
    return () => window.removeEventListener("adapt:offline-activities-changed", onActivityChanged);
  }, [offlineActivityId]);

  const downloadOfflineQuestions = async () => {
    setDownloading(true); setDownloadMessage("");
    try {
      const dashboard = await api.dashboard();
      const courseId = dashboard.activeCourseId || localStorage.getItem("adapt_active_course_id");
      if (!courseId) throw new Error("Create a course and complete its level assessment before downloading practice questions.");
      const pack = await api.offlinePracticePack(courseId);
      const saved = await saveDownloadedPractice(apiClient.getUserId(), pack);
      setDownloadedPack(saved);
      setDownloadMessage(`${saved.questions.length} server-graded practice question${saved.questions.length === 1 ? "" : "s"} saved on this device.`);
    } catch (err) {
      setDownloadMessage(err.message || "Could not download offline practice questions.");
    } finally { setDownloading(false); }
  };

  const submit = async () => {
    if (!selected || !question || loading || busy || result || submittedQuestionId.current === question.id) return;
    if (offlineMode) {
      setBusy(true); setError("");
      try {
        const activity = await savePendingPracticeAnswer(apiClient.getUserId(), question.courseId, question, selected, Math.floor((Date.now() - questionStartedAt) / 1000));
        setOfflineActivityId(activity.activityId);
        setOfflineSaved(true);
        setDownloadMessage("");
      } catch (err) { setError(err.message || "The answer could not be saved on this device."); }
      finally { setBusy(false); }
      return;
    }
    submittedQuestionId.current = question.id;
    setBusy(true); setError("");
    try {
      const answerResult = await api.answerPractice({ questionId: question.id, selectedOptionId: selected, timeTakenSeconds: 18 });
      setResult(answerResult);
      const preload = Promise.resolve().then(() => api.nextPractice());
      nextQuestionPromise.current = preload;
      preload.catch((err) => {
        if (nextQuestionPromise.current === preload) {
          nextQuestionPromise.current = null;
          setNextError(err.message || "The next question could not be loaded. Retry when ready.");
        }
      });
    } catch (err) {
      setError(err.message);
      submittedQuestionId.current = null;
    }
    finally { setBusy(false); }
  };
  const next = async () => {
    if (offlineMode) {
      await loadOfflineQuestion();
      return;
    }
    const nextQuestion = await loadQuestion({ preserveCurrent: Boolean(result) });
    if (nextQuestion) setSequence((value) => value + 1);
  };

  return <AppShell breadcrumb="CHALLENGE ME"><div className="page">
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 12, flexWrap: "wrap" }}><div><div className="eyebrow">ADAPTIVE CHALLENGE</div><h1 className="page-title" style={{ marginTop: 8 }}>Challenge Me</h1><p className="page-subtitle">Let's work on what ADAPT has identified from your course and learning history.</p></div><button type="button" className="btn" onClick={downloadOfflineQuestions} disabled={downloading || !navigator.onLine}>{downloading ? "Preparing questions…" : <><Download size={14} /> {downloadedPack ? "Update offline questions" : "Download for offline"}</>}</button></div>
    {downloadMessage && <div className={downloadMessage.includes("saved on this device") ? "offline-practice-notice" : "form-error"} role="status" style={{ marginTop: 14 }}>{downloadMessage}</div>}
    {offlineMode && downloadedPack && <div className="offline-practice-notice" role="status" style={{ marginTop: 14 }}><WifiOff size={15} /><span>{downloadedPack.questions.length} downloaded questions. Answers are saved locally and remain pending until the server grades them.</span></div>}
    {error && !question && !loading && <div className="card card-pad glow" style={{ marginTop: 20 }}><h2 style={{ fontSize: 20 }}>{error}</h2>{retryAvailable && <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={() => loadQuestion()}>Retry question</button>}<p className="mini" style={{ marginTop: 7 }}>{offlineMode ? "Server-generated questions and grading require a connection." : "Create a course and complete its level assessment to give ADAPT learner context for a targeted challenge."}</p><Link className="btn" style={{ marginTop: 14 }} to="/course">Open Course <ArrowRight size={14} /></Link></div>}
    {error && question && <div className="form-error" role="alert" style={{ marginTop: 16 }}>{error}</div>}
    {loading && <div className="card card-pad" style={{ marginTop: 20 }}><div className="eyebrow">ADAPT IS THINKING…</div><p className="mini" style={{ marginTop: 8 }}>Selecting a question from your current course and saved learner signals.</p></div>}
    {question && <>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 15, alignItems: "end", marginTop: 20 }}><div><div className="eyebrow">{question.topicName} · {question.difficulty.toUpperCase()}</div><h2 className="page-title" style={{ fontSize: 30, marginTop: 8 }}>{question.title || `${question.topicName} Challenge`}</h2><p className="page-subtitle">{question.adaptiveContext?.reason}</p></div><span className="badge">CHALLENGE {String(sequence).padStart(2, "0")}</span></div>
      <div className="lab-grid" style={{ marginTop: 22 }}><section className="card card-pad hero-panel">
        <h3 style={{ fontSize: 23, lineHeight: 1.35 }}>{question.question}</h3><p className="mini" style={{ marginTop: 8 }}>Choose the answer that best completes the concept.</p>
        <div className="question-options" style={{ marginTop: 20 }}>{question.options.map((option) => <button key={option.id} className={`option ${selected === option.id ? "selected" : ""}`} onClick={() => canAnswer && setSelected(option.id)} disabled={!canAnswer}><span className="option-key">{option.id.toUpperCase()}</span><span>{option.text}</span>{selected === option.id && <Check size={15} style={{ marginLeft: "auto", color: "var(--lavender)" }} />}</button>)}</div>
        {offlineSaved ? <div className="card card-pad offline-pending-answer" style={{ marginTop: 20 }} role="status"><div className="eyebrow"><WifiOff size={13} /> SAVED ON THIS DEVICE · PENDING SYNC</div><p className="mini" style={{ marginTop: 8 }}>This answer has not been graded yet. ADAPT will verify it with the server when the connection returns.</p><button className="btn" style={{ marginTop: 12 }} onClick={next}>Next downloaded question <ArrowRight size={14} /></button></div>
          : !result ? <button className="btn btn-primary" style={{ marginTop: 18, float: "right" }} disabled={!selected || !canAnswer} onClick={submit}>{busy ? offlineMode ? "Saving locally…" : "Checking…" : "Submit Answer"} <ArrowRight size={14} /></button> : <div className="card card-pad" style={{ marginTop: 20, background: "rgba(13,6,24,.35)" }}>
          <div className="eyebrow" style={{ color: result.attempt.correct ? "var(--success)" : "var(--warning)" }}>{result.attempt.correct ? "CORRECT" : "INCORRECT"}</div><h3 style={{ fontSize: 19, marginTop: 8 }}>{result.feedback.whatAdaptLearned}</h3><p className="mini" style={{ lineHeight: 1.7, marginTop: 7 }}>{result.feedback.explanation}</p>
          <div className="insight" style={{ marginTop: 12 }}><Sparkles size={14} /><div><div className="eyebrow">ADAPT DECISION</div><div className="mini" style={{ marginTop: 4 }}>{result.adaptation.reason} Next difficulty: {result.adaptation.nextDifficulty} · strategy: {result.adaptation.nextStrategy.replaceAll("_", " ")}.</div></div></div>
          {(nextError || error) && <div className="form-error" role="alert" style={{ marginTop: 12 }}>{nextError || error}</div>}
          <div className="question-nav"><span className="badge">MASTERY {result.feedback.mastery.previous}% → {result.feedback.mastery.current}%</span><button className="btn btn-primary" onClick={next} disabled={loading}>{loading ? "Loading next question…" : nextError || error ? "Retry next question" : "Next Challenge"} <ArrowRight size={14} /></button></div>
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
