/**
 * Phase 33/34 — ForexConnect provider bridge API.
 * GET  /api/forex/providers/forexconnect/status
 * POST /api/forex/providers/forexconnect/connect
 * POST /api/forex/providers/forexconnect/disconnect
 * GET  /api/forex/providers/forexconnect/instruments
 * GET  /api/forex/providers/forexconnect/candles?symbol=&timeframe=&limit=
 * POST /api/forex/providers/forexconnect/subscribe
 * POST /api/forex/providers/forexconnect/unsubscribe
 * GET  /api/forex/providers/forexconnect/stream/status
 * GET  /api/forex/providers/forexconnect/quotes
 *
 * Never returns passwords, tokens, or session secrets.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  assertNoSecretsInForexConnectPayload,
  getForexConnectBridge,
  createForexConnectBridge,
  type ForexConnectBridge,
} from "../../ai/market-data/forexconnect/client.js";
import { ForexConnectMarketDataError } from "../../ai/market-data/forexconnect/errors.js";
import { FOREXCONNECT_SUPPORTED_PROJECT_TIMEFRAMES } from "../../ai/market-data/forexconnect/timeframes.js";

type SendJson = (res: ServerResponse, status: number, data: unknown) => void;

let bridgeSingleton: ForexConnectBridge | null = null;

function getBridge(): ForexConnectBridge {
  bridgeSingleton ??= getForexConnectBridge();
  return bridgeSingleton;
}

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

export async function handleForexConnectApi(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  sendJson: SendJson,
): Promise<boolean> {
  if (!url.pathname.startsWith("/api/forex/providers/forexconnect")) return false;

  const isPost =
    (url.pathname === "/api/forex/providers/forexconnect/connect"
      || url.pathname === "/api/forex/providers/forexconnect/disconnect"
      || url.pathname === "/api/forex/providers/forexconnect/subscribe"
      || url.pathname === "/api/forex/providers/forexconnect/unsubscribe")
    && req.method === "POST";

  if (!isPost && req.method !== "GET" && req.method !== "HEAD") {
    sendJson(res, 405, {
      ok: false,
      error: { code: "METHOD_NOT_ALLOWED", message: "Unsupported method for ForexConnect routes." },
    });
    return true;
  }

  const bridge = getBridge();

  try {
    if (url.pathname === "/api/forex/providers/forexconnect/status") {
      const status = await bridge.getStatus();
      assertNoSecretsInForexConnectPayload(status);
      sendJson(res, 200, {
        ok: true,
        ...status,
        note: status.note
          ?? "ForexConnect status via private sidecar. Trading disabled.",
      });
      return true;
    }

    if (url.pathname === "/api/forex/providers/forexconnect/connect" && req.method === "POST") {
      await readJsonBody(req); // ignore any client-supplied secrets
      const status = await bridge.connect();
      assertNoSecretsInForexConnectPayload(status);
      const http = status.status === "CONNECTED" ? 200 : 503;
      sendJson(res, http, {
        ok: status.status === "CONNECTED",
        ...status,
        note: "Connect uses server-side KWIZERA_FOREXCONNECT_* credentials only.",
      });
      return true;
    }

    if (url.pathname === "/api/forex/providers/forexconnect/disconnect" && req.method === "POST") {
      await readJsonBody(req);
      const status = await bridge.disconnect();
      assertNoSecretsInForexConnectPayload(status);
      sendJson(res, 200, { ok: true, ...status });
      return true;
    }

    if (url.pathname === "/api/forex/providers/forexconnect/instruments") {
      const result = await bridge.listInstruments();
      assertNoSecretsInForexConnectPayload(result);
      if (!result.ok) {
        sendJson(res, 503, {
          ok: false,
          error: result.error,
          status: result.status,
        });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        count: result.count,
        instruments: result.instruments,
        fetchedAt: result.fetchedAt,
        status: result.status,
        note: result.note,
      });
      return true;
    }

    if (url.pathname === "/api/forex/providers/forexconnect/stream/status") {
      const status = await bridge.getStreamStatus();
      assertNoSecretsInForexConnectPayload(status);
      sendJson(res, status.ok ? 200 : 503, status);
      return true;
    }

    if (url.pathname === "/api/forex/providers/forexconnect/quotes") {
      try {
        const quotes = await bridge.pollQuotes();
        assertNoSecretsInForexConnectPayload(quotes);
        sendJson(res, 200, {
          ok: true,
          count: quotes.length,
          quotes,
          priceBasis: "bid",
          note: "Latest Offers-table quotes for subscribed instruments only.",
        });
      } catch (error) {
        if (error instanceof ForexConnectMarketDataError) {
          sendJson(res, 503, {
            ok: false,
            error: { code: error.code, message: error.message },
            quotes: [],
            count: 0,
          });
          return true;
        }
        throw error;
      }
      return true;
    }

    if (url.pathname === "/api/forex/providers/forexconnect/subscribe" && req.method === "POST") {
      const body = await readJsonBody(req);
      const symbol = String(body.symbol ?? "").trim();
      const result = await bridge.subscribeQuotes(symbol);
      assertNoSecretsInForexConnectPayload(result);
      sendJson(res, result.ok ? 200 : 503, result);
      return true;
    }

    if (url.pathname === "/api/forex/providers/forexconnect/unsubscribe" && req.method === "POST") {
      const body = await readJsonBody(req);
      const symbol = String(body.symbol ?? "").trim();
      await bridge.unsubscribeQuotes(symbol);
      sendJson(res, 200, { ok: true, provider: "FOREXCONNECT", subscribed: false, symbol });
      return true;
    }

    if (url.pathname === "/api/forex/providers/forexconnect/candles") {
      const symbol = url.searchParams.get("symbol") ?? "";
      const timeframe = url.searchParams.get("timeframe") ?? "";
      const limitRaw = url.searchParams.get("limit");
      const limit = limitRaw != null ? Number(limitRaw) : 50;
      try {
        const result = await bridge.getHistoricalCandles({ symbol, timeframe, limit });
        assertNoSecretsInForexConnectPayload(result);
        sendJson(res, 200, {
          ok: true,
          ...result,
          supportedTimeframes: [...FOREXCONNECT_SUPPORTED_PROJECT_TIMEFRAMES],
        });
        return true;
      } catch (error) {
        if (error instanceof ForexConnectMarketDataError) {
          const http = error.code.includes("UNSUPPORTED") || error.code.includes("INVALID")
            ? 400
            : error.code.includes("DISABLED") || error.code.includes("NOT_CONFIGURED")
              ? 503
              : 502;
          sendJson(res, http, {
            ok: false,
            error: { code: error.code, message: error.message },
            provider: "FOREXCONNECT",
            candles: [],
            count: 0,
          });
          return true;
        }
        throw error;
      }
    }

    sendJson(res, 404, {
      ok: false,
      error: { code: "NOT_FOUND", message: "Unknown ForexConnect route." },
    });
    return true;
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: {
        code: "FOREXCONNECT_ERROR",
        message: error instanceof Error ? error.message.slice(0, 300) : "ForexConnect bridge failed.",
      },
    });
    return true;
  }
}

/** Test helper */
export function createForexConnectApiBridge(
  options?: ConstructorParameters<typeof ForexConnectBridge>[0],
): ForexConnectBridge {
  return createForexConnectBridge(options);
}
