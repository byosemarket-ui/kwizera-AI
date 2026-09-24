/**
 * Admin-routed music generation — MUSIC_GENERATION via CapabilityRuntime.
 * Implements MusicGenerationProvider for AiSoundManager.
 */

import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import type { CapabilityRuntime } from "../admin-control-plane/capability-runtime.js";
import type {
  MusicGenerationProvider,
} from "./provider.js";
import type {
  MusicGenerationRequest,
  MusicGenerationResult,
  MusicProviderHealth,
} from "./types.js";

export type CapabilityRuntimeFactory = () => CapabilityRuntime | null;

function buildMusicPrompt(request: MusicGenerationRequest): string {
  const spec = request.spec;
  const parts = [
    "Instrumental background music for a commercial product marketing video.",
    "No vocals. No lyrics. No spoken words.",
    `Genre: ${spec.genre}.`,
    `Mood: ${spec.mood}.`,
    `Energy: ${spec.energy}.`,
    `Tempo target: ${spec.tempoRange[0]}–${spec.tempoRange[1]} BPM.`,
    `Rhythm: ${spec.rhythm}.`,
    spec.instrumentation?.length ? `Instrumentation: ${spec.instrumentation.slice(0, 6).join(", ")}.` : null,
    spec.productCategory ? `Product category context: ${spec.productCategory}.` : null,
    spec.userNotes ? `Creative notes: ${String(spec.userNotes).slice(0, 200)}.` : null,
    `Duration about ${spec.durationSeconds} seconds.`,
  ];
  return parts.filter(Boolean).join(" ");
}

export class AdminRuntimeMusicGenerationProvider implements MusicGenerationProvider {
  readonly id = "admin-runtime-music";

  constructor(private readonly getRuntime: CapabilityRuntimeFactory) {}

  capabilities(): string[] {
    return ["admin-routed-music", "instrumental"];
  }

  async isAvailable(): Promise<boolean> {
    const runtime = this.getRuntime();
    if (!runtime) return false;
    const view = runtime.describe("MUSIC_GENERATION");
    return view.source === "ONLINE" && (view.status === "READY" || view.status === "FALLBACK");
  }

  async healthCheck(): Promise<MusicProviderHealth> {
    const runtime = this.getRuntime();
    if (!runtime) {
      return {
        providerId: this.id,
        status: "UNAVAILABLE",
        available: false,
        modelId: null,
        modelVersion: null,
        capabilities: [],
        reason: "Admin capability runtime is not available",
        checkedAt: new Date().toISOString(),
      };
    }
    const view = runtime.describe("MUSIC_GENERATION");
    const online = view.source === "ONLINE" && (view.status === "READY" || view.status === "FALLBACK");
    return {
      providerId: this.id,
      status: online ? "AVAILABLE" : "UNAVAILABLE",
      available: online,
      modelId: null,
      modelVersion: null,
      capabilities: this.capabilities(),
      reason: online
        ? "Admin-routed MUSIC_GENERATION is configured"
        : (view.reason ?? "MUSIC_GENERATION is not mapped to an online executable provider"),
      checkedAt: new Date().toISOString(),
    };
  }

  async generate(request: MusicGenerationRequest): Promise<MusicGenerationResult> {
    const runtime = this.getRuntime();
    if (!runtime) {
      throw Object.assign(new Error("MUSIC_GENERATION_UNAVAILABLE"), { code: "MUSIC_GENERATION_UNAVAILABLE" });
    }
    const view = runtime.describe("MUSIC_GENERATION");
    if (view.source !== "ONLINE" || (view.status !== "READY" && view.status !== "FALLBACK")) {
      throw Object.assign(new Error(view.reason ?? "MUSIC_GENERATION unavailable"), {
        code: "MUSIC_GENERATION_UNAVAILABLE",
      });
    }

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-music-"));
    const outputPath = path.join(tmpDir, `${randomUUID()}.mp3`);
    const result = await runtime.execute("MUSIC_GENERATION", {
      mode: "music-generation",
      prompt: buildMusicPrompt(request),
      durationSeconds: request.spec.durationSeconds,
      outputPath,
      projectId: request.projectId,
      timeoutMs: Math.min(180_000, Math.max(30_000, view.timeoutMs ?? 120_000)),
    });

    if (!result.ok) {
      throw Object.assign(
        new Error(result.errorMessage ?? `Music generation failed (${result.errorCode ?? "UNKNOWN"})`),
        { code: result.errorCode ?? "MUSIC_GENERATION_FAILED" },
      );
    }

    const output = (result.output && typeof result.output === "object")
      ? result.output as { audioPath?: unknown }
      : null;
    const written = typeof output?.audioPath === "string" && output.audioPath.trim()
      ? output.audioPath.trim()
      : outputPath;

    const stat = await fs.stat(written).catch(() => null);
    if (!stat?.isFile() || stat.size < 256) {
      throw Object.assign(new Error("Generated music file is missing or corrupt"), {
        code: "MUSIC_VALIDATION_FAILED",
      });
    }

    return {
      filePath: written,
      mimeType: "audio/mpeg",
      durationMs: Math.round((request.spec.durationSeconds || 15) * 1000),
      providerId: this.id,
      modelId: result.modelId ?? "admin-routed",
      modelVersion: null,
    };
  }
}
