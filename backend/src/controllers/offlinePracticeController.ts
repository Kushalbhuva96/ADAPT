import { Request, Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../middleware/requireAuth.js";
import { AssessmentAttempt } from "../models/AssessmentAttempt.js";
import { Course } from "../models/Course.js";
import { PracticeAttempt } from "../models/PracticeAttempt.js";
import { PracticeSubmission } from "../models/PracticeSubmission.js";
import { Question } from "../models/Question.js";
import { getNextPracticeQuestion, submitPracticeAnswer } from "../ai/practiceEngine.js";
import { OfflinePracticeSyncSchema } from "../validators/schemas.js";
import type { z } from "zod";

type OfflineActivity = z.infer<typeof OfflinePracticeSyncSchema>["activities"][number];
type SubmitPracticeAnswer = typeof submitPracticeAnswer;

const PRACTICE_READY_STATES = ["UNLOCKED", "LEARNING", "NEEDS_IMPROVEMENT", "STRONG"];
const MAX_DOWNLOADED_QUESTIONS = 20;

export function publicPracticeQuestion(question: any, course: any) {
  const topic = course.topics.find((item: any) => item.id === question.topicId);
  return {
    id: question.id,
    courseId: question.courseId,
    topicId: question.topicId,
    topicName: topic?.name || question.topicId,
    difficulty: question.difficulty,
    question: question.question,
    options: question.options.map((option: any) => ({ id: option.id, text: option.text })),
  };
}

export async function processOfflinePracticeActivities(
  userId: string,
  activities: OfflineActivity[],
  submit: SubmitPracticeAnswer = submitPracticeAnswer
) {
  const acknowledgements = [];
  for (const activity of activities) {
    try {
      const result = await submit({
        userId,
        questionId: activity.questionId,
        selectedOptionId: activity.selectedOptionId,
        timeTakenSeconds: activity.timeTakenSeconds,
        clientAttemptId: activity.activityId,
        courseId: activity.courseId,
        topicId: activity.topicId,
      });
      acknowledgements.push({ activityId: activity.activityId, status: "synced" as const, result });
    } catch (error) {
      const failure = error as Error & { code?: string; status?: number };
      acknowledgements.push({
        activityId: activity.activityId,
        status: "pending" as const,
        code: failure.code || "SYNC_FAILED",
        message: failure.message || "This activity could not be synced yet.",
      });
    }
  }
  return acknowledgements;
}

export async function downloadOfflinePractice(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = req as AuthenticatedRequest;
    const userId = auth.auth?.userId;
    const courseId = req.params.courseId;
    if (!userId) return res.status(401).json({ message: "Authentication required." });

    const course = await Course.findOne({ id: courseId, userId });
    if (!course) return res.status(404).json({ message: "Course not found." });
    const completedAssessment = await AssessmentAttempt.exists({ userId, courseId, result: { $exists: true } });
    if (!completedAssessment) {
      return res.status(409).json({ message: "Complete this course's level assessment online before downloading practice questions.", code: "COURSE_ASSESSMENT_REQUIRED" });
    }

    const readyTopicIds = course.topics.filter((topic) => PRACTICE_READY_STATES.includes(topic.learningState || "")).map((topic) => topic.id);
    if (!readyTopicIds.length) {
      return res.status(409).json({ message: "Complete a topic assessment online before downloading practice questions.", code: "TOPIC_ASSESSMENT_REQUIRED" });
    }

    const [attemptedQuestionIds, submittedQuestionIds] = await Promise.all([
      PracticeAttempt.distinct("questionId", { userId, courseId }),
      PracticeSubmission.distinct("questionId", { userId }),
    ]);
    const excludedQuestionIds = [...new Set([...attemptedQuestionIds, ...submittedQuestionIds])];
    let questions = await Question.find({
      courseId,
      topicId: { $in: readyTopicIds },
      type: "practice",
      id: { $nin: excludedQuestionIds },
    }).sort({ createdAt: -1 }).limit(MAX_DOWNLOADED_QUESTIONS).lean();

    if (!questions.length) {
      const learnerQuestion = await getNextPracticeQuestion(userId);
      if (learnerQuestion.courseId !== courseId) {
        return res.status(409).json({ message: "Activate this course before downloading its practice questions.", code: "COURSE_NOT_ACTIVE" });
      }
      questions = await Question.find({
        courseId,
        topicId: { $in: readyTopicIds },
        type: "practice",
        id: { $nin: excludedQuestionIds },
      }).sort({ createdAt: -1 }).limit(MAX_DOWNLOADED_QUESTIONS).lean();
    }

    return res.json({
      courseId,
      downloadedAt: new Date().toISOString(),
      grading: "server",
      questions: questions.map((question) => publicPracticeQuestion(question, course)),
    });
  } catch (error) {
    next(error);
  }
}

export async function syncOfflinePractice(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = req as AuthenticatedRequest;
    const userId = auth.auth?.userId;
    if (!userId) return res.status(401).json({ message: "Authentication required." });
    const { activities } = OfflinePracticeSyncSchema.parse(req.body);
    const acknowledgements = await processOfflinePracticeActivities(userId, activities);
    return res.json({ acknowledgements });
  } catch (error) {
    next(error);
  }
}
