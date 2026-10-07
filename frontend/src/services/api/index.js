import { apiClient } from "./apiClient";
import { mockService } from "./mockService";

const svc = () => (apiClient.USE_MOCK ? mockService : null);
const uid = () => apiClient.requireUserId();
const pendingAssessments = new Map();

function loadAssessment(courseId, topicId) {
  const key = `${apiClient.getToken() || "mock"}:${courseId}:${topicId || "course"}`;
  if (pendingAssessments.has(key)) return pendingAssessments.get(key);
  const request = svc()?.assessment?.(courseId, topicId) ?? apiClient.request(`/courses/${encodeURIComponent(courseId)}/assessment?userId=${encodeURIComponent(uid())}${topicId ? `&topicId=${encodeURIComponent(topicId)}` : ""}`);
  pendingAssessments.set(key, request);
  request.then(() => pendingAssessments.delete(key), () => pendingAssessments.delete(key));
  return request;
}

export const api = {
  // Auth
  register: (p) => svc()?.register(p) ?? apiClient.request("/auth/register", { method: "POST", body: JSON.stringify(p) }),
  login: (p) => svc()?.login(p) ?? apiClient.request("/auth/login", { method: "POST", body: JSON.stringify(p) }),
  logout: () => apiClient.request("/auth/logout", { method: "POST" }),
  me: () => svc()?.me() ?? apiClient.request(`/auth/me?userId=${uid()}`),

  // Courses
  courses: () => svc()?.courses?.() ?? apiClient.request(`/courses?userId=${encodeURIComponent(uid())}`),
  course: (courseId) => svc()?.course?.(courseId) ?? apiClient.request(`/courses/${encodeURIComponent(courseId)}?userId=${encodeURIComponent(uid())}`),
  activateCourse: (courseId) => svc()?.activateCourse?.(courseId) ?? apiClient.request(`/courses/${encodeURIComponent(courseId)}/activate`, { method: "POST", body: JSON.stringify({ userId: uid() }) }),
  deleteCourse: (courseId) => apiClient.request(`/courses/${encodeURIComponent(courseId)}`, { method: "DELETE" }),
  activateTopic: (courseId, topicId) => svc()?.activateTopic?.(courseId, topicId) ?? apiClient.request(`/courses/${encodeURIComponent(courseId)}/topics/${encodeURIComponent(topicId)}/activate`, { method: "POST", body: JSON.stringify({ userId: uid() }) }),
  generateCourse: (p) => svc()?.generateCourse(p) ?? apiClient.request("/course/generate", { method: "POST", body: JSON.stringify({ ...p, userId: uid() }) }),
  subjects: () => svc()?.subjectCatalog() ?? apiClient.request("/subjects"),

  // Diagnostic Assessment
  diagnosticQuestions: (p) => svc()?.diagnosticQuestions(p) ?? apiClient.request(`/courses/${p.subjectId}/diagnostic`, { method: "POST", body: JSON.stringify(p) }),
  assessment: loadAssessment,
  saveAssessmentProgress: (assessmentId, answers) => svc()?.saveAssessmentProgress?.(assessmentId, answers) ?? apiClient.request(`/assessments/${encodeURIComponent(assessmentId)}/progress`, { method: "PUT", body: JSON.stringify({ answers, userId: uid() }) }),
  evaluateDiagnostic: (p) => svc()?.evaluateDiagnostic(p) ?? apiClient.request("/assessment/diagnostic", { method: "POST", body: JSON.stringify({ ...p, userId: uid() }) }),

  // Practice
  nextPractice: (_id) => svc()?.nextPractice(_id) ?? apiClient.request(`/practice/next/${uid()}`),
  answerPractice: (p) => svc()?.answerPractice(p) ?? apiClient.request("/practice/answer", { method: "POST", body: JSON.stringify({ ...p, userId: uid() }) }),

  // Tutor
  tutorMessage: (p) => svc()?.tutorMessage(p) ?? apiClient.request("/tutor/message", { method: "POST", body: JSON.stringify({ ...p, userId: uid() }) }),

  // Dashboard & Progress
  dashboard: (_id) => svc()?.dashboard(_id) ?? apiClient.request(`/dashboard/${uid()}`),
  profile: (_id) => svc()?.profile(_id) ?? apiClient.request(`/profile/${uid()}`),
  progress: (_id) => svc()?.progress(_id) ?? apiClient.request(`/progress/${uid()}`),
  sync: (_id) => svc()?.sync(_id) ?? apiClient.request(`/sync/${uid()}`, { method: "POST" }),

  // Study Plan
  studyPlan: (_id) => svc()?.studyPlan(_id) ?? apiClient.request(`/study-plan/${uid()}`),
  completePlanItem: (_userId, itemId) => svc()?.completePlanItem(itemId) ?? apiClient.request(`/study-plan/${uid()}/item/${itemId}/complete`, { method: "POST" }),

  // Recommendations
  recommendations: (_id) => svc()?.getRecommendations(_id) ?? apiClient.request(`/recommendations/${uid()}`),

  // Voice
  voiceStart: (p) => svc()?.voiceStart(p) ?? apiClient.request("/voice/session", { method: "POST", body: JSON.stringify(p) }),
  voiceMessage: (p) => svc()?.voiceMessage(p) ?? apiClient.request("/voice/message", { method: "POST", body: JSON.stringify(p) }),
  voiceQuizEvaluate: (p) => svc()?.voiceQuizEvaluate(p) ?? apiClient.request("/voice/quiz/evaluate", { method: "POST", body: JSON.stringify(p) }),
};
