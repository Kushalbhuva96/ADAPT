import React, { useEffect, useState } from "react";
import { ArrowRight, BrainCircuit, FlaskConical, Play, Target } from "lucide-react";
import { Link } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import Ring from "../components/ui/Ring";
import { api } from "../services/api";
import { user } from "../data/mock";
import { getActiveCourse } from "../utils/courseState";
import { topics } from "../data/mock";

export default function Dashboard() {
  const [data, setData] = useState(null);
  const activeCourse = getActiveCourse();
  const assessment = activeCourse?.assessment?.result;
  const recommendedTopic = topics.find((topic) => topic.id === (activeCourse?.activeTopicId || assessment?.recommendedTopicId || activeCourse?.recommendedTopicId || activeCourse?.selectedTopicId));

  useEffect(() => {
    api.dashboard(user.id).then(setData);
  }, []);

  if (!data) {
    return (
      <AppShell breadcrumb="HOME">
        <div className="page">
          <div className="card card-pad">ADAPT is thinking...</div>
        </div>
      </AppShell>
    );
  }

  const streak = data.momentum.streakDays + " days";
  const accuracy = data.momentum.weeklyAccuracy + "%";
  const improvement = "+" + data.momentum.weeklyImprovement + "%";

  return (
    <AppShell breadcrumb="HOME">
      <div className="page">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 20 }}>
          <div>
            <div className="eyebrow">PERSONAL LEARNING OS</div>
            <h1 className="page-title" style={{ marginTop: 8 }}>Good evening, {data.user.name}.</h1>
            <p className="page-subtitle">Your learning system has a recommendation ready.</p>
          </div>
          <Link className="btn btn-primary" to="/lab"><Play size={14} /> Watch ADAPT adapt</Link>
        </div>

        <div className="card card-pad glow hero-panel" style={{ marginTop: 25 }}>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 25, alignItems: "center" }}>
            <Ring value={data.learningHealth.score} label="learning health" />
            <div>
              <div className="eyebrow">AI PRIORITY</div>
              <h2 style={{ fontSize: 25, marginTop: 7 }}>{activeCourse ? `${activeCourse.subject.name}: ${recommendedTopic?.name || "Ready to learn"}` : data.recommendation.title}</h2>
              <p className="mini" style={{ lineHeight: 1.7, marginTop: 8 }}>{activeCourse ? assessment?.explanation || `Continue your ${activeCourse.subject.name} course from the selected topic.` : data.aiInsight}</p>
              <Link className="btn btn-primary" style={{ marginTop: 15 }} to={activeCourse ? (assessment ? "/practice" : "/course") : "/practice"}>{assessment ? "Continue course" : "Open my courses"} <ArrowRight size={14} /></Link>
            </div>
            <div className="status-pill"><span className="signal-dot" /> {data.learningHealth.weeklyChange}% this week</div>
          </div>
        </div>

        <div className="grid grid-4" style={{ marginTop: 15 }}>
          <div className="card metric"><div className="metric-label">STREAK</div><div className="metric-value">{streak}</div></div>
          <div className="card metric"><div className="metric-label">QUESTIONS</div><div className="metric-value">{data.momentum.questionsAnswered}</div></div>
          <div className="card metric"><div className="metric-label">ACCURACY</div><div className="metric-value">{accuracy}</div></div>
          <div className="card metric"><div className="metric-label">IMPROVEMENT</div><div className="metric-value">{improvement}</div></div>
        </div>

        <div className="grid grid-2" style={{ marginTop: 15 }}>
          <div className="card card-pad">
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div><div className="eyebrow">{assessment ? "RECOMMENDED TOPIC" : "WEAK AREA"}</div><h2 style={{ fontSize: 22, marginTop: 7 }}>{assessment ? `${recommendedTopic?.name || assessment.recommendedTopic} · ${assessment.level}` : "Deadlocks · 42%"}</h2></div>
              <Target color="var(--warning)" />
            </div>
            <div className="progress-line" style={{ marginTop: 18 }}><span style={{ width: "42%" }} /></div>
            <p className="mini" style={{ marginTop: 10 }}>{assessment?.explanation || "ADAPT recommends this topic based on the current course learning signals."}</p>
            <Link className="btn" style={{ marginTop: 14 }} to={activeCourse ? "/course" : "/practice"}>View course topic <ArrowRight size={14} /></Link>
          </div>

          <div className="card card-pad">
            <div className="eyebrow">AI INSIGHT</div>
            <h2 style={{ fontSize: 22, marginTop: 7 }}>Your learning loop is active.</h2>
            <div className="decision-stack" style={{ marginTop: 16 }}>
              <div className="decision-row"><span className="signal-dot" /><div><div className="tiny">YOU ACT</div><div style={{ fontSize: 10, marginTop: 3 }}>Answer questions</div></div><ArrowRight size={13} /></div>
              <div className="decision-row"><span className="signal-dot" /><div><div className="tiny">ADAPT UNDERSTANDS</div><div style={{ fontSize: 10, marginTop: 3 }}>Detect patterns</div></div><ArrowRight size={13} /></div>
              <div className="decision-row"><span className="signal-dot" /><div><div className="tiny">ADAPT DECIDES</div><div style={{ fontSize: 10, marginTop: 3 }}>Change difficulty</div></div><ArrowRight size={13} /></div>
              <div className="decision-row"><span className="signal-dot success" /><div><div className="tiny">YOU IMPROVE</div><div style={{ fontSize: 10, marginTop: 3 }}>Master the gap</div></div><ArrowRight size={13} /></div>
            </div>
          </div>
        </div>

        <div className="insight" style={{ marginTop: 15 }}>
          <BrainCircuit size={16} />
          <div>
            <div className="eyebrow">HACKATHON MOMENT</div>
            <div className="mini" style={{ marginTop: 5 }}>Show judges the difference between a static quiz and ADAPT: answer → explain why → change strategy → improve.</div>
          </div>
          <Link className="btn" style={{ marginLeft: "auto" }} to="/lab">Open Lab <FlaskConical size={14} /></Link>
        </div>
      </div>
    </AppShell>
  );
}
