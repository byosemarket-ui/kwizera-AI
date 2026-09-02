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
  | "ERROR";

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

export function ollamaBaseUrl(override?: string): string {
  return (override ?? process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434").replace(/\/$/, "");
}

export async function fetchOllamaTags(opts?: {
  baseUrl?: string;
  timeoutMs?: number;
}): Promise<OllamaTagsResult> {
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
}): Promise<{ ok: true; text: string } | { ok: false; error: string; code: string }> {
  const baseUrl = ollamaBaseUrl(opts.baseUrl);
  try {
    const res = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(opts.timeoutMs ?? 90_000),
      body: JSON.stringify({
        model: opts.model,
        prompt: opts.prompt,
        stream: false,
        format: "json",
      }),
    });
    if (!res.ok) {
      const code = res.status === 404 ? "MODEL_NOT_FOUND" : "OLLAMA_ERROR";
      return { ok: false, error: `Ollama generate failed (${res.status})`, code };
    }
    const body = await res.json() as { response?: string };
    return { ok: true, text: body.response ?? "" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ollama generate failed";
    const code = /abort|timeout/i.test(message) ? "MODEL_TIMEOUT" : "OLLAMA_ERROR";
    return { ok: false, error: message, code };
  }
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
    const hit = installed.find((m) => pattern.test(m.name));
    if (hit) return hit.name;
  }
  return installed[0]?.name ?? null;
}
