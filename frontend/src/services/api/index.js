import { apiClient } from "./apiClient";
import { mockService } from "./mockService";
import { cachedRequest, clearRuntimeCache } from "../runtimeCache";

const svc = () => (apiClient.USE_MOCK ? mockService : null);
const uid = () => apiClient.requireUserId();
const pendingAssessments = new Map();
const cacheScope = () => `learner:${uid()}`;
const invalidateLearner = () => clearRuntimeCache(cacheScope());

export function clearApiRuntimeState() {
  clearRuntimeCache();
  pendingAssessments.clear();
}

function loadAssessment(courseId, topicId) {
  const key = `${apiClient.getToken() || "mock"}:${courseId}:${topicId || "course"}`;
  return cachedRequest(`${cacheScope()}:assessment:${courseId}:${topicId || "course"}`, () => {
    if (pendingAssessments.has(key)) return pendingAssessments.get(key);
    const request = svc()?.assessment?.(courseId, topicId) ?? apiClient.request(`/courses/${encodeURIComponent(courseId)}/assessment?userId=${encodeURIComponent(uid())}${topicId ? `&topicId=${encodeURIComponent(topicId)}` : ""}`);
    pendingAssessments.set(key, request);
    const clearPending = () => { if (pendingAssessments.get(key) === request) pendingAssessments.delete(key); };
    request.then(clearPending, clearPending);
    return request;
  }, 15_000);
}

export const api = {
  // Auth
  register: (p) => svc()?.register(p) ?? apiClient.request("/auth/register", { method: "POST", body: JSON.stringify(p) }),
  login: (p) => svc()?.login(p) ?? apiClient.request("/auth/login", { method: "POST", body: JSON.stringify(p) }),
  logout: () => apiClient.request("/auth/logout", { method: "POST" }),
  me: () => svc()?.me() ?? apiClient.request(`/auth/me?userId=${uid()}`),

  // Courses
  courses: () => cachedRequest(`${cacheScope()}:courses`, () => svc()?.courses?.() ?? apiClient.request(`/courses?userId=${encodeURIComponent(uid())}`), 30_000),
  course: (courseId) => cachedRequest(`${cacheScope()}:course:${courseId}`, () => svc()?.course?.(courseId) ?? apiClient.request(`/courses/${encodeURIComponent(courseId)}?userId=${encodeURIComponent(uid())}`), 5 * 60_000),
  activateCourse: async (courseId) => { const value = await (svc()?.activateCourse?.(courseId) ?? apiClient.request(`/courses/${encodeURIComponent(courseId)}/activate`, { method: "POST", body: JSON.stringify({ userId: uid() }) })); invalidateLearner(); return value; },
  deleteCourse: async (courseId) => { const value = await apiClient.request(`/courses/${encodeURIComponent(courseId)}`, { method: "DELETE" }); invalidateLearner(); return value; },
  activateTopic: async (courseId, topicId) => { const value = await (svc()?.activateTopic?.(courseId, topicId) ?? apiClient.request(`/courses/${encodeURIComponent(courseId)}/topics/${encodeURIComponent(topicId)}/activate`, { method: "POST", body: JSON.stringify({ userId: uid() }) })); invalidateLearner(); return value; },
  generateCourse: async (p) => { const value = await (svc()?.generateCourse(p) ?? apiClient.request("/course/generate", { method: "POST", body: JSON.stringify({ ...p, userId: uid() }) })); invalidateLearner(); return value; },
  subjects: () => svc()?.subjectCatalog() ?? apiClient.request("/subjects"),

  // Diagnostic Assessment
  diagnosticQuestions: (p) => svc()?.diagnosticQuestions(p) ?? apiClient.request(`/courses/${p.subjectId}/diagnostic`, { method: "POST", body: JSON.stringify(p) }),
  assessment: loadAssessment,
  saveAssessmentProgress: async (assessmentId, answers) => { const value = await (svc()?.saveAssessmentProgress?.(assessmentId, answers) ?? apiClient.request(`/assessments/${encodeURIComponent(assessmentId)}/progress`, { method: "PUT", body: JSON.stringify({ answers, userId: uid() }) })); invalidateLearner(); return value; },
  evaluateDiagnostic: async (p) => { const value = await (svc()?.evaluateDiagnostic(p) ?? apiClient.request("/assessment/diagnostic", { method: "POST", body: JSON.stringify({ ...p, userId: uid() }) })); invalidateLearner(); return value; },

  // Practice
  nextPractice: (_id) => svc()?.nextPractice(_id) ?? apiClient.request(`/practice/next/${uid()}`),
  answerPractice: async (p) => { const value = await (svc()?.answerPractice(p) ?? apiClient.request("/practice/answer", { method: "POST", body: JSON.stringify({ ...p, userId: uid() }) })); invalidateLearner(); return value; },

  // Tutor
  tutorMessage: (p) => svc()?.tutorMessage(p) ?? apiClient.request("/tutor/message", { method: "POST", body: JSON.stringify({ ...p, userId: uid() }) }),

  // Dashboard & Progress
  dashboard: (_id) => cachedRequest(`${cacheScope()}:dashboard`, () => svc()?.dashboard(_id) ?? apiClient.request(`/dashboard/${uid()}`), 10_000),
  profile: (_id) => svc()?.profile(_id) ?? apiClient.request(`/profile/${uid()}`),
  progress: (_id) => cachedRequest(`${cacheScope()}:progress`, () => svc()?.progress(_id) ?? apiClient.request(`/progress/${uid()}`), 15_000),
  sync: (_id) => svc()?.sync(_id) ?? apiClient.request(`/sync/${uid()}`, { method: "POST" }),

  // Study Plan
  studyPlan: (_id) => cachedRequest(`${cacheScope()}:study-plan`, () => svc()?.studyPlan(_id) ?? apiClient.request(`/study-plan/${uid()}`), 30_000),
  completePlanItem: async (_userId, itemId) => { const value = await (svc()?.completePlanItem(itemId) ?? apiClient.request(`/study-plan/${uid()}/item/${itemId}/complete`, { method: "POST" })); invalidateLearner(); return value; },

  // Recommendations
  recommendations: (_id) => svc()?.getRecommendations(_id) ?? apiClient.request(`/recommendations/${uid()}`),

  // Voice
  voiceStart: (p) => svc()?.voiceStart(p) ?? apiClient.request("/voice/session", { method: "POST", body: JSON.stringify(p) }),
  voiceMessage: (p) => svc()?.voiceMessage(p) ?? apiClient.request("/voice/message", { method: "POST", body: JSON.stringify(p) }),
  voiceQuizEvaluate: (p) => svc()?.voiceQuizEvaluate(p) ?? apiClient.request("/voice/quiz/evaluate", { method: "POST", body: JSON.stringify(p) }),
};
