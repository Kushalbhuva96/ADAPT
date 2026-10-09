import React from "react";

export default function AIOrb({ size = "normal", variant = "default", voiceState = "IDLE", orbRef }) {
  const voiceClass = variant === "voice" ? `voice-${String(voiceState).toLowerCase()}` : "";
  return <div ref={variant === "voice" ? orbRef : undefined} className={`hero-orb ${size === "small" ? "small-orb" : ""} ${variant === "learning-system" ? "learning-system-orb" : ""} ${variant === "voice" ? "voice-system-orb" : ""} ${voiceClass}`} aria-label="ADAPT AI orb" role={variant === "voice" ? "img" : undefined}>
    {variant === "default" && <span className="adaptive-orb-core" aria-hidden="true"><span className="adaptive-orb-mark"><i/><i/><i/></span><span className="adaptive-orb-label">ADAPT</span></span>}
    {variant === "learning-system" && <span className="learning-orb-core" aria-hidden="true"><span className="learning-orb-signal"><i/><i/><i/></span><span className="learning-orb-label">ADAPT</span></span>}
    {variant === "voice" && <span className="voice-orb-core" aria-hidden="true"><i className="voice-orb-surface voice-orb-surface-a"/><i className="voice-orb-surface voice-orb-surface-b"/><i className="voice-orb-surface voice-orb-surface-c"/><span className="voice-orb-glint"/><span className="voice-orb-caption">ADAPT</span></span>}
    <span className="orbit-node node-1"/><span className="orbit-node node-2"/>
    <span className="orbit-node node-3"/><span className="orbit-node node-4"/>
  </div>;
}
