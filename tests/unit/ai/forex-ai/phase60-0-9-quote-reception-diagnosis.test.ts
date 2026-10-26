/**
 * Phase 60.0.9 — quote reception diagnosis regressions.
 * Does not claim LIVE from fixtures. Never places orders.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildRuntimeObservability,
  classifyQuoteLayer,
} from "../../../../desktop/forex/trade-monitor/runtime-observability.ts";
import { resolveQuoteFreshnessLabel } from "../../../../desktop/forex/trade-monitor/format.ts";

const root = path.resolve(process.cwd());

function read(relative: string): string {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

describe("Phase 60.0.9 quote reception diagnosis", () => {
  it("sidecar does not stamp lastPollChangeAt on same-price heartbeats", () => {
    const sidecar = read("services/forexconnect-sidecar/server.py");
    expect(sidecar).toContain("lastPollHeartbeatAt");
    expect(sidecar).toContain("Do not stamp lastPollChangeAt");
    expect(sidecar).toContain('event_source == "offers-table-diff"');
    expect(sidecar).toContain("_stream[\"lastPollHeartbeatAt\"]");
    expect(sidecar).toContain("offersSnapshotPresent");
    expect(sidecar).toContain("offersSnapshotCount");
    expect(sidecar).toMatch(
      /MARKET_INACTIVE means no bid\/ask tick[\s\S]*offersSnapshotPresent may still be true/,
    );
    // Heartbeat path must not assign lastPollChangeAt (ends at first return False).
    const heartStart = sidecar.indexOf("Same bid/ask: refresh receipt time");
    const heartEnd = sidecar.indexOf("return False", heartStart);
    expect(heartStart).toBeGreaterThan(-1);
    expect(heartEnd).toBeGreaterThan(heartStart);
    const heartBlock = sidecar.slice(heartStart, heartEnd);
    expect(heartBlock).toContain("lastPollHeartbeatAt");
    expect(heartBlock).toContain("Do not stamp lastPollChangeAt");
    expect(heartBlock).not.toMatch(/_stream\["lastPollChangeAt"\]\s*=/);
  });

  it("client and types forward snapshot vs tick diagnostics", () => {
    const types = read("ai/market-data/forexconnect/live-types.ts");
    expect(types).toContain("offersSnapshotPresent");
    expect(types).toContain("lastPollHeartbeatAt");
    const client = read("ai/market-data/forexconnect/client.ts");
    expect(client).toContain("offersSnapshotPresent");
    expect(client).toContain("lastPollHeartbeatAt");
  });

  it("MARKET_INACTIVE never labels marks LIVE even when Offers snapshot exists", () => {
    expect(resolveQuoteFreshnessLabel({
      sessionStatus: "CONNECTED",
      streamState: "MARKET_INACTIVE",
      lastQuoteAt: null,
      updateCount: 0,
    })).toBe("MARKET_INACTIVE");
    expect(classifyQuoteLayer({
      quoteFreshnessLabel: "MARKET_INACTIVE",
      lastQuoteAt: null,
      updateCount: 0,
    })).toBe("UNAVAILABLE");
    const obs = buildRuntimeObservability({
      sidecarReachable: true,
      sessionStatus: "CONNECTED",
      streamState: "MARKET_INACTIVE",
      offersListenerActive: true,
      subscriptionCount: 1,
      quoteFreshnessLabel: "MARKET_INACTIVE",
      lastQuoteAt: null,
      updateCount: 0,
    });
    expect(obs.session).toBe("CONNECTED");
    expect(obs.poller).toBe("MARKET_INACTIVE");
    expect(obs.quote).toBe("UNAVAILABLE");
    expect(obs.mayLabelMarkLive).toBe(false);
  });

  it("Trade Monitor surfaces Offers snapshot separately from lastQuoteAt", () => {
    const page = read("desktop/forex/ForexTradeMonitorPage.tsx");
    expect(page).toContain("offersSnapshotPresent");
    expect(page).toContain("data-offers-snapshot");
    expect(page).toContain("present (not LIVE proof)");
    const types = read("desktop/forex/trade-monitor/types.ts");
    expect(types).toContain("offersSnapshotPresent");
  });

  it("preserves single-listener architecture and trading locks", () => {
    const sidecar = read("services/forexconnect-sidecar/server.py");
    expect(sidecar).toContain("Common.subscribe_table_updates");
    expect(sidecar).toContain("_ensure_offers_listener_locked");
    expect(sidecar).not.toMatch(/subscribe_table_updates\([\s\S]{0,80}subscribe_table_updates\(/);
    const service = read("ai/forex-ai/automated-trading/service.ts");
    expect(service).toContain("DisabledBrokerMutationAdapter");
    expect(service).toMatch(/placesOrders:\s*false/);
  });
});
