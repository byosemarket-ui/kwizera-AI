/**
 * Phase 4.18F.2.2 — Rolling genuine-tick movement windows.
 * Zero genuine ticks ⇒ NO_GENUINE_TICKS / INSUFFICIENT_DATA — never "zero movement".
 */

import {
  MOVEMENT_WINDOW_IDS,
  MOVEMENT_WINDOW_MS,
  MOVEMENT_WINDOWS_SCHEMA,
  type GenuineTickRecord,
  type MovementDirection,
  type MovementWindowId,
  type MovementWindowSummary,
} from "./genuine-tick-types.js";

const FLAT_EPS_RATIO = 1e-9;
/** Window freshness: latest tick older than this fraction of the window ⇒ STALE. */
const STALE_FRACTION = 0.5;
/** Minimum ticks required before claiming OK coverage for wider windows. */
const MIN_TICKS_FOR_OK: Record<MovementWindowId, number> = {
  "1m": 1,
  "5m": 1,
  "15m": 2,
  "30m": 2,
  "60m": 3,
};

function directionFromNet(netMid: number | null, baseMid: number | null): MovementDirection {
  if (netMid == null || baseMid == null || !Number.isFinite(netMid) || !Number.isFinite(baseMid)) {
    return "UNKNOWN";
  }
  const eps = Math.max(Math.abs(baseMid) * FLAT_EPS_RATIO, Number.EPSILON);
  if (Math.abs(netMid) <= eps) return "FLAT";
  return netMid > 0 ? "UP" : "DOWN";
}

export function ticksInWindow(
  ticks: readonly GenuineTickRecord[],
  windowMs: number,
  asOfMs: number,
): GenuineTickRecord[] {
  const cutoff = asOfMs - windowMs;
  return ticks.filter((t) => {
    const ts = t.receiptTimestampMs;
    return Number.isFinite(ts) && ts >= cutoff && ts <= asOfMs;
  });
}

export function computeMovementWindow(input: {
  instrument: string;
  windowId: MovementWindowId;
  ticks: readonly GenuineTickRecord[];
  asOfMs: number;
  sessionConnected?: boolean;
}): MovementWindowSummary {
  const windowMs = MOVEMENT_WINDOW_MS[input.windowId];
  const asOfMs = input.asOfMs;
  const connected = input.sessionConnected !== false;
  const emptyBase = (status: MovementWindowSummary["status"], freshness: MovementWindowSummary["freshness"]): MovementWindowSummary => ({
    schemaVersion: MOVEMENT_WINDOWS_SCHEMA,
    windowId: input.windowId,
    windowMs,
    instrument: input.instrument,
    genuineTickCount: 0,
    firstBid: null,
    firstAsk: null,
    latestBid: null,
    latestAsk: null,
    highestBid: null,
    lowestBid: null,
    highestAsk: null,
    lowestAsk: null,
    firstReceiptTimestampMs: null,
    latestReceiptTimestampMs: null,
    netBidMovement: null,
    netAskMovement: null,
    midPriceMovement: null,
    percentageMovement: null,
    direction: "UNKNOWN",
    averageMovementPerChange: null,
    largestObservedMovement: null,
    currentSpread: null,
    averageSpread: null,
    spreadChange: null,
    coverage: "EMPTY",
    freshness,
    status,
    asOfMs,
  });

  if (!connected) {
    return emptyBase("INSUFFICIENT_DATA", "DISCONNECTED");
  }

  const inWin = ticksInWindow(input.ticks, windowMs, asOfMs)
    .slice()
    .sort((a, b) => a.receiptTimestampMs - b.receiptTimestampMs);

  if (inWin.length === 0) {
    return emptyBase("NO_GENUINE_TICKS", "NO_GENUINE_TICKS");
  }

  const first = inWin[0]!;
  const latest = inWin[inWin.length - 1]!;
  let highestBid = first.bid;
  let lowestBid = first.bid;
  let highestAsk = first.ask;
  let lowestAsk = first.ask;
  let spreadSum = 0;
  let largestMove = 0;
  for (let i = 0; i < inWin.length; i++) {
    const t = inWin[i]!;
    if (t.bid > highestBid) highestBid = t.bid;
    if (t.bid < lowestBid) lowestBid = t.bid;
    if (t.ask > highestAsk) highestAsk = t.ask;
    if (t.ask < lowestAsk) lowestAsk = t.ask;
    spreadSum += t.spread;
    if (i > 0) {
      const prev = inWin[i - 1]!;
      const step = Math.abs(t.mid - prev.mid);
      if (step > largestMove) largestMove = step;
    }
  }

  const netBid = latest.bid - first.bid;
  const netAsk = latest.ask - first.ask;
  const midMove = latest.mid - first.mid;
  const pct = first.mid !== 0 ? (midMove / first.mid) * 100 : null;
  const changes = inWin.length - 1;
  const avgMove = changes > 0 ? midMove / changes : null;
  const avgSpread = spreadSum / inWin.length;
  const spreadChange = latest.spread - first.spread;
  const ageMs = asOfMs - latest.receiptTimestampMs;
  const staleLimit = Math.max(windowMs * STALE_FRACTION, 30_000);
  const minTicks = MIN_TICKS_FOR_OK[input.windowId];
  const insufficient = inWin.length < minTicks;

  let freshness: MovementWindowSummary["freshness"] = "LIVE";
  let status: MovementWindowSummary["status"] = "OK";
  let coverage: MovementWindowSummary["coverage"] = "FULL";

  if (insufficient) {
    status = "INSUFFICIENT_DATA";
    freshness = "INSUFFICIENT_DATA";
    coverage = "PARTIAL";
  } else if (ageMs > staleLimit) {
    status = "STALE";
    freshness = "STALE";
    coverage = "PARTIAL";
  }

  // Span coverage: if first tick is much newer than window start, mark PARTIAL.
  const span = latest.receiptTimestampMs - first.receiptTimestampMs;
  if (coverage === "FULL" && span < windowMs * 0.25 && input.windowId !== "1m") {
    coverage = "PARTIAL";
  }

  return {
    schemaVersion: MOVEMENT_WINDOWS_SCHEMA,
    windowId: input.windowId,
    windowMs,
    instrument: input.instrument,
    genuineTickCount: inWin.length,
    firstBid: first.bid,
    firstAsk: first.ask,
    latestBid: latest.bid,
    latestAsk: latest.ask,
    highestBid,
    lowestBid,
    highestAsk,
    lowestAsk,
    firstReceiptTimestampMs: first.receiptTimestampMs,
    latestReceiptTimestampMs: latest.receiptTimestampMs,
    netBidMovement: netBid,
    netAskMovement: netAsk,
    midPriceMovement: midMove,
    percentageMovement: pct,
    direction: directionFromNet(midMove, first.mid),
    averageMovementPerChange: avgMove,
    largestObservedMovement: largestMove,
    currentSpread: latest.spread,
    averageSpread: avgSpread,
    spreadChange,
    coverage,
    freshness,
    status,
    asOfMs,
  };
}

export function computeAllMovementWindows(input: {
  instrument: string;
  ticks: readonly GenuineTickRecord[];
  asOfMs: number;
  sessionConnected?: boolean;
}): MovementWindowSummary[] {
  return MOVEMENT_WINDOW_IDS.map((windowId) =>
    computeMovementWindow({
      instrument: input.instrument,
      windowId,
      ticks: input.ticks,
      asOfMs: input.asOfMs,
      sessionConnected: input.sessionConnected,
    }),
  );
}
