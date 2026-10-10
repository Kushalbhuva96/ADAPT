import React, { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Home, BookOpen, Mic2, PencilLine, BarChart3, UserRound, CalendarDays, MessageCircle, LogOut, MoreVertical, Settings as SettingsIcon } from "lucide-react";
import Brand from "../ui/Brand";
import ConnectionStatus from "../ui/ConnectionStatus";
import OfflineSyncStatus from "../ui/OfflineSyncStatus";
import { useAuth } from "../../services/AuthContext";
import { useNavigate } from "react-router-dom";
import { activateWaitingServiceWorker } from "../../services/serviceWorker";
import ThemeToggle from "../ui/ThemeToggle";

const nav = [
  ["/dashboard", "Dashboard", Home],
  ["/course", "Course", BookOpen],
  ["/tutor", "Tutor", MessageCircle],
  ["/practice", "Challenge Me", PencilLine],
  ["/progress", "Progress", BarChart3],
  ["/learning-dna", "Learning DNA", BookOpen],
  ["/study-plan", "Study Plan", CalendarDays],
  ["/voice", "Voice AI", Mic2],
  ["/profile", "Profile", UserRound],
  ["/settings", "AI Settings", SettingsIcon],
];

function currentUser() {
  try { return JSON.parse(localStorage.getItem("adapt_user") || "null"); }
  catch { return null; }
}

export default function AppShell({ children, breadcrumb }) {
  const { user: authenticatedUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [updateRegistration, setUpdateRegistration] = useState(null);
  const menuRef = useRef(null);
  const user = authenticatedUser || currentUser();
  const initials = (user?.name || "").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("");
  const signOut = async () => { try { await logout(); } catch { /* Session is cleared locally even when the API is unreachable. */ } navigate("/", { replace: true }); };
  useEffect(() => { setMenuOpen(false); }, [location.pathname, location.search]);
  useEffect(() => {
    const onPwaUpdate = (event) => setUpdateRegistration(event.detail?.registration || null);
    window.addEventListener("adapt:pwa-update", onPwaUpdate);
    const registration = window.__adaptServiceWorkerRegistration;
    if (registration?.waiting && navigator.serviceWorker?.controller) setUpdateRegistration(registration);
    return () => window.removeEventListener("adapt:pwa-update", onPwaUpdate);
  }, []);
  useEffect(() => {
    if (!menuOpen) return undefined;
    const closeOnOutside = (event) => { if (!menuRef.current?.contains(event.target)) setMenuOpen(false); };
    const closeOnEscape = (event) => { if (event.key === "Escape") setMenuOpen(false); };
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);
  return <div className="app-shell">
    <aside className="sidebar">
      <Brand />
      <div className="nav-label">Learning system</div>
      <nav>{nav.map(([to, label, Icon]) => <NavLink key={to} to={to} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}><Icon /><span>{label}</span></NavLink>)}</nav>
      <div className="sidebar-foot"><div className="sync-card"><div className="eyebrow">ADAPT CORE</div><div style={{ fontSize: 10, marginTop: 5 }}>Your learner model grows with your activity.</div></div></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div>ADAPT&nbsp;&nbsp;/&nbsp;&nbsp;{breadcrumb || "WORKSPACE"}</div><div className="top-actions"><ConnectionStatus /><OfflineSyncStatus key={user?.id || "anonymous"} userId={user?.id} /><ThemeToggle />{user?.name && <div className="top-status">{user.name}</div>}<Link to="/profile" className="avatar-link" aria-label="Open Profile" title="Profile"><div className="avatar">{initials || <UserRound size={14} />}</div></Link><button type="button" className="btn app-logout" onClick={signOut}><LogOut size={13}/> Sign out</button></div></header>
      {updateRegistration && <div className="pwa-update" role="status"><span>A new version of ADAPT is ready.</span><button type="button" className="btn btn-primary" onClick={() => activateWaitingServiceWorker(updateRegistration)}>Update now</button></div>}
      {children}
    </main>
    <nav className="mobile-nav" aria-label="Primary navigation">{nav.slice(0, 4).map(([to, label, Icon]) => <NavLink key={to} to={to} className={({ isActive }) => isActive ? "active" : ""}><Icon /><span>{label === "Challenge Me" ? "Challenge" : label}</span></NavLink>)}<div className="mobile-more-wrap" ref={menuRef}><button type="button" className={`mobile-more ${menuOpen ? "active" : ""}`} aria-label="More navigation options" aria-haspopup="menu" aria-expanded={menuOpen} aria-controls="mobile-more-menu" onClick={() => setMenuOpen((open) => !open)}><MoreVertical /><span>More</span></button>{menuOpen && <div id="mobile-more-menu" className="mobile-more-menu" role="menu">{nav.map(([to, label, Icon]) => <NavLink key={to} to={to} role="menuitem" className={({ isActive }) => `mobile-more-item ${isActive ? "active" : ""}`}><Icon /><span>{label === "Course" ? "Learn / Courses" : label === "Challenge Me" ? "Practice" : label}</span></NavLink>)}<button type="button" role="menuitem" className="mobile-more-item" onClick={signOut}><LogOut /><span>Logout</span></button></div>}</div></nav>
  </div>;
}
