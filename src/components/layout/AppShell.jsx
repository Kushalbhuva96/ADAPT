import React from "react";
import { NavLink } from "react-router-dom";
import { Home, BookOpen, Mic2, PencilLine, BarChart3, UserRound, FlaskConical, ListChecks } from "lucide-react";
import Brand from "../ui/Brand";

const nav=[
  ["/dashboard","Home",Home], ["/lab","ADAPT Lab",FlaskConical], ["/learning-dna","Learning DNA",BookOpen],
  ["/course","My Courses",BookOpen], ["/assessment","Assessment",ListChecks], ["/voice","Voice AI",Mic2], ["/practice","Practice",PencilLine], ["/progress","Progress",BarChart3], ["/profile","Profile",UserRound]
];

export default function AppShell({children,breadcrumb}){
  return <div className="app-shell">
    <aside className="sidebar"><Brand/><div className="nav-label">Learning system</div><nav>{nav.map(([to,label,Icon])=><NavLink key={to} to={to} className={({isActive})=>`nav-item ${isActive?"active":""}`}><Icon/><span>{label}</span></NavLink>)}</nav>
      <div className="sidebar-foot"><div className="sync-card"><div className="eyebrow">ADAPT CORE</div><div style={{fontSize:10,marginTop:5}}>Learning model active</div><div className="tiny" style={{marginTop:4}}>Mock data · backend-ready contracts</div></div><div className="tiny" style={{marginTop:12}}><span className="sync-dot"/> ONLINE <span style={{float:"right"}}>v2.0</span></div></div>
    </aside>
    <main className="main-area"><header className="topbar"><div>ADAPT&nbsp;&nbsp;/&nbsp;&nbsp;{breadcrumb||"WORKSPACE"}</div><div className="top-actions"><div className="top-status"><span className="sync-dot"/> Profile synced</div><div className="avatar">AK</div></div></header>{children}</main>
    <nav className="mobile-nav">{nav.slice(0,5).map(([to,label,Icon])=><NavLink key={to} to={to} className={({isActive})=>isActive?"active":""}><Icon/><span>{label.replace("Learning DNA","Learn")}</span></NavLink>)}</nav>
  </div>;
}
