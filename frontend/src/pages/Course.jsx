import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, BookOpen, CheckCircle2, Circle, Download, Plus, Trash2, WifiOff } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import { api } from "../services/api";
import { apiClient } from "../services/api/apiClient";
import { formatStoredSize, getDownloadedCourses, removeDownloadedCourse, saveDownloadedCourse } from "../services/offlineCourseStore";
import { resolveOfflineCourseState } from "../services/courseOfflineState";
import { getRecommendationExplanation } from "../utils/assessment";
import { removeCourseFromLocal } from "../utils/courseState";

function getSubjectAccent(subject = {}) {
  const subjectKey = `${subject.id || ""} ${subject.name || ""}`.toLowerCase();
  if (/database|dbms|sql/.test(subjectKey)) return "var(--subject-database)";
  if (/network|computer network/.test(subjectKey)) return "var(--subject-networks)";
  if (/software engineering/.test(subjectKey)) return "var(--subject-software)";
  if (/math|calculus|algebra/.test(subjectKey)) return "var(--subject-math)";
  if (/data structure|algorithm|dsa/.test(subjectKey)) return "var(--subject-dsa)";
  if (/program|coding|python|javascript|web development/.test(subjectKey)) return "var(--subject-programming)";
  if (/artificial intelligence|machine learning|ai/.test(subjectKey)) return "var(--subject-ai)";
  return "var(--subject-os)";
}

export default function Course() {
  const [courses, setCourses] = useState([]);
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyTopic, setBusyTopic] = useState(false);
  const [deletingCourse, setDeletingCourse] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [downloadedCourses, setDownloadedCourses] = useState([]);
  const [offlineOnly, setOfflineOnly] = useState(false);
  const [downloadingCourse, setDownloadingCourse] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const [confirmRemoveDownloadId, setConfirmRemoveDownloadId] = useState(null);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [offlineUnavailable, setOfflineUnavailable] = useState(false);
  const navigate = useNavigate();
  const courseRef = useRef(course);
  const coursesRef = useRef(courses);
  const loadRequestId = useRef(0);
  const transitionTimer = useRef(null);
  courseRef.current = course;
  coursesRef.current = courses;

  const load = async ({ showLoading = true } = {}) => {
    const requestId = ++loadRequestId.current;
    const isCurrentRequest = () => loadRequestId.current === requestId;
    if (showLoading) setLoading(true);
    setError("");
    const userId = apiClient.getUserId();
    let localDownloads = [];
    try {
      if (userId) localDownloads = await getDownloadedCourses(userId);
    } catch { /* Online course access remains available if IndexedDB is blocked or unsupported. */ }
    if (!isCurrentRequest()) return;
    setDownloadedCourses(localDownloads);
    if (!navigator.onLine) {
      const offlineState = resolveOfflineCourseState({
        downloads: localDownloads,
        currentCourse: courseRef.current,
        currentCourses: coursesRef.current,
        preferredId: localStorage.getItem("adapt_active_course_id"),
      });
      setOfflineOnly(offlineState.offlineOnly);
      setOfflineUnavailable(offlineState.offlineUnavailable);
      setCourses(offlineState.courses);
      setCourse(offlineState.course);
      if (offlineState.error) setError(offlineState.error);
      setLoading(false);
      return;
    }
    try {
      const [list, dashboard] = await Promise.all([api.courses(), api.dashboard()]);
      if (!isCurrentRequest()) return;
      setCourses(list);
      const preferredId = dashboard.activeCourseId || localStorage.getItem("adapt_active_course_id");
      const selected = list.find((item) => item.id === preferredId) || list.find((item) => item.id === dashboard.activeCourseId) || list[0] || null;
      setCourse(selected);
      setOfflineOnly(false);
      setOfflineUnavailable(false);
      if (selected) localStorage.setItem("adapt_active_course_id", selected.id);
    } catch (err) {
      if (!isCurrentRequest()) return;
      const offlineState = resolveOfflineCourseState({
        downloads: localDownloads,
        currentCourse: courseRef.current,
        currentCourses: coursesRef.current,
        preferredId: localStorage.getItem("adapt_active_course_id"),
      });
      setOfflineOnly(offlineState.offlineOnly);
      setOfflineUnavailable(offlineState.offlineUnavailable);
      setCourses(offlineState.courses);
      setCourse(offlineState.course);
      setError(offlineState.error || (offlineState.offlineUnavailable
        ? "The server is unavailable and this course has no saved offline copy. The content already on this page is being kept."
        : err.message || "Could not load your saved courses."));
    }
    finally { if (isCurrentRequest()) setLoading(false); }
  };

  useEffect(() => {
    void load();
    const onConnectivityChange = () => {
      setIsOnline(navigator.onLine);
      window.clearTimeout(transitionTimer.current);
      transitionTimer.current = window.setTimeout(() => void load({ showLoading: false }), 200);
    };
    window.addEventListener("online", onConnectivityChange);
    window.addEventListener("offline", onConnectivityChange);
    return () => {
      window.removeEventListener("online", onConnectivityChange);
      window.removeEventListener("offline", onConnectivityChange);
      window.clearTimeout(transitionTimer.current);
      loadRequestId.current += 1;
    };
  }, []);

  const openCourse = async (id) => {
    if (offlineOnly || !navigator.onLine) {
      const downloaded = downloadedCourses.find((record) => record.courseId === id);
      if (!downloaded) {
        setError("This course is not downloaded for offline use. Reconnect before opening it.");
        return;
      }
      const selected = courses.find((item) => item.id === id);
      if (selected) {
        localStorage.setItem("adapt_active_course_id", selected.id);
        setCourse(selected);
        setOfflineOnly(true);
        setOfflineUnavailable(false);
        setError("");
      }
      return;
    }
    try {
      const result = await api.activateCourse(id);
      localStorage.setItem("adapt_active_course_id", result.activeCourseId);
      await load();
    } catch (err) { setError(err.message); }
  };

  const downloadCurrentCourse = async () => {
    const userId = apiClient.getUserId();
    if (!userId || !course || !navigator.onLine) {
      setDownloadError("Connect to ADAPT before downloading a course.");
      return;
    }
    setDownloadingCourse(true);
    setDownloadError("");
    try {
      const record = await saveDownloadedCourse(userId, course);
      setDownloadedCourses((current) => [record, ...current.filter((item) => item.courseId !== record.courseId)]);
    } catch (err) {
      setDownloadError(err.message || "Could not save this course for offline use.");
    } finally { setDownloadingCourse(false); }
  };

  const removeCourseDownload = async (courseId) => {
    try {
      await removeDownloadedCourse(apiClient.getUserId(), courseId);
      setDownloadedCourses((current) => current.filter((record) => record.courseId !== courseId));
      setConfirmRemoveDownloadId(null);
      if (offlineOnly && course?.id === courseId) {
        const remaining = courses.filter((item) => item.id !== courseId);
        setCourses(remaining);
        setCourse(remaining[0] || null);
        if (!remaining.length) setError("No downloaded courses are available on this device yet.");
      }
    } catch (err) { setDownloadError(err.message || "Could not remove this offline download."); }
  };

  const startTopic = async (topicId) => {
    if (!course || !navigator.onLine) return;
    const topic = course.topics.find((item) => item.id === topicId);
    if (!topic) return;
    const unlocked = ["UNLOCKED", "LEARNING", "NEEDS_IMPROVEMENT", "STRONG"].includes(topic.learningState);
    if (!unlocked) {
      navigate(`/assessment?topicId=${encodeURIComponent(topicId)}`);
      return;
    }
    setBusyTopic(true);
    try {
      await api.activateTopic(course.id, topicId);
      navigate("/practice");
    } catch (err) { setError(err.message); }
    finally { setBusyTopic(false); }
  };

  const deleteCurrentCourse = async () => {
    if (!course || deletingCourse) return;
    setDeletingCourse(true);
    setError("");
    try {
      await api.deleteCourse(course.id);
      removeCourseFromLocal(course.id);
      await load();
      setShowDeleteDialog(false);
    } catch (err) { setError(err.message || "Could not delete this course."); }
    finally { setDeletingCourse(false); }
  };

  const content = loading ? <div className="card card-pad">Loading your saved courses…</div>
    : error && !course ? <div className="form-error" role="alert">{error}</div>
    : !course ? <div className="card card-pad"><h1 className="page-title">You haven't created a course yet.</h1><p className="page-subtitle" style={{ marginTop: 8 }}>When you're ready, tell ADAPT what you want to learn. Course creation is optional.</p><Link className="btn btn-primary" style={{ marginTop: 16 }} to="/onboarding">Create a course <Plus size={14} /></Link></div>
    : (() => {
      const status = course.assessmentStatus || "NOT_STARTED";
      const result = course.assessmentResult;
      const recommendedId = course.activeTopicId || course.recommendedTopicId || result?.recommendedTopicId;
      const recommended = course.topics.find((topic) => topic.id === recommendedId);
      return <>
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="flex-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 15 }}>
          <div><div className="eyebrow">{offlineOnly ? "DOWNLOADED COURSE · OFFLINE" : `YOUR COURSE${courses.length > 1 ? ` · ${courses.length} SAVED` : ""}`}</div><h1 className="page-title" style={{ marginTop: 8 }}>{course.title}</h1><p className="page-subtitle">Generated from: “{course.learningRequest}”</p></div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{!offlineOnly && <><button type="button" className="btn btn-download" onClick={downloadCurrentCourse} disabled={downloadingCourse || !isOnline || !apiClient.getUserId()}>{downloadingCourse ? "Saving course…" : downloadedCourses.some((record) => record.courseId === course.id) ? <><CheckCircle2 size={14} /> Update offline copy</> : <><Download size={14} /> Download for offline</>}</button><button type="button" className="btn" onClick={() => setShowDeleteDialog(true)} disabled={deletingCourse || !isOnline}>Delete Course</button>{isOnline && <Link className="btn" to="/onboarding?intent=learn"><Plus size={14} /> Create New Course</Link>}</>}</div>
        </div>

        {offlineOnly && <div className="offline-course-note" role="status" style={{ marginTop: 15 }}><WifiOff size={15} /><span>This downloaded course summary is stored on this device. Assessments, practice, and server progress require a connection.</span></div>}
        {!isOnline && offlineUnavailable && <div className="offline-course-note" role="status" style={{ marginTop: 15 }}><WifiOff size={15} /><span>This course has no saved offline copy. The content already on this page is being kept, but it may not be available after you leave or reopen it.</span></div>}
        {downloadError && <div className="form-error" role="alert" style={{ marginTop: 12 }}>{downloadError}</div>}

        {downloadedCourses.length > 0 && <section className="card card-pad download-manager" style={{ marginTop: 17 }}><div className="eyebrow">DOWNLOADED COURSES</div><div className="download-list">{downloadedCourses.map((record) => <div className="download-item" key={record.courseId}><div><strong>{record.title}</strong><div className="mini" style={{ marginTop: 4 }}>{record.topicCount} topic summaries · {formatStoredSize(record.sizeBytes)} · saved {new Date(record.downloadedAt).toLocaleDateString()}</div></div>{confirmRemoveDownloadId === record.courseId ? <div className="download-actions"><button type="button" className="btn" onClick={() => setConfirmRemoveDownloadId(null)}>Cancel</button><button type="button" className="btn btn-danger" onClick={() => removeCourseDownload(record.courseId)}><Trash2 size={13} /> Remove</button></div> : <button type="button" className="btn" aria-label={`Remove ${record.title} offline download`} onClick={() => setConfirmRemoveDownloadId(record.courseId)}><Trash2 size={13} /> Remove</button>}</div>)}</div></section>}

        {courses.length > 1 && <div className="grid grid-3" style={{ marginTop: 16 }}>{courses.map((item) => <button key={item.id} className={`card card-pad ${item.id === course.id ? "glow" : ""}`} style={{ textAlign: "left", color: "inherit" }} onClick={() => openCourse(item.id)}><div className="tiny">{item.id === course.id ? "CURRENT COURSE" : "OPEN COURSE"}</div><strong style={{ display: "block", marginTop: 6 }}>{item.title}</strong><span className="mini" style={{ display: "block", marginTop: 5 }}>{item.assessmentStatus === "COMPLETED" ? "Assessment complete" : item.assessmentStatus === "IN_PROGRESS" ? "Assessment in progress" : "Assessment not started"}</span></button>)}</div>}

        <section className="card card-pad glow" style={{ marginTop: 20 }}>
          <div className="eyebrow">{status === "COMPLETED" ? "ASSESSMENT RESULT" : status === "IN_PROGRESS" ? "ASSESSMENT IN PROGRESS" : "COURSE SETUP"}</div>
          {offlineOnly ? <>
            <h2 style={{ fontSize: 23, marginTop: 8 }}>Your course topics are available to read</h2>
            <p className="mini" style={{ marginTop: 7, lineHeight: 1.7 }}>Open a topic summary below. This download includes saved descriptions, objectives, and subtopics. Interactive assessments and adaptive practice need an internet connection.</p>
          </> : offlineUnavailable ? <>
            <h2 style={{ fontSize: 23, marginTop: 8 }}>This course is not saved for offline use</h2>
            <p className="mini" style={{ marginTop: 7, lineHeight: 1.7 }}>The course currently shown is being kept in this page. Reconnect before opening another page or restarting ADAPT to load it again.</p>
          </> : status === "COMPLETED" && result ? <>
            <h2 style={{ fontSize: 23, marginTop: 8 }}>Recommended starting point: {recommended?.name || result.recommendedTopic}</h2>
            <p className="mini" style={{ marginTop: 7, lineHeight: 1.7 }}>{getRecommendationExplanation(result)}</p>
            <div className="mini" style={{ marginTop: 10 }}>Level: {result.level} · Strengths: {result.strengths.length ? result.strengths.join(", ") : "Still forming"} · Areas to work on: {result.weaknesses.length ? result.weaknesses.join(", ") : "No assessed gaps"}</div>
            <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={() => startTopic(recommended?.id || course.activeTopicId || course.topics[0]?.id)} disabled={busyTopic}>Start Learning <ArrowRight size={14} /></button>
          </> : <>
            <h2 style={{ fontSize: 23, marginTop: 8 }}>{status === "IN_PROGRESS" ? "Resume your level assessment" : "Take a level assessment when you're ready"}</h2>
            <p className="mini" style={{ marginTop: 7, lineHeight: 1.7 }}>ADAPT will ask questions about this course and recommend a starting topic from your answers. You can explore the course topics any time.</p>
            <Link className="btn btn-primary" style={{ marginTop: 14 }} to="/assessment">{status === "IN_PROGRESS" ? "Resume Assessment" : "Take Level Assessment"} <ArrowRight size={14} /></Link>
          </>}
        </section>

        <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 24 }}><BookOpen size={17} /><h2 style={{ fontSize: 20 }}>Topics and modules</h2></div>
        <div className="grid grid-2" style={{ marginTop: 13 }}>{course.topics.map((topic) => {
          const isRecommended = topic.id === recommendedId;
          const assessed = topic.attempts > 0 || (result?.topicPerformance || []).some((item) => item.topicId === topic.id && item.total > 0);
          const performance = result?.topicPerformance?.find((item) => item.topicId === topic.id);
          const progress = topic.mastery ?? performance?.accuracy ?? 0;
          return <article className="card card-pad topic-card" style={{ "--subject-accent": getSubjectAccent(course.subject) }} key={topic.id}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}><span className="topic-marker">{topic.status === "mastered" ? <CheckCircle2 size={17} /> : <Circle size={17} />}</span>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}><strong>{topic.name}</strong><span className={`badge ${isRecommended && status === "COMPLETED" ? "recommended" : ""}`}>{(topic.learningState || "LOCKED").replaceAll("_", " ")}{isRecommended && status === "COMPLETED" ? " · RECOMMENDED" : ""}</span></div>
                <p className="mini" style={{ marginTop: 6 }}>{topic.description}</p>
                {(topic.learningObjectives?.length > 0 || topic.subtopics?.length > 0) && <details className="offline-lesson" open={offlineOnly || !isOnline} style={{ marginTop: 11 }}><summary>{offlineOnly ? "Read downloaded topic" : "View topic outline"}</summary>{topic.learningObjectives?.length > 0 && <div><strong>Learning objectives</strong><ul>{topic.learningObjectives.map((objective, index) => <li key={`${topic.id}-objective-${index}`}>{objective}</li>)}</ul></div>}{topic.subtopics?.length > 0 && <div><strong>Subtopics</strong><ul>{topic.subtopics.map((subtopic, index) => <li key={`${topic.id}-subtopic-${index}`}>{subtopic}</li>)}</ul></div>}</details>}
                <div className="progress-line" style={{ marginTop: 12 }}><span style={{ width: `${assessed ? progress : 0}%` }} /></div>
                <div className="tiny" style={{ marginTop: 7 }}>{assessed ? `${progress}% mastery · ${topic.attempts || performance?.total || 0} assessment/practice attempts` : "Not assessed yet"}</div>
                {!offlineOnly && isOnline && <button className="btn" style={{ marginTop: 11 }} onClick={() => startTopic(topic.id)} disabled={busyTopic}>{["UNLOCKED", "LEARNING", "NEEDS_IMPROVEMENT", "STRONG"].includes(topic.learningState) ? topic.learningState === "LEARNING" ? "Continue Topic" : "Start Learning" : topic.learningState === "ASSESSMENT_IN_PROGRESS" ? "Continue Assessment" : "Explore Topic"} <ArrowRight size={13} /></button>}
              </div>
            </div>
          </article>;
        })}</div>
        {!offlineOnly && isOnline && <div className="grid grid-3" style={{ marginTop: 17 }}><Link className="card card-pad" to="/tutor"><div className="eyebrow">TUTOR</div><div style={{ marginTop: 7 }}>Ask ADAPT about this course <ArrowRight size={13} /></div></Link><Link className="card card-pad" to="/practice"><div className="eyebrow">CHALLENGE ME</div><div style={{ marginTop: 7 }}>Practice your active topic <ArrowRight size={13} /></div></Link><Link className="card card-pad" to="/progress"><div className="eyebrow">PROGRESS</div><div style={{ marginTop: 7 }}>Review saved progress <ArrowRight size={13} /></div></Link></div>}
      </>;
    })();

  return <AppShell breadcrumb="COURSE">
    <div className="page">{content}</div>
    {showDeleteDialog && course && <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !deletingCourse) setShowDeleteDialog(false); }}>
      <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-course-title" aria-describedby="delete-course-description" onKeyDown={(event) => { if (event.key === "Escape" && !deletingCourse) setShowDeleteDialog(false); }}>
        <div className="eyebrow">DELETE COURSE</div>
        <h2 id="delete-course-title" className="confirm-dialog-title">Delete “{course.title}”?</h2>
        <p id="delete-course-description" className="confirm-dialog-copy">This will remove the course and its saved learning progress from your account.</p>
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="confirm-dialog-actions">
          <button type="button" className="btn" onClick={() => setShowDeleteDialog(false)} disabled={deletingCourse}>Cancel</button>
          <button type="button" className="btn btn-danger" onClick={deleteCurrentCourse} disabled={deletingCourse}>{deletingCourse ? "Deleting…" : "Delete Course"}</button>
        </div>
      </section>
    </div>}
  </AppShell>;
}
