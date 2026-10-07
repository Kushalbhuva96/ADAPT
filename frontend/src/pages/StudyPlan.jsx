import React, { useEffect, useState } from "react";
import { Check, Clock3, ArrowRight, Play } from "lucide-react";
import { Link } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import { api } from "../services/api";

export default function StudyPlan() {
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { api.studyPlan().then(setPlan).catch((err) => setError(err.message)); }, []);
  const complete = async (itemId) => {
    try { const updated = await api.completePlanItem(null, itemId); setPlan((current) => ({ ...current, ...updated, status: "ready" })); }
    catch (err) { setError(err.message); }
  };

  return <AppShell breadcrumb="STUDY PLAN"><div className="page">
    <div className="eyebrow">PERSONALIZED STUDY PLAN</div><h1 className="page-title" style={{ marginTop: 8 }}>Your Study Plan</h1>
    {error && <div className="form-error" role="alert" style={{ marginTop: 18 }}>{error}</div>}
    {!plan && !error && <div className="card card-pad" style={{ marginTop: 20 }}>Loading saved learner context…</div>}
    {plan?.status === "not_ready" && <div className="card card-pad glow" style={{ marginTop: 20 }}><h2 style={{ fontSize: 20 }}>Your study plan will form as you learn.</h2><p className="mini" style={{ marginTop: 7 }}>{plan.course ? "Complete the course level assessment to get a plan based on your results." : "Create a course and complete its level assessment to get a plan based on your results."}</p><Link className="btn btn-primary" style={{ marginTop: 14 }} to={plan.course ? "/assessment" : "/course"}>{plan.course ? "Take Level Assessment" : "Open Course"} <ArrowRight size={14} /></Link></div>}
    {plan?.status === "ready" && <>
      <p className="page-subtitle">{plan.totalMinutes} minutes · based on your saved {plan.course.title} assessment and current recommendation.</p>
      <section className="card card-pad" style={{ marginTop: 22 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}><div><div className="eyebrow">CURRENT FOCUS · {plan.course.title}</div><h2 style={{ fontSize: 22, marginTop: 7 }}>{plan.topic.name}</h2></div><span className="badge">{plan.items.filter((item) => item.status === "completed").length}/{plan.items.length} COMPLETE</span></div>
        <div className="timeline"><div className="timeline-grid">{plan.items.map((item, index) => <div key={item.id} style={{ opacity: item.status === "completed" ? .65 : 1 }}><button className="step-dot" onClick={() => complete(item.id)} disabled={item.status === "completed"}>{item.status === "completed" ? <Check size={12} /> : String(index + 1).padStart(2, "0")}</button><div style={{ fontSize: 10, fontWeight: 700, marginTop: 7 }}>{item.title}</div><div className="mini" style={{ marginTop: 5, display: "flex", alignItems: "center", gap: 4 }}><Clock3 size={10} /> {item.durationMinutes} min · {item.type}</div></div>)}</div></div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 25 }}><Link className="btn" to="/learning-dna">View Learning DNA</Link><Link className="btn btn-primary" to="/practice"><Play size={14} /> Challenge Me <ArrowRight size={14} /></Link></div>
      </section>
    </>}
  </div></AppShell>;
}
