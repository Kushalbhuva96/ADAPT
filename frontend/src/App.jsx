import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Landing from "./pages/Landing";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import LearningDNA from "./pages/LearningDNA";
import Practice from "./pages/Practice";
import Tutor from "./pages/Tutor";
import VoiceTutor from "./pages/VoiceTutor";
import Progress from "./pages/Progress";
import Profile from "./pages/Profile";
import StudyPlan from "./pages/StudyPlan";
import Assessment from "./pages/Assessment";
import VoiceQuiz from "./pages/VoiceQuiz";
import HackathonLab from "./pages/HackathonLab";
import Course from "./pages/Course";

function RequireAuth({ children }) {
  const location = useLocation();
  if (!localStorage.getItem("adapt_token")) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/onboarding?mode=signin&next=${encodeURIComponent(next)}`} replace />;
  }
  return children;
}

export default function App() {
  return <Routes>
    <Route path="/" element={<Landing/>}/>
    <Route path="/onboarding" element={<Onboarding/>}/>
    <Route path="/assessment" element={<RequireAuth><Assessment/></RequireAuth>}/>
    <Route path="/course" element={<RequireAuth><Course/></RequireAuth>}/>
    <Route path="/dashboard" element={<RequireAuth><Dashboard/></RequireAuth>}/>
    <Route path="/lab" element={<RequireAuth><HackathonLab/></RequireAuth>}/>
    <Route path="/learning-dna" element={<RequireAuth><LearningDNA/></RequireAuth>}/>
    <Route path="/tutor" element={<RequireAuth><Tutor/></RequireAuth>}/>
    <Route path="/voice" element={<RequireAuth><VoiceTutor/></RequireAuth>}/>
    <Route path="/voice-quiz" element={<RequireAuth><VoiceQuiz/></RequireAuth>}/>
    <Route path="/practice" element={<RequireAuth><Practice/></RequireAuth>}/>
    <Route path="/study-plan" element={<RequireAuth><StudyPlan/></RequireAuth>}/>
    <Route path="/progress" element={<RequireAuth><Progress/></RequireAuth>}/>
    <Route path="/profile" element={<RequireAuth><Profile/></RequireAuth>}/>
    <Route path="*" element={<Navigate to="/dashboard" replace/>}/>
  </Routes>;
}
