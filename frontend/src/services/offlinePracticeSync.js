import { api } from "./api";
import { apiClient } from "./api/apiClient";
import { getUnconfirmedPracticeAnswers, updatePracticeActivity } from "./offlinePracticeStore";

const inFlightByUser = new Map();

function announceSync(userId, status, pendingCount, message = "") {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("adapt:offline-sync-state", { detail: { userId, status, pendingCount, message } }));
  }
}

export function syncPendingPracticeAnswers(userId = apiClient.getUserId()) {
  if (!userId || userId !== apiClient.getUserId() || !apiClient.getToken() || !navigator.onLine) return Promise.resolve({ status: "idle", synced: 0 });
  if (inFlightByUser.has(userId)) return inFlightByUser.get(userId);

  const tokenAtStart = apiClient.getToken();
  const task = (async () => {
    const activities = await getUnconfirmedPracticeAnswers(userId);
    if (!activities.length) {
      announceSync(userId, "idle", 0);
      return { status: "idle", synced: 0 };
    }
    announceSync(userId, "syncing", activities.length);
    let synced = 0;
    let failed = false;

    for (const activity of activities) {
      if (!navigator.onLine || apiClient.getUserId() !== userId || apiClient.getToken() !== tokenAtStart) break;
      await updatePracticeActivity(userId, activity.activityId, { status: "syncing", lastError: null });
      try {
        const response = await api.syncOfflinePractice([{
          activityId: activity.activityId,
          courseId: activity.courseId,
          questionId: activity.questionId,
          topicId: activity.topicId,
          selectedOptionId: activity.selectedOptionId,
          timeTakenSeconds: activity.timeTakenSeconds,
          createdAt: activity.createdAt,
        }]);
        const acknowledgement = response.acknowledgements?.find((item) => item.activityId === activity.activityId);
        if (acknowledgement?.status === "synced" && acknowledgement.result) {
          await updatePracticeActivity(userId, activity.activityId, { status: "synced", result: acknowledgement.result, lastError: null });
          synced += 1;
        } else {
          failed = true;
          await updatePracticeActivity(userId, activity.activityId, {
            status: "pending",
            lastError: acknowledgement?.message || "ADAPT has not confirmed this answer yet.",
          });
        }
      } catch (error) {
        failed = true;
        await updatePracticeActivity(userId, activity.activityId, {
          status: "pending",
          lastError: error.message || "ADAPT could not sync this answer. It is saved on this device.",
        });
      }
    }

    const remaining = await getUnconfirmedPracticeAnswers(userId);
    const status = remaining.length ? (failed ? "failed" : "pending") : "complete";
    announceSync(userId, status, remaining.length, remaining[0]?.lastError || "");
    return { status, synced, pendingCount: remaining.length };
  })().catch((error) => {
    announceSync(userId, "failed", 0, error.message || "Could not read saved offline activity.");
    return { status: "failed", synced: 0 };
  }).finally(() => inFlightByUser.delete(userId));

  inFlightByUser.set(userId, task);
  return task;
}
