import test from "node:test";
import assert from "node:assert/strict";
import { createVoiceSessionController } from "./voiceSessionController.js";

function harness(overrides = {}) {
  const recognizers = [];
  const utterances = [];
  const states = [];
  const errors = [];
  const synthesis = {
    speak(utterance) { utterances.push(utterance); utterance.onstart?.(); },
    cancel() { this.cancelled = (this.cancelled || 0) + 1; },
  };
  const controller = createVoiceSessionController({
    recognitionFactory: () => {
      const item = {
        start(...args) { this.startArgs = args; this.started = true; this.onstart?.(); },
        stop() { this.stopped = true; },
        abort() { this.aborted = true; },
      };
      recognizers.push(item);
      return item;
    },
    synthesis,
    utteranceFactory: (text) => ({ text, onend: null, onerror: null }),
    onState: (state) => states.push(state),
    onError: (message) => errors.push(message),
    onUtterance: async (text) => `Answer to ${text}`,
    restartDelayMs: 1,
    ...overrides,
  });
  return { controller, recognizers, utterances, states, errors, synthesis };
}

const resultEvent = (...items) => ({ resultIndex: 0, results: items.map(([transcript, isFinal]) => Object.assign([{ transcript }], { isFinal })) });
const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

function audioCaptureHarness() {
  let amplitude = 0;
  let getUserMediaCalls = 0;
  const track = { stopped: false, stop() { this.stopped = true; } };
  const analyser = {
    fftSize: 0,
    getByteTimeDomainData(samples) {
      for (let index = 0; index < samples.length; index += 1) samples[index] = 128 + (index % 2 ? -1 : 1) * amplitude * 128;
    },
    disconnect() {},
  };
  const context = {
    state: "running",
    createMediaStreamSource: () => ({ connect() {}, disconnect() {} }),
    createAnalyser: () => analyser,
    close: async () => { context.state = "closed"; },
  };
  return {
    track,
    analyser,
    context,
    setAmplitude: (value) => { amplitude = value; },
    getUserMediaCalls: () => getUserMediaCalls,
    mediaDevices: {
      async getUserMedia(constraints) {
        getUserMediaCalls += 1;
        assert.equal(constraints.audio.echoCancellation.ideal, true);
        assert.equal(constraints.audio.noiseSuppression.ideal, true);
        assert.equal(constraints.audio.autoGainControl.ideal, true);
        return { getTracks: () => [track], getAudioTracks: () => [track] };
      },
    },
  };
}

test("final utterance is submitted once, actual answer is spoken, and listening resumes", async () => {
  const submitted = [];
  const h = harness({ onUtterance: async (text) => { submitted.push(text); return `Tutor answer: ${text}`; } });
  h.controller.start();
  h.recognizers[0].onresult(resultEvent(["why does it happen", false]));
  assert.deepEqual(submitted, []);
  const finalHandler = h.recognizers[0].onresult;
  finalHandler(resultEvent(["Why does it happen?", true]));
  finalHandler(resultEvent(["Why does it happen?", true]));
  await tick();
  assert.deepEqual(submitted, ["Why does it happen?"]);
  assert.equal(h.utterances.length, 1);
  assert.equal(h.utterances[0].text, "Tutor answer: Why does it happen?");
  h.utterances[0].onend();
  assert.equal(h.controller.getState(), "LISTENING");
  assert.equal(h.recognizers.length, 2);
});

test("Speaking is shown only after the speech service emits its start event", async () => {
  const utterances = [];
  const h = harness({ synthesis: { speak: (utterance) => utterances.push(utterance), cancel() {} } });
  h.controller.start();
  h.recognizers[0].onresult(resultEvent(["question", true]));
  await tick();
  assert.equal(h.controller.getState(), "THINKING");
  utterances[0].onstart();
  assert.equal(h.controller.getState(), "SPEAKING");
  utterances[0].onend();
  assert.equal(h.controller.getState(), "LISTENING");
});

test("session connection transitions to listening after the recognizer starts", () => {
  const h = harness();
  h.controller.start();
  assert.equal(h.controller.getState(), "LISTENING");
  assert.deepEqual(h.states.slice(0, 2), ["CONNECTING", "LISTENING"]);
  assert.equal(h.recognizers[0].started, true);
});

test("stop during a pending tutor request ignores the late answer and cancels resources", async () => {
  let resolveAnswer;
  const h = harness({ onUtterance: () => new Promise((resolve) => { resolveAnswer = resolve; }) });
  h.controller.start();
  h.recognizers[0].onresult(resultEvent(["Explain this", true]));
  await Promise.resolve();
  h.controller.stop();
  resolveAnswer("Late response");
  await tick();
  assert.equal(h.controller.getState(), "IDLE");
  assert.equal(h.utterances.length, 0);
  assert.equal(h.recognizers[0].stopped, true);
  assert.equal(h.synthesis.cancelled, 1);
});

test("stop while listening prevents unexpected-end automatic restart", async () => {
  const h = harness();
  h.controller.start();
  const oldEnd = h.recognizers[0].onend;
  h.controller.stop();
  oldEnd?.();
  await tick();
  assert.equal(h.recognizers.length, 1);
  assert.equal(h.controller.getState(), "IDLE");
});

test("callbacks captured from an older session cannot submit a question", async () => {
  const submitted = [];
  const h = harness({ onUtterance: async (text) => { submitted.push(text); return "answer"; } });
  h.controller.start();
  const staleResult = h.recognizers[0].onresult;
  h.controller.stop();
  h.controller.start();
  staleResult(resultEvent(["old session question", true]));
  assert.deepEqual(submitted, []);
  assert.equal(h.recognizers.length, 2);
});

test("unexpected recognition endings stop after the configured restart limit", async () => {
  const h = harness({ maxRestarts: 2 });
  h.controller.start();
  h.recognizers[0].onend();
  await tick();
  h.recognizers[1].onend();
  await tick();
  h.recognizers[2].onend();
  assert.equal(h.controller.getState(), "ERROR");
  assert.equal(h.recognizers.length, 3);
  assert.match(h.errors[0], /stopped repeatedly/);
});

test("provider failure is shown as an error and a later Start can recover", async () => {
  let fails = true;
  const h = harness({ onUtterance: async () => { if (fails) throw new Error("Tutor service unavailable"); return "Recovered answer"; } });
  h.controller.start();
  h.recognizers[0].onresult(resultEvent(["question", true]));
  await tick();
  assert.equal(h.controller.getState(), "ERROR");
  assert.match(h.errors[0], /Tutor service unavailable/);
  fails = false;
  h.controller.start();
  h.recognizers[1].onresult(resultEvent(["another question", true]));
  await tick();
  assert.equal(h.utterances[0].text, "Recovered answer");
});

test("a tutor request timeout cancels the session and ignores the eventual response", async () => {
  let resolveAnswer;
  const h = harness({
    responseTimeoutMs: 8,
    onUtterance: () => new Promise((resolve) => { resolveAnswer = resolve; }),
  });
  h.controller.start();
  h.recognizers[0].onresult(resultEvent(["slow question", true]));
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(h.controller.getState(), "ERROR");
  assert.match(h.errors[0], /too long to respond/);
  resolveAnswer("late answer");
  await tick();
  assert.equal(h.utterances.length, 0);
});

test("speech that never starts is cancelled and returns to listening", async () => {
  const utterances = [];
  const testSynthesis = { speak: (utterance) => utterances.push(utterance), cancel() { this.cancelled = true; } };
  const h = harness({
    speechStartTimeoutMs: 8,
    synthesis: testSynthesis,
  });
  h.controller.start();
  h.recognizers[0].onresult(resultEvent(["question", true]));
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(h.controller.getState(), "LISTENING");
  assert.equal(testSynthesis.cancelled, true);
  assert.match(h.errors[0], /did not start/);
  assert.equal(h.recognizers.length, 2);
});

test("unsupported recognition reports a clear error without starting a session", () => {
  const h = harness({ recognitionFactory: () => null });
  h.controller.start();
  assert.equal(h.controller.getState(), "ERROR");
  assert.match(h.errors[0], /not supported/);
  assert.equal(h.controller.isActive(), false);
});

test("microphone permission denial stops the session with a useful recovery message", () => {
  const h = harness();
  h.controller.start();
  h.recognizers[0].onerror({ error: "not-allowed" });
  assert.equal(h.controller.getState(), "ERROR");
  assert.equal(h.controller.isActive(), false);
  assert.match(h.errors[0], /access was denied/i);
});

test("repeat plays the last tutor response; muting stops active speech", async () => {
  const h = harness();
  h.controller.start();
  h.recognizers[0].onresult(resultEvent(["question", true]));
  await tick();
  h.utterances[0].onend();
  h.controller.stop();
  assert.equal(h.controller.repeatLast(), true);
  assert.equal(h.utterances[1].text, "Answer to question");
  h.controller.setVoiceOutput(false);
  // Stop remains authoritative while a repeated utterance is active.
  h.controller.stop();
  assert.equal(h.utterances[1].onend, null);
});

test("manual interruption cancels playback and starts one fresh recognition instance", async () => {
  const capture = audioCaptureHarness();
  const submitted = [];
  const h = harness({
    mediaDevices: capture.mediaDevices,
    audioContextFactory: () => capture.context,
    onUtterance: async (text) => { submitted.push(text); return `Answer: ${text}`; },
  });
  h.controller.start();
  await tick();
  h.recognizers[0].onresult(resultEvent(["first question", true]));
  await tick();
  assert.equal(h.recognizers.length, 2);
  const oldPlaybackEnd = h.utterances[0].onend;
  assert.equal(h.controller.interruptAndListen(), true);
  oldPlaybackEnd?.();
  assert.equal(h.synthesis.cancelled, 1);
  assert.equal(h.recognizers[1].aborted, true);
  assert.equal(capture.track.stopped, true);
  assert.equal(h.recognizers.length, 3);
  assert.equal(h.recognizers[2].startArgs.length, 0);
  assert.equal(h.controller.getState(), "LISTENING");
  h.recognizers[2].onresult(resultEvent(["my follow up question", true]));
  await tick();
  assert.deepEqual(submitted, ["first question", "my follow up question"]);
  assert.equal(h.utterances[1].text, "Answer: my follow up question");
  h.controller.stop();
});

test("typed question submitted during playback cancels the old answer", async () => {
  const submitted = [];
  const h = harness({ onUtterance: async (text) => { submitted.push(text); return `Answer: ${text}`; } });
  h.controller.start();
  h.recognizers[0].onresult(resultEvent(["spoken question", true]));
  await tick();
  const previousEnd = h.utterances[0].onend;
  const replacementRequest = h.controller.submitText("typed interruption");
  await tick();
  previousEnd?.();
  assert.deepEqual(submitted, ["spoken question", "typed interruption"]);
  assert.equal(h.synthesis.cancelled, 1);
  assert.equal(h.utterances[1].text, "Answer: typed interruption");
  assert.equal(h.controller.getState(), "SPEAKING");
  h.utterances[1].onend();
  await replacementRequest;
});

test("turning voice output off still displays the answer and returns to listening", async () => {
  const h = harness();
  h.controller.setVoiceOutput(false);
  h.controller.start();
  h.recognizers[0].onresult(resultEvent(["text question", true]));
  await tick();
  assert.equal(h.utterances.length, 0);
  assert.equal(h.controller.getState(), "LISTENING");
  assert.equal(h.recognizers.length, 2);
});

test("unavailable speech synthesis is reported without blocking recognition", async () => {
  const h = harness({ synthesis: null });
  h.controller.start();
  h.recognizers[0].onresult(resultEvent(["question", true]));
  await tick();
  assert.equal(h.controller.getState(), "LISTENING");
  assert.match(h.errors[0], /not supported/);
  assert.equal(h.recognizers.length, 2);
});

test("microphone level is analyzed locally and the stream is released on Stop", async () => {
  const levels = [];
  const track = { stopped: false, stop() { this.stopped = true; } };
  const analyser = {
    fftSize: 0,
    getByteTimeDomainData(samples) { samples.fill(128); samples[0] = 255; },
    disconnect() {},
  };
  const context = {
    state: "running",
    createMediaStreamSource: () => ({ connect() {}, disconnect() {} }),
    createAnalyser: () => analyser,
    close: async () => { context.state = "closed"; },
  };
  const h = harness({
    onAudioLevel: (level) => levels.push(level),
    mediaDevices: { getUserMedia: async () => ({ getTracks: () => [track], getAudioTracks: () => [track] }) },
    audioContextFactory: () => context,
  });
  h.controller.start();
  await tick();
  assert.equal(levels.some((level) => typeof level === "number" && level > 0), true);
  h.controller.stop();
  assert.equal(track.stopped, true);
  assert.equal(levels.at(-1), null);
});

test("manual interruption stays active through repeated answers and ignores speech until the button is pressed", async () => {
  const capture = audioCaptureHarness();
  const submitted = [];
  const h = harness({
    mediaDevices: capture.mediaDevices,
    audioContextFactory: () => ({ ...capture.context, state: "running" }),
    onUtterance: async (text) => {
      submitted.push(text);
      return "Tutor answer " + submitted.length;
    },
  });
  h.controller.start();
  await tick();
  h.recognizers[0].onresult(resultEvent(["first question", true]));
  await tick();
  assert.equal(h.controller.getState(), "SPEAKING");

  capture.setAmplitude(0.35);
  await new Promise((resolve) => setTimeout(resolve, 360));
  assert.equal(h.controller.getState(), "SPEAKING", "microphone energy alone must not stop Tutor speech");
  assert.equal(h.synthesis.cancelled || 0, 0);

  h.recognizers[1].onresult(resultEvent(["question before button", true]));
  assert.equal(h.controller.getState(), "SPEAKING", "recognition during playback must not auto-submit");
  assert.deepEqual(submitted, ["first question"]);
  capture.setAmplitude(0);

  for (const [monitorIndex, nativeIndex, question] of [
    [2, 3, "second question"],
    [4, 5, "third question"],
  ]) {
    assert.equal(h.controller.interruptAndListen(), true);
    await tick();
    assert.equal(h.synthesis.cancelled, submitted.length);
    assert.equal(h.recognizers[monitorIndex].aborted, true);
    assert.equal(capture.track.stopped, true);
    assert.equal(h.recognizers[nativeIndex].startArgs.length, 0, "manual interruption starts a fresh browser microphone recognizer");
    assert.equal(h.controller.getState(), "LISTENING");

    h.recognizers[nativeIndex].onresult(resultEvent([question, true]));
    await tick();
    assert.deepEqual(submitted, question === "second question"
      ? ["first question", "second question"]
      : ["first question", "second question", "third question"]);
    assert.equal(h.controller.getState(), "SPEAKING");
    assert.equal(h.recognizers.length, monitorIndex + 3);
  }

  assert.deepEqual(submitted, ["first question", "second question", "third question"]);
  h.controller.stop();
});

test("Stop releases the shared audio stream and stale playback callbacks cannot restart recognition", async () => {
  const capture = audioCaptureHarness();
  const h = harness({ mediaDevices: capture.mediaDevices, audioContextFactory: () => capture.context });
  h.controller.start();
  await tick();
  h.recognizers[0].onresult(resultEvent(["question", true]));
  await tick();
  const staleEnd = h.utterances[0].onend;
  h.controller.stop();
  staleEnd?.();
  await new Promise((resolve) => setTimeout(resolve, 120));
  assert.equal(capture.track.stopped, true);
  assert.equal(h.controller.getState(), "IDLE");
  assert.equal(h.recognizers.length, 2);
  assert.equal(h.synthesis.cancelled, 1);
});

test("backgrounding the page stops listening and cleanup removes lifecycle listeners", () => {
  const listeners = new Map();
  const target = {
    addEventListener(name, callback) { listeners.set(name, callback); },
    removeEventListener(name) { listeners.delete(name); },
  };
  let visibility = "visible";
  const h = harness({
    documentObject: { ...target, get visibilityState() { return visibility; } },
    windowObject: target,
  });
  h.controller.start();
  visibility = "hidden";
  listeners.get("visibilitychange")();
  assert.equal(h.controller.getState(), "ERROR");
  assert.match(h.errors[0], /background/);
  h.controller.dispose();
  assert.equal(listeners.size, 0);
});

test("connection loss cancels an active session and exposes recovery guidance", () => {
  const listeners = new Map();
  const windowObject = {
    addEventListener(name, callback) { listeners.set(name, callback); },
    removeEventListener(name) { listeners.delete(name); },
  };
  const h = harness({ windowObject });
  h.controller.start();
  listeners.get("offline")();
  assert.equal(h.controller.getState(), "ERROR");
  assert.match(h.errors[0], /connection lost/i);
  h.controller.dispose();
  assert.equal(listeners.size, 0);
});
