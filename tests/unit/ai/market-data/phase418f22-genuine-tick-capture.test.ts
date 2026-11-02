/**
 * Phase 4.18F.2.2 — Genuine tick classification, store, movement windows, evidence.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildGenuineTickDedupeId,
  classifyOfferQuoteEvent,
} from "../../../../ai/market-data/forexconnect/genuine-tick-classify.js";
import {
  createGenuineTickCaptureService,
  resetGenuineTickCaptureServiceForTests,
} from "../../../../ai/market-data/forexconnect/genuine-tick-capture.js";
import {
  createGenuineTickStore,
  GENUINE_TICK_MAX_PER_INSTRUMENT,
  resetGenuineTickStoreForTests,
} from "../../../../ai/market-data/forexconnect/genuine-tick-store.js";
import { GENUINE_TICK_SCHEMA } from "../../../../ai/market-data/forexconnect/genuine-tick-types.js";
import {
  computeAllMovementWindows,
  computeMovementWindow,
} from "../../../../ai/market-data/forexconnect/movement-windows.js";
import { buildMarketEvidenceBundle } from "../../../../ai/forex-ai/automated-trading/analysis/market-evidence-builder.js";
import type { StrategyCandle } from "../../../../ai/forex-ai/automated-trading/auto-engine/strategy/rules.js";

function tmpRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kw-f22-"));
}

afterEach(() => {
  resetGenuineTickCaptureServiceForTests();
  resetGenuineTickStoreForTests();
});

describe("F.2.2 genuine tick classification", () => {
  it("accepts BID_ASK_CHANGE from offers-callback", () => {
    const r = classifyOfferQuoteEvent({
      bid: 1.1,
      ask: 1.2,
      previousBid: 1.0,
      previousAsk: 1.1,
      eventSource: "offers-callback",
      sessionConnected: true,
    });
    expect(r.accepted).toBe(true);
    expect(r.eventClass).toBe("BID_ASK_CHANGE");
  });

  it("rejects INITIAL_SNAPSHOT from tick count", () => {
    const r = classifyOfferQuoteEvent({
      bid: 1.1,
      ask: 1.2,
      previousBid: null,
      previousAsk: null,
      eventSource: "offers-callback",
      sessionConnected: true,
    });
    expect(r.accepted).toBe(false);
    expect(r.eventClass).toBe("INITIAL_SNAPSHOT");
  });

  it("rejects IDENTICAL_SNAPSHOT", () => {
    const r = classifyOfferQuoteEvent({
      bid: 1.1,
      ask: 1.2,
      previousBid: 1.1,
      previousAsk: 1.2,
      eventSource: "offers-table-diff",
      sessionConnected: true,
    });
    expect(r.accepted).toBe(false);
    expect(r.eventClass).toBe("IDENTICAL_SNAPSHOT");
  });

  it("rejects HEARTBEAT from non-genuine source even if prices differ", () => {
    const r = classifyOfferQuoteEvent({
      bid: 1.2,
      ask: 1.3,
      previousBid: 1.1,
      previousAsk: 1.2,
      eventSource: "poll",
      sessionConnected: true,
    });
    expect(r.accepted).toBe(false);
    expect(r.eventClass).toBe("HEARTBEAT");
  });

  it("rejects INVALID_QUOTE", () => {
    const r = classifyOfferQuoteEvent({
      bid: -1,
      ask: 1.2,
      previousBid: 1.0,
      previousAsk: 1.1,
      eventSource: "offers-callback",
      sessionConnected: true,
    });
    expect(r.accepted).toBe(false);
    expect(r.eventClass).toBe("INVALID_QUOTE");
  });

  it("rejects DISCONNECTED", () => {
    const r = classifyOfferQuoteEvent({
      bid: 1.1,
      ask: 1.2,
      previousBid: 1.0,
      previousAsk: 1.1,
      eventSource: "offers-callback",
      sessionConnected: false,
    });
    expect(r.eventClass).toBe("DISCONNECTED");
    expect(r.accepted).toBe(false);
  });

  it("rejects STALE_UPDATE when receipt age exceeds threshold", () => {
    const r = classifyOfferQuoteEvent({
      bid: 1.1,
      ask: 1.2,
      previousBid: 1.0,
      previousAsk: 1.1,
      eventSource: "offers-callback",
      sessionConnected: true,
      receiptAgeMs: 180_000,
      staleThresholdMs: 120_000,
    });
    expect(r.eventClass).toBe("STALE_UPDATE");
    expect(r.accepted).toBe(false);
  });
});

describe("F.2.2 tick store", () => {
  it("suppresses duplicates and keeps event vs receipt timestamps distinct", () => {
    const root = tmpRoot();
    const capture = createGenuineTickCaptureService({ storageRoot: root });
    const base = {
      instrument: "EUR/USD",
      bid: 1.1,
      ask: 1.11,
      previousBid: 1.09,
      previousAsk: 1.1,
      eventSource: "offers-callback",
      eventTimestampMs: 1_700_000_000_000,
      receiptTimestampMs: 1_700_000_000_500,
      sessionConnected: true,
      nowMs: 1_700_000_000_600,
    };
    const a = capture.captureOfferQuote(base);
    expect(a.accepted).toBe(true);
    expect(a.record?.eventTimestampMs).toBe(1_700_000_000_000);
    expect(a.record?.receiptTimestampMs).toBe(1_700_000_000_500);
    expect(a.record?.eventTimestampMs).not.toBe(a.record?.receiptTimestampMs);

    const dup = capture.captureOfferQuote(base);
    expect(dup.duplicate).toBe(true);
    expect(dup.accepted).toBe(false);
    expect(capture.getCounters().duplicates).toBeGreaterThanOrEqual(1);
  });

  it("isolates instruments and handles out-of-order receipts", () => {
    const root = tmpRoot();
    const capture = createGenuineTickCaptureService({ storageRoot: root });
    capture.captureOfferQuote({
      instrument: "EUR/USD",
      bid: 1.1,
      ask: 1.11,
      previousBid: 1.09,
      previousAsk: 1.1,
      eventSource: "offers-callback",
      receiptTimestampMs: 1_000,
      sessionConnected: true,
      nowMs: 2_000,
    });
    capture.captureOfferQuote({
      instrument: "XAU/USD",
      bid: 2600,
      ask: 2601,
      previousBid: 2599,
      previousAsk: 2600,
      eventSource: "offers-table-diff",
      receiptTimestampMs: 1_500,
      sessionConnected: true,
      nowMs: 2_000,
    });
    // Out-of-order older EUR tick
    capture.captureOfferQuote({
      instrument: "EUR/USD",
      bid: 1.08,
      ask: 1.09,
      previousBid: 1.07,
      previousAsk: 1.08,
      eventSource: "offers-callback",
      receiptTimestampMs: 500,
      sessionConnected: true,
      nowMs: 2_000,
    });
    const eur = capture.getTicks("EUR/USD");
    const xau = capture.getTicks("XAU/USD");
    expect(eur.length).toBe(2);
    expect(eur[0]!.receiptTimestampMs).toBe(500);
    expect(eur[1]!.receiptTimestampMs).toBe(1_000);
    expect(xau.length).toBe(1);
    expect(xau[0]!.instrument).toBe("XAU/USD");
  });

  it("recovers after restart and bounds retention", () => {
    const root = tmpRoot();
    const storePath = path.join(root, "forexconnect", "genuine-ticks.json");
    const capture = createGenuineTickCaptureService({ storageRoot: root });
    const baseMs = Date.now() - 60_000;
    for (let i = 0; i < 5; i++) {
      capture.captureOfferQuote({
        instrument: "EUR/USD",
        bid: 1.1 + i * 0.001,
        ask: 1.11 + i * 0.001,
        previousBid: 1.1 + (i - 1) * 0.001,
        previousAsk: 1.11 + (i - 1) * 0.001,
        eventSource: "offers-callback",
        receiptTimestampMs: baseMs + i * 1000,
        sessionConnected: true,
        nowMs: baseMs + i * 1000,
      });
    }
    expect(fs.existsSync(storePath)).toBe(true);
    resetGenuineTickCaptureServiceForTests();
    const again = createGenuineTickCaptureService({ storageRoot: root });
    expect(again.getTicks("EUR/USD").length).toBe(5);

    const store = createGenuineTickStore({ storageRoot: root });
    const now = Date.now();
    // Overflow max-per-instrument without persisting every row (keeps unit test fast).
    for (let i = 0; i < GENUINE_TICK_MAX_PER_INSTRUMENT + 25; i++) {
      store.appendGenuineTick(
        {
          instrument: "EUR/USD",
          bid: 1 + i * 0.00001,
          ask: 1.0001 + i * 0.00001,
          mid: 1.00005 + i * 0.00001,
          spread: 0.0001,
          previousBid: 1,
          previousAsk: 1.0001,
          eventTimestampMs: null,
          receiptTimestampMs: now - 60_000 + i,
          source: "offers-callback",
          eventClass: "BID_ASK_CHANGE",
          dedupeId: `bulk-${i}`,
          quality: "OK",
        },
        { nowMs: now, persist: false },
      );
    }
    expect(store.flush()).toBe(true);
    expect(store.getTicks("EUR/USD").length).toBe(GENUINE_TICK_MAX_PER_INSTRUMENT);
  });

  it("handles corrupt store safely", () => {
    const root = tmpRoot();
    const storePath = path.join(root, "forexconnect", "genuine-ticks.json");
    fs.mkdirSync(path.dirname(storePath), { recursive: true });
    fs.writeFileSync(storePath, "{not-json", "utf8");
    const store = createGenuineTickStore({ storePath });
    expect(store.recoveredFromCorrupt).toBe(true);
    expect(store.getTicks("EUR/USD")).toEqual([]);
  });
});

describe("F.2.2 movement windows", () => {
  const now = 1_700_000_000_000;
  function tick(i: number, bid: number) {
    return {
      schemaVersion: GENUINE_TICK_SCHEMA,
      instrument: "EUR/USD",
      bid,
      ask: bid + 0.0001,
      mid: bid + 0.00005,
      spread: 0.0001,
      previousBid: bid - 0.0001,
      previousAsk: bid,
      eventTimestampMs: null as number | null,
      receiptTimestampMs: now - 50_000 + i * 5_000,
      source: "offers-callback",
      eventClass: "BID_ASK_CHANGE" as const,
      dedupeId: `d-${i}`,
      sequence: i + 1,
      quality: "OK" as const,
    };
  }

  it("computes all five windows", () => {
    const ticks = [tick(0, 1.1), tick(1, 1.11), tick(2, 1.12), tick(3, 1.13)];
    const all = computeAllMovementWindows({
      instrument: "EUR/USD",
      ticks,
      asOfMs: now,
      sessionConnected: true,
    });
    expect(all.map((w) => w.windowId)).toEqual(["1m", "5m", "15m", "30m", "60m"]);
    const one = all.find((w) => w.windowId === "1m")!;
    expect(one.genuineTickCount).toBeGreaterThan(0);
    expect(one.direction).toBe("UP");
    expect(one.midPriceMovement).not.toBeNull();
  });

  it("reports NO_GENUINE_TICKS for empty window — not zero movement", () => {
    const w = computeMovementWindow({
      instrument: "EUR/USD",
      windowId: "5m",
      ticks: [],
      asOfMs: now,
      sessionConnected: true,
    });
    expect(w.status).toBe("NO_GENUINE_TICKS");
    expect(w.freshness).toBe("NO_GENUINE_TICKS");
    expect(w.netBidMovement).toBeNull();
    expect(w.direction).toBe("UNKNOWN");
  });

  it("marks stale windows when latest tick is old", () => {
    const old = [{
      ...tick(0, 1.1),
      receiptTimestampMs: now - 10 * 60_000,
    }];
    const w = computeMovementWindow({
      instrument: "EUR/USD",
      windowId: "5m",
      ticks: old,
      asOfMs: now,
      sessionConnected: true,
    });
    // tick is outside 5m window → empty
    expect(w.status).toBe("NO_GENUINE_TICKS");

    const almostStale = [{
      ...tick(0, 1.1),
      receiptTimestampMs: now - 4 * 60_000,
    }];
    const w2 = computeMovementWindow({
      instrument: "EUR/USD",
      windowId: "5m",
      ticks: almostStale,
      asOfMs: now,
      sessionConnected: true,
    });
    expect(w2.genuineTickCount).toBe(1);
    expect(w2.freshness === "STALE" || w2.status === "STALE" || w2.status === "OK").toBe(true);
  });

  it("reports DISCONNECTED when session down", () => {
    const w = computeMovementWindow({
      instrument: "EUR/USD",
      windowId: "1m",
      ticks: [tick(0, 1.1)],
      asOfMs: now,
      sessionConnected: false,
    });
    expect(w.freshness).toBe("DISCONNECTED");
  });

  it("marks PARTIAL coverage for sparse/gappy wider windows", () => {
    // Two ticks near the end of a 60m window — not full span coverage.
    const sparse = [
      { ...tick(0, 1.1), receiptTimestampMs: now - 8_000, dedupeId: "g0", sequence: 1 },
      { ...tick(1, 1.11), receiptTimestampMs: now - 2_000, dedupeId: "g1", sequence: 2 },
      { ...tick(2, 1.12), receiptTimestampMs: now - 500, dedupeId: "g2", sequence: 3 },
    ];
    const w = computeMovementWindow({
      instrument: "EUR/USD",
      windowId: "60m",
      ticks: sparse,
      asOfMs: now,
      sessionConnected: true,
    });
    expect(w.genuineTickCount).toBe(3);
    expect(w.coverage).toBe("PARTIAL");
  });
});

describe("F.2.2 market evidence integration", () => {
  it("keeps historical candles separate from live tick windows", () => {
    const candles: StrategyCandle[] = [];
    let px = 1.1;
    for (let i = 0; i < 40; i++) {
      candles.push({
        time: 1_700_000_000 + i * 900,
        open: px,
        high: px + 0.01,
        low: px - 0.01,
        close: px + 0.005,
        closed: true,
      });
      px += 0.005;
    }
    const bundle = buildMarketEvidenceBundle({
      environment: "DEMO",
      instrument: "EUR/USD",
      primaryTimeframe: "15m",
      candlesByTf: { "15m": candles },
      quote: {
        instrument: "EUR/USD",
        bid: 1.2,
        ask: 1.21,
        quoteFresh: true,
        freshnessReasonCode: null,
        effectivePriceChangeAgeMs: 1000,
        evaluatedAtUtc: new Date().toISOString(),
        snapshotFingerprint: "abc",
      },
      liveTickMovement: {
        latest: {
          bid: 1.2,
          ask: 1.21,
          mid: 1.205,
          spread: 0.01,
          receiptTimestampMs: Date.now(),
          eventTimestampMs: null,
          eventClass: "BID_ASK_CHANGE",
          source: "offers-callback",
        },
        windows: [
          {
            windowId: "1m",
            genuineTickCount: 3,
            direction: "UP",
            netBidMovement: 0.001,
            netAskMovement: 0.001,
            midPriceMovement: 0.001,
            percentageMovement: 0.08,
            currentSpread: 0.01,
            averageSpread: 0.01,
            freshness: "LIVE",
            status: "OK",
            coverage: "FULL",
            firstReceiptTimestampMs: Date.now() - 30_000,
            latestReceiptTimestampMs: Date.now(),
          },
        ],
        counters: {
          accepted: 3,
          filtered: 1,
          persisted: 3,
          duplicates: 0,
          lastAcceptedAtMs: Date.now(),
        },
      },
    });
    expect(bundle.liveTickMovement.source).toBe("FOREXCONNECT_OFFERS_GENUINE_TICKS");
    expect(bundle.liveTickMovement.windows[0]?.genuineTickCount).toBe(3);
    expect(bundle.historical.primary?.movement).toBeTruthy();
    expect(bundle.placesOrders).toBe(false);
    expect(bundle.acceptsForExecution).toBe(false);
  });

  it("marks missing genuine ticks without inventing zero movement", () => {
    const candles: StrategyCandle[] = Array.from({ length: 40 }, (_, i) => ({
      time: 1_700_000_000 + i * 900,
      open: 1.1,
      high: 1.11,
      low: 1.09,
      close: 1.105,
      closed: true,
    }));
    const bundle = buildMarketEvidenceBundle({
      environment: "DEMO",
      instrument: "EUR/USD",
      primaryTimeframe: "15m",
      candlesByTf: { "15m": candles },
      quote: {
        instrument: "EUR/USD",
        bid: 1.2,
        ask: 1.21,
        quoteFresh: true,
        freshnessReasonCode: null,
        effectivePriceChangeAgeMs: 1000,
        evaluatedAtUtc: new Date().toISOString(),
        snapshotFingerprint: "abc",
      },
    });
    expect(bundle.liveTickMovement.latestTick.value).toBeNull();
    expect(bundle.quality.missing).toContain("genuine_live_ticks");
  });
});

describe("F.2.2 dedupe identity", () => {
  it("includes distinct event and receipt components", () => {
    const id = buildGenuineTickDedupeId({
      instrument: "EUR/USD",
      receiptTimestampMs: 100,
      bid: 1.1,
      ask: 1.2,
      eventTimestampMs: 90,
    });
    expect(id).toContain("100");
    expect(id).toContain("90");
    expect(id).toContain("1.1");
  });
});
