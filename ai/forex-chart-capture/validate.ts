/**
 * Phase 49A — Capture metadata, image, and session validation.
 */
import {
  CAPTURE_ALLOWED_MIME,
  CAPTURE_MAX_DIMENSION,
  CAPTURE_MAX_DURATION_MS,
  CAPTURE_MAX_IMAGE_BYTES,
  CAPTURE_MAX_INTERVAL_MS,
  CAPTURE_MAX_PER_SESSION,
  CAPTURE_MIN_DURATION_MS,
  CAPTURE_MIN_INTERVAL_MS,
  isCaptureTimeframeId,
} from "./limits.js";
import type {
  ChartCaptureCandleWindow,
  ChartCaptureQuoteSnapshot,
  ChartCaptureSessionConfig,
  CreateCaptureInput,
  FeedHealthState,
} from "./types.js";

export { isCaptureTimeframeId } from "./limits.js";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const FEED_STATES: FeedHealthState[] = [
  "LIVE",
  "STALE",
  "NO_RECENT_MARKET_UPDATES",
  "MARKET_INACTIVE",
  "HISTORICAL",
  "CONNECTING",
  "RECONNECTING",
  "UNAVAILABLE",
  "UNKNOWN",
];

export function decodeCaptureImageBase64(raw: string): { ok: true; buffer: Buffer } | { ok: false; error: string } {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return { ok: false, error: "Image payload is empty." };
  const dataUrl = trimmed.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  const b64 = dataUrl ? dataUrl[2] : trimmed.replace(/\s+/g, "");
  let buffer: Buffer;
  try {
    buffer = Buffer.from(b64, "base64");
  } catch {
    return { ok: false, error: "Image payload is not valid base64." };
  }
  if (!buffer.length) return { ok: false, error: "Decoded image is empty." };
  if (buffer.length > CAPTURE_MAX_IMAGE_BYTES) {
    return { ok: false, error: `Image exceeds ${CAPTURE_MAX_IMAGE_BYTES} bytes.` };
  }
  if (buffer.length < 8 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return { ok: false, error: "Only PNG images are accepted (invalid signature)." };
  }
  return { ok: true, buffer };
}

export function validateImageMeta(input: {
  mimeType: string;
  width: number;
  height: number;
  byteLength: number;
}): { ok: true } | { ok: false; error: string } {
  if (!(CAPTURE_ALLOWED_MIME as readonly string[]).includes(input.mimeType)) {
    return { ok: false, error: `Unsupported MIME type: ${input.mimeType}` };
  }
  if (!Number.isFinite(input.width) || !Number.isFinite(input.height)
    || input.width < 8 || input.height < 8
    || input.width > CAPTURE_MAX_DIMENSION || input.height > CAPTURE_MAX_DIMENSION) {
    return { ok: false, error: "Image dimensions are out of allowed range." };
  }
  if (!Number.isFinite(input.byteLength) || input.byteLength <= 0
    || input.byteLength > CAPTURE_MAX_IMAGE_BYTES) {
    return { ok: false, error: "Image byte length is invalid." };
  }
  return { ok: true };
}

function finiteOrNull(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function normalizeFeedHealth(value: unknown): FeedHealthState {
  const s = String(value ?? "UNKNOWN").toUpperCase();
  if ((FEED_STATES as string[]).includes(s)) return s as FeedHealthState;
  return "UNKNOWN";
}

export function validateCandleWindow(raw: unknown): ChartCaptureCandleWindow | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const closedCount = Number(o.closedCount);
  const formingCount = Number(o.formingCount);
  const totalCount = Number(o.totalCount);
  if (![closedCount, formingCount, totalCount].every((n) => Number.isFinite(n) && n >= 0)) {
    return null;
  }
  if (Math.round(closedCount + formingCount) !== Math.round(totalCount)
    && Math.abs((closedCount + formingCount) - totalCount) > 0.5) {
    // Allow slight mismatch reporting but require non-negative integers.
  }
  return {
    closedCount: Math.floor(closedCount),
    formingCount: Math.floor(formingCount),
    totalCount: Math.floor(totalCount),
    firstOpenTimeSec: finiteOrNull(o.firstOpenTimeSec),
    lastOpenTimeSec: finiteOrNull(o.lastOpenTimeSec),
  };
}

export function validateQuote(raw: unknown): ChartCaptureQuoteSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    bid: finiteOrNull(o.bid),
    ask: finiteOrNull(o.ask),
    mid: finiteOrNull(o.mid),
    lastPrice: finiteOrNull(o.lastPrice),
    feedHealth: normalizeFeedHealth(o.feedHealth),
    lastGenuinePriceChangeAt: o.lastGenuinePriceChangeAt == null
      ? null
      : String(o.lastGenuinePriceChangeAt),
    lastGenuinePriceChangeAgeMs: finiteOrNull(o.lastGenuinePriceChangeAgeMs),
  };
}

export function validateCapturedAtUtc(value: string, nowMs = Date.now()): { ok: true; iso: string } | { ok: false; error: string } {
  const iso = String(value ?? "").trim();
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return { ok: false, error: "capturedAtUtc is not a valid ISO timestamp." };
  // Reject timestamps more than 2 minutes in the future or 10 minutes in the past (stale client clock / cached).
  if (ms > nowMs + 120_000) return { ok: false, error: "capturedAtUtc is too far in the future." };
  if (ms < nowMs - 10 * 60_000) return { ok: false, error: "capturedAtUtc is too old for a fresh capture." };
  return { ok: true, iso: new Date(ms).toISOString() };
}

export function validateCreateCaptureInput(body: unknown): {
  ok: true;
  value: CreateCaptureInput;
  imageBuffer: Buffer;
} | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Request body must be an object." };
  const o = body as Record<string, unknown>;
  const mimeType = String(o.mimeType ?? "image/png");
  const width = Number(o.width);
  const height = Number(o.height);
  const imageDecoded = decodeCaptureImageBase64(String(o.imageBase64 ?? ""));
  if (!imageDecoded.ok) return imageDecoded;
  const metaOk = validateImageMeta({
    mimeType,
    width,
    height,
    byteLength: imageDecoded.buffer.length,
  });
  if (!metaOk.ok) return metaOk;

  const timeframe = String(o.timeframe ?? "");
  if (!isCaptureTimeframeId(timeframe)) {
    return { ok: false, error: `Unsupported timeframe: ${timeframe || "(empty)"}` };
  }

  const instrumentRaw = o.instrument;
  if (!instrumentRaw || typeof instrumentRaw !== "object") {
    return { ok: false, error: "instrument is required." };
  }
  const inst = instrumentRaw as Record<string, unknown>;
  const symbol = String(inst.symbol ?? "").trim();
  const displaySymbol = String(inst.displaySymbol ?? symbol).trim();
  const provider = String(inst.provider ?? "").trim().toUpperCase();
  if (!symbol || !provider) {
    return { ok: false, error: "instrument.symbol and instrument.provider are required." };
  }

  const candleWindow = validateCandleWindow(o.candleWindow);
  if (!candleWindow) return { ok: false, error: "candleWindow is invalid." };
  const quote = validateQuote(o.quote);
  if (!quote) return { ok: false, error: "quote snapshot is invalid." };

  // Do not invent LIVE — reject contradictory claims (LIVE with no price at all).
  if (quote.feedHealth === "LIVE"
    && quote.bid == null && quote.ask == null && quote.mid == null && quote.lastPrice == null) {
    return { ok: false, error: "Cannot mark feed LIVE without a verified bid/ask/mid/last price." };
  }

  const ts = validateCapturedAtUtc(String(o.capturedAtUtc ?? ""));
  if (!ts.ok) return ts;

  const mode = String(o.mode ?? "MANUAL").toUpperCase();
  if (mode !== "MANUAL" && mode !== "SCHEDULED") {
    return { ok: false, error: "mode must be MANUAL or SCHEDULED." };
  }

  const rangeRaw = o.chartRange && typeof o.chartRange === "object"
    ? o.chartRange as Record<string, unknown>
    : {};

  const marketRaw = o.marketSnapshot && typeof o.marketSnapshot === "object"
    ? o.marketSnapshot as Record<string, unknown>
    : {};

  return {
    ok: true,
    imageBuffer: imageDecoded.buffer,
    value: {
      imageBase64: "",
      mimeType,
      width,
      height,
      capturedAtUtc: ts.iso,
      capturedAtLocal: String(o.capturedAtLocal ?? ts.iso),
      mode: mode as "MANUAL" | "SCHEDULED",
      instrument: { symbol, displaySymbol, provider },
      timeframe,
      chartRange: {
        visibleFromSec: finiteOrNull(rangeRaw.visibleFromSec),
        visibleToSec: finiteOrNull(rangeRaw.visibleToSec),
        logicalFrom: finiteOrNull(rangeRaw.logicalFrom),
        logicalTo: finiteOrNull(rangeRaw.logicalTo),
      },
      candleWindow,
      quote,
      marketSnapshot: {
        snapshotId: marketRaw.snapshotId == null ? null : String(marketRaw.snapshotId),
        contentFingerprint: marketRaw.contentFingerprint == null
          ? null
          : String(marketRaw.contentFingerprint),
      },
      sessionId: o.sessionId == null ? null : String(o.sessionId),
    },
  };
}

export function validateSessionConfig(raw: unknown): {
  ok: true;
  value: ChartCaptureSessionConfig;
} | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Session config must be an object." };
  const o = raw as Record<string, unknown>;
  const intervalMs = Number(o.intervalMs);
  const durationMs = Number(o.durationMs);
  const maxCaptures = Number(o.maxCaptures);
  const timeframe = String(o.timeframe ?? "");
  if (!isCaptureTimeframeId(timeframe)) {
    return { ok: false, error: `Unsupported session timeframe: ${timeframe || "(empty)"}` };
  }
  if (!Number.isFinite(intervalMs) || intervalMs < CAPTURE_MIN_INTERVAL_MS || intervalMs > CAPTURE_MAX_INTERVAL_MS) {
    return {
      ok: false,
      error: `intervalMs must be between ${CAPTURE_MIN_INTERVAL_MS} and ${CAPTURE_MAX_INTERVAL_MS}.`,
    };
  }
  if (!Number.isFinite(durationMs) || durationMs < CAPTURE_MIN_DURATION_MS || durationMs > CAPTURE_MAX_DURATION_MS) {
    return {
      ok: false,
      error: `durationMs must be between ${CAPTURE_MIN_DURATION_MS} and ${CAPTURE_MAX_DURATION_MS}.`,
    };
  }
  if (!Number.isFinite(maxCaptures) || maxCaptures < 1 || maxCaptures > CAPTURE_MAX_PER_SESSION) {
    return {
      ok: false,
      error: `maxCaptures must be between 1 and ${CAPTURE_MAX_PER_SESSION}.`,
    };
  }
  const instrumentSymbol = String(o.instrumentSymbol ?? "").trim();
  const provider = String(o.provider ?? "").trim().toUpperCase();
  if (!instrumentSymbol || !provider) {
    return { ok: false, error: "instrumentSymbol and provider are required." };
  }
  return {
    ok: true,
    value: {
      enabled: Boolean(o.enabled),
      intervalMs: Math.floor(intervalMs),
      durationMs: Math.floor(durationMs),
      instrumentSymbol,
      instrumentDisplaySymbol: String(o.instrumentDisplaySymbol ?? instrumentSymbol).trim(),
      provider,
      timeframe,
      maxCaptures: Math.floor(maxCaptures),
    },
  };
}
