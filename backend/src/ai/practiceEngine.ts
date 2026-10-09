import { randomUUID } from "node:crypto";
import { Question } from "../models/Question.js";
import { Course } from "../models/Course.js";
import { Learner } from "../models/Learner.js";
import { PracticeAttempt } from "../models/PracticeAttempt.js";
import { Progress } from "../models/Progress.js";
import { AssessmentAttempt } from "../models/AssessmentAttempt.js";
import { PracticeSubmission } from "../models/PracticeSubmission.js";
import { PracticeQuestionDelivery } from "../models/PracticeQuestionDelivery.js";
import { PracticeSyncLock } from "../models/PracticeSyncLock.js";
import { generateStructuredAIResponse } from "./aiClient.js";
import { AIDiagnosticQuestionJsonSchema, AIDiagnosticQuestionSchema } from "../validators/schemas.js";

const TOPIC_LEARNING_STATES = ["UNLOCKED", "LEARNING", "NEEDS_IMPROVEMENT", "STRONG"];
const normalizeQuestionText = (value: string) => value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export async function getNextPracticeQuestion(userId: string) {
  const learner = await Learner.findOne({ id: userId });
  if (!learner) throw Object.assign(new Error("Learner not found."), { status: 404, code: "LEARNER_NOT_FOUND" });
  let activeCourseId = learner.activeCourseId;
  let fallbackCourse = null;
  if (!activeCourseId) {
    const latestCourse = await Course.findOne({ userId }).sort({ updatedAt: -1 });
    if (latestCourse) {
      fallbackCourse = latestCourse;
      learner.activeCourseId = latestCourse.id;
      learner.activeTopicId = latestCourse.activeTopicId || latestCourse.recommendedTopicId || null;
      await learner.save();
      activeCourseId = latestCourse.id;
    }
  }
  if (!activeCourseId) throw Object.assign(new Error("Create a course before starting adaptive practice."), { status: 409, code: "COURSE_REQUIRED" });
  const course = fallbackCourse || await Course.findOne({ id: activeCourseId, userId });
  if (!course) throw Object.assign(new Error("Current course not found."), { status: 404, code: "COURSE_NOT_FOUND" });
  if (!course.topics.length) throw Object.assign(new Error("Current course has no topics to practice."), { status: 409, code: "COURSE_TOPICS_REQUIRED" });
  const [completedAssessment, recentAttempts] = await Promise.all([
    AssessmentAttempt.findOne({ userId, courseId: course.id, result: { $exists: true } }),
    PracticeAttempt.find({ userId, courseId: course.id }).sort({ createdAt: -1 }).limit(8),
  ]);
  if (!completedAssessment) throw Object.assign(new Error("Complete this course's level assessment before starting a targeted challenge."), { status: 409, code: "COURSE_ASSESSMENT_REQUIRED" });
  const recentAccuracy = recentAttempts.length
    ? Math.round((recentAttempts.filter((attempt) => attempt.correct).length / recentAttempts.length) * 100)
    : null;
  const lastAttempt = recentAttempts[0];
  const requestedTopicId =
    learner?.activeTopicId ||
    course?.activeTopicId ||
    course?.recommendedTopicId ||
    course.topics[0].id;
  const requestedTopic = course.topics.find((topic) => topic.id === requestedTopicId);
  if (requestedTopic && !TOPIC_LEARNING_STATES.includes(requestedTopic.learningState || "")) {
    throw Object.assign(new Error("Complete this topic's diagnostic assessment before starting its practice."), { status: 409, code: "TOPIC_ASSESSMENT_REQUIRED" });
  }

  // Recent mistakes take priority for reinforcement. After a strong streak, advance through course order.
  let activeTopicId = requestedTopicId;
  if (lastAttempt && !lastAttempt.correct && course?.topics?.some((topic) => topic.id === lastAttempt.topicId)) {
    activeTopicId = lastAttempt.topicId;
  } else if (recentAttempts.length >= 3 && recentAccuracy !== null && recentAccuracy >= 80 && course?.topics?.length) {
    const currentIndex = course.topics.findIndex((topic) => topic.id === requestedTopicId);
    const nextTopic = course.topics.slice(Math.max(currentIndex + 1, 0)).find((topic) => {
      const mastery = learner?.topicMastery?.find((entry) => entry.topicId === topic.id)?.score ?? topic.mastery ?? 0;
      return TOPIC_LEARNING_STATES.includes(topic.learningState || "") && mastery < 80 && !course.completedTopicIds?.includes(topic.id);
    });
    if (nextTopic) activeTopicId = nextTopic.id;
  }

  const currentTopic = course.topics.find((t) => t.id === activeTopicId);
  if (!currentTopic) throw Object.assign(new Error("Current topic does not belong to the active course."), { status: 409, code: "TOPIC_NOT_IN_COURSE" });

  const masteryObj = learner?.topicMastery?.find((m) => m.topicId === activeTopicId);
  const topicMastery = masteryObj?.score ?? currentTopic.mastery ?? 0;
  const topicAccuracy = masteryObj?.accuracy ?? currentTopic.accuracy ?? 0;
  const recentTopicAttempts = recentAttempts.filter((attempt) => attempt.topicId === activeTopicId);
  const recentTopicAccuracy = recentTopicAttempts.length
    ? Math.round((recentTopicAttempts.filter((attempt) => attempt.correct).length / recentTopicAttempts.length) * 100)
    : topicAccuracy;
  const targetDifficulty = recentTopicAccuracy < 50 || topicMastery < 40
    ? "easy"
    : recentTopicAccuracy >= 80 && topicMastery >= 70
      ? "hard"
      : "medium";
  const missedQuestionIds = recentAttempts.filter((attempt) => !attempt.correct).map((attempt) => attempt.questionId);
  const [attemptedQuestionIds, deliveredQuestionIds, missedQuestions] = await Promise.all([
    PracticeAttempt.distinct("questionId", { userId, courseId: course.id }),
    PracticeQuestionDelivery.distinct("questionId", { userId, courseId: course.id }),
    missedQuestionIds.length
      ? Question.find({ id: { $in: missedQuestionIds } }).select("conceptTested question").limit(4)
      : Promise.resolve([]),
  ]);
  const usedQuestionIds = [...new Set([...attemptedQuestionIds, ...deliveredQuestionIds])];
  // Prefer a question not recently answered, at the difficulty supported by the learner's recent results.
  const [candidateQuestions, deliveredQuestionDocs] = await Promise.all([
    Question.find({
      courseId: course.id,
      topicId: activeTopicId,
      type: "practice",
      id: { $nin: usedQuestionIds },
    }).sort({ createdAt: -1 }),
    usedQuestionIds.length
      ? Question.find({ id: { $in: usedQuestionIds }, courseId: course.id }).select("question").lean()
      : Promise.resolve([]),
  ]);
  const deliveredQuestionTexts = deliveredQuestionDocs.map((item) => normalizeQuestionText(item.question || ""));
  const availableQuestions = candidateQuestions.filter((item) => !deliveredQuestionTexts.includes(normalizeQuestionText(item.question)));
  const missedConcepts = missedQuestions.map((question) => question.conceptTested || question.question).filter(Boolean);
  const difficultyRank: Record<string, number> = { easy: 0, medium: 1, hard: 2 };
  let qDoc = availableQuestions.sort((left, right) =>
    Math.abs((difficultyRank[left.difficulty] ?? 1) - difficultyRank[targetDifficulty]) -
    Math.abs((difficultyRank[right.difficulty] ?? 1) - difficultyRank[targetDifficulty])
  )[0] || null;

  // If no practice question exists for this topic in DB, generate one with AI
  if (!qDoc) {
      const systemPrompt = `You are the adaptive question generator for ADAPT.
Generate 1 adaptive practice question grounded in the learner's course topic, objectives, and recent mistakes.
Format strictly as JSON:
{
  "question": "Question text",
  "difficulty": "medium",
  "options": [
    { "id": "a", "text": "Option A" },
    { "id": "b", "text": "Option B" },
    { "id": "c", "text": "Option C" },
    { "id": "d", "text": "Option D" }
  ],
  "correctOptionId": "a",
  "explanation": "Clear explanation of the answer",
  "conceptTested": "Key concept"
}`;

      const previousQuestionTexts = deliveredQuestionDocs.map((item) => item.question).filter(Boolean);
      const recentQuestionTexts = previousQuestionTexts.slice(-10);
      const userPrompt = `Course: "${course.title}". Learning request: "${course.learningRequest}". Topic: "${currentTopic.name}". Description: "${currentTopic.description || ""}". Objectives: ${(currentTopic.learningObjectives || []).join("; ")}. Learner topic mastery: ${topicMastery}%. Recent topic accuracy: ${recentTopicAccuracy}%. Difficulty target: ${targetDifficulty}. Concepts from previous mistakes to reinforce: ${missedConcepts.join("; ") || "No prior mistakes recorded"}. Do not repeat these recently delivered question prompts; test a different concept or application: ${recentQuestionTexts.join(" | ") || "None"}.`;

      let aiQuestion = await generateStructuredAIResponse(
        systemPrompt,
        userPrompt,
        (raw) => AIDiagnosticQuestionSchema.parse(raw),
        AIDiagnosticQuestionJsonSchema
      );
      if (previousQuestionTexts.some((previous) => normalizeQuestionText(previous) === normalizeQuestionText(aiQuestion.question))) {
        aiQuestion = await generateStructuredAIResponse(
          systemPrompt,
          `${userPrompt}\nThe last draft repeated a previous question. Write a distinctly different question and do not reuse this wording: "${aiQuestion.question}".`,
          (raw) => AIDiagnosticQuestionSchema.parse(raw),
          AIDiagnosticQuestionJsonSchema
        );
      }

      qDoc = new Question({
        id: `practice_${activeTopicId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        courseId: course.id,
        subjectId: course.subject.id,
        topicId: activeTopicId,
        difficulty: aiQuestion.difficulty,
        question: aiQuestion.question,
        options: aiQuestion.options,
        correctOptionId: aiQuestion.correctOptionId,
        explanation: aiQuestion.explanation,
        conceptTested: aiQuestion.conceptTested,
        type: "practice",
        estimatedTimeSeconds: 30,
      });
      await qDoc.save();
  }

  await PracticeQuestionDelivery.updateOne(
    { userId, courseId: course.id, questionId: qDoc.id },
    { $setOnInsert: { topicId: activeTopicId } },
    { upsert: true }
  );

  const strategy = topicMastery < 50 ? "foundation_first" : "example_first";
  const selectionReason = lastAttempt && !lastAttempt.correct
    ? `Your last response showed a gap in ${missedConcepts[0] || currentTopic.name}; this question reinforces that concept.`
    : recentTopicAttempts.length
      ? `Your recent practice accuracy is ${recentTopicAccuracy}% in ${currentTopic.name}; this question targets ${targetDifficulty} difficulty.`
      : currentTopic.attempts > 0
        ? `Your course assessment identified ${currentTopic.name} as a useful starting area; this is your first practice challenge.`
        : `This is your first practice challenge in ${currentTopic.name}; ADAPT is establishing a baseline.`;

  return {
    id: qDoc.id,
    courseId: course.id,
    topicId: qDoc.topicId,
    topicName: currentTopic.name,
    title: `${currentTopic.name} Challenge`,
    difficulty: qDoc.difficulty,
    question: qDoc.question,
    options: qDoc.options,
    adaptiveContext: {
      accuracy: recentTopicAttempts.length ? recentTopicAccuracy : currentTopic.attempts > 0 ? topicAccuracy : null,
      topicMastery: masteryObj?.attempts || currentTopic.attempts > 0 ? topicMastery : null,
      practiceAttempts: recentTopicAttempts.length,
      recentAccuracy,
      reason: selectionReason,
      strategy: missedConcepts.length ? "mistake_reinforcement" : strategy,
    },
  };
}

async function processPracticeAnswer(params: {
  questionId: string;
  selectedOptionId: string;
  timeTakenSeconds?: number;
  userId?: string;
  clientAttemptId?: string;
  courseId?: string;
  topicId?: string;
}) {
  const { questionId, selectedOptionId, timeTakenSeconds = 15, userId, clientAttemptId, courseId: expectedCourseId, topicId: expectedTopicId } = params;
  if (!userId) throw Object.assign(new Error("A learner account is required."), { status: 401, code: "LEARNER_REQUIRED" });

  // Authoritatively evaluate against question in MongoDB
  const qDoc = await Question.findOne({ id: questionId });
  if (!qDoc || qDoc.type !== "practice") {
    const error = new Error("Practice question not found.") as Error & { status: number; code: string };
    error.status = 404;
    error.code = "QUESTION_NOT_FOUND";
    throw error;
  }
  if ((expectedCourseId && qDoc.courseId !== expectedCourseId) || (expectedTopicId && qDoc.topicId !== expectedTopicId)) {
    throw Object.assign(new Error("This downloaded question does not match its saved course and topic."), { status: 403, code: "QUESTION_SCOPE_MISMATCH" });
  }
  const correctOptionId = qDoc.correctOptionId;
  const explanation = qDoc.explanation;
  const isCorrect = correctOptionId === selectedOptionId;
  const topicId = qDoc.topicId;
  const [learner, course] = await Promise.all([
    Learner.findOne({ id: userId }),
    qDoc.courseId ? Course.findOne({ id: qDoc.courseId, userId }) : Promise.resolve(null),
  ]);
  if (!learner) throw Object.assign(new Error("Learner not found."), { status: 404, code: "LEARNER_NOT_FOUND" });
  if (!course) throw Object.assign(new Error("Question does not belong to one of your courses."), { status: 403, code: "QUESTION_NOT_OWNED" });
  const courseTopic = course.topics.find((topic) => topic.id === topicId);
  if (!courseTopic || !TOPIC_LEARNING_STATES.includes(courseTopic.learningState || "")) {
    throw Object.assign(new Error("Complete this topic's diagnostic assessment before starting its practice."), { status: 409, code: "TOPIC_ASSESSMENT_REQUIRED" });
  }
  if (!qDoc.options.some((option) => option.id === selectedOptionId)) {
    throw Object.assign(new Error("Choose one of the available answer options."), { status: 400, code: "INVALID_PRACTICE_OPTION" });
  }

  const [priorSubmission, priorAttemptSubmission] = await Promise.all([
    PracticeSubmission.findOne({ userId, questionId }),
    clientAttemptId ? PracticeSubmission.findOne({ userId, clientAttemptId }) : Promise.resolve(null),
  ]);
  const prior = priorAttemptSubmission || priorSubmission;
  if (prior && (prior.questionId !== questionId || (prior.selectedOptionId && prior.selectedOptionId !== selectedOptionId))) {
    throw Object.assign(new Error("This question already has a saved answer that differs from this submission."), { status: 409, code: "PRACTICE_IDEMPOTENCY_MISMATCH" });
  }
  if (prior) {
    if (prior.state === "COMPLETED" && prior.result) return prior.result;
    throw Object.assign(new Error("This answer is already being recorded."), { status: 409, code: "PRACTICE_ANSWER_IN_PROGRESS" });
  }
  let submission;
  try {
    [submission] = await PracticeSubmission.create([{ userId, questionId, clientAttemptId, selectedOptionId, timeTakenSeconds, state: "PROCESSING" }]);
  } catch (error) {
    if ((error as { code?: number })?.code !== 11000) throw error;
    const existing = await PracticeSubmission.findOne(clientAttemptId ? { userId, $or: [{ questionId }, { clientAttemptId }] } : { userId, questionId });
    if (existing && (existing.questionId !== questionId || (existing.selectedOptionId && existing.selectedOptionId !== selectedOptionId))) {
      throw Object.assign(new Error("This question already has a saved answer that differs from this submission."), { status: 409, code: "PRACTICE_IDEMPOTENCY_MISMATCH" });
    }
    if (existing?.state === "COMPLETED" && existing.result) return existing.result;
    throw Object.assign(new Error("This answer is already being recorded."), { status: 409, code: "PRACTICE_ANSWER_IN_PROGRESS" });
  }
  const recentTopicAttempts = await PracticeAttempt.find({ userId, topicId, courseId: course.id }).sort({ createdAt: -1 }).limit(4);

  // Update learner mastery
  const existingIdx = learner.topicMastery.findIndex((m) => m.topicId === topicId);
  const previousMastery = existingIdx >= 0 ? learner.topicMastery[existingIdx].score : courseTopic?.mastery ?? 0;
  const previousOverall = learner.overallScore;
  const change = isCorrect ? 4 : -2;
  const currentMastery = Math.max(0, Math.min(100, previousMastery + change));

  if (existingIdx >= 0) {
    const existing = learner.topicMastery[existingIdx];
    const priorAttempts = existing.attempts;
    learner.topicMastery[existingIdx].score = currentMastery;
    learner.topicMastery[existingIdx].attempts += 1;
    learner.topicMastery[existingIdx].accuracy = Math.round(((existing.accuracy * priorAttempts) + (isCorrect ? 100 : 0)) / (priorAttempts + 1));
    if (isCorrect) learner.topicMastery[existingIdx].correctAnswers += 1;
    else learner.topicMastery[existingIdx].incorrectAnswers += 1;
    learner.topicMastery[existingIdx].lastAssessed = new Date();
  } else {
    learner.topicMastery.push({
      topicId,
      score: currentMastery,
      accuracy: isCorrect ? 100 : 0,
      attempts: 1,
      correctAnswers: isCorrect ? 1 : 0,
      incorrectAnswers: isCorrect ? 0 : 1,
      lastAssessed: new Date(),
    });
  }

  const [previousPracticeAttempts, diagnosticAttempts] = await Promise.all([
    PracticeAttempt.find({ userId }),
    AssessmentAttempt.find({ userId, result: { $exists: true } }),
  ]);
  const diagnosticAnswers = diagnosticAttempts.flatMap((attempt) => attempt.answers);
  const overallCorrect = diagnosticAnswers.filter((answer) => answer.correct).length + previousPracticeAttempts.filter((attempt) => attempt.correct).length + (isCorrect ? 1 : 0);
  const overallCount = diagnosticAnswers.length + previousPracticeAttempts.length + 1;
  learner.overallScore = Math.round((overallCorrect / overallCount) * 100);
  await learner.save();

  {
    const topic = course.topics.find((item) => item.id === topicId);
    if (topic) {
      const priorCount = topic.attempts || 0;
      topic.attempts = priorCount + 1;
      topic.accuracy = Math.round(((topic.accuracy || 0) * priorCount + (isCorrect ? 100 : 0)) / topic.attempts);
      topic.mastery = currentMastery;
      topic.status = currentMastery >= 80 ? "mastered" : currentMastery >= 60 ? "improving" : "needs_attention";
      topic.learningState = currentMastery >= 80 ? "STRONG" : currentMastery < 60 ? "NEEDS_IMPROVEMENT" : "LEARNING";
      topic.unlockedAt ||= new Date();
      course.topicAttempts = { ...course.topicAttempts, [topicId]: (course.topicAttempts?.[topicId] || 0) + 1 };
      course.completedTopicIds = course.topics.filter((item) => item.mastery >= 80).map((item) => item.id);
      course.subject.completedTopics = course.completedTopicIds.length;
      course.progress = course.topics.length ? Math.round((course.completedTopicIds.length / course.topics.length) * 100) : 0;

      const recentWithCurrent = [isCorrect, ...recentTopicAttempts.map((attempt) => attempt.correct)];
      const recentAccuracy = recentWithCurrent.length
        ? recentWithCurrent.filter(Boolean).length / recentWithCurrent.length
        : 0;
      if (!isCorrect || recentAccuracy < 0.6 || currentMastery < 60) {
        course.activeTopicId = topicId;
        course.recommendedTopicId = topicId;
      } else {
        const topicIndex = course.topics.findIndex((item) => item.id === topicId);
        const nextTopic = course.topics.slice(topicIndex + 1).find((item) =>
          TOPIC_LEARNING_STATES.includes(item.learningState || "") && item.mastery < 80 && !course.completedTopicIds.includes(item.id)
        );
        if (nextTopic) {
          course.activeTopicId = nextTopic.id;
          course.recommendedTopicId = nextTopic.id;
        }
      }
      learner.activeCourseId = course.id;
      learner.activeTopicId = course.activeTopicId || topicId;
      await learner.save();
      await course.save();
    }
  }

  // Update progress in MongoDB
  let progress = await Progress.findOne({ userId });
  const totalAttempts = previousPracticeAttempts.length + 1;
  const accuracy = Math.round((overallCorrect / overallCount) * 100);
  if (!progress) {
    progress = new Progress({
      userId,
      overall: { current: learner.overallScore, previous: previousOverall, change: learner.overallScore - previousOverall },
      topicProgress: [],
      statistics: { questionsCompleted: 1, learningMinutes: timeTakenSeconds / 60, streakDays: 0, accuracy },
    });
  } else {
    progress.overall.previous = previousOverall;
    progress.overall.current = learner.overallScore;
    progress.overall.change = learner.overallScore - previousOverall;
    progress.statistics.questionsCompleted += 1;
    progress.statistics.learningMinutes += timeTakenSeconds / 60;
    progress.statistics.accuracy = accuracy;
  }
  const existingProgress = progress.topicProgress.find((item) => item.topicId === topicId);
  if (existingProgress) {
    existingProgress.previous = existingProgress.current;
    existingProgress.current = currentMastery;
    existingProgress.change = currentMastery - existingProgress.previous;
  } else {
    progress.topicProgress.push({ topicId, name: courseTopic?.name || topicId, previous: previousMastery, current: currentMastery, change });
  }
  progress.statistics.questionsCompleted = totalAttempts;
  await progress.save();

  // Save practice attempt in MongoDB
  const concept = qDoc.conceptTested || "this concept";
  const whatAdaptLearned = isCorrect
    ? `You answered ${concept} correctly; your recent results will determine when to increase complexity.`
    : `Your answer identified ${concept} for reinforcement, and the next step will revisit its foundations.`;
  const recentWithCurrent = [isCorrect, ...recentTopicAttempts.map((attempt) => attempt.correct)];
  const recentAccuracy = recentWithCurrent.filter(Boolean).length / recentWithCurrent.length;
  const nextDifficulty = !isCorrect || recentAccuracy < 0.6 || currentMastery < 50
    ? "easy"
    : recentAccuracy >= 0.8 && currentMastery >= 70
      ? "hard"
      : "medium";
  const nextStrategy = !isCorrect
    ? "mistake_reinforcement"
    : nextDifficulty === "hard"
      ? "application"
      : "retrieval_practice";
  const adaptReason = !isCorrect
    ? `The response missed ${concept}; reinforcing this topic at ${nextDifficulty} difficulty.`
    : `Recent topic accuracy is ${Math.round(recentAccuracy * 100)}% and mastery is ${currentMastery}%; continuing with ${nextDifficulty} difficulty.`;

  const attemptDoc = new PracticeAttempt({
    id: clientAttemptId ? `offline_${clientAttemptId}` : `practice_attempt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId,
    questionId,
    topicId,
    courseId: qDoc.courseId,
    selectedOptionId,
    correct: isCorrect,
    timeTakenSeconds,
    feedback: {
      status: isCorrect ? "correct" : "incorrect",
      correctOptionId,
      explanation,
      whatAdaptLearned,
      mastery: {
        previous: previousMastery,
        current: currentMastery,
        change,
      },
    },
    adaptation: {
      nextDifficulty,
      nextStrategy,
      reason: adaptReason,
    },
  });
  await attemptDoc.save();

  const result = {
    attempt: {
      questionId,
      selectedOptionId,
      correct: isCorrect,
      timeTakenSeconds,
    },
    feedback: {
      status: isCorrect ? "correct" : "incorrect",
      correctOptionId,
      explanation,
      whatAdaptLearned,
      mastery: {
        previous: previousMastery,
        current: currentMastery,
        change,
      },
    },
    adaptation: {
      nextDifficulty,
      nextStrategy,
      reason: adaptReason,
    },
  };
  submission.state = "COMPLETED";
  submission.result = result;
  await submission.save();
  return result;
}

export async function submitPracticeAnswer(params: Parameters<typeof processPracticeAnswer>[0]) {
  if (!params.userId) return processPracticeAnswer(params);
  const userId = params.userId;
  const lockToken = randomUUID();
  let acquired = false;

  for (let attempt = 0; attempt < 80 && !acquired; attempt += 1) {
    const now = new Date();
    try {
      const lock = await PracticeSyncLock.findOneAndUpdate(
        { userId, expiresAt: { $lte: now } },
        { $set: { lockToken, expiresAt: new Date(now.getTime() + 120_000) } },
        { new: true, upsert: true }
      );
      acquired = lock?.lockToken === lockToken;
    } catch (error) {
      if ((error as { code?: number })?.code !== 11000) throw error;
    }
    if (!acquired) await new Promise((resolve) => setTimeout(resolve, 100));
  }

  if (!acquired) {
    throw Object.assign(new Error("Another answer is being saved for this learner. Retry sync in a moment."), { status: 409, code: "PRACTICE_SYNC_BUSY" });
  }

  try {
    return await processPracticeAnswer(params);
  } finally {
    await PracticeSyncLock.deleteOne({ userId, lockToken });
  }
}
