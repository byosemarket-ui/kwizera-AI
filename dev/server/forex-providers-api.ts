/**
 * Phase 25–29 — Market-data provider registry API.
 * GET  /api/forex/providers
 * GET  /api/forex/providers/fxcm/status
 * POST /api/forex/providers/fxcm/authenticate  (safe status only)
 * GET  /api/forex/providers/fxcm/instruments   (discovery + mapping)
 * GET  /api/forex/providers/fxcm/historical
 * GET  /api/forex/providers/fxcm/stream/status
 * GET  /api/forex/providers/fxcm/quotes
 * POST /api/forex/providers/fxcm/stream/subscribe
 * POST /api/forex/providers/fxcm/stream/unsubscribe
 *
 * Never returns FXCM tokens, passwords, or Authorization headers.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { assertSafeAuthStatus } from "../../ai/market-data/fxcm/auth-service.js";
import { readFxcmAccessToken } from "../../ai/market-data/fxcm/config.js";
import { assertSafeDiscoveryPayload } from "../../ai/market-data/fxcm/instrument-mapper.js";
import { assertSafeHistoricalPayload } from "../../ai/market-data/fxcm/historical-normalize.js";
import { assertSafeStreamPayload } from "../../ai/market-data/fxcm/stream-normalize.js";
import { FxcmMarketDataError, userFacingFxcmError } from "../../ai/market-data/fxcm/errors.js";
import { getMarketDataProviderRegistry } from "../../ai/market-data/providers/index.js";

type SendJson = (res: ServerResponse, status: number, data: unknown) => void;

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

export async function handleForexProvidersApi(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  sendJson: SendJson,
): Promise<boolean> {
  if (!url.pathname.startsWith("/api/forex/providers")) return false;

  const isAuthPost = url.pathname === "/api/forex/providers/fxcm/authenticate" && req.method === "POST";
  const isStreamPost =
    (url.pathname === "/api/forex/providers/fxcm/stream/subscribe"
      || url.pathname === "/api/forex/providers/fxcm/stream/unsubscribe")
    && req.method === "POST";
  if (!isAuthPost && !isStreamPost && req.method !== "GET" && req.method !== "HEAD") {
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
        note: "FXCM Phase 29 — historical candles + real-time quotes; live candles and trading are not enabled.",
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
      const stream = fxcm.getStreamStatus();
      assertSafeAuthStatus(authentication, readFxcmAccessToken());
      assertSafeStreamPayload(stream, readFxcmAccessToken());
      sendJson(res, health.status === "CONNECTED" || health.status === "NOT_CONFIGURED" || health.status === "DISABLED" ? 200 : 503, {
        ok: health.status !== "ERROR" && health.status !== "AUTHENTICATION_ERROR" && health.status !== "NETWORK_ERROR",
        provider: info,
        health,
        authentication,
        stream,
        capabilities: fxcm.getCapabilities(),
        liveStream: stream.liveStream,
        trading: "DISABLED",
        marketData: stream.marketData,
        note: "FXCM Phase 29 — real-time quotes enabled; live candles not enabled.",
      });
      return true;
    }

    if (url.pathname === "/api/forex/providers/fxcm/stream/status") {
      const fxcm = registry.getFxcm();
      const stream = fxcm.getStreamStatus();
      assertSafeStreamPayload(stream, readFxcmAccessToken());
      const ok = stream.stream.streamState !== "ERROR"
        && stream.stream.streamState !== "AUTHENTICATION_ERROR"
        && stream.stream.streamState !== "NETWORK_ERROR";
      sendJson(res, ok || stream.stream.streamState === "DISABLED" || stream.stream.streamState === "NOT_CONFIGURED" ? 200 : 503, {
        ok: true,
        ...stream,
      });
      return true;
    }

    if (url.pathname === "/api/forex/providers/fxcm/quotes") {
      const fxcm = registry.getFxcm();
      const symbol = (url.searchParams.get("symbol") ?? "").trim();
      const stream = fxcm.getStreamStatus();
      assertSafeStreamPayload(stream, readFxcmAccessToken());
      const quotes = symbol
        ? stream.quotes.filter((q) =>
          q.providerSymbol === symbol
          || q.canonicalSymbol === symbol.toUpperCase().replace(/[^A-Z0-9]/g, "")
          || q.displaySymbol === symbol
        )
        : stream.quotes;
      sendJson(res, 200, {
        ok: true,
        provider: "FXCM",
        environment: stream.environment,
        environmentLabel: stream.environmentLabel,
        streamState: stream.stream.streamState,
        count: quotes.length,
        quotes,
        mode: "REALTIME_QUOTE",
        trading: "DISABLED",
        note: "Normalized FXCM quotes only — no raw protocol payloads, no credentials.",
      });
      return true;
    }

    if (url.pathname === "/api/forex/providers/fxcm/stream/subscribe" && req.method === "POST") {
      const fxcm = registry.getFxcm();
      const body = await readJsonBody(req);
      const symbol = String(body.symbol ?? url.searchParams.get("symbol") ?? "").trim();
      try {
        const subscription = await fxcm.subscribeQuote(symbol);
        const stream = fxcm.getStreamStatus();
        assertSafeStreamPayload({ subscription, stream }, readFxcmAccessToken());
        sendJson(res, 200, {
          ok: true,
          provider: "FXCM",
          subscription,
          quote: stream.quotes.find((q) => q.providerSymbol === subscription.providerSymbol) ?? null,
          streamState: stream.stream.streamState,
          mode: "REALTIME_QUOTE",
          trading: "DISABLED",
          note: "Subscribed via official FXCM POST /subscribe. LIVE only after a valid quote event.",
        });
        return true;
      } catch (error) {
        const mapped = userFacingFxcmError(error);
        const code = error instanceof FxcmMarketDataError ? error.code : mapped.code;
        const status =
          code === "FXCM_INVALID_SYMBOL" ? 400
            : code === "FXCM_INSTRUMENT_NOT_FOUND" ? 404
              : code === "FXCM_MAPPING_CONFLICT" ? 409
                : code === "FXCM_MAPPING_UNRESOLVED" ? 422
                  : code === "FXCM_DISABLED" || code === "FXCM_NOT_CONFIGURED" ? 503
                    : code === "FXCM_AUTHENTICATION_FAILED" ? 503
                      : code === "FXCM_RATE_LIMITED" ? 429
                        : 503;
        sendJson(res, status, {
          ok: false,
          error: { code, message: mapped.message },
          provider: "FXCM",
          mode: "REALTIME_QUOTE",
          trading: "DISABLED",
        });
        return true;
      }
    }

    if (url.pathname === "/api/forex/providers/fxcm/stream/unsubscribe" && req.method === "POST") {
      const fxcm = registry.getFxcm();
      const body = await readJsonBody(req);
      const symbol = String(body.symbol ?? url.searchParams.get("symbol") ?? "").trim();
      if (!symbol) {
        sendJson(res, 400, {
          ok: false,
          error: { code: "FXCM_INVALID_SYMBOL", message: "Symbol is required." },
        });
        return true;
      }
      await fxcm.unsubscribeQuote(symbol);
      const stream = fxcm.getStreamStatus();
      assertSafeStreamPayload(stream, readFxcmAccessToken());
      sendJson(res, 200, {
        ok: true,
        provider: "FXCM",
        symbol,
        streamState: stream.stream.streamState,
        subscriptions: stream.subscriptions,
        mode: "REALTIME_QUOTE",
        trading: "DISABLED",
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
        liveStream: fxcm.getStreamStatus().liveStream,
        trading: "DISABLED",
        marketData: fxcm.getStreamStatus().marketData,
        note: "Authentication test only — does not by itself imply LIVE quotes.",
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

      // DISABLED / NOT_CONFIGURED are truthful configuration states (HTTP 200), not transport failures.
      const configState = discovery.discoveryStatus === "DISABLED"
        || discovery.discoveryStatus === "NOT_CONFIGURED";
      const readyOrCached = discovery.discoveryStatus === "READY"
        || (discovery.source === "CACHED" && discovery.count > 0);
      const httpOk = configState || readyOrCached;

      sendJson(res, httpOk ? 200 : 503, {
        ok: configState || readyOrCached,
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

    if (url.pathname === "/api/forex/providers/fxcm/historical") {
      const fxcm = registry.getFxcm();
      const symbol = (url.searchParams.get("symbol") ?? "").trim();
      const timeframe = (url.searchParams.get("timeframe") ?? url.searchParams.get("interval") ?? "").trim();
      const startRaw = url.searchParams.get("start") ?? url.searchParams.get("startTime");
      const endRaw = url.searchParams.get("end") ?? url.searchParams.get("endTime");
      const limitRaw = url.searchParams.get("limit");
      const refresh = url.searchParams.get("refresh") === "1";

      const parseTime = (raw: string | null): number | null => {
        if (raw == null || raw === "") return null;
        if (/^\d+$/.test(raw)) {
          const n = Number(raw);
          // Accept seconds or milliseconds
          return n < 1e12 ? n * 1000 : n;
        }
        const ms = Date.parse(raw);
        return Number.isFinite(ms) ? ms : Number.NaN;
      };

      try {
        const startTimeMs = parseTime(startRaw);
        const endTimeMs = parseTime(endRaw);
        if (startRaw && !Number.isFinite(startTimeMs as number)) {
          sendJson(res, 400, {
            ok: false,
            error: { code: "FXCM_INVALID_RANGE", message: "Invalid start time." },
          });
          return true;
        }
        if (endRaw && !Number.isFinite(endTimeMs as number)) {
          sendJson(res, 400, {
            ok: false,
            error: { code: "FXCM_INVALID_RANGE", message: "Invalid end time." },
          });
          return true;
        }
        const result = await fxcm.getHistoricalCandles({
          symbol,
          timeframe,
          startTimeMs,
          endTimeMs,
          limit: limitRaw != null && limitRaw !== "" ? Number(limitRaw) : null,
          refresh,
        });
        assertSafeHistoricalPayload(result, readFxcmAccessToken());
        sendJson(res, 200, {
          ok: true,
          ...result,
        });
        return true;
      } catch (error) {
        const mapped = userFacingFxcmError(error);
        const code = error instanceof FxcmMarketDataError ? error.code : mapped.code;
        const status =
          code === "FXCM_INVALID_SYMBOL" || code === "FXCM_INVALID_RANGE" ? 400
            : code === "FXCM_UNSUPPORTED_TIMEFRAME" ? 422
              : code === "FXCM_INSTRUMENT_NOT_FOUND" || code === "FXCM_OFFER_NOT_FOUND" ? 404
                : code === "FXCM_MAPPING_CONFLICT" ? 409
                  : code === "FXCM_MAPPING_UNRESOLVED" ? 422
                    : code === "FXCM_AUTHENTICATION_FAILED" ? 503
                      : code === "FXCM_DISABLED" || code === "FXCM_NOT_CONFIGURED" ? 503
                        : 503;
        sendJson(res, status, {
          ok: false,
          error: { code, message: mapped.message },
          provider: "FXCM",
          mode: "HISTORICAL",
          liveStream: fxcm.getStreamStatus().liveStream,
          trading: "DISABLED",
        });
        return true;
      }
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
        marketData: "METADATA",
        liveStream: fxcm.getStreamStatus().liveStream,
        trading: "DISABLED",
        note: "Instrument metadata — subscribe via /stream/subscribe for real-time quotes.",
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
      trading: "DISABLED",
    });
    return true;
  }
}
