import React from "react";
import { ArrowRight, CircleDot, Sparkles } from "lucide-react";
import AppShell from "../components/layout/AppShell";
import Insight from "../components/ui/Insight";
import { learningProfile } from "../data/mock";

export default function LearningDNA() {
  const p = learningProfile;
  const behaviors = [
    ["Concept Understanding", p.learningBehavior.conceptUnderstanding],
    ["Application", p.learningBehavior.application],
    ["Recall", p.learningBehavior.recall],
    ["Problem Solving", p.learningBehavior.problemSolving],
  ];

  const missionSteps = [
    ["Review Deadlock Conditions", 5],
    ["Learn Banker's Algorithm", 8],
    ["Practice 3 Questions", 5],
    ["Quick Recall", 2],
  ];

  return (
    <AppShell breadcrumb="LEARN">
      <div className="page">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end" }}>
          <div>
            <div className="eyebrow">PERSONAL INTELLIGENCE MODEL</div>
            <h1 className="page-title" style={{ marginTop: 8 }}>Your Learning DNA</h1>
            <p className="page-subtitle">
              ADAPT learns how you learn — then rebuilds the path around you.
            </p>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}><span className="badge">ADAPTIVE LEVEL · MEDIUM</span><a href="/lab" className="btn"><Sparkles size={13}/> Explore Learning Twin</a></div>
        </div>

        <div className="grid grid-2" style={{ marginTop: 24 }}>
          <div className="card card-pad knowledge-map">
            <div className="eyebrow">KNOWLEDGE MAP</div>
            <div className="mini">Operating Systems · Live model</div>

            <div className="map-center">
              <div style={{ textAlign: "center" }}>
                <CircleDot size={18} color="#C8A8FF" />
                <div className="tiny">LEARNING<br />CORE</div>
              </div>
            </div>

            <div className="map-line l1" />
            <div className="map-line l2" />
            <div className="map-line l3" />
            <div className="map-line l4" />

            <div className="map-node mn1"><span>82%</span><small>Processes</small></div>
            <div className="map-node mn2"><span>74%</span><small>Scheduling</small></div>
            <div className="map-node mn3"><span>58%</span><small>Synchronization</small></div>
            <div className="map-node mn4"><span>63%</span><small>Memory</small></div>
            <div className="map-node mn5"><span>42%</span><small>Deadlocks</small></div>
          </div>

          <div>
            <div className="card card-pad">
              <div className="eyebrow">LEARNING BEHAVIOR</div>
              <h2 className="section-title" style={{ marginTop: 7 }}>
                How your mind is responding
              </h2>

              {behaviors.map(([label, value]) => (
                <div className="behavior-row" key={label}>
                  <div className="behavior-head">
                    <span>{label}</span>
                    <span>{value}%</span>
                  </div>
                  <div className="progress-line">
                    <span style={{ width: `${value}%` }} />
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 14 }}>
              <Insight title="AI OBSERVATION">
                {p.learningBehavior.conceptUnderstanding > p.learningBehavior.application
                  ? "Your accuracy is high on conceptual questions but drops on application-based problems."
                  : "ADAPT is balancing your next practice set."}
              </Insight>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 28 }}>
          <div className="eyebrow">LEARNING PREFERENCES</div>
          <h2 className="section-title" style={{ marginTop: 7 }}>
            Your highest-response patterns
          </h2>
        </div>

        <div className="grid grid-3" style={{ marginTop: 12 }}>
          {["Real-world examples", "Short explanations", "Practice first"].map((item, index) => (
            <div className="card card-pad card-hover" key={item}>
              <div className="tiny">0{index + 1}</div>
              <h3 style={{ fontSize: 12, marginTop: 8 }}>{item}</h3>
              <div className="mini" style={{ marginTop: 6 }}>
                {index === 0 ? "Strongest response signal" : "Observed in recent sessions"}
              </div>
            </div>
          ))}
        </div>

        <div className="card card-pad" style={{ marginTop: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div className="eyebrow">TODAY'S AI LEARNING MISSION</div>
              <h2 className="section-title" style={{ marginTop: 7 }}>Deadlock recovery sprint</h2>
            </div>
            <div style={{ fontFamily: "Space Grotesk", fontSize: 28 }}>
              20<span className="mini"> MINUTES</span>
            </div>
          </div>

          <div className="timeline">
            <div className="timeline-grid">
              {missionSteps.map(([title, minutes], index) => (
                <div key={title}>
                  <div className="step-dot">{String(index + 1).padStart(2, "0")}</div>
                  <div style={{ fontSize: 9 }}>{title}</div>
                  <div className="mini">{minutes} min</div>
                </div>
              ))}
            </div>
          </div>

          <a href="/practice" className="btn btn-primary" style={{ float: "right", marginTop: 8 }}>
            Start Mission <ArrowRight size={13} />
          </a>
        </div>
      </div>
    </AppShell>
  );
}
