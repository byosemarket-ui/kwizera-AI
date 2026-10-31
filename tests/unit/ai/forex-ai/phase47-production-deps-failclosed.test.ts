import { describe, expect, it, vi } from "vitest";

describe("Phase 4.7 production-deps fail-closed on broker throw", () => {
  it("loadPointSize resolves ForexConnectInstrument providerSymbol rows", async () => {
    vi.resetModules();
    const bridge = {
      getHistoricalCandles: vi.fn(async () => ({ candles: [] })),
      listInstruments: vi.fn(async () => ({
        ok: true,
        instruments: [
          {
            providerSymbol: "XAU/USD",
            displaySymbol: "XAU/USD",
            canonicalSymbol: "XAUUSD",
            pointSize: 0.01,
            baseUnitSize: 100,
          },
        ],
      })),
      pollQuotes: vi.fn(async () => ({ quotes: [] })),
      listAccounts: vi.fn(async () => ({ ok: true, accounts: [] })),
      listTrades: vi.fn(async () => ({ ok: true, trades: [] })),
      listClosedTrades: vi.fn(async () => ({ ok: true, closedTrades: [] })),
      getStatus: vi.fn(async () => ({ status: "CONNECTED" })),
    };
    vi.doMock("../../../../ai/market-data/forexconnect/client.js", () => ({
      getForexConnectBridge: () => bridge,
    }));
    vi.doMock("../../../../ai/forex-ai/automated-trading/demo-execution/orchestrator.js", () => ({
      getDemoLifecycleOrchestrator: () => ({
        listInternalPositionsForReconcile: () => [],
      }),
    }));
    vi.doMock("../../../../ai/forex-ai/automated-trading/demo-execution/grant-store.js", () => ({
      getDemoExecutionGrantStore: () => ({ listActive: () => [] }),
      normalizeGrantInstrument: (s: string) => String(s ?? "").replace(/\s+/g, "").toUpperCase(),
    }));
    const { createProductionAutoEngineDeps } = await import(
      "../../../../ai/forex-ai/automated-trading/auto-engine/production-deps.js"
    );
    const deps = createProductionAutoEngineDeps({ emergencyEntryLock: true, masterEnable: false });
    await expect(deps.loadPointSize("XAU/USD")).resolves.toBe(0.01);
  });

  it("loadPointSize/loadQuoteMeta/loadAccountRiskContext do not throw when bridge rejects", async () => {
    vi.resetModules();
    const bridge = {
      getHistoricalCandles: vi.fn(async () => {
        throw new Error("candles unavailable");
      }),
      listInstruments: vi.fn(async () => {
        throw new Error("instruments unavailable");
      }),
      pollQuotes: vi.fn(async () => {
        throw new Error("quotes unavailable");
      }),
      listAccounts: vi.fn(async () => {
        throw new Error("accounts unavailable");
      }),
      listTrades: vi.fn(async () => {
        throw new Error("trades unavailable");
      }),
      listClosedTrades: vi.fn(async () => {
        throw new Error("closed unavailable");
      }),
      getStatus: vi.fn(async () => {
        throw new Error("status unavailable");
      }),
    };
    vi.doMock("../../../../ai/market-data/forexconnect/client.js", () => ({
      getForexConnectBridge: () => bridge,
    }));
    vi.doMock("../../../../ai/forex-ai/automated-trading/demo-execution/orchestrator.js", () => ({
      getDemoLifecycleOrchestrator: () => ({
        listInternalPositionsForReconcile: () => [],
      }),
    }));
    vi.doMock("../../../../ai/forex-ai/automated-trading/demo-execution/grant-store.js", () => ({
      getDemoExecutionGrantStore: () => ({ listActive: () => [] }),
      normalizeGrantInstrument: (s: string) => String(s ?? "").replace(/\s+/g, "").toUpperCase(),
    }));

    const { createProductionAutoEngineDeps } = await import(
      "../../../../ai/forex-ai/automated-trading/auto-engine/production-deps.js"
    );
    const deps = createProductionAutoEngineDeps({ emergencyEntryLock: true, masterEnable: false });
    await expect(deps.loadPointSize("XAU/USD")).resolves.toBeNull();
    await expect(deps.loadQuoteMeta("XAU/USD")).resolves.toEqual({ ageMs: null, spread: null });
    await expect(deps.loadCandles("XAU/USD", "15m")).resolves.toEqual([]);
    const ctx = await deps.loadAccountRiskContext();
    expect(ctx.brokerConnected).toBe(false);
    expect(ctx.equity).toBeNull();
    expect(ctx.riskPartial.accountFetchOk).toBe(false);
  });
});
