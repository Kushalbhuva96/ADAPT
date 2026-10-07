import React from "react";

export default function AIOrb({ size = "normal", variant = "default", voiceState = "IDLE" }) {
  const voiceClass = variant === "voice" ? `voice-${String(voiceState).toLowerCase()}` : "";
  return <div className={`hero-orb ${size === "small" ? "small-orb" : ""} ${variant === "learning-system" ? "learning-system-orb" : ""} ${variant === "voice" ? "voice-system-orb" : ""} ${voiceClass}`} aria-label="ADAPT AI orb">
    {variant === "default" && <span className="adaptive-orb-core" aria-hidden="true"><span className="adaptive-orb-mark"><i/><i/><i/></span><span className="adaptive-orb-label">ADAPT</span></span>}
    {variant === "learning-system" && <span className="learning-orb-core" aria-hidden="true"><span className="learning-orb-signal"><i/><i/><i/></span><span className="learning-orb-label">ADAPT</span></span>}
    {variant === "voice" && <span className="voice-orb-core"><span className="voice-orb-bars"><i/><i/><i/><i/><i/></span><span className="voice-orb-caption">VOICE LINK</span></span>}
    <span className="orbit-node node-1"/><span className="orbit-node node-2"/>
    <span className="orbit-node node-3"/><span className="orbit-node node-4"/>
  </div>;
}
