import { generateStructuredAIResponse } from "./aiClient.js";
import { Learner } from "../models/Learner.js";
import { z } from "zod";
import { AITutorResponseJsonSchema } from "../validators/schemas.js";

export async function generateTutorExplanation(params: {
  message: string;
  mode?: string;
  topicId?: string;
  topicName?: string;
  courseName?: string;
  userId?: string;
}) {
  const {
    message,
    mode = "explain",
    topicId = "",
    topicName = "this concept",
    courseName = "your course",
    userId = "user_001",
  } = params;

  const learner = await Learner.findOne({ id: userId });
  const learningStyle = learner?.preferences?.learningStyles?.join(", ") || "examples and concise explanations";
  const level = learner?.currentLevel || "Intermediate";

  const systemPrompt = `You are ADAPT Tutor, an adaptive AI personal learning companion.
Teach with exceptional clarity, warmth, and pedagogical precision.
Learner profile:
- Current Level: ${level}
- Learning Style: ${learningStyle}
- Mode: ${mode}
Explain the topic "${topicName}" (${courseName}). Answer the student's question directly.
Use concrete, real-world analogies first before diving into technical terminology.
Keep explanations focused and readable (2-3 paragraphs max).

Format your response as a JSON object:
{
  "content": "Your thorough, engaging explanation here."
}`;

  const userPrompt = `Student asks: "${message}"`;

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
    topicId,
    difficulty: level.toLowerCase(),
    timestamp: new Date().toISOString(),
  };
}
