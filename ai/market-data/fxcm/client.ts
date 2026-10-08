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

/**
 * Official Offers table snapshot — required to resolve offerId for /candles/{offer_id}/{period_id}.
 * GET /trading/get_model?models=Offer
 */
export async function fxcmGetOffersModel(
  config: FxcmConfig,
  session: FxcmSessionHandle,
  options?: { fetchImpl?: FetchLike; signal?: AbortSignal },
): Promise<unknown> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const url = new URL(FXCM_REST_PATHS.getModel, `${config.restBaseUrl}/`);
  url.searchParams.append("models", "Offer");
  let res: Response;
  try {
    res = await fetchImpl(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: session.authorizationHeader,
        "User-Agent": "kwizera-ai-studio/fxcm-historical",
      },
      signal: options?.signal ?? withTimeout(config.timeoutMs),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (/abort|timeout/i.test(msg)) {
      throw new FxcmMarketDataError("FXCM_TIMEOUT", "FXCM offers snapshot timed out.");
    }
    throw new FxcmMarketDataError("FXCM_NETWORK", "Could not reach FXCM offers snapshot.");
  }
  if (res.status === 401 || res.status === 403) {
    throw new FxcmMarketDataError("FXCM_AUTHENTICATION_FAILED", "FXCM offers request unauthorized.", res.status);
  }
  if (res.status === 429) {
    throw new FxcmMarketDataError("FXCM_RATE_LIMITED", "FXCM rate limited offers request.", res.status);
  }
  if (!res.ok) {
    throw new FxcmMarketDataError("FXCM_UNAVAILABLE", `FXCM offers HTTP ${res.status}.`, res.status);
  }
  const json = await res.json().catch(() => null);
  if (!json || typeof json !== "object") {
    throw new FxcmMarketDataError("FXCM_INVALID_RESPONSE", "FXCM offers response was not JSON.");
  }
  return json;
}

export interface FxcmCandlesQuery {
  offerId: number;
  periodId: string;
  num: number;
  fromSec?: number;
  toSec?: number;
}

/**
 * Official historical candles:
 * GET /candles/{offer_id}/{period_id}?num=N&from=&to=
 * from/to are epoch seconds. num required (1–10000) even when range is set.
 */
export async function fxcmGetCandles(
  config: FxcmConfig,
  session: FxcmSessionHandle,
  query: FxcmCandlesQuery,
  options?: { fetchImpl?: FetchLike; signal?: AbortSignal },
): Promise<unknown> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const period = encodeURIComponent(query.periodId);
  const url = new URL(
    `${FXCM_REST_PATHS.candles}/${query.offerId}/${period}`,
    `${config.restBaseUrl}/`,
  );
  url.searchParams.set("num", String(Math.max(1, Math.min(10_000, Math.floor(query.num)))));
  if (query.fromSec != null) url.searchParams.set("from", String(Math.floor(query.fromSec)));
  if (query.toSec != null) url.searchParams.set("to", String(Math.floor(query.toSec)));

  let res: Response;
  try {
    res = await fetchImpl(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: session.authorizationHeader,
        "User-Agent": "kwizera-ai-studio/fxcm-historical",
      },
      signal: options?.signal ?? withTimeout(config.timeoutMs),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (/abort|timeout/i.test(msg)) {
      throw new FxcmMarketDataError("FXCM_TIMEOUT", "FXCM historical candles request timed out.");
    }
    throw new FxcmMarketDataError("FXCM_NETWORK", "Could not reach FXCM candles endpoint.");
  }
  if (res.status === 401 || res.status === 403) {
    throw new FxcmMarketDataError("FXCM_AUTHENTICATION_FAILED", "FXCM candles request unauthorized.", res.status);
  }
  if (res.status === 429) {
    throw new FxcmMarketDataError("FXCM_RATE_LIMITED", "FXCM rate limited candles request.", res.status);
  }
  if (!res.ok) {
    throw new FxcmMarketDataError("FXCM_UNAVAILABLE", `FXCM candles HTTP ${res.status}.`, res.status);
  }
  const json = await res.json().catch(() => null);
  if (!json || typeof json !== "object") {
    throw new FxcmMarketDataError("FXCM_INVALID_RESPONSE", "FXCM candles response was not JSON.");
  }
  const executed = (json as { response?: { executed?: boolean } }).response?.executed;
  if (executed === false) {
    const errText = String((json as { response?: { error?: string } }).response?.error ?? "").trim();
    throw new FxcmMarketDataError(
      "FXCM_UNAVAILABLE",
      errText ? "FXCM candles request was not executed." : "FXCM candles request was not executed.",
    );
  }
  return json;
}

/** Explicitly rejects trading/order endpoints. */
export function assertFxcmTradingDisabled(operation: string): never {
  throw new FxcmMarketDataError(
    "FXCM_UNSUPPORTED_OPERATION",
    `FXCM trading operation is disabled: ${operation}`,
  );
}

/** Extract offerId↔currency pairs from get_model Offer snapshot (structure varies by FXCM revision). */
export function parseFxcmOffersMap(raw: unknown): Map<string, number> {
  const map = new Map<string, number>();
  const candidates: unknown[] = [];
  if (Array.isArray(raw)) {
    candidates.push(...raw);
  } else if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    for (const key of ["Offer", "offers", "offer", "data"]) {
      const v = obj[key];
      if (Array.isArray(v)) candidates.push(...v);
      else if (v && typeof v === "object") {
        const nested = v as Record<string, unknown>;
        if (Array.isArray(nested.Offer)) candidates.push(...nested.Offer);
        if (Array.isArray(nested.offer)) candidates.push(...nested.offer);
      }
    }
    // Some payloads nest tables under response-adjacent keys.
    for (const value of Object.values(obj)) {
      if (Array.isArray(value) && value.length && typeof value[0] === "object" && value[0] != null) {
        const sample = value[0] as Record<string, unknown>;
        if ("offerId" in sample || "offer_id" in sample) candidates.push(...value);
      }
    }
  }

  for (const item of candidates) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const offerId = Number(row.offerId ?? row.offer_id ?? row.OfferID);
    const currency = String(row.currency ?? row.symbol ?? row.Instrument ?? "").trim();
    if (!Number.isFinite(offerId) || offerId <= 0 || !currency) continue;
    map.set(currency, Math.floor(offerId));
    map.set(currency.toUpperCase(), Math.floor(offerId));
  }
  return map;
}
