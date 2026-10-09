import mongoose, { Document, Schema } from "mongoose";

interface IPracticeSubmission extends Document {
  userId: string;
  questionId: string;
  state: "PROCESSING" | "COMPLETED";
  result?: Record<string, unknown>;
}

const PracticeSubmissionSchema = new Schema<IPracticeSubmission>({
  userId: { type: String, required: true },
  questionId: { type: String, required: true },
  state: { type: String, enum: ["PROCESSING", "COMPLETED"], required: true },
  result: { type: Schema.Types.Mixed },
}, { timestamps: true });

PracticeSubmissionSchema.index({ userId: 1, questionId: 1 }, { unique: true });

export const PracticeSubmission = mongoose.model<IPracticeSubmission>("PracticeSubmission", PracticeSubmissionSchema);
