import { Request, Response, NextFunction } from "express";
import { Learner } from "../models/Learner.js";
import { Recommendation } from "../models/Recommendation.js";
import { Progress } from "../models/Progress.js";
import { Course } from "../models/Course.js";

export async function getDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.params.id || "user_001";
    let learner = await Learner.findOne({ id: userId });
    if (!learner) {
      learner = await Learner.findOne() || new Learner({
        id: "user_001",
        name: "Alex",
        email: "alex@example.com",
      });
      await learner.save();
    }

    const progress = await Progress.findOne({ userId });
    const rec = await Recommendation.findOne({ userId }).sort({ createdAt: -1 });
    const activeCourse = learner.activeCourseId ? await Course.findOne({ id: learner.activeCourseId }) : null;

    // Calculate weak topics from learner topic mastery (< 70 score)
    const weakTopics = (learner.topicMastery || [])
      .filter((m) => m.score < 70)
      .map((m) => ({
        topicId: m.topicId,
        name: m.topicName || m.topicId,
        score: m.score,
      }));

    if (weakTopics.length === 0 && activeCourse?.topics?.length) {
      weakTopics.push({
        topicId: activeCourse.topics[0].id,
        name: activeCourse.topics[0].name,
        score: 50,
      });
    }

    const overallScore = learner.overallScore || 67;

    const response = {
      user: { name: learner.name || "Learner" },
      learningHealth: {
        score: overallScore,
        weeklyChange: progress?.overall?.change || 12,
      },
      momentum: {
        streakDays: progress?.statistics?.streakDays || 4,
        questionsAnswered: progress?.statistics?.questionsCompleted || 24,
        weeklyAccuracy: progress?.statistics?.accuracy || Math.round(overallScore),
        weeklyImprovement: 14,
      },
      weakTopics: weakTopics.length ? weakTopics : [{ topicId: "foundations", name: "Core Concepts", score: 45 }],
      recommendation: rec
        ? {
            topicId: rec.topicId,
            title: rec.title,
            durationMinutes: rec.durationMinutes,
          }
        : {
            topicId: activeCourse?.recommendedTopicId || "topic_1",
            title: "Reinforce Foundational Concepts",
            durationMinutes: 15,
          },
      aiInsight:
        learner.learningBehavior?.conceptUnderstanding > learner.learningBehavior?.application
          ? "Your conceptual recall is high. ADAPT will prioritize application-oriented problem solving."
          : "You learn application concepts better after seeing a concrete, real-world example.",
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
}
