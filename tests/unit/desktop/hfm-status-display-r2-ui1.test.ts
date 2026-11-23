/**
 * R2-UI-1 — Charts HFM status-pane distinctions (fixtures only).
 */
import { describe, it, expect } from "vitest";
import {
  labelCandleFeed,
  labelMarketDataReadiness,
  labelMt5AgentAuth,
  labelQuoteFeed,
  labelTerminalProcess,
  statusToneClass,
} from "../../../desktop/forex/hfm-dashboard/hfm-status-display";
import { mapHfmProviderUiStatus } from "../../../desktop/forex/hfm-dashboard/market-watch/provider-status";

describe("R2-UI-1 status labels", () => {
  it("1. terminal offline while quote feed is live", () => {
    const term = labelTerminalProcess(false);
    const quote = labelQuoteFeed("LIVE");
    const ready = labelMarketDataReadiness({
      sseStatus: "connected",
      connectionState: "connected",
      freshness: "LIVE",
    });
    expect(term.text).toBe("Offline");
    expect(term.tone).toBe("bad");
    expect(quote.text).toBe("LIVE");
    expect(quote.tone).toBe("ok");
    expect(ready.text).toBe("Quote feed ready");
    expect(ready.tone).toBe("ok");
    // Provider badge follows feed, not terminal alone.
    expect(
      mapHfmProviderUiStatus({
        sseStatus: "connected",
        connectionState: "connected",
        freshness: "LIVE",
        terminalRunning: false,
        authenticated: null,
      }),
    ).toBe("CONNECTED");
    // Auth must not paint Unauthenticated solely because terminal is down.
    const auth = labelMt5AgentAuth(null, false);
    expect(auth.text).not.toMatch(/Unauthenticated/i);
    expect(auth.tone).toBe("warn");
  });

  it("2. terminal authenticated while quotes are stale", () => {
    expect(labelTerminalProcess(true).text).toBe("Online");
    expect(labelMt5AgentAuth(true, true).text).toBe("Authenticated");
    expect(labelQuoteFeed("STALE").text).toBe("STALE");
    expect(labelQuoteFeed("STALE").tone).toBe("warn");
    expect(
      labelMarketDataReadiness({
        sseStatus: "connected",
        connectionState: "degraded",
        freshness: "STALE",
      }).text,
    ).toBe("Degraded");
    expect(
      mapHfmProviderUiStatus({
        sseStatus: "connected",
        connectionState: "degraded",
        freshness: "STALE",
        terminalRunning: true,
        authenticated: true,
      }),
    ).toBe("DEGRADED");
  });

  it("3. quotes live while candles are missing", () => {
    expect(labelQuoteFeed("LIVE").tone).toBe("ok");
    const candle = labelCandleFeed({ candleBarCount: 0, quoteFeed: "LIVE" });
    expect(candle.text).toMatch(/Missing/i);
    expect(candle.tone).toBe("warn");
    expect(
      labelMarketDataReadiness({
        sseStatus: "connected",
        connectionState: "connected",
        freshness: "LIVE",
      }).tone,
    ).toBe("ok");
  });

  it("4. all data feeds healthy", () => {
    expect(labelTerminalProcess(true).tone).toBe("ok");
    expect(labelMt5AgentAuth(true, true).tone).toBe("ok");
    expect(labelQuoteFeed("LIVE").tone).toBe("ok");
    expect(
      labelCandleFeed({ candleBarCount: 120, quoteFeed: "LIVE" }).text,
    ).toContain("120");
    expect(
      labelMarketDataReadiness({
        sseStatus: "connected",
        connectionState: "connected",
        freshness: "LIVE",
      }).tone,
    ).toBe("ok");
    expect(
      mapHfmProviderUiStatus({
        sseStatus: "connected",
        connectionState: "connected",
        freshness: "LIVE",
        terminalRunning: true,
        authenticated: true,
      }),
    ).toBe("CONNECTED");
  });

  it("5. probe unavailable or timed out (null terminal/auth)", () => {
    expect(labelTerminalProcess(null).text).toBe("Unknown");
    expect(labelTerminalProcess(null).tone).toBe("warn");
    const auth = labelMt5AgentAuth(null, null);
    expect(auth.text).toMatch(/Auth unknown/i);
    expect(auth.text).not.toMatch(/Unauthenticated/i);
    expect(
      mapHfmProviderUiStatus({
        sseStatus: "idle",
        connectionState: "waiting",
        freshness: "WAITING_FOR_DATA",
        terminalRunning: null,
        authenticated: null,
      }),
    ).toBe("WAITING");
  });

  it("6. mixed provider status without false overall readiness", () => {
    // Terminal down + feed disconnected → not ready.
    expect(
      mapHfmProviderUiStatus({
        sseStatus: "connected",
        connectionState: "disconnected",
        freshness: "DISCONNECTED",
        terminalRunning: false,
        authenticated: false,
      }),
    ).toBe("DISCONNECTED");
    // Auth required is distinct.
    expect(
      mapHfmProviderUiStatus({
        sseStatus: "auth_required",
        connectionState: "waiting",
        freshness: "WAITING_FOR_DATA",
        terminalRunning: true,
        authenticated: false,
      }),
    ).toBe("AUTH_REQUIRED");
    // Explicit not authenticated only when terminal confirmed up.
    expect(labelMt5AgentAuth(false, true).text).toBe("Not authenticated");
    expect(labelMt5AgentAuth(false, false).text).not.toMatch(/Unauthenticated/i);
    expect(statusToneClass("ok")).toBe("hfm-ok");
    expect(statusToneClass("bad")).toBe("hfm-bad");
  });
});
