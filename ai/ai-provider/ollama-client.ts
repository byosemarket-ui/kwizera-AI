/**
 * Shared Ollama HTTP client — used by vision and creative-reasoning providers.
 * Never installs models; fails safely when unreachable.
 */

export type OllamaServiceStatus =
  | "UNAVAILABLE"
  | "AVAILABLE"
  | "STARTING"
  | "LOADING_MODEL"
  | "READY"
  | "ERROR"
  | "DISABLED";

export interface OllamaModelInfo {
  name: string;
  sizeBytes?: number;
  parameterSize?: string;
  family?: string;
}

export interface OllamaTagsResult {
  ok: boolean;
  status: OllamaServiceStatus;
  models: OllamaModelInfo[];
  error?: string;
}

let ollamaInFlight = 0;
let ollamaWaitQueue: Array<() => void> = [];

export function isOllamaDisabled(): boolean {
  const raw = (process.env.KWIZERA_OLLAMA_DISABLED ?? process.env.OLLAMA_DISABLED ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

export function ollamaMaxConcurrent(): number {
  const raw = Number(process.env.KWIZERA_OLLAMA_MAX_CONCURRENT ?? process.env.OLLAMA_MAX_CONCURRENT ?? 1);
  if (!Number.isFinite(raw) || raw < 1) return 1;
  return Math.min(2, Math.floor(raw));
}

export function ollamaInFlightCount(): number {
  return ollamaInFlight;
}

export function ollamaMaxResponseBytes(): number {
  const raw = Number(process.env.KWIZERA_OLLAMA_MAX_RESPONSE_BYTES ?? 48_000);
  if (!Number.isFinite(raw) || raw < 4_000) return 48_000;
  return Math.min(120_000, Math.floor(raw));
}

export async function withOllamaSlot<T>(work: () => Promise<T>): Promise<T> {
  const limit = ollamaMaxConcurrent();
  if (ollamaInFlight >= limit) {
    await new Promise<void>((resolve) => {
      ollamaWaitQueue.push(resolve);
    });
  }
  ollamaInFlight += 1;
  try {
    return await work();
  } finally {
    ollamaInFlight -= 1;
    const next = ollamaWaitQueue.shift();
    if (next) next();
  }
}

export function ollamaBaseUrl(override?: string): string {
  return (override
    ?? process.env.OLLAMA_HOST
    ?? process.env.OLLAMA_BASE_URL
    ?? "http://127.0.0.1:11434").replace(/\/$/, "");
}

export function ollamaTimeoutMs(fallback = 90_000): number {
  const raw = Number(process.env.OLLAMA_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

export function preferredReasoningModelId(): string {
  return process.env.KWIZERA_OLLAMA_REASONING_MODEL
    ?? process.env.OLLAMA_DIRECTOR_MODEL
    ?? "llama3.2:1b";
}

export function preferredVisionModelId(): string {
  return process.env.KWIZERA_OLLAMA_VISION_MODEL ?? "llava";
}

export async function fetchOllamaTags(opts?: {
  baseUrl?: string;
  timeoutMs?: number;
}): Promise<OllamaTagsResult> {
  if (isOllamaDisabled()) {
    return {
      ok: false,
      status: "DISABLED",
      models: [],
      error: "Ollama disabled via KWIZERA_OLLAMA_DISABLED",
    };
  }
  const baseUrl = ollamaBaseUrl(opts?.baseUrl);
  const timeoutMs = opts?.timeoutMs ?? 4000;
  try {
    const res = await fetch(`${baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      return {
        ok: false,
        status: "ERROR",
        models: [],
        error: `Ollama tags request failed (${res.status})`,
      };
    }
    const body = await res.json() as {
      models?: Array<{
        name?: string;
        size?: number;
        details?: { parameter_size?: string; family?: string };
      }>;
    };
    const models = (body.models ?? [])
      .filter((item) => typeof item.name === "string" && item.name.trim())
      .map((item) => ({
        name: item.name!.trim(),
        sizeBytes: typeof item.size === "number" ? item.size : undefined,
        parameterSize: item.details?.parameter_size,
        family: item.details?.family,
      }));
    return {
      ok: true,
      status: models.length ? "READY" : "AVAILABLE",
      models,
    };
  } catch (error) {
    return {
      ok: false,
      status: "UNAVAILABLE",
      models: [],
      error: error instanceof Error ? error.message : "Ollama unreachable",
    };
  }
}

export async function ollamaGenerateJson(opts: {
  baseUrl?: string;
  model: string;
  prompt: string;
  timeoutMs?: number;
  options?: Record<string, number | string | boolean>;
}): Promise<{ ok: true; text: string } | { ok: false; error: string; code: string }> {
  if (isOllamaDisabled()) {
    return { ok: false, error: "Ollama disabled", code: "OLLAMA_DISABLED" };
  }
  const baseUrl = ollamaBaseUrl(opts.baseUrl);
  return withOllamaSlot(async () => {
    try {
      const res = await fetch(`${baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(opts.timeoutMs ?? ollamaTimeoutMs()),
        body: JSON.stringify({
          model: opts.model,
          prompt: opts.prompt,
          stream: false,
          format: "json",
          keep_alive: "2m",
          options: {
            temperature: 0.2,
            num_ctx: 2048,
            num_predict: 384,
            ...opts.options,
          },
        }),
      });
      if (!res.ok) {
        const code = res.status === 404 ? "MODEL_NOT_FOUND" : "OLLAMA_ERROR";
        return { ok: false, error: `Ollama generate failed (${res.status})`, code };
      }
      const body = await res.json() as { response?: string };
      const text = body.response ?? "";
      if (Buffer.byteLength(text, "utf8") > ollamaMaxResponseBytes()) {
        return { ok: false, error: "Ollama response exceeded the safe size limit", code: "INVALID_AI_OUTPUT" };
      }
      return { ok: true, text };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ollama generate failed";
      const code = /abort|timeout/i.test(message) ? "MODEL_TIMEOUT" : "OLLAMA_ERROR";
      return { ok: false, error: message, code };
    }
  });
}

export function parseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    const parsed = JSON.parse(text.slice(start, end + 1)) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function isSmallReasoningModel(name: string): boolean {
  return /(?:^|[:\-_/])(0\.5b|1b|1\.5b|2b|3b|3\.8b|tinyllama|phi3(?::mini)?|gemma2:2b)(?:$|[:\-_/])/i.test(name)
    || /tinyllama|phi3:mini|qwen2\.5:0\.5b|qwen2\.5:1\.5b|llama3\.2:1b|llama3\.2:3b|gemma2:2b/i.test(name);
}

export function isVisionCapableModel(name: string): boolean {
  return /llava|bakllava|moondream|minicpm-v|qwen2(?:\.5)?-vl|llama3\.2-vision|gemma3:.*vision|vision/i.test(name);
}

/** Prefer small VPS-friendly models already present; never invent installed names. */
export function selectPreferredReasoningModel(
  installed: OllamaModelInfo[],
  preferred?: string,
): string | null {
  if (preferred) {
    const exact = installed.find((m) => m.name === preferred || m.name.startsWith(`${preferred}:`));
    if (exact) return exact.name;
  }
  const preferredPatterns = [
    /llama3\.2:1b/i,
    /llama3\.2:3b/i,
    /phi3(?::mini|:3\.8b)?/i,
    /qwen2\.5:0\.5b/i,
    /qwen2\.5:1\.5b/i,
    /gemma2:2b/i,
    /tinyllama/i,
    /llama3\.2/i,
    /mistral/i,
    /llama3/i,
  ];
  for (const pattern of preferredPatterns) {
    const hit = installed.find((m) => pattern.test(m.name) && !isVisionCapableModel(m.name));
    if (hit) return hit.name;
  }
  const nonVision = installed.find((m) => !isVisionCapableModel(m.name));
  return nonVision?.name ?? installed[0]?.name ?? null;
}

/** Only select models that can accept image payloads. Never fall back to text-only models. */
export function selectPreferredVisionModel(
  installed: OllamaModelInfo[],
  preferred?: string,
): string | null {
  const visionModels = installed.filter((m) => isVisionCapableModel(m.name));
  if (!visionModels.length) return null;
  const want = preferred ?? preferredVisionModelId();
  const exact = visionModels.find((m) => m.name === want || m.name.startsWith(`${want}:`));
  if (exact) return exact.name;
  const preferredPatterns = [
    /moondream/i,
    /llava:7b/i,
    /llava/i,
    /minicpm-v/i,
    /qwen2(?:\.5)?-vl/i,
    /llama3\.2-vision/i,
  ];
  for (const pattern of preferredPatterns) {
    const hit = visionModels.find((m) => pattern.test(m.name));
    if (hit) return hit.name;
  }
  return visionModels[0]?.name ?? null;
}
