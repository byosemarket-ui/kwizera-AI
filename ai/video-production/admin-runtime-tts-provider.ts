/**
 * Admin-routed TTS — TEXT_TO_SPEECH via CapabilityRuntime.
 * Never reads provider secrets; never calls OpenAI directly.
 */

import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import type { CapabilityRuntime } from "../admin-control-plane/capability-runtime.js";

export type CapabilityRuntimeFactory = () => CapabilityRuntime | null;

export interface TtsGenerateRequest {
  projectId: string;
  script: string;
  language?: string;
  voiceStyle?: string;
  /** Optional server path for output MP3. */
  outputPath?: string;
}

export interface TtsGenerateResult {
  ok: boolean;
  audioPath?: string;
  mimeType?: string;
  error?: string;
  errorCode?: string;
}

export class AdminRuntimeTtsProvider {
  readonly id = "admin-runtime-tts";

  constructor(private readonly getRuntime: CapabilityRuntimeFactory) {}

  async isAvailable(): Promise<boolean> {
    const runtime = this.getRuntime();
    if (!runtime) return false;
    const view = runtime.describe("TEXT_TO_SPEECH");
    return view.source === "ONLINE" && (view.status === "READY" || view.status === "FALLBACK");
  }

  async generate(request: TtsGenerateRequest): Promise<TtsGenerateResult> {
    const runtime = this.getRuntime();
    if (!runtime) {
      return { ok: false, error: "Admin capability runtime is not available", errorCode: "CONFIGURATION_ERROR" };
    }
    const view = runtime.describe("TEXT_TO_SPEECH");
    if (view.source !== "ONLINE" || (view.status !== "READY" && view.status !== "FALLBACK")) {
      return {
        ok: false,
        error: view.reason ?? "TEXT_TO_SPEECH is not mapped to an online executable provider",
        errorCode: "CONFIGURATION_ERROR",
      };
    }

    const script = request.script.trim();
    if (!script) {
      return { ok: false, error: "Voice script is empty", errorCode: "INVALID_REQUEST" };
    }

    const outputPath = request.outputPath?.trim()
      || path.join(await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-tts-")), `${randomUUID()}.mp3`);

    const result = await runtime.execute("TEXT_TO_SPEECH", {
      mode: "tts",
      prompt: script.slice(0, 3_500),
      voice: mapVoiceStyle(request.voiceStyle),
      outputPath,
      projectId: request.projectId,
      timeoutMs: Math.min(90_000, Math.max(10_000, view.timeoutMs ?? 45_000)),
    });

    if (!result.ok) {
      return {
        ok: false,
        error: result.errorMessage ?? `TTS failed (${result.errorCode ?? "UNKNOWN"})`,
        errorCode: result.errorCode,
      };
    }

    const output = (result.output && typeof result.output === "object")
      ? result.output as { audioPath?: unknown }
      : null;
    const written = typeof output?.audioPath === "string" && output.audioPath.trim()
      ? output.audioPath.trim()
      : outputPath;
    const stat = await fs.stat(written).catch(() => null);
    if (!stat?.isFile() || stat.size < 128) {
      return { ok: false, error: "Generated voice file is missing or corrupt", errorCode: "VALIDATION_FAILED" };
    }

    return { ok: true, audioPath: written, mimeType: "audio/mpeg" };
  }
}

function mapVoiceStyle(style?: string): string {
  const s = (style ?? "").toLowerCase();
  if (/warm|soft|calm/.test(s)) return "nova";
  if (/energetic|bold|strong/.test(s)) return "onyx";
  if (/premium|luxury|formal/.test(s)) return "fable";
  return "alloy";
}

/** Build a safe voice script from creative-plan narrations + known CTA only. */
export function buildVoiceScriptFromPlan(input: {
  scenes?: Array<{ narration?: string | null; purpose?: string | null }>;
  callToAction?: string | null;
  productName?: string | null;
}): string {
  const lines: string[] = [];
  for (const scene of input.scenes ?? []) {
    const n = typeof scene.narration === "string" ? scene.narration.trim() : "";
    if (n) lines.push(n);
  }
  const cta = typeof input.callToAction === "string" ? input.callToAction.trim() : "";
  if (cta && !lines.some((l) => l.toLowerCase().includes(cta.toLowerCase()))) {
    lines.push(cta);
  }
  // Never invent product facts — if no narration, stay empty (caller skips TTS).
  return lines.join(" ").replace(/\s+/g, " ").trim().slice(0, 3_500);
}

let activeTts: AdminRuntimeTtsProvider | null = null;

export function setAdminRuntimeTtsProvider(provider: AdminRuntimeTtsProvider | null): void {
  activeTts = provider;
}

export function getAdminRuntimeTtsProvider(): AdminRuntimeTtsProvider | null {
  return activeTts;
}
