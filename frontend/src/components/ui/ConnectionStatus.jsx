import React, { useCallback, useEffect, useRef, useState } from "react";
import { Cloud, CloudOff, LoaderCircle, ServerOff } from "lucide-react";
import { apiClient } from "../../services/api/apiClient";

const CHECK_TIMEOUT_MS = 5000;
const CHECK_INTERVAL_MS = 60_000;

function healthUrl() {
  return new URL(`${apiClient.baseUrl.replace(/\/+$/, "")}/health`, window.location.origin).toString();
}

export default function ConnectionStatus() {
  const [state, setState] = useState(() => navigator.onLine ? "connecting" : "offline");
  const checkInFlight = useRef(false);
  const timeout = useRef(null);
  const controller = useRef(null);
  const requestId = useRef(0);

  const checkBackend = useCallback(async () => {
    if (!navigator.onLine) { setState("offline"); return; }
    if (checkInFlight.current) return;
    checkInFlight.current = true;
    const currentRequest = ++requestId.current;
    setState("connecting");
    try {
      controller.current = new AbortController();
      timeout.current = window.setTimeout(() => controller.current?.abort(), CHECK_TIMEOUT_MS);
      const response = await fetch(healthUrl(), { cache: "no-store", credentials: "omit", signal: controller.current.signal });
      const result = await response.json().catch(() => null);
      if (requestId.current === currentRequest) {
        setState(!navigator.onLine ? "offline" : response.ok && result?.status === "ok" ? "online" : "unavailable");
      }
    } catch {
      if (requestId.current === currentRequest) setState(navigator.onLine ? "unavailable" : "offline");
    } finally {
      if (requestId.current === currentRequest) {
        window.clearTimeout(timeout.current);
        timeout.current = null;
        controller.current = null;
        checkInFlight.current = false;
      }
    }
  }, []);

  useEffect(() => {
    const onOffline = () => setState("offline");
    const onOnline = () => { setState("connecting"); void checkBackend(); };
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    void checkBackend();
    const interval = window.setInterval(checkBackend, CHECK_INTERVAL_MS);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      window.clearInterval(interval);
      window.clearTimeout(timeout.current);
      requestId.current += 1;
      controller.current?.abort();
      controller.current = null;
      timeout.current = null;
      checkInFlight.current = false;
    };
  }, [checkBackend]);

  const content = {
    online: { label: "Online", Icon: Cloud, detail: "ADAPT backend is reachable. AI availability is checked when you use an AI feature." },
    offline: { label: "Offline", Icon: CloudOff, detail: "No network connection. Previously downloaded course content is available." },
    connecting: { label: "Connecting", Icon: LoaderCircle, detail: "Checking the ADAPT backend." },
    unavailable: { label: "Backend unavailable", Icon: ServerOff, detail: "The device is online, but the ADAPT backend did not respond." },
  }[state];
  const { Icon } = content;

  return <div className={`connection-status is-${state}`} role="status" aria-live="polite" title={content.detail}>
    <Icon size={13} aria-hidden="true" className={state === "connecting" ? "connection-spinner" : ""} />
    <span>{content.label}</span>
  </div>;
}
