import { describe, expect, it } from "vitest";
import { lotsToBrokerAmount } from "../../../../ai/forex-ai/automated-trading/order-execution/lots-to-broker-amount.js";
import { evaluateDemoActivationReadiness } from "../../../../ai/forex-ai/automated-trading/demo-execution/demo-activation-readiness.js";
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
});
