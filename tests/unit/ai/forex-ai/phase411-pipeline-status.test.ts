import { describe, expect, it } from "vitest";
import { deriveAtPipelineStatus } from "../../../../ai/forex-ai/automated-trading/pipeline-status.js";
import {
  evaluateAutomationStartReadiness,
  mapQuoteFreshnessReasonToAutomationCode,
} from "../../../../ai/forex-ai/automated-trading/automation-control/readiness.js";
import { AUTOMATED_EXECUTION_BANNER, AUTOMATED_TRADING_PHASE } from "../../../../ai/forex-ai/automated-trading/types.js";

describe("Phase 4.11 pipeline status + market-closed mapping (unit)", () => {
  it("banner and phase are honest about monitoring vs global execution", () => {
    expect(AUTOMATED_TRADING_PHASE).toBe("4.11");
    expect(AUTOMATED_EXECUTION_BANNER).toMatch(/monitoring\/analysis only/i);
    expect(AUTOMATED_EXECUTION_BANNER).not.toMatch(/PHASE 54/);
  });

  it("maps MARKET_INACTIVE freshness to MARKET_CLOSED (not FEED_DISCONNECTED)", () => {
    expect(mapQuoteFreshnessReasonToAutomationCode("MARKET_INACTIVE")).toBe("MARKET_CLOSED");
    expect(mapQuoteFreshnessReasonToAutomationCode("FEED_NOT_LIVE")).toBe("FEED_DISCONNECTED");
  });

  it("labels market closed when feed is MARKET_INACTIVE", () => {
    const s = deriveAtPipelineStatus({
      automationLifecycle: "BLOCKED",
      feedStatus: "MARKET_INACTIVE",
      quoteFresh: false,
      quoteFreshnessReasonCode: "MARKET_INACTIVE",
      instrumentConfigured: true,
      brokerConnected: true,
      instrumentContract: {
        providerSymbol: "XAU/USD",
        baseUnitSize: 1,
        minQuantity: 1,
        mmrPerLot: 4.42,
        evidenceSource: "mock_fixture",
      },
      instrumentContractLive: false,
    });
    expect(s.phase).toBe("MARKET_CLOSED");
    expect(s.executionAllowed).toBe(false);
    expect(s.placesOrders).toBe(false);
  });

  it("live XAU metadata is evaluated at the broker minimum — no fixed 0.01 owner cap (mock)", () => {
    const s = deriveAtPipelineStatus({
      automationLifecycle: "MONITORING",
      quoteFresh: true,
      instrumentConfigured: true,
      brokerConnected: true,
      instrumentContract: {
        providerSymbol: "XAU/USD",
        baseUnitSize: 1,
        minQuantity: 1,
        mmrPerLot: 4.42,
        evidenceSource: "mock_fixture",
      },
      instrumentContractLive: true,
    });
    expect(s.monitoringAllowed).toBe(true);
    expect(s.executionAllowed).toBe(false);
    expect(s.ownerMaxLots).toBeNull();
    expect(s.quantityCompatibility?.compatible001Lot).toBe(true);
    expect(s.blockers.some((b) => /OWNER_MAX/.test(b))).toBe(false);
    expect(s.blockers).toContain("GLOBAL_AT_EXECUTION_DISABLED");
  });

  it("requires instrument selection before monitoring narrative", () => {
    const s = deriveAtPipelineStatus({
      automationLifecycle: "OFF",
      instrumentConfigured: false,
      brokerConnected: true,
      instrumentContract: null,
    });
    expect(s.phase).toBe("OFF");
    expect(s.blockers).toContain("INSTRUMENT_NOT_CONFIGURED");
  });

  it("allows START AUTO monitoring wait when market closed (entries still forbidden)", () => {
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
      quoteFreshnessReasonCode: "MARKET_INACTIVE",
      monitorCanStart: true,
    });
    expect(r.ok).toBe(true);
    expect(r.reasonCode).toBe("MARKET_CLOSED");
    expect(r.placesOrders).toBe(false);
    expect(r.entryGenerationEnabled).toBe(false);
  });
});
