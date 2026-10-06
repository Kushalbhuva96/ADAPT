import { Request, Response, NextFunction } from "express";
import { generateCourseFromAI } from "../ai/courseGenerator.js";
import { Course } from "../models/Course.js";
import { CourseGenerationInputSchema } from "../validators/schemas.js";

const DEFAULT_SUBJECTS = [
  { id: "os", name: "Operating Systems", icon: "cpu", description: "Operating system fundamentals", totalTopics: 6, completedTopics: 0 },
  { id: "dbms", name: "Database Management", icon: "database", description: "Database concepts and systems", totalTopics: 4, completedTopics: 0 },
  { id: "ai", name: "Artificial Intelligence", icon: "brain", description: "Core artificial intelligence concepts", totalTopics: 4, completedTopics: 0 },
  { id: "web", name: "Web Development", icon: "globe", description: "Modern web development fundamentals", totalTopics: 4, completedTopics: 0 },
];

export async function generateCourse(req: Request, res: Response, next: NextFunction) {
  try {
    const validated = CourseGenerationInputSchema.parse(req.body);
    const userId = validated.userId || "user_001";

    console.log(`[API] Generating course for user ${userId}.`);
    const result = await generateCourseFromAI(validated.learningRequest, userId);

    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getSubjects(req: Request, res: Response, next: NextFunction) {
  try {
    // Collect unique subjects from MongoDB courses, combined with default catalog
    const courses = await Course.find();
    const map = new Map<string, any>();

    DEFAULT_SUBJECTS.forEach((s) => map.set(s.id, s));
    courses.forEach((c) => {
      if (c.subject) {
        map.set(c.subject.id, c.subject);
      }
    });

    res.json(Array.from(map.values()));
  } catch (error) {
    next(error);
  }
}

export async function getCourseById(req: Request, res: Response, next: NextFunction) {
  try {
    const course = await Course.findOne({ id: req.params.id });
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
    const course = await Course.findOne({ id: req.params.id });
    if (!course) {
      return res.status(404).json({ message: "Course not found." });
    }
    res.json(course.topics);
  } catch (error) {
    next(error);
  }
}
