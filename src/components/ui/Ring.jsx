import React from "react";

export default function Ring({ value = 67, label = "overall" }) {
  return <div className="ring" style={{"--p": value}}>
    <div><strong>{value}%</strong><small>{label}</small></div>
  </div>;
}
