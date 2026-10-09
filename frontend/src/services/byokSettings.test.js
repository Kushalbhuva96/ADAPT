import test from "node:test";
import assert from "node:assert/strict";
import { BYOK_PROVIDERS, BYOK_PROVIDER, byokStorageKey, getByokStatus, removeByokCredential, validateGeminiCredential, validateProviderCredential } from "./byokSettings.js";

function createStorage() {
  const values = new Map();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

test("Gemini validation sends the key only to Google and stores it locally after a valid response", async () => {
  const storage = createStorage();
  let request;
  const storageKey = byokStorageKey("learner-a");
  const result = await validateGeminiCredential("test-secret", {
    storage,
    userId: "learner-a",
    now: () => "2026-10-09T00:00:00.000Z",
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, status: 200, json: async () => ({ models: [{ name: "models/gemini-test" }] }) };
    },
  });
  assert.equal(result.ok, true);
  assert.equal(request.url, "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1");
  assert.equal(request.url.includes("adapt"), false);
  assert.equal(request.options.headers["x-goog-api-key"], "test-secret");
  assert.equal(request.options.referrerPolicy, "no-referrer");
  assert.equal(request.options.credentials, "omit");
  assert.equal(request.options.redirect, "error");
  assert.equal(storage.values.get(storageKey).includes("test-secret"), true);
  assert.deepEqual(getByokStatus(storage, "learner-a"), { configured: true, provider: BYOK_PROVIDER.id, checkedAt: "2026-10-09T00:00:00.000Z" });
  assert.equal(getByokStatus(storage, "learner-b").configured, false);
});

test("rejected keys are not persisted and provider details are not exposed in errors", async () => {
  const storage = createStorage();
  const result = await validateGeminiCredential("secret-value", {
    storage,
    userId: "learner-a",
    fetchImpl: async () => ({ ok: false, status: 403, json: async () => ({ error: "secret-value appears in provider detail" }) }),
  });
  assert.equal(result.kind, "rejected");
  assert.equal(result.message.includes("secret-value"), false);
  assert.equal(storage.values.has(byokStorageKey("learner-a")), false);
});

test("network, rate limit, and malformed responses report unknown or failed status without saving", async () => {
  const storage = createStorage();
  const network = await validateGeminiCredential("candidate", { storage, userId: "learner-a", fetchImpl: async () => { throw new Error("candidate leaked by underlying fetch"); } });
  assert.equal(network.kind, "unavailable");
  assert.equal(network.message.includes("candidate"), false);
  const limited = await validateGeminiCredential("candidate", { storage, userId: "learner-a", fetchImpl: async () => ({ ok: false, status: 429 }) });
  assert.equal(limited.kind, "limited");
  const malformed = await validateGeminiCredential("candidate", { storage, userId: "learner-a", fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ nope: [] }) }) });
  assert.equal(malformed.kind, "provider-error");
  assert.equal(storage.values.has(byokStorageKey("learner-a")), false);
});

test("deletion removes the browser-only credential", async () => {
  const storage = createStorage();
  storage.setItem(byokStorageKey("learner-a"), JSON.stringify({ version: 1, provider: BYOK_PROVIDER.id, key: "local-secret" }));
  assert.equal(removeByokCredential(storage, "learner-a"), true);
  assert.deepEqual(getByokStatus(storage, "learner-a"), { configured: false, provider: BYOK_PROVIDER.id, checkedAt: null });
  assert.equal(storage.values.has(byokStorageKey("learner-a")), false);
});

test("OpenAI and Anthropic use their official model-list routes and provider-specific auth headers", async () => {
  const storage = createStorage();
  for (const [provider, body, expectedHeader] of [
    [BYOK_PROVIDERS.find((item) => item.id === "openai"), { data: [{ id: "gpt-test" }] }, "Authorization"],
    [BYOK_PROVIDERS.find((item) => item.id === "anthropic"), { data: [{ id: "claude-test" }] }, "x-api-key"],
  ]) {
    let request;
    const result = await validateProviderCredential(provider.id, "provider-secret", {
      storage,
      userId: "learner-a",
      fetchImpl: async (url, options) => {
        request = { url, options };
        return { ok: true, status: 200, json: async () => body };
      },
    });
    assert.equal(result.ok, true);
    assert.equal(request.url, provider.endpoint);
    assert.equal(request.url.includes("adapt"), false);
    assert.equal(request.options.headers[expectedHeader].includes("provider-secret"), true);
    assert.equal(storage.values.has(byokStorageKey("learner-a", provider.id)), true);
    assert.equal(getByokStatus(storage, "learner-b", provider.id).configured, false);
  }
  const anthropicRequest = [];
  await validateProviderCredential("anthropic", "secret", {
    storage: createStorage(),
    fetchImpl: async (_url, options) => { anthropicRequest.push(options); return { ok: true, status: 200, json: async () => ({ data: [] }) }; },
  });
  assert.equal(anthropicRequest[0].headers["anthropic-version"], "2023-06-01");
});

test("unknown providers and rejected credentials fail closed", async () => {
  const storage = createStorage();
  assert.equal((await validateProviderCredential("unsupported", "x", { storage })).kind, "unsupported");
  for (const provider of BYOK_PROVIDERS) {
    const result = await validateProviderCredential(provider.id, "candidate", {
      storage,
      userId: "learner-a",
      fetchImpl: async () => ({ ok: false, status: 401 }),
    });
    assert.equal(result.kind, "rejected");
    assert.equal(storage.values.has(byokStorageKey("learner-a", provider.id)), false);
  }
});
