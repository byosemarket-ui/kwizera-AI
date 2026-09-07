/**
 * Controlled Ollama capability probes for production audit.
 * Serial, short prompts — never concurrent thrash on tiny VPS.
 */
import { getOllamaAdapter, type OllamaHealthReport } from "./ollama-adapter.js";
import { preferredVisionModelId } from "./ollama-client.js";

export type CapabilityVerdict =
  | "SUCCESS"
  | "PARTIAL"
  | "FAILED"
  | "MODEL_LIMITATION"
  | "RESOURCE_LIMITATION"
  | "INTEGRATION_FAILURE"
  | "UNSUPPORTED";

export interface CapabilityProbeResult {
  task: string;
  verdict: CapabilityVerdict;
  latencyMs: number;
  model: string | null;
  structuredOk: boolean;
  detail: string;
  data?: Record<string, unknown> | null;
  kwizeraCanConsume: boolean;
}

const SMALL_TIMEOUT = Math.min(45_000, Number(process.env.KWIZERA_OLLAMA_PROBE_TIMEOUT_MS) || 40_000);

async function runStructuredTask(
  task: string,
  prompt: string,
  validate: (data: Record<string, unknown>) => { ok: boolean; detail: string; consume: boolean },
  opts?: { timeoutMs?: number; numPredict?: number },
): Promise<CapabilityProbeResult> {
  const adapter = getOllamaAdapter();
  const generated = await adapter.generateStructured({
    prompt,
    timeoutMs: opts?.timeoutMs ?? SMALL_TIMEOUT,
    options: {
      temperature: 0.1,
      num_ctx: 1024,
      num_predict: opts?.numPredict ?? 120,
    },
  });

  if (!generated.ok || !generated.data) {
    const code = generated.code;
    let verdict: CapabilityVerdict = "FAILED";
    if (code === "OLLAMA_TIMEOUT") verdict = "RESOURCE_LIMITATION";
    else if (code === "OLLAMA_MODEL_MISSING" || code === "OLLAMA_DISABLED") verdict = "MODEL_LIMITATION";
    else if (code === "OLLAMA_UNAVAILABLE") verdict = "RESOURCE_LIMITATION";
    else if (code === "OLLAMA_INVALID_RESPONSE") verdict = "MODEL_LIMITATION";
    else verdict = "INTEGRATION_FAILURE";
    return {
      task,
      verdict,
      latencyMs: generated.latencyMs,
      model: generated.model,
      structuredOk: false,
      detail: generated.error ?? code,
      data: null,
      kwizeraCanConsume: false,
    };
  }

  const check = validate(generated.data);
  return {
    task,
    verdict: check.ok ? "SUCCESS" : "PARTIAL",
    latencyMs: generated.latencyMs,
    model: generated.model,
    structuredOk: check.ok,
    detail: check.detail,
    data: generated.data,
    kwizeraCanConsume: check.consume,
  };
}

export async function probeMinimalInference(): Promise<CapabilityProbeResult> {
  return runStructuredTask(
    "minimal_json",
    'Return exactly JSON: {"status":"ok"}',
    (data) => ({
      ok: data.status === "ok",
      detail: data.status === "ok" ? "status=ok" : `got=${JSON.stringify(data).slice(0, 80)}`,
      consume: data.status === "ok",
    }),
    { numPredict: 24 },
  );
}

export async function probeCapabilityMatrix(opts?: {
  includeHeavy?: boolean;
}): Promise<{
  health: OllamaHealthReport;
  multimodal: CapabilityProbeResult;
  results: CapabilityProbeResult[];
}> {
  const adapter = getOllamaAdapter();
  const health = await adapter.health({ probeInference: true });
  const results: CapabilityProbeResult[] = [];

  results.push(await probeMinimalInference());

  results.push(await runStructuredTask(
    "general_reasoning",
    'Return JSON: {"answer":"product videos need a clear hook","confidence":0.7}',
    (data) => ({
      ok: typeof data.answer === "string" && String(data.answer).length > 4,
      detail: String(data.answer ?? "").slice(0, 80),
      consume: typeof data.answer === "string",
    }),
  ));

  results.push(await runStructuredTask(
    "structured_json",
    'Return JSON: {"hook":"Show product first","cta":"Shop now","confidence":0.8}',
    (data) => ({
      ok: typeof data.hook === "string" && typeof data.cta === "string",
      detail: `hook=${Boolean(data.hook)} cta=${Boolean(data.cta)}`,
      consume: typeof data.hook === "string",
    }),
  ));

  results.push(await runStructuredTask(
    "product_marketing_reasoning",
    'Product: leather shoes. Return JSON: {"audience":"professionals","sellingPoint":"durable style","confidence":0.7}',
    (data) => ({
      ok: typeof data.audience === "string" && typeof data.sellingPoint === "string",
      detail: String(data.sellingPoint ?? "").slice(0, 60),
      consume: true,
    }),
  ));

  results.push(await runStructuredTask(
    "scene_sequencing",
    'Roles: HERO,DETAIL,PACKAGING. Return JSON: {"sequence":["HERO","DETAIL","PACKAGING"],"reason":"reveal then detail"}',
    (data) => ({
      ok: Array.isArray(data.sequence) && data.sequence.length >= 2,
      detail: JSON.stringify(data.sequence ?? []).slice(0, 80),
      consume: Array.isArray(data.sequence),
    }),
  ));

  results.push(await runStructuredTask(
    "camera_motion_transition",
    'Return JSON: {"camera":"slow push","motion":"LOW","transition":"cut","reason":"keep product readable"}',
    (data) => {
      const transition = String(data.transition ?? "").toLowerCase();
      const ok = (transition === "cut" || transition === "fade")
        && typeof data.camera === "string"
        && typeof data.motion === "string";
      return {
        ok,
        detail: `camera=${data.camera} motion=${data.motion} transition=${transition}`,
        consume: ok,
      };
    },
  ));

  results.push(await runStructuredTask(
    "beat_pacing_from_timeline",
    'AudioTimeline BPM=120 strongBeats=[2.0,4.0,6.0]. Return JSON: {"heroRevealSec":6.0,"pacing":"beat-aware","confidence":0.6}',
    (data) => ({
      ok: typeof data.heroRevealSec === "number" || typeof data.pacing === "string",
      detail: JSON.stringify({ heroRevealSec: data.heroRevealSec, pacing: data.pacing }).slice(0, 80),
      consume: true,
    }),
  ));

  results.push(await runStructuredTask(
    "cta_endcard",
    'Return JSON: {"ctaTiming":"final 3s","endCardDurationSec":2.5,"cta":"Shop now"}',
    (data) => ({
      ok: typeof data.cta === "string" || typeof data.endCardDurationSec === "number",
      detail: JSON.stringify(data).slice(0, 80),
      consume: true,
    }),
  ));

  if (opts?.includeHeavy) {
    results.push(await runStructuredTask(
      "video_structure_reasoning",
      'Return JSON: {"scenes":["HOOK","REVEAL","FEATURE","CTA"],"pacingStrategy":"tight-social","confidence":0.65}',
      (data) => ({
        ok: Array.isArray(data.scenes) && data.scenes.length >= 3,
        detail: JSON.stringify(data.scenes ?? []).slice(0, 80),
        consume: Array.isArray(data.scenes),
      }),
      { numPredict: 160 },
    ));
  }

  const models = await adapter.listModels();
  const visionPreferred = preferredVisionModelId();
  const hasVision = models.some((m) =>
    m.name === visionPreferred
    || /llava|vision|bakllava|minicpm-v/i.test(m.name),
  );
  const multimodal: CapabilityProbeResult = hasVision
    ? {
      task: "multimodal_visual_understanding",
      verdict: "PARTIAL",
      latencyMs: 0,
      model: models.find((m) => /llava|vision/i.test(m.name))?.name ?? null,
      structuredOk: false,
      detail: "Vision-capable model installed — visual path must be tested separately; do not claim pixel inspection without a vision call.",
      kwizeraCanConsume: false,
    }
    : {
      task: "multimodal_visual_understanding",
      verdict: "MODEL_LIMITATION",
      latencyMs: 0,
      model: health.model,
      structuredOk: false,
      detail: "Installed model is text-only (e.g. llama3.2:1b). Use Image Intelligence metadata + TEXT/STRUCTURED-CONTEXT REASONING only.",
      kwizeraCanConsume: false,
    };

  return { health, multimodal, results };
}
