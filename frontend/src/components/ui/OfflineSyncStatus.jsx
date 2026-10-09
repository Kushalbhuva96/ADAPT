import React, { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, LoaderCircle, RefreshCw } from "lucide-react";
import { getPendingPracticeCount } from "../../services/offlinePracticeStore";
import { syncPendingPracticeAnswers } from "../../services/offlinePracticeSync";

export default function OfflineSyncStatus({ userId }) {
  const [pendingCount, setPendingCount] = useState(0);
  const [syncState, setSyncState] = useState("idle");
  const [message, setMessage] = useState("");

  const refreshCount = useCallback(async () => {
    if (!userId) { setPendingCount(0); return 0; }
    try {
      const count = await getPendingPracticeCount(userId);
      setPendingCount(count);
      return count;
    } catch {
      setMessage("Offline activity storage is unavailable in this browser.");
      return 0;
    }
  }, [userId]);

  const retrySync = useCallback(() => {
    if (!userId) return;
    setSyncState("syncing");
    void syncPendingPracticeAnswers(userId).then(refreshCount);
  }, [refreshCount, userId]);

  useEffect(() => {
    if (!userId) return undefined;
    void refreshCount().then((count) => { if (count && navigator.onLine) retrySync(); });
    const onOnline = () => retrySync();
    const onActivityChanged = (event) => {
      if (event.detail?.userId !== userId) return;
      void refreshCount().then((count) => { if (count && navigator.onLine) retrySync(); });
    };
    const onSyncState = (event) => {
      if (event.detail?.userId !== userId) return;
      setSyncState(event.detail.status || "idle");
      setPendingCount(event.detail.pendingCount || 0);
      setMessage(event.detail.message || "");
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("adapt:offline-activities-changed", onActivityChanged);
    window.addEventListener("adapt:offline-sync-state", onSyncState);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("adapt:offline-activities-changed", onActivityChanged);
      window.removeEventListener("adapt:offline-sync-state", onSyncState);
    };
  }, [refreshCount, retrySync, userId]);

  if (!userId || (!pendingCount && syncState !== "syncing" && syncState !== "complete")) return null;
  const Icon = syncState === "syncing" ? LoaderCircle : syncState === "complete" ? CheckCircle2 : AlertCircle;
  const label = syncState === "syncing" ? `Syncing ${pendingCount} pending` : syncState === "complete" ? "Progress synced" : `${pendingCount} pending sync`;
  return <div className={`offline-sync-status is-${syncState}`} role="status" aria-live="polite" title={message || "Offline answers remain pending until ADAPT confirms them."}>
    <Icon size={13} aria-hidden="true" className={syncState === "syncing" ? "connection-spinner" : ""} />
    <span>{label}</span>
    {pendingCount > 0 && syncState !== "syncing" && <button type="button" className="offline-sync-retry" onClick={retrySync} aria-label="Retry syncing saved practice answers"><RefreshCw size={12} /> Retry</button>}
  </div>;
}
