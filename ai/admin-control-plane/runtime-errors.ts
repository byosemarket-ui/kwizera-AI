/**
 * Normalized provider/runtime errors — never embed secrets or auth headers.
 */

import type { NormalizedProviderErrorCode } from "./runtime-types.js";

const SENSITIVE = /api[_-]?key|authorization|bearer\s|sk-[a-z0-9]|password|secret|credential|token[=:\s]/i;

export class ProviderRuntimeError extends Error {
  readonly code: NormalizedProviderErrorCode;
  readonly httpStatus?: number;
  readonly retryable: boolean;

  constructor(
    code: NormalizedProviderErrorCode,
    message: string,
    opts?: { httpStatus?: number; retryable?: boolean },
  ) {
    super(sanitizeRuntimeMessage(message));
    this.name = "ProviderRuntimeError";
    this.code = code;
    this.httpStatus = opts?.httpStatus;
    this.retryable = opts?.retryable ?? false;
  }
}

export function sanitizeRuntimeMessage(message: string): string {
  const text = String(message ?? "").trim() || "Provider request failed";
  if (SENSITIVE.test(text)) {
    return "Provider request failed (sensitive details redacted)";
  }
  // Truncate extremely long upstream bodies.
  return text.length > 400 ? `${text.slice(0, 400)}…` : text;
}

export function mapHttpStatusToErrorCode(status: number): NormalizedProviderErrorCode {
  if (status === 401 || status === 403) return "AUTHENTICATION_FAILED";
  if (status === 404) return "MODEL_UNAVAILABLE";
  if (status === 408 || status === 504) return "TIMEOUT";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 500) return "PROVIDER_UNAVAILABLE";
  if (status >= 400) return "INVALID_REQUEST";
  return "UNKNOWN";
}

export function safeLogMeta(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (/secret|token|authorization|apiKey|api_key|password|credential/i.test(key)) continue;
    if (typeof value === "string" && SENSITIVE.test(value)) {
      out[key] = "[redacted]";
      continue;
    }
    out[key] = value;
  }
  return out;
}
