import React, { useEffect, useState } from "react";
import { ArrowRight, BookOpen, CheckCircle2, Circle, Plus } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import { api } from "../services/api";
import { getRecommendationExplanation } from "../utils/assessment";
import { removeCourseFromLocal } from "../utils/courseState";

function getSubjectAccent(subject = {}) {
  const subjectKey = `${subject.id || ""} ${subject.name || ""}`.toLowerCase();
  if (/database|dbms|sql/.test(subjectKey)) return "var(--subject-database)";
  if (/network|computer network/.test(subjectKey)) return "var(--subject-networks)";
  if (/software engineering/.test(subjectKey)) return "var(--subject-software)";
  if (/math|calculus|algebra/.test(subjectKey)) return "var(--subject-math)";
  if (/data structure|algorithm|dsa/.test(subjectKey)) return "var(--subject-dsa)";
  if (/program|coding|python|javascript|web development/.test(subjectKey)) return "var(--subject-programming)";
  if (/artificial intelligence|machine learning|ai/.test(subjectKey)) return "var(--subject-ai)";
  return "var(--subject-os)";
}

export default function Course() {
  const [courses, setCourses] = useState([]);
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyTopic, setBusyTopic] = useState(false);
  const [deletingCourse, setDeletingCourse] = useState(false);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const [list, dashboard] = await Promise.all([api.courses(), api.dashboard()]);
      setCourses(list);
      const preferredId = dashboard.activeCourseId || localStorage.getItem("adapt_active_course_id");
      const selected = list.find((item) => item.id === preferredId) || list.find((item) => item.id === dashboard.activeCourseId) || list[0] || null;
      setCourse(selected);
      if (selected) localStorage.setItem("adapt_active_course_id", selected.id);
      setError("");
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openCourse = async (id) => {
    try {
      const result = await api.activateCourse(id);
      localStorage.setItem("adapt_active_course_id", result.activeCourseId);
      await load();
    } catch (err) { setError(err.message); }
  };

  const startTopic = async (topicId) => {
    if (!course) return;
    const topic = course.topics.find((item) => item.id === topicId);
    if (!topic) return;
    const unlocked = ["UNLOCKED", "LEARNING", "NEEDS_IMPROVEMENT", "STRONG"].includes(topic.learningState);
    if (!unlocked) {
      navigate(`/assessment?topicId=${encodeURIComponent(topicId)}`);
      return;
    }
    setBusyTopic(true);
    try {
      await api.activateTopic(course.id, topicId);
      navigate("/practice");
    } catch (err) { setError(err.message); }
    finally { setBusyTopic(false); }
  };

  const deleteCurrentCourse = async () => {
    if (!course || deletingCourse || !window.confirm(`Delete “${course.title}”? This removes the saved course from your account.`)) return;
    setDeletingCourse(true);
    setError("");
    try {
      await api.deleteCourse(course.id);
      removeCourseFromLocal(course.id);
      await load();
    } catch (err) { setError(err.message || "Could not delete this course."); }
    finally { setDeletingCourse(false); }
  };

  const content = loading ? <div className="card card-pad">Loading your saved courses…</div>
    : error && !course ? <div className="form-error" role="alert">{error}</div>
    : !course ? <div className="card card-pad"><h1 className="page-title">You haven't created a course yet.</h1><p className="page-subtitle" style={{ marginTop: 8 }}>When you're ready, tell ADAPT what you want to learn. Course creation is optional.</p><Link className="btn btn-primary" style={{ marginTop: 16 }} to="/onboarding">Create a course <Plus size={14} /></Link></div>
    : (() => {
      const status = course.assessmentStatus || "NOT_STARTED";
      const result = course.assessmentResult;
      const recommendedId = course.activeTopicId || course.recommendedTopicId || result?.recommendedTopicId;
      const recommended = course.topics.find((topic) => topic.id === recommendedId);
      return <>
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="flex-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 15 }}>
          <div><div className="eyebrow">YOUR COURSE{courses.length > 1 ? ` · ${courses.length} SAVED` : ""}</div><h1 className="page-title" style={{ marginTop: 8 }}>{course.title}</h1><p className="page-subtitle">Generated from: “{course.learningRequest}”</p></div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button type="button" className="btn" onClick={deleteCurrentCourse} disabled={deletingCourse}>{deletingCourse ? "Deleting…" : "Delete Course"}</button><Link className="btn" to="/onboarding?intent=learn"><Plus size={14} /> Create New Course</Link></div>
        </div>

        {courses.length > 1 && <div className="grid grid-3" style={{ marginTop: 16 }}>{courses.map((item) => <button key={item.id} className={`card card-pad ${item.id === course.id ? "glow" : ""}`} style={{ textAlign: "left", color: "inherit" }} onClick={() => openCourse(item.id)}><div className="tiny">{item.id === course.id ? "CURRENT COURSE" : "OPEN COURSE"}</div><strong style={{ display: "block", marginTop: 6 }}>{item.title}</strong><span className="mini" style={{ display: "block", marginTop: 5 }}>{item.assessmentStatus === "COMPLETED" ? "Assessment complete" : item.assessmentStatus === "IN_PROGRESS" ? "Assessment in progress" : "Assessment not started"}</span></button>)}</div>}

        <section className="card card-pad glow" style={{ marginTop: 20 }}>
          <div className="eyebrow">{status === "COMPLETED" ? "ASSESSMENT RESULT" : status === "IN_PROGRESS" ? "ASSESSMENT IN PROGRESS" : "COURSE SETUP"}</div>
          {status === "COMPLETED" && result ? <>
            <h2 style={{ fontSize: 23, marginTop: 8 }}>Recommended starting point: {recommended?.name || result.recommendedTopic}</h2>
            <p className="mini" style={{ marginTop: 7, lineHeight: 1.7 }}>{getRecommendationExplanation(result)}</p>
            <div className="mini" style={{ marginTop: 10 }}>Level: {result.level} · Strengths: {result.strengths.length ? result.strengths.join(", ") : "Still forming"} · Areas to work on: {result.weaknesses.length ? result.weaknesses.join(", ") : "No assessed gaps"}</div>
            <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={() => startTopic(recommended?.id || course.activeTopicId || course.topics[0]?.id)} disabled={busyTopic}>Start Learning <ArrowRight size={14} /></button>
          </> : <>
            <h2 style={{ fontSize: 23, marginTop: 8 }}>{status === "IN_PROGRESS" ? "Resume your level assessment" : "Take a level assessment when you're ready"}</h2>
            <p className="mini" style={{ marginTop: 7, lineHeight: 1.7 }}>ADAPT will ask questions about this course and recommend a starting topic from your answers. You can explore the course topics any time.</p>
            <Link className="btn btn-primary" style={{ marginTop: 14 }} to="/assessment">{status === "IN_PROGRESS" ? "Resume Assessment" : "Take Level Assessment"} <ArrowRight size={14} /></Link>
          </>}
        </section>

        <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 24 }}><BookOpen size={17} /><h2 style={{ fontSize: 20 }}>Topics and modules</h2></div>
        <div className="grid grid-2" style={{ marginTop: 13 }}>{course.topics.map((topic) => {
          const isRecommended = topic.id === recommendedId;
          const assessed = topic.attempts > 0 || (result?.topicPerformance || []).some((item) => item.topicId === topic.id && item.total > 0);
          const performance = result?.topicPerformance?.find((item) => item.topicId === topic.id);
          const progress = topic.mastery ?? performance?.accuracy ?? 0;
          return <article className="card card-pad topic-card" style={{ "--subject-accent": getSubjectAccent(course.subject) }} key={topic.id}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}><span className="topic-marker">{topic.status === "mastered" ? <CheckCircle2 size={17} /> : <Circle size={17} />}</span>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}><strong>{topic.name}</strong><span className={`badge ${isRecommended && status === "COMPLETED" ? "recommended" : ""}`}>{(topic.learningState || "LOCKED").replaceAll("_", " ")}{isRecommended && status === "COMPLETED" ? " · RECOMMENDED" : ""}</span></div>
                <p className="mini" style={{ marginTop: 6 }}>{topic.description}</p>
                <div className="progress-line" style={{ marginTop: 12 }}><span style={{ width: `${assessed ? progress : 0}%` }} /></div>
                <div className="tiny" style={{ marginTop: 7 }}>{assessed ? `${progress}% mastery · ${topic.attempts || performance?.total || 0} assessment/practice attempts` : "Not assessed yet"}</div>
                <button className="btn" style={{ marginTop: 11 }} onClick={() => startTopic(topic.id)} disabled={busyTopic}>{["UNLOCKED", "LEARNING", "NEEDS_IMPROVEMENT", "STRONG"].includes(topic.learningState) ? topic.learningState === "LEARNING" ? "Continue Topic" : "Start Learning" : topic.learningState === "ASSESSMENT_IN_PROGRESS" ? "Continue Assessment" : "Explore Topic"} <ArrowRight size={13} /></button>
              </div>
            </div>
          </article>;
        })}</div>
        <div className="grid grid-3" style={{ marginTop: 17 }}><Link className="card card-pad" to="/tutor"><div className="eyebrow">TUTOR</div><div style={{ marginTop: 7 }}>Ask ADAPT about this course <ArrowRight size={13} /></div></Link><Link className="card card-pad" to="/practice"><div className="eyebrow">CHALLENGE ME</div><div style={{ marginTop: 7 }}>Practice your active topic <ArrowRight size={13} /></div></Link><Link className="card card-pad" to="/progress"><div className="eyebrow">PROGRESS</div><div style={{ marginTop: 7 }}>Review saved progress <ArrowRight size={13} /></div></Link></div>
      </>;
    })();

  return <AppShell breadcrumb="COURSE"><div className="page">{content}</div></AppShell>;
}
