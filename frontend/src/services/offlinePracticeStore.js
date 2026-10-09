import { idbRequest, idbTransactionDone, openOfflineDatabase } from "./offlineDb";

const QUIZ_STORE = "downloaded-practice";
const ACTIVITY_STORE = "offline-activities";

function quizKey(userId, courseId) {
  return `${encodeURIComponent(userId)}:${encodeURIComponent(courseId)}`;
}

function notifyActivitiesChanged(userId) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("adapt:offline-activities-changed", { detail: { userId } }));
  }
}

function newActivityId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const values = new Uint8Array(16);
  globalThis.crypto.getRandomValues(values);
  return [...values].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function safeQuestion(question) {
  if (!question?.id || !question.courseId || !question.topicId || !question.question || !Array.isArray(question.options) || question.options.length < 2) {
    throw new Error("The server returned an incomplete practice question. It was not saved offline.");
  }
  const options = question.options.map((option) => {
    if (!option?.id || !option?.text) throw new Error("A practice question has invalid answer choices and was not saved.");
    return { id: String(option.id), text: String(option.text) };
  });
  return {
    id: String(question.id),
    courseId: String(question.courseId),
    topicId: String(question.topicId),
    topicName: String(question.topicName || question.topicId),
    difficulty: String(question.difficulty || "medium"),
    question: String(question.question),
    options,
  };
}

export async function saveDownloadedPractice(userId, pack) {
  if (!userId || !pack?.courseId || !Array.isArray(pack.questions) || !pack.questions.length) {
    throw new Error("No eligible practice questions are available to download yet.");
  }
  const questions = pack.questions.map(safeQuestion);
  if (questions.some((question) => question.courseId !== pack.courseId)) {
    throw new Error("The practice pack contains a question from a different course.");
  }
  const record = {
    key: quizKey(userId, pack.courseId),
    userId,
    courseId: pack.courseId,
    downloadedAt: pack.downloadedAt || new Date().toISOString(),
    grading: "server",
    questions,
  };
  const database = await openOfflineDatabase();
  const transaction = database.transaction(QUIZ_STORE, "readwrite");
  transaction.objectStore(QUIZ_STORE).put(record);
  await idbTransactionDone(transaction);
  return record;
}

export async function getDownloadedPractice(userId, courseId) {
  if (!userId || !courseId) return null;
  const database = await openOfflineDatabase();
  const transaction = database.transaction(QUIZ_STORE, "readonly");
  const record = await idbRequest(transaction.objectStore(QUIZ_STORE).get(quizKey(userId, courseId)));
  await idbTransactionDone(transaction);
  return record || null;
}

export async function getDownloadedPracticePacks(userId) {
  if (!userId) return [];
  const database = await openOfflineDatabase();
  const transaction = database.transaction(QUIZ_STORE, "readonly");
  const records = await idbRequest(transaction.objectStore(QUIZ_STORE).index("userId").getAll(userId));
  await idbTransactionDone(transaction);
  return records.sort((left, right) => right.downloadedAt.localeCompare(left.downloadedAt));
}

export async function savePendingPracticeAnswer(userId, courseId, question, selectedOptionId, timeTakenSeconds) {
  if (!userId || !courseId || !question?.id || question.courseId !== courseId) {
    throw new Error("This question is not part of your downloaded practice pack.");
  }
  if (!question.options.some((option) => option.id === selectedOptionId)) {
    throw new Error("Choose one of the downloaded answer options.");
  }
  const pack = await getDownloadedPractice(userId, courseId);
  if (!pack?.questions.some((item) => item.id === question.id)) {
    throw new Error("This question is not saved for offline use.");
  }
  const now = new Date().toISOString();
  const activity = {
    activityId: newActivityId(),
    userId,
    kind: "practice-answer",
    courseId,
    questionId: question.id,
    topicId: question.topicId,
    selectedOptionId,
    timeTakenSeconds: Math.max(0, Math.floor(timeTakenSeconds || 0)),
    createdAt: now,
    updatedAt: now,
    status: "pending",
    result: null,
    lastError: null,
  };
  const database = await openOfflineDatabase();
  const transaction = database.transaction(ACTIVITY_STORE, "readwrite");
  transaction.objectStore(ACTIVITY_STORE).add(activity);
  try {
    await idbTransactionDone(transaction);
  } catch (error) {
    if (error?.name === "ConstraintError") throw new Error("This downloaded question already has a saved attempt.");
    throw error;
  }
  notifyActivitiesChanged(userId);
  return activity;
}

export async function getUnconfirmedPracticeAnswers(userId) {
  if (!userId) return [];
  const database = await openOfflineDatabase();
  const transaction = database.transaction(ACTIVITY_STORE, "readonly");
  const index = transaction.objectStore(ACTIVITY_STORE).index("userId");
  const records = await idbRequest(index.getAll(userId));
  await idbTransactionDone(transaction);
  return records.filter((item) => item.kind === "practice-answer" && item.status !== "synced")
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export async function getPracticeActivities(userId, courseId) {
  if (!userId) return [];
  const database = await openOfflineDatabase();
  const transaction = database.transaction(ACTIVITY_STORE, "readonly");
  const records = await idbRequest(transaction.objectStore(ACTIVITY_STORE).index("userId").getAll(userId));
  await idbTransactionDone(transaction);
  return records.filter((item) => item.kind === "practice-answer" && (!courseId || item.courseId === courseId))
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export async function getPracticeActivity(userId, activityId) {
  if (!userId || !activityId) return null;
  const database = await openOfflineDatabase();
  const transaction = database.transaction(ACTIVITY_STORE, "readonly");
  const activity = await idbRequest(transaction.objectStore(ACTIVITY_STORE).get(activityId));
  await idbTransactionDone(transaction);
  return activity?.userId === userId ? activity : null;
}

export async function getPendingPracticeCount(userId) {
  return (await getUnconfirmedPracticeAnswers(userId)).length;
}

export async function updatePracticeActivity(userId, activityId, updates) {
  if (!userId || !activityId) return null;
  const database = await openOfflineDatabase();
  const transaction = database.transaction(ACTIVITY_STORE, "readwrite");
  const store = transaction.objectStore(ACTIVITY_STORE);
  const current = await idbRequest(store.get(activityId));
  if (!current || current.userId !== userId) {
    transaction.abort();
    return null;
  }
  const next = { ...current, ...updates, userId, updatedAt: new Date().toISOString() };
  store.put(next);
  await idbTransactionDone(transaction);
  notifyActivitiesChanged(userId);
  return next;
}
