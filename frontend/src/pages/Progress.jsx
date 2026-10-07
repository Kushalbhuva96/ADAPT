import React, { useEffect, useState } from "react";
import AppShell from "../components/layout/AppShell";
import { api } from "../services/api";

export default function Progress() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { api.progress().then(setData).catch((err) => setError(err.message)); }, []);

  return <AppShell breadcrumb="PROGRESS"><div className="page">
    <div className="eyebrow">SAVED LEARNING DATA</div><h1 className="page-title" style={{ marginTop: 8 }}>Your Progress</h1><p className="page-subtitle">Progress updates as ADAPT records assessment answers and practice sessions.</p>
    {error && <div className="form-error" role="alert" style={{ marginTop: 18 }}>{error}</div>}
    {!data && !error && <div className="card card-pad" style={{ marginTop: 20 }}>Loading saved progress…</div>}
    {data && !data.hasLearningHistory && <div className="card card-pad glow" style={{ marginTop: 20 }}><h2 style={{ fontSize: 20 }}>No progress yet.</h2><p className="mini" style={{ marginTop: 7 }}>Complete a course assessment or answer practice questions to begin building your progress history.</p></div>}
    {data?.hasLearningHistory && <>
      <div className="grid grid-4" style={{ marginTop: 22 }}>
        <div className="card metric"><div className="metric-label">OVERALL LEARNING SCORE</div><div className="metric-value">{data.overall.current ?? "—"}{data.overall.current != null ? "%" : ""}</div></div>
        <div className="card metric"><div className="metric-label">PRACTICE ANSWERS</div><div className="metric-value">{data.statistics.questionsCompleted}</div></div>
        <div className="card metric"><div className="metric-label">PRACTICE ACCURACY</div><div className="metric-value">{data.statistics.accuracy == null ? "—" : `${data.statistics.accuracy}%`}</div></div>
        <div className="card metric"><div className="metric-label">PRACTICE TIME</div><div className="metric-value">{data.statistics.learningMinutes} min</div></div>
      </div>
      <section className="card card-pad" style={{ marginTop: 16 }}><div className="eyebrow">TOPIC MASTERY</div><div style={{ marginTop: 12, display: "grid", gap: 12 }}>
        {data.topicProgress.length ? data.topicProgress.map((topic) => <div key={topic.topicId}><div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><strong>{topic.name}</strong><span>{topic.current}%</span></div><div className="progress-line" style={{ marginTop: 7 }}><span style={{ width: `${topic.current}%` }} /></div><div className="tiny" style={{ marginTop: 5 }}>{topic.attempts} recorded attempts{topic.accuracy != null ? ` · ${topic.accuracy}% accuracy` : ""}</div></div>) : <p className="mini">ADAPT has saved your assessment result. Topic practice history will appear here as you learn.</p>}
      </div></section>
      <div className="mini" style={{ marginTop: 12 }}>Completed assessments: {data.statistics.assessmentCount}{data.overall.change != null ? ` · Score change since previous record: ${data.overall.change > 0 ? "+" : ""}${data.overall.change}%` : ""}</div>
    </>}
  </div></AppShell>;
}
