import React, { useRef, useState } from "react";
import { ArrowRight, Eye, EyeOff, LogIn, Sparkles, UserPlus } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Brand from "../components/ui/Brand";
import AIOrb from "../components/ui/AIOrb";
import { api } from "../services/api";
import { saveCourse } from "../utils/courseState";
import { useAuth } from "../services/AuthContext";

export default function Onboarding() {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState(searchParams.get("mode") === "signin" ? "signin" : "signup");
  const { user, checking, setSession } = useAuth();
  const [learningRequest, setLearningRequest] = useState(() => sessionStorage.getItem("adapt_course_request") || "");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retryable, setRetryable] = useState(false);
  const courseRequestInFlight = useRef(false);
  const navigate = useNavigate();

  const submitAuth = async (event) => {
    event.preventDefault();
    setError("");
    if (!form.email || !form.password || (mode === "signup" && !form.name)) { setError("Please complete all required fields."); return; }
    setBusy(true);
    try {
      const result = mode === "signup"
        ? await api.register({ name: form.name, email: form.email, password: form.password })
        : await api.login({ email: form.email, password: form.password });
      setSession(result.token, result.user);
      const nextPath = searchParams.get("next");
      const intent = searchParams.get("intent");
      const safeNext = nextPath?.startsWith("/") && !nextPath.startsWith("//") ? nextPath : null;
      navigate(mode === "signin" ? "/dashboard" : safeNext || (intent === "learn" ? "/onboarding?intent=learn" : "/dashboard"), { replace: true });
    } catch (err) { setError(err.message || "Unable to continue. Please try again."); }
    finally { setBusy(false); }
  };

  const createCourse = async (event) => {
    event.preventDefault();
    if (courseRequestInFlight.current) return;
    if (!learningRequest.trim()) { setError("Tell us what you'd like to learn."); return; }
    courseRequestInFlight.current = true;
    setError(""); setRetryable(false); setBusy(true);
    const startedAt = performance.now();
    try {
      const response = await api.generateCourse({ learningRequest: learningRequest.trim() });
      console.info(`[Performance] Course generation request completed in ${Math.round(performance.now() - startedAt)}ms.`);
      const course = saveCourse({ ...response.course, learningRequest: learningRequest.trim(), understanding: response.understanding, selectedTopicId: null, status: "setup", progress: 0, completedTopicIds: [] });
      localStorage.setItem("adapt_active_course_id", course.id);
      sessionStorage.removeItem("adapt_course_request");
      localStorage.removeItem("adapt_assessment");
      navigate("/course", { replace: true });
    } catch (err) {
      setRetryable(Boolean(err.retryable));
      setError(navigator.onLine ? (err.message || "ADAPT couldn't generate this right now. Please try again.") : "Course generation requires an internet connection.");
    } finally { courseRequestInFlight.current = false; setBusy(false); }
  };

  return <div className="landing" style={{ minHeight: "100vh" }}>
    <div style={{ maxWidth: 1100, margin: "auto", padding: "25px" }}><Brand /></div>
    <div style={{ maxWidth: 850, margin: "45px auto 80px", padding: "0 24px" }}>
      {checking ? <div className="card card-pad" role="status">Checking your session…</div> : !user ? <div className="auth-wrap card card-pad glow">
        <div className="auth-copy"><div className="eyebrow">YOUR PERSONAL LEARNING OS</div><h1 className="page-title" style={{ fontSize: "clamp(42px,7vw,72px)", marginTop: 12 }}>Learn differently.<br />Because you are.</h1><p className="page-subtitle" style={{ maxWidth: 480, lineHeight: 1.7 }}>Create your learner profile and let ADAPT change the next question, explanation and study path around you.</p><div className="auth-orb"><AIOrb /></div></div>
        <div className="auth-form-panel">
          <div className="auth-tabs"><button className={mode === "signup" ? "active" : ""} onClick={() => { setMode("signup"); setError(""); }}><UserPlus size={14} /> Sign up</button><button className={mode === "signin" ? "active" : ""} onClick={() => { setMode("signin"); setError(""); }}><LogIn size={14} /> Sign in</button></div>
          <form onSubmit={submitAuth}>
            {mode === "signup" && <label className="field-label">FULL NAME<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Your name" /></label>}
            <label className="field-label">EMAIL<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="you@example.com" /></label>
            <label className="field-label">PASSWORD<div className="password-field"><input type={showPassword ? "text" : "password"} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="At least 6 characters" /><button type="button" aria-label="Show password" onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={15} /> : <Eye size={15} />}</button></div></label>
            {error && <div className="form-error" role="alert">{error}</div>}
            <button className="btn btn-primary auth-submit" disabled={busy}>{busy ? "Signing you in..." : mode === "signup" ? "Create my account" : "Continue to ADAPT"}<ArrowRight size={15} /></button>
          </form>
        </div>
      </div> : <>
        <div className="eyebrow">YOUR NEXT LEARNING PATH</div><h1 className="page-title" style={{ fontSize: "clamp(42px,7vw,62px)", marginTop: 12 }}>What do you want to learn?</h1>
        <p className="page-subtitle" style={{ maxWidth: 600, lineHeight: 1.7 }}>Tell ADAPT what you want to learn. Course creation is optional, and your request can be in your own words.</p>
        <form onSubmit={createCourse}>
          <label className="field-label" htmlFor="learning-request" style={{ marginTop: 27 }}>YOUR LEARNING GOAL</label>
          <textarea id="learning-request" className="learning-request" value={learningRequest} onChange={(event) => { setLearningRequest(event.target.value); sessionStorage.setItem("adapt_course_request", event.target.value); }} placeholder="I want to learn Operating Systems, especially CPU scheduling and deadlocks." rows={5} maxLength={600} />
          <div className="tiny" style={{ textAlign: "right", marginTop: 5 }}>{learningRequest.length}/600</div>
          {error && <div className="form-error" role="alert" style={{ marginTop: 16 }}>{error}</div>}
          {busy && <div className="insight" role="status" style={{ marginTop: 18 }}><Sparkles size={16} /><div><strong>Generating your course with ADAPT…</strong><div className="mini" style={{ marginTop: 5 }}>This can take a little while while Gemini prepares and validates the course.</div></div></div>}
          <button className="btn btn-primary" style={{ marginTop: 22 }} disabled={busy || !learningRequest.trim()}>{busy ? "Creating your course..." : retryable ? "Retry course generation" : "Create My Course"} <ArrowRight size={15} /></button>
        </form>
        <Link className="btn" style={{ marginTop: 15 }} to="/dashboard">Return to Dashboard</Link>
      </>}
    </div>
  </div>;
}
