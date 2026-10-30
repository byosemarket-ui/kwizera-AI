import { describe, expect, it } from "vitest";
import {
  DEMO_OPEN_RISK_DEFAULTS,
  countOpenPositionsFromTradesPayload,
  evaluateDemoOpenMarketRisk,
  isUtcMinuteInSession,
  type DemoOpenMarketRiskInput,
} from "../../../../ai/forex-ai/automated-trading/demo-execution/open-market-risk.js";
import { PROPOSED_BOUNDED_DEMO_ACTIVATION } from "../../../../ai/forex-ai/automated-trading/demo-execution/demo-activation-config.js";
import { evaluateDemoActivationReadiness } from "../../../../ai/forex-ai/automated-trading/demo-execution/demo-activation-readiness.js";

function verifiedSpecs() {
  return {
    providerSymbol: "XAU/USD",
    baseUnitSize: 1,
    pointSize: 0.01,
    pipCostAccount: 0.01,
    mmrPerLot: 100,
    condDistStopRaw: 0,
    condDistReportedUnit: "pips",
    condDistMethod: "getCondDistStopForTrade",
    condDistAvailable: true,
  };
}

function baseInput(over: Partial<DemoOpenMarketRiskInput> = {}): DemoOpenMarketRiskInput {
  const nowMs = Date.now();
  return {
    instrument: "XAU/USD",
    direction: "BUY",
    lots: 1,
    stopLoss: 4000,
    takeProfit: 4100,
    entryPrice: 4020,
    requireProtective: true,
    grantMaxLots: 1,
    requestedAccountId: null,
    account: {
      accountId: "demo-1",
      accountIdMasked: "***o-1",
      environment: "demo",
      accountCurrency: "USD",
      equity: 10_000,
      usableMargin: 8_000,
      balance: 10_000,
      missingFields: [],
      fetchedAtUtc: new Date(nowMs).toISOString(),
      equityIncludesFloatingPl: true,
    },
    accountFetchOk: true,
    accountCount: 1,
    instrumentSpecs: verifiedSpecs(),
    openExposureLots: 0,
    openPositionCount: 0,
    tradesFetchOk: true,
    hasUnresolvedUnprotectedFill: false,
    quoteTimestamp: nowMs,
    quoteMaxAgeMs: 15_000,
    limits: { ...DEMO_OPEN_RISK_DEFAULTS, maxSlLossAccount: 50 },
    nowMs,
    ...over,
  };
}

describe("Phase 59.0.18 open position count + session/cooldown/day risk", () => {
  it("rejects when open position count reaches maxOpenPositions", () => {
    const r = evaluateDemoOpenMarketRisk(baseInput({
      openPositionCount: 1,
      limits: { ...DEMO_OPEN_RISK_DEFAULTS, maxOpenPositions: 1, maxSlLossAccount: 50 },
    }));
    expect(r.ok).toBe(false);
    expect(r.blockers).toContain("MAX_OPEN_POSITIONS_EXCEEDED");
  });

  it("fails closed when open position count is unavailable", () => {
    const r = evaluateDemoOpenMarketRisk(baseInput({ openPositionCount: null }));
    expect(r.blockers).toContain("OPEN_POSITION_COUNT_UNAVAILABLE");
  });

  it("counts instrument-scoped open positions from RO trades payload", () => {
    const n = countOpenPositionsFromTradesPayload(
      {
        ok: true,
        trades: [
          { instrument: "XAU/USD", amount: 1 },
          { instrument: "EUR/USD", amount: 1 },
          { instrument: "XAU/USD", amount: 1 },
        ],
      },
      { instrument: "XAU/USD", scope: "instrument" },
    );
    expect(n).toBe(2);
  });

  it("enforces UTC session window and cooldown fail-closed", () => {
    expect(isUtcMinuteInSession(8 * 60, 7 * 60, 21 * 60)).toBe(true);
    expect(isUtcMinuteInSession(22 * 60, 7 * 60, 21 * 60)).toBe(false);

    // 12:00 UTC on a fixed epoch day — keep account/quote timestamps aligned with nowMs.
    const noon = Date.UTC(2026, 0, 1, 12, 0, 0);
    const outside = Date.UTC(2026, 0, 1, 22, 0, 0);
    const aligned = (nowMs: number) => ({
      nowMs,
      quoteTimestamp: nowMs,
      account: {
        accountId: "demo-1",
        environment: "demo",
        accountCurrency: "USD",
        equity: 10_000,
        usableMargin: 8_000,
        balance: 10_000,
        missingFields: [],
        fetchedAtUtc: new Date(nowMs).toISOString(),
      },
      limits: {
        ...DEMO_OPEN_RISK_DEFAULTS,
        maxSlLossAccount: 50,
        sessionUtcStartMinute: 7 * 60,
        sessionUtcEndMinute: 21 * 60,
      },
    });
    const inSession = evaluateDemoOpenMarketRisk(baseInput(aligned(noon)));
    expect(inSession.ok).toBe(true);

    const closed = evaluateDemoOpenMarketRisk(baseInput(aligned(outside)));
    expect(closed.blockers).toContain("OUTSIDE_TRADING_SESSION");

    const cooldownMissing = evaluateDemoOpenMarketRisk(baseInput({
      cooldownUntilMs: null,
      limits: { ...DEMO_OPEN_RISK_DEFAULTS, maxSlLossAccount: 50, cooldownAfterLossMs: 60_000 },
    }));
    expect(cooldownMissing.blockers).toContain("COOLDOWN_STATE_UNAVAILABLE");
  });

  it("fails closed on daily loss / drawdown without telemetry; rejects breached limits", () => {
    const missingPnl = evaluateDemoOpenMarketRisk(baseInput({
      dayRealizedPnlAccount: null,
      limits: { ...DEMO_OPEN_RISK_DEFAULTS, maxSlLossAccount: 50, maxDailyLossAccount: 25 },
    }));
    expect(missingPnl.blockers).toContain("DAILY_PNL_UNAVAILABLE");

    const breached = evaluateDemoOpenMarketRisk(baseInput({
      dayRealizedPnlAccount: -30,
      limits: { ...DEMO_OPEN_RISK_DEFAULTS, maxSlLossAccount: 50, maxDailyLossAccount: 25 },
    }));
    expect(breached.blockers).toContain("MAX_DAILY_LOSS_EXCEEDED");

    const ddMissing = evaluateDemoOpenMarketRisk(baseInput({
      dayStartEquity: null,
      limits: {
        ...DEMO_OPEN_RISK_DEFAULTS,
        maxSlLossAccount: 50,
        maxDrawdownFractionOfDayStartEquity: 0.03,
      },
    }));
    expect(ddMissing.blockers).toContain("DRAWDOWN_STATE_UNAVAILABLE");

    const ddHit = evaluateDemoOpenMarketRisk(baseInput({
      dayStartEquity: 10_000,
      account: {
        accountId: "demo-1",
        environment: "demo",
        accountCurrency: "USD",
        equity: 9_600,
        usableMargin: 8_000,
        balance: 9_600,
        missingFields: [],
        fetchedAtUtc: new Date().toISOString(),
      },
      limits: {
        ...DEMO_OPEN_RISK_DEFAULTS,
        maxSlLossAccount: 50,
        maxDrawdownFractionOfDayStartEquity: 0.03,
      },
    }));
    expect(ddHit.blockers).toContain("MAX_DRAWDOWN_EXCEEDED");
  });
});

describe("Phase 59.0.18 DEMO activation readiness", () => {
  it("exposes a bounded proposed profile without enabling mutation", () => {
    expect(PROPOSED_BOUNDED_DEMO_ACTIVATION.liveForbidden).toBe(true);
    expect(PROPOSED_BOUNDED_DEMO_ACTIVATION.placesOrdersGlobal).toBe(false);
    expect(PROPOSED_BOUNDED_DEMO_ACTIVATION.permittedInstruments).toContain("XAU/USD");
    expect(PROPOSED_BOUNDED_DEMO_ACTIVATION.maxOpenPositions).toBe(1);
    expect(PROPOSED_BOUNDED_DEMO_ACTIVATION.maxEntriesPerGrant).toBe(3);
  });

  it("blocks activation approval until day risk telemetry exists; never enables mutation", () => {
    const r = evaluateDemoActivationReadiness({
      forexConnectStatus: "CONNECTED",
      forexConnectEnvironment: "demo",
      activeEnvironment: "demo",
      trading: "DISABLED",
      liveProfileConfigured: false,
      sidecarReachable: true,
      allowDemoMutationEnabled: false,
      placesOrders: false,
      acceptsForExecution: false,
      emergencyEntryLock: true,
      masterEnable: false,
      dayRiskTelemetryReady: false,
      autoEntryLoopArmed: false,
      openMarketRiskLimits: { ...DEMO_OPEN_RISK_DEFAULTS },
    });
    expect(r.mutationEnabled).toBe(false);
    expect(r.grantsCreated).toBe(false);
    expect(r.placesOrders).toBe(false);
    expect(r.liveUnauthorized).toBe(true);
    expect(r.blockers).toContain("DAY_RISK_TELEMETRY");
    expect(r.readyForOwnerActivationApproval).toBe(false);
  });

  it("passes readiness only when required evidence is present", () => {
    const r = evaluateDemoActivationReadiness({
      forexConnectStatus: "CONNECTED",
      forexConnectEnvironment: "demo",
      activeEnvironment: "demo",
      trading: "DISABLED",
      liveProfileConfigured: false,
      sidecarReachable: true,
      allowDemoMutationEnabled: false,
      placesOrders: false,
      acceptsForExecution: false,
      emergencyEntryLock: true,
      masterEnable: false,
      dayRiskTelemetryReady: true,
      autoEntryLoopArmed: false,
      openMarketRiskLimits: { ...DEMO_OPEN_RISK_DEFAULTS },
    });
    expect(r.ok).toBe(true);
    expect(r.readyForOwnerActivationApproval).toBe(true);
    expect(r.mutationEnabled).toBe(false);
  });
});
