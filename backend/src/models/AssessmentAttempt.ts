import mongoose, { Document, Schema } from "mongoose";

export interface ISubmittedAnswer {
  questionId: string;
  questionNumber?: number;
  topicId: string;
  topic?: string;
  difficulty?: string;
  selectedAnswer: string;
  correct: boolean;
}

export interface ITopicPerformance {
  topicId: string;
  name: string;
  total: number;
  correct: number;
  accuracy: number | null;
}

export interface IAssessmentResult {
  subject: {
    id: string;
    name: string;
  };
  level: "Beginner" | "Intermediate" | "Advanced";
  accuracy: number;
  total: number;
  topicPerformance: ITopicPerformance[];
  strengths: string[];
  weaknesses: string[];
  recommendedTopicId: string;
  recommendedTopic: string;
  explanation: string;
}

export interface IAssessmentAttempt extends Document {
  id: string;
  userId: string;
  courseId: string;
  subjectId: string;
  topicId?: string;
  status: "IN_PROGRESS" | "COMPLETED";
  questionIds: string[];
  answers: ISubmittedAnswer[];
  pendingAnswers: Array<{ questionId: string; selectedAnswer: string }>;
  result?: IAssessmentResult;
  createdAt: Date;
}

const SubmittedAnswerSchema = new Schema<ISubmittedAnswer>(
  {
    questionId: { type: String, required: true },
    questionNumber: { type: Number },
    topicId: { type: String, required: true },
    topic: { type: String },
    difficulty: { type: String },
    selectedAnswer: { type: String, required: true },
    correct: { type: Boolean, required: true },
  },
  { _id: false }
);

const TopicPerformanceSchema = new Schema<ITopicPerformance>(
  {
    topicId: { type: String, required: true },
    name: { type: String, required: true },
    total: { type: Number, required: true },
    correct: { type: Number, required: true },
    accuracy: { type: Number, default: null },
  },
  { _id: false }
);

const AssessmentResultSchema = new Schema<IAssessmentResult>(
  {
    subject: {
      id: { type: String, required: true },
      name: { type: String, required: true },
    },
    level: { type: String, required: true },
    accuracy: { type: Number, required: true },
    total: { type: Number, required: true },
    topicPerformance: { type: [TopicPerformanceSchema], default: [] },
    strengths: { type: [String], default: [] },
    weaknesses: { type: [String], default: [] },
    recommendedTopicId: { type: String, required: true },
    recommendedTopic: { type: String, required: true },
    explanation: { type: String, required: true },
  },
  { _id: false }
);

const AssessmentAttemptSchema = new Schema<IAssessmentAttempt>(
  {
    id: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    courseId: { type: String, required: true, index: true },
    subjectId: { type: String, required: true },
    topicId: { type: String, index: true },
    status: { type: String, enum: ["IN_PROGRESS", "COMPLETED"], default: "COMPLETED", index: true },
    questionIds: { type: [String], default: [] },
    answers: { type: [SubmittedAnswerSchema], default: [] },
    pendingAnswers: { type: [{ questionId: String, selectedAnswer: String }], default: [] },
    result: { type: AssessmentResultSchema, default: undefined },
  },
  { timestamps: true }
);

export const AssessmentAttempt = mongoose.model<IAssessmentAttempt>(
  "AssessmentAttempt",
  AssessmentAttemptSchema
);
