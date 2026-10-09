import assert from "node:assert/strict";
import test from "node:test";
import { PracticeSubmission } from "./models/PracticeSubmission.js";
import { processOfflinePracticeActivities, publicPracticeQuestion } from "./controllers/offlinePracticeController.js";
import { submittedIdentityMatches } from "./middleware/requireAuth.js";
import { OfflinePracticeSyncSchema } from "./validators/schemas.js";

const activity = {
  activityId: "local-attempt-001",
  courseId: "course-a",
  questionId: "question-a",
  topicId: "topic-a",
  selectedOptionId: "b",
  timeTakenSeconds: 21,
  createdAt: "2026-10-09T10:00:00.000Z",
};

test("offline sync schema validates bounded activity records and rejects learner payload fields", () => {
  assert.equal(OfflinePracticeSyncSchema.safeParse({ activities: [activity] }).success, true);
  assert.equal(OfflinePracticeSyncSchema.safeParse({ activities: [{ ...activity, learnerId: "learner-b" }] }).success, false);
  assert.equal(OfflinePracticeSyncSchema.safeParse({ activities: [{ ...activity, createdAt: "yesterday" }] }).success, false);
  assert.equal(OfflinePracticeSyncSchema.safeParse({ activities: Array.from({ length: 21 }, (_, i) => ({ ...activity, activityId: `attempt-${i}` })) }).success, false);
});

test("authenticated identity checks reject attempts to sync another learner's activities", () => {
  assert.equal(submittedIdentityMatches({ activities: [activity] }, "learner-a"), true);
  assert.equal(submittedIdentityMatches({ activities: [activity], userId: "learner-b" }, "learner-a"), false);
  assert.equal(submittedIdentityMatches({ userId: "learner-a" }, "learner-a"), true);
});

test("offline practice projection never includes answer keys or grading explanations", () => {
  const safe = publicPracticeQuestion({
    id: "question-a", courseId: "course-a", topicId: "topic-a", difficulty: "easy",
    question: "Pick the answer", options: [{ id: "a", text: "First" }, { id: "b", text: "Second" }],
    correctOptionId: "b", explanation: "Second is correct.", conceptTested: "concept",
  }, { topics: [{ id: "topic-a", name: "Topic A" }] });
  assert.deepEqual(safe.options, [{ id: "a", text: "First" }, { id: "b", text: "Second" }]);
  assert.equal("correctOptionId" in safe, false);
  assert.equal("explanation" in safe, false);
  assert.equal("conceptTested" in safe, false);
});

test("sync acknowledges each activity independently and retains stable idempotency IDs", async () => {
  const seen = new Map<string, string>();
  const submit = async (params: { userId?: string; questionId: string; clientAttemptId?: string }) => {
    assert.equal(params.userId, "token-owner");
    assert.match(params.clientAttemptId || "", /^local-attempt-00[12]$/);
    if (params.questionId === "question-fails") throw Object.assign(new Error("Temporary failure"), { code: "TEMPORARY" });
    if (!seen.has(params.clientAttemptId!)) seen.set(params.clientAttemptId!, params.questionId);
    return { attempt: { questionId: params.questionId } };
  };
  const validBatch = OfflinePracticeSyncSchema.parse({ activities: [activity, { ...activity, activityId: "local-attempt-002", questionId: "question-fails" }] }).activities;
  const first = await processOfflinePracticeActivities("token-owner", validBatch, submit as any);
  const second = await processOfflinePracticeActivities("token-owner", [validBatch[0]], submit as any);
  assert.deepEqual(first.map((item) => item.status), ["synced", "pending"]);
  assert.equal(second[0].status, "synced");
  assert.equal(seen.size, 1);
});

test("database enforces per-learner question and stable activity uniqueness", () => {
  const indexes = PracticeSubmission.schema.indexes();
  assert.ok(indexes.some(([keys, options]) => keys.userId === 1 && keys.questionId === 1 && options.unique === true));
  assert.ok(indexes.some(([keys, options]) => keys.userId === 1 && keys.clientAttemptId === 1 && options.unique === true && Boolean(options.partialFilterExpression)));
});
