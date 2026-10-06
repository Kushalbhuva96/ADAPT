import "dotenv/config";
import { createGoogleAIProvider } from "./providers/googleProvider.js";

export type AIJsonSchema = Record<string, unknown>;

export interface AIProvider {
  generateJson(
    systemPrompt: string,
    userPrompt: string,
    responseJsonSchema?: AIJsonSchema,
    model?: string
  ): Promise<string>;
}

export class AIServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
    public readonly category: string,
    public readonly upstreamStatus?: number,
    public readonly upstreamStatusName?: string
  ) {
    super(message);
    this.name = "AIServiceError";
  }
}

let provider: AIProvider | null = null;

function getAIProvider(): AIProvider {
  if (provider) return provider;

  const selectedProvider = (process.env.AI_PROVIDER || "").trim().toLowerCase();
  if (selectedProvider !== "google") {
    throw new AIServiceError(
      "AI provider is not configured. Set AI_PROVIDER=google.",
      "AI_CONFIGURATION_ERROR",
      503,
      "configuration"
    );
  }

  const apiKey = process.env.AI_API_KEY?.trim();
  const primaryModel = process.env.AI_MODEL?.trim();
  const fallbackModel = process.env.AI_FALLBACK_MODEL?.trim();
  if (!apiKey || !primaryModel || !fallbackModel) {
    throw new AIServiceError(
      "Gemini is not configured. Set AI_API_KEY, AI_MODEL, and AI_FALLBACK_MODEL in backend/.env.",
      "AI_CONFIGURATION_ERROR",
      503,
      "configuration"
    );
  }
  if (primaryModel === fallbackModel) {
    throw new AIServiceError(
      "AI_MODEL and AI_FALLBACK_MODEL must identify different models.",
      "AI_CONFIGURATION_ERROR",
      503,
      "configuration"
    );
  }

  provider = createGoogleAIProvider(apiKey, primaryModel, fallbackModel);
  return provider;
}

type ProviderErrorMetadata = {
  status?: number;
  statusName?: string;
  names: string[];
  details: string[];
};

function readProviderErrorMetadata(error: unknown): ProviderErrorMetadata {
  const names: string[] = [];
  const details: string[] = [];
  const pending: unknown[] = [error];
  const visited = new Set<unknown>();
  let status: number | undefined;
  let statusName: string | undefined;

  while (pending.length && visited.size < 24) {
    const value = pending.shift();
    if (value === null || value === undefined || visited.has(value)) continue;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if ((trimmed.startsWith("{") || trimmed.startsWith("[")) && trimmed.length < 20_000) {
        try { pending.push(JSON.parse(trimmed)); } catch { /* Keep scanning the string as plain provider metadata. */ }
      }
      details.push(trimmed);
      continue;
    }
    if (typeof value !== "object") {
      details.push(String(value));
      continue;
    }

    visited.add(value);
    const record = value as Record<string, unknown>;
    for (const key of ["status", "statusCode", "httpStatus", "code"]) {
      const item = record[key];
      if (typeof item === "number" && Number.isInteger(item) && item >= 100 && item <= 599) status ??= item;
      if (typeof item === "string") {
        const normalized = item.trim().toUpperCase().replace(/[ -]+/g, "_");
        const numeric = normalized.match(/(?:^|\D)(\d{3})(?:\D|$)/)?.[1];
        if (numeric) status ??= Number(numeric);
        else if (/^(SERVICE_UNAVAILABLE|UNAVAILABLE|INTERNAL|INTERNAL_SERVER_ERROR|DEADLINE_EXCEEDED|GATEWAY_TIMEOUT|BAD_GATEWAY|OVERLOADED)$/.test(normalized)) statusName ??= normalized;
      }
    }
    if (typeof record.name === "string") names.push(record.name);
    if (typeof record.message === "string") details.push(record.message);
    if (typeof record.status === "string") details.push(record.status);
    if (typeof record.code === "string") details.push(record.code);

    for (const key of ["response", "error", "cause", "data", "details", "metadata"]) {
      if (record[key] !== undefined) pending.push(record[key]);
    }
  }

  const combined = [...names, ...details].join(" ").toUpperCase().replace(/[_-]+/g, " ");
  if (!statusName) {
    if (/SERVICE\s+UNAVAILABLE|SERVICEUNAVAILABLE/.test(combined)) statusName = "SERVICE_UNAVAILABLE";
    else if (/\bUNAVAILABLE\b/.test(combined)) statusName = "UNAVAILABLE";
    else if (/DEADLINE\s+EXCEEDED|TIMEOUT/.test(combined)) statusName = "DEADLINE_EXCEEDED";
    else if (/\bOVERLOADED\b|HIGH DEMAND/.test(combined)) statusName = "OVERLOADED";
    else if (/INTERNAL\s+SERVER\s+ERROR/.test(combined)) statusName = "INTERNAL_SERVER_ERROR";
    else if (/BAD\s+GATEWAY/.test(combined)) statusName = "BAD_GATEWAY";
    else if (/GATEWAY\s+TIMEOUT/.test(combined)) statusName = "GATEWAY_TIMEOUT";
  }
  return { status, statusName, names, details };
}

function classifyProviderError(error: unknown): AIServiceError {
  const metadata = readProviderErrorMetadata(error);
  const detail = [...metadata.names, ...metadata.details].join(" ").toLowerCase().replace(/[_-]+/g, " ");
  const status = metadata.status;

  if (status === 401 || status === 403 || /api.?key|unauthenticated|unauthorized|permission denied|invalid credential/.test(detail)) {
    return new AIServiceError("Gemini authentication failed. Check AI_API_KEY.", "AI_AUTHENTICATION_FAILED", 502, "authentication", status, metadata.statusName);
  }
  // A 429 is a bounded, fallback-eligible provider response. It can indicate a
  // per-model rate limit, which may clear on retry or permit the alternate model.
  // Preserve clearly identified quota exhaustion without a retry when the SDK
  // does not expose a usable HTTP status.
  if (status !== 429 && /quota exceeded|rate limit|resource exhausted|too many requests/.test(detail)) {
    return new AIServiceError("Gemini quota or rate limit was reached. Check the Google AI quota for this key.", "AI_QUOTA_EXCEEDED", 503, "quota", status, metadata.statusName);
  }
  if (/model.*(not found|not available|unsupported)|not found.*model/.test(detail) || status === 404) {
    return new AIServiceError("The configured Gemini model is unavailable to this API key.", "AI_MODEL_UNAVAILABLE", 503, "model", status, metadata.statusName);
  }

  const explicitlyTransientStatus = [429, 500, 502, 503, 504, 529].includes(status || 0);
  const explicitlyTransientName = ["SERVICE_UNAVAILABLE", "UNAVAILABLE", "INTERNAL", "INTERNAL_SERVER_ERROR", "DEADLINE_EXCEEDED", "GATEWAY_TIMEOUT", "BAD_GATEWAY", "OVERLOADED"].includes(metadata.statusName || "");
  const explicitlyTransientMessage = /service\s+unavailable|serviceunavailable|temporarily\s+unavailable|high\s+demand|\boverloaded\b|\bdeadline\s+exceeded\b/.test(detail);
  if (explicitlyTransientStatus || explicitlyTransientName || explicitlyTransientMessage) {
    return new AIServiceError("Gemini is temporarily unavailable. Please try again shortly.", "AI_PROVIDER_UNAVAILABLE", 503, "provider_unavailable", status, metadata.statusName);
  }

  if (/invalid argument|bad request|invalid request|schema.*(invalid|unsupported)|unsupported.*schema/.test(detail) || status === 400) {
    return new AIServiceError("Gemini rejected the request. Check the structured request format.", "AI_PROVIDER_ERROR", 502, "provider", status, metadata.statusName);
  }
  if (/aborterror|timeout|timed out/.test(detail) || metadata.statusName === "DEADLINE_EXCEEDED") {
    return new AIServiceError("Gemini request timed out. Please try again.", "AI_TIMEOUT", 504, "timeout", status, metadata.statusName);
  }
  if (/fetch failed|network|econnreset|enotfound|eai_again/.test(detail)) {
    return new AIServiceError("Gemini is temporarily unreachable. Please try again.", "AI_NETWORK_ERROR", 503, "network", status, metadata.statusName);
  }
  return new AIServiceError("Gemini could not complete the request. Please try again.", "AI_PROVIDER_ERROR", 502, "provider", status, metadata.statusName);
}

function isInvalidOutput(error: unknown): boolean {
  return error instanceof SyntaxError || Boolean((error as any)?.issues);
}

function validateOutput<T>(raw: string, validator?: (data: any) => T): T {
  const parsed = JSON.parse(raw);
  return validator ? validator(parsed) : parsed as T;
}

/** Primary gets the existing bounded retry. A second transient 503 uses the configured fallback once. */
export async function generateStructuredAIResponse<T>(
  systemPrompt: string,
  userPrompt: string,
  validator?: (data: any) => T,
  responseJsonSchema?: AIJsonSchema
): Promise<T> {
  const aiProvider = getAIProvider();
  const primaryModel = process.env.AI_MODEL!.trim();
  const fallbackModel = process.env.AI_FALLBACK_MODEL!.trim();
  let invalidPrimaryOutput: unknown;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const retryHint = attempt === 2 && invalidPrimaryOutput
      ? " Your previous response was invalid. Return a corrected JSON object that satisfies every required field and constraint."
      : "";

    try {
      const raw = await aiProvider.generateJson(systemPrompt + retryHint, userPrompt, responseJsonSchema, primaryModel);
      try {
        return validateOutput(raw, validator);
      } catch (error) {
        if (!isInvalidOutput(error)) throw error;
        invalidPrimaryOutput = error;
        if (attempt === 1) continue;
        throw new AIServiceError(
          "Gemini returned content that did not match the required response schema.",
          "AI_INVALID_RESPONSE",
          502,
          "invalid_response"
        );
      }
    } catch (error) {
      if (error instanceof AIServiceError && error.category === "invalid_response") throw error;
      const serviceError = error instanceof AIServiceError ? error : classifyProviderError(error);

      if (serviceError.category === "provider_unavailable") {
        if (attempt === 1) continue;
        try {
          const upstream = serviceError.upstreamStatus
            ? `HTTP ${serviceError.upstreamStatus}`
            : serviceError.upstreamStatusName || "status unavailable";
          console.warn(`[AI] Primary model failed with ${serviceError.code} (${upstream}) after retry; trying configured fallback (${fallbackModel}).`);
          const fallbackRaw = await aiProvider.generateJson(systemPrompt, userPrompt, responseJsonSchema, fallbackModel);
          try {
            return validateOutput(fallbackRaw, validator);
          } catch (fallbackValidationError) {
            if (isInvalidOutput(fallbackValidationError)) {
              throw new AIServiceError(
                "Gemini returned content that did not match the required response schema.",
                "AI_INVALID_RESPONSE",
                502,
                "invalid_response"
              );
            }
            throw fallbackValidationError;
          }
        } catch (fallbackError) {
          if (fallbackError instanceof AIServiceError && fallbackError.category === "invalid_response") throw fallbackError;
          const fallbackMetadata = fallbackError instanceof AIServiceError
            ? fallbackError
            : classifyProviderError(fallbackError);
          throw new AIServiceError(
            "Gemini is temporarily unavailable. Please try again shortly.",
            "AI_PROVIDER_UNAVAILABLE",
            503,
            "provider_unavailable",
            fallbackMetadata.upstreamStatus,
            fallbackMetadata.upstreamStatusName
          );
        }
      }

      if (["network", "timeout"].includes(serviceError.category) && attempt === 1) continue;
      throw serviceError;
    }
  }

  throw new AIServiceError(
    "Gemini is temporarily unavailable. Please try again shortly.",
    "AI_PROVIDER_UNAVAILABLE",
    503,
    "provider_unavailable"
  );
}

export function getConfiguredAIModel(): string | undefined {
  return process.env.AI_MODEL?.trim() || undefined;
}
