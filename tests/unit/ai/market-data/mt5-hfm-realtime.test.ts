import { describe, expect, it } from "vitest";
import {
  buildEnvelope,
  connectionStateFromFreshness,
  MT5_HFM_BROKER_ID,
} from "../../../../ai/market-data/mt5-hfm/event-contract";
import {
  freshnessFromAgeSec,
  isValidOhlcCandle,
  isValidQuoteTick,
} from "../../../../ai/market-data/mt5-hfm/freshness";
import { isAllowedMt5HfmAgentMethod, isForbiddenTradingMethod } from "../../../../ai/market-data/mt5-hfm/agent-protocol";
import { publicLiveGate } from "../../../../ai/market-data/mt5-hfm/live-gate";

describe("HFM MT5 Phase 1 freshness + contract", () => {
  it("labels LIVE / STALE / DISCONNECTED from acquisition age", () => {
    expect(freshnessFromAgeSec(3)).toBe("LIVE");
    expect(freshnessFromAgeSec(60)).toBe("STALE");
    expect(freshnessFromAgeSec(400)).toBe("DISCONNECTED");
    expect(freshnessFromAgeSec(5, undefined, { terminalRunning: false })).toBe("DISCONNECTED");
    expect(freshnessFromAgeSec(null)).toBe("WAITING_FOR_DATA");
    expect(freshnessFromAgeSec(2, undefined, { marketClosed: true })).toBe("MARKET_CLOSED");
  });

  it("rejects invalid ticks and never invents prices", () => {
    expect(isValidQuoteTick({ symbol: "EURUSD", bid: 1.1, ask: 1.1001 })).toBe(true);
    expect(isValidQuoteTick({ symbol: "EURUSD", bid: 1.2, ask: 1.1 })).toBe(false);
    expect(isValidQuoteTick({ symbol: "", bid: 1.1, ask: 1.2 })).toBe(false);
    expect(isValidQuoteTick({ symbol: "XAUUSD", bid: 0, ask: 1 })).toBe(false);
  });

  it("validates OHLC consistency", () => {
    expect(
      isValidOhlcCandle({ time: 1_700_000_000, open: 10, high: 12, low: 9, close: 11 }),
    ).toBe(true);
    expect(
      isValidOhlcCandle({ time: 1_700_000_000, open: 10, high: 9, low: 8, close: 9 }),
    ).toBe(false);
    expect(isValidOhlcCandle({ time: 0, open: 10, high: 12, low: 9, close: 11 })).toBe(false);
  });

  it("builds provenance envelope for HFM_MT5 Demo only", () => {
    const env = buildEnvelope(
      "quote",
      { symbol: "EURUSD", bid: 1.1, ask: 1.1002 },
      {
        eventId: "e1",
        seq: 42,
        brokerTimestamp: 1_700_000_000,
        serverReceivedAt: "2026-11-15T12:00:00Z",
        freshness: "LIVE",
        provenance: "mql5_readonly_snapshot",
      },
    );
    expect(env.broker).toBe(MT5_HFM_BROKER_ID);
    expect(env.environment).toBe("demo");
    expect(env.connectionState).toBe("connected");
    expect(env.validation).toBe("ok");
    expect(connectionStateFromFreshness("STALE")).toBe("degraded");
  });

  it("keeps stream method allowlisted and trading forbidden", () => {
    expect(isAllowedMt5HfmAgentMethod("demo.stream_snapshot")).toBe(true);
    expect(isForbiddenTradingMethod("order.buy")).toBe(true);
    expect(isAllowedMt5HfmAgentMethod("order.buy")).toBe(false);
  });

  it("preserves fail-closed Live gate (no order execution)", () => {
    const gate = publicLiveGate();
    expect(gate.ownerAuthorized).toBe(false);
    expect(gate.loginEnabled).toBe(false);
    expect(gate.orderExecutionEnabled).toBe(false);
    expect(gate.automationEnabled).toBe(false);
  });
});

