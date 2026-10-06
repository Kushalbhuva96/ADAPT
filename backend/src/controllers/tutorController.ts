import { Request, Response, NextFunction } from "express";
import { generateTutorExplanation } from "../ai/tutorService.js";
import { Recommendation } from "../models/Recommendation.js";
import { TutorMessageSchema } from "../validators/schemas.js";

export async function sendTutorMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const validated = TutorMessageSchema.parse(req.body) as Parameters<typeof generateTutorExplanation>[0];
    const result = await generateTutorExplanation(validated);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getRecommendations(req: Request, res: Response, next: NextFunction) {
  try {
    const paramUserId = req.params.id;
    const userId = (Array.isArray(paramUserId) ? paramUserId[0] : paramUserId) || "user_001";
    const list = await Recommendation.find({ userId }).sort({ createdAt: -1 }).limit(5);
    res.json(list);
  } catch (error) {
    next(error);
  }
}
