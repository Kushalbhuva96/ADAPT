import mongoose, { Document, Schema } from "mongoose";

export interface ICourseTopic {
  id: string;
  subjectId: string;
  name: string;
  description: string;
  mastery: number;
  accuracy: number;
  attempts: number;
  status: "not_started" | "in_progress" | "improving" | "needs_attention" | "mastered";
  difficulty: "easy" | "medium" | "hard";
  learningObjectives?: string[];
  subtopics?: string[];
}

export interface ICourse extends Document {
  id: string; // custom ID
  userId?: string;
  title: string;
  description: string;
  learningRequest: string;
  subject: {
    id: string;
    name: string;
    icon: string;
    description: string;
    totalTopics: number;
    completedTopics: number;
  };
  topics: ICourseTopic[];
  estimatedLearningTimeMinutes: number;
  moduleCount: number;
  understanding: {
    learningGoal: string;
    detectedDifficulty: string;
    startingAssumption: string;
  };
  status: "setup" | "active" | "completed";
  learnerLevel?: string;
  recommendedTopicId?: string;
  selectedTopicId?: string;
  activeTopicId?: string;
  progress: number;
  completedTopicIds: string[];
  topicAttempts: Record<string, number>;
  createdAt: Date;
  updatedAt: Date;
}

const CourseTopicSchema = new Schema<ICourseTopic>(
  {
    id: { type: String, required: true },
    subjectId: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    mastery: { type: Number, default: 0, min: 0, max: 100 },
    accuracy: { type: Number, default: 0, min: 0, max: 100 },
    attempts: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["not_started", "in_progress", "improving", "needs_attention", "mastered"],
      default: "not_started",
    },
    difficulty: { type: String, enum: ["easy", "medium", "hard"], default: "medium" },
    learningObjectives: { type: [String], default: [] },
    subtopics: { type: [String], default: [] },
  },
  { _id: false }
);

const CourseSchema = new Schema<ICourse>(
  {
    id: { type: String, required: true, unique: true, index: true },
    userId: { type: String, index: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    learningRequest: { type: String, required: true },
    subject: {
      id: { type: String, required: true },
      name: { type: String, required: true },
      icon: { type: String, default: "brain" },
      description: { type: String, default: "" },
      totalTopics: { type: Number, default: 0 },
      completedTopics: { type: Number, default: 0 },
    },
    topics: { type: [CourseTopicSchema], default: [] },
    estimatedLearningTimeMinutes: { type: Number, default: 60 },
    moduleCount: { type: Number, default: 0 },
    understanding: {
      learningGoal: { type: String, default: "" },
      detectedDifficulty: { type: String, default: "Personalized after assessment" },
      startingAssumption: { type: String, default: "Starting level will be confirmed by diagnostic." },
    },
    status: { type: String, enum: ["setup", "active", "completed"], default: "setup" },
    learnerLevel: { type: String, default: null },
    recommendedTopicId: { type: String, default: null },
    selectedTopicId: { type: String, default: null },
    activeTopicId: { type: String, default: null },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    completedTopicIds: { type: [String], default: [] },
    topicAttempts: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export const Course = mongoose.model<ICourse>("Course", CourseSchema);
