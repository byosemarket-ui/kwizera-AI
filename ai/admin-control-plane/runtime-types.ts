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
  /**
   * Optional images for vision-capable models (Admin-routed VISION_ANALYSIS).
   * Adapters attach these server-side; never logged as raw bytes.
   */
  images?: CapabilityExecuteImage[];
  /** Hint for adapters: probe uses tiny max_tokens; vision uses structured analysis. */
  mode?: "probe" | "vision" | "chat";
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
}
