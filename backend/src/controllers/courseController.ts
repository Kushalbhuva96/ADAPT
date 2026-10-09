import { Request, Response, NextFunction } from "express";
import { generateCourseFromAI } from "../ai/courseGenerator.js";
import { Course } from "../models/Course.js";
import { Learner } from "../models/Learner.js";
import { AssessmentAttempt } from "../models/AssessmentAttempt.js";
import { CourseGenerationInputSchema } from "../validators/schemas.js";
import type { AuthenticatedRequest } from "../middleware/requireAuth.js";

const DEFAULT_SUBJECTS = [
  { id: "os", name: "Operating Systems", icon: "cpu", description: "Operating system fundamentals", totalTopics: 6, completedTopics: 0 },
  { id: "dbms", name: "Database Management", icon: "database", description: "Database concepts and systems", totalTopics: 4, completedTopics: 0 },
  { id: "ai", name: "Artificial Intelligence", icon: "brain", description: "Core artificial intelligence concepts", totalTopics: 4, completedTopics: 0 },
  { id: "web", name: "Web Development", icon: "globe", description: "Modern web development fundamentals", totalTopics: 4, completedTopics: 0 },
];

export async function generateCourse(req: Request, res: Response, next: NextFunction) {
  try {
    const requestStartedAt = performance.now();
    const validated = CourseGenerationInputSchema.parse(req.body);
    const userId = validated.userId;
    if (!userId) return res.status(401).json({ message: "Sign in to generate a course." });

    const result = await generateCourseFromAI(validated.learningRequest, userId);
    await Learner.updateOne({ id: userId }, { $set: { activeCourseId: result.course.id, activeTopicId: null } });
    console.info(`[Performance] Course generation API completed in ${Math.round(performance.now() - requestStartedAt)}ms.`);

    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getLearnerCourses(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = typeof req.query.userId === "string" ? req.query.userId : "";
    if (!userId) return res.status(400).json({ message: "userId is required." });
    const [courses, attempts] = await Promise.all([
      Course.find({ userId }).sort({ updatedAt: -1 }),
      AssessmentAttempt.find({ userId }).sort({ createdAt: -1 }),
    ]);
    const latestByCourse = new Map<string, typeof attempts[number]>();
    for (const attempt of attempts.filter((item) => !item.topicId)) {
      const previous = latestByCourse.get(attempt.courseId);
      if (!previous || (!previous.result && attempt.result)) latestByCourse.set(attempt.courseId, attempt);
    }
    res.json(courses.map((course) => {
      const attempt = latestByCourse.get(course.id);
      return {
        ...course.toObject(),
        assessmentStatus: attempt?.result ? "COMPLETED" : attempt ? "IN_PROGRESS" : "NOT_STARTED",
        assessmentId: attempt?.id || null,
        assessmentResult: attempt?.result || null,
      };
    }));
  } catch (error) {
    next(error);
  }
}

export async function activateLearnerCourse(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = typeof req.body.userId === "string" ? req.body.userId : "";
    const course = await Course.findOne({ id: req.params.id, userId });
    if (!course) return res.status(404).json({ message: "Course not found." });
    const learner = await Learner.findOneAndUpdate({ id: userId }, {
      $set: { activeCourseId: course.id, activeTopicId: course.activeTopicId || course.recommendedTopicId || null },
    }, { new: true });
    if (!learner) return res.status(404).json({ message: "Learner not found." });
    res.json({ course, activeCourseId: learner.activeCourseId });
  } catch (error) {
    next(error);
  }
}

export async function activateCourseTopic(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.auth?.userId || "";
    if (!userId) return res.status(401).json({ message: "Authentication required." });
    const paramCourseId = req.params.id;
    const courseId = Array.isArray(paramCourseId) ? paramCourseId[0] : paramCourseId;
    const paramTopicId = req.params.topicId;
    const topicId = Array.isArray(paramTopicId) ? paramTopicId[0] : paramTopicId;
    const course = await Course.findOne({ id: courseId, userId });
    if (!course || !course.topics.some((topic) => topic.id === topicId)) {
      return res.status(404).json({ message: "Course topic not found." });
    }
    const learner = await Learner.findOne({ id: userId });
    if (!learner) return res.status(404).json({ message: "Learner not found." });
    course.activeTopicId = topicId;
    if (["UNLOCKED", "LEARNING", "NEEDS_IMPROVEMENT", "STRONG"].includes(course.topics.find((topic) => topic.id === topicId)?.learningState || "")) {
      const selectedTopic = course.topics.find((topic) => topic.id === topicId)!;
      selectedTopic.learningState = "LEARNING";
    }
    learner.activeCourseId = course.id;
    learner.activeTopicId = topicId;
    await Promise.all([course.save(), learner.save()]);
    res.json({ courseId: course.id, topicId });
  } catch (error) {
    next(error);
  }
}

export async function getSubjects(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(DEFAULT_SUBJECTS);
  } catch (error) {
    next(error);
  }
}

export async function getCourseById(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = typeof req.query.userId === "string" ? req.query.userId : "";
    const course = await Course.findOne(userId ? { id: req.params.id, userId } : { id: req.params.id });
    if (!course) {
      return res.status(404).json({ message: "Course not found." });
    }
    res.json(course);
  } catch (error) {
    next(error);
  }
}

export async function getCourseTopics(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = typeof req.query.userId === "string" ? req.query.userId : "";
    const course = await Course.findOne(userId ? { id: req.params.id, userId } : { id: req.params.id });
    if (!course) {
      return res.status(404).json({ message: "Course not found." });
    }
    res.json(course.topics);
  } catch (error) {
    next(error);
  }
}

export async function deleteCourse(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ message: "Authentication required." });
    const course = await Course.findOneAndDelete({ id: req.params.id, userId });
    if (!course) return res.status(404).json({ message: "Course not found." });
    await Learner.updateOne(
      { id: userId, activeCourseId: course.id },
      { $set: { activeCourseId: null, activeTopicId: null } }
    );
    res.json({ success: true, deletedCourseId: course.id });
  } catch (error) { next(error); }
}
