export const BYOK_STORAGE_KEY_PREFIX = "adapt_byok_credential_v1";

export const BYOK_PROVIDERS = Object.freeze([
  {
    id: "google-gemini",
    label: "Google Gemini",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1",
    headers: (key) => ({ "x-goog-api-key": key, Accept: "application/json" }),
    rejects: [400, 401, 403],
    hasModels: (body) => Array.isArray(body?.models) && body.models.every((model) => typeof model?.name === "string"),
    securityWarning: "Google says Gemini keys must not be exposed in production browser apps.",
    securityUrl: "https://ai.google.dev/gemini-api/docs/api-key",
    termsUrl: "https://ai.google.dev/gemini-api/terms",
    billingUrl: "https://ai.google.dev/gemini-api/docs/billing",
  },
  {
    id: "openai",
    label: "OpenAI",
    endpoint: "https://api.openai.com/v1/models",
    headers: (key) => ({ Authorization: `Bearer ${key}`, Accept: "application/json" }),
    rejects: [401, 403],
    hasModels: (body) => Array.isArray(body?.data) && body.data.every((model) => typeof model?.id === "string"),
    securityWarning: "OpenAI says API keys must not be exposed in browser or other client-side code.",
    securityUrl: "https://developers.openai.com/api/reference/overview",
    termsUrl: "https://openai.com/policies/business-terms/",
    billingUrl: "https://openai.com/api/pricing/",
  },
  {
    id: "anthropic",
    label: "Anthropic Claude",
    endpoint: "https://api.anthropic.com/v1/models?limit=1",
    headers: (key) => ({ "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true", Accept: "application/json" }),
    rejects: [401, 403],
    hasModels: (body) => Array.isArray(body?.data) && body.data.every((model) => typeof model?.id === "string"),
    securityWarning: "Anthropic disables browser SDK support by default because API credentials can be exposed in client-side code.",
    securityUrl: "https://platform.claude.com/docs/en/cli-sdks-libraries/sdks/typescript",
    termsUrl: "https://www.anthropic.com/legal/commercial-terms",
    billingUrl: "https://www.anthropic.com/pricing#api",
  },
]);

export const BYOK_PROVIDER = BYOK_PROVIDERS[0];

function getStorage(storage) {
  return storage ?? globalThis.localStorage;
}

function currentLearnerId() {
  try { return JSON.parse(globalThis.localStorage?.getItem("adapt_user") || "null")?.id || "anonymous"; }
  catch { return "anonymous"; }
}

export function byokStorageKey(userId = currentLearnerId(), provider = BYOK_PROVIDER.id) {
  const safeId = typeof userId === "string" && userId.trim() ? userId.trim() : "anonymous";
  const safeProvider = BYOK_PROVIDERS.some((item) => item.id === provider) ? provider : BYOK_PROVIDER.id;
  return `${BYOK_STORAGE_KEY_PREFIX}:${safeId}:${safeProvider}`;
}

function parseSavedCredential(storage, userId, provider) {
  try {
    const raw = getStorage(storage)?.getItem(byokStorageKey(userId, provider));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.version !== 1 || parsed.provider !== provider || typeof parsed.key !== "string" || !parsed.key) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function getByokStatus(storage, userId, provider = BYOK_PROVIDER.id) {
  const credential = parseSavedCredential(storage, userId, provider);
  if (!credential) return { configured: false, provider, checkedAt: null };
  return { configured: true, provider: credential.provider, checkedAt: credential.checkedAt || null };
}

export function removeByokCredential(storage, userId, provider = BYOK_PROVIDER.id) {
  try {
    const target = getStorage(storage);
    if (!target?.removeItem) return false;
    target.removeItem(byokStorageKey(userId, provider));
    return true;
  } catch {
    return false;
  }
}

/** Validate a credential with the provider's model-list endpoint, then store it only in this browser. */
export async function validateProviderCredential(providerId, key, { fetchImpl = globalThis.fetch, storage, userId, now = () => new Date().toISOString() } = {}) {
  const provider = BYOK_PROVIDERS.find((item) => item.id === providerId);
  if (!provider) return { ok: false, kind: "unsupported", message: "Choose a supported provider before validating a key." };
  const candidate = typeof key === "string" ? key.trim() : "";
  if (!candidate) return { ok: false, kind: "missing", message: `Enter a ${provider.label} API key to validate.` };
  if (typeof fetchImpl !== "function") return { ok: false, kind: "unavailable", message: `This browser cannot contact ${provider.label} to validate the key.` };

  let response;
  try {
    response = await fetchImpl(provider.endpoint, {
      method: "GET",
      headers: provider.headers(candidate),
      cache: "no-store",
      referrerPolicy: "no-referrer",
      credentials: "omit",
      redirect: "error",
    });
  } catch {
    return { ok: false, kind: "unavailable", message: `${provider.label} could not be reached from this browser. CORS or network policy may block validation; the key was not verified or saved.` };
  }

  if (provider.rejects.includes(response.status)) {
    return { ok: false, kind: "rejected", message: `${provider.label} rejected this key. Check that it is active and has API access.` };
  }
  if (response.status === 429) {
    return { ok: false, kind: "limited", message: `${provider.label} rate-limited key validation. The key's validity is unknown; nothing was saved.` };
  }
  if (!response.ok) {
    return { ok: false, kind: "provider-error", message: `${provider.label} could not validate this key (HTTP ${response.status}). The key was not saved.` };
  }

  let data;
  try { data = await response.json(); } catch {
    return { ok: false, kind: "provider-error", message: `${provider.label} returned an unreadable validation response. The key was not saved.` };
  }
  if (!provider.hasModels(data)) {
    return { ok: false, kind: "provider-error", message: `${provider.label} returned an unexpected validation response. The key was not saved.` };
  }

  try {
    const target = getStorage(storage);
    if (!target?.setItem) throw new Error("Browser storage unavailable");
    target.setItem(byokStorageKey(userId, providerId), JSON.stringify({
      version: 1,
      provider: providerId,
      key: candidate,
      checkedAt: now(),
    }));
  } catch {
    return { ok: false, kind: "storage-error", message: `${provider.label} accepted the key for model listing, but it could not be saved in this browser. Check browser storage settings.` };
  }
  return { ok: true, kind: "verified", message: `${provider.label} accepted the key for model listing. This does not confirm generation access, quota, or billing status.` };
}

export const validateGeminiCredential = (key, options) => validateProviderCredential(BYOK_PROVIDER.id, key, options);
