import { Request, Response, NextFunction } from "express";
import { Progress } from "../models/Progress.js";
import { Learner } from "../models/Learner.js";

export async function getProgress(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.params.id || "user_001";
    let progress = await Progress.findOne({ userId });

    if (!progress) {
      const learner = await Learner.findOne({ id: userId });
      const overall = learner?.overallScore || 67;

      progress = new Progress({
        userId,
        overall: { current: overall, previous: Math.max(20, overall - 18), change: 18 },
        topicProgress: (learner?.topicMastery || []).map((m) => ({
          topicId: m.topicId,
          name: m.topicName || m.topicId,
          previous: Math.max(10, m.score - 15),
          current: m.score,
          change: 15,
        })),
        statistics: {
          questionsCompleted: 24,
          learningMinutes: 120,
          streakDays: 4,
          accuracy: 78,
        },
      });
      await progress.save();
    }

    res.json(progress);
  } catch (error) {
    next(error);
  }
}

export async function syncOffline(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.params.id || "user_001";
    console.log(`[Sync] Received offline sync queue for user: ${userId}`);

    // Idempotent sync acknowledgment
    res.json({
      status: "synced",
      pendingSyncCount: 0,
      lastSyncedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}
