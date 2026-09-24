/**
 * fal.ai HTTPS image operations (Phase 7): segmentation, mask-guided / instruction editing, enhancement.
 * Queue submit → poll → download. Never logs credentials or raw image bytes.
 */

import fs from "node:fs/promises";
import path from "node:path";
import type { ProviderAdapterExecuteRequest } from "./adapter-contracts.js";
import type { AdminProviderRecord } from "./types.js";
import {
  mapHttpStatusToErrorCode,
  ProviderRuntimeError,
  sanitizeRuntimeMessage,
  safeLogMeta,
} from "./runtime-errors.js";
import type { CapabilityExecuteImage, CapabilityExecuteInput } from "./runtime-types.js";

const DEFAULT_FAL_QUEUE = "https://queue.fal.run";
const POLL_INTERVAL_MS = 2_000;
const MAX_POLL_MS = 240_000;
const USER_AGENT = "KWIZERA-AI-STUDIO/phase7";

export type FalImageMode = "image-segmentation" | "image-editing" | "image-enhancement";

const DEFAULT_MODELS: Record<FalImageMode, string> = {
  "image-segmentation": "fal-ai/sam2/image",
  "image-editing": "fal-ai/flux-pro/v1/fill",
  "image-enhancement": "fal-ai/esrgan",
};

function resolveQueueBase(provider: AdminProviderRecord): string {
  const raw = (provider.baseEndpoint ?? DEFAULT_FAL_QUEUE).trim().replace(/\/+$/, "");
  if (!raw || raw === "https://fal.run" || raw === "https://fal.ai") return DEFAULT_FAL_QUEUE;
  if (raw.includes("fal.run") && !raw.includes("queue.")) return DEFAULT_FAL_QUEUE;
  return raw || DEFAULT_FAL_QUEUE;
}

function endpointHost(base: string): string {
  try {
    return new URL(base).host;
  } catch {
    return "queue.fal.run";
  }
}

function authHeader(secret: string): string {
  const trimmed = secret.trim();
  return /^Key\s+/i.test(trimmed) ? trimmed : `Key ${trimmed}`;
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

function sanitizeMime(mimeType: string | undefined): string {
  const raw = (mimeType ?? "image/png").trim().toLowerCase();
  if (raw === "image/jpg") return "image/jpeg";
  if (raw === "image/png" || raw === "image/jpeg" || raw === "image/webp") return raw;
  return "image/png";
}

function toDataUri(image: CapabilityExecuteImage | undefined): string | null {
  if (!image?.base64?.trim()) return null;
  if (image.base64.length > 12_000_000) return null;
  return `data:${sanitizeMime(image.mimeType)};base64,${image.base64.trim()}`;
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

/** Finds the first image URL in fal result payloads ({ image }, { images: [] }, { mask }). */
export function extractFalImageUrl(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  const candidates: unknown[] = [root.image, root.mask, root.output];
  if (Array.isArray(root.images)) candidates.push(root.images[0]);
  if (Array.isArray(root.masks)) candidates.push(root.masks[0]);
  for (const candidate of candidates) {
    if (typeof candidate === "string" && /^https?:\/\//i.test(candidate)) return candidate;
    if (candidate && typeof candidate === "object") {
      const url = (candidate as { url?: unknown }).url;
      if (typeof url === "string" && /^(https?:\/\/|data:image\/)/i.test(url)) return url;
    }
  }
  return null;
}

/** Builds the provider request body for a model family. Exported for tests. */
export function buildFalImageBody(
  mode: FalImageMode,
  modelPath: string,
  input: CapabilityExecuteInput,
): Record<string, unknown> {
  const imageUrl = toDataUri(input.images?.[0]);
  if (!imageUrl) throw new ProviderRuntimeError("INVALID_REQUEST", "Image operation requires a source image");

  if (mode === "image-segmentation") {
    const body: Record<string, unknown> = { image_url: imageUrl, output_format: "png" };
    if (input.targetPoint && Number.isFinite(input.targetPoint.x) && Number.isFinite(input.targetPoint.y)) {
      body.prompts = [{ x: Math.round(input.targetPoint.x), y: Math.round(input.targetPoint.y), label: 1 }];
    }
    return body;
  }

  if (mode === "image-enhancement") {
    const scale = input.upscaleFactor === 4 ? 4 : 2;
    return { image_url: imageUrl, scale, model: "RealESRGAN_x4plus" };
  }

  const prompt = input.prompt?.trim();
  if (!prompt) throw new ProviderRuntimeError("INVALID_REQUEST", "Image editing requires an edit prompt");
  const body: Record<string, unknown> = {
    image_url: imageUrl,
    prompt: prompt.slice(0, 2_000),
    num_images: 1,
    output_format: "jpeg",
    safety_tolerance: "2",
  };
  const maskUrl = toDataUri(input.maskImage);
  if (maskUrl && /fill|inpaint/i.test(modelPath)) body.mask_url = maskUrl;
  if (typeof input.seed === "number" && Number.isFinite(input.seed)) body.seed = Math.floor(input.seed);
  return body;
}

async function downloadImage(url: string, outputPath: string, timeoutMs: number): Promise<number> {
  let bytes: Buffer;
  if (url.startsWith("data:image/")) {
    const comma = url.indexOf(",");
    bytes = Buffer.from(url.slice(comma + 1), "base64");
  } else {
    const response = await fetchWithTimeout(url, { method: "GET", headers: { "User-Agent": USER_AGENT } }, timeoutMs);
    if (!response.ok) {
      throw new ProviderRuntimeError(
        "NETWORK_ERROR",
        `Failed to download generated image (HTTP ${response.status})`,
        { httpStatus: response.status, retryable: true },
      );
    }
    bytes = Buffer.from(await response.arrayBuffer());
  }
  if (bytes.length < 128) {
    throw new ProviderRuntimeError("PROVIDER_UNAVAILABLE", "Downloaded image is empty or corrupt");
  }
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, bytes);
  return bytes.length;
}

export async function executeFalImageOperation(
  request: ProviderAdapterExecuteRequest,
  adapterId: string,
): Promise<{ ok: boolean; outputText?: string; output?: unknown; httpStatus?: number }> {
  const provider = request.provider;
  const model = request.model;
  const input = request.input ?? {};
  const mode = input.mode as FalImageMode;
  const secret = request.getSecret()?.trim();
  if (!secret) {
    throw new ProviderRuntimeError("CONFIGURATION_ERROR", "Provider credential is not configured");
  }
  const outputPath = input.outputPath?.trim();
  if (!outputPath) {
    throw new ProviderRuntimeError("INVALID_REQUEST", "Image operation requires a server output path");
  }

  const queueBase = resolveQueueBase(provider);
  const modelPath = (model.modelId || DEFAULT_MODELS[mode]).trim().replace(/^\/+/, "") || DEFAULT_MODELS[mode];
  const body = buildFalImageBody(mode, modelPath, input);
  const timeoutMs = Math.min(MAX_POLL_MS, Math.max(15_000, request.timeoutMs ?? model.timeoutMs ?? 120_000));
  const headers = {
    Authorization: authHeader(secret),
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": USER_AGENT,
  };
  const started = Date.now();

  try {
    const submit = await fetchWithTimeout(
      `${queueBase}/${modelPath}`,
      { method: "POST", headers, body: JSON.stringify(body) },
      Math.min(60_000, timeoutMs),
    );
    const submitRaw = await submit.text();
    let submitParsed: unknown = null;
    try {
      submitParsed = submitRaw ? JSON.parse(submitRaw) : null;
    } catch {
      submitParsed = null;
    }
    console.info("[KWIZERA][online-image]", JSON.stringify(safeLogMeta({
      event: "provider_image_submit",
      mode,
      requestId: request.requestId,
      providerId: provider.id,
      modelId: model.modelId,
      adapterId,
      endpointHost: endpointHost(queueBase),
      httpStatus: submit.status,
      ok: submit.ok,
    })));
    if (!submit.ok) {
      throw new ProviderRuntimeError(
        mapHttpStatusToErrorCode(submit.status),
        extractFalError(submitParsed) ?? `Image provider HTTP ${submit.status}`,
        { httpStatus: submit.status, retryable: submit.status === 429 || submit.status >= 500 },
      );
    }
    const jobId = typeof (submitParsed as { request_id?: unknown })?.request_id === "string"
      ? (submitParsed as { request_id: string }).request_id
      : null;
    if (!jobId) throw new ProviderRuntimeError("PROVIDER_UNAVAILABLE", "Image provider did not return a request id");

    const statusUrl = `${queueBase}/${modelPath}/requests/${jobId}/status`;
    const resultUrl = `${queueBase}/${modelPath}/requests/${jobId}`;
    const pollHeaders = { Authorization: headers.Authorization, Accept: "application/json", "User-Agent": USER_AGENT };
    let lastHttp = submit.status;
    let terminal: unknown = null;

    while (Date.now() - started < timeoutMs) {
      await sleep(POLL_INTERVAL_MS);
      const statusResponse = await fetchWithTimeout(
        statusUrl,
        { method: "GET", headers: pollHeaders },
        Math.min(30_000, Math.max(1_000, timeoutMs - (Date.now() - started))),
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
          extractFalError(statusParsed) ?? `Image provider status HTTP ${lastHttp}`,
          { httpStatus: lastHttp, retryable: lastHttp === 429 || lastHttp >= 500 },
        );
      }
      const status = String((statusParsed as { status?: unknown })?.status ?? "").toUpperCase();
      if (status === "FAILED" || status === "ERROR" || status === "CANCELLED") {
        throw new ProviderRuntimeError(
          "PROVIDER_UNAVAILABLE",
          extractFalError(statusParsed) ?? `Image job ${status.toLowerCase()}`,
          { httpStatus: lastHttp },
        );
      }
      if (status === "COMPLETED" || status === "OK") {
        const resultResponse = await fetchWithTimeout(
          resultUrl,
          { method: "GET", headers: pollHeaders },
          Math.min(60_000, Math.max(1_000, timeoutMs - (Date.now() - started))),
        );
        lastHttp = resultResponse.status;
        const resultRaw = await resultResponse.text();
        try {
          terminal = resultRaw ? JSON.parse(resultRaw) : null;
        } catch {
          terminal = null;
        }
        if (!resultResponse.ok) {
          throw new ProviderRuntimeError(
            mapHttpStatusToErrorCode(lastHttp),
            extractFalError(terminal) ?? `Image provider result HTTP ${lastHttp}`,
            { httpStatus: lastHttp, retryable: lastHttp >= 500 },
          );
        }
        break;
      }
    }

    if (!terminal) throw new ProviderRuntimeError("TIMEOUT", "Image operation timed out", { retryable: true });

    const root = (terminal as { response?: unknown; data?: unknown })?.response
      ?? (terminal as { data?: unknown })?.data
      ?? terminal;
    const imageUrl = extractFalImageUrl(root) ?? extractFalImageUrl(terminal);
    if (!imageUrl) throw new ProviderRuntimeError("PROVIDER_UNAVAILABLE", "Image result missing output image");

    const sizeBytes = await downloadImage(
      imageUrl,
      outputPath,
      Math.min(120_000, Math.max(15_000, timeoutMs - (Date.now() - started))),
    );

    console.info("[KWIZERA][online-image]", JSON.stringify(safeLogMeta({
      event: "provider_image_complete",
      mode,
      requestId: request.requestId,
      providerId: provider.id,
      modelId: model.modelId,
      adapterId,
      httpStatus: lastHttp,
      durationMs: Date.now() - started,
      ok: true,
    })));

    return {
      ok: true,
      outputText: "IMAGE_READY",
      output: { imagePath: outputPath, sizeBytes, providerJobId: jobId },
      httpStatus: lastHttp,
    };
  } catch (error) {
    if (error instanceof ProviderRuntimeError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new ProviderRuntimeError("TIMEOUT", "Image operation request timed out", { retryable: true });
    }
    throw new ProviderRuntimeError(
      "NETWORK_ERROR",
      sanitizeRuntimeMessage(error instanceof Error ? error.message : "Network error"),
      { retryable: true },
    );
  }
}
