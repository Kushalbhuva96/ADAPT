export async function registerAppServiceWorker() {
  if (import.meta.env.DEV || !("serviceWorker" in navigator)) return null;

  try {
    const buildId = encodeURIComponent(__ADAPT_BUILD_ID__);
    const serviceWorkerUrl = `${import.meta.env.BASE_URL}sw.js?build=${buildId}`;
    const registration = await navigator.serviceWorker.register(serviceWorkerUrl, { scope: import.meta.env.BASE_URL });
    window.__adaptServiceWorkerRegistration = registration;

    const announceWaitingWorker = () => {
      if (registration.waiting && navigator.serviceWorker.controller) {
        window.__adaptServiceWorkerRegistration = registration;
        window.dispatchEvent(new CustomEvent("adapt:pwa-update", { detail: { registration } }));
      }
    };
    announceWaitingWorker();
    registration.addEventListener("updatefound", () => {
      const installing = registration.installing;
      installing?.addEventListener("statechange", () => {
        if (installing.state === "installed") announceWaitingWorker();
      });
    });
    return registration;
  } catch (error) {
    console.error("ADAPT could not register its offline app shell.", error);
    return null;
  }
}

export function activateWaitingServiceWorker(registration) {
  if (!registration?.waiting) return;
  navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload(), { once: true });
  registration.waiting.postMessage({ type: "SKIP_WAITING" });
}
