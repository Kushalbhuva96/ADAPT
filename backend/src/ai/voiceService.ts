import { VoiceSession } from "../models/VoiceSession.js";
import { Learner } from "../models/Learner.js";
import { generateStructuredAIResponse } from "./aiClient.js";
import { z } from "zod";
import {
  AIVoiceQuizResponseJsonSchema,
  AIVoiceQuizResponseSchema,
  AIVoiceResponseJsonSchema,
} from "../validators/schemas.js";

export async function handleVoiceStart(params: { userId?: string; topicId?: string }) {
  const { userId = "user_001", topicId = "deadlocks" } = params;
  let session = await VoiceSession.findOne({ userId });
  if (!session) {
    session = new VoiceSession({ id: `voice_${Date.now()}`, userId, topicId, status: "listening", transcript: [] });
  } else {
    session.status = "listening";
    session.topicId = topicId;
  }
  await session.save();

  return {
    id: session.id,
    userId: session.userId,
    status: "listening",
    mode: "tutor",
    transcript: session.transcript,
    topicId: session.topicId,
  };
}

export async function handleVoiceMessage(params: { text: string; userId?: string; topicId?: string }) {
  const { text, userId = "user_001", topicId = "deadlocks" } = params;
  const learner = await Learner.findOne({ id: userId });
  const level = learner?.currentLevel || "Intermediate";

  const systemPrompt = `You are ADAPT Voice Tutor. A learner is speaking with you.
Provide a spoken, natural, concise response (2-3 sentences max) tailored to a ${level} learner.
Return a JSON object with a non-empty reply string.`;
  const res = await generateStructuredAIResponse(
    systemPrompt,
    `Spoken query: "${text}" (Topic: ${topicId})`,
    (raw) => z.object({ reply: z.string().min(1) }).parse(raw),
    AIVoiceResponseJsonSchema
  );

  let session = await VoiceSession.findOne({ userId });
  if (!session) {
    session = new VoiceSession({ id: `voice_${Date.now()}`, userId, topicId, status: "speaking", transcript: [] });
  }

  session.status = "speaking";
  session.transcript.push({ role: "user", text, timestamp: new Date() });
  session.transcript.push({ role: "assistant", text: res.reply, timestamp: new Date() });
  await session.save();

  return {
    session: {
      id: session.id,
      userId: session.userId,
      status: "speaking",
      transcript: session.transcript.map((message) => ({ role: message.role, text: message.text })),
    },
  };
}

export async function evaluateVoiceQuiz(params: {
  userId?: string;
  questionId?: string;
  transcript: string;
}) {
  const { questionId = "q_voice_001", transcript } = params;
  const systemPrompt = `You are evaluating a student's spoken explanation for a technical concept.
Analyze the transcript for understanding and return JSON with identifiedConcepts, missingConcepts, score, total, and actionable feedback. The score must not exceed total.`;
  const result = await generateStructuredAIResponse(
    systemPrompt,
    `Student transcript: "${transcript}"`,
    (raw) => AIVoiceQuizResponseSchema.parse(raw),
    AIVoiceQuizResponseJsonSchema
  );

  return { questionId, transcript, ...result };
}
