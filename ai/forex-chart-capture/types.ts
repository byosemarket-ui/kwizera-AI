/**
 * Phase 49A — Chart capture record types (persistence + API).
 */
import type { CaptureTimeframeId } from "./limits.js";
import { CHART_CAPTURE_SCHEMA_VERSION } from "./limits.js";

export { CHART_CAPTURE_SCHEMA_VERSION };

export type CaptureMode = "MANUAL" | "SCHEDULED";
export type CaptureStatus = "STORED" | "FAILED";
export type CaptureSessionStatus =
  | "IDLE"
  | "RUNNING"
  | "PAUSED"
  | "COMPLETED"
  | "STOPPED"
  | "FAILED";

export type FeedHealthState =
  | "LIVE"
  | "STALE"
  | "NO_RECENT_MARKET_UPDATES"
  | "MARKET_INACTIVE"
  | "HISTORICAL"
  | "CONNECTING"
  | "RECONNECTING"
  | "UNAVAILABLE"
  | "UNKNOWN";

export interface ChartCaptureCandleWindow {
  closedCount: number;
  formingCount: number;
  totalCount: number;
  firstOpenTimeSec: number | null;
  lastOpenTimeSec: number | null;
}

export interface ChartCaptureQuoteSnapshot {
  bid: number | null;
  ask: number | null;
  mid: number | null;
  lastPrice: number | null;
  feedHealth: FeedHealthState;
  lastGenuinePriceChangeAt: string | null;
  lastGenuinePriceChangeAgeMs: number | null;
}

export interface ChartCaptureImageMeta {
  mimeType: "image/png";
  width: number;
  height: number;
  byteLength: number;
  fileName: string;
}

export interface ChartCaptureRecord {
  schemaVersion: typeof CHART_CAPTURE_SCHEMA_VERSION;
  captureId: string;
  capturedAtUtc: string;
  /** ISO local offset string recorded by the client at capture time (display aid). */
  capturedAtLocal: string;
  mode: CaptureMode;
  status: CaptureStatus;
  instrument: {
    symbol: string;
    displaySymbol: string;
    provider: string;
  };
  timeframe: CaptureTimeframeId;
  chartRange: {
    visibleFromSec: number | null;
    visibleToSec: number | null;
    logicalFrom: number | null;
    logicalTo: number | null;
  };
  candleWindow: ChartCaptureCandleWindow;
  quote: ChartCaptureQuoteSnapshot;
  marketSnapshot: {
    snapshotId: string | null;
    contentFingerprint: string | null;
  };
  image: ChartCaptureImageMeta;
  sessionId: string | null;
  error: string | null;
  /** Studio-scoped ownership note — no per-user identity in Phase 49A. */
  ownershipScope: "studio";
  selectedForAi: boolean;
  createdAt: string;
}

/** List/meta projection — no image bytes. */
export type ChartCaptureListItem = Omit<ChartCaptureRecord, never> & {
  hasImage: boolean;
};

export interface ChartCaptureSessionConfig {
  enabled: boolean;
  intervalMs: number;
  durationMs: number;
  instrumentSymbol: string;
  instrumentDisplaySymbol: string;
  provider: string;
  /** Phase 49A: single timeframe — the active chart TF (no silent multi-TF switching). */
  timeframe: CaptureTimeframeId;
  maxCaptures: number;
}

export interface ChartCaptureSessionState {
  sessionId: string;
  status: CaptureSessionStatus;
  config: ChartCaptureSessionConfig;
  startedAtUtc: string | null;
  endsAtUtc: string | null;
  pausedAtUtc: string | null;
  nextCaptureAtUtc: string | null;
  captureCount: number;
  lastCaptureId: string | null;
  lastError: string | null;
  /** Explicit: scheduling runs in the browser; closing the tab stops captures. */
  requiresBrowserOpen: true;
  updatedAtUtc: string;
}

export interface CreateCaptureInput {
  imageBase64: string;
  mimeType: string;
  width: number;
  height: number;
  capturedAtUtc: string;
  capturedAtLocal: string;
  mode: CaptureMode;
  instrument: ChartCaptureRecord["instrument"];
  timeframe: string;
  chartRange?: ChartCaptureRecord["chartRange"];
  candleWindow: ChartCaptureCandleWindow;
  quote: ChartCaptureQuoteSnapshot;
  marketSnapshot?: ChartCaptureRecord["marketSnapshot"];
  sessionId?: string | null;
  visibleLogicalRange?: { from: number; to: number } | null;
}
