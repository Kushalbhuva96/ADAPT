import { apiClient } from "./apiClient";
import { mockService } from "./mockService";

const svc = () => (apiClient.USE_MOCK ? mockService : null);
const uid = () => apiClient.getUserId();

export const api = {
  // Auth
  register: (p) => svc()?.register(p) ?? apiClient.request("/auth/register", { method: "POST", body: JSON.stringify(p) }),
  login: (p) => svc()?.login(p) ?? apiClient.request("/auth/login", { method: "POST", body: JSON.stringify(p) }),
  me: () => svc()?.me() ?? apiClient.request(`/auth/me?userId=${uid()}`),

  // Courses
  generateCourse: (p) => svc()?.generateCourse(p) ?? apiClient.request("/course/generate", { method: "POST", body: JSON.stringify({ ...p, userId: uid() }) }),
  subjects: () => svc()?.subjectCatalog() ?? apiClient.request("/subjects"),

  // Diagnostic Assessment
  diagnosticQuestions: (p) => svc()?.diagnosticQuestions(p) ?? apiClient.request(`/courses/${p.subjectId}/diagnostic`, { method: "POST", body: JSON.stringify(p) }),
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
