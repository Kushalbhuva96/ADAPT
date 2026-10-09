import { idbRequest, idbTransactionDone, openOfflineDatabase } from "./offlineDb";

const COURSE_STORE = "downloaded-courses";

function courseKey(userId, courseId) {
  return `${encodeURIComponent(userId)}:${encodeURIComponent(courseId)}`;
}

function cloneCourse(course) {
  try { return JSON.parse(JSON.stringify(course)); }
  catch { throw new Error("This course could not be prepared for offline storage."); }
}

export async function saveDownloadedCourse(userId, course) {
  if (!userId || !course?.id || !course?.title || !Array.isArray(course.topics) || !course.topics.length) {
    throw new Error("The course is missing required content and cannot be downloaded.");
  }
  const snapshot = cloneCourse(course);
  const serialized = JSON.stringify(snapshot);
  const record = {
    key: courseKey(userId, course.id),
    userId,
    courseId: course.id,
    title: course.title,
    topicCount: snapshot.topics.length,
    sizeBytes: new Blob([serialized]).size,
    contentVersion: snapshot.updatedAt || snapshot.createdAt || null,
    downloadedAt: new Date().toISOString(),
    course: snapshot,
  };

  const database = await openOfflineDatabase();
  const transaction = database.transaction(COURSE_STORE, "readwrite");
  transaction.objectStore(COURSE_STORE).put(record);
  await idbTransactionDone(transaction);

  const saved = await getDownloadedCourse(userId, course.id);
  if (!saved || saved.course.topics.length !== course.topics.length || saved.course.topics.some((topic) => !topic.id || !topic.name)) {
    throw new Error("The saved course could not be verified. It is not marked as available offline.");
  }
  return saved;
}

export async function getDownloadedCourse(userId, courseId) {
  if (!userId || !courseId) return null;
  const database = await openOfflineDatabase();
  const transaction = database.transaction(COURSE_STORE, "readonly");
  const result = await idbRequest(transaction.objectStore(COURSE_STORE).get(courseKey(userId, courseId)));
  await idbTransactionDone(transaction);
  return result || null;
}

export async function getDownloadedCourses(userId) {
  if (!userId) return [];
  const database = await openOfflineDatabase();
  const transaction = database.transaction(COURSE_STORE, "readonly");
  const result = await idbRequest(transaction.objectStore(COURSE_STORE).index("userId").getAll(userId));
  await idbTransactionDone(transaction);
  return result.sort((left, right) => right.downloadedAt.localeCompare(left.downloadedAt));
}

export async function removeDownloadedCourse(userId, courseId) {
  if (!userId || !courseId) return;
  const database = await openOfflineDatabase();
  const transaction = database.transaction(COURSE_STORE, "readwrite");
  transaction.objectStore(COURSE_STORE).delete(courseKey(userId, courseId));
  await idbTransactionDone(transaction);
}

export function formatStoredSize(sizeBytes) {
  if (!Number.isFinite(sizeBytes) || sizeBytes < 0) return "Size unavailable";
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}
