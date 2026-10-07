import React, { useEffect, useState } from "react";
import { ArrowRight, BrainCircuit } from "lucide-react";
import { Link } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import { api } from "../services/api";

export default function LearningDNA() {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { api.profile().then(setProfile).catch((err) => setError(err.message)); }, []);
  return <AppShell breadcrumb="LEARNING DNA"><div className="page">
    <div className="eyebrow">PERSONAL LEARNING MODEL</div><h1 className="page-title" style={{ marginTop: 8 }}>Your Learning DNA</h1><p className="page-subtitle">ADAPT builds this profile from your course assessment and saved practice history.</p>
    {error && <div className="form-error" role="alert" style={{ marginTop: 18 }}>{error}</div>}
    {!profile && !error && <div className="card card-pad" style={{ marginTop: 20 }}>Loading your learner model…</div>}
    {profile && !profile.hasLearningData && <div className="card card-pad glow" style={{ marginTop: 20 }}><BrainCircuit size={22} color="var(--lavender)" /><h2 style={{ fontSize: 20, marginTop: 12 }}>Your Learning DNA is forming.</h2><p className="mini" style={{ marginTop: 7 }}>Complete your first assessment and practice sessions to build your learner model. No learning pattern has been inferred yet.</p><Link className="btn btn-primary" style={{ marginTop: 14 }} to={profile.course ? "/assessment" : "/course"}>{profile.course ? "Take Level Assessment" : "Open Course"} <ArrowRight size={14} /></Link></div>}
    {profile?.hasLearningData && <>
      <div className="grid grid-2" style={{ marginTop: 22 }}>
        <section className="card card-pad"><div className="eyebrow">CURRENT LEARNER STATE</div><h2 className="section-title" style={{ marginTop: 7 }}>{profile.course?.title || "Learning profile"}</h2><div className="mini" style={{ marginTop: 8 }}>Level: {profile.assessment?.level || profile.adaptiveLevel || "Still forming"}</div>{profile.assessment && <><div className="mini" style={{ marginTop: 6 }}>Assessment result: {profile.assessment.accuracy}% across {profile.assessment.total} questions</div><div className="mini" style={{ marginTop: 8 }}>Strengths: {profile.assessment.strengths.length ? profile.assessment.strengths.join(", ") : "No clear strengths identified yet"}</div><div className="mini" style={{ marginTop: 5 }}>Areas to work on: {profile.assessment.weaknesses.length ? profile.assessment.weaknesses.join(", ") : "No assessed gaps"}</div></>}</section>
        <section className="card card-pad"><div className="eyebrow">LEARNING SIGNALS</div><h2 className="section-title" style={{ marginTop: 7 }}>Observed activity</h2><div className="mini" style={{ marginTop: 9 }}>Practice attempts: {profile.practiceAttempts}</div><div className="mini" style={{ marginTop: 6 }}>Saved course: {profile.course?.title || "No active course"}</div><p className="mini" style={{ marginTop: 10, lineHeight: 1.6 }}>ADAPT will only show behavior patterns when the saved learning history supports them.</p></section>
      </div>
      <section className="card card-pad dna-flow" aria-label="How learning activity informs your personalized learning">
        <div className="eyebrow">HOW YOUR MODEL GUIDES LEARNING</div>
        <div className="dna-flow-track">
          <div className="dna-flow-node"><span className="dna-flow-icon"><BrainCircuit size={17}/></span><strong>Your learning data</strong><span>{profile.assessment ? `${profile.assessment.total} assessment answers` : `${profile.practiceAttempts} practice attempts`}</span></div>
          <div className="dna-flow-link" aria-hidden="true"><i/><i/><i/></div>
          <div className="dna-flow-node"><span className="dna-flow-icon"><span className="dna-flow-pulse"/></span><strong>Observed patterns</strong><span>{profile.assessment ? `${profile.assessment.accuracy}% assessment accuracy` : `${profile.practiceAttempts} saved practice attempts`}</span></div>
          <div className="dna-flow-link" aria-hidden="true"><i/><i/><i/></div>
          <div className="dna-flow-node"><span className="dna-flow-icon"><ArrowRight size={17}/></span><strong>Adapted next step</strong><span>{profile.assessment?.recommendedTopic || profile.course?.title || "Build more learning history"}</span></div>
        </div>
        <p className="tiny" style={{ marginTop: 14 }}>The model reflects saved assessment and practice records. It does not infer a pattern when the history is too small.</p>
      </section>
      <section className="card card-pad" style={{ marginTop: 16 }}><div className="eyebrow">COURSE KNOWLEDGE MAP</div><h2 className="section-title" style={{ marginTop: 7 }}>{profile.course?.title || "Current course"}</h2><div style={{ marginTop: 12, display: "grid", gap: 13 }}>{profile.topicMastery.map((topic) => <div key={topic.topicId}><div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><strong>{topic.topicName}</strong><span>{topic.score == null ? "Not assessed" : `${topic.score}%`}</span></div><div className="progress-line" style={{ marginTop: 7 }}><span style={{ width: `${topic.score ?? 0}%` }} /></div>{topic.attempts > 0 && <div className="tiny" style={{ marginTop: 5 }}>{topic.attempts} recorded attempts · {topic.accuracy}% accuracy</div>}</div>)}</div></section>
      <div className="grid grid-2" style={{ marginTop: 16 }}><Link className="card card-pad" to="/progress"><div className="eyebrow">PROGRESS</div><div style={{ marginTop: 7 }}>Review saved results <ArrowRight size={13} /></div></Link><Link className="card card-pad" to="/study-plan"><div className="eyebrow">STUDY PLAN</div><div style={{ marginTop: 7 }}>Open your current plan <ArrowRight size={13} /></div></Link></div>
    </>}
  </div></AppShell>;
}
