/**
 * fal.ai HTTPS image-to-video adapter (Phase 4).
 * Queue submit → poll → download. Never logs credentials.
 * Uses native fetch only — no fal SDK dependency.
 */

import { randomUUID } from "node:crypto";
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
import type {
  CapabilityExecuteInput,
  ProviderHealthCode,
  ProviderHealthResult,
} from "./runtime-types.js";

const DEFAULT_FAL_QUEUE = "https://queue.fal.run";
const DEFAULT_FAL_REST = "https://rest.fal.ai";
const DEFAULT_MODEL = "fal-ai/wan/v2.2-a14b/image-to-video";
const POLL_INTERVAL_MS = 2_500;
const MAX_POLL_MS = 540_000;

function endpointHost(base: string): string {
  try {
    return new URL(base).host;
  } catch {
    return "queue.fal.run";
  }
}

function resolveQueueBase(provider: AdminProviderRecord): string {
  const raw = (provider.baseEndpoint ?? DEFAULT_FAL_QUEUE).trim().replace(/\/+$/, "");
  // Admin seed uses https://fal.run — normalize to queue API.
  if (!raw || raw === "https://fal.run" || raw === "https://fal.ai") return DEFAULT_FAL_QUEUE;
  if (raw.includes("fal.run") && !raw.includes("queue.")) {
    return DEFAULT_FAL_QUEUE;
  }
  return raw || DEFAULT_FAL_QUEUE;
}

function authHeader(secret: string): string {
  const trimmed = secret.trim();
  if (/^Key\s+/i.test(trimmed)) return trimmed;
  return `Key ${trimmed}`;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
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

function classifyHealthFromHttp(status: number): ProviderHealthCode {
  if (status >= 200 && status < 300) return "HEALTHY";
  if (status === 401 || status === 403) return "AUTHENTICATION_ERROR";
  if (status === 404) return "MODEL_ERROR";
  if (status === 429) return "PROVIDER_ERROR";
  if (status >= 500) return "PROVIDER_ERROR";
  return "PROVIDER_ERROR";
}

function healthStatusFromCode(code: ProviderHealthCode): HealthStatus {
  if (code === "HEALTHY") return "healthy";
  if (
    code === "AUTHENTICATION_ERROR"
    || code === "PROVIDER_ERROR"
    || code === "NETWORK_ERROR"
    || code === "TIMEOUT"
  ) {
    return "unhealthy";
  }
  if (code === "CREDENTIAL_MISSING" || code === "DISABLED" || code === "NOT_IMPLEMENTED") return "unknown";
  if (code === "CONFIGURED" || code === "UNCHECKED") return "unchecked";
  return "degraded";
}

function resolveModelPath(modelId: string): string {
  const id = (modelId || DEFAULT_MODEL).trim().replace(/^\/+/, "");
  return id || DEFAULT_MODEL;
}

function sanitizeMime(mimeType: string | undefined): string {
  const raw = (mimeType ?? "image/jpeg").trim().toLowerCase();
  if (raw === "image/png" || raw === "image/jpeg" || raw === "image/jpg" || raw === "image/webp") {
    return raw === "image/jpg" ? "image/jpeg" : raw;
  }
  return "image/jpeg";
}

function buildImageDataUri(input?: CapabilityExecuteInput): string | null {
  const image = input?.images?.[0];
  if (!image?.base64?.trim()) return null;
  if (image.base64.length > 8_000_000) return null;
  const mime = sanitizeMime(image.mimeType);
  return `data:${mime};base64,${image.base64.trim()}`;
}

function framesForDuration(durationSeconds: number | undefined): number {
  const seconds = Math.max(2, Math.min(10, Math.round(durationSeconds ?? 5)));
  // Wan defaults ~16 fps; 81 frames ≈ 5s. Keep odd frame counts as fal expects.
  const frames = Math.round(seconds * 16);
  const odd = frames % 2 === 0 ? frames + 1 : frames;
  return Math.max(17, Math.min(161, odd));
}

function extractVideoUrl(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  const video = root.video;
  if (video && typeof video === "object") {
    const url = (video as { url?: unknown }).url;
    if (typeof url === "string" && /^https?:\/\//i.test(url)) return url;
  }
  if (typeof root.video_url === "string" && /^https?:\/\//i.test(root.video_url)) return root.video_url;
  return null;
}

function extractFalError(parsed: unknown): string | undefined {
  if (!parsed || typeof parsed !== "object") return undefined;
  const detail = (parsed as { detail?: unknown }).detail;
  if (typeof detail === "string") return sanitizeRuntimeMessage(detail);
  if (Array.isArray(detail) && detail[0] && typeof detail[0] === "object") {
    const msg = (detail[0] as { msg?: unknown }).msg;
    if (typeof msg === "string") return sanitizeRuntimeMessage(msg);
  }
  const err = (parsed as { error?: unknown }).error;
  if (typeof err === "string") return sanitizeRuntimeMessage(err);
  return undefined;
}

export class FalImageToVideoAdapter implements ExecutableProviderAdapter {
  readonly id = "fal-i2v";

  supports(provider: AdminProviderRecord): boolean {
    return provider.type === "fal";
  }

  async healthCheck(request: {
    provider: AdminProviderRecord;
    getSecret?: () => string | undefined;
    timeoutMs?: number;
    requestId?: string;
  }): Promise<HealthStatus> {
    const result = await this.probeHealth(request);
    return result.healthStatus;
  }

  async probeHealth(request: {
    provider: AdminProviderRecord;
    getSecret?: () => string | undefined;
    timeoutMs?: number;
    requestId?: string;
  }): Promise<ProviderHealthResult> {
    const requestId = request.requestId ?? randomUUID();
    const started = Date.now();
    const provider = request.provider;
    const host = endpointHost(resolveQueueBase(provider));

    if (!provider.enabled || provider.status === "inactive" || provider.status === "deprecated") {
      return {
        providerId: provider.id,
        providerType: provider.type,
        adapterId: this.id,
        code: "DISABLED",
        healthStatus: "unknown",
        durationMs: Date.now() - started,
        requestId,
        detail: "Provider is disabled",
        endpointHost: host,
      };
    }

    const secret = request.getSecret?.()?.trim();
    if (!secret) {
      return {
        providerId: provider.id,
        providerType: provider.type,
        adapterId: this.id,
        code: "CREDENTIAL_MISSING",
        healthStatus: "unknown",
        durationMs: Date.now() - started,
        requestId,
        detail: "Provider credential is not configured",
        endpointHost: host,
      };
    }

    const timeoutMs = Math.min(30_000, Math.max(3_000, request.timeoutMs ?? 12_000));
    try {
      // Lightweight authenticated reachability check (not a billable I2V job).
      const response = await fetchWithTimeout(
        `${DEFAULT_FAL_REST}/platform/models?limit=1`,
        {
          method: "GET",
          headers: {
            Authorization: authHeader(secret),
            Accept: "application/json",
            "User-Agent": "KWIZERA-AI-STUDIO/phase4",
          },
        },
        timeoutMs,
      );
      const code = classifyHealthFromHttp(response.status);
      console.info("[KWIZERA][online-i2v]", JSON.stringify(safeLogMeta({
        event: "provider_health",
        requestId,
        providerId: provider.id,
        adapterId: this.id,
        endpointHost: "rest.fal.ai",
        httpStatus: response.status,
        code,
        durationMs: Date.now() - started,
      })));
      return {
        providerId: provider.id,
        providerType: provider.type,
        adapterId: this.id,
        code,
        healthStatus: healthStatusFromCode(code),
        durationMs: Date.now() - started,
        requestId,
        httpStatus: response.status,
        detail: code === "HEALTHY"
          ? "fal.ai platform reachable"
          : `fal.ai responded with HTTP ${response.status}`,
        endpointHost: "rest.fal.ai",
      };
    } catch (error) {
      const aborted = error instanceof Error && error.name === "AbortError";
      const code: ProviderHealthCode = aborted ? "TIMEOUT" : "NETWORK_ERROR";
      console.warn("[KWIZERA][online-i2v]", JSON.stringify(safeLogMeta({
        event: "provider_health_error",
        requestId,
        providerId: provider.id,
        adapterId: this.id,
        endpointHost: "rest.fal.ai",
        code,
        durationMs: Date.now() - started,
      })));
      return {
        providerId: provider.id,
        providerType: provider.type,
        adapterId: this.id,
        code,
        healthStatus: "unhealthy",
        durationMs: Date.now() - started,
        requestId,
        detail: aborted ? "Health check timed out" : "Network error contacting fal.ai",
        endpointHost: "rest.fal.ai",
      };
    }
  }

  async execute(request: ProviderAdapterExecuteRequest): Promise<{
    ok: boolean;
    outputText?: string;
    output?: unknown;
    httpStatus?: number;
    errorCode?: string;
    errorMessage?: string;
  }> {
    const provider = request.provider;
    const model = request.model;
    const secret = request.getSecret()?.trim();
    if (!secret) {
      throw new ProviderRuntimeError("CONFIGURATION_ERROR", "Provider credential is not configured");
    }

    const input = request.input;
    const mode = input?.mode ?? "image-to-video";
    if (mode !== "image-to-video" && mode !== "probe") {
      throw new ProviderRuntimeError(
        "INVALID_REQUEST",
        "fal I2V adapter supports mode image-to-video (or probe)",
      );
    }

    const queueBase = resolveQueueBase(provider);
    const modelPath = resolveModelPath(model.modelId);
    const timeoutMs = Math.min(
      MAX_POLL_MS,
      Math.max(15_000, request.timeoutMs ?? model.timeoutMs ?? 300_000),
    );

    if (mode === "probe") {
      // Cheap auth probe — does not enqueue a video job.
      const health = await this.probeHealth({
        provider,
        getSecret: request.getSecret,
        timeoutMs: Math.min(15_000, timeoutMs),
        requestId: request.requestId,
      });
      if (health.code === "HEALTHY") {
        return {
          ok: true,
          outputText: "OK",
          output: { probe: true, code: health.code },
          httpStatus: health.httpStatus ?? 200,
        };
      }
      if (health.code === "AUTHENTICATION_ERROR") {
        throw new ProviderRuntimeError("AUTHENTICATION_FAILED", "fal.ai authentication failed", {
          httpStatus: health.httpStatus,
        });
      }
      throw new ProviderRuntimeError(
        health.code === "TIMEOUT" ? "TIMEOUT" : "PROVIDER_UNAVAILABLE",
        health.detail ?? "fal.ai probe failed",
        { httpStatus: health.httpStatus, retryable: true },
      );
    }

    const imageUrl = buildImageDataUri(input);
    const prompt = input?.prompt?.trim();
    if (!imageUrl) {
      throw new ProviderRuntimeError("INVALID_REQUEST", "I2V requires a source image");
    }
    if (!prompt) {
      throw new ProviderRuntimeError("INVALID_REQUEST", "I2V requires a motion prompt");
    }

    const body: Record<string, unknown> = {
      image_url: imageUrl,
      prompt,
      num_frames: framesForDuration(input?.durationSeconds),
      frames_per_second: 16,
      resolution: input?.resolution?.trim() || "720p",
      aspect_ratio: input?.aspectRatio?.trim() || "auto",
      enable_prompt_expansion: false,
      enable_safety_checker: true,
    };
    if (input?.negativePrompt?.trim()) {
      body.negative_prompt = input.negativePrompt.trim().slice(0, 1_500);
    }
    if (typeof input?.seed === "number" && Number.isFinite(input.seed)) {
      body.seed = Math.floor(input.seed);
    }

    const started = Date.now();
    const submitUrl = `${queueBase}/${modelPath}`;
    try {
      const submitResponse = await fetchWithTimeout(
        submitUrl,
        {
          method: "POST",
          headers: {
            Authorization: authHeader(secret),
            "Content-Type": "application/json",
            Accept: "application/json",
            "User-Agent": "KWIZERA-AI-STUDIO/phase4",
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

      console.info("[KWIZERA][online-i2v]", JSON.stringify(safeLogMeta({
        event: "provider_i2v_submit",
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
        const code = mapHttpStatusToErrorCode(submitHttp);
        const upstream = extractFalError(submitParsed) ?? `fal.ai HTTP ${submitHttp}`;
        throw new ProviderRuntimeError(code, upstream, {
          httpStatus: submitHttp,
          retryable: submitHttp === 429 || submitHttp >= 500,
        });
      }

      const request_id = typeof (submitParsed as { request_id?: unknown })?.request_id === "string"
        ? (submitParsed as { request_id: string }).request_id
        : typeof (submitParsed as { requestId?: unknown })?.requestId === "string"
          ? (submitParsed as { requestId: string }).requestId
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
              "User-Agent": "KWIZERA-AI-STUDIO/phase4",
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
          const code = mapHttpStatusToErrorCode(lastHttp);
          throw new ProviderRuntimeError(
            code,
            extractFalError(statusParsed) ?? `fal.ai status HTTP ${lastHttp}`,
            { httpStatus: lastHttp, retryable: lastHttp === 429 || lastHttp >= 500 },
          );
        }

        const status = String(
          (statusParsed as { status?: unknown })?.status
            ?? (statusParsed as { detail?: unknown })?.detail
            ?? "",
        ).toUpperCase();

        if (status === "FAILED" || status === "ERROR" || status === "CANCELLED") {
          throw new ProviderRuntimeError(
            "PROVIDER_UNAVAILABLE",
            extractFalError(statusParsed) ?? `fal.ai job ${status.toLowerCase()}`,
            { httpStatus: lastHttp, retryable: false },
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
                "User-Agent": "KWIZERA-AI-STUDIO/phase4",
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
        throw new ProviderRuntimeError("TIMEOUT", "fal.ai image-to-video job timed out", {
          retryable: true,
        });
      }

      // Result payload may be { video: { url } } or nested under response/data.
      const payloadRoot = (terminalPayload as { response?: unknown; data?: unknown })?.response
        ?? (terminalPayload as { data?: unknown })?.data
        ?? terminalPayload;
      const videoUrl = extractVideoUrl(payloadRoot) ?? extractVideoUrl(terminalPayload);
      if (!videoUrl) {
        throw new ProviderRuntimeError("PROVIDER_UNAVAILABLE", "fal.ai result missing video URL");
      }

      let videoPath: string | undefined;
      const outputPath = input?.outputPath?.trim();
      if (outputPath) {
        const download = await fetchWithTimeout(
          videoUrl,
          {
            method: "GET",
            headers: { "User-Agent": "KWIZERA-AI-STUDIO/phase4" },
          },
          Math.min(120_000, timeoutMs - (Date.now() - started) || 60_000),
        );
        if (!download.ok) {
          throw new ProviderRuntimeError(
            "NETWORK_ERROR",
            `Failed to download generated video (HTTP ${download.status})`,
            { httpStatus: download.status, retryable: true },
          );
        }
        const bytes = Buffer.from(await download.arrayBuffer());
        if (bytes.length < 1_024) {
          throw new ProviderRuntimeError("PROVIDER_UNAVAILABLE", "Downloaded video is empty or corrupt");
        }
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, bytes);
        videoPath = outputPath;
      }

      console.info("[KWIZERA][online-i2v]", JSON.stringify(safeLogMeta({
        event: "provider_i2v_complete",
        requestId: request.requestId,
        providerId: provider.id,
        modelId: model.modelId,
        adapterId: this.id,
        endpointHost: endpointHost(queueBase),
        httpStatus: lastHttp,
        durationMs: Date.now() - started,
        ok: true,
        hasVideoPath: Boolean(videoPath),
      })));

      return {
        ok: true,
        outputText: "VIDEO_READY",
        output: {
          mimeType: "video/mp4",
          videoPath: videoPath ?? null,
          // Internal only — customer APIs must not forward provider URLs/job ids.
          providerJobId: request_id,
          durationSeconds: input?.durationSeconds ?? null,
          resolution: body.resolution,
        },
        httpStatus: lastHttp,
      };
    } catch (error) {
      if (error instanceof ProviderRuntimeError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new ProviderRuntimeError("TIMEOUT", "fal.ai request timed out", { retryable: true });
      }
      throw new ProviderRuntimeError(
        "NETWORK_ERROR",
        sanitizeRuntimeMessage(error instanceof Error ? error.message : "Network error"),
        { retryable: true },
      );
    }
  }
}
