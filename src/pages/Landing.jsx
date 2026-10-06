import React from "react";
import { ArrowRight, Sparkles, BrainCircuit, Mic2, Network } from "lucide-react";
import { Link } from "react-router-dom";
import Brand from "../components/ui/Brand";
import AIOrb from "../components/ui/AIOrb";

export default function Landing() {
  return <div className="landing">
    <nav className="landing-nav">
      <Brand/>
      <div className="landing-links">
        <a href="#how">HOW IT WORKS</a><a href="#tutor">AI TUTOR</a><a href="#voice">VOICE AI</a><a href="#adaptive">ADAPTIVE LEARNING</a>
      </div>
      <div style={{display:"flex",gap:9}}>
        <Link to="/onboarding?mode=signin" className="btn">Sign in</Link>
        <Link to="/onboarding" className="btn btn-primary">Start Learning <ArrowRight size={14}/></Link>
      </div>
    </nav>

    <section className="landing-hero">
      <div>
        <div className="eyebrow">AI LEARNING SYSTEM</div>
        <h1 className="hero-title" style={{marginTop:16}}>An AI<br/>that learns<br/>the learner.</h1>
        <p className="hero-copy">Personalized explanations, adaptive practice, intelligent study plans, and an AI voice tutor that changes with you.</p>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <Link to="/onboarding" className="btn btn-primary">Start Learning <ArrowRight size={15}/></Link>
          <a href="#how" className="btn">See How ADAPT Works</a>
        </div>
      </div>
      <div className="neural">
        <div className="neural-ring nr1"/><div className="neural-ring nr2"/><div className="neural-ring nr3"/>
        <div className="neural-core">ADAPT</div>
        {["KNOWLEDGE","PRACTICE","PROGRESS","VOICE","MEMORY","PERSONALIZATION"].map((n,i)=><div key={n} className={`neural-node nn${i+1}`}>{n}</div>)}
      </div>
    </section>

    <section id="how" className="landing-section">
      <div className="eyebrow">THE LEARNING SYSTEM</div>
      <h2 className="page-title" style={{fontSize:"clamp(36px,5vw,62px)",marginTop:12}}>Learning should adapt to you.</h2>
      <div className="feature-grid">
        {[
          ["LEARNING DNA","Your personal learning model updates as you learn.",BrainCircuit],
          ["WHY THIS QUESTION?","See exactly why ADAPT chose your next challenge.",Network],
          ["VOICE AI","Talk, interrupt, explore and learn naturally.",Mic2]
        ].map(([title,text,Icon])=><div className="card card-pad card-hover" key={title}>
          <div className="feature-visual"><div className="mini-orb"/><div className="orbit-mini"/><Icon style={{position:"absolute",right:16,top:16,color:"#C8A8FF"}} size={17}/></div>
          <div className="eyebrow">{title}</div><h3 style={{fontFamily:"Space Grotesk",fontSize:20,marginTop:8}}>{text}</h3>
        </div>)}
      </div>
    </section>

    <section id="adaptive" className="landing-section">
      <div className="eyebrow">ADAPTIVE LOOP</div>
      <h2 className="section-title" style={{fontSize:30,marginTop:8}}>Your learning loop.</h2>
      <div className="loop">
        {[["01","YOU ACT","Answer, ask, speak, practice."],["02","ADAPT UNDERSTANDS","It reads patterns, mistakes and pace."],["03","ADAPT DECIDES","Difficulty, explanation and path change."],["04","YOU IMPROVE","The next interaction is more personal."]].map(x=><div className="loop-step" key={x[0]}><div className="loop-number">{x[0]}</div><strong>{x[1]}</strong><p>{x[2]}</p></div>)}
      </div>
    </section>

    <section id="tutor" className="landing-section">
      <div className="card card-pad glow" style={{display:"grid",gridTemplateColumns:"1.1fr .9fr",gap:35,alignItems:"center"}}>
        <div><div className="eyebrow">BUILT AROUND THE LEARNER</div><h2 className="page-title" style={{fontSize:42,marginTop:10}}>Not another dashboard.<br/>A learning operating system.</h2><p className="hero-copy" style={{fontSize:12}}>Personalization, adaptive difficulty, AI tutoring, voice learning and offline continuity live in one intelligent loop.</p><Link to="/dashboard" className="btn btn-primary">Explore ADAPT <ArrowRight size={14}/></Link></div>
        <AIOrb/>
      </div>
    </section>

    <section id="voice" className="landing-cta">
      <div className="eyebrow">READY TO LEARN YOUR WAY?</div>
      <h2 className="page-title" style={{fontSize:"clamp(42px,6vw,76px)",marginTop:12}}>Meet the learner<br/>your AI understands.</h2>
      <div style={{marginTop:28}}><Link to="/onboarding" className="btn btn-primary">Start Learning <ArrowRight size={15}/></Link></div>
      <div className="mini" style={{marginTop:18}}>Your AI. Your pace. Your way of learning.</div>
    </section>
  </div>;
}
