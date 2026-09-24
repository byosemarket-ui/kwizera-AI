/**
 * fal.ai unified HTTPS adapter (Phase 4 I2V + Phase 5 music).
 * Dispatches by CapabilityExecuteInput.mode. Never logs credentials.
 */

import fs from "node:fs/promises";
import path from "node:path";
import type { ExecutableProviderAdapter, ProviderAdapterExecuteRequest } from "./adapter-contracts.js";
import type { AdminProviderRecord, HealthStatus } from "./types.js";
import {
  mapHttpStatusToErrorCode,
  ProviderRuntimeError,
  sanitizeRuntimeMessage,
  safeLogMeta,
} from "./runtime-errors.js";
import type { ProviderHealthResult } from "./runtime-types.js";
import { FalImageToVideoAdapter } from "./fal-i2v-adapter.js";

const DEFAULT_FAL_QUEUE = "https://queue.fal.run";
const DEFAULT_MUSIC_MODEL = "fal-ai/stable-audio-25/text-to-audio";
const POLL_INTERVAL_MS = 2_000;
const MAX_POLL_MS = 180_000;

function endpointHost(base: string): string {
  try {
    return new URL(base).host;
  } catch {
    return "queue.fal.run";
  }
}

function resolveQueueBase(provider: AdminProviderRecord): string {
  const raw = (provider.baseEndpoint ?? DEFAULT_FAL_QUEUE).trim().replace(/\/+$/, "");
  if (!raw || raw === "https://fal.run" || raw === "https://fal.ai") return DEFAULT_FAL_QUEUE;
  if (raw.includes("fal.run") && !raw.includes("queue.")) return DEFAULT_FAL_QUEUE;
  return raw || DEFAULT_FAL_QUEUE;
}

function authHeader(secret: string): string {
  const trimmed = secret.trim();
  if (/^Key\s+/i.test(trimmed)) return trimmed;
  return `Key ${trimmed}`;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1_000, timeoutMs));
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveModelPath(modelId: string): string {
  return (modelId || DEFAULT_MUSIC_MODEL).trim().replace(/^\/+/, "") || DEFAULT_MUSIC_MODEL;
}

function extractAudioUrl(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  for (const key of ["audio_file", "audio", "audio_url"]) {
    const val = root[key];
    if (typeof val === "string" && /^https?:\/\//i.test(val)) return val;
    if (val && typeof val === "object") {
      const url = (val as { url?: unknown }).url;
      if (typeof url === "string" && /^https?:\/\//i.test(url)) return url;
    }
  }
  return null;
}

function extractFalError(parsed: unknown): string | undefined {
  if (!parsed || typeof parsed !== "object") return undefined;
  const detail = (parsed as { detail?: unknown }).detail;
  if (typeof detail === "string") return sanitizeRuntimeMessage(detail);
  const err = (parsed as { error?: unknown }).error;
  if (typeof err === "string") return sanitizeRuntimeMessage(err);
  return undefined;
}

/**
 * Unified fal EXTERNAL_API adapter: I2V + music + probe by CapabilityExecuteInput.mode.
 */
export class FalProviderAdapter implements ExecutableProviderAdapter {
  readonly id = "fal";
  private readonly i2v = new FalImageToVideoAdapter();

  supports(provider: AdminProviderRecord): boolean {
    return provider.type === "fal";
  }

  async healthCheck(request: {
    provider: AdminProviderRecord;
    getSecret?: () => string | undefined;
    timeoutMs?: number;
    requestId?: string;
  }): Promise<HealthStatus> {
    return this.i2v.healthCheck(request);
  }

  async probeHealth(request: {
    provider: AdminProviderRecord;
    getSecret?: () => string | undefined;
    timeoutMs?: number;
    requestId?: string;
  }): Promise<ProviderHealthResult> {
    return this.i2v.probeHealth(request);
  }

  async execute(request: ProviderAdapterExecuteRequest): Promise<{
    ok: boolean;
    outputText?: string;
    output?: unknown;
    httpStatus?: number;
    errorCode?: string;
    errorMessage?: string;
  }> {
    const mode = request.input?.mode ?? "image-to-video";
    if (mode === "image-to-video" || mode === "probe") {
      return this.i2v.execute(request);
    }
    if (mode !== "music-generation") {
      throw new ProviderRuntimeError(
        "INVALID_REQUEST",
        "fal adapter supports image-to-video, music-generation, or probe",
      );
    }
    return this.executeMusic(request);
  }

  private async executeMusic(request: ProviderAdapterExecuteRequest): Promise<{
    ok: boolean;
    outputText?: string;
    output?: unknown;
    httpStatus?: number;
  }> {
    const provider = request.provider;
    const model = request.model;
    const secret = request.getSecret()?.trim();
    if (!secret) {
      throw new ProviderRuntimeError("CONFIGURATION_ERROR", "Provider credential is not configured");
    }

    const input = request.input;
    const prompt = input?.prompt?.trim();
    if (!prompt) {
      throw new ProviderRuntimeError("INVALID_REQUEST", "Music generation requires a prompt");
    }

    const queueBase = resolveQueueBase(provider);
    const modelPath = resolveModelPath(model.modelId);
    const timeoutMs = Math.min(
      MAX_POLL_MS,
      Math.max(15_000, request.timeoutMs ?? model.timeoutMs ?? 120_000),
    );
    const seconds = Math.max(5, Math.min(47, Math.round(input?.durationSeconds ?? 15)));
    const body: Record<string, unknown> = {
      prompt: prompt.slice(0, 2_000),
      seconds,
    };

    const started = Date.now();
    try {
      const submitResponse = await fetchWithTimeout(
        `${queueBase}/${modelPath}`,
        {
          method: "POST",
          headers: {
            Authorization: authHeader(secret),
            "Content-Type": "application/json",
            Accept: "application/json",
            "User-Agent": "KWIZERA-AI-STUDIO/phase5",
          },
          body: JSON.stringify(body),
        },
        Math.min(60_000, timeoutMs),
      );
      const submitHttp = submitResponse.status;
      const submitRaw = await submitResponse.text();
      let submitParsed: unknown = null;
      try {
        submitParsed = submitRaw ? JSON.parse(submitRaw) : null;
      } catch {
        submitParsed = null;
      }

      console.info("[KWIZERA][online-music]", JSON.stringify(safeLogMeta({
        event: "provider_music_submit",
        requestId: request.requestId,
        providerId: provider.id,
        modelId: model.modelId,
        adapterId: this.id,
        endpointHost: endpointHost(queueBase),
        httpStatus: submitHttp,
        durationMs: Date.now() - started,
        ok: submitResponse.ok,
      })));

      if (!submitResponse.ok) {
        throw new ProviderRuntimeError(
          mapHttpStatusToErrorCode(submitHttp),
          extractFalError(submitParsed) ?? `fal.ai HTTP ${submitHttp}`,
          { httpStatus: submitHttp, retryable: submitHttp === 429 || submitHttp >= 500 },
        );
      }

      const request_id = typeof (submitParsed as { request_id?: unknown })?.request_id === "string"
        ? (submitParsed as { request_id: string }).request_id
        : null;
      if (!request_id) {
        throw new ProviderRuntimeError("PROVIDER_UNAVAILABLE", "fal.ai did not return a request_id");
      }

      const statusUrl = `${queueBase}/${modelPath}/requests/${request_id}/status`;
      const resultUrl = `${queueBase}/${modelPath}/requests/${request_id}`;
      let lastHttp = submitHttp;
      let terminalPayload: unknown = null;

      while (Date.now() - started < timeoutMs) {
        await sleep(POLL_INTERVAL_MS);
        const statusResponse = await fetchWithTimeout(
          statusUrl,
          {
            method: "GET",
            headers: {
              Authorization: authHeader(secret),
              Accept: "application/json",
              "User-Agent": "KWIZERA-AI-STUDIO/phase5",
            },
          },
          Math.min(30_000, timeoutMs - (Date.now() - started)),
        );
        lastHttp = statusResponse.status;
        const statusRaw = await statusResponse.text();
        let statusParsed: unknown = null;
        try {
          statusParsed = statusRaw ? JSON.parse(statusRaw) : null;
        } catch {
          statusParsed = null;
        }
        if (!statusResponse.ok) {
          throw new ProviderRuntimeError(
            mapHttpStatusToErrorCode(lastHttp),
            extractFalError(statusParsed) ?? `fal.ai status HTTP ${lastHttp}`,
            { httpStatus: lastHttp, retryable: lastHttp >= 500 },
          );
        }
        const status = String((statusParsed as { status?: unknown })?.status ?? "").toUpperCase();
        if (status === "FAILED" || status === "ERROR" || status === "CANCELLED") {
          throw new ProviderRuntimeError(
            "PROVIDER_UNAVAILABLE",
            extractFalError(statusParsed) ?? `fal.ai music job ${status.toLowerCase()}`,
            { httpStatus: lastHttp },
          );
        }
        if (status === "COMPLETED" || status === "OK") {
          const resultResponse = await fetchWithTimeout(
            resultUrl,
            {
              method: "GET",
              headers: {
                Authorization: authHeader(secret),
                Accept: "application/json",
                "User-Agent": "KWIZERA-AI-STUDIO/phase5",
              },
            },
            Math.min(60_000, timeoutMs - (Date.now() - started)),
          );
          lastHttp = resultResponse.status;
          const resultRaw = await resultResponse.text();
          try {
            terminalPayload = resultRaw ? JSON.parse(resultRaw) : null;
          } catch {
            terminalPayload = null;
          }
          if (!resultResponse.ok) {
            throw new ProviderRuntimeError(
              mapHttpStatusToErrorCode(lastHttp),
              extractFalError(terminalPayload) ?? `fal.ai result HTTP ${lastHttp}`,
              { httpStatus: lastHttp, retryable: lastHttp >= 500 },
            );
          }
          break;
        }
      }

      if (!terminalPayload) {
        throw new ProviderRuntimeError("TIMEOUT", "fal.ai music generation timed out", { retryable: true });
      }

      const payloadRoot = (terminalPayload as { response?: unknown; data?: unknown })?.response
        ?? (terminalPayload as { data?: unknown })?.data
        ?? terminalPayload;
      const audioUrl = extractAudioUrl(payloadRoot) ?? extractAudioUrl(terminalPayload);
      if (!audioUrl) {
        throw new ProviderRuntimeError("PROVIDER_UNAVAILABLE", "fal.ai result missing audio URL");
      }

      let audioPath: string | undefined;
      const outputPath = input?.outputPath?.trim();
      if (outputPath) {
        const download = await fetchWithTimeout(
          audioUrl,
          { method: "GET", headers: { "User-Agent": "KWIZERA-AI-STUDIO/phase5" } },
          Math.min(120_000, Math.max(15_000, timeoutMs - (Date.now() - started))),
        );
        if (!download.ok) {
          throw new ProviderRuntimeError(
            "NETWORK_ERROR",
            `Failed to download generated audio (HTTP ${download.status})`,
            { httpStatus: download.status, retryable: true },
          );
        }
        const bytes = Buffer.from(await download.arrayBuffer());
        if (bytes.length < 256) {
          throw new ProviderRuntimeError("PROVIDER_UNAVAILABLE", "Downloaded audio is empty or corrupt");
        }
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, bytes);
        audioPath = outputPath;
      }

      console.info("[KWIZERA][online-music]", JSON.stringify(safeLogMeta({
        event: "provider_music_complete",
        requestId: request.requestId,
        providerId: provider.id,
        modelId: model.modelId,
        adapterId: this.id,
        endpointHost: endpointHost(queueBase),
        httpStatus: lastHttp,
        durationMs: Date.now() - started,
        ok: true,
        hasAudioPath: Boolean(audioPath),
      })));

      return {
        ok: true,
        outputText: "AUDIO_READY",
        output: {
          mimeType: "audio/mpeg",
          audioPath: audioPath ?? null,
          providerJobId: request_id,
          durationSeconds: seconds,
        },
        httpStatus: lastHttp,
      };
    } catch (error) {
      if (error instanceof ProviderRuntimeError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new ProviderRuntimeError("TIMEOUT", "fal.ai music request timed out", { retryable: true });
      }
      throw new ProviderRuntimeError(
        "NETWORK_ERROR",
        sanitizeRuntimeMessage(error instanceof Error ? error.message : "Network error"),
        { retryable: true },
      );
    }
  }
}
