const DATABASE_NAME = "adapt-offline-content";
const DATABASE_VERSION = 2;
let databasePromise;

export function openOfflineDatabase() {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("This browser does not support offline storage."));
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("downloaded-courses")) {
        const courses = database.createObjectStore("downloaded-courses", { keyPath: "key" });
        courses.createIndex("userId", "userId", { unique: false });
      }
      if (!database.objectStoreNames.contains("downloaded-practice")) {
        const quizzes = database.createObjectStore("downloaded-practice", { keyPath: "key" });
        quizzes.createIndex("userId", "userId", { unique: false });
        quizzes.createIndex("courseId", "courseId", { unique: false });
      }
      if (!database.objectStoreNames.contains("offline-activities")) {
        const activities = database.createObjectStore("offline-activities", { keyPath: "activityId" });
        activities.createIndex("userId", "userId", { unique: false });
        activities.createIndex("userStatus", ["userId", "status"], { unique: false });
        activities.createIndex("userQuestion", ["userId", "questionId"], { unique: true });
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        databasePromise = null;
      };
      resolve(database);
    };
    request.onerror = () => reject(request.error || new Error("Could not open offline storage."));
    request.onblocked = () => reject(new Error("Offline storage is open in another tab. Close other ADAPT tabs and retry."));
  }).catch((error) => {
    databasePromise = null;
    throw error;
  });
  return databasePromise;
}

export function idbRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Offline storage request failed."));
  });
}

export function idbTransactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("Offline storage could not be saved."));
    transaction.onabort = () => reject(transaction.error || new Error("Offline storage was interrupted."));
  });
}
