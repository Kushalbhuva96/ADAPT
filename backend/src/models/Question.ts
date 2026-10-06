import mongoose, { Document, Schema } from "mongoose";

export interface IOption {
  id: string; // 'a', 'b', 'c', 'd'
  text: string;
}

export interface IQuestion extends Document {
  id: string;
  courseId?: string;
  subjectId: string;
  topicId: string;
  difficulty: "easy" | "medium" | "hard";
  question: string;
  options: IOption[];
  correctOptionId: string;
  explanation: string;
  conceptTested?: string;
  type: "diagnostic" | "practice" | "quiz";
  estimatedTimeSeconds?: number;
  createdAt: Date;
}

const OptionSchema = new Schema<IOption>(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
  },
  { _id: false }
);

const QuestionSchema = new Schema<IQuestion>(
  {
    id: { type: String, required: true, unique: true, index: true },
    courseId: { type: String, index: true },
    subjectId: { type: String, required: true, index: true },
    topicId: { type: String, required: true, index: true },
    difficulty: { type: String, enum: ["easy", "medium", "hard"], default: "medium" },
    question: { type: String, required: true },
    options: { type: [OptionSchema], required: true },
    correctOptionId: { type: String, required: true },
    explanation: { type: String, required: true },
    conceptTested: { type: String, default: "" },
    type: { type: String, enum: ["diagnostic", "practice", "quiz"], default: "diagnostic" },
    estimatedTimeSeconds: { type: Number, default: 30 },
  },
  { timestamps: true }
);

export const Question = mongoose.model<IQuestion>("Question", QuestionSchema);
