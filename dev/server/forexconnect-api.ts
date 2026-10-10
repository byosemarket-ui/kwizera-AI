/**
 * Phase 33–36 — ForexConnect provider bridge API.
 * GET  /api/forex/providers/forexconnect/status
 * POST /api/forex/providers/forexconnect/connect
 * POST /api/forex/providers/forexconnect/disconnect
 * GET  /api/forex/providers/forexconnect/instruments
 * GET  /api/forex/providers/forexconnect/candles?symbol=&timeframe=&limit=
 * POST /api/forex/providers/forexconnect/subscribe
 * POST /api/forex/providers/forexconnect/unsubscribe
 * GET  /api/forex/providers/forexconnect/stream/status
 * GET  /api/forex/providers/forexconnect/quotes
 * GET  /api/forex/providers/forexconnect/profiles
 * POST /api/forex/providers/forexconnect/profiles/credentials
 * POST /api/forex/providers/forexconnect/profiles/test
 * POST /api/forex/providers/forexconnect/profiles/activate
 * POST /api/forex/providers/forexconnect/profiles/discover
 * POST /api/forex/providers/forexconnect/profiles/disconnect
 *
 * Never returns passwords, tokens, or session secrets.
 * Credential mutations require Admin authorization.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  assertAdminAccess,
  rolesFromHeaders,
  adminTokenFromHeaders,
} from "../../ai/admin-control-plane/admin-auth-boundary.js";
import {
  assertNoSecretsInForexConnectPayload,
  getForexConnectBridge,
  createForexConnectBridge,
  type ForexConnectBridge,
} from "../../ai/market-data/forexconnect/client.js";
import { ForexConnectMarketDataError } from "../../ai/market-data/forexconnect/errors.js";
import { FOREXCONNECT_SUPPORTED_PROJECT_TIMEFRAMES } from "../../ai/market-data/forexconnect/timeframes.js";
import { getForexConnectSessionService } from "../../ai/market-data/forexconnect/session.js";
import { readForexConnectRuntimeProbe } from "../../ai/market-data/forexconnect/runtime-probe.js";

type SendJson = (res: ServerResponse, status: number, data: unknown) => void;

const MAX_BODY_BYTES = 8192;

let bridgeSingleton: ForexConnectBridge | null = null;

function getBridge(): ForexConnectBridge {
  bridgeSingleton ??= getForexConnectBridge();
  return bridgeSingleton;
}

function headersRecord(req: IncomingMessage): Record<string, string | string[] | undefined> {
  return req.headers as Record<string, string | string[] | undefined>;
}

function requireAdmin(
  req: IncomingMessage,
  res: ServerResponse,
  sendJson: SendJson,
  pathname: string,
): boolean {
  const decision = assertAdminAccess({
    roles: rolesFromHeaders(headersRecord(req)),
    adminToken: adminTokenFromHeaders(headersRecord(req)),
    path: pathname,
    adminApi: true,
    remoteAddress: req.socket.remoteAddress,
  });
  if (!decision.allowed) {
    sendJson(res, 403, {
      ok: false,
      error: { code: "ADMIN_FORBIDDEN", message: decision.reason },
    });
    return false;
  }
  return true;
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > MAX_BODY_BYTES) {
      throw Object.assign(new Error("Request body too large"), { code: "PAYLOAD_TOO_LARGE" });
    }
    chunks.push(buf);
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

const PROFILE_MUTATIONS = new Set([
  "/api/forex/providers/forexconnect/profiles/credentials",
  "/api/forex/providers/forexconnect/profiles/credentials/clear",
  "/api/forex/providers/forexconnect/profiles/test",
  "/api/forex/providers/forexconnect/profiles/activate",
  "/api/forex/providers/forexconnect/profiles/discover",
  "/api/forex/providers/forexconnect/profiles/disconnect",
  "/api/forex/providers/forexconnect/profiles/auth-check",
]);

export async function handleForexConnectApi(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  sendJson: SendJson,
): Promise<boolean> {
  if (!url.pathname.startsWith("/api/forex/providers/forexconnect")) return false;

  const isPost = (
    url.pathname === "/api/forex/providers/forexconnect/connect"
    || url.pathname === "/api/forex/providers/forexconnect/disconnect"
    || url.pathname === "/api/forex/providers/forexconnect/subscribe"
    || url.pathname === "/api/forex/providers/forexconnect/unsubscribe"
    || PROFILE_MUTATIONS.has(url.pathname)
  ) && req.method === "POST";

  if (!isPost && req.method !== "GET" && req.method !== "HEAD") {
    sendJson(res, 405, {
      ok: false,
      error: { code: "METHOD_NOT_ALLOWED", message: "Unsupported method for ForexConnect routes." },
    });
    return true;
  }

  const bridge = getBridge();

  try {
    if (url.pathname === "/api/forex/providers/forexconnect/profiles") {
      const session = await getForexConnectSessionService();
      const profiles = await session.getProfilesState();
      assertNoSecretsInForexConnectPayload(profiles);
      sendJson(res, 200, profiles);
      return true;
    }

    if (url.pathname === "/api/forex/providers/forexconnect/profiles/auth-check" && req.method === "POST") {
      // Authorized probe for Forex Admin UI — never returns the token.
      await readJsonBody(req);
      if (!requireAdmin(req, res, sendJson, url.pathname)) return true;
      sendJson(res, 200, {
        ok: true,
        authorized: true,
        note: "Admin API token accepted for ForexConnect credential actions.",
      });
      return true;
    }

    if (url.pathname === "/api/forex/providers/forexconnect/profiles/credentials" && req.method === "POST") {
      if (!requireAdmin(req, res, sendJson, url.pathname)) return true;
      const body = await readJsonBody(req);
      const session = await getForexConnectSessionService();
      try {
        const result = await session.saveCredentials(body.environment, {
          username: String(body.username ?? ""),
          password: String(body.password ?? ""),
        });
        assertNoSecretsInForexConnectPayload(result, process.env as Record<string, string | undefined>, [
          String(body.password ?? ""),
        ]);
        sendJson(res, 200, result);
      } catch (error) {
        const message = error instanceof Error ? error.message.slice(0, 300) : "Invalid credentials.";
        const vaultLocked = /vault|passphrase|persist/i.test(message);
        sendJson(res, vaultLocked ? 503 : 400, {
          ok: false,
          error: {
            code: vaultLocked ? "VAULT_UNAVAILABLE" : "VALIDATION_ERROR",
            message,
          },
        });
      }
      return true;
    }

    if (url.pathname === "/api/forex/providers/forexconnect/profiles/credentials/clear" && req.method === "POST") {
      if (!requireAdmin(req, res, sendJson, url.pathname)) return true;
      const body = await readJsonBody(req);
      const session = await getForexConnectSessionService();
      try {
        const result = await session.clearCredentials(body.environment);
        assertNoSecretsInForexConnectPayload(result);
        sendJson(res, 200, result);
      } catch (error) {
        sendJson(res, 400, {
          ok: false,
          error: {
            code: "VALIDATION_ERROR",
            message: error instanceof Error ? error.message.slice(0, 200) : "Clear failed.",
          },
        });
      }
      return true;
    }

    if (url.pathname === "/api/forex/providers/forexconnect/profiles/test" && req.method === "POST") {
      if (!requireAdmin(req, res, sendJson, url.pathname)) return true;
      const body = await readJsonBody(req);
      const session = await getForexConnectSessionService();
      const result = await session.testConnection(body.environment, {
        confirmSwitch: Boolean(body.confirmSwitch),
      });
      assertNoSecretsInForexConnectPayload(result);
      sendJson(res, result.ok ? 200 : (result.requiresConfirmation ? 409 : 503), result);
      return true;
    }

    if (url.pathname === "/api/forex/providers/forexconnect/profiles/activate" && req.method === "POST") {
      if (!requireAdmin(req, res, sendJson, url.pathname)) return true;
      const body = await readJsonBody(req);
      const session = await getForexConnectSessionService();
      const result = await session.activate(body.environment, {
        confirmSwitch: Boolean(body.confirmSwitch),
      });
      assertNoSecretsInForexConnectPayload(result);
      sendJson(res, result.ok ? 200 : (result.requiresConfirmation ? 409 : 503), result);
      return true;
    }

    if (url.pathname === "/api/forex/providers/forexconnect/profiles/discover" && req.method === "POST") {
      if (!requireAdmin(req, res, sendJson, url.pathname)) return true;
      const body = await readJsonBody(req);
      const session = await getForexConnectSessionService();
      const result = await session.discoverInstruments(body.environment);
      assertNoSecretsInForexConnectPayload(result);
      sendJson(res, result.ok ? 200 : 503, result);
      return true;
    }

    if (url.pathname === "/api/forex/providers/forexconnect/profiles/disconnect" && req.method === "POST") {
      if (!requireAdmin(req, res, sendJson, url.pathname)) return true;
      await readJsonBody(req);
      const session = await getForexConnectSessionService();
      const result = await session.disconnect();
      assertNoSecretsInForexConnectPayload(result);
      sendJson(res, 200, result);
      return true;
    }

    if (url.pathname === "/api/forex/providers/forexconnect/status") {
      const status = await bridge.getStatus();
      let profiles = null;
      try {
        const session = await getForexConnectSessionService();
        profiles = await session.getProfilesState();
      } catch {
        profiles = null;
      }
      const runtimeProbe = await readForexConnectRuntimeProbe();
      const payload = {
        ok: true,
        ...status,
        profiles,
        runtimeProbe,
        note: status.note
          ?? "ForexConnect status via private sidecar. Trading disabled.",
      };
      assertNoSecretsInForexConnectPayload(payload);
      sendJson(res, 200, payload);
      return true;
    }

    if (url.pathname === "/api/forex/providers/forexconnect/connect" && req.method === "POST") {
      if (!requireAdmin(req, res, sendJson, url.pathname)) return true;
      const body = await readJsonBody(req);
      // Prefer profile activate when environment is supplied; never accept client passwords here.
      if (body.environment != null) {
        const session = await getForexConnectSessionService();
        const result = await session.activate(body.environment, {
          confirmSwitch: Boolean(body.confirmSwitch),
        });
        assertNoSecretsInForexConnectPayload(result);
        sendJson(res, result.ok ? 200 : (result.requiresConfirmation ? 409 : 503), {
          ...result,
          note: "Connect uses server-side DEMO/LIVE profile credentials only.",
        });
        return true;
      }
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
      if (!requireAdmin(req, res, sendJson, url.pathname)) return true;
      await readJsonBody(req);
      const session = await getForexConnectSessionService();
      const result = await session.disconnect();
      assertNoSecretsInForexConnectPayload(result);
      sendJson(res, 200, { ok: true, ...result });
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
    const code = (error as { code?: string })?.code;
    if (code === "PAYLOAD_TOO_LARGE") {
      sendJson(res, 413, {
        ok: false,
        error: { code: "PAYLOAD_TOO_LARGE", message: "Request body too large." },
      });
      return true;
    }
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
