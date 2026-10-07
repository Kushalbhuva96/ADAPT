import { Request, Response, NextFunction } from "express";
import { Learner } from "../models/Learner.js";
import { Course } from "../models/Course.js";
import { AssessmentAttempt } from "../models/AssessmentAttempt.js";
import { PracticeAttempt } from "../models/PracticeAttempt.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { AuthSession } from "../models/AuthSession.js";
import type { AuthenticatedRequest } from "../middleware/requireAuth.js";

async function createSession(userId: string) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is required to issue learner sessions.");
  const jti = randomUUID();
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
  const token = jwt.sign({}, secret, { subject: userId, jwtid: jti, issuer: "adapt-api", audience: "adapt-client", expiresIn: "12h" });
  await AuthSession.create({ jti, userId, expiresAt });
  return token;
}

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, email, password } = req.body;
    if (!email || !name || !password) {
      return res.status(400).json({ message: "Name, email, and password are required." });
    }

    let learner = await Learner.findOne({ email });
    if (learner) {
      return res.status(400).json({ message: "An account with this email already exists." });
    }

    const id = `user_${Date.now()}`;
    learner = new Learner({
      id,
      name,
      email,
      password: await bcrypt.hash(password, 10),
      currentLevel: "Beginner",
      overallScore: 0,
      topicMastery: [],
    });

    await learner.save();

    const token = await createSession(learner.id);
    res.json({
      user: {
        id: learner.id,
        name: learner.name,
        email: learner.email,
        preferences: learner.preferences,
      },
      token,
    });
  } catch (error) {
    next(error);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;
    let learner = await Learner.findOne({ email });

    if (!learner) {
      return res.status(401).json({ message: "Email or password is incorrect." });
    }
    const storedPassword = learner.password || "";
    const isBcrypt = storedPassword.startsWith("$2");
    const validPassword = isBcrypt ? await bcrypt.compare(password || "", storedPassword) : storedPassword === password;
    if (!validPassword) return res.status(401).json({ message: "Email or password is incorrect." });
    if (!isBcrypt) { learner.password = await bcrypt.hash(password, 10); await learner.save(); }

    const token = await createSession(learner.id);
    res.json({
      user: {
        id: learner.id,
        name: learner.name,
        email: learner.email,
        preferences: learner.preferences,
      },
      token,
    });
  } catch (error) {
    next(error);
  }
}

export async function getMe(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.auth?.userId || "";
    const learner = await Learner.findOne({ id: userId });
    if (!learner) return res.status(404).json({ message: "Learner not found." });

    res.json({
      user: {
        id: learner.id,
        name: learner.name,
        email: learner.email,
        preferences: learner.preferences,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function logout(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (req.auth?.jti) await AuthSession.deleteOne({ jti: req.auth.jti, userId: req.auth.userId });
    res.json({ success: true });
  } catch (error) { next(error); }
}

export async function getProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as AuthenticatedRequest).auth?.userId || req.params.id;
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
    const [assessment, practiceCount] = await Promise.all([
      course ? AssessmentAttempt.findOne({ userId, courseId: course.id, result: { $exists: true } }).sort({ createdAt: -1 }) : null,
      PracticeAttempt.countDocuments({ userId }),
    ]);
    const hasLearningData = Boolean(assessment || practiceCount > 0);
    const mastery = new Map(learner.topicMastery.map((item) => [item.topicId, item]));
    res.json({
      userId,
      user: { id: learner.id, name: learner.name, email: learner.email },
      course: course ? { id: course.id, title: course.title, subject: course.subject } : null,
      overallScore: hasLearningData ? learner.overallScore : null,
      topicMastery: course?.topics.map((topic) => {
        const item = mastery.get(topic.id);
        return { topicId: topic.id, topicName: topic.name, score: item?.score ?? null, accuracy: item?.accuracy ?? null, attempts: item?.attempts ?? 0 };
      }) || [],
      assessment: assessment?.result || null,
      learningBehavior: null,
      learningStyles: learner.preferences?.learningStyles || [],
      preferredDifficulty: learner.preferences?.preferredDifficulty || null,
      adaptiveLevel: hasLearningData ? learner.currentLevel : null,
      hasLearningData,
      practiceAttempts: practiceCount,
      updatedAt: learner.updatedAt,
    });
  } catch (error) {
    next(error);
  }
}
