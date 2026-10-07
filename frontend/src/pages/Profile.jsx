import React, { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import AppShell from "../components/layout/AppShell";
import { api } from "../services/api";

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { api.profile().then(setProfile).catch((err) => setError(err.message)); }, []);
  const initials = (profile?.user?.name || "").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("");

  return <AppShell breadcrumb="PROFILE"><div className="page">
    <div className="eyebrow">YOUR ACCOUNT</div><h1 className="page-title" style={{ marginTop: 8 }}>Your learning profile</h1><p className="page-subtitle">Your saved account and learning context.</p>
    {error && <div className="form-error" role="alert" style={{ marginTop: 18 }}>{error}</div>}
    {!profile && !error && <div className="card card-pad" style={{ marginTop: 20 }}>Loading your account…</div>}
    {profile && <div className="grid grid-2" style={{ marginTop: 22 }}>
      <section className="card card-pad"><div style={{ display: "flex", gap: 13, alignItems: "center" }}><div className="avatar" style={{ width: 44, height: 44 }}>{initials}</div><div><h2 style={{ fontSize: 15 }}>{profile.user.name}</h2><div className="mini">{profile.user.email}</div></div></div><div style={{ borderTop: "1px solid var(--border)", marginTop: 18, paddingTop: 16, display: "grid", gap: 13 }}><div><div className="tiny">CURRENT COURSE</div><div style={{ fontSize: 11, marginTop: 4 }}>{profile.course?.title || "No course yet"}</div></div><div><div className="tiny">LEARNER LEVEL</div><div style={{ fontSize: 11, marginTop: 4 }}>{profile.adaptiveLevel || "Not assessed yet"}</div></div><div><div className="tiny">SAVED LEARNING PREFERENCES</div><div style={{ fontSize: 11, marginTop: 4 }}>{profile.learningStyles?.length ? profile.learningStyles.join(", ") : "No preferences saved"}</div></div></div></section>
      <section className="card card-pad"><div className="eyebrow">LEARNING DATA</div><h2 style={{ fontSize: 18, marginTop: 7 }}>Your data comes from your activity.</h2><p className="mini" style={{ lineHeight: 1.7, marginTop: 8 }}>Assessment results, course topics, and practice history are saved to your learner account and used to shape ADAPT recommendations.</p>{profile.hasLearningData ? <div className="badge success" style={{ marginTop: 14 }}><ShieldCheck size={12} /> Learning history saved</div> : <div className="mini" style={{ marginTop: 14 }}>No assessment or practice history saved yet.</div>}</section>
    </div>}
  </div></AppShell>;
}
