import { generateStructuredAIResponse } from "./aiClient.js";
import { Learner } from "../models/Learner.js";
import { Course } from "../models/Course.js";
import { AssessmentAttempt } from "../models/AssessmentAttempt.js";
import { z } from "zod";
import { AITutorResponseJsonSchema } from "../validators/schemas.js";

export async function generateTutorExplanation(params: {
  message: string;
  mode?: string;
  topicId?: string;
  topicName?: string;
  courseName?: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  userId?: string;
}) {
  const {
    message,
    mode = "explain",
    topicId = "",
    topicName,
    courseName,
    history = [],
    userId,
  } = params;

  if (!userId) throw Object.assign(new Error("A learner account is required."), { status: 401, code: "LEARNER_REQUIRED" });
  const learner = await Learner.findOne({ id: userId });
  if (!learner) throw Object.assign(new Error("Learner not found."), { status: 404, code: "LEARNER_NOT_FOUND" });
  const [course, assessment] = learner.activeCourseId ? await Promise.all([
    Course.findOne({ id: learner.activeCourseId, userId }).lean(),
    AssessmentAttempt.findOne({ userId, courseId: learner.activeCourseId, result: { $exists: true } }).sort({ createdAt: -1 }).lean(),
  ]) : [null, null];
  const activeTopic = course?.topics.find((topic) => topic.id === learner.activeTopicId);
  const teachingTopic = topicName || activeTopic?.name || "the concept in the learner's question";
  const teachingCourse = courseName || course?.title || "independent tutoring";
  const learningStyle = learner.preferences?.learningStyles?.join(", ") || "not yet established";
  const level = assessment?.result?.level || "not yet assessed";

  const systemPrompt = `You are ADAPT Tutor, an adaptive AI personal learning companion.
Teach with exceptional clarity, warmth, and pedagogical precision.
Learner profile:
- Current Level: ${level}
- Learning Style: ${learningStyle}
- Mode: ${mode}
Explain the topic "${teachingTopic}" (${teachingCourse}). Answer the student's question directly.
Use concrete, real-world analogies first before diving into technical terminology.
Keep explanations focused and readable (2-3 paragraphs max).

Format your response as a JSON object:
{
  "content": "Your thorough, engaging explanation here."
}`;

  const recentConversation = history.slice(-8).map((entry) => `${entry.role === "user" ? "Learner" : "ADAPT"}: ${entry.content}`).join("\n");
  const userPrompt = `${recentConversation ? `Recent conversation (for continuity):\n${recentConversation}\n\n` : ""}Learner's current question: "${message}"`;

  const aiResponse = await generateStructuredAIResponse(
    systemPrompt,
    userPrompt,
    (raw) => z.object({ content: z.string().min(1) }).parse(raw),
    AITutorResponseJsonSchema
  );

  return {
    id: `msg_${Date.now()}`,
    role: "assistant",
    content: aiResponse.content,
    messageType: "explanation",
    topicId: topicId || activeTopic?.id || "",
    difficulty: level.toLowerCase(),
    timestamp: new Date().toISOString(),
  };
}
