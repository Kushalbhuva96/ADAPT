import mongoose, { Schema } from "mongoose";

const AuthSessionSchema = new Schema({
  jti: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, index: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true });

export const AuthSession = mongoose.model("AuthSession", AuthSessionSchema);
