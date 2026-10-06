import React, { useState } from "react";
import { ArrowRight, BookOpen, CheckCircle2, Circle, Plus } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import { topics } from "../data/mock";
import { activateCourse, getActiveCourse, getCourses, saveCourse } from "../utils/courseState";

export default function Course() {
  const [courses, setCourses] = useState(getCourses);
  const [course, setCourse] = useState(getActiveCourse);
  const navigate = useNavigate();
  const openCourse = (id) => { const next = activateCourse(id); if (next) { setCourse(next); setCourses(getCourses()); } };
  const chooseTopic = (topicId) => {
    const next = saveCourse({ ...course, selectedTopicId: topicId, activeTopicId: topicId });
    setCourse(next); setCourses(getCourses());
    navigate("/practice");
  };

  if (!course) return <AppShell breadcrumb="MY COURSES"><div className="page"><div className="card card-pad"><h1 className="page-title">Your course library is ready.</h1><p className="page-subtitle">Add a subject to create your first course.</p><Link className="btn btn-primary" style={{ marginTop: 15 }} to="/onboarding">Add a course <Plus size={14} /></Link></div></div></AppShell>;
  const assessment = course.assessment || (localStorage.getItem("adapt_active_course_id") === course.id ? JSON.parse(localStorage.getItem("adapt_assessment") || "null") : null);
  const result = assessment?.result;
  const courseTopics = course.topics?.length ? course.topics : topics.filter((topic) => topic.subjectId === course.subject.id);
  const performance = new Map((result?.topicPerformance || []).map((item) => [item.topicId, item]));
  const recommended = result?.recommendedTopicId || course.recommendedTopicId || course.selectedTopicId;

  return <AppShell breadcrumb="MY COURSES"><div className="page">
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 15 }}><div><div className="eyebrow">YOUR COURSE LIBRARY · {courses.length || 1} COURSE{(courses.length || 1) === 1 ? "" : "S"}</div><h1 className="page-title" style={{ marginTop: 8 }}>{course.subject.name}</h1><p className="page-subtitle">{result ? `${result.level} learner · Personalized from your diagnostic` : "Course created · Complete the diagnostic to personalize your learning path"}</p></div><Link className="btn" to="/onboarding"><Plus size={14} /> Add course</Link></div>

    {courses.length > 1 && <div className="grid grid-3" style={{ marginTop: 18 }}>{courses.map((item) => <button key={item.id} className={`card card-pad ${item.id === course.id ? "glow" : ""}`} style={{ textAlign: "left", color: "inherit" }} onClick={() => openCourse(item.id)}><div className="tiny">{item.id === course.id ? "ACTIVE COURSE" : "OPEN COURSE"}</div><strong style={{ display: "block", marginTop: 6 }}>{item.subject.name}</strong><span className="mini" style={{ display: "block", marginTop: 5 }}>{item.assessment?.result?.level || "Diagnostic pending"}</span></button>)}</div>}

    <div className="card card-pad glow" style={{ marginTop: 22 }}><div className="eyebrow">{result ? "PERSONALIZED STARTING POINT" : "COURSE SETUP"}</div><h2 style={{ fontSize: 24, marginTop: 8 }}>{result?.recommendedTopic || courseTopics.find((topic) => topic.id === course.selectedTopicId)?.name || "Choose your starting topic"}</h2><p className="mini" style={{ marginTop: 8, lineHeight: 1.7 }}>{result?.explanation || "Your subject is saved as a course. Choose a topic and take the short diagnostic so ADAPT can recommend where to begin."}</p>{!result && (course.selectedTopicId ? <Link className="btn btn-primary" style={{ marginTop: 14 }} to="/assessment">Take diagnostic <ArrowRight size={14} /></Link> : <Link className="btn btn-primary" style={{ marginTop: 14 }} to="/onboarding">Choose a topic <ArrowRight size={14} /></Link>)}{result && <Link className="btn btn-primary" style={{ marginTop: 14 }} to="/practice">Continue learning <ArrowRight size={14} /></Link>}</div>

    <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 25 }}><BookOpen size={17} /><h2 style={{ fontSize: 20 }}>Topics and modules</h2></div>
    <div className="grid grid-2" style={{ marginTop: 13 }}>{courseTopics.map((topic) => { const assessed = performance.get(topic.id); const familiar = assessed?.accuracy >= 70; const isRecommended = topic.id === recommended; return <div className="card card-pad" key={topic.id}><div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>{familiar ? <CheckCircle2 color="var(--success)" size={17} /> : <Circle color="var(--muted)" size={17} />}<div style={{ flex: 1 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><strong>{topic.name}</strong>{isRecommended && <span className="badge">RECOMMENDED</span>}</div><p className="mini" style={{ marginTop: 6 }}>{topic.description}</p><div className="progress-line" style={{ marginTop: 12 }}><span style={{ width: `${assessed?.accuracy ?? 0}%` }} /></div><div className="tiny" style={{ marginTop: 7 }}>{assessed ? `${assessed.accuracy}% diagnostic · ${assessed.correct}/${assessed.total} correct` : "Not assessed yet · Ready to learn"}</div><button className="btn" style={{ marginTop: 11 }} onClick={() => chooseTopic(topic.id)}>{isRecommended ? "Start recommended topic" : "Open topic"} <ArrowRight size={13} /></button></div></div></div>; })}</div>

    <div className="grid grid-3" style={{ marginTop: 17 }}><Link className="card card-pad" to="/tutor"><div className="eyebrow">LEARN</div><div style={{ marginTop: 7 }}>Get a guided explanation <ArrowRight size={13} /></div></Link><Link className="card card-pad" to="/practice"><div className="eyebrow">PRACTICE</div><div style={{ marginTop: 7 }}>Try adaptive questions <ArrowRight size={13} /></div></Link><Link className="card card-pad" to="/progress"><div className="eyebrow">PROGRESS</div><div style={{ marginTop: 7 }}>Review your learning <ArrowRight size={13} /></div></Link></div>
  </div></AppShell>;
}
