import { Router } from "express";
import mongoose from "mongoose";
import { register, login, getMe, getProfile, logout } from "../controllers/authController.js";
import { generateCourse, getSubjects, getCourseById, getCourseTopics, getLearnerCourses, activateLearnerCourse, activateCourseTopic, deleteCourse } from "../controllers/courseController.js";
import { getDiagnosticQuestions, evaluateDiagnostic, getAssessmentSession, saveAssessmentProgress } from "../controllers/assessmentController.js";
import { getNextPractice, answerPractice } from "../controllers/practiceController.js";
import { getDashboard } from "../controllers/dashboardController.js";
import { sendTutorMessage, getRecommendations } from "../controllers/tutorController.js";
import { getStudyPlan, completePlanItem } from "../controllers/studyPlanController.js";
import { getProgress, syncOffline } from "../controllers/progressController.js";
import { voiceStart, voiceMessage, voiceQuizEvaluate } from "../controllers/voiceController.js";
import { requireAuth } from "../middleware/requireAuth.js";

export const apiRouter = Router();

// Health check endpoint
apiRouter.get(["/health", "/v1/health"], (req, res) => {
  const dbConnected = mongoose.connection.readyState === 1;
  const aiConfigured = process.env.AI_PROVIDER === "google" && Boolean(process.env.AI_API_KEY) && Boolean(process.env.AI_MODEL) && Boolean(process.env.AI_FALLBACK_MODEL);

  res.json({
    status: dbConnected ? "ok" : "degraded",
    database: dbConnected ? "connected" : "disconnected",
    ai: aiConfigured ? "configured" : "misconfigured",
    provider: process.env.AI_PROVIDER || null,
    model: process.env.AI_MODEL || null,
    timestamp: new Date().toISOString(),
  });
});

// Authentication & Profile
apiRouter.post(["/auth/register", "/v1/auth/register"], register);
apiRouter.post(["/auth/login", "/v1/auth/login"], login);
apiRouter.get(["/subjects", "/v1/subjects"], getSubjects);

apiRouter.use(requireAuth);

apiRouter.post(["/auth/logout", "/v1/auth/logout"], logout);
apiRouter.get(["/auth/me", "/v1/auth/me"], getMe);
apiRouter.get(["/profile/:id", "/v1/learners/:id"], getProfile);

// Courses
apiRouter.post(["/course/generate", "/v1/courses/generate"], generateCourse);
apiRouter.get(["/courses", "/v1/courses"], getLearnerCourses);
apiRouter.delete(["/courses/:id", "/v1/courses/:id"], deleteCourse);
apiRouter.post(["/courses/:id/activate", "/v1/courses/:id/activate"], activateLearnerCourse);
apiRouter.post(["/courses/:id/topics/:topicId/activate", "/v1/courses/:id/topics/:topicId/activate"], activateCourseTopic);
apiRouter.get(["/courses/:id", "/v1/courses/:id"], getCourseById);
apiRouter.get(["/courses/:id/topics", "/v1/courses/:id/topics"], getCourseTopics);
apiRouter.get(["/courses/:courseId/assessment", "/v1/courses/:courseId/assessment"], getAssessmentSession);
apiRouter.put(["/assessments/:assessmentId/progress", "/v1/assessments/:assessmentId/progress"], saveAssessmentProgress);

// Diagnostic Assessments
apiRouter.post(["/courses/:subjectId/diagnostic", "/v1/assessments/diagnostic"], getDiagnosticQuestions);
apiRouter.post(["/assessment/diagnostic", "/v1/assessments/:id/submit"], evaluateDiagnostic);

// Practice
apiRouter.get(["/practice/next/:id", "/v1/practice/next/:id"], getNextPractice);
apiRouter.post(["/practice/answer", "/v1/practice/answer"], answerPractice);

// Tutor & Recommendations
apiRouter.post(["/tutor/message", "/v1/tutor/message"], sendTutorMessage);
apiRouter.get(["/recommendations/:id", "/v1/learners/:id/recommendations"], getRecommendations);

// Dashboard & Progress
apiRouter.get(["/dashboard/:id", "/v1/dashboard/:id"], getDashboard);
apiRouter.get(["/progress/:id", "/v1/learners/:id/progress"], getProgress);
apiRouter.post(["/sync/:id", "/v1/progress/sync"], syncOffline);

// Study Plan
apiRouter.get(["/study-plan/:id", "/v1/study-plan/:id"], getStudyPlan);
apiRouter.post(["/study-plan/:userId/item/:itemId/complete", "/v1/study-plan/:userId/item/:itemId/complete"], completePlanItem);

// Voice
apiRouter.post(["/voice/session", "/v1/voice/session"], voiceStart);
apiRouter.post(["/voice/message", "/v1/voice/message"], voiceMessage);
apiRouter.post(["/voice/quiz/evaluate", "/v1/voice/quiz/evaluate"], voiceQuizEvaluate);
