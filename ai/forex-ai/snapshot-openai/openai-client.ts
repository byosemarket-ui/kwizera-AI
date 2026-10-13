/**
 * Server-side OpenAI Chat Completions client (fetch; no browser exposure).
 * Does not log Authorization headers or API keys.
 */
export interface OpenAiChatResult {
  ok: boolean;
  code:
    | "OK"
    | "OPENAI_NOT_CONFIGURED"
    | "OPENAI_AUTH_ERROR"
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
    | "OPENAI_RATE_LIMIT"
    | "OPENAI_TIMEOUT"
    | "OPENAI_UNAVAILABLE"
    | "OPENAI_ERROR";
  latencyMs: number;
  models: OpenAiListedModel[];
  error?: string;
}

function mapHttpError(status: number, bodyText: string): OpenAiChatResult["code"] {
  if (status === 401 || status === 403) return "OPENAI_AUTH_ERROR";
  if (status === 429) return "OPENAI_RATE_LIMIT";
  if (status >= 500) return "OPENAI_UNAVAILABLE";
  if (/timeout/i.test(bodyText)) return "OPENAI_TIMEOUT";
  return "OPENAI_ERROR";
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
  if (status === 429) return "OpenAI rate limit reached. Retry later.";
  return snippet || `OpenAI request failed (${status}).`;
}

export async function openAiChatJson(input: OpenAiChatInput): Promise<OpenAiChatResult> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(5_000, input.timeoutMs));

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${input.apiKey}`,
      },
      body: JSON.stringify({
        model: input.model,
        temperature: input.temperature ?? 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.user },
        ],
      }),
      signal: controller.signal,
    });

    const text = await res.text();
    const latencyMs = Date.now() - started;

    if (!res.ok) {
      return {
        ok: false,
        code: mapHttpError(res.status, text),
        model: input.model,
        latencyMs,
        data: null,
        error: safeProviderMessage(res.status, text),
      };
    }

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
        model: input.model,
        latencyMs,
        data: null,
        error: "OpenAI returned non-JSON envelope.",
      };
    }

    const content = String(payload.choices?.[0]?.message?.content ?? "").trim();
    if (!content) {
      return {
        ok: false,
        code: "OPENAI_INVALID_RESPONSE",
        model: payload.model ?? input.model,
        latencyMs,
        data: null,
        error: "OpenAI returned an empty message.",
      };
    }

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(content) as Record<string, unknown>;
    } catch {
      return {
        ok: false,
        code: "OPENAI_INVALID_RESPONSE",
        model: payload.model ?? input.model,
        latencyMs,
        data: null,
        rawText: content.slice(0, 400),
        error: "OpenAI message was not valid JSON.",
      };
    }

    return {
      ok: true,
      code: "OK",
      model: payload.model ?? input.model,
      latencyMs,
      data,
      rawText: content.slice(0, 400),
    };
  } catch (err) {
    const latencyMs = Date.now() - started;
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      ok: false,
      code: aborted ? "OPENAI_TIMEOUT" : "OPENAI_UNAVAILABLE",
      model: input.model,
      latencyMs,
      data: null,
      error: aborted
        ? `OpenAI timed out after ${latencyMs} ms.`
        : "OpenAI network request failed.",
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
      return {
        ok: false,
        code: "OPENAI_RATE_LIMIT",
        latencyMs,
        models: [],
        error: "OpenAI rate limit reached while listing models.",
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
