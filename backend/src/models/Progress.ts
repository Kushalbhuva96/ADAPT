import mongoose, { Document, Schema } from "mongoose";

export interface ITopicProgressItem {
  topicId: string;
  name: string;
  previous: number;
  current: number;
  change: number;
}

export interface IProgress extends Document {
  userId: string;
  overall: {
    current: number;
    previous: number;
    change: number;
  };
  topicProgress: ITopicProgressItem[];
  statistics: {
    questionsCompleted: number;
    learningMinutes: number;
    streakDays: number;
    accuracy: number;
  };
  updatedAt: Date;
}

const TopicProgressSchema = new Schema<ITopicProgressItem>(
  {
    topicId: { type: String, required: true },
    name: { type: String, required: true },
    previous: { type: Number, default: 0 },
    current: { type: Number, default: 0 },
    change: { type: Number, default: 0 },
  },
  { _id: false }
);

const ProgressSchema = new Schema<IProgress>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    overall: {
      current: { type: Number, default: 50 },
      previous: { type: Number, default: 50 },
      change: { type: Number, default: 0 },
    },
    topicProgress: { type: [TopicProgressSchema], default: [] },
    statistics: {
      questionsCompleted: { type: Number, default: 0 },
      learningMinutes: { type: Number, default: 0 },
      streakDays: { type: Number, default: 1 },
      accuracy: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

export const Progress = mongoose.model<IProgress>("Progress", ProgressSchema);
