/**
 * Phase 25–27 — Market-data provider registry API.
 * GET  /api/forex/providers
 * GET  /api/forex/providers/fxcm/status
 * POST /api/forex/providers/fxcm/authenticate  (safe status only)
 * GET  /api/forex/providers/fxcm/instruments   (discovery + mapping)
 *
 * Never returns FXCM tokens, passwords, or Authorization headers.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { assertSafeAuthStatus } from "../../ai/market-data/fxcm/auth-service.js";
import { readFxcmAccessToken } from "../../ai/market-data/fxcm/config.js";
import { assertSafeDiscoveryPayload } from "../../ai/market-data/fxcm/instrument-mapper.js";
import { userFacingFxcmError } from "../../ai/market-data/fxcm/errors.js";
import { getMarketDataProviderRegistry } from "../../ai/market-data/providers/index.js";

type SendJson = (res: ServerResponse, status: number, data: unknown) => void;

export async function handleForexProvidersApi(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  sendJson: SendJson,
): Promise<boolean> {
  if (!url.pathname.startsWith("/api/forex/providers")) return false;

  const isAuthPost = url.pathname === "/api/forex/providers/fxcm/authenticate" && req.method === "POST";
  if (!isAuthPost && req.method !== "GET" && req.method !== "HEAD") {
    sendJson(res, 405, {
      ok: false,
      error: { code: "METHOD_NOT_ALLOWED", message: "Unsupported method for provider routes." },
    });
    return true;
  }

  const registry = getMarketDataProviderRegistry();

  try {
    if (url.pathname === "/api/forex/providers") {
      const snapshot = await registry.snapshot();
      sendJson(res, 200, {
        ok: true,
        ...snapshot,
        note: "FXCM Phase 27 — instrument discovery; live stream and trading are not enabled.",
      });
      return true;
    }

    if (url.pathname === "/api/forex/providers/fxcm/status") {
      const fxcm = registry.getFxcm();
      const force = url.searchParams.get("authenticate") === "1";
      if (force) {
        await fxcm.authenticate({ force: true });
      }
      const health = await fxcm.healthCheck();
      const info = fxcm.getProviderInfo();
      const authentication = fxcm.getSafeAuthenticationStatus();
      assertSafeAuthStatus(authentication, readFxcmAccessToken());
      sendJson(res, health.status === "CONNECTED" || health.status === "NOT_CONFIGURED" || health.status === "DISABLED" ? 200 : 503, {
        ok: health.status !== "ERROR" && health.status !== "AUTHENTICATION_ERROR" && health.status !== "NETWORK_ERROR",
        provider: info,
        health,
        authentication,
        capabilities: fxcm.getCapabilities(),
        liveStream: "NOT_ENABLED_YET",
        trading: "DISABLED",
        marketData: "NOT_STARTED",
        note: "FXCM authenticated — market streaming not enabled in this phase.",
      });
      return true;
    }

    if (isAuthPost) {
      const fxcm = registry.getFxcm();
      const authentication = await fxcm.authenticate({ force: true });
      assertSafeAuthStatus(authentication, readFxcmAccessToken());
      const state = authentication.authentication.state;
      const ok = state === "AUTHENTICATED" || state === "DISABLED" || state === "NOT_CONFIGURED";
      sendJson(res, ok ? 200 : 503, {
        ok: state === "AUTHENTICATED",
        authentication,
        liveStream: "NOT_ENABLED_YET",
        trading: "DISABLED",
        marketData: "NOT_STARTED",
        note: "Authentication test only — does not enable live market data.",
      });
      return true;
    }

    if (url.pathname === "/api/forex/providers/fxcm/instruments") {
      const fxcm = registry.getFxcm();
      const refresh = url.searchParams.get("refresh") === "1";
      const discovery = await fxcm.discoverInstruments({
        refresh,
        marketType: url.searchParams.get("marketType"),
        search: url.searchParams.get("search") ?? url.searchParams.get("q"),
        status: url.searchParams.get("status"),
        baseAsset: url.searchParams.get("baseAsset"),
        quoteAsset: url.searchParams.get("quoteAsset"),
        mappingStatus: url.searchParams.get("mappingStatus"),
      });
      assertSafeDiscoveryPayload(discovery, readFxcmAccessToken());

      const httpOk = discovery.discoveryStatus === "READY"
        || discovery.discoveryStatus === "DISABLED"
        || discovery.discoveryStatus === "NOT_CONFIGURED"
        || (discovery.source === "CACHED" && discovery.count > 0);

      sendJson(res, httpOk ? 200 : 503, {
        ok: discovery.discoveryStatus === "READY" || discovery.source === "CACHED",
        provider: discovery.provider,
        environment: discovery.environment,
        environmentLabel: discovery.environmentLabel,
        discoveryStatus: discovery.discoveryStatus,
        freshness: discovery.freshness,
        source: discovery.source,
        fetchedAt: discovery.fetchedAt,
        count: discovery.count,
        instruments: discovery.instruments,
        conflicts: discovery.conflicts,
        authenticationState: discovery.authenticationState,
        marketData: discovery.marketData,
        liveStream: discovery.liveStream,
        trading: discovery.trading,
        errorCode: discovery.errorCode,
        errorMessage: discovery.errorMessage,
        note: discovery.note,
      });
      return true;
    }

    // Optional single-instrument lookup: /api/forex/providers/fxcm/instruments/:symbol
    const instrumentMatch = url.pathname.match(/^\/api\/forex\/providers\/fxcm\/instruments\/(.+)$/);
    if (instrumentMatch) {
      const fxcm = registry.getFxcm();
      const symbol = decodeURIComponent(instrumentMatch[1] ?? "").trim();
      if (!symbol) {
        sendJson(res, 400, {
          ok: false,
          error: { code: "FXCM_INVALID_SYMBOL", message: "Symbol is required." },
        });
        return true;
      }
      const discovery = await fxcm.discoverInstruments({ search: symbol });
      assertSafeDiscoveryPayload(discovery, readFxcmAccessToken());
      const exact = discovery.instruments.find((i) =>
        i.providerSymbol === symbol
        || i.canonicalSymbol === symbol.toUpperCase().replace(/[^A-Z0-9]/g, "")
        || i.displaySymbol === symbol
      ) ?? null;
      if (!exact) {
        sendJson(res, 404, {
          ok: false,
          error: { code: "FXCM_INSTRUMENT_NOT_FOUND", message: "Instrument not found in FXCM catalog." },
          provider: "FXCM",
          environmentLabel: discovery.environmentLabel,
          discoveryStatus: discovery.discoveryStatus,
        });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        provider: "FXCM",
        environment: discovery.environment,
        environmentLabel: discovery.environmentLabel,
        source: discovery.source,
        fetchedAt: discovery.fetchedAt,
        instrument: exact,
        marketData: "NOT_STARTED",
        liveStream: "NOT_ENABLED_YET",
        trading: "DISABLED",
        note: "Instrument metadata only — no live prices in Phase 27.",
      });
      return true;
    }

    sendJson(res, 404, {
      ok: false,
      error: { code: "NOT_FOUND", message: "Unknown forex providers route." },
    });
    return true;
  } catch (error) {
    const mapped = userFacingFxcmError(error);
    sendJson(res, 503, {
      ok: false,
      error: { code: mapped.code, message: mapped.message },
    });
    return true;
  }
}
