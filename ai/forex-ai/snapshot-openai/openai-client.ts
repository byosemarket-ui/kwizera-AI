/**
 * Server-side OpenAI Chat Completions client (fetch; no browser exposure).
 * Does not log Authorization headers or API keys.
 */
import { openAiOmitsCustomTemperature } from "./model-policy.js";

export interface OpenAiChatResult {
  ok: boolean;
  code:
    | "OK"
    | "OPENAI_NOT_CONFIGURED"
    | "OPENAI_AUTH_ERROR"
    | "OPENAI_BILLING_BLOCKED"
    | "OPENAI_RATE_LIMIT"
    | "OPENAI_TIMEOUT"
    | "OPENAI_UNAVAILABLE"
    | "OPENAI_INVALID_RESPONSE"
    | "OPENAI_ERROR";
  model: string | null;
  latencyMs: number;
  data: Record<string, unknown> | null;
  rawText?: string;
  error?: string;
  requestId?: string | null;
  attempts?: number;
  retryable?: boolean;
}

export interface OpenAiChatInput {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  timeoutMs: number;
  temperature?: number;
}

export interface OpenAiListedModel {
  id: string;
  created: number | null;
  ownedBy: string | null;
}

export interface OpenAiListModelsResult {
  ok: boolean;
  code:
    | "OK"
    | "OPENAI_NOT_CONFIGURED"
    | "OPENAI_AUTH_ERROR"
    | "OPENAI_BILLING_BLOCKED"
    | "OPENAI_RATE_LIMIT"
    | "OPENAI_TIMEOUT"
    | "OPENAI_UNAVAILABLE"
    | "OPENAI_ERROR";
  latencyMs: number;
  models: OpenAiListedModel[];
  error?: string;
}

const OPENAI_RETRY_BASE_MS = 500;
const OPENAI_RETRY_FACTOR = 2;
const OPENAI_RETRY_CAP_MS = 20_000;
const OPENAI_CHAT_MAX_ATTEMPTS = 3;
const OPENAI_CHAT_MIN_REQUEST_MS = 1_000;

function parseOpenAiErrorFields(bodyText: string): {
  code?: string;
  type?: string;
  message?: string;
} {
  try {
    const parsed = JSON.parse(bodyText) as {
      error?: { code?: string; type?: string; message?: string };
    };
    return {
      code: parsed.error?.code,
      type: parsed.error?.type,
      message: parsed.error?.message,
    };
  } catch {
    return {};
  }
}

/** Classify HTTP error responses from OpenAI (exported for tests). */
export function classifyOpenAiHttpError(
  status: number,
  bodyText: string,
): OpenAiChatResult["code"] {
  if (status === 401 || status === 403) return "OPENAI_AUTH_ERROR";
  if (status === 429) {
    const { code, type, message } = parseOpenAiErrorFields(bodyText);
    const combined = `${code ?? ""} ${type ?? ""} ${message ?? ""} ${bodyText}`.toLowerCase();
    if (
      code === "insufficient_quota"
      || type === "insufficient_quota"
      || code === "billing_not_active"
      || type === "billing_not_active"
      || /quota.*exhaust|exhaust.*quota/.test(combined)
      || (/billing/.test(combined) && /exhaust|inactive|not active|payment|quota/.test(combined))
    ) {
      return "OPENAI_BILLING_BLOCKED";
    }
    return "OPENAI_RATE_LIMIT";
  }
  if (status >= 500) return "OPENAI_UNAVAILABLE";
  if (/timeout/i.test(bodyText)) return "OPENAI_TIMEOUT";
  return "OPENAI_ERROR";
}

/** Parse Retry-After header (seconds or HTTP-date). */
export function parseOpenAiRetryAfterMs(
  headers: Headers | Record<string, string> | null,
  _bodyText: string,
): number | null {
  if (!headers) return null;
  const raw = headers instanceof Headers
    ? headers.get("retry-after") ?? headers.get("Retry-After")
    : headers["retry-after"] ?? headers["Retry-After"];
  if (!raw) return null;
  const asNum = Number(raw);
  if (Number.isFinite(asNum) && asNum >= 0) return Math.round(asNum * 1000);
  const asDate = Date.parse(raw);
  if (Number.isFinite(asDate)) {
    const delta = asDate - Date.now();
    return delta > 0 ? delta : null;
  }
  return null;
}

/** Exponential backoff with jitter; honors Retry-After when provided (capped). */
export function computeOpenAiRetryDelayMs(
  attempt: number,
  retryAfterMs: number | null,
): number {
  if (retryAfterMs != null && retryAfterMs > 0) {
    return Math.min(OPENAI_RETRY_CAP_MS, retryAfterMs);
  }
  const exp = Math.min(
    OPENAI_RETRY_CAP_MS,
    OPENAI_RETRY_BASE_MS * OPENAI_RETRY_FACTOR ** attempt,
  );
  const jitter = Math.floor(Math.random() * Math.min(exp * 0.25, 1_000));
  return Math.min(OPENAI_RETRY_CAP_MS, exp + jitter);
}

function openAiErrorIsRetryable(code: OpenAiChatResult["code"]): boolean {
  return code === "OPENAI_RATE_LIMIT" || code === "OPENAI_UNAVAILABLE";
}

function readHeaderRequestId(headers: Headers): string | null {
  return (
    headers.get("x-request-id")
    ?? headers.get("x-openai-request-id")
    ?? headers.get("request-id")
  );
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type ChatCompletionsHttpSuccess = {
  ok: true;
  text: string;
  requestId: string | null;
  attempts: number;
};

type ChatCompletionsHttpFailure = {
  ok: false;
  code: OpenAiChatResult["code"];
  error: string;
  requestId: string | null;
  attempts: number;
  retryable: boolean;
};

async function fetchChatCompletionsWithRetry(input: {
  apiKey: string;
  body: Record<string, unknown>;
  model: string;
  timeoutMs: number;
  visionHintOnError?: boolean;
}): Promise<ChatCompletionsHttpSuccess | ChatCompletionsHttpFailure> {
  const wallMs = Math.max(5_000, input.timeoutMs);
  const deadline = Date.now() + wallMs;
  const remainingMs = () => Math.max(0, deadline - Date.now());

  let attempts = 0;
  let lastRequestId: string | null = null;

  while (attempts < OPENAI_CHAT_MAX_ATTEMPTS) {
    attempts += 1;
    const budget = remainingMs();
    if (budget < OPENAI_CHAT_MIN_REQUEST_MS) {
      return {
        ok: false,
        code: "OPENAI_TIMEOUT",
        error: `OpenAI timed out after ${Date.now() - (deadline - wallMs)} ms.`,
        requestId: lastRequestId,
        attempts,
        retryable: false,
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), budget);

    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${input.apiKey}`,
        },
        body: JSON.stringify(input.body),
        signal: controller.signal,
      });

      const text = await res.text();
      lastRequestId = readHeaderRequestId(res.headers);

      if (res.ok) {
        return { ok: true, text, requestId: lastRequestId, attempts };
      }

      const code = classifyOpenAiHttpError(res.status, text);
      let error = safeProviderMessage(res.status, text);
      if (input.visionHintOnError && /image|vision|multimodal|content.*not supported/i.test(text)) {
        error = `${error} The configured model may not support image inputs.`.slice(0, 280);
      }

      const retryable = openAiErrorIsRetryable(code);
      const canRetry = retryable && attempts < OPENAI_CHAT_MAX_ATTEMPTS;

      if (!canRetry) {
        return {
          ok: false,
          code,
          error,
          requestId: lastRequestId,
          attempts,
          retryable,
        };
      }

      const retryAfterMs = parseOpenAiRetryAfterMs(res.headers, text);
      const delayMs = Math.min(computeOpenAiRetryDelayMs(attempts - 1, retryAfterMs), remainingMs());
      if (delayMs <= 0 || remainingMs() < OPENAI_CHAT_MIN_REQUEST_MS) {
        return {
          ok: false,
          code,
          error,
          requestId: lastRequestId,
          attempts,
          retryable: true,
        };
      }
      await sleepMs(delayMs);
    } catch (err) {
      const aborted = err instanceof Error && err.name === "AbortError";
      if (aborted) {
        return {
          ok: false,
          code: "OPENAI_TIMEOUT",
          error: `OpenAI timed out after ${Date.now() - (deadline - wallMs)} ms.`,
          requestId: lastRequestId,
          attempts,
          retryable: false,
        };
      }

      const retryable = true;
      const canRetry = attempts < OPENAI_CHAT_MAX_ATTEMPTS;
      if (!canRetry) {
        return {
          ok: false,
          code: "OPENAI_UNAVAILABLE",
          error: err instanceof Error ? err.message.slice(0, 180) : "OpenAI network request failed.",
          requestId: lastRequestId,
          attempts,
          retryable,
        };
      }

      const delayMs = Math.min(computeOpenAiRetryDelayMs(attempts - 1, null), remainingMs());
      if (delayMs <= 0 || remainingMs() < OPENAI_CHAT_MIN_REQUEST_MS) {
        return {
          ok: false,
          code: "OPENAI_UNAVAILABLE",
          error: "OpenAI network request failed.",
          requestId: lastRequestId,
          attempts,
          retryable: true,
        };
      }
      await sleepMs(delayMs);
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    ok: false,
    code: "OPENAI_UNAVAILABLE",
    error: "OpenAI request failed after retries.",
    requestId: lastRequestId,
    attempts,
    retryable: true,
  };
}

function parseChatCompletionPayload(
  text: string,
  inputModel: string,
  started: number,
  attempts: number,
  requestId: string | null,
  invalidEnvelope: string,
  invalidContent: string,
  invalidJson: string,
  rawSlice: number,
): OpenAiChatResult {
  const latencyMs = Date.now() - started;

  let payload: {
    model?: string;
    choices?: Array<{ message?: { content?: string } }>;
  };
  try {
    payload = JSON.parse(text) as typeof payload;
  } catch {
    return {
      ok: false,
      code: "OPENAI_INVALID_RESPONSE",
      model: inputModel,
      latencyMs,
      data: null,
      error: invalidEnvelope,
      requestId,
      attempts,
      retryable: false,
    };
  }

  const content = String(payload.choices?.[0]?.message?.content ?? "").trim();
  if (!content) {
    return {
      ok: false,
      code: "OPENAI_INVALID_RESPONSE",
      model: payload.model ?? inputModel,
      latencyMs,
      data: null,
      error: invalidContent,
      requestId,
      attempts,
      retryable: false,
    };
  }

  try {
    const data = JSON.parse(content) as Record<string, unknown>;
    return {
      ok: true,
      code: "OK",
      model: payload.model ?? inputModel,
      latencyMs,
      data,
      rawText: content.slice(0, rawSlice),
      requestId,
      attempts,
      retryable: false,
    };
  } catch {
    return {
      ok: false,
      code: "OPENAI_INVALID_RESPONSE",
      model: payload.model ?? inputModel,
      latencyMs,
      data: null,
      rawText: content.slice(0, rawSlice),
      error: invalidJson,
      requestId,
      attempts,
      retryable: false,
    };
  }
}

function safeProviderMessage(status: number, bodyText: string): string {
  // Never echo Authorization or key material; keep short sanitized message.
  let snippet = bodyText.replace(/sk-[a-zA-Z0-9_-]+/g, "[redacted]").slice(0, 180);
  try {
    const parsed = JSON.parse(bodyText) as { error?: { message?: string; code?: string } };
    if (parsed.error?.message) {
      snippet = String(parsed.error.message).replace(/sk-[a-zA-Z0-9_-]+/g, "[redacted]").slice(0, 180);
    }
  } catch {
    /* keep snippet */
  }
  if (status === 401 || status === 403) return "OpenAI authentication failed. Check the configured API key.";
  if (status === 429) {
    if (classifyOpenAiHttpError(status, bodyText) === "OPENAI_BILLING_BLOCKED") {
      return "OpenAI billing or quota limit reached. Check your plan and billing settings.";
    }
    return "OpenAI rate limit reached. Retry later or reduce request frequency.";
  }
  if (/temperature/i.test(snippet) && /unsupported|does not support|not supported/i.test(snippet)) {
    return "Unsupported request parameter for this model (temperature). Use model-compatible defaults.";
  }
  if (/unsupported (value|parameter)/i.test(snippet)) {
    return `Unsupported request parameter for this model: ${snippet}`;
  }
  return snippet || `OpenAI request failed (${status}).`;
}

/**
 * Build Chat Completions JSON body with model-compatible sampling fields.
 * Omits `temperature` for GPT-5 / GPT-6 / o-series that reject non-default values.
 */
export function buildOpenAiChatJsonBody(input: {
  model: string;
  system: string;
  user: string;
  temperature?: number;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: input.model,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: input.system },
      { role: "user", content: input.user },
    ],
  };
  if (!openAiOmitsCustomTemperature(input.model)) {
    body.temperature = input.temperature ?? 0.1;
  }
  return body;
}

export type OpenAiImagePart = {
  mimeType: string;
  base64: string;
};

/**
 * Phase 49B — multimodal Chat Completions body (text + image_url data URLs).
 * Does not strip images for text-only models; callers must gate vision eligibility first.
 */
export function buildOpenAiMultimodalChatJsonBody(input: {
  model: string;
  system: string;
  userText: string;
  images: OpenAiImagePart[];
  temperature?: number;
}): Record<string, unknown> {
  const userContent: Array<Record<string, unknown>> = [
    { type: "text", text: input.userText },
  ];
  for (const img of input.images) {
    const mime = String(img.mimeType || "image/png");
    userContent.push({
      type: "image_url",
      image_url: {
        url: `data:${mime};base64,${img.base64}`,
      },
    });
  }
  const body: Record<string, unknown> = {
    model: input.model,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: input.system },
      { role: "user", content: userContent },
    ],
  };
  if (!openAiOmitsCustomTemperature(input.model)) {
    body.temperature = input.temperature ?? 0.1;
  }
  return body;
}

export interface OpenAiMultimodalChatInput {
  apiKey: string;
  model: string;
  system: string;
  userText: string;
  images: OpenAiImagePart[];
  timeoutMs: number;
  temperature?: number;
}

export async function openAiChatMultimodalJson(
  input: OpenAiMultimodalChatInput,
): Promise<OpenAiChatResult> {
  const started = Date.now();
  const body = buildOpenAiMultimodalChatJsonBody({
    model: input.model,
    system: input.system,
    userText: input.userText,
    images: input.images,
    temperature: input.temperature,
  });

  const http = await fetchChatCompletionsWithRetry({
    apiKey: input.apiKey,
    body,
    model: input.model,
    timeoutMs: input.timeoutMs,
    visionHintOnError: true,
  });

  if (!http.ok) {
    return {
      ok: false,
      code: http.code,
      model: input.model,
      latencyMs: Date.now() - started,
      data: null,
      error: http.error,
      requestId: http.requestId,
      attempts: http.attempts,
      retryable: http.retryable,
    };
  }

  return parseChatCompletionPayload(
    http.text,
    input.model,
    started,
    http.attempts,
    http.requestId,
    "OpenAI returned non-JSON response.",
    "OpenAI response missing message content.",
    "Model content was not valid JSON.",
    2_000,
  );
}

export async function openAiChatJson(input: OpenAiChatInput): Promise<OpenAiChatResult> {
  const started = Date.now();
  const body = buildOpenAiChatJsonBody({
    model: input.model,
    system: input.system,
    user: input.user,
    temperature: input.temperature,
  });

  const http = await fetchChatCompletionsWithRetry({
    apiKey: input.apiKey,
    body,
    model: input.model,
    timeoutMs: input.timeoutMs,
  });

  if (!http.ok) {
    return {
      ok: false,
      code: http.code,
      model: input.model,
      latencyMs: Date.now() - started,
      data: null,
      error: http.error,
      requestId: http.requestId,
      attempts: http.attempts,
      retryable: http.retryable,
    };
  }

  return parseChatCompletionPayload(
    http.text,
    input.model,
    started,
    http.attempts,
    http.requestId,
    "OpenAI returned non-JSON envelope.",
    "OpenAI returned an empty message.",
    "OpenAI message was not valid JSON.",
    400,
  );
}

/**
 * Bounded connection / model inference verification (server-side only).
 * Uses Chat Completions + json_object — same surface as Forex analysis.
 * Never logs the API key or Authorization header.
 */
export async function verifyOpenAiConnection(input: {
  apiKey: string;
  model: string;
  timeoutMs?: number;
}): Promise<{
  ok: boolean;
  code: OpenAiChatResult["code"] | "MODEL_NOT_ELIGIBLE" | "INVALID_MODEL";
  model: string;
  latencyMs: number;
  returnedModel: string | null;
  error?: string;
}> {
  const model = String(input.model ?? "").trim();
  if (!/^[a-zA-Z0-9._:-]{3,64}$/.test(model)) {
    return {
      ok: false,
      code: "INVALID_MODEL",
      model,
      latencyMs: 0,
      returnedModel: null,
      error: "Invalid model identifier.",
    };
  }

  const result = await openAiChatJson({
    apiKey: input.apiKey,
    model,
    timeoutMs: Math.max(5_000, Math.min(45_000, input.timeoutMs ?? 25_000)),
    temperature: 0,
    system:
      "Return only a compact JSON object. No markdown. No secrets. "
      + 'Schema: {"ok":true,"ping":"pong","provider":"openai"}.',
    user: 'Reply with JSON {"ok":true,"ping":"pong","provider":"openai"} exactly.',
  });

  if (!result.ok || !result.data) {
    return {
      ok: false,
      code: result.code,
      model,
      latencyMs: result.latencyMs,
      returnedModel: result.model,
      error: result.error || "OpenAI verification failed.",
    };
  }

  const ping = String(result.data.ping ?? "");
  const okFlag = result.data.ok === true || result.data.ok === "true";
  if (!okFlag || ping.toLowerCase() !== "pong") {
    return {
      ok: false,
      code: "OPENAI_INVALID_RESPONSE",
      model,
      latencyMs: result.latencyMs,
      returnedModel: result.model,
      error: "OpenAI responded but structured verification JSON was not accepted.",
    };
  }

  return {
    ok: true,
    code: "OK",
    model,
    latencyMs: result.latencyMs,
    returnedModel: result.model,
  };
}

/** GET /v1/models/{id} — confirms account access to a specific model id. */
export async function getOpenAiModel(input: {
  apiKey: string;
  modelId: string;
  timeoutMs?: number;
}): Promise<{
  ok: boolean;
  code: OpenAiListModelsResult["code"] | "MODEL_NOT_FOUND";
  latencyMs: number;
  model: OpenAiListedModel | null;
  error?: string;
}> {
  const key = String(input.apiKey ?? "").trim();
  const modelId = String(input.modelId ?? "").trim();
  if (!key) {
    return {
      ok: false,
      code: "OPENAI_NOT_CONFIGURED",
      latencyMs: 0,
      model: null,
      error: "OpenAI API key is not configured.",
    };
  }
  if (!modelId) {
    return {
      ok: false,
      code: "MODEL_NOT_FOUND",
      latencyMs: 0,
      model: null,
      error: "Model id is required.",
    };
  }

  const started = Date.now();
  const controller = new AbortController();
  const timeoutMs = Math.max(2_000, Math.min(20_000, input.timeoutMs ?? 10_000));
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(
      `https://api.openai.com/v1/models/${encodeURIComponent(modelId)}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${key}` },
        signal: controller.signal,
      },
    );
    const latencyMs = Date.now() - started;
    const bodyText = await res.text();
    if (res.status === 404) {
      return {
        ok: false,
        code: "MODEL_NOT_FOUND",
        latencyMs,
        model: null,
        error: `Model "${modelId}" was not found for this API key.`,
      };
    }
    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        code: "OPENAI_AUTH_ERROR",
        latencyMs,
        model: null,
        error: "OpenAI authentication failed. Check the configured API key.",
      };
    }
    if (res.status === 429) {
      const limitCode = classifyOpenAiHttpError(res.status, bodyText);
      return {
        ok: false,
        code: limitCode,
        latencyMs,
        model: null,
        error: safeProviderMessage(res.status, bodyText),
      };
    }
    if (!res.ok) {
      return {
        ok: false,
        code: "OPENAI_ERROR",
        latencyMs,
        model: null,
        error: `OpenAI model lookup failed (HTTP ${res.status}).`,
      };
    }
    let payload: { id?: string; created?: number; owned_by?: string } = {};
    try {
      payload = JSON.parse(bodyText) as typeof payload;
    } catch {
      /* ignore */
    }
    const id = String(payload.id ?? modelId).trim();
    return {
      ok: true,
      code: "OK",
      latencyMs,
      model: {
        id,
        created: typeof payload.created === "number" ? payload.created : null,
        ownedBy: payload.owned_by == null ? null : String(payload.owned_by),
      },
    };
  } catch (err) {
    const latencyMs = Date.now() - started;
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      ok: false,
      code: aborted ? "OPENAI_TIMEOUT" : "OPENAI_UNAVAILABLE",
      latencyMs,
      model: null,
      error: aborted
        ? `OpenAI model lookup timed out after ${latencyMs} ms.`
        : "OpenAI model lookup network request failed.",
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * List models available to the configured API key (server-side only).
 * Never exposes the key; returns sanitized metadata only.
 */
export async function listOpenAiModels(input: {
  apiKey: string;
  timeoutMs?: number;
}): Promise<OpenAiListModelsResult> {
  const key = String(input.apiKey ?? "").trim();
  if (!key) {
    return {
      ok: false,
      code: "OPENAI_NOT_CONFIGURED",
      latencyMs: 0,
      models: [],
      error: "OpenAI API key is not configured.",
    };
  }

  const started = Date.now();
  const controller = new AbortController();
  const timeoutMs = Math.max(2_000, Math.min(30_000, input.timeoutMs ?? 15_000));
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${key}`,
      },
      signal: controller.signal,
    });
    const latencyMs = Date.now() - started;
    const bodyText = await res.text();
    let payload: { data?: Array<{ id?: string; created?: number; owned_by?: string }> } = {};
    try {
      payload = JSON.parse(bodyText) as typeof payload;
    } catch {
      /* ignore */
    }

    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        code: "OPENAI_AUTH_ERROR",
        latencyMs,
        models: [],
        error: "OpenAI authentication failed. Check the configured API key.",
      };
    }
    if (res.status === 429) {
      const limitCode = classifyOpenAiHttpError(res.status, bodyText);
      return {
        ok: false,
        code: limitCode,
        latencyMs,
        models: [],
        error: safeProviderMessage(res.status, bodyText),
      };
    }
    if (!res.ok) {
      return {
        ok: false,
        code: "OPENAI_ERROR",
        latencyMs,
        models: [],
        error: `OpenAI models list failed (HTTP ${res.status}).`,
      };
    }

    const models: OpenAiListedModel[] = (payload.data ?? [])
      .map((m) => ({
        id: String(m.id ?? "").trim(),
        created: typeof m.created === "number" ? m.created : null,
        ownedBy: m.owned_by == null ? null : String(m.owned_by),
      }))
      .filter((m) => m.id.length > 0);

    return { ok: true, code: "OK", latencyMs, models };
  } catch (err) {
    const latencyMs = Date.now() - started;
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      ok: false,
      code: aborted ? "OPENAI_TIMEOUT" : "OPENAI_UNAVAILABLE",
      latencyMs,
      models: [],
      error: aborted
        ? `OpenAI models list timed out after ${latencyMs} ms.`
        : "OpenAI models list network request failed.",
    };
  } finally {
    clearTimeout(timer);
  }
}
