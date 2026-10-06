import { Question } from "../models/Question.js";
import { Course } from "../models/Course.js";
import { Learner } from "../models/Learner.js";
import { PracticeAttempt } from "../models/PracticeAttempt.js";
import { Progress } from "../models/Progress.js";
import { generateStructuredAIResponse } from "./aiClient.js";
import { AIDiagnosticQuestionJsonSchema, AIDiagnosticQuestionSchema } from "../validators/schemas.js";

export async function getNextPracticeQuestion(userId: string = "user_001") {
  const learner = await Learner.findOne({ id: userId });
  const activeCourseId = learner?.activeCourseId;
  const course = activeCourseId ? await Course.findOne({ id: activeCourseId }) : await Course.findOne().sort({ createdAt: -1 });

  const recentAttempts = await PracticeAttempt.find({ userId }).sort({ createdAt: -1 }).limit(8);
  const recentAccuracy = recentAttempts.length
    ? Math.round((recentAttempts.filter((attempt) => attempt.correct).length / recentAttempts.length) * 100)
    : null;
  const lastAttempt = recentAttempts[0];
  const requestedTopicId =
    learner?.activeTopicId ||
    course?.activeTopicId ||
    course?.recommendedTopicId ||
    course?.topics?.[0]?.id ||
    "topic_default";

  // Recent mistakes take priority for reinforcement. After a strong streak, advance through course order.
  let activeTopicId = requestedTopicId;
  if (lastAttempt && !lastAttempt.correct && course?.topics?.some((topic) => topic.id === lastAttempt.topicId)) {
    activeTopicId = lastAttempt.topicId;
  } else if (recentAttempts.length >= 3 && recentAccuracy !== null && recentAccuracy >= 80 && course?.topics?.length) {
    const currentIndex = course.topics.findIndex((topic) => topic.id === requestedTopicId);
    const nextTopic = course.topics.slice(Math.max(currentIndex + 1, 0)).find((topic) => {
      const mastery = learner?.topicMastery?.find((entry) => entry.topicId === topic.id)?.score ?? topic.mastery ?? 0;
      return mastery < 80 && !course.completedTopicIds?.includes(topic.id);
    });
    if (nextTopic) activeTopicId = nextTopic.id;
  }

  const currentTopic = course?.topics?.find((t) => t.id === activeTopicId) || {
    id: activeTopicId,
    name: "Core Concept",
    description: "",
    learningObjectives: [],
    accuracy: 45,
    mastery: 40,
    difficulty: "medium",
  };

  const masteryObj = learner?.topicMastery?.find((m) => m.topicId === activeTopicId);
  const topicMastery = masteryObj?.score ?? currentTopic.mastery ?? 45;
  const topicAccuracy = masteryObj?.accuracy ?? currentTopic.accuracy ?? 50;
  const recentTopicAttempts = recentAttempts.filter((attempt) => attempt.topicId === activeTopicId);
  const recentTopicAccuracy = recentTopicAttempts.length
    ? Math.round((recentTopicAttempts.filter((attempt) => attempt.correct).length / recentTopicAttempts.length) * 100)
    : topicAccuracy;
  const targetDifficulty = recentTopicAccuracy < 50 || topicMastery < 40
    ? "easy"
    : recentTopicAccuracy >= 80 && topicMastery >= 70
      ? "hard"
      : "medium";
  const recentQuestionIds = recentAttempts.map((attempt) => attempt.questionId);
  const missedQuestionIds = recentAttempts.filter((attempt) => !attempt.correct).map((attempt) => attempt.questionId);
  const missedQuestions = missedQuestionIds.length
    ? await Question.find({ id: { $in: missedQuestionIds } }).select("conceptTested question").limit(4)
    : [];
  const missedConcepts = missedQuestions.map((question) => question.conceptTested || question.question).filter(Boolean);

  // Prefer a question not recently answered, at the difficulty supported by the learner's recent results.
  const availableQuestions = await Question.find({
    topicId: activeTopicId,
    type: "practice",
    id: { $nin: recentQuestionIds },
  }).sort({ createdAt: -1 });
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

      const userPrompt = `Course: "${course?.title || "Personal learning"}". Learning request: "${course?.learningRequest || ""}". Topic: "${currentTopic.name}". Description: "${currentTopic.description || ""}". Objectives: ${(currentTopic.learningObjectives || []).join("; ")}. Learner topic mastery: ${topicMastery}%. Recent topic accuracy: ${recentTopicAccuracy}%. Difficulty target: ${targetDifficulty}. Concepts from previous mistakes to reinforce: ${missedConcepts.join("; ") || "No prior mistakes recorded"}.`;

      const aiQuestion = await generateStructuredAIResponse(
        systemPrompt,
        userPrompt,
        (raw) => AIDiagnosticQuestionSchema.parse(raw),
        AIDiagnosticQuestionJsonSchema
      );

      qDoc = new Question({
        id: `practice_${activeTopicId}_${Date.now()}`,
        courseId: course?.id || null,
        subjectId: course?.subject?.id || "subject",
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

  const strategy = topicMastery < 50 ? "foundation_first" : "example_first";
  const reason =
    topicMastery < 50
      ? "Your recent accuracy indicates this concept needs reinforcement."
      : "You have strong baseline comprehension; advancing to real-world application.";

  return {
    id: qDoc.id,
    topicId: qDoc.topicId,
    difficulty: qDoc.difficulty,
    question: qDoc.question,
    options: qDoc.options,
    adaptiveContext: {
      accuracy: recentTopicAccuracy,
      topicMastery: topicMastery,
      recentAccuracy,
      reason: lastAttempt && !lastAttempt.correct
        ? `Your last response showed a gap in ${missedConcepts[0] || currentTopic.name}; this question reinforces that concept.`
        : recentAccuracy !== null && recentAccuracy >= 80
          ? `Your recent accuracy is ${recentAccuracy}%; the sequence advances to ${currentTopic.name}.`
          : `Current topic mastery is ${topicMastery}% with ${recentTopicAccuracy}% recent accuracy; this question targets ${targetDifficulty} difficulty.`,
      strategy: missedConcepts.length ? "mistake_reinforcement" : strategy,
    },
  };
}

export async function submitPracticeAnswer(params: {
  questionId: string;
  selectedOptionId: string;
  timeTakenSeconds?: number;
  userId?: string;
}) {
  const { questionId, selectedOptionId, timeTakenSeconds = 15, userId = "user_001" } = params;

  // Authoritatively evaluate against question in MongoDB
  const qDoc = await Question.findOne({ id: questionId });
  if (!qDoc) {
    const error = new Error("Practice question not found.") as Error & { status: number; code: string };
    error.status = 404;
    error.code = "QUESTION_NOT_FOUND";
    throw error;
  }
  const correctOptionId = qDoc.correctOptionId;
  const explanation = qDoc.explanation;
  const isCorrect = correctOptionId === selectedOptionId;
  const topicId = qDoc.topicId;
  const recentTopicAttempts = await PracticeAttempt.find({ userId, topicId }).sort({ createdAt: -1 }).limit(4);

  // Update learner mastery
  let learner = await Learner.findOne({ id: userId });
  if (!learner) {
    learner = new Learner({ id: userId, name: "Alex", email: "alex@example.com" });
  }

  const existingIdx = learner.topicMastery.findIndex((m) => m.topicId === topicId);
  const previousMastery = existingIdx >= 0 ? learner.topicMastery[existingIdx].score : 45;
  const change = isCorrect ? 4 : -2;
  const currentMastery = Math.max(0, Math.min(100, previousMastery + change));

  if (existingIdx >= 0) {
    learner.topicMastery[existingIdx].score = currentMastery;
    learner.topicMastery[existingIdx].attempts += 1;
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

  learner.overallScore = Math.max(0, Math.min(100, learner.overallScore + (isCorrect ? 1 : 0)));
  await learner.save();

  const course = qDoc.courseId ? await Course.findOne({ id: qDoc.courseId }) : null;
  if (course) {
    const topic = course.topics.find((item) => item.id === topicId);
    if (topic) {
      const priorCount = topic.attempts || 0;
      topic.attempts = priorCount + 1;
      topic.accuracy = Math.round(((topic.accuracy || 0) * priorCount + (isCorrect ? 100 : 0)) / topic.attempts);
      topic.mastery = currentMastery;
      topic.status = currentMastery >= 80 ? "mastered" : currentMastery >= 60 ? "improving" : "needs_attention";
      course.topicAttempts = { ...course.topicAttempts, [topicId]: (course.topicAttempts?.[topicId] || 0) + 1 };

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
          item.mastery < 80 && !course.completedTopicIds.includes(item.id)
        );
        if (nextTopic) {
          course.activeTopicId = nextTopic.id;
          course.recommendedTopicId = nextTopic.id;
        }
      }
      await course.save();
    }
  }

  // Update progress in MongoDB
  let progress = await Progress.findOne({ userId });
  if (!progress) {
    progress = new Progress({
      userId,
      overall: { current: currentMastery, previous: previousMastery, change },
      statistics: { questionsCompleted: 1, learningMinutes: 5, streakDays: 1, accuracy: isCorrect ? 100 : 0 },
    });
  } else {
    progress.overall.previous = progress.overall.current;
    progress.overall.current = currentMastery;
    progress.overall.change = currentMastery - progress.overall.previous;
    progress.statistics.questionsCompleted += 1;
    progress.statistics.learningMinutes += 2;
    const currentAcc = progress.statistics.accuracy || 50;
    progress.statistics.accuracy = Math.round((currentAcc * 9 + (isCorrect ? 100 : 0)) / 10);
  }
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
    id: `practice_attempt_${Date.now()}`,
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

  return {
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
}
