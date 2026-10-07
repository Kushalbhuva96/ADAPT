import { Request, Response, NextFunction } from "express";
import { getNextPracticeQuestion, submitPracticeAnswer } from "../ai/practiceEngine.js";
import { PracticeAnswerSchema } from "../validators/schemas.js";

export async function getNextPractice(req: Request, res: Response, next: NextFunction) {
  try {
    const paramUserId = req.params.id;
    const userId = (Array.isArray(paramUserId) ? paramUserId[0] : paramUserId) || "";
    const question = await getNextPracticeQuestion(userId);
    res.json(question);
  } catch (error) {
    next(error);
  }
}

export async function answerPractice(req: Request, res: Response, next: NextFunction) {
  try {
    const validated = PracticeAnswerSchema.parse(req.body) as Parameters<typeof submitPracticeAnswer>[0];
    const result = await submitPracticeAnswer(validated);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
