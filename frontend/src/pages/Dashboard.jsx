import React, { useEffect, useState } from "react";
import { ArrowRight, BookOpen, BrainCircuit, MessageCircle, Target } from "lucide-react";
import { Link } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import { api } from "../services/api";

const entryPoints = [
  { title: "TUTOR", text: "Ask ADAPT anything you are trying to understand.", to: "/tutor", icon: MessageCircle },
  { title: "START LEARNING", text: "Tell ADAPT what you want to learn and build a course.", to: "/onboarding", icon: BookOpen },
  { title: "CHALLENGE ME", text: "Test yourself and discover where you can improve.", to: "/practice", icon: Target },
  { title: "LEARNING DNA", text: "Your learner model will form as you learn.", to: "/learning-dna", icon: BrainCircuit },
];

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { api.dashboard().then(setData).catch((err) => setError(err.message)); }, []);

  return <AppShell breadcrumb="DASHBOARD">
    <div className="page">
      <div className="eyebrow">PERSONAL LEARNING OS</div>
      <h1 className="page-title" style={{ marginTop: 8 }}>{data?.course ? `Welcome back, ${data.user.name}.` : "Your learning system is ready."}</h1>
      <p className="page-subtitle">{data?.course ? "Choose where you want to continue. ADAPT will use your saved course and learning signals." : "Choose what you want to do. ADAPT will adapt around you as you learn."}</p>

      {error && <div className="form-error" role="alert" style={{ marginTop: 18 }}>{error}</div>}
      {!data && !error && <div className="card card-pad" style={{ marginTop: 20 }}>Loading your saved learning data…</div>}

      {data?.course && <section className="card card-pad glow" style={{ marginTop: 24 }}>
        <div className="eyebrow">CURRENT COURSE</div>
        <h2 style={{ fontSize: 25, marginTop: 8 }}>{data.course.title}</h2>
        <p className="mini" style={{ marginTop: 7, lineHeight: 1.7 }}>
          {data.assessment
          ? `AI priority: ${data.course.topics.find((topic) => topic.id === (data.course.activeTopicId || data.recommendation?.topicId || data.assessment.recommendedTopicId))?.name || data.recommendation?.title || data.assessment.recommendedTopic}`
            : "Your course is ready. Complete its level assessment when you want a personalized starting point."}
        </p>
        <Link className="btn btn-primary" style={{ marginTop: 16 }} to="/course">{data.assessment ? "Continue Learning" : "Open Course"} <ArrowRight size={14} /></Link>
      </section>}

      {data?.hasLearningHistory && <div className="grid grid-3" style={{ marginTop: 14 }}>
        {data.learningHealth?.score != null && <div className="card metric"><div className="metric-label">SAVED LEARNING SCORE</div><div className="metric-value">{data.learningHealth.score}%</div></div>}
        <div className="card metric"><div className="metric-label">PRACTICE ANSWERS</div><div className="metric-value">{data.momentum.questionsAnswered}</div></div>
        {data.momentum.weeklyAccuracy != null && <div className="card metric"><div className="metric-label">PRACTICE ACCURACY</div><div className="metric-value">{data.momentum.weeklyAccuracy}%</div></div>}
      </div>}

      <div className="grid grid-2" style={{ marginTop: 18 }}>
        {entryPoints.map(({ title, text, to, icon: Icon }) => <Link className="card card-pad card-hover" key={title} to={to} style={{ color: "inherit", textDecoration: "none" }}>
          <Icon size={19} color="var(--lavender)" />
          <div className="eyebrow" style={{ marginTop: 14 }}>{title}</div>
          <p className="mini" style={{ lineHeight: 1.7, marginTop: 7 }}>{text}</p>
          <span className="btn" style={{ marginTop: 13 }}>Open <ArrowRight size={13} /></span>
        </Link>)}
      </div>
      {data && !data.course && <div className="card card-pad" style={{ marginTop: 16 }}>
        <div className="eyebrow">YOUR LEARNING DNA</div>
        <h2 style={{ fontSize: 18, marginTop: 7 }}>Your learning profile will form as you learn.</h2>
        <p className="mini" style={{ marginTop: 6 }}>Create a course and complete an assessment to start building your saved learner model.</p>
      </div>}
    </div>
  </AppShell>;
}
