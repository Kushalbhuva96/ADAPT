import React from "react";

export default function AIOrb({ size = "normal" }) {
  return <div className={`hero-orb ${size === "small" ? "small-orb" : ""}`} aria-label="ADAPT AI orb">
    <span className="orbit-node node-1"/><span className="orbit-node node-2"/>
    <span className="orbit-node node-3"/><span className="orbit-node node-4"/>
  </div>;
}
