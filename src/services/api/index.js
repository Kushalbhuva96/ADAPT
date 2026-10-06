import { apiClient } from "./apiClient";
import { mockService } from "./mockService";
const service = () => apiClient.USE_MOCK ? mockService : null;
export const api = {
  generateCourse: p => service()?.generateCourse(p) ?? apiClient.request("/course/generate",{method:"POST",body:JSON.stringify(p)}),
  subjects: () => service()?.subjectCatalog() ?? apiClient.request("/subjects"),
  diagnosticQuestions: p => service()?.diagnosticQuestions(p) ?? apiClient.request(`/courses/${p.subjectId}/diagnostic`,{method:"POST",body:JSON.stringify(p)}),
  evaluateDiagnostic: p => service()?.evaluateDiagnostic(p) ?? apiClient.request("/assessment/diagnostic",{method:"POST",body:JSON.stringify(p)}),
  register: p => service()?.register(p) ?? apiClient.request("/auth/register",{method:"POST",body:JSON.stringify(p)}),
  login: p => service()?.login(p) ?? apiClient.request("/auth/login",{method:"POST",body:JSON.stringify(p)}),
  me: () => service()?.me() ?? apiClient.request("/auth/me"),
  dashboard: id => service()?.dashboard(id) ?? apiClient.request(`/dashboard/${id}`),
  profile: id => service()?.profile(id) ?? apiClient.request(`/profile/${id}`),
  nextPractice: id => service()?.nextPractice(id) ?? apiClient.request(`/practice/next/${id}`),
  answerPractice: p => service()?.answerPractice(p) ?? apiClient.request("/practice/answer",{method:"POST",body:JSON.stringify(p)}),
  tutorMessage: p => service()?.tutorMessage(p) ?? apiClient.request("/tutor/message",{method:"POST",body:JSON.stringify(p)}),
  studyPlan: id => service()?.studyPlan(id) ?? apiClient.request(`/study-plan/${id}`),
  completePlanItem: (userId,itemId) => service()?.completePlanItem(itemId) ?? apiClient.request(`/study-plan/${userId}/item/${itemId}/complete`,{method:"POST"}),
  progress: id => service()?.progress(id) ?? apiClient.request(`/progress/${id}`),
  voiceStart: p => service()?.voiceStart(p) ?? apiClient.request("/voice/session",{method:"POST",body:JSON.stringify(p)}),
  voiceMessage: p => service()?.voiceMessage(p) ?? apiClient.request("/voice/message",{method:"POST",body:JSON.stringify(p)}),
  voiceQuizEvaluate: p => service()?.voiceQuizEvaluate(p) ?? apiClient.request("/voice/quiz/evaluate",{method:"POST",body:JSON.stringify(p)}),
  sync: id => service()?.sync(id) ?? apiClient.request(`/sync/${id}`,{method:"POST"}),
  recommendations: id => service()?.getRecommendations(id) ?? apiClient.request(`/recommendations/${id}`)
};
