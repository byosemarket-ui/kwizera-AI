import { describe, expect, it } from "vitest";
import {
  isAllowedMt5HfmAgentMethod,
  isForbiddenTradingMethod,
  MT5_HFM_AGENT_METHODS,
} from "../../../ai/market-data/mt5-hfm/agent-protocol.js";
import { buildMt5HfmConnectionStates } from "../../../ai/market-data/mt5-hfm/connection-states.js";
import { buildMt5HfmAnalysisInput } from "../../../ai/market-data/mt5-hfm/analysis-input.js";
import { MARKET_PROVIDERS } from "../../../ai/market-data/providers/types.js";

describe("HFM MT5 agent allowlist + connection states", () => {
  it("includes read-only demo market methods and rejects trading", () => {
    expect(MT5_HFM_AGENT_METHODS).toContain("demo.symbols");
    expect(MT5_HFM_AGENT_METHODS).toContain("demo.open_positions_snapshot");
    expect(MT5_HFM_AGENT_METHODS).toContain("demo.trade_history_snapshot");
    expect(isAllowedMt5HfmAgentMethod("demo.quotes_snapshot")).toBe(true);
    expect(isForbiddenTradingMethod("trade_send_market_order")).toBe(true);
    expect(isForbiddenTradingMethod("live.login")).toBe(true);
    expect(isForbiddenTradingMethod("demo.open_positions_snapshot")).toBe(false);
  });

  it("builds distinct connection states", () => {
    const states = buildMt5HfmConnectionStates({
      credentialsConfigured: true,
      agentOk: true,
      terminalRunning: true,
      hfmTcpOk: true,
      authenticated: true,
      authFailed: false,
      accountSynced: true,
      marketDataAvailable: true,
      marketDataStale: false,
      syncFailed: false,
    });
    const active = states.filter((s) => s.active).map((s) => s.id);
    expect(active).toContain("CREDENTIALS_SAVED");
    expect(active).toContain("AGENT_CONNECTED");
    expect(active).toContain("MT5_TERMINAL_RUNNING");
    expect(active).toContain("DEMO_AUTHENTICATED");
    expect(active).toContain("ACCOUNT_SYNCHRONIZED");
    expect(active).toContain("MARKET_DATA_AVAILABLE");
    expect(active).not.toContain("CREDENTIALS_NOT_CONFIGURED");
  });

  it("registers HFM_MT5 provider id and analysis provenance", () => {
    expect(MARKET_PROVIDERS).toContain("HFM_MT5");
    const input = buildMt5HfmAnalysisInput({
      symbol: "EURUSD",
      timeframe: "1h",
      candles: {
        symbol: "EURUSD",
        timeframe: "1h",
        candles: [{ time: 1, open: 1, high: 2, low: 0.5, close: 1.5, tickVolume: 10, realVolume: null, spread: 1 }],
        available: true,
        source: "HFM_MT5",
        environment: "demo",
        retrievedAt: "2026-01-01T00:00:00Z",
        unavailableReason: null,
      },
      account: { server: "HFMarketsGlobal-Demo", loginHint: "••••3799" },
    });
    expect(input.provider).toBe("HFM_MT5");
    expect(input.dataSource).toBe("HFM_MT5");
    expect(input.verificationStatus).toBe("verified");
  });
});
