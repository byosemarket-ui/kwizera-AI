/**
 * Local Ollama discovery + process ensure for KWIZERA AI STUDIO.
 * Uses the installed Ollama runtime only — never fabricates models or responses.
 */

import { spawn } from "node:child_process";
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
};

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
    "ollama",
  ].filter((value): value is string => Boolean(value));
}

export function findOllamaBinary(): string | null {
  for (const candidate of candidateBinaries()) {
    if (candidate === "ollama") return candidate;
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

export async function probeOllama(timeoutMs = 2_500): Promise<OllamaProbeResult> {
  const binaryPath = findOllamaBinary() ?? undefined;
  try {
    const response = await fetch(`${OLLAMA_ENDPOINT}/api/tags`, { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) {
      return { available: false, endpoint: OLLAMA_ENDPOINT, models: [], error: `Ollama tags returned ${response.status}`, binaryPath };
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
    return { available: true, endpoint: OLLAMA_ENDPOINT, models, binaryPath };
  } catch (error) {
    return {
      available: false,
      endpoint: OLLAMA_ENDPOINT,
      models: [],
      error: error instanceof Error ? error.message : String(error),
      binaryPath,
    };
  }
}

/**
 * If Ollama is installed but not answering, start `ollama serve` detached.
 * Does not download models.
 */
export async function ensureOllamaRunning(options?: { waitMs?: number }): Promise<OllamaProbeResult> {
  const waitMs = options?.waitMs ?? 45_000;
  const first = await probeOllama();
  if (first.available) return first;

  const binary = first.binaryPath ?? findOllamaBinary();
  if (!binary) {
    return { ...first, error: first.error ?? "MODEL_RUNTIME_UNAVAILABLE: Ollama binary not found" };
  }

  try {
    const child = spawn(binary, ["serve"], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
      shell: false,
    });
    child.unref();
  } catch (error) {
    return {
      available: false,
      endpoint: OLLAMA_ENDPOINT,
      models: [],
      binaryPath: binary,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    const probe = await probeOllama(2_000);
    if (probe.available) {
      return { ...probe, startedByStudio: true, binaryPath: binary };
    }
  }

  const last = await probeOllama();
  return {
    ...last,
    binaryPath: binary,
    error: last.error ?? "RUNTIME_UNAVAILABLE: Ollama did not become ready after serve start",
  };
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

export async function smokeOllamaGenerate(model: string, timeoutMs = 300_000): Promise<{ ok: boolean; output?: string; durationMs: number; error?: string }> {
  const started = performance.now();
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
