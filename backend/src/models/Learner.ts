import mongoose, { Document, Schema } from "mongoose";

export interface ITopicMastery {
  topicId: string;
  topicName?: string;
  score: number; // 0-100
  accuracy: number; // 0-100
  attempts: number;
  correctAnswers: number;
  incorrectAnswers: number;
  lastAssessed?: Date;
}

export interface ILearner extends Document {
  id: string; // custom public ID e.g. "user_001"
  name: string;
  email: string;
  password?: string;
  avatarUrl?: string;
  currentLevel: "Beginner" | "Intermediate" | "Advanced";
  preferences: {
    learningStyles: string[];
    preferredDifficulty: "easy" | "medium" | "hard";
    voiceEnabled: boolean;
  };
  overallScore: number;
  strengths: string[];
  weaknesses: string[];
  topicMastery: ITopicMastery[];
  learningBehavior: {
    conceptUnderstanding: number;
    application: number;
    recall: number;
    problemSolving: number;
  };
  activeCourseId?: string;
  activeTopicId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TopicMasterySchema = new Schema<ITopicMastery>(
  {
    topicId: { type: String, required: true },
    topicName: { type: String, default: "" },
    score: { type: Number, default: 0, min: 0, max: 100 },
    accuracy: { type: Number, default: 0, min: 0, max: 100 },
    attempts: { type: Number, default: 0 },
    correctAnswers: { type: Number, default: 0 },
    incorrectAnswers: { type: Number, default: 0 },
    lastAssessed: { type: Date, default: Date.now },
  },
  { _id: false }
);

const LearnerSchema = new Schema<ILearner>(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String },
    avatarUrl: { type: String, default: null },
    currentLevel: {
      type: String,
      enum: ["Beginner", "Intermediate", "Advanced"],
      default: "Beginner",
    },
    preferences: {
      learningStyles: { type: [String], default: ["examples", "short_explanations"] },
      preferredDifficulty: { type: String, enum: ["easy", "medium", "hard"], default: "medium" },
      voiceEnabled: { type: Boolean, default: true },
    },
    overallScore: { type: Number, default: 50, min: 0, max: 100 },
    strengths: { type: [String], default: [] },
    weaknesses: { type: [String], default: [] },
    topicMastery: { type: [TopicMasterySchema], default: [] },
    learningBehavior: {
      conceptUnderstanding: { type: Number, default: 60, min: 0, max: 100 },
      application: { type: Number, default: 50, min: 0, max: 100 },
      recall: { type: Number, default: 60, min: 0, max: 100 },
      problemSolving: { type: Number, default: 50, min: 0, max: 100 },
    },
    activeCourseId: { type: String, default: null },
    activeTopicId: { type: String, default: null },
  },
  { timestamps: true }
);

export const Learner = mongoose.model<ILearner>("Learner", LearnerSchema);
