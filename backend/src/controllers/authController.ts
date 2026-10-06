import { Request, Response, NextFunction } from "express";
import { Learner } from "../models/Learner.js";

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, email, password } = req.body;
    if (!email || !name) {
      return res.status(400).json({ message: "Name and email are required." });
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
      password, // In a full auth system hashed with bcrypt, keeping simple for hackathon
      currentLevel: "Beginner",
      overallScore: 50,
      topicMastery: [],
    });

    await learner.save();

    res.json({
      user: {
        id: learner.id,
        name: learner.name,
        email: learner.email,
        preferences: learner.preferences,
      },
      token: `jwt_token_${learner.id}`,
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
      // Create automatic guest learner if testing
      const id = `user_${Date.now()}`;
      learner = new Learner({
        id,
        name: email.split("@")[0] || "Learner",
        email,
        password,
        currentLevel: "Beginner",
        overallScore: 50,
      });
      await learner.save();
    }

    res.json({
      user: {
        id: learner.id,
        name: learner.name,
        email: learner.email,
        preferences: learner.preferences,
      },
      token: `jwt_token_${learner.id}`,
    });
  } catch (error) {
    next(error);
  }
}

export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req.query.userId as string) || "user_001";
    let learner = await Learner.findOne({ id: userId });
    if (!learner) {
      learner = await Learner.findOne() || new Learner({
        id: "user_001",
        name: "Alex",
        email: "alex@example.com",
      });
      await learner.save();
    }

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

export async function getProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.params.id || "user_001";
    const learner = await Learner.findOne({ id: userId });

    const defaultProfile = {
      userId,
      overallScore: learner?.overallScore || 67,
      knowledge: { os: 67, dbms: 72 },
      topicMastery: learner?.topicMastery?.length
        ? learner.topicMastery.map((m) => ({ topicId: m.topicId, score: m.score }))
        : [
            { topicId: "processes", score: 60 },
            { topicId: "scheduling", score: 74 },
            { topicId: "deadlocks", score: 42 },
          ],
      learningBehavior: learner?.learningBehavior || {
        conceptUnderstanding: 78,
        application: 51,
        recall: 69,
        problemSolving: 47,
      },
      learningStyles: learner?.preferences?.learningStyles || ["examples", "short_explanations"],
      adaptiveLevel: learner?.currentLevel?.toLowerCase() || "medium",
      updatedAt: learner?.updatedAt || new Date().toISOString(),
    };

    res.json(defaultProfile);
  } catch (error) {
    next(error);
  }
}
