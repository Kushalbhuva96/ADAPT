import mongoose, { Document, Schema } from "mongoose";

interface IPracticeQuestionDelivery extends Document {
  userId: string;
  courseId: string;
  topicId: string;
  questionId: string;
}

const PracticeQuestionDeliverySchema = new Schema<IPracticeQuestionDelivery>({
  userId: { type: String, required: true },
  courseId: { type: String, required: true },
  topicId: { type: String, required: true },
  questionId: { type: String, required: true },
}, { timestamps: true });

PracticeQuestionDeliverySchema.index({ userId: 1, courseId: 1, questionId: 1 }, { unique: true });

export const PracticeQuestionDelivery = mongoose.model<IPracticeQuestionDelivery>("PracticeQuestionDelivery", PracticeQuestionDeliverySchema);
