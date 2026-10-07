import React, { useEffect, useState } from "react";
import { Send, Sparkles, BookOpenCheck, Lightbulb, Image, TimerReset, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import { api } from "../services/api";

const actions = [["Explain simply", Lightbulb], ["Give a real-world example", BookOpenCheck], ["Make a visual explanation", Image], ["Help me prepare an exam answer", BookOpenCheck], ["Quiz me", Sparkles], ["Give me a short revision", TimerReset]];

export default function Tutor() {
  const [context, setContext] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { api.dashboard().then(setContext).catch((err) => setError(err.message)); }, []);

  const course = context?.course;
  const topic = course?.topics?.find((item) => item.id === (course.activeTopicId || course.recommendedTopicId));
  const send = async () => {
    const message = input.trim();
    if (!message || busy) return;
    setError(""); setInput(""); setMessages((current) => [...current, { role: "user", content: message }]); setBusy(true);
    try {
      const response = await api.tutorMessage({ message, mode: "explain", topicId: topic?.id, topicName: topic?.name, courseName: course?.title });
      setMessages((current) => [...current, response]);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const buildCourse = () => {
    const request = input.trim() || [...messages].reverse().find((message) => message.role === "user")?.content;
    if (request) sessionStorage.setItem("adapt_course_request", request);
  };

  return <AppShell breadcrumb="TUTOR"><div className="page">
    <div className="eyebrow">AI TEACHING WORKSPACE</div><h1 className="page-title" style={{ marginTop: 8 }}>ADAPT Tutor</h1><p className="page-subtitle">Ask a question with or without a course. ADAPT can help independently.</p>
    <div className="chips" style={{ marginTop: 15 }}><span className="chip">{course?.title || "INDEPENDENT TUTOR"}</span>{topic && <span className="chip">{topic.name.toUpperCase()}</span>}{context?.assessment?.level && <span className="chip">{context.assessment.level.toUpperCase()} LEVEL</span>}</div>
    {error && <div className="form-error" role="alert" style={{ marginTop: 15 }}>{error}</div>}
    <div className="tutor-layout" style={{ marginTop: 18 }}>
      <section className="card card-pad">
        <div className="quick-actions">{actions.map(([label, Icon]) => <button className="btn" key={label} onClick={() => setInput(`${label}: ${topic?.name || ""}`.trim())}><Icon size={13} />{label}</button>)}</div>
        <div style={{ marginTop: 24, display: "grid", gap: 12, minHeight: 100 }}>
          {!messages.length && <div className="mini">Ask ADAPT anything you're trying to understand. Your first question can be about any subject.</div>}
          {messages.map((message, index) => <div key={`${message.role}-${index}`} className={message.role === "assistant" ? "teaching-block" : ""} style={message.role === "user" ? { padding: "14px 16px", background: "rgba(124,60,255,.08)", border: "1px solid var(--border)", borderRadius: 15, marginLeft: "14%" } : {}}><div className="eyebrow" style={{ marginBottom: 6 }}>{message.role === "assistant" ? "ADAPT" : "YOU"}</div><div style={{ fontSize: 13, lineHeight: 1.7 }}>{message.content}</div></div>)}
          {busy && <div className="mini" role="status">ADAPT is preparing an explanation…</div>}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 20 }}><input value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => event.key === "Enter" && send()} placeholder="Ask ADAPT a question…" style={{ flex: 1, background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px", color: "var(--text)", outline: "none" }} /><button className="btn btn-primary" onClick={send} disabled={busy || !input.trim()}><Send size={14} /></button></div>
        <Link className="btn" style={{ marginTop: 12 }} to="/onboarding" onClick={buildCourse}><Plus size={13} /> Build a course from this</Link>
      </section>
      <aside className="card card-pad"><div className="eyebrow">LEARNER CONTEXT</div><h3 style={{ marginTop: 7, fontSize: 16 }}>{course ? course.title : "No course selected"}</h3>{course ? <><div className="mini" style={{ marginTop: 10 }}>Current topic: {topic?.name || "Not selected"}</div><div className="mini" style={{ marginTop: 6 }}>Assessment: {context.assessment ? `${context.assessment.level}, ${context.assessment.accuracy}%` : "Not completed"}</div><div style={{ marginTop: 14 }}><Link className="btn" to="/course">Open Course</Link></div></> : <p className="mini" style={{ lineHeight: 1.6, marginTop: 9 }}>Tutor is available without creating a course. If you want a structured learning path, choose “Build a course from this.”</p>}</aside>
    </div>
  </div></AppShell>;
}
