import mongoose, { Document, Schema } from "mongoose";

export interface IPracticeAttempt extends Document {
  id: string;
  userId: string;
  questionId: string;
  topicId: string;
  courseId?: string;
  selectedOptionId: string;
  correct: boolean;
  timeTakenSeconds: number;
  feedback: {
    status: "correct" | "incorrect";
    correctOptionId: string;
    explanation: string;
    whatAdaptLearned: string;
    mastery: {
      previous: number;
      current: number;
      change: number;
    };
  };
  adaptation: {
    nextDifficulty: string;
    nextStrategy: string;
    reason: string;
  };
  createdAt: Date;
}

const PracticeAttemptSchema = new Schema<IPracticeAttempt>(
  {
    id: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    questionId: { type: String, required: true, index: true },
    topicId: { type: String, required: true, index: true },
    courseId: { type: String },
    selectedOptionId: { type: String, required: true },
    correct: { type: Boolean, required: true },
    timeTakenSeconds: { type: Number, default: 0 },
    feedback: {
      status: { type: String, enum: ["correct", "incorrect"], required: true },
      correctOptionId: { type: String, required: true },
      explanation: { type: String, required: true },
      whatAdaptLearned: { type: String, required: true },
      mastery: {
        previous: { type: Number, required: true },
        current: { type: Number, required: true },
        change: { type: Number, required: true },
      },
    },
    adaptation: {
      nextDifficulty: { type: String, required: true },
      nextStrategy: { type: String, required: true },
      reason: { type: String, required: true },
    },
  },
  { timestamps: true }
);

export const PracticeAttempt = mongoose.model<IPracticeAttempt>(
  "PracticeAttempt",
  PracticeAttemptSchema
);
