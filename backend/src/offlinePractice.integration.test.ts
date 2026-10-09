import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { app } from "./app.js";
import { AssessmentAttempt } from "./models/AssessmentAttempt.js";
import { AuthSession } from "./models/AuthSession.js";
import { Course } from "./models/Course.js";
import { Learner } from "./models/Learner.js";
import { PracticeAttempt } from "./models/PracticeAttempt.js";
import { PracticeSubmission } from "./models/PracticeSubmission.js";
import { PracticeSyncLock } from "./models/PracticeSyncLock.js";
import { Progress } from "./models/Progress.js";
import { Question } from "./models/Question.js";
import { Recommendation } from "./models/Recommendation.js";

const mongoUri = process.env.PHASE2_TEST_MONGODB_URI;

test("offline sync enforces ownership, retries idempotently, and serializes concurrent attempts", { skip: !mongoUri }, async (t) => {
  const originalSecret = process.env.JWT_SECRET;
  const secret = "phase2-test-only-jwt-secret";
  process.env.JWT_SECRET = secret;
  await mongoose.connect(mongoUri!, { serverSelectionTimeoutMS: 5000 });
  const models = [AssessmentAttempt, AuthSession, Course, Learner, PracticeAttempt, PracticeSubmission, PracticeSyncLock, Progress, Question, Recommendation];
  await Promise.all(models.map((model) => model.init()));

  const runId = `phase2-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const userA = `${runId}-learner-a`;
  const userB = `${runId}-learner-b`;
  const courseA = `${runId}-course-a`;
  const courseB = `${runId}-course-b`;
  const topicA = `${runId}-topic-a`;
  const topicB = `${runId}-topic-b`;
  const qA1 = `${runId}-question-a1`;
  const qA2 = `${runId}-question-a2`;
  const qA3 = `${runId}-question-a3`;
  const qB1 = `${runId}-question-b1`;
  const sessionIds = new Map<string, string>();
  let server: ReturnType<typeof app.listen> | undefined;

  async function tokenFor(userId: string) {
    const jti = `${runId}-${userId}-session`;
    sessionIds.set(userId, jti);
    await AuthSession.create({ jti, userId, expiresAt: new Date(Date.now() + 60 * 60_000) });
    return jwt.sign({ sub: userId, jti }, secret, { issuer: "adapt-api", audience: "adapt-client", expiresIn: "1h" });
  }

  async function createLearnerAndCourse(userId: string, courseId: string, topicId: string, suffix: string) {
    await Learner.create({ id: userId, name: suffix, email: `${suffix}@offline-test.invalid`, activeCourseId: courseId, activeTopicId: topicId });
    await Course.create({
      id: courseId,
      userId,
      title: `Test course ${suffix}`,
      learningRequest: "Offline sync integration test",
      subject: { id: `${runId}-subject`, name: "Test subject" },
      topics: [{ id: topicId, subjectId: `${runId}-subject`, name: "Test topic", learningState: "UNLOCKED", mastery: 10, accuracy: 10, attempts: 0 }],
    });
    await AssessmentAttempt.create({
      id: `${runId}-assessment-${suffix}`,
      userId,
      courseId,
      subjectId: `${runId}-subject`,
      status: "COMPLETED",
      questionIds: [],
      answers: [],
      pendingAnswers: [],
      result: {
        subject: { id: `${runId}-subject`, name: "Test subject" }, level: "Beginner", accuracy: 0, total: 0,
        topicPerformance: [], strengths: [], weaknesses: [], recommendedTopicId: topicId, recommendedTopic: "Test topic", explanation: "Test result.",
      },
    });
  }

  async function createQuestion(id: string, courseId: string, topicId: string) {
    await Question.create({
      id, courseId, subjectId: `${runId}-subject`, topicId, difficulty: "easy", question: `Question ${id}`,
      options: [{ id: "a", text: "First" }, { id: "b", text: "Second" }],
      correctOptionId: "a", explanation: "First is correct.", type: "practice",
    });
  }

  async function request(path: string, token: string, init: RequestInit = {}) {
    return fetch(`http://127.0.0.1:${(server!.address() as { port: number }).port}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers || {}) },
    });
  }

  try {
    await createLearnerAndCourse(userA, courseA, topicA, "learner-a");
    await createLearnerAndCourse(userB, courseB, topicB, "learner-b");
    await Promise.all([createQuestion(qA1, courseA, topicA), createQuestion(qA2, courseA, topicA), createQuestion(qA3, courseA, topicA), createQuestion(qB1, courseB, topicB)]);
    const [tokenA, tokenB] = await Promise.all([tokenFor(userA), tokenFor(userB)]);

    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");

    const packResponse = await request(`/api/courses/${courseA}/offline-practice`, tokenA);
    assert.equal(packResponse.status, 200);
    const pack = await packResponse.json() as { questions: Array<Record<string, unknown>> };
    assert.ok(pack.questions.length >= 3);
    assert.ok(pack.questions.every((question) => !("correctOptionId" in question) && !("explanation" in question)));
    assert.equal((await request(`/api/courses/${courseA}/offline-practice`, tokenB)).status, 404);

    const dashboardResponse = await request(`/api/dashboard/${userA}`, tokenA);
    assert.equal(dashboardResponse.status, 200);
    const dashboard = await dashboardResponse.json() as { activeCourseId: string };
    assert.equal(dashboard.activeCourseId, courseA);
    const courseResponse = await request(`/api/courses/${courseA}`, tokenA);
    assert.equal(courseResponse.status, 200);
    const loadedCourse = await courseResponse.json() as { id: string };
    assert.equal(loadedCourse.id, courseA);
    const assessmentResponse = await request(`/api/courses/${courseA}/assessment`, tokenA);
    assert.equal(assessmentResponse.status, 200);
    const assessment = await assessmentResponse.json() as { status: string; result?: { recommendedTopicId: string } };
    assert.equal(assessment.status, "COMPLETED");
    assert.equal(assessment.result?.recommendedTopicId, topicA);
    const nextPracticeResponse = await request(`/api/practice/next/${userA}`, tokenA);
    assert.equal(nextPracticeResponse.status, 200);
    const nextPractice = await nextPracticeResponse.json() as { id: string; courseId: string };
    assert.equal(nextPractice.courseId, courseA);
    assert.ok(pack.questions.some((question) => question.id === nextPractice.id));

    const spoofedIdentity = await request("/api/offline/sync", tokenA, {
      method: "POST",
      body: JSON.stringify({ userId: userB, activities: [] }),
    });
    assert.equal(spoofedIdentity.status, 403);

    const stamp = new Date().toISOString();
    const attemptA1 = {
      activityId: `${runId}-attempt-a1`, courseId: courseA, questionId: qA1, topicId: topicA,
      selectedOptionId: "a", timeTakenSeconds: 12, createdAt: stamp,
    };
    const crossLearnerAttempt = {
      activityId: `${runId}-attempt-b1`, courseId: courseA, questionId: qB1, topicId: topicB,
      selectedOptionId: "a", timeTakenSeconds: 12, createdAt: stamp,
    };
    const partialResponse = await request("/api/offline/sync", tokenA, {
      method: "POST", body: JSON.stringify({ activities: [attemptA1, crossLearnerAttempt] }),
    });
    assert.equal(partialResponse.status, 200);
    const partial = await partialResponse.json() as { acknowledgements: Array<{ activityId: string; status: string }> };
    assert.deepEqual(partial.acknowledgements.map((item) => item.status), ["synced", "pending"]);
    assert.equal(await PracticeAttempt.countDocuments({ userId: userB }), 0);

    const duplicateResponse = await request("/api/offline/sync", tokenA, {
      method: "POST", body: JSON.stringify({ activities: [attemptA1] }),
    });
    assert.equal((await duplicateResponse.json() as { acknowledgements: Array<{ status: string }> }).acknowledgements[0].status, "synced");
    assert.equal(await PracticeAttempt.countDocuments({ userId: userA, questionId: qA1 }), 1);

    const concurrentActivities = [qA2, qA3].map((questionId, index) => ({
      activityId: `${runId}-attempt-concurrent-${index}`,
      courseId: courseA,
      questionId,
      topicId: topicA,
      selectedOptionId: index === 0 ? "a" : "b",
      timeTakenSeconds: 17,
      createdAt: stamp,
    }));
    const concurrent = await Promise.all(concurrentActivities.map((activity) => request("/api/offline/sync", tokenA, {
      method: "POST", body: JSON.stringify({ activities: [activity] }),
    })));
    const concurrentAcks = await Promise.all(concurrent.map(async (response) => (await response.json() as { acknowledgements: Array<{ status: string }> }).acknowledgements[0].status));
    assert.deepEqual(concurrentAcks, ["synced", "synced"]);
    assert.equal(await PracticeAttempt.countDocuments({ userId: userA, courseId: courseA }), 3);

    const learner = await Learner.findOne({ id: userA });
    const course = await Course.findOne({ id: courseA });
    const progress = await Progress.findOne({ userId: userA });
    assert.equal(learner?.topicMastery.find((entry) => entry.topicId === topicA)?.attempts, 3);
    assert.equal(course?.topicAttempts?.[topicA], 3);
    assert.equal(progress?.statistics.questionsCompleted, 3);
    assert.equal(await PracticeSubmission.countDocuments({ userId: userA }), 3);

    const progressResponse = await request(`/api/progress/${userA}`, tokenA);
    assert.equal(progressResponse.status, 200);
    const progressView = await progressResponse.json() as { statistics: { questionsCompleted: number }; topicProgress: Array<{ topicId: string; attempts: number }> };
    assert.equal(progressView.statistics.questionsCompleted, 3);
    assert.equal(progressView.topicProgress.find((item) => item.topicId === topicA)?.attempts, 3);

    const logoutResponse = await request("/api/auth/logout", tokenB, { method: "POST", body: JSON.stringify({}) });
    assert.equal(logoutResponse.status, 200);
    assert.equal((await request(`/api/courses/${courseB}/offline-practice`, tokenB)).status, 401);
  } finally {
    if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
    await Promise.all([
      Learner.deleteMany({ id: { $in: [userA, userB] } }),
      Course.deleteMany({ id: { $in: [courseA, courseB] } }),
      AssessmentAttempt.deleteMany({ userId: { $in: [userA, userB] } }),
      Question.deleteMany({ id: { $in: [qA1, qA2, qA3, qB1] } }),
      PracticeAttempt.deleteMany({ userId: { $in: [userA, userB] } }),
      PracticeSubmission.deleteMany({ userId: { $in: [userA, userB] } }),
      PracticeSyncLock.deleteMany({ userId: { $in: [userA, userB] } }),
      Progress.deleteMany({ userId: { $in: [userA, userB] } }),
      Recommendation.deleteMany({ userId: { $in: [userA, userB] } }),
      AuthSession.deleteMany({ userId: { $in: [userA, userB] } }),
    ]);
    await mongoose.disconnect();
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  }
});
