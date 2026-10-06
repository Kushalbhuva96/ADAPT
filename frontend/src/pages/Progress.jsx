import React from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import AppShell from "../components/layout/AppShell";
import { topics } from "../data/mock";

const chart = [
  { name: "M", v: 45 },
  { name: "T", v: 49 },
  { name: "W", v: 52 },
  { name: "T", v: 51 },
  { name: "F", v: 58 },
  { name: "S", v: 63 },
  { name: "S", v: 67 },
];

export default function Progress() {
  return (
    <AppShell breadcrumb="PROGRESS">
      <div className="page">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end" }}>
          <div>
            <div className="eyebrow">INTELLIGENCE ANALYTICS</div>
            <h1 className="page-title" style={{ marginTop: 8 }}>Your Progress</h1>
            <p className="page-subtitle">Not just what changed — but why it changed.</p>
          </div>
          <div className="badge success">+18% GROWTH</div>
        </div>

        <div className="grid grid-4" style={{ marginTop: 24 }}>
          <div className="card metric" style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div className="ring" style={{ "--p": 74, width: 70, height: 70 }}>
              <div><strong style={{ fontSize: 17 }}>74%</strong></div>
            </div>
            <div>
              <div className="metric-label">OVERALL</div>
              <div style={{ fontSize: 9, color: "var(--success)" }}>Strong upward movement</div>
            </div>
          </div>

          {[
            ["WEEKLY IMPROVEMENT", "+18%"],
            ["ACCURACY", "78%"],
            ["LEARNING TIME", "8.4h"],
          ].map((x) => (
            <div className="card metric" key={x[0]}>
              <div className="metric-label">{x[0]}</div>
              <div className="metric-value">{x[1]}</div>
              <div className="metric-change">+12% this week</div>
            </div>
          ))}
        </div>

        <div className="grid grid-2" style={{ marginTop: 14 }}>
          <div className="card card-pad">
            <div className="eyebrow">LEARNING TRAJECTORY</div>
            <h2 className="section-title" style={{ marginTop: 6 }}>Knowledge growth</h2>
            <div className="chart-shell" style={{ marginTop: 10 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chart}>
                  <defs>
                    <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#9B5CFF" stopOpacity=".35" />
                      <stop offset="100%" stopColor="#9B5CFF" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" />
                  <YAxis domain={[30, 80]} />
                  <Tooltip
                    contentStyle={{
                      background: "#1D1033",
                      border: "1px solid #392052",
                      borderRadius: 10,
                      color: "#fff",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke="#9B5CFF"
                    fill="url(#areaFill)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card card-pad">
            <div className="eyebrow">TOPIC MASTERY</div>
            <h2 className="section-title" style={{ marginTop: 6 }}>Operating Systems</h2>
            {topics.map((t) => (
              <div key={t.id} style={{ padding: "15px 0", borderBottom: "1px solid var(--subtle)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}>
                  <span>{t.name}</span>
                  <span style={{ color: t.id === "deadlocks" ? "var(--warning)" : "var(--lavender)" }}>
                    {t.mastery}%
                  </span>
                </div>
                <div className="progress-line" style={{ marginTop: 7 }}>
                  <span style={{ width: `${t.mastery}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          className="card card-pad"
          style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <div>
            <div className="eyebrow">WEAKNESS RECOVERY</div>
            <h2 className="section-title" style={{ marginTop: 5 }}>
              Deadlocks <span style={{ color: "var(--muted)", fontSize: 12, marginLeft: 8 }}>42% →</span>{" "}
              <span style={{ color: "var(--lavender)" }}>68%</span>
            </h2>
          </div>
          <div style={{ color: "var(--success)", fontFamily: "Space Grotesk", fontSize: 24 }}>+26%</div>
        </div>
      </div>
    </AppShell>
  );
}
