import React from "react";
import { ShieldCheck, ArrowRight } from "lucide-react";
import AppShell from "../components/layout/AppShell";
import { user } from "../data/mock";

const rows=["Learning Profile","Subjects","Learning Preferences","Voice Preferences","Offline Content","Sync","Privacy"];

export default function Profile() {
  return <AppShell breadcrumb="PROFILE"><div className="page">
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"end"}}><div><div className="eyebrow">OWNED BY YOU</div><h1 className="page-title" style={{marginTop:8}}>Your learning profile</h1><p className="page-subtitle">Your learning profile belongs to you.</p></div><span className="badge success"><ShieldCheck size={11}/> PRIVATE & ENCRYPTED</span></div>
    <div className="grid grid-2" style={{marginTop:24}}>
      <div className="card card-pad"><div style={{display:"flex",gap:13,alignItems:"center"}}><div className="avatar" style={{width:44,height:44}}>AK</div><div><h2 style={{fontSize:15}}>{user.name}</h2><div className="mini">Operating systems · exam preparation</div></div><span className="badge success" style={{marginLeft:"auto"}}>SYNCED</span></div><div style={{borderTop:"1px solid var(--border)",marginTop:18,paddingTop:16,display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}><div><div className="tiny">LEARNING STYLE</div><div style={{fontSize:10,marginTop:4}}>Examples</div></div><div><div className="tiny">DIFFICULTY</div><div style={{fontSize:10,marginTop:4}}>Medium</div></div><div><div className="tiny">VOICE</div><div style={{fontSize:10,marginTop:4}}>Conversational</div></div></div></div>
      <div className="card card-pad"><div className="eyebrow">CONNECTION</div><h2 style={{fontSize:15,marginTop:6}}>Always ready to learn.</h2><p className="mini" style={{lineHeight:1.6}}>Your local learning profile stays available even when the network disappears.</p><div style={{marginTop:15,display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>{["Personalized insights","Saved lessons","Downloaded questions","Progress tracking"].map(x=><div key={x} className="mini">✓ {x}</div>)}</div></div>
    </div>
    <div className="card profile-list" style={{marginTop:16}}>{rows.map((r,i)=><div className="profile-row" key={r}><span><span className="tiny" style={{marginRight:10}}>0{i+1}</span>{r}</span><span style={{display:"flex",alignItems:"center",gap:10}}><span className="badge">{i===5?"PENDING SYNC":"LOCAL · SYNCED"}</span><ArrowRight size={13}/></span></div>)}</div>
    <div className="card card-pad" style={{marginTop:14}}><div className="eyebrow">OFFLINE CONTINUITY</div><h2 style={{fontSize:18,marginTop:7}}>Your learning continues.</h2><p className="mini" style={{marginTop:7}}>Last synced 10:42 AM · 3 actions pending sync.</p></div>
  </div></AppShell>;
}
