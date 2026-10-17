/**
 * Phase 49A — Chart capture limits (client + server shared constants).
 */

/** Supported chart timeframes for capture (matches desktop CHART_TIMEFRAMES; no 2h). */
export const CAPTURE_TIMEFRAME_IDS = [
  "1m",
  "5m",
  "15m",
  "30m",
  "1h",
  "4h",
  "1d",
  "1w",
] as const;

export type CaptureTimeframeId = (typeof CAPTURE_TIMEFRAME_IDS)[number];

export function isCaptureTimeframeId(value: string): value is CaptureTimeframeId {
  return (CAPTURE_TIMEFRAME_IDS as readonly string[]).includes(value);
}

export const CHART_CAPTURE_SCHEMA_VERSION = "forex-chart-capture.v1";

/** PNG from lightweight-charts takeScreenshot — only image/png accepted. */
export const CAPTURE_ALLOWED_MIME = ["image/png"] as const;

export const CAPTURE_MAX_IMAGE_BYTES = 2_000_000;
export const CAPTURE_MAX_DIMENSION = 4096;
export const CAPTURE_MAX_STORED = 200;
export const CAPTURE_LIST_DEFAULT_LIMIT = 40;
export const CAPTURE_LIST_MAX_LIMIT = 100;

/** Scheduling (client-driven; browser must stay open). */
export const CAPTURE_MIN_INTERVAL_MS = 60_000;
export const CAPTURE_MAX_INTERVAL_MS = 60 * 60_000;
export const CAPTURE_INTERVAL_PRESETS_MS = [
  60_000,
  5 * 60_000,
  15 * 60_000,
  30 * 60_000,
] as const;
export const CAPTURE_MIN_DURATION_MS = 5 * 60_000;
export const CAPTURE_MAX_DURATION_MS = 24 * 60 * 60_000;
export const CAPTURE_MAX_PER_SESSION = 48;
export const CAPTURE_MAX_ACTIVE_SESSIONS = 1;

export const CAPTURE_REQUEST_BODY_MAX_BYTES = 2_800_000;
