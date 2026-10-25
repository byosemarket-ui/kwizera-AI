/**
 * Phase 60.0.6 — Trade Monitor runtime verification & operational readiness contracts.
 * Uses mocks/fixtures only — never mutates a broker account.
 * Live HTTP probes are recorded separately when a local service is actually reachable.
 */
import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { requireForexAdmin } from "../../../../dev/server/forex-admin-auth.ts";
import { handleForexAutomatedTradingApi } from "../../../../dev/server/forex-automated-trading-api.ts";
import {
  isCurrentRequest,
  nextRequestId,
  safeFiniteNumber,
} from "../../../../ai/forex-ai/automated-trading/trade-history/index.ts";
import {
  buildRuntimeObservability,
  shouldMarkLastKnownStale,
} from "../../../../desktop/forex/trade-monitor/runtime-observability.ts";
import { resolveQuoteFreshnessLabel } from "../../../../desktop/forex/trade-monitor/format.ts";
import {
  forexPathFor,
  parseForexRouteFromLocation,
} from "../../../../desktop/forex/forex-routes.ts";

const root = process.cwd();
function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

describe("Phase 60.0.6 observability layers", () => {
  it("does not treat CONNECTED session as live quote proof", () => {
    const obs = buildRuntimeObservability({
      sidecarReachable: true,
      sessionStatus: "CONNECTED",
      streamState: "LIVE",
      offersListenerActive: true,
      subscriptionCount: 2,
      quoteFreshnessLabel: "QUOTE_NOT_RECEIVED",
      lastQuoteAt: null,
      updateCount: 0,
    });
    expect(obs.session).toBe("CONNECTED");
    expect(obs.poller).toBe("LISTENER_ACTIVE");
    expect(obs.quote).toBe("QUOTE_NOT_RECEIVED");
    expect(obs.mayLabelMarkLive).toBe(false);
  });

  it("allows live mark labeling only for QUOTE_RECEIVED", () => {
    const live = buildRuntimeObservability({
      sessionStatus: "CONNECTED",
      streamState: "LIVE",
      offersListenerActive: true,
      quoteFreshnessLabel: resolveQuoteFreshnessLabel({
        sessionStatus: "CONNECTED",
        streamState: "LIVE",
        lastQuoteAt: new Date().toISOString(),
        lastQuoteAgeMs: 500,
        updateCount: 3,
      }),
      lastQuoteAt: new Date().toISOString(),
      lastQuoteAgeMs: 500,
      updateCount: 3,
    });
    expect(live.quote).toBe("QUOTE_RECEIVED");
    expect(live.mayLabelMarkLive).toBe(true);

    const stale = buildRuntimeObservability({
      sessionStatus: "CONNECTED",
      quoteFreshnessLabel: "QUOTE_STALE",
      lastQuoteAt: new Date().toISOString(),
      lastQuoteAgeMs: 60_000,
      updateCount: 1,
    });
    expect(stale.mayLabelMarkLive).toBe(false);
  });

  it("marks last-known stale only when prior data exists", () => {
    expect(shouldMarkLastKnownStale(false, true)).toBe(false);
    expect(shouldMarkLastKnownStale(true, true)).toBe(true);
    expect(shouldMarkLastKnownStale(true, false)).toBe(false);
  });
});

describe("Phase 60.0.6 API auth fail-closed (Trade Monitor paths)", () => {
  const prevMode = process.env.KWIZERA_ADMIN_AUTH_MODE;
  const prevToken = process.env.KWIZERA_ADMIN_API_TOKEN;

  afterEach(() => {
    if (prevMode === undefined) delete process.env.KWIZERA_ADMIN_AUTH_MODE;
    else process.env.KWIZERA_ADMIN_AUTH_MODE = prevMode;
    if (prevToken === undefined) delete process.env.KWIZERA_ADMIN_API_TOKEN;
    else process.env.KWIZERA_ADMIN_API_TOKEN = prevToken;
  });

  it("rejects missing admin token on Trade Monitor API paths", () => {
    process.env.KWIZERA_ADMIN_AUTH_MODE = "require-admin-token";
    process.env.KWIZERA_ADMIN_API_TOKEN = "phase60-runtime-token";

    for (const pathName of [
      "/api/forex/automated-trading/broker-ro-tables",
      "/api/forex/automated-trading/trade-history",
      "/api/forex/automated-trading/trade-performance",
    ]) {
      let status = 0;
      let body: unknown = null;
      const sendJson = (_res: http.ServerResponse, code: number, data: unknown) => {
        status = code;
        body = data;
      };
      const req = {
        headers: {},
        socket: { remoteAddress: "127.0.0.1" },
      } as unknown as http.IncomingMessage;
      const res = {} as http.ServerResponse;
      expect(requireForexAdmin(req, res, sendJson, pathName)).toBe(false);
      expect(status).toBe(403);
      const err = body as { placesOrders?: boolean; error?: { code?: string } };
      expect(err.placesOrders).toBe(false);
      expect(err.error?.code).toMatch(/ADMIN|TOKEN/i);
      expect(JSON.stringify(body)).not.toContain("phase60-runtime-token");
    }
  });

  it("blocks order-like paths with EXECUTION_FORBIDDEN without calling mutation", async () => {
    process.env.KWIZERA_ADMIN_AUTH_MODE = "development-open";
    let status = 0;
    let body: unknown = null;
    const sendJson = (_res: http.ServerResponse, code: number, data: unknown) => {
      status = code;
      body = data;
    };
    const req = {
      method: "POST",
      headers: {},
      socket: { remoteAddress: "127.0.0.1" },
    } as unknown as http.IncomingMessage;
    const res = {} as http.ServerResponse;
    const url = new URL("http://localhost/api/forex/automated-trading/submit-order");
    const handled = await handleForexAutomatedTradingApi(req, res, url, sendJson);
    expect(handled).toBe(true);
    expect(status).toBe(403);
    expect((body as { error?: { code?: string } }).error?.code).toBe("EXECUTION_FORBIDDEN");
    expect((body as { placesOrders?: boolean }).placesOrders).toBe(false);
  });
});

describe("Phase 60.0.6 request race + null safety + routes", () => {
  it("ignores stale request ids", () => {
    let id = 0;
    id = nextRequestId(id);
    const first = id;
    id = nextRequestId(id);
    expect(isCurrentRequest(id, first)).toBe(false);
  });

  it("keeps null monetary values unavailable", () => {
    expect(safeFiniteNumber(null)).toBeNull();
    expect(safeFiniteNumber(0)).toBe(0);
  });

  it("keeps Trade Monitor routes separate from Automated Trading", () => {
    expect(forexPathFor("trade-monitor")).toBe("/forex/trade-monitor");
    expect(parseForexRouteFromLocation("/forex/positions")).toBe("trade-monitor");
  });
});

describe("Phase 60.0.6 wiring + safety evidence", () => {
  it("wires runtime observability and allSettled connection load", () => {
    const page = read("desktop/forex/ForexTradeMonitorPage.tsx");
    expect(page).toContain("Promise.allSettled");
    expect(page).toContain("buildRuntimeObservability");
    expect(page).toContain("shouldMarkLastKnownStale");
    expect(page).toContain('data-phase="60.0.6"');
    expect(page).toContain("data-may-label-mark-live");
    expect(page).toContain("data-quote-layer");
    expect(page).toContain("data-poller-layer");
    expect(page).not.toMatch(/openTrueMarket|createGrant|ALLOW_DEMO_MUTATION/);

    const api = read("dev/server/forex-automated-trading-api.ts");
    expect(api).toContain('phase: "60.0.6"');
    expect(api).toContain("Session CONNECTED");
    expect(api).toContain("requireForexAdmin");
    const ro = api.slice(
      api.indexOf("broker-ro-tables"),
      api.indexOf("/api/forex/automated-trading/status"),
    );
    expect(ro).toContain("pollQuotes");
    expect(ro).not.toMatch(/openTrueMarket|createGrant/);

    const service = read("ai/forex-ai/automated-trading/service.ts");
    expect(service).toContain("getDisabledBrokerMutationAdapter");
  });
});
