import { z } from "zod";

export const CourseGenerationInputSchema = z.object({
  learningRequest: z.string().min(2, "Tell us what you'd like to learn."),
  userId: z.string().optional(),
});

export const AICourseResponseSchema = z.object({
  subject: z.object({
    id: z.string(),
    name: z.string(),
    icon: z.string().default("brain"),
    description: z.string(),
  }),
  topics: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
      learningObjectives: z.array(z.string()).default([]),
      subtopics: z.array(z.string()).default([]),
    })
  ).min(5, "At least 5 course topics required").max(7, "At most 7 course topics allowed"),
  understanding: z.object({
    learningGoal: z.string(),
    detectedDifficulty: z.string().default("Personalized after assessment"),
    startingAssumption: z.string().default("Starting level will be confirmed by diagnostic."),
  }),
  estimatedLearningTimeMinutes: z.number().default(60),
});

export const AIDiagnosticQuestionSchema = z.object({
  topicName: z.string().optional(),
  topicId: z.string().optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  question: z.string().min(5),
  options: z.array(
    z.object({
      id: z.enum(["a", "b", "c", "d"]),
      text: z.string().min(1),
    })
  ).length(4, "Each question must provide exactly 4 options (a, b, c, d)").refine(
    (options) => new Set(options.map((option) => option.id)).size === 4,
    "Options must use each identifier a, b, c, and d exactly once"
  ),
  correctOptionId: z.enum(["a", "b", "c", "d"]),
  explanation: z.string().min(5),
  conceptTested: z.string().default(""),
});

export const AIDiagnosticQuestionsResponseSchema = z.object({
  questions: z.array(AIDiagnosticQuestionSchema).min(3).max(7),
});

const jsonString = { type: "STRING" };
const jsonStringArray = { type: "ARRAY", items: jsonString };
const jsonObject = (properties: Record<string, unknown>, required: string[]) => ({
  type: "OBJECT",
  properties,
  required,
  additionalProperties: false,
});

export const AICourseResponseJsonSchema = jsonObject({
  subject: jsonObject({ id: jsonString, name: jsonString, icon: jsonString, description: jsonString }, ["id", "name", "icon", "description"]),
  topics: {
    type: "ARRAY",
    minItems: 5,
    maxItems: 7,
    items: jsonObject({
      name: jsonString,
      description: jsonString,
      difficulty: { type: "STRING", enum: ["easy", "medium", "hard"] },
      learningObjectives: jsonStringArray,
      subtopics: jsonStringArray,
    }, ["name", "description", "difficulty", "learningObjectives", "subtopics"]),
  },
  understanding: jsonObject({ learningGoal: jsonString, detectedDifficulty: jsonString, startingAssumption: jsonString }, ["learningGoal", "detectedDifficulty", "startingAssumption"]),
  estimatedLearningTimeMinutes: { type: "NUMBER" },
}, ["subject", "topics", "understanding", "estimatedLearningTimeMinutes"]);

const aiOptionJsonSchema = jsonObject({
  id: { type: "STRING", enum: ["a", "b", "c", "d"] },
  text: jsonString,
}, ["id", "text"]);
const aiQuestionJsonSchema = jsonObject({
  topicName: jsonString,
  topicId: jsonString,
  difficulty: { type: "STRING", enum: ["easy", "medium", "hard"] },
  question: jsonString,
  options: { type: "ARRAY", minItems: 4, maxItems: 4, items: aiOptionJsonSchema },
  correctOptionId: { type: "STRING", enum: ["a", "b", "c", "d"] },
  explanation: jsonString,
  conceptTested: jsonString,
}, ["difficulty", "question", "options", "correctOptionId", "explanation", "conceptTested"]);

export const AIDiagnosticQuestionsResponseJsonSchema = jsonObject({
  questions: { type: "ARRAY", minItems: 5, maxItems: 7, items: aiQuestionJsonSchema },
}, ["questions"]);
export const AIDiagnosticQuestionJsonSchema = aiQuestionJsonSchema;
export const AITutorResponseJsonSchema = jsonObject({ content: jsonString }, ["content"]);
export const AIVoiceResponseJsonSchema = jsonObject({ reply: jsonString }, ["reply"]);
export const AIVoiceQuizResponseSchema = z.object({
  identifiedConcepts: z.array(z.string().min(1)),
  missingConcepts: z.array(z.string().min(1)),
  score: z.number().int().min(0),
  total: z.number().int().positive(),
  feedback: z.string().min(5),
}).refine((result) => result.score <= result.total, "Score cannot exceed total");
export const AIVoiceQuizResponseJsonSchema = jsonObject({
  identifiedConcepts: jsonStringArray,
  missingConcepts: jsonStringArray,
  score: { type: "INTEGER" },
  total: { type: "INTEGER" },
  feedback: jsonString,
}, ["identifiedConcepts", "missingConcepts", "score", "total", "feedback"]);

export const DiagnosticSubmissionSchema = z.object({
  subjectId: z.string(),
  courseId: z.string(),
  assessmentId: z.string().optional(),
  userId: z.string().optional(),
  answers: z.array(
    z.object({
      questionId: z.string(),
      questionNumber: z.number().optional(),
      topicId: z.string(),
      topic: z.string().optional(),
      difficulty: z.string().optional(),
      selectedAnswer: z.string(),
      correct: z.boolean().optional(),
    })
  ),
});

export const PracticeAnswerSchema = z.object({
  questionId: z.string(),
  selectedOptionId: z.string(),
  timeTakenSeconds: z.number().default(0),
  userId: z.string().optional(),
});

export const TutorMessageSchema = z.object({
  message: z.string().min(1),
  mode: z.string().default("explain"),
  topicId: z.string().optional(),
  topicName: z.string().optional(),
  courseName: z.string().optional(),
  userId: z.string().optional(),
});
