import { Question } from "../models/Question.js";
import { Course } from "../models/Course.js";
import { Learner } from "../models/Learner.js";
import { AssessmentAttempt, ISubmittedAnswer, ITopicPerformance } from "../models/AssessmentAttempt.js";
import { Recommendation } from "../models/Recommendation.js";

export async function evaluateDiagnosticAssessment(payload: {
  subjectId: string;
  courseId: string;
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
  const { subjectId, courseId, answers, userId = "user_001" } = payload;

  const course = await Course.findOne({ id: courseId });
  if (!course) {
    const error = new Error("Course not found for this assessment.") as Error & { status: number; code: string };
    error.status = 404;
    error.code = "COURSE_NOT_FOUND";
    throw error;
  }
  const subjectName = course?.subject?.name || subjectId.toUpperCase();

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

  const explanation = startingTopic.name
    ? `Your diagnostic answers showed the most room to build confidence in ${startingTopic.name}. Topics with stronger baseline scores are marked for accelerated application.`
    : "Start with the first topic and build your mastery baseline.";

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
  const attemptId = `attempt_${Date.now()}`;
  const attemptDoc = new AssessmentAttempt({
    id: attemptId,
    userId,
    courseId,
    subjectId,
    answers: evaluatedAnswers,
    result,
  });
  await attemptDoc.save();

  // 2. Update Course in MongoDB
  if (course) {
    course.status = "active";
    course.learnerLevel = level;
    course.recommendedTopicId = startingTopic.topicId;
    course.activeTopicId = startingTopic.topicId;
    for (const topic of course.topics) {
      const performance = topicPerformance.find((entry) => entry.topicId === topic.id);
      if (performance?.total) {
        topic.attempts = performance.total;
        topic.accuracy = performance.accuracy ?? 0;
        topic.mastery = performance.accuracy ?? 0;
        topic.status = topic.mastery >= 80 ? "mastered" : topic.mastery >= 60 ? "improving" : "needs_attention";
      }
    }
    await course.save();
  }

  // 3. Update or create Learner model with topic mastery
  let learner = await Learner.findOne({ id: userId });
  if (!learner) {
    learner = new Learner({
      id: userId,
      name: "Alex",
      email: "alex@example.com",
      currentLevel: level,
      overallScore: accuracyPct,
      strengths,
      weaknesses,
      activeCourseId: courseId,
      activeTopicId: startingTopic.topicId,
    });
  } else {
    learner.currentLevel = level;
    learner.overallScore = accuracyPct;
    learner.strengths = strengths;
    learner.weaknesses = weaknesses;
    learner.activeCourseId = courseId;
    learner.activeTopicId = startingTopic.topicId;
  }

  // Update learner topic mastery
  for (const tp of topicPerformance) {
    if (tp.total > 0 && tp.accuracy !== null) {
      const existingIdx = learner.topicMastery.findIndex((m) => m.topicId === tp.topicId);
      const masteryEntry = {
        topicId: tp.topicId,
        topicName: tp.name,
        score: tp.accuracy,
        accuracy: tp.accuracy,
        attempts: tp.total,
        correctAnswers: tp.correct,
        incorrectAnswers: tp.total - tp.correct,
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
  const recDoc = new Recommendation({
    id: `rec_${Date.now()}`,
    userId,
    type: "topic_practice",
    topicId: startingTopic.topicId,
    title: `Practice ${startingTopic.name}`,
    reason: explanation,
    durationMinutes: 15,
    priority: "high",
  });
  await recDoc.save();

  console.log(`[AssessmentEvaluator] Assessment ${attemptId} saved. Level: ${level}, Recommended: ${startingTopic.name}`);

  return result;
}
