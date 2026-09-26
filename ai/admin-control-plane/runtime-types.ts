/**
 * Shared runtime types for Admin → credential → provider → online API execution.
 * Secrets never appear in these public-safe result shapes.
 */

import type { FeatureKey, HealthStatus } from "./types.js";

/** Internal execution source — not for customer marketing copy. */
export type RuntimeExecutionSource = "ONLINE" | "LOCAL" | "DETERMINISTIC" | "FALLBACK" | "UNAVAILABLE";

export type ProviderHealthCode =
  | "HEALTHY"
  | "CONFIGURED"
  | "CREDENTIAL_MISSING"
  | "DISABLED"
  | "NETWORK_ERROR"
  | "AUTHENTICATION_ERROR"
  | "PROVIDER_ERROR"
  | "MODEL_ERROR"
  | "TIMEOUT"
  | "NOT_IMPLEMENTED"
  | "UNCHECKED";

export type NormalizedProviderErrorCode =
  | "AUTHENTICATION_FAILED"
  | "PROVIDER_UNAVAILABLE"
  | "RATE_LIMITED"
  | "MODEL_UNAVAILABLE"
  | "INVALID_REQUEST"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "CONFIGURATION_ERROR"
  | "NOT_IMPLEMENTED"
  | "UNKNOWN";

/** OpenAI-compatible multimodal content parts (vision). */
export type RuntimeChatContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: "low" | "high" | "auto" } };

export interface RuntimeChatMessage {
  role: "system" | "user" | "assistant";
  content: string | RuntimeChatContentPart[];
}

export interface CapabilityExecuteImage {
  /** MIME type, e.g. image/jpeg */
  mimeType: string;
  /** Raw base64 without data-URL prefix */
  base64: string;
}

export interface CapabilityExecuteInput {
  /** Lightweight chat probe / LLM messages. */
  messages?: RuntimeChatMessage[];
  prompt?: string;
  /** Negative prompt for I2V providers that support it. */
  negativePrompt?: string;
  /**
   * Optional images for vision-capable models (Admin-routed VISION_ANALYSIS)
   * or image-to-video source frames (VIDEO_IMAGE_TO_VIDEO).
   * Adapters attach these server-side; never logged as raw bytes.
   */
  images?: CapabilityExecuteImage[];
  /**
   * Hint for adapters:
   * probe — connectivity; vision — structured analysis; chat — creative JSON;
   * image-to-video — async I2V; music-generation — instrumental bed;
   * tts — text-to-speech audio.
   */
  mode?:
    | "probe"
    | "vision"
    | "chat"
    | "image-to-video"
    | "music-generation"
    | "tts"
    | "image-segmentation"
    | "image-editing"
    | "image-enhancement";
  /** Editable-region mask for mask-guided image editing (white = editable). */
  maskImage?: CapabilityExecuteImage;
  /** Target point (pixels) identifying the product for segmentation. */
  targetPoint?: { x: number; y: number };
  /** Upscale factor for enhancement (2 or 4). */
  upscaleFactor?: number;
  /** Target clip duration for I2V / music (seconds). */
  durationSeconds?: number;
  aspectRatio?: string;
  resolution?: string;
  motionHint?: string;
  cameraHint?: string;
  seed?: number;
  /** TTS voice id when provider supports named voices (e.g. OpenAI alloy). */
  voice?: string;
  /** TTS speaking rate if supported (provider-specific, optional). */
  speakingRate?: number;
  /** Server-local path where the adapter should write the downloaded media. */
  outputPath?: string;
  sceneId?: string;
  sourceAssetId?: string;
  /** Optional correlation id for logs. */
  requestId?: string;
  /** Override timeout (ms); otherwise model/provider default. */
  timeoutMs?: number;
  projectId?: string;
  customerId?: string;
}

export interface CapabilityExecuteResult {
  ok: boolean;
  feature: FeatureKey;
  source: RuntimeExecutionSource;
  providerId: string | null;
  providerType: string | null;
  modelRecordId: string | null;
  modelId: string | null;
  modelName: string | null;
  adapterId: string | null;
  requestId: string;
  durationMs: number;
  timeoutMs: number;
  /** Safe normalized payload (never includes secrets). */
  outputText?: string | null;
  output?: unknown;
  errorCode?: NormalizedProviderErrorCode;
  errorMessage?: string;
  httpStatus?: number;
  resolutionStatus?: string;
  resolutionSource?: string;
}

export interface ProviderHealthResult {
  providerId: string;
  providerType: string;
  adapterId: string | null;
  code: ProviderHealthCode;
  /** Maps onto registry HealthStatus where applicable. */
  healthStatus: HealthStatus;
  durationMs: number;
  requestId: string;
  httpStatus?: number;
  detail?: string;
  /** External host contacted (hostname only — never credentials). */
  endpointHost?: string;
}

/** Executable readiness of a feature — states only, never provider/model identifiers or secrets. */
export interface CapabilityExecutionReadiness {
  feature: FeatureKey;
  state: "READY" | "NOT_CONFIGURED" | "DISABLED" | "NOT_IMPLEMENTED" | "CREDENTIAL_MISSING" | "AUTH_FAILED" | "PROVIDER_ERROR" | "UNVERIFIED";
  executable: boolean;
}

export interface SafeRuntimeExecutionView {
  feature: FeatureKey;
  status: string;
  providerId: string | null;
  providerType: string | null;
  modelId: string | null;
  modelName: string | null;
  adapterId: string | null;
  timeoutMs: number;
  source: RuntimeExecutionSource;
  fallbackAvailable: boolean;
  reason?: string;
  /** Selected model consumes an editable-region mask (model metadata, never secrets). */
  acceptsMask?: boolean;
}
