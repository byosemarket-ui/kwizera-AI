/**
 * Phase 49B — Multi-image OpenAI analysis limits.
 */

export const MULTI_IMAGE_ANALYSIS_SCHEMA = "forex-openai-multi-image-analysis-v1";

export const MULTI_IMAGE_MAX_CAPTURES = 6;
export const MULTI_IMAGE_MIN_CAPTURES = 1;
/** Per-image decode ceiling (matches chart-capture store). */
export const MULTI_IMAGE_MAX_BYTES_PER_IMAGE = 2_000_000;
/** Total decoded PNG bytes across the selection. */
export const MULTI_IMAGE_MAX_TOTAL_BYTES = 8_000_000;
export const MULTI_IMAGE_ALLOWED_MIME = ["image/png"] as const;

export const MULTI_IMAGE_DEFAULT_TIMEOUT_MS = 120_000;
export const MULTI_IMAGE_MIN_TIMEOUT_MS = 30_000;
export const MULTI_IMAGE_MAX_TIMEOUT_MS = 240_000;

export const MULTI_IMAGE_MAX_STORED = 80;
