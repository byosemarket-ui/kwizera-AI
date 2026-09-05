/**
 * Canonical Ollama adapter — single integration surface for KWIZERA AI Core consumers.
 * Wraps ollama-client; does not install models or expose public HTTP.
 */
import {
  fetchOllamaTags,
  isOllamaDisabled,
  ollamaBaseUrl,
  ollamaGenerateJson,
  ollamaTimeoutMs,
  parseJsonObject,
  preferredReasoningModelId,
  selectPreferredReasoningModel,
  type OllamaModelInfo,
  type OllamaServiceStatus,
} from "./ollama-client.js";

export type OllamaHealthCode =
  | "OLLAMA_DISABLED"
  | "OLLAMA_UNAVAILABLE"
  | "OLLAMA_MODEL_MISSING"
  | "OLLAMA_TIMEOUT"
  | "OLLAMA_INFERENCE_ERROR"
  | "OLLAMA_INVALID_RESPONSE"
  | "OLLAMA_READY";

export interface OllamaHealthReport {
  code: OllamaHealthCode;
  ready: boolean;
  status: OllamaServiceStatus;
  baseUrl: string;
  model: string | null;
  installedModels: string[];
  latencyMs: number | null;
  probedInference: boolean;
  error?: string;
  notes: string[];
}

export interface StructuredGenerateResult {
  ok: boolean;
  code: OllamaHealthCode | "OK";
  model: string | null;
  latencyMs: number;
  data: Record<string, unknown> | null;
  rawText?: string;
  error?: string;
}

const PROBE_PROMPT = 'Return JSON only: {"ok":true,"ping":"kwizera"}';

export class OllamaAdapter {
  private baseUrl: string;
  private preferredModel: string;

  constructor(opts?: { baseUrl?: string; model?: string }) {
    this.baseUrl = ollamaBaseUrl(opts?.baseUrl);
    this.preferredModel = opts?.model ?? preferredReasoningModelId();
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  getPreferredModel(): string {
    return this.preferredModel;
  }

  async listModels(): Promise<OllamaModelInfo[]> {
    const tags = await fetchOllamaTags({ baseUrl: this.baseUrl });
    return tags.models;
  }

  resolveModel(installed: OllamaModelInfo[]): string | null {
    return selectPreferredReasoningModel(installed, this.preferredModel);
  }

  /**
   * Real readiness: tags + optional tiny inference (not port-open alone).
   */
  async health(opts?: { probeInference?: boolean }): Promise<OllamaHealthReport> {
    const notes: string[] = [];
    const probeInference = opts?.probeInference !== false;

    if (isOllamaDisabled()) {
      return {
        code: "OLLAMA_DISABLED",
        ready: false,
        status: "DISABLED",
        baseUrl: this.baseUrl,
        model: null,
        installedModels: [],
        latencyMs: null,
        probedInference: false,
        notes: ["Ollama disabled via environment."],
      };
    }

    const tags = await fetchOllamaTags({ baseUrl: this.baseUrl, timeoutMs: 5_000 });
    if (!tags.ok) {
      return {
        code: "OLLAMA_UNAVAILABLE",
        ready: false,
        status: tags.status,
        baseUrl: this.baseUrl,
        model: null,
        installedModels: [],
        latencyMs: null,
        probedInference: false,
        error: tags.error,
        notes: ["Ollama host unreachable."],
      };
    }

    const installedModels = tags.models.map((m) => m.name);
    const model = this.resolveModel(tags.models);
    if (!model) {
      return {
        code: "OLLAMA_MODEL_MISSING",
        ready: false,
        status: tags.status,
        baseUrl: this.baseUrl,
        model: null,
        installedModels,
        latencyMs: null,
        probedInference: false,
        notes: [`No suitable reasoning model. Preferred: ${this.preferredModel}`],
      };
    }

    if (!probeInference) {
      notes.push("Tags OK; inference probe skipped.");
      return {
        code: "OLLAMA_READY",
        ready: true,
        status: "READY",
        baseUrl: this.baseUrl,
        model,
        installedModels,
        latencyMs: null,
        probedInference: false,
        notes,
      };
    }

    const started = Date.now();
    const generated = await ollamaGenerateJson({
      baseUrl: this.baseUrl,
      model,
      prompt: PROBE_PROMPT,
      timeoutMs: Math.min(ollamaTimeoutMs(), 45_000),
      options: { temperature: 0, num_ctx: 256, num_predict: 32 },
    });
    const latencyMs = Date.now() - started;

    if (!generated.ok) {
      const code: OllamaHealthCode = generated.code === "MODEL_TIMEOUT"
        ? "OLLAMA_TIMEOUT"
        : generated.code === "MODEL_NOT_FOUND"
          ? "OLLAMA_MODEL_MISSING"
          : "OLLAMA_INFERENCE_ERROR";
      return {
        code,
        ready: false,
        status: "ERROR",
        baseUrl: this.baseUrl,
        model,
        installedModels,
        latencyMs,
        probedInference: true,
        error: generated.error,
        notes: ["Tags OK but inference probe failed."],
      };
    }

    const parsed = parseJsonObject(generated.text);
    if (!parsed || parsed.ok !== true) {
      return {
        code: "OLLAMA_INVALID_RESPONSE",
        ready: false,
        status: "ERROR",
        baseUrl: this.baseUrl,
        model,
        installedModels,
        latencyMs,
        probedInference: true,
        error: "Probe response was not valid JSON with ok:true",
        notes: ["Model responded but structured probe failed."],
      };
    }

    notes.push("Tags + structured inference probe succeeded.");
    return {
      code: "OLLAMA_READY",
      ready: true,
      status: "READY",
      baseUrl: this.baseUrl,
      model,
      installedModels,
      latencyMs,
      probedInference: true,
      notes,
    };
  }

  async generateStructured(opts: {
    prompt: string;
    model?: string;
    timeoutMs?: number;
    options?: Record<string, number | string | boolean>;
  }): Promise<StructuredGenerateResult> {
    const started = Date.now();
    if (isOllamaDisabled()) {
      return {
        ok: false,
        code: "OLLAMA_DISABLED",
        model: null,
        latencyMs: 0,
        data: null,
        error: "Ollama disabled",
      };
    }

    const tags = await fetchOllamaTags({ baseUrl: this.baseUrl });
    if (!tags.ok) {
      return {
        ok: false,
        code: "OLLAMA_UNAVAILABLE",
        model: null,
        latencyMs: Date.now() - started,
        data: null,
        error: tags.error,
      };
    }

    const model = opts.model ?? this.resolveModel(tags.models);
    if (!model) {
      return {
        ok: false,
        code: "OLLAMA_MODEL_MISSING",
        model: null,
        latencyMs: Date.now() - started,
        data: null,
        error: "No suitable reasoning model installed",
      };
    }

    const generated = await ollamaGenerateJson({
      baseUrl: this.baseUrl,
      model,
      prompt: opts.prompt,
      timeoutMs: opts.timeoutMs ?? ollamaTimeoutMs(),
      options: opts.options,
    });
    const latencyMs = Date.now() - started;
    if (!generated.ok) {
      const code: OllamaHealthCode = generated.code === "MODEL_TIMEOUT"
        ? "OLLAMA_TIMEOUT"
        : generated.code === "MODEL_NOT_FOUND"
          ? "OLLAMA_MODEL_MISSING"
          : "OLLAMA_INFERENCE_ERROR";
      return { ok: false, code, model, latencyMs, data: null, error: generated.error };
    }

    const data = parseJsonObject(generated.text);
    if (!data) {
      return {
        ok: false,
        code: "OLLAMA_INVALID_RESPONSE",
        model,
        latencyMs,
        data: null,
        rawText: generated.text.slice(0, 400),
        error: "Response was not valid JSON object",
      };
    }

    return { ok: true, code: "OK", model, latencyMs, data, rawText: generated.text };
  }
}

let singleton: OllamaAdapter | null = null;
let cachedHealth: { at: number; report: OllamaHealthReport; probed: boolean } | null = null;
const HEALTH_CACHE_MS = 60_000;

export function getOllamaAdapter(): OllamaAdapter {
  if (!singleton) singleton = new OllamaAdapter();
  return singleton;
}

export function resetOllamaAdapterForTests(): void {
  singleton = null;
  cachedHealth = null;
}

/** Resource-aware health: cache probes so UI polling does not thrash the 1-vCPU host. */
export async function getCachedOllamaHealth(opts?: {
  probeInference?: boolean;
  maxAgeMs?: number;
}): Promise<OllamaHealthReport> {
  const probeInference = opts?.probeInference !== false;
  const maxAge = opts?.maxAgeMs ?? HEALTH_CACHE_MS;
  if (
    cachedHealth
    && Date.now() - cachedHealth.at < maxAge
    && (!probeInference || cachedHealth.probed)
  ) {
    return cachedHealth.report;
  }
  const report = await getOllamaAdapter().health({ probeInference });
  cachedHealth = { at: Date.now(), report, probed: report.probedInference || !probeInference };
  return report;
}
