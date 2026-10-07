import { Request, Response, NextFunction } from "express";
import { StudyPlan } from "../models/StudyPlan.js";
import { Learner } from "../models/Learner.js";
import { Course } from "../models/Course.js";
import { AssessmentAttempt } from "../models/AssessmentAttempt.js";

export async function getStudyPlan(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.params.id;
    const learner = await Learner.findOne({ id: userId });
    if (!learner) return res.status(404).json({ message: "Learner not found." });
    let course = learner.activeCourseId ? await Course.findOne({ id: learner.activeCourseId, userId }) : null;
    if (!course && !learner.activeCourseId) {
      course = await Course.findOne({ userId }).sort({ updatedAt: -1 });
      if (course) {
        learner.activeCourseId = course.id;
        learner.activeTopicId = course.activeTopicId || course.recommendedTopicId || null;
        await learner.save();
      }
    }
    const assessment = course
      ? await AssessmentAttempt.findOne({ userId, courseId: course.id, result: { $exists: true } }).sort({ createdAt: -1 })
      : null;
    if (!course || !assessment?.result) {
      return res.json({ status: "not_ready", course: course ? { id: course.id, title: course.title } : null, items: [], totalMinutes: 0 });
    }

    const topicId = course.activeTopicId || assessment.result.recommendedTopicId;
    const topic = course.topics.find((item) => item.id === topicId);
    if (!topic) return res.json({ status: "not_ready", course: { id: course.id, title: course.title }, items: [], totalMinutes: 0 });

    let plan = await StudyPlan.findOne({ userId, courseId: course.id });
    if (!plan || plan.items.some((item) => item.topicId !== topic.id)) {
      plan = new StudyPlan({
        id: `plan_${userId}_${course.id}_${Date.now()}`,
        userId,
        courseId: course.id,
        date: new Date().toISOString().split("T")[0],
        totalMinutes: 20,
        items: [
          { id: `review_${topic.id}`, title: `Review ${topic.name}`, topicId: topic.id, durationMinutes: 5, type: "review", status: "pending" },
          { id: `lesson_${topic.id}`, title: `Study ${topic.name} objectives`, topicId: topic.id, durationMinutes: 8, type: "lesson", status: "pending" },
          { id: `practice_${topic.id}`, title: `Practice ${topic.name}`, topicId: topic.id, durationMinutes: 5, type: "practice", status: "pending" },
          { id: `recall_${topic.id}`, title: `Recall ${topic.name}`, topicId: topic.id, durationMinutes: 2, type: "recall", status: "pending" },
        ],
      });
      await plan.save();
    }
    res.json({ ...plan.toObject(), status: "ready", course: { id: course.id, title: course.title }, topic: { id: topic.id, name: topic.name } });
  } catch (error) {
    next(error);
  }
}

export async function completePlanItem(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, itemId } = req.params;
    const plan = await StudyPlan.findOne({ userId, "items.id": itemId });
    if (!plan) return res.status(404).json({ message: "Study plan not found." });
    plan.items = plan.items.map((item) => item.id === itemId ? { ...item, status: "completed" } : item);
    await plan.save();
    res.json(plan);
  } catch (error) {
    next(error);
  }
}
