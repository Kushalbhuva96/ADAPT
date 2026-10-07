import { Request, Response, NextFunction } from "express";
import { Learner } from "../models/Learner.js";
import { Recommendation } from "../models/Recommendation.js";
import { Progress } from "../models/Progress.js";
import { Course } from "../models/Course.js";
import { AssessmentAttempt } from "../models/AssessmentAttempt.js";
import { PracticeAttempt } from "../models/PracticeAttempt.js";

export async function getDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.params.id;
    const learner = await Learner.findOne({ id: userId });
    if (!learner) return res.status(404).json({ message: "Learner not found." });

    const [progress, rec, practiceCount, correctPracticeCount] = await Promise.all([
      Progress.findOne({ userId }),
      Recommendation.findOne({ userId }).sort({ createdAt: -1 }),
      PracticeAttempt.countDocuments({ userId }),
      PracticeAttempt.countDocuments({ userId, correct: true }),
    ]);
    let activeCourse = learner.activeCourseId ? await Course.findOne({ id: learner.activeCourseId, userId }) : null;
    if (!activeCourse && !learner.activeCourseId) {
      activeCourse = await Course.findOne({ userId }).sort({ updatedAt: -1 });
      if (activeCourse) {
        learner.activeCourseId = activeCourse.id;
        learner.activeTopicId = activeCourse.activeTopicId || activeCourse.recommendedTopicId || null;
        await learner.save();
      }
    }
    const assessment = activeCourse
      ? await AssessmentAttempt.findOne({ userId, courseId: activeCourse.id, result: { $exists: true } }).sort({ createdAt: -1 })
      : null;

    const weakTopics = (learner.topicMastery || [])
      .filter((item) => item.attempts > 0 && item.score < 70)
      .map((item) => ({ topicId: item.topicId, name: item.topicName || item.topicId, score: item.score }));
    const hasLearningHistory = Boolean(assessment || practiceCount > 0);

    res.json({
      user: { id: learner.id, name: learner.name, email: learner.email },
      course: activeCourse,
      activeCourseId: learner.activeCourseId || null,
      assessment: assessment?.result || null,
      hasLearningHistory,
      learningHealth: hasLearningHistory ? {
        score: progress?.overall?.current ?? learner.overallScore,
        weeklyChange: progress?.overall?.change ?? null,
      } : null,
      momentum: {
        streakDays: progress?.statistics?.streakDays ?? null,
        questionsAnswered: practiceCount,
        weeklyAccuracy: practiceCount ? Math.round((correctPracticeCount / practiceCount) * 100) : null,
        weeklyImprovement: progress?.overall?.change ?? null,
      },
      weakTopics,
      recommendation: rec ? {
        topicId: rec.topicId,
        title: rec.title,
        reason: rec.reason,
        durationMinutes: rec.durationMinutes,
      } : null,
      aiInsight: hasLearningHistory
        ? (weakTopics[0] ? `Your saved results show ${weakTopics[0].name} needs more practice.` : "Your saved learning results are shaping the next recommendation.")
        : "Your learning profile will form as you complete a course assessment and practice.",
    });
  } catch (error) {
    next(error);
  }
}
