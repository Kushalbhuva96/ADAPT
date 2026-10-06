import { Request, Response, NextFunction } from "express";
import { StudyPlan } from "../models/StudyPlan.js";
import { Learner } from "../models/Learner.js";

export async function getStudyPlan(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.params.id || "user_001";
    let plan = await StudyPlan.findOne({ userId });

    if (!plan) {
      const learner = await Learner.findOne({ id: userId });
      const activeTopic = learner?.activeTopicId || "core_concept";

      plan = new StudyPlan({
        id: `plan_${Date.now()}`,
        userId,
        date: new Date().toISOString().split("T")[0],
        totalMinutes: 20,
        items: [
          {
            id: "plan_item_1",
            title: "Review Foundational Concepts",
            topicId: activeTopic,
            durationMinutes: 5,
            type: "review",
            status: "pending",
          },
          {
            id: "plan_item_2",
            title: "Deep Dive Concept Module",
            topicId: activeTopic,
            durationMinutes: 8,
            type: "lesson",
            status: "pending",
          },
          {
            id: "plan_item_3",
            title: "Practice 3 Adaptive Questions",
            topicId: activeTopic,
            durationMinutes: 5,
            type: "practice",
            status: "pending",
          },
          {
            id: "plan_item_4",
            title: "Quick Spaced Recall",
            topicId: activeTopic,
            durationMinutes: 2,
            type: "recall",
            status: "pending",
          },
        ],
      });
      await plan.save();
    }

    res.json(plan);
  } catch (error) {
    next(error);
  }
}

export async function completePlanItem(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId = "user_001", itemId } = req.params;
    let plan = await StudyPlan.findOne({ userId });

    if (plan) {
      plan.items = plan.items.map((item) =>
        item.id === itemId ? { ...item, status: "completed" } : item
      );
      await plan.save();
    }

    res.json(plan);
  } catch (error) {
    next(error);
  }
}
