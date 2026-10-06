import React, { useState } from "react";
import { Send, Sparkles, BookOpenCheck, Lightbulb, Image, TimerReset } from "lucide-react";
import AppShell from "../components/layout/AppShell";
import { api } from "../services/api";
import { getActiveCourse } from "../utils/courseState";
import { topics } from "../data/mock";

export default function Tutor() {
  const activeCourse = getActiveCourse();
  const activeTopic = topics.find((topic) => topic.id === (activeCourse?.activeTopicId || activeCourse?.recommendedTopicId || activeCourse?.selectedTopicId));
  const topicName = activeTopic?.name || "your selected topic";
  const [messages,setMessages]=useState([{role:"assistant",content:`Let's understand ${topicName} using a clear explanation and an example.`}]);
  const [input,setInput]=useState("");
  const send=async()=>{ if(!input.trim()) return; setMessages(m=>[...m,{role:"user",content:input}]); const r=await api.tutorMessage({message:input,mode:"explain",topicId:activeTopic?.id,topicName,courseName:activeCourse?.subject?.name}); setMessages(m=>[...m,r]); setInput(""); };
  const actions=[["Explain Simply",Lightbulb],["Real-world Example",BookOpenCheck],["Visual Explanation",Image],["Exam Answer",BookOpenCheck],["Quiz Me",Sparkles],["30-sec Revision",TimerReset]];
  return <AppShell breadcrumb="AI TUTOR"><div className="page">
    <div><div className="eyebrow">AI TEACHING WORKSPACE</div><h1 className="page-title" style={{marginTop:8}}>ADAPT Tutor</h1><p className="page-subtitle">A teaching companion, not a chatbot.</p></div>
    <div className="chips" style={{marginTop:16}}>{[activeCourse?.subject?.name || "YOUR COURSE",topicName.toUpperCase(),activeCourse?.learnerLevel?.toUpperCase() || "STARTING LEVEL"].map(x=><span className="chip" key={x}>{x}</span>)}</div>
    <div className="tutor-layout" style={{marginTop:18}}>
      <div className="card card-pad">
        <div className="quick-actions">{actions.map(([x,Icon])=><button className="btn" key={x} onClick={()=>setInput(x)}><Icon size={13}/>{x}</button>)}</div>
        <div style={{marginTop:24,display:"grid",gap:12}}>
          {messages.map((m,i)=><div key={i} className={m.role==="assistant"?"teaching-block":""} style={m.role==="user"?{padding:"14px 16px",background:"rgba(124,60,255,.08)",border:"1px solid var(--border)",borderRadius:15,marginLeft:"14%"}:{}}><div className="eyebrow" style={{marginBottom:6}}>{m.role==="assistant"?"ADAPT":"YOU"}</div><div style={{fontSize:13,lineHeight:1.7}}>{m.content}</div>{m.role==="assistant"&&<div className="grid grid-2" style={{marginTop:14}}>{["CONCEPT","EXAMPLE","WHY IT MATTERS","QUICK CHECK"].map(x=><div className="card" style={{padding:12}} key={x}><div className="tiny">{x}</div><div className="mini" style={{marginTop:5}}>Personalized teaching block</div></div>)}</div>}</div>)}
        </div>
        <div style={{display:"flex",gap:8,marginTop:20}}><input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder={`Ask ADAPT about ${topicName.toLowerCase()}...`} style={{flex:1,background:"rgba(13,6,24,.6)",border:"1px solid var(--border)",borderRadius:12,padding:"12px 14px",color:"#fff",outline:"none"}}/><button className="btn btn-primary" onClick={send}><Send size={14}/></button></div>
      </div>
      <div className="card card-pad"><div className="eyebrow">ADAPT CONTEXT</div><h3 style={{marginTop:7,fontSize:16}}>What ADAPT knows</h3><div style={{marginTop:18,display:"grid",gap:10}}>{[["Mastery","42% Deadlocks"],["Recent mistakes","3 on Banker's Algorithm"],["Preferred style","Examples"],["Difficulty","Medium"]].map(x=><div key={x[0]} style={{padding:"12px",border:"1px solid var(--subtle)",borderRadius:11}}><div className="tiny">{x[0]}</div><div style={{fontSize:10,marginTop:4}}>{x[1]}</div></div>)}</div></div>
    </div>
  </div></AppShell>;
}
