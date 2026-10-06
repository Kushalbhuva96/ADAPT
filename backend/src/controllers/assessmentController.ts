import { Request, Response, NextFunction } from "express";
import { generateDiagnosticQuestions } from "../ai/diagnosticGenerator.js";
import { evaluateDiagnosticAssessment } from "../ai/assessmentEvaluator.js";
import { DiagnosticSubmissionSchema } from "../validators/schemas.js";

export async function getDiagnosticQuestions(req: Request, res: Response, next: NextFunction) {
  try {
    const subjectId = req.params.subjectId || req.body.subjectId;
    const { courseId, selectedTopicId } = req.body;

    console.log(`[API] Fetching diagnostic questions for subject: ${subjectId}, course: ${courseId}`);
    const questions = await generateDiagnosticQuestions({
      subjectId,
      courseId,
      selectedTopicId,
    });

    res.json(questions);
  } catch (error) {
    next(error);
  }
}

export async function evaluateDiagnostic(req: Request, res: Response, next: NextFunction) {
  try {
    const validated = DiagnosticSubmissionSchema.parse(req.body) as Parameters<typeof evaluateDiagnosticAssessment>[0];

    console.log(`[API] Evaluating diagnostic assessment for course: ${validated.courseId}`);
    const result = await evaluateDiagnosticAssessment(validated);

    res.json(result);
  } catch (error) {
    next(error);
  }
}
