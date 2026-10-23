/**
 * Phase 57.3 — Fresh-quote recovery, freshness mapping, monitor health re-age.
 * Synthetic fixtures only — never places broker orders.
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  evaluateAutomationStartReadiness,
  mapQuoteFreshnessReasonToAutomationCode,
} from "../../../../ai/forex-ai/automated-trading/automation-control/index.js";
import {
  evaluateVerificationQuoteFreshness,
  AT_QUOTE_FRESHNESS_CLOCK_SKEW_MS,
  MARKET_QUOTE_STALE_MS,
} from "../../../../ai/forex-ai/automated-trading/quote-freshness.js";
import type { AutomatedTradingVerificationResult } from "../../../../ai/forex-ai/automated-trading/verification-types.js";
import {
  AtMonitorWorker,
  resetAtMonitorWorkerForTests,
} from "../../../../ai/forex-ai/automated-trading/monitoring/index.js";
import { resetAtMonitorStoreForTests } from "../../../../ai/forex-ai/automated-trading/monitoring/store.js";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

function baseVerification(
  over: {
    verifiedAtUtc?: string;
    market?: Partial<AutomatedTradingVerificationResult["market"]>;
  } = {},
): AutomatedTradingVerificationResult {
  const now = Date.now();
  const market = {
    feedStatus: "LIVE" as const,
    bid: 2650.1,
    ask: 2650.3,
    spread: 0.2,
    sourceTimestampMs: now - 100,
    receivedAtMs: now - 50,
    priceChangeAgeMs: 200,
    receiptAgeMs: 50,
    updateCount: 12,
    marketSession: "ACTIVE" as const,
    ...(over.market ?? {}),
  };
  return {
    verifiedAtUtc: over.verifiedAtUtc ?? new Date(now).toISOString(),
    instrument: { symbol: "XAU/USD" },
    identityStatus: "ACCOUNT_VERIFIED",
    account: { accountIdMasked: "…1234", isFresh: true },
    market,
    readiness: {
      environmentVerified: true,
      accountIdentityVerified: true,
      accountMetadataSufficient: true,
      instrumentMetadataVerified: true,
      marketDataHealthVerified: true,
      readyForFutureAnalysis: true,
      readyForTrading: false,
    },
    blockers: [],
  } as AutomatedTradingVerificationResult;
}

describe("Phase 57.3 freshness semantics", () => {
  it("accepts a valid fresh quote within threshold", () => {
    const now = 1_700_000_000_000;
    const v = baseVerification({
      verifiedAtUtc: new Date(now).toISOString(),
      market: {
        priceChangeAgeMs: 1_000,
        receiptAgeMs: 500,
        sourceTimestampMs: now - 1_000,
        receivedAtMs: now - 500,
        updateCount: 3,
      },
    });
    const e = evaluateVerificationQuoteFreshness(v, { nowMs: now, staleMs: MARKET_QUOTE_STALE_MS });
    expect(e.fresh).toBe(true);
    expect(e.reasonCode).toBe("LIVE_FRESH");
  });

  it("rejects quotes older than the established threshold", () => {
    const now = 1_700_000_000_000;
    const verifiedAt = now - 60_000;
    const v = baseVerification({
      verifiedAtUtc: new Date(verifiedAt).toISOString(),
      market: {
        priceChangeAgeMs: 1_000,
        receiptAgeMs: 1_000,
        sourceTimestampMs: verifiedAt - 1_000,
        receivedAtMs: verifiedAt - 1_000,
        updateCount: 5,
      },
    });
    const e = evaluateVerificationQuoteFreshness(v, { nowMs: now });
    expect(e.fresh).toBe(false);
    expect(e.reasonCode).toBe("QUOTE_AGE_EXCEEDED");
  });

  it("rejects missing verification and future timestamps beyond skew", () => {
    expect(evaluateVerificationQuoteFreshness(null).reasonCode).toBe("VERIFICATION_MISSING");
    const now = 1_700_000_000_000;
    const future = baseVerification({
      verifiedAtUtc: new Date(now + AT_QUOTE_FRESHNESS_CLOCK_SKEW_MS + 10_000).toISOString(),
    });
    expect(
      evaluateVerificationQuoteFreshness(future, { nowMs: now }).reasonCode,
    ).toBe("VERIFICATION_TIMESTAMP_FUTURE");
  });

  it("does not treat receive-time alone as making an old price change fresh", () => {
    const now = 1_700_000_000_000;
    const v = baseVerification({
      verifiedAtUtc: new Date(now).toISOString(),
      market: {
        priceChangeAgeMs: MARKET_QUOTE_STALE_MS + 5_000,
        receiptAgeMs: 100,
        receivedAtMs: now - 100,
        sourceTimestampMs: now - MARKET_QUOTE_STALE_MS - 5_000,
        updateCount: 9,
      },
    });
    const e = evaluateVerificationQuoteFreshness(v, { nowMs: now });
    expect(e.fresh).toBe(false);
    expect(e.reasonCode).toBe("HEARTBEAT_ONLY_NO_PRICE_CHANGE");
  });

  it("ages a pre-restart frozen LIVE snapshot so it cannot pass as post-restart evidence", () => {
    const verifiedAt = 1_700_000_000_000;
    const now = verifiedAt + 120_000;
    const v = baseVerification({
      verifiedAtUtc: new Date(verifiedAt).toISOString(),
      market: {
        priceChangeAgeMs: 500,
        receiptAgeMs: 500,
        sourceTimestampMs: verifiedAt - 500,
        receivedAtMs: verifiedAt - 500,
        updateCount: 4,
      },
    });
    const e = evaluateVerificationQuoteFreshness(v, { nowMs: now });
    expect(e.fresh).toBe(false);
    expect(typeof e.effectivePriceChangeAgeMs).toBe("number");
    expect(e.effectivePriceChangeAgeMs as number).toBeGreaterThan(MARKET_QUOTE_STALE_MS);
  });
});

describe("Phase 57.3 readiness mapping", () => {
  it("maps freshness diagnostics onto actionable automation codes", () => {
    expect(mapQuoteFreshnessReasonToAutomationCode("QUOTE_AGE_EXCEEDED")).toBe("QUOTE_NOT_FRESH");
    expect(mapQuoteFreshnessReasonToAutomationCode("VERIFICATION_MISSING")).toBe("QUOTE_MISSING");
    expect(mapQuoteFreshnessReasonToAutomationCode("FEED_NOT_LIVE")).toBe("FEED_DISCONNECTED");
    expect(mapQuoteFreshnessReasonToAutomationCode("SOURCE_TIMESTAMP_FUTURE")).toBe(
      "QUOTE_FUTURE_TIMESTAMP",
    );
  });

  it("blocks START when quoteFresh is false with mapped code", () => {
    const r = evaluateAutomationStartReadiness({
      masterEnable: false,
      emergencyEntryLock: true,
      placesOrders: false,
      acceptsForExecution: false,
      forexConnectTradingEnabled: false,
      automaticEntryEnabled: false,
      automaticReentryEnabled: false,
      instrumentConfigured: true,
      quoteFresh: false,
      quoteFreshnessReasonCode: "QUOTE_AGE_EXCEEDED",
      monitorCanStart: true,
    });
    expect(r.ok).toBe(false);
    expect(r.reasonCode).toBe("QUOTE_NOT_FRESH");
    expect(r.placesOrders).toBe(false);
    expect(r.acceptsForExecution).toBe(false);
  });

  it("never clears EXECUTION_FORBIDDEN flags on a fresh-quote pass", () => {
    const r = evaluateAutomationStartReadiness({
      masterEnable: false,
      emergencyEntryLock: true,
      placesOrders: false,
      acceptsForExecution: false,
      forexConnectTradingEnabled: false,
      automaticEntryEnabled: false,
      automaticReentryEnabled: false,
      instrumentConfigured: true,
      quoteFresh: true,
      quoteFreshnessReasonCode: "LIVE_FRESH",
      monitorCanStart: true,
    });
    expect(r.ok).toBe(true);
    expect(r.entryGenerationEnabled).toBe(false);
    expect(r.brokerExecution).toBe("DISABLED");
  });
});

describe("Phase 57.3 monitor health re-age when stopped", () => {
  let tmp: string;

  beforeEach(() => {
    resetAtMonitorWorkerForTests();
    resetAtMonitorStoreForTests();
    tmp = mkdtempSync(join(tmpdir(), "kw-mon-57-3-"));
  });

  afterEach(() => {
    resetAtMonitorWorkerForTests();
    resetAtMonitorStoreForTests();
    rmSync(tmp, { recursive: true, force: true });
  });

  it("does not report frozen LIVE_FRESH from disk after verification ages", () => {
    const verifiedAt = Date.now() - 120_000;
    const staleVerification = baseVerification({
      verifiedAtUtc: new Date(verifiedAt).toISOString(),
      market: {
        priceChangeAgeMs: 200,
        receiptAgeMs: 200,
        updateCount: 8,
        feedStatus: "LIVE",
      },
    });

    const worker = new AtMonitorWorker({
      storageRoot: tmp,
      autoStart: false,
      getVerification: () => staleVerification,
      getSelectedEnvironment: () => "DEMO",
    });

    const status = worker.getPublicStatus();
    expect(status.health.workerActive).toBe(false);
    expect(status.health.quoteFresh).toBe(false);
    expect(status.health.freshnessReasonCode).not.toBe("LIVE_FRESH");
  });
});

describe("Phase 57.3 wiring", () => {
  it("START/boot refresh live verification before readiness", () => {
    const service = read("ai/forex-ai/automated-trading/service.ts");
    expect(service).toContain("Refresh live Offers evidence before readiness");
    expect(service).toContain("Obtain post-restart live quote evidence");
    expect(service).toContain("runVerification");
    expect(service).toContain("quoteFreshnessReasonCode");
  });

  it("UI surfaces market-data status separately from execution", () => {
    const ui = read("desktop/forex/ForexAutomatedTradingPage.tsx");
    expect(ui).toContain("data-fx-at-market-data-status");
    expect(ui).toContain("EXECUTION_FORBIDDEN");
    expect(ui).toContain("Market data:");
  });
});
