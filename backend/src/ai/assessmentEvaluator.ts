import { Question } from "../models/Question.js";
import { Course } from "../models/Course.js";
import { Learner } from "../models/Learner.js";
import { AssessmentAttempt, ISubmittedAnswer, ITopicPerformance } from "../models/AssessmentAttempt.js";
import { Recommendation } from "../models/Recommendation.js";

export async function evaluateDiagnosticAssessment(payload: {
  subjectId: string;
  courseId: string;
  assessmentId?: string;
  userId?: string;
  answers: Array<{
    questionId: string;
    questionNumber?: number;
    topicId: string;
    topic?: string;
    difficulty?: string;
    selectedAnswer: string;
  }>;
}) {
  const { subjectId, courseId, assessmentId, answers, userId } = payload;
  if (!userId) {
    const error = new Error("A learner account is required to submit an assessment.") as Error & { status: number; code: string };
    error.status = 401;
    error.code = "LEARNER_REQUIRED";
    throw error;
  }

  const course = await Course.findOne({ id: courseId, userId });
  if (!course) {
    const error = new Error("Course not found for this assessment.") as Error & { status: number; code: string };
    error.status = 404;
    error.code = "COURSE_NOT_FOUND";
    throw error;
  }
  const subjectName = course?.subject?.name || subjectId.toUpperCase();

  const session = assessmentId
    ? await AssessmentAttempt.findOne({ id: assessmentId, userId, courseId, status: "IN_PROGRESS" })
    : null;
  if (assessmentId && !session) {
    const completed = await AssessmentAttempt.findOne({ id: assessmentId, userId, courseId, result: { $exists: true } });
    if (completed?.result) return completed.result;
    const error = new Error("In-progress assessment not found.") as Error & { status: number; code: string };
    error.status = 404;
    error.code = "ASSESSMENT_NOT_FOUND";
    throw error;
  }
  if (session) {
    const submittedIds = answers.map((answer) => answer.questionId);
    if (submittedIds.length !== session.questionIds.length || session.questionIds.some((id) => !submittedIds.includes(id))) {
      const error = new Error("Submit every question in this assessment before completing it.") as Error & { status: number; code: string };
      error.status = 400;
      error.code = "ASSESSMENT_INCOMPLETE";
      throw error;
    }
    const savedAnswers = new Map(session.pendingAnswers.map((answer) => [answer.questionId, answer.selectedAnswer]));
    if (answers.some((answer) => savedAnswers.get(answer.questionId) !== answer.selectedAnswer)) {
      const error = new Error("Save all assessment answers before completing the assessment.") as Error & { status: number; code: string };
      error.status = 409;
      error.code = "ASSESSMENT_PROGRESS_MISMATCH";
      throw error;
    }
  }
  const topicScoped = Boolean(session?.topicId);

  // Authoritatively evaluate answers against questions stored in MongoDB
  const questionIds = answers.map((a) => a.questionId);
  const questionsInDb = await Question.find({ id: { $in: questionIds }, courseId, type: "diagnostic" });
  const questionMap = new Map(questionsInDb.map((q) => [q.id, q]));
  if (questionMap.size !== new Set(questionIds).size) {
    const error = new Error("One or more assessment questions are invalid for this course.") as Error & { status: number; code: string };
    error.status = 400;
    error.code = "INVALID_ASSESSMENT_QUESTIONS";
    throw error;
  }

  const evaluatedAnswers: ISubmittedAnswer[] = answers.map((ans) => {
    const qDoc = questionMap.get(ans.questionId);
    const isCorrect = qDoc.correctOptionId === ans.selectedAnswer;
    const topic = course.topics.find((item) => item.id === qDoc.topicId);
    return {
      questionId: ans.questionId,
      questionNumber: ans.questionNumber,
      topicId: qDoc.topicId,
      topic: topic?.name,
      difficulty: qDoc.difficulty,
      selectedAnswer: ans.selectedAnswer,
      correct: isCorrect,
    };
  });

  const totalQuestions = evaluatedAnswers.length;
  const totalCorrect = evaluatedAnswers.filter((a) => a.correct).length;
  const accuracyPct = totalQuestions ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

  // Determine learner level from score
  const level: "Beginner" | "Intermediate" | "Advanced" =
    accuracyPct >= 75 ? "Advanced" : accuracyPct >= 40 ? "Intermediate" : "Beginner";

  // Topic-wise performance
  const topicsList = course?.topics || [];
  const topicPerformance: ITopicPerformance[] = topicsList.map((t) => {
    const topicAnswers = evaluatedAnswers.filter((a) => a.topicId === t.id);
    const correctCount = topicAnswers.filter((a) => a.correct).length;
    const totalCount = topicAnswers.length;
    return {
      topicId: t.id,
      name: t.name,
      total: totalCount,
      correct: correctCount,
      accuracy: totalCount ? Math.round((correctCount / totalCount) * 100) : null,
    };
  });

  // Calculate strengths and weaknesses
  const assessedTopics = topicPerformance.filter((t) => t.total > 0);
  const strengths = assessedTopics
    .filter((t) => (t.accuracy ?? 0) >= 70)
    .map((t) => t.name);
  const weaknesses = assessedTopics
    .filter((t) => (t.accuracy ?? 0) < 70)
    .map((t) => t.name);

  // Determine starting topic: lowest accuracy first, or first topic
  const sortedByAccuracy = [...assessedTopics].sort((a, b) => (a.accuracy ?? 0) - (b.accuracy ?? 0));
  const startingTopic = sortedByAccuracy[0] || topicPerformance[0] || {
    topicId: `${subjectId}_topic_1`,
    name: "Foundations",
  };

  const lowestAccuracy = sortedByAccuracy[0]?.accuracy ?? null;
  const lowestTopics = lowestAccuracy === null
    ? []
    : assessedTopics.filter((topic) => topic.accuracy === lowestAccuracy);
  const explanation = !startingTopic.name
    ? "Start with the first topic and build your mastery baseline."
    : lowestAccuracy === 100
      ? `Your diagnostic showed strong understanding across the assessed topics. Start with ${startingTopic.name} as a baseline; ADAPT will adjust recommendations using your practice results.`
      : lowestTopics.length > 1
        ? `Your lowest diagnostic results were tied across ${lowestTopics.map((topic) => topic.name).join(", ")}. Begin with ${startingTopic.name}; ADAPT will adjust recommendations as you practice.`
        : `Your diagnostic showed more room to build confidence in ${startingTopic.name} (${lowestAccuracy}% on the assessed questions). Topics with stronger baseline scores are marked for accelerated application.`;

  const learner = await Learner.findOne({ id: userId });

  const result = {
    subject: {
      id: subjectId,
      name: subjectName,
    },
    level,
    accuracy: accuracyPct,
    total: totalQuestions,
    topicPerformance,
    strengths,
    weaknesses,
    recommendedTopicId: startingTopic.topicId,
    recommendedTopic: startingTopic.name,
    explanation,
  };

  // 1. Save AssessmentAttempt to MongoDB
  const attemptId = session?.id || `attempt_${Date.now()}`;
  const attemptDoc = session || new AssessmentAttempt({ id: attemptId, userId, courseId, subjectId });
  if (!learner) {
    const error = new Error("Learner account not found.") as Error & { status: number; code: string };
    error.status = 404;
    error.code = "LEARNER_NOT_FOUND";
    throw error;
  }
  attemptDoc.status = "COMPLETED";
  attemptDoc.questionIds = questionIds;
  attemptDoc.answers = evaluatedAnswers;
  attemptDoc.pendingAnswers = [];
  attemptDoc.result = result;
  await attemptDoc.save();

  // 2. Update Course in MongoDB
  if (course) {
    course.status = "active";
    if (!topicScoped) course.learnerLevel = level;
    course.recommendedTopicId = startingTopic.topicId;
    course.activeTopicId = startingTopic.topicId;
    for (const topic of course.topics) {
      const performance = topicPerformance.find((entry) => entry.topicId === topic.id);
      if (performance?.total) {
        const oldAttempts = topicScoped ? topic.attempts || 0 : 0;
        const oldAccuracy = topicScoped ? topic.accuracy || 0 : 0;
        const newAccuracy = performance.accuracy ?? 0;
        topic.attempts = oldAttempts + performance.total;
        topic.accuracy = Math.round((oldAccuracy * oldAttempts + newAccuracy * performance.total) / topic.attempts);
        topic.mastery = topic.accuracy;
        topic.status = topic.mastery >= 80 ? "mastered" : topic.mastery >= 60 ? "improving" : "needs_attention";
        topic.learningState = topic.mastery >= 80 ? "STRONG" : topic.mastery < 60 ? "NEEDS_IMPROVEMENT" : "UNLOCKED";
        topic.unlockedAt ||= new Date();
      }
    }
    course.completedTopicIds = course.topics.filter((topic) => topic.mastery >= 80).map((topic) => topic.id);
    course.subject.completedTopics = course.completedTopicIds.length;
    course.progress = course.topics.length ? Math.round((course.completedTopicIds.length / course.topics.length) * 100) : 0;
    await course.save();
  }

  // 3. Update or create Learner model with topic mastery
  if (!topicScoped) {
    learner.currentLevel = level;
    learner.overallScore = accuracyPct;
    learner.strengths = strengths;
    learner.weaknesses = weaknesses;
  }
  learner.activeCourseId = courseId;
  learner.activeTopicId = startingTopic.topicId;

  // Update learner topic mastery
  for (const tp of topicPerformance) {
    if (tp.total > 0 && tp.accuracy !== null) {
      const existingIdx = learner.topicMastery.findIndex((m) => m.topicId === tp.topicId);
      const previous = learner.topicMastery[existingIdx];
      const oldAttempts = topicScoped ? previous?.attempts || 0 : 0;
      const oldAccuracy = topicScoped ? previous?.accuracy || 0 : 0;
      const assessmentAccuracy = tp.accuracy;
      const totalAttempts = oldAttempts + tp.total;
      const masteryEntry = {
        topicId: tp.topicId,
        topicName: tp.name,
        score: Math.round(((previous?.score || 0) * oldAttempts + assessmentAccuracy * tp.total) / totalAttempts),
        accuracy: Math.round((oldAccuracy * oldAttempts + assessmentAccuracy * tp.total) / totalAttempts),
        attempts: totalAttempts,
        correctAnswers: (topicScoped ? previous?.correctAnswers || 0 : 0) + tp.correct,
        incorrectAnswers: (topicScoped ? previous?.incorrectAnswers || 0 : 0) + tp.total - tp.correct,
        lastAssessed: new Date(),
      };
      if (existingIdx >= 0) {
      learner.topicMastery[existingIdx] = masteryEntry;
      } else {
        learner.topicMastery.push(masteryEntry);
      }
    }
  }
  await learner.save();

  // 4. Save Recommendation to MongoDB
  await Recommendation.create({
    id: `rec_${attemptId}`,
    userId,
    type: "topic_practice",
    topicId: startingTopic.topicId,
    title: `Practice ${startingTopic.name}`,
    reason: explanation,
    durationMinutes: 15,
    priority: "high",
  });

  console.log(`[AssessmentEvaluator] Assessment ${attemptId} saved. Level: ${level}, Recommended: ${startingTopic.name}`);

  return result;
}
