import React, { useState } from "react";
import { ArrowLeft, ArrowRight, Clock3, Eye, EyeOff, LogIn, Sparkles, UserPlus } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Brand from "../components/ui/Brand";
import AIOrb from "../components/ui/AIOrb";
import { api } from "../services/api";
import { saveCourse } from "../utils/courseState";

const examples = ["I want to learn Java OOP", "Teach me machine learning from basics", "I want to master SQL", "Help me learn Operating Systems for my exam"];

export default function Onboarding() {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState(searchParams.get("mode") === "signin" ? "signin" : "signup");
  const [step, setStep] = useState(-1);
  const [learningRequest, setLearningRequest] = useState("");
  const [generated, setGenerated] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const submitAuth = async (event) => {
    event.preventDefault(); setError("");
    if (!form.email || !form.password || (mode === "signup" && !form.name)) { setError("Please complete all required fields."); return; }
    setBusy(true);
    try {
      const result = mode === "signup"
        ? await api.register({ name: form.name, email: form.email, password: form.password })
        : await api.login({ email: form.email, password: form.password });
      localStorage.setItem("adapt_token", result.token || "mock-token");
      localStorage.setItem("adapt_user", JSON.stringify(result.user || { name: form.name || "Learner", email: form.email }));
      const nextPath = searchParams.get("next");
      if (mode === "signin" && nextPath?.startsWith("/")) { navigate(nextPath); return; }
      setStep(0);
    } catch (err) { setError(err.message || "Unable to continue. Please try again."); }
    finally { setBusy(false); }
  };

  const createCourse = async (event) => {
    event.preventDefault();
    if (!learningRequest.trim()) { setError("Tell us what you'd like to learn."); return; }
    setError(""); setBusy(true); setProcessingStep(0);
    const stageTimer = setInterval(() => setProcessingStep((stage) => Math.min(2, stage + 1)), 650);
    try {
      const response = await api.generateCourse({ learningRequest: learningRequest.trim() });
      saveCourse({ ...response.course, learningRequest: learningRequest.trim(), understanding: response.understanding, selectedTopicId: null, status: "setup", progress: 0, completedTopicIds: [] });
      localStorage.removeItem("adapt_assessment"); localStorage.removeItem("adapt_learner_profile");
      setGenerated(response); setStep(1);
    } catch (err) {
      setError(navigator.onLine ? (err.message || "We couldn't create your course right now. Try again.") : "Course generation requires an internet connection. Your cached courses remain available.");
    } finally { clearInterval(stageTimer); setBusy(false); }
  };

  const startAssessment = () => navigate("/assessment");

  return <div className="landing" style={{ minHeight: "100vh" }}>
    <div style={{ maxWidth: 1100, margin: "auto", padding: "25px 25px" }}><Brand /></div>
    <div style={{ maxWidth: 850, margin: "45px auto 80px", padding: "0 24px" }}>
      {step === -1 && <div className="auth-wrap card card-pad glow">
        <div className="auth-copy">
          <div className="eyebrow">YOUR PERSONAL LEARNING OS</div>
          <h1 className="page-title" style={{ fontSize: "clamp(42px,7vw,72px)", marginTop: 12 }}>Learn differently.<br />Because you are.</h1>
          <p className="page-subtitle" style={{ maxWidth: 480, lineHeight: 1.7 }}>Create your learner profile and let ADAPT change the next question, explanation and study path around you.</p>
          <div className="auth-orb"><AIOrb /></div>
        </div>
        <div className="auth-form-panel">
          <div className="auth-tabs">
            <button className={mode === "signup" ? "active" : ""} onClick={() => { setMode("signup"); setError(""); }}><UserPlus size={14} /> Sign up</button>
            <button className={mode === "signin" ? "active" : ""} onClick={() => { setMode("signin"); setError(""); }}><LogIn size={14} /> Sign in</button>
          </div>
          <form onSubmit={submitAuth}>
            {mode === "signup" && <label className="field-label">FULL NAME<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" /></label>}
            <label className="field-label">EMAIL<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" /></label>
            <label className="field-label">PASSWORD<div className="password-field"><input type={showPassword ? "text" : "password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="At least 6 characters" /><button type="button" aria-label="Show password" onClick={() => setShowPassword((v) => !v)}>{showPassword ? <EyeOff size={15} /> : <Eye size={15} />}</button></div></label>
            {error && <div className="form-error">{error}</div>}
            <button className="btn btn-primary auth-submit" disabled={busy}>{busy ? "Creating your profile..." : mode === "signup" ? "Create my account" : "Continue to ADAPT"}<ArrowRight size={15} /></button>
          </form>
          <div className="auth-note">Demo mode is enabled, so your account works without a backend.</div>
        </div>
      </div>}

      {step === 0 && <>
        <div className="eyebrow">YOUR NEXT LEARNING PATH</div>
        <h1 className="page-title" style={{ fontSize: "clamp(42px,7vw,62px)", marginTop: 12 }}>What do you want to learn?</h1>
        <p className="page-subtitle" style={{ maxWidth: 600, lineHeight: 1.7 }}>Tell ADAPT what you want to learn, and we'll build a personalized course around your goal.</p>
        <form onSubmit={createCourse}>
          <label className="field-label" htmlFor="learning-request" style={{ marginTop: 27 }}>YOUR LEARNING GOAL</label>
          <textarea id="learning-request" className="learning-request" value={learningRequest} onChange={(event) => setLearningRequest(event.target.value)} placeholder="I want to learn Python for data science from beginner to advanced..." rows={5} maxLength={600} />
          <div className="tiny" style={{ textAlign: "right", marginTop: 5 }}>{learningRequest.length}/600</div>
          <div className="eyebrow" style={{ marginTop: 20 }}>NEED AN IDEA?</div>
          <div className="chips" style={{ marginTop: 9 }}>{examples.map((example) => <button className="chip suggestion-chip" type="button" key={example} onClick={() => setLearningRequest(example)}>{example}</button>)}</div>
          {error && <div className="form-error" role="alert" style={{ marginTop: 16 }}>{error}</div>}
          {busy && <div className="insight" role="status" style={{ marginTop: 18 }}><Sparkles size={16} /><div><strong>{["Understanding your learning goal...", "Finding relevant topics...", "Building your course..."][processingStep]}</strong><div className="mini" style={{ marginTop: 5 }}>Building your personalized course...</div></div></div>}
          <button className="btn btn-primary" style={{ marginTop: 22 }} disabled={busy || !learningRequest.trim()}>{busy ? "Creating your course..." : "Create My Course"} <ArrowRight size={15} /></button>
        </form>
      </>}

      {step === 1 && generated && <div className="card card-pad glow course-preview">
        <button className="btn" onClick={() => { setError(""); setStep(0); }}><ArrowLeft size={14} /> Edit Learning Goal</button>
        <div className="eyebrow" style={{ marginTop: 24 }}>PERSONALIZED COURSE PREVIEW</div>
        <h1 className="page-title" style={{ fontSize: "clamp(38px,6vw,56px)", marginTop: 10 }}>{generated.course.title}</h1>
        <p className="page-subtitle">Personalized course</p>
        <div className="grid grid-2" style={{ marginTop: 22 }}>
          <div className="metric card"><div className="metric-label">DETECTED GOAL</div><div className="mini" style={{ marginTop: 9, lineHeight: 1.7 }}>{generated.understanding.learningGoal}</div></div>
          <div className="metric card"><div className="metric-label">COURSE DETAILS</div><div style={{ marginTop: 9, display: "flex", gap: 16, flexWrap: "wrap" }}><span><Clock3 size={14} style={{ verticalAlign: "middle", marginRight: 5 }} />{Math.round(generated.course.estimatedLearningTimeMinutes / 60 * 10) / 10} hours</span><span>{generated.course.moduleCount} modules</span></div><div className="mini" style={{ marginTop: 8 }}>Starting assumption: {generated.understanding.detectedDifficulty}</div></div>
        </div>
        <div className="card card-pad" style={{ marginTop: 14 }}><div className="eyebrow">DETECTED TOPICS · MODULES</div><div className="preview-modules" style={{ marginTop: 12 }}>{generated.course.topics.map((topic, index) => <div className="preview-module" key={topic.id}><span className="option-key">{String(index + 1).padStart(2, "0")}</span><span>{topic.name}</span></div>)}</div></div>
        <button className="btn btn-primary" style={{ marginTop: 22 }} onClick={startAssessment}>Start Skill Assessment <ArrowRight size={15} /></button>
      </div>}
    </div>
  </div>;
}
