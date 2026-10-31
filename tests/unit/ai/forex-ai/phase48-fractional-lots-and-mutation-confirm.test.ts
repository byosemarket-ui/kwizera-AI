import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { lotsToBrokerAmount } from "../../../../ai/forex-ai/automated-trading/order-execution/lots-to-broker-amount.js";
import { cooldownUntilMsFromClosedTrades } from "../../../../ai/forex-ai/automated-trading/auto-engine/production-deps.js";
import { evaluateDemoActivationReadiness } from "../../../../ai/forex-ai/automated-trading/demo-execution/demo-activation-readiness.js";
import { resolveAutoDemoGrantConfig } from "../../../../ai/forex-ai/automated-trading/demo-execution/auto-grant-lifecycle.js";
import {
  DemoExecutionGrantStore,
  resetDemoExecutionGrantStoreForTests,
} from "../../../../ai/forex-ai/automated-trading/demo-execution/grant-store.js";
import { DEMO_OPEN_RISK_DEFAULTS } from "../../../../ai/forex-ai/automated-trading/demo-execution/open-market-risk.js";
import { PROPOSED_BOUNDED_DEMO_ACTIVATION } from "../../../../ai/forex-ai/automated-trading/demo-execution/demo-activation-config.js";

describe("Phase 4.8 fractional lots + mutation confirmation", () => {
  it("converts 0.01 lots when baseUnitSize yields an integer amount", () => {
    const ok = lotsToBrokerAmount({ lots: 0.01, baseUnitSize: 100 });
    expect(ok.ok).toBe(true);
    expect(ok.amount).toBe(1);
    expect(ok.code).toBe("OK");
  });

  it("rejects 0.01 lots when baseUnitSize=1 (non-integer AMOUNT)", () => {
    const bad = lotsToBrokerAmount({ lots: 0.01, baseUnitSize: 1 });
    expect(bad.ok).toBe(false);
    expect(bad.code).toBe("AMOUNT_NOT_INTEGER");
  });

  it("bounds proposed max lots/exposure to 0.01", () => {
    expect(DEMO_OPEN_RISK_DEFAULTS.maxLotsPerOrder).toBe(0.01);
    expect(DEMO_OPEN_RISK_DEFAULTS.maxTotalExposureLots).toBe(0.01);
    expect(PROPOSED_BOUNDED_DEMO_ACTIVATION.maxLotsPerOrder).toBe(0.01);
    expect(PROPOSED_BOUNDED_DEMO_ACTIVATION.maxTotalExposureLots).toBe(0.01);
  });

  it("MUTATION_FLAG passes only when owner confirms intentional enabled mutation", () => {
    const blocked = evaluateDemoActivationReadiness({
      forexConnectStatus: "CONNECTED",
      forexConnectEnvironment: "demo",
      activeEnvironment: "demo",
      trading: "DISABLED",
      liveProfileConfigured: false,
      sidecarReachable: true,
      allowDemoMutationEnabled: true,
      ownerConfirmedBoundedDemoMutation: false,
      placesOrders: false,
      acceptsForExecution: false,
      emergencyEntryLock: true,
      masterEnable: false,
      dayRiskTelemetryReady: true,
      autoEntryLoopArmed: false,
    });
    expect(blocked.blockers).toContain("MUTATION_FLAG");

    const confirmed = evaluateDemoActivationReadiness({
      forexConnectStatus: "CONNECTED",
      forexConnectEnvironment: "demo",
      activeEnvironment: "demo",
      trading: "DISABLED",
      liveProfileConfigured: false,
      sidecarReachable: true,
      allowDemoMutationEnabled: true,
      ownerConfirmedBoundedDemoMutation: true,
      placesOrders: false,
      acceptsForExecution: false,
      emergencyEntryLock: true,
      masterEnable: false,
      dayRiskTelemetryReady: true,
      autoEntryLoopArmed: false,
    });
    expect(confirmed.blockers).not.toContain("MUTATION_FLAG");
    expect(confirmed.checks.find((c) => c.code === "MUTATION_FLAG")?.status).toBe("PASS");
  });

  it("grant store persists fractional maxLots=0.01 (does not floor to 1)", () => {
    const prev = process.env.KWIZERA_STORAGE_ROOT;
    const dir = mkdtempSync(join(tmpdir(), "kw-grant-frac-"));
    process.env.KWIZERA_STORAGE_ROOT = dir;
    resetDemoExecutionGrantStoreForTests();
    try {
      const store = new DemoExecutionGrantStore(join(dir, "forex", "demo-execution-grants.json"));
      const g = store.create({
        ttlMs: 120_000,
        maxLots: 0.01,
        instrumentAllowlist: ["XAU/USD"],
      });
      expect(g.maxLots).toBe(0.01);
      expect(store.requireActive(g.grantId, "XAU/USD", 0.01).ok).toBe(true);
      expect(store.requireActive(g.grantId, "XAU/USD", 0.02)).toMatchObject({
        ok: false,
        code: "LOTS_EXCEED_GRANT",
      });
    } finally {
      resetDemoExecutionGrantStoreForTests();
      if (prev == null) delete process.env.KWIZERA_STORAGE_ROOT;
      else process.env.KWIZERA_STORAGE_ROOT = prev;
    }
  });

  it("auto-grant config defaults maxLots to 0.01 and accepts fractional env", () => {
    expect(resolveAutoDemoGrantConfig({}).maxLots).toBe(0.01);
    expect(resolveAutoDemoGrantConfig({
      KWIZERA_FOREXCONNECT_AUTO_DEMO_GRANT_MAX_LOTS: "0.01",
    }).maxLots).toBe(0.01);
  });

  it("cooldownUntilMs is last-loss close + cooldown window (0 when no losses)", () => {
    expect(cooldownUntilMsFromClosedTrades(null, 15 * 60_000)).toBe(0);
    expect(cooldownUntilMsFromClosedTrades([{ closeTimeUtc: "2026-10-31T12:00:00.000Z", realizedPnl: 5 }], 15 * 60_000)).toBe(0);
    const lossAt = Date.parse("2026-10-31T12:00:00.000Z");
    expect(cooldownUntilMsFromClosedTrades(
      [{ closeTimeUtc: "2026-10-31T12:00:00.000Z", realizedPnl: -2.5 }],
      15 * 60_000,
    )).toBe(lossAt + 15 * 60_000);
  });
});
