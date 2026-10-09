import test from "node:test";
import assert from "node:assert/strict";
import {
  getWebGpuCapability,
  inspectModelStorage,
  inspectWebGpu,
  LOCAL_TUTOR_MODEL,
} from "./localTutor.js";

test("local model requirements are explicit and fit the selected compact model", () => {
  assert.equal(LOCAL_TUTOR_MODEL.id, "SmolLM2-360M-Instruct-q4f16_1-MLC");
  assert.equal(LOCAL_TUTOR_MODEL.downloadBytes, 207 * 1024 * 1024);
  assert.ok(LOCAL_TUTOR_MODEL.requiredStorageBytes > LOCAL_TUTOR_MODEL.downloadBytes);
});

test("missing WebGPU is reported as unsupported without attempting inference", async () => {
  assert.deepEqual(getWebGpuCapability(undefined), {
    supported: false,
    reason: "WebGPU is unavailable in this browser.",
  });
  assert.equal((await inspectWebGpu(undefined)).supported, false);
});

test("a null WebGPU adapter and missing shader-f16 are rejected", async () => {
  assert.equal((await inspectWebGpu({ requestAdapter: async () => null })).supported, false);
  const adapter = { features: new Set() };
  assert.match((await inspectWebGpu({ requestAdapter: async () => adapter })).reason, /shader-f16/);
});

test("WebGPU with the required feature is accepted for runtime validation", async () => {
  const adapter = { features: new Set(["shader-f16"]) };
  assert.equal((await inspectWebGpu({ requestAdapter: async () => adapter })).supported, true);
});

test("storage check requires model plus runtime headroom", async () => {
  const enough = await inspectModelStorage({ estimate: async () => ({
    quota: 1024 * 1024 * 1024,
    usage: 1024 * 1024 * 1024 - LOCAL_TUTOR_MODEL.requiredStorageBytes,
  }) });
  assert.equal(enough.enough, true);

  const short = await inspectModelStorage({ estimate: async () => ({ quota: 400, usage: 200 }) });
  assert.equal(short.enough, false);
  assert.match(short.reason, /storage/);
});

test("unavailable or inexact storage estimates fail closed", async () => {
  assert.equal((await inspectModelStorage(undefined)).enough, false);
  assert.equal((await inspectModelStorage({ estimate: async () => ({ quota: 100 }) })).enough, false);
});
