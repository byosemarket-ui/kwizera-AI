/**
 * Local Ollama discovery + optional process ensure for KWIZERA AI STUDIO.
 * Ollama is an optional experimental provider — never required for KWIZERA AI Core.
 * Uses the installed Ollama runtime only — never fabricates models or responses.
 */

import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const OLLAMA_ENDPOINT = "http://127.0.0.1:11434";

export type OllamaModelInfo = {
  name: string;
  size?: number;
  digest?: string;
  family?: string;
  parameterSize?: string;
  quantization?: string;
};

export type OllamaProbeResult = {
  available: boolean;
  endpoint: string;
  models: OllamaModelInfo[];
  error?: string;
  binaryPath?: string;
  startedByStudio?: boolean;
  required: false;
  code:
    | "PROVIDER_AVAILABLE"
    | "PROVIDER_UNAVAILABLE"
    | "MODEL_RUNTIME_UNAVAILABLE"
    | "RUNTIME_UNAVAILABLE";
};

let cachedBinary: { value: string | null; at: number } | null = null;
const BINARY_CACHE_MS = 30_000;

function candidateBinaries(): string[] {
  const home = process.env.LOCALAPPDATA || process.env.USERPROFILE || "";
  return [
    process.env.OLLAMA_PATH,
    process.env.OLLAMA_BIN,
    path.join(home, "Programs", "Ollama", "ollama.exe"),
    "C:\\Program Files\\Ollama\\ollama.exe",
    "C:\\Program Files\\Ollama\\ollama\\ollama.exe",
    "/usr/local/bin/ollama",
    "/usr/bin/ollama",
  ].filter((value): value is string => Boolean(value));
}

function resolveOnPath(name: string): string | null {
  const finder = process.platform === "win32" ? "where" : "which";
  const result = spawnSync(finder, [name], { encoding: "utf8", windowsHide: true });
  if (result.status !== 0) return null;
  const line = (result.stdout || "").split(/\r?\n/).map((item) => item.trim()).find(Boolean);
  return line && fs.existsSync(line) ? line : null;
}

/** Return an actual filesystem binary. Never return a bare "ollama" PATH name that spawn would ENOENT. */
export function findOllamaBinary(): string | null {
  const now = Date.now();
  if (cachedBinary && now - cachedBinary.at < BINARY_CACHE_MS) return cachedBinary.value;

  let found: string | null = null;
  for (const candidate of candidateBinaries()) {
    if (fs.existsSync(candidate)) {
      found = candidate;
      break;
    }
  }
  if (!found) found = resolveOnPath(process.platform === "win32" ? "ollama.exe" : "ollama");

  cachedBinary = { value: found, at: now };
  return found;
}

export function resetOllamaBinaryCache(): void {
  cachedBinary = null;
}

function unavailable(error: string, binaryPath?: string, code: OllamaProbeResult["code"] = "PROVIDER_UNAVAILABLE"): OllamaProbeResult {
  return {
    available: false,
    required: false,
    endpoint: OLLAMA_ENDPOINT,
    models: [],
    error,
    binaryPath,
    code,
  };
}

export async function probeOllama(timeoutMs = 1_200): Promise<OllamaProbeResult> {
  const binaryPath = findOllamaBinary() ?? undefined;
  try {
    const response = await fetch(`${OLLAMA_ENDPOINT}/api/tags`, { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) {
      return unavailable(`Ollama tags returned ${response.status}`, binaryPath);
    }
    const payload = await response.json() as { models?: Array<Record<string, unknown>> };
    const models = (payload.models ?? []).flatMap((item) => {
      const name = typeof item.name === "string" ? item.name : typeof item.model === "string" ? item.model : "";
      if (!name) return [];
      const details = item.details && typeof item.details === "object" ? item.details as Record<string, unknown> : {};
      return [{
        name,
        size: typeof item.size === "number" ? item.size : undefined,
        digest: typeof item.digest === "string" ? item.digest : undefined,
        family: typeof details.family === "string" ? details.family : undefined,
        parameterSize: typeof details.parameter_size === "string" ? details.parameter_size : undefined,
        quantization: typeof details.quantization_level === "string" ? details.quantization_level : undefined,
      } satisfies OllamaModelInfo];
    });
    return {
      available: true,
      required: false,
      endpoint: OLLAMA_ENDPOINT,
      models,
      binaryPath,
      code: "PROVIDER_AVAILABLE",
    };
  } catch (error) {
    return unavailable(
      error instanceof Error ? error.message : String(error),
      binaryPath,
      binaryPath ? "RUNTIME_UNAVAILABLE" : "MODEL_RUNTIME_UNAVAILABLE",
    );
  }
}

function spawnServe(binary: string): Promise<{ ok: true } | { ok: false; error: string }> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: { ok: true } | { ok: false; error: string }) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    try {
      const child = spawn(binary, ["serve"], {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
        shell: false,
      });
      child.once("error", (error) => {
        finish({ ok: false, error: error instanceof Error ? error.message : String(error) });
      });
      child.once("spawn", () => {
        child.unref();
        finish({ ok: true });
      });
    } catch (error) {
      finish({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });
}

/**
 * If Ollama is installed but not answering, optionally start `ollama serve` detached.
 * Never required. Never downloads models. Never waits if the binary is missing.
 */
export async function ensureOllamaRunning(options?: { waitMs?: number }): Promise<OllamaProbeResult> {
  const waitMs = options?.waitMs ?? 8_000;
  const first = await probeOllama();
  if (first.available) return first;

  const binary = first.binaryPath ?? findOllamaBinary();
  if (!binary) {
    return unavailable(
      "PROVIDER_UNAVAILABLE: Ollama is optional and is not installed",
      undefined,
      "MODEL_RUNTIME_UNAVAILABLE",
    );
  }

  const allowStart = process.env.KWIZERA_START_OLLAMA === "1";
  if (!allowStart) {
    return unavailable(
      first.error ?? "PROVIDER_UNAVAILABLE: Ollama is installed but not running (set KWIZERA_START_OLLAMA=1 to auto-start)",
      binary,
    );
  }

  const started = await spawnServe(binary);
  if (!started.ok) {
    return unavailable(
      `PROVIDER_UNAVAILABLE: failed to spawn Ollama (${started.error})`,
      binary,
      "MODEL_RUNTIME_UNAVAILABLE",
    );
  }

  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    const probe = await probeOllama(800);
    if (probe.available) {
      return { ...probe, startedByStudio: true, binaryPath: binary };
    }
  }

  const last = await probeOllama();
  return unavailable(
    last.error ?? "RUNTIME_UNAVAILABLE: Ollama did not become ready after serve start",
    binary,
    "RUNTIME_UNAVAILABLE",
  );
}

/** Rough free-RAM gate before attempting to load a multi-GB GGUF model. */
export function assertInferenceMemoryAvailable(minimumFreeMb = 1_500): { ok: boolean; freeMb: number; totalMb: number; error?: string } {
  const totalMb = Math.round(os.totalmem() / 1024 / 1024);
  const freeMb = Math.round(os.freemem() / 1024 / 1024);
  if (freeMb < minimumFreeMb) {
    return {
      ok: false,
      freeMb,
      totalMb,
      error: `LOAD_FAILED: insufficient free RAM for local model load (${freeMb} MB free / ${totalMb} MB total; need ≥${minimumFreeMb} MB free)`,
    };
  }
  return { ok: true, freeMb, totalMb };
}

export function sanitizeProviderModelId(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return cleaned.length >= 3 ? cleaned : `ollama-${cleaned || "model"}`;
}

export function pickPreferredLanguageModel(names: string[]): string | null {
  const ranked = [
    /^qwen2\.5:3b$/i,
    /^llama3\.2:3b$/i,
    /^gemma3:4b$/i,
    /^qwen2\.5-coder:7b$/i,
    /^qwen/i,
    /^llama/i,
    /^gemma/i,
  ];
  for (const pattern of ranked) {
    const hit = names.find((name) => pattern.test(name));
    if (hit) return hit;
  }
  return names[0] ?? null;
}

export async function smokeOllamaGenerate(model: string, timeoutMs = 300_000): Promise<{ ok: boolean; output?: string; durationMs: number; error?: string; code?: string }> {
  const started = performance.now();
  const probe = await probeOllama(1_200);
  if (!probe.available) {
    return {
      ok: false,
      durationMs: Math.round(performance.now() - started),
      error: probe.error ?? "PROVIDER_UNAVAILABLE: Ollama is optional and is not running",
      code: probe.code,
    };
  }
  try {
    const response = await fetch(`${OLLAMA_ENDPOINT}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt: "Reply with exactly one word: READY",
        stream: false,
        options: { num_predict: 8, temperature: 0 },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      return { ok: false, durationMs: Math.round(performance.now() - started), error: `LOAD_FAILED: Ollama generate returned ${response.status}` };
    }
    const payload = await response.json() as { response?: string };
    if (!payload.response?.trim()) {
      return { ok: false, durationMs: Math.round(performance.now() - started), error: "LOAD_FAILED: Ollama returned empty response" };
    }
    return { ok: true, output: payload.response.trim(), durationMs: Math.round(performance.now() - started) };
  } catch (error) {
    return {
      ok: false,
      durationMs: Math.round(performance.now() - started),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
