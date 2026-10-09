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
  const pendingItems = plan?.items?.filter((item) => item.status !== "completed") || [];
  const completedItems = plan?.items?.filter((item) => item.status === "completed") || [];
  const nextAction = pendingItems[0];
  const upcoming = pendingItems.slice(1);
  const groupedUpcoming = [
    { title: "UPCOMING", items: upcoming.filter((item) => !["review", "practice", "recall"].includes(item.type.toLowerCase())) },
    { title: "REVIEW", items: upcoming.filter((item) => ["review", "recall", "reinforce"].includes(item.type.toLowerCase())) },
    { title: "PRACTICE", items: upcoming.filter((item) => item.type.toLowerCase() === "practice") },
  ].filter((group) => group.items.length);

  return <AppShell breadcrumb="STUDY PLAN"><div className="page">
    <div className="eyebrow">PERSONALIZED STUDY PLAN</div><h1 className="page-title" style={{ marginTop: 8 }}>Your Study Plan</h1>
    {error && <div className="form-error" role="alert" style={{ marginTop: 18 }}>{error}</div>}
    {!plan && !error && <div className="card card-pad" style={{ marginTop: 20 }}>Loading saved learner context…</div>}
    {plan?.status === "not_ready" && <div className="card card-pad glow" style={{ marginTop: 20 }}><h2 style={{ fontSize: 20 }}>Your study plan will form as you learn.</h2><p className="mini" style={{ marginTop: 7 }}>{plan.course ? "Complete the course level assessment to get a plan based on your results." : "Create a course and complete its level assessment to get a plan based on your results."}</p><Link className="btn btn-primary" style={{ marginTop: 14 }} to={plan.course ? "/assessment" : "/course"}>{plan.course ? "Take Level Assessment" : "Open Course"} <ArrowRight size={14} /></Link></div>}
    {plan?.status === "ready" && <>
      <p className="page-subtitle">{plan.totalMinutes} minutes planned for {plan.course.title}, using your active topic and saved assessment.</p>
      <section className="card card-pad study-priority" style={{ marginTop: 22 }}>
        <div className="study-priority-head"><div><div className="eyebrow">TODAY · CURRENT PRIORITY</div><h2 style={{ fontSize: "clamp(20px, 5vw, 26px)", marginTop: 8 }}>{plan.topic.name}</h2></div><span className="badge">{completedItems.length}/{plan.items.length} COMPLETE</span></div>
        <div className="study-reason"><div className="eyebrow">WHY THIS MATTERS</div><p className="mini" style={{ marginTop: 6 }}>ADAPT selected this active topic from your saved assessment and current course focus.</p></div>
        {nextAction ? <div className="study-next-action"><div><div className="eyebrow">NEXT ACTION · {nextAction.type.toUpperCase()}</div><h3 style={{ fontSize: 17, marginTop: 6 }}>{nextAction.title}</h3><div className="mini" style={{ marginTop: 5 }}><Clock3 size={12} /> {nextAction.durationMinutes} minutes</div></div><div className="study-actions">{nextAction.type === "practice" && <Link className="btn" to="/practice"><Play size={14} /> Practice</Link>}<button className="btn btn-primary" onClick={() => complete(nextAction.id)}><Check size={14} /> Mark complete</button></div></div> : <div className="study-next-action"><div><div className="eyebrow">PLAN COMPLETE</div><p className="mini" style={{ marginTop: 6 }}>All saved actions in this plan are complete.</p></div></div>}
      </section>

      {groupedUpcoming.map((group) => <section className="card card-pad study-section" style={{ marginTop: 14 }} key={group.title}><div className="eyebrow">{group.title}</div><div className="study-list">{group.items.map((item) => <article className="study-item" key={item.id}><span className="study-index">{item.type === "practice" ? <Play size={13} /> : <Clock3 size={13} />}</span><div className="study-item-copy"><strong>{item.title}</strong><span className="mini">{item.type} · {item.durationMinutes} min</span></div><button className="btn" onClick={() => complete(item.id)}>Complete</button></article>)}</div></section>)}
      {completedItems.length > 0 && <section className="card card-pad study-section" style={{ marginTop: 14 }}><div className="eyebrow">COMPLETED</div><div className="study-list">{completedItems.map((item) => <article className="study-item is-complete" key={item.id}><span className="study-index"><Check size={14} /></span><div className="study-item-copy"><strong>{item.title}</strong><span className="mini">{item.type} · {item.durationMinutes} min</span></div><span className="badge">DONE</span></article>)}</div></section>}
      <div className="study-footer"><Link className="btn" to="/learning-dna">View Learning DNA</Link><Link className="btn btn-primary" to="/practice"><Play size={14} /> Challenge Me <ArrowRight size={14} /></Link></div>
    </>}
  </div></AppShell>;
}
