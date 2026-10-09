import mongoose, { Document, Schema } from "mongoose";

interface IPracticeSyncLock extends Document {
  userId: string;
  lockToken: string;
  expiresAt: Date;
}

const PracticeSyncLockSchema = new Schema<IPracticeSyncLock>({
  userId: { type: String, required: true, unique: true },
  lockToken: { type: String, required: true },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

export const PracticeSyncLock = mongoose.model<IPracticeSyncLock>("PracticeSyncLock", PracticeSyncLockSchema);
