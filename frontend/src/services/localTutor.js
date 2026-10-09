export const LOCAL_TUTOR_MODEL = Object.freeze({
  id: "SmolLM2-360M-Instruct-q4f16_1-MLC",
  name: "SmolLM2 360M Instruct",
  downloadBytes: 207 * 1024 * 1024,
  requiredStorageBytes: 300 * 1024 * 1024,
  vramRequiredMb: 376.06,
  license: "Apache-2.0",
  modelUrl: "https://huggingface.co/mlc-ai/SmolLM2-360M-Instruct-q4f16_1-MLC",
});

export function getWebGpuCapability(gpu = globalThis.navigator?.gpu) {
  if (!gpu?.requestAdapter) return { supported: false, reason: "WebGPU is unavailable in this browser." };
  return { supported: true };
}

export async function inspectWebGpu(gpu = globalThis.navigator?.gpu) {
  const capability = getWebGpuCapability(gpu);
  if (!capability.supported) return capability;

  const adapter = await gpu.requestAdapter();
  if (!adapter) return { supported: false, reason: "This device did not provide a usable WebGPU adapter." };
  if (!adapter.features?.has("shader-f16")) {
    return { supported: false, reason: "This device does not support the shader-f16 feature required by this model." };
  }
  return { supported: true, adapter };
}

export async function inspectModelStorage(storage = globalThis.navigator?.storage) {
  if (!storage?.estimate) {
    return { enough: false, reason: "This browser cannot estimate available site storage." };
  }

  const { quota, usage } = await storage.estimate();
  if (!Number.isFinite(quota) || !Number.isFinite(usage)) {
    return { enough: false, reason: "The browser did not provide a usable storage estimate." };
  }

  const availableBytes = Math.max(0, quota - usage);
  return {
    enough: availableBytes >= LOCAL_TUTOR_MODEL.requiredStorageBytes,
    availableBytes,
    requiredBytes: LOCAL_TUTOR_MODEL.requiredStorageBytes,
    reason: availableBytes < LOCAL_TUTOR_MODEL.requiredStorageBytes
      ? "Free up site storage before downloading the model."
      : "",
  };
}

export async function loadLocalTutor({ onProgress = () => {}, onCancelReady = () => {}, modelCached = false } = {}) {
  const gpu = await inspectWebGpu();
  if (!gpu.supported) throw new Error(gpu.reason);
  if (!modelCached) {
    const storage = await inspectModelStorage();
    if (!storage.enough) throw new Error(storage.reason);
  }

  const webllm = await import("@mlc-ai/web-llm");
  const appConfig = { ...webllm.prebuiltAppConfig, cacheBackend: "cache" };
  const worker = new Worker(new URL("./localTutor.worker.js", import.meta.url), { type: "module" });
  let rejectCancelled;
  const cancelled = new Promise((_, reject) => { rejectCancelled = reject; });
  const cancel = () => {
    worker.terminate();
    rejectCancelled(new Error("Local model download cancelled."));
  };
  onCancelReady(cancel);

  let engine;
  try {
    engine = await Promise.race([
      webllm.CreateWebWorkerMLCEngine(worker, LOCAL_TUTOR_MODEL.id, {
        appConfig,
        initProgressCallback: onProgress,
      }, {
        context_window_size: 2048,
      }),
      cancelled,
    ]);
  } catch (error) {
    worker.terminate();
    if (error?.message === "Local model download cancelled.") {
      try { await webllm.deleteModelAllInfoInCache(LOCAL_TUTOR_MODEL.id, appConfig); } catch { /* partial cache may already be absent */ }
    }
    throw error;
  }

  // Ask the browser to keep this user-requested model in site storage when possible.
  // Persistence is best-effort; browser settings and storage eviction still apply.
  try {
    await globalThis.navigator?.storage?.persist?.();
  } catch {
    // The model remains usable in this session if persistence is declined/unavailable.
  }
  return { engine, worker, cancel };
}

export async function isLocalTutorModelCached() {
  const webllm = await import("@mlc-ai/web-llm");
  return webllm.hasModelInCache(LOCAL_TUTOR_MODEL.id, {
    ...webllm.prebuiltAppConfig,
    cacheBackend: "cache",
  });
}

export async function removeLocalTutorModel(runtime) {
  if (runtime?.engine) await runtime.engine.unload();
  runtime?.worker?.terminate();
  const webllm = await import("@mlc-ai/web-llm");
  return webllm.deleteModelAllInfoInCache(LOCAL_TUTOR_MODEL.id, {
    ...webllm.prebuiltAppConfig,
    cacheBackend: "cache",
  });
}

export async function generateLocalTutorReply(engine, { message, history = [], course, topic }) {
  if (!engine) throw new Error("Load the on-device model before using Local AI.");

  const system = [
    "You are ADAPT's small offline study tutor. Give concise, supportive explanations and ask useful follow-up questions.",
    "You run entirely on this device. Do not claim access to the internet or information not in the prompt.",
    "Your answers may be less accurate than ADAPT's server tutor; state uncertainty and encourage checking important facts.",
    course?.title ? `Course: ${course.title}.` : "No course is selected.",
    topic?.name ? `Current topic: ${topic.name}.` : "No topic is selected.",
    topic?.description ? `Saved topic summary: ${topic.description.slice(0, 1200)}.` : "",
    topic?.learningObjectives?.length ? `Saved learning objectives: ${topic.learningObjectives.slice(0, 5).join("; ").slice(0, 900)}.` : "",
    topic?.subtopics?.length ? `Saved subtopics: ${topic.subtopics.slice(0, 8).join("; ").slice(0, 900)}.` : "",
    "Use the saved summary, objectives, and subtopics as the available course material. Full lesson bodies are not stored offline.",
  ].join(" ");
  const messages = [
    { role: "system", content: system },
    ...history.slice(-8).map(({ role, content }) => ({ role, content: content.slice(0, 1000) })),
    { role: "user", content: message },
  ];
  const response = await engine.chat.completions.create({ messages, temperature: 0.6, max_tokens: 256 });
  const content = response.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Local AI did not return a response. Try again or switch to Server AI.");
  return { role: "assistant", content, provider: "local" };
}
