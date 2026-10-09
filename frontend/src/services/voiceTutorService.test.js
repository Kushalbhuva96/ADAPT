import test from "node:test";
import assert from "node:assert/strict";
import { requestVoiceTutorReply } from "./voiceTutorService.js";

test("Hosted AI uses the authenticated Tutor API contract and retains history/context", async () => {
  let request;
  const result = await requestVoiceTutorReply({
    mode: "hosted",
    message: "Explain this",
    history: [{ role: "user", content: "Earlier question" }],
    course: { title: "Biology" },
    topic: { id: "cells", name: "Cells" },
  }, {
    hostedRequest: async (value) => { request = value; return { role: "assistant", content: "Tutor response" }; },
    localReply: async () => { throw new Error("Local AI must not be used"); },
  });
  assert.deepEqual(request, {
    message: "Explain this",
    mode: "explain",
    topicId: "cells",
    topicName: "Cells",
    courseName: "Biology",
    history: [{ role: "user", content: "Earlier question" }],
  });
  assert.equal(result.content, "Tutor response");
});

test("Local AI uses only the loaded engine and never falls back to Hosted AI", async () => {
  let hostedCalls = 0;
  let localCall;
  const engine = { chat: "engine" };
  const result = await requestVoiceTutorReply({ mode: "local", engine, message: "Question", history: [] }, {
    hostedRequest: async () => { hostedCalls += 1; throw new Error("Hosted fallback is forbidden"); },
    localReply: async (...args) => { localCall = args; return { role: "assistant", content: "Local response", provider: "local" }; },
  });
  assert.equal(localCall[0], engine);
  assert.deepEqual(localCall[1], { message: "Question", history: [], course: undefined, topic: undefined });
  assert.equal(hostedCalls, 0);
  assert.equal(result.provider, "local");
});

test("Local AI without an engine fails closed without calling either provider", async () => {
  let hostedCalls = 0;
  let localCalls = 0;
  await assert.rejects(requestVoiceTutorReply({ mode: "local", message: "Question" }, {
    hostedRequest: async () => { hostedCalls += 1; return { content: "wrong" }; },
    localReply: async () => { localCalls += 1; return { content: "wrong" }; },
  }), /model is not loaded/i);
  assert.equal(hostedCalls, 0);
  assert.equal(localCalls, 0);
});

test("Local inference errors are propagated without a silent Hosted AI fallback", async () => {
  let hostedCalls = 0;
  await assert.rejects(requestVoiceTutorReply({ mode: "local", engine: {}, message: "Question" }, {
    hostedRequest: async () => { hostedCalls += 1; return { content: "wrong" }; },
    localReply: async () => { throw new Error("Local inference failed"); },
  }), /Local inference failed/);
  assert.equal(hostedCalls, 0);
});
