import mongoose, { Document, Schema } from "mongoose";

export interface ITranscriptMessage {
  role: "user" | "assistant";
  text: string;
  timestamp?: Date;
}

export interface IVoiceSession extends Document {
  id: string;
  userId: string;
  topicId: string;
  status: "idle" | "listening" | "speaking";
  transcript: ITranscriptMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const TranscriptMessageSchema = new Schema<ITranscriptMessage>(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    text: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const VoiceSessionSchema = new Schema<IVoiceSession>(
  {
    id: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    topicId: { type: String, default: "" },
    status: { type: String, enum: ["idle", "listening", "speaking"], default: "idle" },
    transcript: { type: [TranscriptMessageSchema], default: [] },
  },
  { timestamps: true }
);

export const VoiceSession = mongoose.model<IVoiceSession>(
  "VoiceSession",
  VoiceSessionSchema
);
