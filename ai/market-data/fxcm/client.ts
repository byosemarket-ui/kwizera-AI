/**
 * Minimal FXCM Socket REST client for Phase 25 foundation.
 *
 * Official auth flow (Socket REST API):
 * 1) Engine.IO polling handshake with access_token → socket sid
 * 2) HTTP GET /trading/get_instruments with Authorization: Bearer {sid}{token}
 *
 * Does NOT subscribe to price streams, candles, or trading endpoints.
 */
import type { FxcmConfig } from "./config.js";
import { FXCM_REST_PATHS, readFxcmAccessToken } from "./config.js";
import { FxcmMarketDataError } from "./errors.js";
import type { FxcmSessionHandle } from "./types.js";

export type FetchLike = typeof fetch;

function withTimeout(ms: number): AbortSignal {
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms).unref?.();
  return ctrl.signal;
}

/**
 * Parse Engine.IO v3 open packet from polling transport.
 * Sample: 97:0{"sid":"HHGqC3Gao2ENa5tNAAEu","upgrades":["websocket"],...}
 */
export function parseEngineIoSid(body: string): string | null {
  const text = String(body ?? "").trim();
  // Find JSON object containing sid
  const jsonMatch = text.match(/\{[\s\S]*"sid"\s*:\s*"([^"]+)"[\s\S]*\}/);
  if (jsonMatch?.[1]) return jsonMatch[1];
  try {
    // Sometimes response is pure JSON after length prefix
    const start = text.indexOf("{");
    if (start >= 0) {
      const obj = JSON.parse(text.slice(start)) as { sid?: string };
      if (obj.sid) return String(obj.sid);
    }
  } catch {
    // ignore
  }
  return null;
}

export async function openFxcmSession(
  config: FxcmConfig,
  options?: {
    env?: Record<string, string | undefined>;
    fetchImpl?: FetchLike;
  },
): Promise<FxcmSessionHandle> {
  if (!config.enabled) {
    throw new FxcmMarketDataError("FXCM_DISABLED", "FXCM market data is disabled.");
  }
  const token = readFxcmAccessToken(options?.env);
  if (!token) {
    throw new FxcmMarketDataError("FXCM_NOT_CONFIGURED", "FXCM access token is not configured.");
  }

  const fetchImpl = options?.fetchImpl ?? fetch;
  const url = new URL(FXCM_REST_PATHS.socketIo, `${config.restBaseUrl}/`);
  url.searchParams.set("access_token", token);
  url.searchParams.set("EIO", "3");
  url.searchParams.set("transport", "polling");
  url.searchParams.set("b64", "1");

  let res: Response;
  try {
    res = await fetchImpl(url.toString(), {
      method: "GET",
      headers: {
        Accept: "*/*",
        "User-Agent": "kwizera-ai-studio/fxcm-foundation",
      },
      signal: withTimeout(config.timeoutMs),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (/abort|timeout/i.test(msg)) {
      throw new FxcmMarketDataError("FXCM_TIMEOUT", "FXCM authentication handshake timed out.");
    }
    throw new FxcmMarketDataError("FXCM_CONNECTION_FAILED", "FXCM authentication handshake failed.");
  }

  if (res.status === 401 || res.status === 403) {
    throw new FxcmMarketDataError("FXCM_AUTHENTICATION_FAILED", "FXCM authentication rejected.", res.status);
  }
  if (res.status === 429) {
    throw new FxcmMarketDataError("FXCM_RATE_LIMITED", "FXCM rate limited the request.", res.status);
  }
  if (!res.ok) {
    throw new FxcmMarketDataError(
      "FXCM_CONNECTION_FAILED",
      `FXCM handshake HTTP ${res.status}.`,
      res.status,
    );
  }

  const body = await res.text();
  const socketId = parseEngineIoSid(body);
  if (!socketId) {
    throw new FxcmMarketDataError(
      "FXCM_AUTHENTICATION_FAILED",
      "FXCM handshake did not return a session id.",
    );
  }

  // Official Authorization format: Bearer + socket_id + api_token (no separator).
  return {
    socketId,
    restBaseUrl: config.restBaseUrl,
    authorizationHeader: `Bearer ${socketId}${token}`,
  };
}

export async function fxcmGetInstruments(
  config: FxcmConfig,
  session: FxcmSessionHandle,
  options?: { fetchImpl?: FetchLike },
): Promise<unknown> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const url = new URL(FXCM_REST_PATHS.getInstruments, `${config.restBaseUrl}/`);
  let res: Response;
  try {
    res = await fetchImpl(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: session.authorizationHeader,
        "User-Agent": "kwizera-ai-studio/fxcm-foundation",
      },
      signal: withTimeout(config.timeoutMs),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (/abort|timeout/i.test(msg)) {
      throw new FxcmMarketDataError("FXCM_TIMEOUT", "FXCM instrument request timed out.");
    }
    throw new FxcmMarketDataError("FXCM_NETWORK", "Could not reach FXCM instruments endpoint.");
  }

  if (res.status === 401 || res.status === 403) {
    throw new FxcmMarketDataError("FXCM_AUTHENTICATION_FAILED", "FXCM instrument request unauthorized.", res.status);
  }
  if (res.status === 429) {
    throw new FxcmMarketDataError("FXCM_RATE_LIMITED", "FXCM rate limited instruments request.", res.status);
  }
  if (!res.ok) {
    throw new FxcmMarketDataError("FXCM_UNAVAILABLE", `FXCM instruments HTTP ${res.status}.`, res.status);
  }

  const json = await res.json().catch(() => null);
  if (!json || typeof json !== "object") {
    throw new FxcmMarketDataError("FXCM_INVALID_RESPONSE", "FXCM instruments response was not JSON.");
  }
  const executed = (json as { response?: { executed?: boolean } }).response?.executed;
  if (executed === false) {
    throw new FxcmMarketDataError("FXCM_UNAVAILABLE", "FXCM instruments request was not executed.");
  }
  return json;
}

/** Phase 25 explicitly rejects trading/order endpoints. */
export function assertFxcmTradingDisabled(operation: string): never {
  throw new FxcmMarketDataError(
    "FXCM_UNSUPPORTED_OPERATION",
    `FXCM trading operation is disabled in Phase 25: ${operation}`,
  );
}
