import React from "react";
import { Link } from "react-router-dom";

export default function Brand() {
  return <Link to="/" className="brand" aria-label="ADAPT home">
    <span className="brand-mark"><span className="brand-a">A</span></span>
    <span><div className="brand-a">ADAPT</div><div className="brand-sub">AI LEARNING OS</div></span>
  </Link>;
}
