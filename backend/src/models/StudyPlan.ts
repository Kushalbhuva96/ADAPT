import mongoose, { Document, Schema } from "mongoose";

export interface IStudyPlanItem {
  id: string;
  title: string;
  topicId: string;
  durationMinutes: number;
  type: "review" | "lesson" | "practice" | "recall";
  status: "pending" | "completed";
}

export interface IStudyPlan extends Document {
  id: string;
  userId: string;
  date: string;
  totalMinutes: number;
  items: IStudyPlanItem[];
  createdAt: Date;
}

const StudyPlanItemSchema = new Schema<IStudyPlanItem>(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    topicId: { type: String, required: true },
    durationMinutes: { type: Number, default: 5 },
    type: { type: String, enum: ["review", "lesson", "practice", "recall"], default: "practice" },
    status: { type: String, enum: ["pending", "completed"], default: "pending" },
  },
  { _id: false }
);

const StudyPlanSchema = new Schema<IStudyPlan>(
  {
    id: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    date: { type: String, required: true },
    totalMinutes: { type: Number, default: 20 },
    items: { type: [StudyPlanItemSchema], default: [] },
  },
  { timestamps: true }
);

export const StudyPlan = mongoose.model<IStudyPlan>("StudyPlan", StudyPlanSchema);
