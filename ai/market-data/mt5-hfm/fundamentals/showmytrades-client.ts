/**
 * ShowMyTrades public economic calendar HTTP client (no API key).
 * Never used when licensing/provider gates are closed.
 */
import {
  HFM_FUNDAMENTALS_HTTP_TIMEOUT_MS,
  HFM_FUNDAMENTALS_MAX_RESPONSE_BYTES,
  HFM_SMT_CALENDAR_URL,
  HFM_SMT_CHANGES_URL,
} from "./contracts.js";

export interface SmtFetchResult {
  ok: boolean;
  status: number;
  notModified: boolean;
  etag: string | null;
  serverTimeHeader: string | null;
  retryAfterSec: number | null;
  bodyText: string | null;
  json: unknown | null;
  errorCode: string | null;
  errorMessage: string | null;
  elapsedMs: number;
  bytes: number;
}

function parseRetryAfter(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  return null;
}

export async function fetchShowMyTradesCalendar(input: {
  currency?: string;
  impact?: string;
  days?: number;
  etag?: string | null;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}): Promise<SmtFetchResult> {
  const days = Math.max(1, Math.min(30, Math.floor(input.days ?? 14)));
  const params = new URLSearchParams();
  if (input.currency) params.set("currency", input.currency);
  if (input.impact) params.set("impact", input.impact);
  params.set("days", String(days));
  params.set("format", "json");
  const url = `${HFM_SMT_CALENDAR_URL}?${params.toString()}`;
  return fetchSmtJson(url, { etag: input.etag, signal: input.signal, fetchImpl: input.fetchImpl });
}

export async function fetchShowMyTradesChanges(input: {
  since: number | string;
  currency?: string;
  impact?: string;
  etag?: string | null;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}): Promise<SmtFetchResult> {
  const params = new URLSearchParams();
  params.set("since", String(input.since));
  if (input.currency) params.set("currency", input.currency);
  if (input.impact) params.set("impact", input.impact);
  const url = `${HFM_SMT_CHANGES_URL}?${params.toString()}`;
  return fetchSmtJson(url, { etag: input.etag, signal: input.signal, fetchImpl: input.fetchImpl });
}

async function fetchSmtJson(
  url: string,
  opts: { etag?: string | null; signal?: AbortSignal; fetchImpl?: typeof fetch },
): Promise<SmtFetchResult> {
  const fetchFn = opts.fetchImpl ?? fetch;
  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": "KwizeraAI-HFM-Fundamentals/1.0",
  };
  if (opts.etag) headers["If-None-Match"] = opts.etag;

  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), HFM_FUNDAMENTALS_HTTP_TIMEOUT_MS);
  const onAbort = () => ctrl.abort();
  if (opts.signal) {
    if (opts.signal.aborted) ctrl.abort();
    else opts.signal.addEventListener("abort", onAbort, { once: true });
  }

  try {
    const res = await fetchFn(url, { method: "GET", headers, signal: ctrl.signal });
    const elapsedMs = Date.now() - started;
    const etag = res.headers.get("etag");
    const serverTimeHeader = res.headers.get("x-server-time");
    const retryAfterSec = parseRetryAfter(res.headers.get("retry-after"));

    if (res.status === 304) {
      return {
        ok: true,
        status: 304,
        notModified: true,
        etag,
        serverTimeHeader,
        retryAfterSec,
        bodyText: null,
        json: null,
        errorCode: null,
        errorMessage: null,
        elapsedMs,
        bytes: 0,
      };
    }

    if (res.status === 429) {
      return {
        ok: false,
        status: 429,
        notModified: false,
        etag,
        serverTimeHeader,
        retryAfterSec,
        bodyText: null,
        json: null,
        errorCode: "RATE_LIMITED",
        errorMessage: "ShowMyTrades rate limit (429)",
        elapsedMs,
        bytes: 0,
      };
    }

    if (res.status >= 500) {
      return {
        ok: false,
        status: res.status,
        notModified: false,
        etag,
        serverTimeHeader,
        retryAfterSec,
        bodyText: null,
        json: null,
        errorCode: "PROVIDER_5XX",
        errorMessage: `ShowMyTrades HTTP ${res.status}`,
        elapsedMs,
        bytes: 0,
      };
    }

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        notModified: false,
        etag,
        serverTimeHeader,
        retryAfterSec,
        bodyText: null,
        json: null,
        errorCode: "PROVIDER_HTTP_ERROR",
        errorMessage: `ShowMyTrades HTTP ${res.status}`,
        elapsedMs,
        bytes: 0,
      };
    }

    const reader = res.body?.getReader();
    if (!reader) {
      const text = await res.text();
      return parseBody(text, res.status, etag, serverTimeHeader, retryAfterSec, elapsedMs);
    }

    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > HFM_FUNDAMENTALS_MAX_RESPONSE_BYTES) {
          try {
            await reader.cancel();
          } catch {
            /* ignore */
          }
          return {
            ok: false,
            status: res.status,
            notModified: false,
            etag,
            serverTimeHeader,
            retryAfterSec,
            bodyText: null,
            json: null,
            errorCode: "RESPONSE_TOO_LARGE",
            errorMessage: `Response exceeded ${HFM_FUNDAMENTALS_MAX_RESPONSE_BYTES} bytes`,
            elapsedMs: Date.now() - started,
            bytes: total,
          };
        }
        chunks.push(value);
      }
    }
    const body = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf8");
    return parseBody(body, res.status, etag, serverTimeHeader, retryAfterSec, Date.now() - started);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const aborted = /abort/i.test(msg);
    return {
      ok: false,
      status: 0,
      notModified: false,
      etag: null,
      serverTimeHeader: null,
      retryAfterSec: null,
      bodyText: null,
      json: null,
      errorCode: aborted ? "TIMEOUT" : "NETWORK_ERROR",
      errorMessage: msg,
      elapsedMs: Date.now() - started,
      bytes: 0,
    };
  } finally {
    clearTimeout(timer);
    if (opts.signal) opts.signal.removeEventListener("abort", onAbort);
  }
}

function parseBody(
  body: string,
  status: number,
  etag: string | null,
  serverTimeHeader: string | null,
  retryAfterSec: number | null,
  elapsedMs: number,
): SmtFetchResult {
  const bytes = Buffer.byteLength(body, "utf8");
  if (bytes > HFM_FUNDAMENTALS_MAX_RESPONSE_BYTES) {
    return {
      ok: false,
      status,
      notModified: false,
      etag,
      serverTimeHeader,
      retryAfterSec,
      bodyText: null,
      json: null,
      errorCode: "RESPONSE_TOO_LARGE",
      errorMessage: `Response exceeded ${HFM_FUNDAMENTALS_MAX_RESPONSE_BYTES} bytes`,
      elapsedMs,
      bytes,
    };
  }
  try {
    const json = JSON.parse(body) as unknown;
    return {
      ok: true,
      status,
      notModified: false,
      etag,
      serverTimeHeader,
      retryAfterSec,
      bodyText: body,
      json,
      errorCode: null,
      errorMessage: null,
      elapsedMs,
      bytes,
    };
  } catch {
    return {
      ok: false,
      status,
      notModified: false,
      etag,
      serverTimeHeader,
      retryAfterSec,
      bodyText: body.slice(0, 500),
      json: null,
      errorCode: "INVALID_JSON",
      errorMessage: "Malformed JSON from ShowMyTrades",
      elapsedMs,
      bytes,
    };
  }
}
