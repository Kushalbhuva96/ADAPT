import { Request, Response, NextFunction } from "express";
import { handleVoiceStart, handleVoiceMessage, evaluateVoiceQuiz } from "../ai/voiceService.js";

export async function voiceStart(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await handleVoiceStart(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function voiceMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await handleVoiceMessage(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function voiceQuizEvaluate(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await evaluateVoiceQuiz(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
