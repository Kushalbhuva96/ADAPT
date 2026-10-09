import mongoose, { Document, Schema } from "mongoose";

interface IPracticeSubmission extends Document {
  userId: string;
  questionId: string;
  clientAttemptId?: string;
  selectedOptionId: string;
  timeTakenSeconds: number;
  state: "PROCESSING" | "COMPLETED";
  result?: Record<string, unknown>;
}

const PracticeSubmissionSchema = new Schema<IPracticeSubmission>({
  userId: { type: String, required: true },
  questionId: { type: String, required: true },
  clientAttemptId: { type: String },
  selectedOptionId: { type: String },
  timeTakenSeconds: { type: Number, default: 0 },
  state: { type: String, enum: ["PROCESSING", "COMPLETED"], required: true },
  result: { type: Schema.Types.Mixed },
}, { timestamps: true });

PracticeSubmissionSchema.index({ userId: 1, questionId: 1 }, { unique: true });
PracticeSubmissionSchema.index(
  { userId: 1, clientAttemptId: 1 },
  { unique: true, partialFilterExpression: { clientAttemptId: { $type: "string" } } }
);

export const PracticeSubmission = mongoose.model<IPracticeSubmission>("PracticeSubmission", PracticeSubmissionSchema);
