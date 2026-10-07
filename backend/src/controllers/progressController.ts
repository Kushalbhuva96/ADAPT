import { Request, Response, NextFunction } from "express";
import { Progress } from "../models/Progress.js";
import { Learner } from "../models/Learner.js";
import { PracticeAttempt } from "../models/PracticeAttempt.js";
import { AssessmentAttempt } from "../models/AssessmentAttempt.js";

export async function getProgress(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.params.id;
    const [learner, storedProgress, practiceAttempts, assessments] = await Promise.all([
      Learner.findOne({ id: userId }),
      Progress.findOne({ userId }),
      PracticeAttempt.find({ userId }).sort({ createdAt: 1 }),
      AssessmentAttempt.find({ userId, result: { $exists: true } }).sort({ createdAt: -1 }),
    ]);
    if (!learner) return res.status(404).json({ message: "Learner not found." });

    const correct = practiceAttempts.filter((attempt) => attempt.correct).length;
    const accuracy = practiceAttempts.length ? Math.round((correct / practiceAttempts.length) * 100) : null;
    const learningMinutes = Math.round(practiceAttempts.reduce((sum, attempt) => sum + (attempt.timeTakenSeconds || 0), 0) / 60);
    const topicProgress = learner.topicMastery
      .filter((item) => item.attempts > 0)
      .map((item) => ({
        topicId: item.topicId,
        name: item.topicName || item.topicId,
        previous: null,
        current: item.score,
        change: null,
        accuracy: item.accuracy,
        attempts: item.attempts,
      }));

    res.json({
      userId,
      overall: {
        current: assessments.length || practiceAttempts.length ? learner.overallScore : null,
        previous: storedProgress?.overall?.previous ?? null,
        change: storedProgress?.overall?.change ?? null,
      },
      topicProgress,
      statistics: {
        questionsCompleted: practiceAttempts.length,
        learningMinutes,
        streakDays: storedProgress?.statistics?.streakDays ?? null,
        accuracy,
        assessmentCount: assessments.length,
      },
      hasLearningHistory: assessments.length > 0 || practiceAttempts.length > 0,
    });
  } catch (error) {
    next(error);
  }
}

export async function syncOffline(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.params.id;
    console.log(`[Sync] Received offline sync queue for user: ${userId}`);
    res.json({ status: "synced", pendingSyncCount: 0, lastSyncedAt: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
}
