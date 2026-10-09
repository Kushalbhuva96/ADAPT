export async function requestVoiceTutorReply({ mode, engine, message, history = [], course, topic }, dependencies = {}) {
  if (mode === "local") {
    if (!engine) throw new Error("Local AI is selected, but its on-device model is not loaded. Load Local AI or switch to Server AI.");
    const localReply = dependencies.localReply;
    if (!localReply) throw new Error("Local AI is unavailable in this session.");
    return localReply(engine, { message, history, course, topic });
  }
  const hostedRequest = dependencies.hostedRequest;
  if (!hostedRequest) throw new Error("Server AI is unavailable in this session.");
  return hostedRequest({
    message,
    mode: "explain",
    topicId: topic?.id,
    topicName: topic?.name,
    courseName: course?.title,
    history,
  });
}
