import React,{useEffect,useState} from "react";
import {ArrowLeft,ArrowRight,Check,ChevronDown,Sparkles,RotateCcw} from "lucide-react";
import AppShell from "../components/layout/AppShell";
import {api} from "../services/api";
import {user} from "../data/mock";
import {getActiveCourse} from "../utils/courseState";
import {topics} from "../data/mock";

export default function Practice(){
 const activeCourse=getActiveCourse();
 const [index,setIndex]=useState(0),[question,setQuestion]=useState(null),[selected,setSelected]=useState(null),[result,setResult]=useState(null),[why,setWhy]=useState(true),[loading,setLoading]=useState(true),[toast,setToast]=useState("");
 const load=async(i=index)=>{setLoading(true);setSelected(null);setResult(null);try{setQuestion(await api.nextPractice(user.id));}finally{setLoading(false)}};
 useEffect(()=>{load(index)},[index]);
 const submit=async()=>{if(!selected||!question)return;setResult(await api.answerPractice({questionId:question.id,selectedOptionId:selected,timeTakenSeconds:18}));};
 const next=()=>setIndex(v=>v+1);
 return <AppShell breadcrumb="ADAPTIVE PRACTICE"><div className="page">
   <div className="eyebrow">{activeCourse ? activeCourse.subject.name.toUpperCase() : "ADAPTIVE PRACTICE"} · ADAPTIVE PRACTICE</div><div style={{display:"flex",justifyContent:"space-between",gap:15,alignItems:"end",marginTop:8}}><div><h1 className="page-title">{activeCourse ? topics.find((topic)=>topic.id===(activeCourse.activeTopicId||activeCourse.recommendedTopicId||activeCourse.selectedTopicId))?.name || "Course practice" : "Practice that changes with you."}</h1><p className="page-subtitle">{activeCourse ? `Practice in your ${activeCourse.subject.name} course. Each answer updates its progress.` : "Every answer becomes a signal for the next question."}</p></div><div className="question-meta"><span className="badge">QUESTION {String(index+1).padStart(2,"0")}/08</span><span className="badge">{question?.difficulty?.toUpperCase()||"ADAPTIVE"}</span></div></div>
   <div className="progress-line" style={{marginTop:18}}><span style={{width:`${Math.min(100,((index+1)/8)*100)}%`}}/></div>
   <div className="lab-grid" style={{marginTop:24}}><section className="card card-pad hero-panel">
     {loading?<div style={{padding:"70px 20px",textAlign:"center"}}><div className="eyebrow">ADAPT IS THINKING...</div><p className="mini" style={{marginTop:8}}>Selecting your next question from current learning signals.</p></div>:<>
       <div className="question-meta"><span className="badge">{question.topicId.replace("_"," ").toUpperCase()}</span><span className="badge">{question.adaptiveContext?.strategy?.replace("_"," ").toUpperCase()}</span></div>
       <div className="mini" style={{fontFamily:"Space Grotesk",fontSize:42,color:"rgba(124,60,255,.18)",marginTop:15}}>{String(index+1).padStart(2,"0")}</div>
       <h2 style={{fontFamily:"Space Grotesk",fontSize:29,lineHeight:1.18,maxWidth:720}}>{question.question}</h2>
       <p className="mini" style={{marginTop:8}}>Choose the answer that best completes the concept.</p>
       <div className="question-options" style={{marginTop:20}}>{question.options.map(o=><button key={o.id} className={`option ${selected===o.id?"selected":""}`} onClick={()=>!result&&setSelected(o.id)}><span className="option-key">{o.id.toUpperCase()}</span><span>{o.text}</span>{selected===o.id&&<Check size={15} style={{marginLeft:"auto",color:"var(--lavender)"}}/>}</button>)}</div>
       {!result?<button className="btn btn-primary" style={{marginTop:18,float:"right"}} disabled={!selected} onClick={submit}>Submit Answer <ArrowRight size={14}/></button>:<div className="card card-pad" style={{marginTop:20,background:"rgba(13,6,24,.35)"}}><div className="eyebrow" style={{color:result.attempt.correct?"var(--success)":"var(--warning)"}}>{result.attempt.correct?"CORRECT":"NOT QUITE"}</div><h3 style={{fontSize:20,marginTop:8}}>{result.feedback.whatAdaptLearned}</h3><p className="mini" style={{lineHeight:1.7,marginTop:7}}>{result.feedback.explanation}</p><div className="question-nav"><span className="badge">MASTERY {result.feedback.mastery.previous}% → {result.feedback.mastery.current}%</span><button className="btn btn-primary" onClick={next}>Next Question <ArrowRight size={14}/></button></div></div>}
     </>}
   </section>
   <aside className="why-box"><button style={{display:"flex",justifyContent:"space-between",width:"100%",background:"none",border:0,color:"inherit",padding:0}} onClick={()=>setWhy(v=>!v)}><span className="eyebrow">WHY AM I SEEING THIS?</span><ChevronDown size={15} style={{transform:why?"rotate(180deg)":"none",transition:".2s"}}/></button>{why&&<div><p className="mini" style={{lineHeight:1.7,marginTop:12}}>ADAPT selects this question from the learner state. The backend will eventually provide these signals.</p>{[["01","YOUR PERFORMANCE",`${question?.adaptiveContext?.accuracy||42}% accuracy on this topic`],["02","AI UNDERSTANDING","Recent attempts show a concept gap"],["03","ADAPT DECISION",question?.adaptiveContext?.reason||"Reinforce the foundation"],["04","PERSONALIZED RESULT",`${question?.difficulty||"medium"} question + example-first strategy`]].map(x=><div className="why-step" key={x[0]}><div className="why-number">{x[0]}</div><div><div className="tiny">{x[1]}</div><div style={{fontSize:10,marginTop:3,color:"var(--secondary)"}}>{x[2]}</div></div></div>)}<div className="insight" style={{marginTop:5}}><Sparkles size={14}/><div className="mini">{result?.adaptation?.reason||"Answer this question and ADAPT will decide what should change next."}</div></div></div>}</aside></div>
   <div style={{display:"flex",justifyContent:"space-between",marginTop:14}}><button className="btn" onClick={()=>setIndex(v=>Math.max(0,v-1))} disabled={index===0}><ArrowLeft size={14}/> Previous</button><button className="btn" onClick={()=>{setSelected(null);setResult(null);load(index)}}><RotateCcw size={14}/> Reset</button></div>
   {toast&&<div className="toast">{toast}</div>}
 </div></AppShell>
}
