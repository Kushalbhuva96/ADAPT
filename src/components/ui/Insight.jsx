import React from "react";
import { Sparkles } from "lucide-react";

export default function Insight({ title = "ADAPT noticed something", children }) {
  return <div className="insight">
    <div className="insight-icon"><Sparkles size={14}/></div>
    <div><div className="eyebrow" style={{marginBottom:6}}>{title}</div><div className="mini" style={{lineHeight:1.6}}>{children}</div></div>
  </div>;
}
