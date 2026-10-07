import { Request, Response, NextFunction } from "express";
import { handleVoiceStart, handleVoiceMessage, evaluateVoiceQuiz } from "../ai/voiceService.js";
import type { AuthenticatedRequest } from "../middleware/requireAuth.js";

export async function voiceStart(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await handleVoiceStart({ ...req.body, userId: (req as AuthenticatedRequest).auth!.userId });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function voiceMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await handleVoiceMessage({ ...req.body, userId: (req as AuthenticatedRequest).auth!.userId });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function voiceQuizEvaluate(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await evaluateVoiceQuiz({ ...req.body, userId: (req as AuthenticatedRequest).auth!.userId });
    res.json(result);
  } catch (error) {
    next(error);
  }
}
