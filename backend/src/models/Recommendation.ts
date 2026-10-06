import mongoose, { Document, Schema } from "mongoose";

export interface IRecommendation extends Document {
  id: string;
  userId: string;
  type: string;
  topicId: string;
  title: string;
  reason: string;
  durationMinutes: number;
  priority: "low" | "medium" | "high";
  createdAt: Date;
}

const RecommendationSchema = new Schema<IRecommendation>(
  {
    id: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    type: { type: String, default: "topic_practice" },
    topicId: { type: String, required: true },
    title: { type: String, required: true },
    reason: { type: String, required: true },
    durationMinutes: { type: Number, default: 15 },
    priority: { type: String, enum: ["low", "medium", "high"], default: "high" },
  },
  { timestamps: true }
);

export const Recommendation = mongoose.model<IRecommendation>(
  "Recommendation",
  RecommendationSchema
);
