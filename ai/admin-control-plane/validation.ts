export class AdminValidationError extends Error {
  readonly code: string;
  readonly details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = "AdminValidationError";
    this.code = code;
    this.details = details;
  }
}

export const ADMIN_ERROR_CODES = {
  UNKNOWN_PROVIDER: "UNKNOWN_PROVIDER",
  UNKNOWN_MODEL: "UNKNOWN_MODEL",
  PROVIDER_DISABLED: "PROVIDER_DISABLED",
  DUPLICATE_MODEL: "DUPLICATE_MODEL",
  DUPLICATE_PROVIDER: "DUPLICATE_PROVIDER",
  INVALID_TIMEOUT: "INVALID_TIMEOUT",
  INVALID_PRIORITY: "INVALID_PRIORITY",
  INVALID_COST: "INVALID_COST",
  INVALID_SETTING: "INVALID_SETTING",
  INVALID_CATEGORY: "INVALID_CATEGORY",
  REQUIRED_FIELD: "REQUIRED_FIELD",
  FEATURE_DISABLED: "FEATURE_DISABLED",
  CREDENTIAL_LOCKED: "CREDENTIAL_LOCKED",
  CREDENTIAL_REQUIRED: "CREDENTIAL_REQUIRED",
} as const;

export function requireNonEmpty(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new AdminValidationError(ADMIN_ERROR_CODES.REQUIRED_FIELD, `${field} is required`);
  return trimmed;
}

export function validateTimeoutMs(value: number): number {
  if (!Number.isFinite(value) || value <= 0 || value > 1_800_000) {
    throw new AdminValidationError(ADMIN_ERROR_CODES.INVALID_TIMEOUT, "timeoutMs must be between 1 and 1800000");
  }
  return value;
}

export function validatePriority(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 1000) {
    throw new AdminValidationError(ADMIN_ERROR_CODES.INVALID_PRIORITY, "priority must be between 0 and 1000");
  }
  return value;
}

export function validateOptionalCost(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isFinite(value) || value < 0) {
    throw new AdminValidationError(ADMIN_ERROR_CODES.INVALID_COST, "cost values must be finite and >= 0");
  }
  return value;
}

const MODEL_CATEGORIES = [
  "VISION", "IMAGE", "IMAGE_EDITING", "SEGMENTATION", "UPSCALE",
  "VIDEO", "AUDIO", "MUSIC", "TTS", "STT", "LLM", "EMBEDDING", "OTHER",
] as const;

export function validateModelCategory(value: string): (typeof MODEL_CATEGORIES)[number] {
  const category = value.trim().toUpperCase();
  if (!(MODEL_CATEGORIES as readonly string[]).includes(category)) {
    throw new AdminValidationError(ADMIN_ERROR_CODES.INVALID_CATEGORY, `Invalid model category: ${value}`);
  }
  return category as (typeof MODEL_CATEGORIES)[number];
}
