export const SPEECH_VOICE_PREFERENCE_KEY = "adapt_voice_tutor_voice";

export function speechVoiceId(voice) {
  if (!voice) return "";
  return `${voice.name || ""}::${voice.lang || ""}`;
}

export function readSpeechVoicePreference(storage) {
  try { return (storage ?? globalThis.localStorage)?.getItem(SPEECH_VOICE_PREFERENCE_KEY) || ""; }
  catch { return ""; }
}

export function writeSpeechVoicePreference(id, storage) {
  try {
    const target = storage ?? globalThis.localStorage;
    if (id) target?.setItem(SPEECH_VOICE_PREFERENCE_KEY, id);
    else target?.removeItem(SPEECH_VOICE_PREFERENCE_KEY);
  } catch { /* Voice selection is optional when browser storage is unavailable. */ }
}

export function resolveSpeechVoice(voices, preferredId) {
  if (!Array.isArray(voices) || !voices.length) return null;
  return voices.find((voice) => speechVoiceId(voice) === preferredId) || null;
}
