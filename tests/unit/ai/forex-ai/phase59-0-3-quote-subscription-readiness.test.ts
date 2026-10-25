/**
 * Phase 59.0.3 — quote subscription seeding, permission, freshness, execution gate (no broker mutation).
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { readFileSync } from "node:fs";
import { collectConfiguredAtQuoteInstruments } from "../../../../ai/market-data/forexconnect/seed-at-quote-instruments.ts";
import {
  evaluateQuoteSubscriptionReadiness,
  evaluateExecutionQuoteEvidence,
  parseQuoteTimestampMs,
} from "../../../../ai/forex-ai/automated-trading/quote-subscription-readiness.ts";
import { validateAtQuoteInstrumentForSubscribe } from "../../../../ai/forex-ai/automated-trading/validate-at-quote-instrument.ts";
import { evaluateDemoLifecyclePreflight } from "../../../../ai/forex-ai/automated-trading/demo-execution/preflight.ts";
import {
  ForexConnectLiveCandleService,
  FOREXCONNECT_LIVE_IDLE_MS,
} from "../../../../ai/market-data/forexconnect/live-service.ts";
import type { ForexConnectInstrument } from "../../../../ai/market-data/forexconnect/types.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

const FIXED_NOW = Date.parse("2026-10-25T12:00:00.000Z");

function catalogXau(): ForexConnectInstrument[] {
  return [
    {
      providerSymbol: "XAU/USD",
      canonicalSymbol: "XAUUSD",
      displaySymbol: "XAU/USD",
      marketType: "METAL",
    } as ForexConnectInstrument,
  ];
}

describe("Phase 59.0.3 validateAtQuoteInstrumentForSubscribe", () => {
  it("accepts allowlisted catalog instrument and rejects others", () => {
    const ok = validateAtQuoteInstrumentForSubscribe({
      symbol: "XAU/USD",
      catalogOk: true,
      instruments: catalogXau(),
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.providerSymbol).toBe("XAU/USD");

    const missing = validateAtQuoteInstrumentForSubscribe({
      symbol: "",
      catalogOk: true,
      instruments: catalogXau(),
    });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.code).toBe("INSTRUMENT_MISSING");

    const disallowed = validateAtQuoteInstrumentForSubscribe({
      symbol: "EUR/USD",
      catalogOk: true,
      instruments: [
        ...catalogXau(),
        { providerSymbol: "EUR/USD", canonicalSymbol: "EURUSD", displaySymbol: "EUR/USD" } as ForexConnectInstrument,
      ],
    });
    expect(disallowed.ok).toBe(false);
    if (!disallowed.ok) expect(disallowed.code).toBe("INSTRUMENT_NOT_PERMITTED");

    const unknown = validateAtQuoteInstrumentForSubscribe({
      symbol: "XAU/USD",
      catalogOk: true,
      instruments: [
        { providerSymbol: "EUR/USD", canonicalSymbol: "EURUSD", displaySymbol: "EUR/USD" } as ForexConnectInstrument,
      ],
    });
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.code).toBe("INSTRUMENT_NOT_IN_CATALOG");

    const noCatalog = validateAtQuoteInstrumentForSubscribe({
      symbol: "XAU/USD",
      catalogOk: false,
      instruments: null,
    });
    expect(noCatalog.ok).toBe(false);
    if (!noCatalog.ok) expect(noCatalog.code).toBe("CATALOG_UNAVAILABLE");
  });

  it("deduplicates allowlisted symbols without bypassing validation", () => {
    const a = validateAtQuoteInstrumentForSubscribe({
      symbol: "XAU/USD",
      catalogOk: true,
      instruments: catalogXau(),
    });
    const b = validateAtQuoteInstrumentForSubscribe({
      symbol: "XAUUSD",
      catalogOk: true,
      instruments: catalogXau(),
    });
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(a.providerSymbol).toBe(b.providerSymbol);
    }
  });
});

describe("Phase 59.0.3 collectConfiguredAtQuoteInstruments", () => {
  let tmp: string;
  const prevRoot = process.env.KWIZERA_STORAGE_ROOT;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "at-quote-seed-"));
    process.env.KWIZERA_STORAGE_ROOT = tmp;
    fs.mkdirSync(path.join(tmp, "forex-automated-trading"), { recursive: true });
  });

  afterEach(() => {
    if (prevRoot === undefined) delete process.env.KWIZERA_STORAGE_ROOT;
    else process.env.KWIZERA_STORAGE_ROOT = prevRoot;
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("returns empty when AT instrument config is missing", () => {
    const r = collectConfiguredAtQuoteInstruments(tmp);
    expect(r.instruments).toEqual([]);
    expect(r.placesOrders).toBe(false);
    expect(r.note).toMatch(/not configured/i);
  });

  it("loads selectedInstrument without inventing markets", () => {
    fs.writeFileSync(
      path.join(tmp, "forex-automated-trading", "settings.json"),
      JSON.stringify({
        selectedEnvironment: "DEMO",
        environments: {
          DEMO: { selectedInstrument: "XAU/USD" },
          LIVE: { selectedInstrument: "EUR/USD" },
        },
      }),
      "utf8",
    );
    const r = collectConfiguredAtQuoteInstruments(tmp);
    expect(r.instruments.map((i) => i.symbol)).toEqual(["XAU/USD"]);
  });
});

describe("Phase 59.0.3 evaluateExecutionQuoteEvidence + readiness", () => {
  it("never marks READY from CONNECTED alone", () => {
    const r = evaluateQuoteSubscriptionReadiness({
      sessionStatus: "CONNECTED",
      configuredInstrumentCount: 0,
      intendedCount: 0,
      subscriptionCount: 0,
      offersListenerActive: false,
      streamState: "AUTHENTICATED_IDLE",
      lastQuoteAt: null,
      lastQuoteAgeMs: null,
      bid: null,
      ask: null,
      subscriptionError: null,
    });
    expect(r.readyForExecutionQuote).toBe(false);
    expect(r.code).toBe("INSTRUMENT_NOT_CONFIGURED");
    expect(r.placesOrders).toBe(false);
  });

  it("requires fresh valid bid/ask with known age for requested instrument", () => {
    const waiting = evaluateExecutionQuoteEvidence({
      requestedInstrument: "XAU/USD",
      quoteInstrument: "XAU/USD",
      bid: null,
      ask: null,
      lastQuoteAt: null,
      nowMs: FIXED_NOW,
    });
    expect(waiting.code).toBe("QUOTE_NOT_RECEIVED");
    expect(waiting.readyForExecutionQuote).toBe(false);

    const fresh = evaluateExecutionQuoteEvidence({
      requestedInstrument: "XAU/USD",
      quoteInstrument: "XAU/USD",
      bid: 2650,
      ask: 2650.5,
      lastQuoteAt: FIXED_NOW - 500,
      nowMs: FIXED_NOW,
      freshnessThresholdMs: 15_000,
    });
    expect(fresh.code).toBe("QUOTE_READY");
    expect(fresh.readyForExecutionQuote).toBe(true);

    const stale = evaluateExecutionQuoteEvidence({
      requestedInstrument: "XAU/USD",
      quoteInstrument: "XAU/USD",
      bid: 2650,
      ask: 2650.5,
      lastQuoteAgeMs: 60_000,
      nowMs: FIXED_NOW,
      freshnessThresholdMs: 15_000,
    });
    expect(stale.code).toBe("QUOTE_STALE");

    const crossed = evaluateExecutionQuoteEvidence({
      requestedInstrument: "XAU/USD",
      quoteInstrument: "XAU/USD",
      bid: 2651,
      ask: 2650,
      lastQuoteAt: FIXED_NOW - 100,
      nowMs: FIXED_NOW,
    });
    expect(crossed.code).toBe("QUOTE_INVALID");

    const mismatch = evaluateExecutionQuoteEvidence({
      requestedInstrument: "XAU/USD",
      quoteInstrument: "EUR/USD",
      bid: 1.1,
      ask: 1.1002,
      lastQuoteAt: FIXED_NOW - 100,
      nowMs: FIXED_NOW,
    });
    expect(mismatch.code).toBe("QUOTE_INVALID");
    expect(mismatch.message).toMatch(/does not match/i);

    const future = evaluateExecutionQuoteEvidence({
      requestedInstrument: "XAU/USD",
      quoteInstrument: "XAU/USD",
      bid: 2650,
      ask: 2650.5,
      lastQuoteAt: FIXED_NOW + 60_000,
      nowMs: FIXED_NOW,
    });
    expect(future.code).toBe("QUOTE_INVALID");

    const unknownAge = evaluateExecutionQuoteEvidence({
      requestedInstrument: "XAU/USD",
      quoteInstrument: "XAU/USD",
      bid: 2650,
      ask: 2650.5,
      lastQuoteAt: null,
      lastQuoteAgeMs: null,
      nowMs: FIXED_NOW,
    });
    expect(unknownAge.code).toBe("QUOTE_INVALID");
    expect(unknownAge.message).toMatch(/age unknown/i);

    const readinessFresh = evaluateQuoteSubscriptionReadiness({
      sessionStatus: "CONNECTED",
      configuredInstrumentCount: 1,
      intendedCount: 1,
      subscriptionCount: 1,
      offersListenerActive: true,
      streamState: "LIVE",
      requestedInstrument: "XAU/USD",
      quoteInstrument: "XAU/USD",
      lastQuoteAt: new Date(FIXED_NOW - 200).toISOString(),
      lastQuoteAgeMs: 200,
      freshnessThresholdMs: 15_000,
      bid: 2650,
      ask: 2650.5,
      subscriptionError: null,
      nowMs: FIXED_NOW,
    });
    expect(readinessFresh.code).toBe("QUOTE_READY");
    expect(readinessFresh.readyForExecutionQuote).toBe(true);
  });

  it("parses quote timestamps without inventing freshness", () => {
    expect(parseQuoteTimestampMs(FIXED_NOW)).toBe(FIXED_NOW);
    expect(parseQuoteTimestampMs(new Date(FIXED_NOW).toISOString())).toBe(FIXED_NOW);
    expect(parseQuoteTimestampMs("not-a-date")).toBeNull();
  });
});

describe("Phase 59.0.3 preflight execution gate", () => {
  it("blocks missing/stale/mismatched quotes; allows fresh evidence", () => {
    const fresh = evaluateDemoLifecyclePreflight({
      instrument: "XAU/USD",
      direction: "BUY",
      lots: 1,
      maxLots: 1,
      environment: "demo",
      sessionConnected: true,
      quotePresent: true,
      quoteBid: 2650,
      quoteAsk: 2650.4,
      quoteInstrument: "XAU/USD",
      quoteTimestamp: FIXED_NOW - 400,
      nowMs: FIXED_NOW,
      freshnessThresholdMs: 15_000,
      requireProtective: false,
      stopLoss: null,
      takeProfit: null,
      entryHint: null,
      grantActive: true,
    });
    expect(fresh.ok).toBe(true);
    expect(fresh.maySubmitDemoMutation).toBe(true);
    expect(fresh.quoteReadinessCode).toBe("QUOTE_READY");
    expect(fresh.placesOrdersGlobal).toBe(false);

    const stale = evaluateDemoLifecyclePreflight({
      instrument: "XAU/USD",
      direction: "BUY",
      lots: 1,
      maxLots: 1,
      environment: "demo",
      sessionConnected: true,
      quotePresent: true,
      quoteBid: 2650,
      quoteAsk: 2650.4,
      quoteInstrument: "XAU/USD",
      lastQuoteAgeMs: 60_000,
      nowMs: FIXED_NOW,
      freshnessThresholdMs: 15_000,
      requireProtective: false,
      stopLoss: null,
      takeProfit: null,
      entryHint: null,
      grantActive: true,
    });
    expect(stale.ok).toBe(false);
    expect(stale.maySubmitDemoMutation).toBe(false);
    expect(stale.blockers).toContain("QUOTE_STALE");

    const missing = evaluateDemoLifecyclePreflight({
      instrument: "XAU/USD",
      direction: "BUY",
      lots: 1,
      maxLots: 1,
      environment: "demo",
      sessionConnected: true,
      quotePresent: false,
      quoteBid: null,
      quoteAsk: null,
      requireProtective: false,
      stopLoss: null,
      takeProfit: null,
      entryHint: null,
      grantActive: true,
    });
    expect(missing.maySubmitDemoMutation).toBe(false);
    expect(missing.blockers).toContain("QUOTE_UNAVAILABLE");
  });
});

describe("Phase 59.0.3 live.ensure seeding + idle keepIntended", () => {
  const services: ForexConnectLiveCandleService[] = [];

  afterEach(() => {
    for (const s of services) {
      try {
        s.clearAllSessions({ clearIntended: true });
      } catch {
        /* ignore */
      }
    }
    services.length = 0;
  });

  function mockBridge(opts?: { instruments?: Array<{ providerSymbol: string }> }) {
    return {
      getConfig: () => ({ environment: "demo", environmentLabel: "FXCM DEMO", enabled: true }),
      subscribeQuotes: async (symbol: string) => ({ ok: true, providerSymbol: symbol }),
      unsubscribeQuotes: async () => undefined,
      getHistoricalCandles: async ({ symbol, timeframe }: { symbol: string; timeframe: string }) => ({
        ok: true,
        providerSymbol: symbol,
        canonicalSymbol: symbol.replace(/[^A-Za-z0-9]/g, "").toUpperCase(),
        displaySymbol: symbol,
        marketType: "FOREX",
        timeframe,
        candles: [
          {
            time: Math.floor(Date.now() / 60_000) * 60,
            open: 1.1,
            high: 1.1,
            low: 1.1,
            close: 1.1,
            volume: 1,
            closed: false,
          },
        ],
      }),
      pollQuotes: async () => [],
      getOfferQuote: async () => ({
        ok: true,
        quotePresent: true,
        bid: 2650,
        ask: 2650.5,
        lastQuoteAt: null,
        updateCount: 0,
        eventSource: "offers_table_seed",
      }),
      listInstruments: async () => ({
        ok: true,
        instruments: opts?.instruments ?? [
          { providerSymbol: "XAU/USD" },
          { providerSymbol: "EUR/USD" },
        ],
      }),
      getStatus: async () => ({ status: "CONNECTED", environment: "demo" }),
      getStreamStatus: async () => ({
        ok: true,
        provider: "FOREXCONNECT",
        sessionStatus: "CONNECTED",
        streamState: "SUBSCRIBED_WAITING",
        offersListenerActive: true,
        offersPollerActive: true,
        callbackRegistered: true,
        subscriptionCount: 1,
        subscriptions: ["XAU/USD"],
        maxSubscriptions: 8,
        lastQuoteAt: null,
        lastQuoteAgeMs: null,
        lastStreamError: null,
        updateCount: 1,
        lastEventSource: null,
        diagnostics: null,
        priceBasis: "bid",
        trading: "DISABLED",
      }),
    } as never;
  }

  it("idle sweep keeps intended while releasing local sessions", async () => {
    const bridge = mockBridge();
    const svc = new ForexConnectLiveCandleService({ bridge });
    services.push(svc);
    await svc.ensure("EUR/USD", "1m");
    expect(svc.listIntendedSubscriptions().length).toBe(1);
    svc.sweepIdleSessionsForTests(Date.now() + FOREXCONNECT_LIVE_IDLE_MS + 1_000);
    await Promise.resolve();
    await Promise.resolve();
    expect(svc.getSessionCount()).toBe(0);
    expect(svc.listIntendedSubscriptions().length).toBe(1);
  });

  it("ensureValidatedAtInstrument rejects disallowed symbols before subscribe", async () => {
    const bridge = mockBridge();
    const svc = new ForexConnectLiveCandleService({ bridge });
    services.push(svc);
    const rejected = await svc.ensureValidatedAtInstrument("EUR/USD", "1m");
    expect(rejected.ok).toBe(false);
    expect(rejected.code).toBe("INSTRUMENT_NOT_PERMITTED");
    expect(svc.listIntendedSubscriptions().length).toBe(0);

    const accepted = await svc.ensureValidatedAtInstrument("XAU/USD", "1m");
    expect(accepted.ok).toBe(true);
    expect(svc.listIntendedSubscriptions().length).toBe(1);
  });

  it("wiring: probe/open use validated ensure; readiness consumes quote evidence", () => {
    const orch = read("ai/forex-ai/automated-trading/demo-execution/orchestrator.ts");
    expect(orch).toContain("ensureValidatedAtInstrument");
    expect(orch).toContain("evaluateQuoteSubscriptionReadiness");
    expect(orch).toContain("blockers.push(readinessEval.code)");
    expect(orch).not.toMatch(/probeQuote[\s\S]{0,400}bridge\.subscribeQuotes/);
    const preflight = read("ai/forex-ai/automated-trading/demo-execution/preflight.ts");
    expect(preflight).toContain("evaluateExecutionQuoteEvidence");
    expect(preflight).toContain("quoteTimestamp");
  });

  it("quote init path does not enable trading flags", () => {
    const seed = read("ai/market-data/forexconnect/seed-at-quote-instruments.ts");
    expect(seed).toContain("placesOrders: false");
    expect(seed).toContain("acceptsForExecution: false");
    const ready = evaluateQuoteSubscriptionReadiness({
      sessionStatus: "CONNECTED",
      configuredInstrumentCount: 1,
      intendedCount: 1,
      subscriptionCount: 1,
      offersListenerActive: true,
      streamState: "LIVE",
      requestedInstrument: "XAU/USD",
      quoteInstrument: "XAU/USD",
      lastQuoteAt: new Date(FIXED_NOW - 100).toISOString(),
      lastQuoteAgeMs: 100,
      freshnessThresholdMs: 15_000,
      bid: 2650,
      ask: 2650.5,
      subscriptionError: null,
      nowMs: FIXED_NOW,
    });
    expect(ready.placesOrders).toBe(false);
    expect(ready.acceptsForExecution).toBe(false);
    expect(ready.mutatesBroker).toBe(false);
    expect(ready.readyForExecutionQuote).toBe(true);
  });
});
