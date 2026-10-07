import { Request, Response, NextFunction } from "express";
import { generateDiagnosticQuestions } from "../ai/diagnosticGenerator.js";
import { evaluateDiagnosticAssessment } from "../ai/assessmentEvaluator.js";
import { DiagnosticSubmissionSchema } from "../validators/schemas.js";
import { Course } from "../models/Course.js";
import { Question } from "../models/Question.js";
import { AssessmentAttempt } from "../models/AssessmentAttempt.js";
import type { AuthenticatedRequest } from "../middleware/requireAuth.js";

export async function getAssessmentSession(req: Request, res: Response, next: NextFunction) {
  try {
    const paramCourseId = req.params.courseId;
    const courseId = Array.isArray(paramCourseId) ? paramCourseId[0] : paramCourseId;
    const userId = (req as AuthenticatedRequest).auth?.userId || "";
    const selectedTopicId = typeof req.query.topicId === "string" ? req.query.topicId : undefined;
    const course = await Course.findOne({ id: courseId, userId });
    if (!course) return res.status(404).json({ message: "Course not found." });
    if (selectedTopicId && !course.topics.some((topic) => topic.id === selectedTopicId)) {
      return res.status(404).json({ message: "Topic not found in this course." });
    }

    const attempts = await AssessmentAttempt.find({
      userId,
      courseId,
      ...(selectedTopicId ? { topicId: selectedTopicId } : { topicId: { $in: [null, ""] } }),
    }).sort({ createdAt: -1 });
    const completed = attempts.find((attempt) => attempt.result && attempt.status !== "IN_PROGRESS");
    if (completed) {
      return res.json({ status: "COMPLETED", assessmentId: completed.id, result: completed.result });
    }

    let session = attempts.find((attempt) => attempt.status === "IN_PROGRESS");
    let questions = session?.questionIds?.length
      ? await Question.find({ id: { $in: session.questionIds }, courseId, type: "diagnostic", ...(selectedTopicId ? { topicId: selectedTopicId } : {}) })
      : [];
    let generatedClientQuestions: Array<{ id: string; topicId: string; difficulty: string; question: string; options: unknown }> | undefined;
    if (!session || questions.length !== session.questionIds.length) {
      const generated = await generateDiagnosticQuestions({ subjectId: course.subject.id, courseId, selectedTopicId });
      generatedClientQuestions = generated;
      session = new AssessmentAttempt({
        id: `assessment_${Date.now()}`,
        userId,
        courseId,
        subjectId: course.subject.id,
        topicId: selectedTopicId,
        status: "IN_PROGRESS",
        questionIds: generated.map((question) => question.id),
        pendingAnswers: [],
        answers: [],
      });
      await session.save();
      if (selectedTopicId) {
        const topic = course.topics.find((item) => item.id === selectedTopicId)!;
        topic.learningState = "ASSESSMENT_IN_PROGRESS";
        course.activeTopicId = selectedTopicId;
        await course.save();
      }
    }

    const byId = new Map(questions.map((question) => [question.id, question]));
    const generatedById = new Map(generatedClientQuestions?.map((question) => [question.id, question]));
    const clientQuestions = session.questionIds.map((id) => generatedById?.get(id) || byId.get(id)).filter(Boolean).map((question) => ({
      id: question!.id,
      topicId: question!.topicId,
      difficulty: question!.difficulty,
      question: question!.question,
      options: question!.options,
    }));
    return res.json({
      status: "IN_PROGRESS",
      topicId: selectedTopicId || null,
      assessmentId: session.id,
      questions: clientQuestions,
      answers: session.pendingAnswers || [],
    });
  } catch (error) {
    next(error);
  }
}

export async function saveAssessmentProgress(req: Request, res: Response, next: NextFunction) {
  try {
    const { assessmentId } = req.params;
    const userId = (req as AuthenticatedRequest).auth?.userId || "";
    const { answers } = req.body as {
      userId?: string;
      answers?: Array<{ questionId: string; selectedAnswer: string }>;
    };
    if (!userId || !Array.isArray(answers)) return res.status(400).json({ message: "userId and answers are required." });
    const session = await AssessmentAttempt.findOne({ id: assessmentId, userId, status: "IN_PROGRESS" });
    if (!session) return res.status(404).json({ message: "In-progress assessment not found." });
    const validIds = new Set(session.questionIds);
    if (answers.some((answer) => !validIds.has(answer.questionId) || typeof answer.selectedAnswer !== "string")) {
      return res.status(400).json({ message: "Assessment answers do not match this assessment." });
    }
    session.pendingAnswers = answers;
    await session.save();
    return res.json({ status: "IN_PROGRESS", assessmentId, answers: session.pendingAnswers });
  } catch (error) {
    next(error);
  }
}

export async function getDiagnosticQuestions(req: Request, res: Response, next: NextFunction) {
  try {
    const subjectId = req.params.subjectId || req.body.subjectId;
    const { courseId, selectedTopicId } = req.body;

    if (courseId) {
      const userId = (req as AuthenticatedRequest).auth?.userId;
      const ownedCourse = await Course.findOne({ id: courseId, userId });
      if (!ownedCourse) return res.status(404).json({ message: "Course not found." });
      if (selectedTopicId && !ownedCourse.topics.some((topic) => topic.id === selectedTopicId)) {
        return res.status(404).json({ message: "Topic not found in this course." });
      }
    }

    console.log(`[API] Fetching diagnostic questions for subject: ${subjectId}, course: ${courseId}`);
    const questions = await generateDiagnosticQuestions({
      subjectId,
      courseId,
      selectedTopicId,
    });

    res.json(questions);
  } catch (error) {
    next(error);
  }
}

export async function evaluateDiagnostic(req: Request, res: Response, next: NextFunction) {
  try {
    const validated = DiagnosticSubmissionSchema.parse(req.body) as Parameters<typeof evaluateDiagnosticAssessment>[0];
    const userId = (req as AuthenticatedRequest).auth?.userId;
    if (!userId) return res.status(401).json({ message: "Authentication required." });

    console.log(`[API] Evaluating diagnostic assessment for course: ${validated.courseId}`);
    const result = await evaluateDiagnosticAssessment({ ...validated, userId });

    res.json(result);
  } catch (error) {
    next(error);
  }
}
