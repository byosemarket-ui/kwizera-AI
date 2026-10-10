/**
 * Phase 33/34 — Node → localhost ForexConnect sidecar client.
 */
import { resolveForexConnectConfig, type ForexConnectConfig } from "./config.js";
import { ForexConnectMarketDataError } from "./errors.js";
import {
  normalizeForexConnectHistoryRows,
} from "./historical-normalize.js";
import type { SafeForexConnectHistoricalResult } from "./historical-types.js";
import {
  FOREXCONNECT_MAX_CANDLES,
  FOREXCONNECT_SUPPORTED_PROJECT_TIMEFRAMES,
  isForexConnectSupportedTimeframe,
  toForexConnectPeriodId,
} from "./timeframes.js";
import { normalizeFcOfferQuote } from "./live-candle-sync.js";
import type { ForexConnectLiveQuote, ForexConnectStreamStatus } from "./live-types.js";
import type {
  ForexConnectCandlesRequest,
  ForexConnectInstrumentsResult,
  ForexConnectSafeStatus,
} from "./types.js";

export type FetchLike = typeof fetch;

function sanitize(message: string): string {
  return String(message ?? "")
    .replace(/(password|passwd|pwd)\s*[:=]\s*\S+/gi, "$1=[redacted]")
    .replace(/[0-9a-f]{32,}/gi, "[redacted]")
    .slice(0, 500);
}

function localStatus(
  cfg: ForexConnectConfig,
  partial: Partial<ForexConnectSafeStatus> & { status: string },
): ForexConnectSafeStatus {
  return {
    ok: true,
    provider: "FOREXCONNECT",
    apiPath: "FXCM ForexConnect SDK (sidecar)",
    status: partial.status,
    enabled: cfg.enabled,
    configured: cfg.usernameConfigured && cfg.passwordConfigured,
    environment: cfg.environment,
    environmentLabel: cfg.environmentLabel,
    urlHost: cfg.urlHost,
    usernameConfigured: cfg.usernameConfigured,
    passwordConfigured: cfg.passwordConfigured,
    trading: "DISABLED",
    sidecarReachable: partial.sidecarReachable ?? false,
    errorCode: partial.errorCode ?? null,
    errorMessage: partial.errorMessage ? sanitize(partial.errorMessage) : null,
    instrumentCount: partial.instrumentCount ?? 0,
    connectedAt: partial.connectedAt ?? null,
    lastInstrumentAt: partial.lastInstrumentAt ?? null,
    historicalCapable: partial.historicalCapable ?? false,
    supportedTimeframes: partial.supportedTimeframes
      ?? [...FOREXCONNECT_SUPPORTED_PROJECT_TIMEFRAMES],
    lastHistoricalAt: partial.lastHistoricalAt ?? null,
    priceBasis: "bid",
    sdkAvailable: partial.sdkAvailable,
    sdkImportError: partial.sdkImportError ?? null,
    connecting: partial.connecting ?? false,
    note: partial.note
      ?? "ForexConnect via private localhost sidecar. Trading disabled.",
    checkedAt: new Date().toISOString(),
  };
}

async function sidecarFetch(
  cfg: ForexConnectConfig,
  path: string,
  init: RequestInit,
  fetchImpl: FetchLike,
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
  try {
    const res = await fetchImpl(`${cfg.sidecarBaseUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
    });
    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
    return { ok: res.ok, status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}

export class ForexConnectBridge {
  private readonly env: Record<string, string | undefined>;
  private readonly fetchImpl: FetchLike;

  constructor(options?: {
    env?: Record<string, string | undefined>;
    fetchImpl?: FetchLike;
  }) {
    this.env = options?.env ?? (process.env as Record<string, string | undefined>);
    this.fetchImpl = options?.fetchImpl ?? fetch;
  }

  getConfig(): ForexConnectConfig {
    return resolveForexConnectConfig(this.env);
  }

  async getStatus(): Promise<ForexConnectSafeStatus> {
    const cfg = this.getConfig();
    if (!cfg.enabled) {
      return localStatus(cfg, {
        status: "DISABLED",
        errorCode: "FOREXCONNECT_DISABLED",
        errorMessage: "ForexConnect is disabled. Set KWIZERA_FOREXCONNECT_ENABLED=1.",
      });
    }
    if (!(cfg.usernameConfigured && cfg.passwordConfigured)) {
      // Still try sidecar health for SDK availability diagnostics.
      try {
        const remote = await sidecarFetch(cfg, "/status", { method: "GET" }, this.fetchImpl);
        if (remote.body && typeof remote.body.status === "string") {
          return {
            ...(remote.body as unknown as ForexConnectSafeStatus),
            sidecarReachable: true,
            trading: "DISABLED",
          };
        }
      } catch {
        /* fall through */
      }
      return localStatus(cfg, {
        status: "NOT_CONFIGURED",
        errorCode: "FOREXCONNECT_NOT_CONFIGURED",
        errorMessage:
          "Save DEMO or LIVE credentials in Forex Admin (ForexConnect Accounts), then Test Connection.",
      });
    }

    try {
      const remote = await sidecarFetch(cfg, "/status", { method: "GET" }, this.fetchImpl);
      if (!remote.body || typeof remote.body !== "object") {
        return localStatus(cfg, {
          status: "SERVICE_UNAVAILABLE",
          errorCode: "FOREXCONNECT_SERVICE_UNAVAILABLE",
          errorMessage: "ForexConnect sidecar returned an invalid status payload.",
          sidecarReachable: true,
        });
      }
      return {
        ...(remote.body as unknown as ForexConnectSafeStatus),
        sidecarReachable: true,
        trading: "DISABLED",
        errorMessage: remote.body.errorMessage
          ? sanitize(String(remote.body.errorMessage))
          : null,
      };
    } catch (error) {
      return localStatus(cfg, {
        status: "SERVICE_UNAVAILABLE",
        errorCode: "FOREXCONNECT_SERVICE_UNAVAILABLE",
        errorMessage: sanitize(
          error instanceof Error ? error.message : "ForexConnect sidecar is unreachable.",
        ),
        sidecarReachable: false,
      });
    }
  }

  /**
   * Authenticate via sidecar. Optional overrides come from server-side DEMO/LIVE profiles
   * (never from browser). When overrides are provided, env credentials are not required.
   */
  async connect(options?: {
    username?: string;
    password?: string;
    environment?: "demo" | "real";
    /** Override sidecar timeout for slow FXCM login (ms). */
    timeoutMs?: number;
  }): Promise<ForexConnectSafeStatus> {
    const cfg = this.getConfig();
    if (!cfg.enabled) {
      return localStatus(cfg, {
        status: "DISABLED",
        errorCode: "FOREXCONNECT_DISABLED",
        errorMessage: "ForexConnect is disabled.",
      });
    }
    const overrideUser = String(options?.username ?? "").trim();
    // Do not trim interior spaces; only strip accidental leading/trailing whitespace.
    const overridePass = String(options?.password ?? "").replace(/^\s+|\s+$/g, "");
    const hasOverrides = Boolean(overrideUser && overridePass.length >= 4);
    if (!hasOverrides && !(cfg.usernameConfigured && cfg.passwordConfigured)) {
      return localStatus(cfg, {
        status: "NOT_CONFIGURED",
        errorCode: "FOREXCONNECT_NOT_CONFIGURED",
        errorMessage:
          "ForexConnect credentials are not configured for the selected environment.",
      });
    }
    try {
      const payload: Record<string, string> = {};
      if (hasOverrides) {
        payload.username = overrideUser;
        payload.password = overridePass;
        if (options?.environment) payload.environment = options.environment;
      }
      const connectCfg = options?.timeoutMs
        ? { ...cfg, timeoutMs: options.timeoutMs }
        : { ...cfg, timeoutMs: Math.max(cfg.timeoutMs, 60_000) };
      const remote = await sidecarFetch(
        connectCfg,
        "/connect",
        { method: "POST", body: JSON.stringify(payload) },
        this.fetchImpl,
      );
      const body = remote.body as unknown as ForexConnectSafeStatus;
      // Never echo credentials from any accidental sidecar field.
      const safe = { ...body } as Record<string, unknown>;
      delete safe.username;
      delete safe.password;
      return {
        ...(safe as unknown as ForexConnectSafeStatus),
        ok: body.status === "CONNECTED",
        sidecarReachable: true,
        trading: "DISABLED",
        errorMessage: body.errorMessage ? sanitize(String(body.errorMessage)) : null,
      };
    } catch (error) {
      return localStatus(cfg, {
        status: "SERVICE_UNAVAILABLE",
        errorCode: "FOREXCONNECT_SERVICE_UNAVAILABLE",
        errorMessage: sanitize(
          error instanceof Error ? error.message : "ForexConnect sidecar is unreachable.",
        ),
        sidecarReachable: false,
      });
    }
  }

  async disconnect(): Promise<ForexConnectSafeStatus> {
    const cfg = this.getConfig();
    try {
      const remote = await sidecarFetch(
        cfg,
        "/disconnect",
        { method: "POST", body: "{}" },
        this.fetchImpl,
      );
      return {
        ...(remote.body as unknown as ForexConnectSafeStatus),
        sidecarReachable: true,
        trading: "DISABLED",
      };
    } catch (error) {
      return localStatus(cfg, {
        status: "SERVICE_UNAVAILABLE",
        errorCode: "FOREXCONNECT_SERVICE_UNAVAILABLE",
        errorMessage: sanitize(
          error instanceof Error ? error.message : "ForexConnect sidecar is unreachable.",
        ),
      });
    }
  }

  async listInstruments(): Promise<ForexConnectInstrumentsResult> {
    const cfg = this.getConfig();
    const status = await this.getStatus();
    if (status.status !== "CONNECTED") {
      return {
        ok: false,
        count: 0,
        instruments: [],
        status,
        error: {
          code: String(status.errorCode ?? `FOREXCONNECT_${status.status}`),
          message: status.errorMessage
            ?? "ForexConnect is not connected. Connect before discovering instruments.",
        },
      };
    }
    try {
      const remote = await sidecarFetch(cfg, "/instruments", { method: "GET" }, this.fetchImpl);
      const body = remote.body as unknown as ForexConnectInstrumentsResult;
      if (!body.ok) {
        return {
          ok: false,
          count: 0,
          instruments: [],
          status,
          error: body.error ?? {
            code: "FOREXCONNECT_DISCOVERY_FAILED",
            message: "Instrument discovery failed.",
          },
        };
      }
      const instruments = Array.isArray(body.instruments) ? body.instruments : [];
      return {
        ok: true,
        count: instruments.length,
        instruments,
        fetchedAt: body.fetchedAt ?? null,
        status,
        note: body.note
          ?? "Instruments from authenticated ForexConnect Offers table.",
      };
    } catch (error) {
      return {
        ok: false,
        count: 0,
        instruments: [],
        status: {
          ...status,
          status: "SERVICE_UNAVAILABLE",
          sidecarReachable: false,
          errorCode: "FOREXCONNECT_SERVICE_UNAVAILABLE",
          errorMessage: sanitize(
            error instanceof Error ? error.message : "ForexConnect sidecar is unreachable.",
          ),
        },
        error: {
          code: "FOREXCONNECT_SERVICE_UNAVAILABLE",
          message: sanitize(
            error instanceof Error ? error.message : "ForexConnect sidecar is unreachable.",
          ),
        },
      };
    }
  }

  /**
   * Historical candles via sidecar ForexConnect.get_history.
   * Throws ForexConnectMarketDataError for disabled/unconfigured/auth/unavailable.
   * Empty authentic provider response returns ok:true with count:0 (never fabricated).
   */
  async getHistoricalCandles(
    request: ForexConnectCandlesRequest,
  ): Promise<SafeForexConnectHistoricalResult> {
    const cfg = this.getConfig();
    const symbol = String(request.symbol ?? "").trim();
    if (!symbol) {
      throw new ForexConnectMarketDataError(
        "FOREXCONNECT_INVALID_SYMBOL",
        "symbol is required for ForexConnect historical candles.",
      );
    }
    if (!isForexConnectSupportedTimeframe(request.timeframe)) {
      throw new ForexConnectMarketDataError(
        "FOREXCONNECT_UNSUPPORTED_TIMEFRAME",
        `Unsupported ForexConnect timeframe "${request.timeframe}". `
          + `Supported: ${FOREXCONNECT_SUPPORTED_PROJECT_TIMEFRAMES.join(", ")}.`,
      );
    }
    const periodId = toForexConnectPeriodId(request.timeframe)!;
    const limitRaw = request.limit == null ? 100 : Number(request.limit);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(FOREXCONNECT_MAX_CANDLES, Math.max(1, Math.floor(limitRaw)))
      : 100;

    if (!cfg.enabled) {
      throw new ForexConnectMarketDataError(
        "FOREXCONNECT_DISABLED",
        "ForexConnect is disabled. Set KWIZERA_FOREXCONNECT_ENABLED=1.",
      );
    }

    // Session may be authenticated via Admin DEMO/LIVE profiles (encrypted vault),
    // not only KWIZERA_FOREXCONNECT_USERNAME/PASSWORD env vars. Trust sidecar CONNECTED.
    const status = await this.getStatus();
    if (status.status !== "CONNECTED") {
      throw new ForexConnectMarketDataError(
        String(status.errorCode ?? `FOREXCONNECT_${status.status}`),
        status.errorMessage
          ?? "ForexConnect is not connected. Authenticate before requesting historical candles.",
      );
    }

    try {
      const qs = new URLSearchParams({
        symbol,
        timeframe: request.timeframe,
        limit: String(limit),
      });
      const remote = await sidecarFetch(
        cfg,
        `/candles?${qs.toString()}`,
        { method: "GET" },
        this.fetchImpl,
      );
      const body = remote.body as Record<string, unknown>;
      if (!remote.ok || body.ok === false) {
        const err = (body.error as { code?: string; message?: string } | undefined) ?? {};
        throw new ForexConnectMarketDataError(
          String(err.code ?? "FOREXCONNECT_HISTORICAL_FAILED"),
          sanitize(String(err.message ?? "ForexConnect historical request failed.")),
        );
      }

      const timeframe = request.timeframe;
      const { candles, invalidCandles, duplicatesRemoved } = normalizeForexConnectHistoryRows(
        body.candles,
        timeframe,
      );

      const sessionEnv = (status.environment === "demo" || status.environment === "real")
        ? status.environment
        : (body.environment === "demo" || body.environment === "real"
          ? body.environment
          : cfg.environment);
      const sessionEnvLabel = sessionEnv === "real" ? "LIVE" : "DEMO";

      return {
        ok: true,
        provider: "FOREXCONNECT",
        marketType: "FOREX",
        providerSymbol: String(body.providerSymbol ?? symbol),
        canonicalSymbol: String(body.canonicalSymbol
          ?? symbol.replace(/[/_-\s]/g, "").toUpperCase()),
        displaySymbol: String(body.displaySymbol ?? body.providerSymbol ?? symbol),
        timeframe,
        periodId: String(body.periodId ?? periodId),
        priceBasis: "bid",
        environment: sessionEnv,
        environmentLabel: sessionEnvLabel,
        candles,
        count: candles.length,
        invalidCandles,
        duplicatesRemoved,
        fetchedAt: String(body.fetchedAt ?? new Date().toISOString()),
        lastHistoricalAt: body.lastHistoricalAt
          ? String(body.lastHistoricalAt)
          : (candles.length > 0
            ? new Date(candles[candles.length - 1]!.time * 1000).toISOString()
            : String(body.fetchedAt ?? new Date().toISOString())),
        note: String(
          body.note
            ?? "ForexConnect historical candles (bid OHLC via get_history). Trading disabled.",
        ),
        errorCode: null,
        errorMessage: null,
        ...(body.historyDiagnostics && typeof body.historyDiagnostics === "object"
          ? { historyDiagnostics: body.historyDiagnostics }
          : {}),
      };
    } catch (error) {
      if (error instanceof ForexConnectMarketDataError) throw error;
      throw new ForexConnectMarketDataError(
        "FOREXCONNECT_SERVICE_UNAVAILABLE",
        sanitize(
          error instanceof Error ? error.message : "ForexConnect sidecar is unreachable.",
        ),
      );
    }
  }

  async subscribeQuotes(symbol: string): Promise<{
    ok: boolean;
    providerSymbol?: string;
    canonicalSymbol?: string;
    displaySymbol?: string;
    error?: { code: string; message: string };
  }> {
    const cfg = this.getConfig();
    if (!cfg.enabled) {
      return {
        ok: false,
        error: { code: "FOREXCONNECT_DISABLED", message: "ForexConnect is disabled." },
      };
    }
    try {
      const remote = await sidecarFetch(
        cfg,
        "/subscribe",
        { method: "POST", body: JSON.stringify({ symbol }) },
        this.fetchImpl,
      );
      if (!remote.ok || remote.body.ok === false) {
        const err = remote.body.error as { code?: string; message?: string } | undefined;
        return {
          ok: false,
          error: {
            code: String(err?.code ?? "FOREXCONNECT_SUBSCRIBE_FAILED"),
            message: sanitize(String(err?.message ?? "Subscribe failed.")),
          },
        };
      }
      return {
        ok: true,
        providerSymbol: remote.body.providerSymbol
          ? String(remote.body.providerSymbol)
          : symbol,
        canonicalSymbol: remote.body.canonicalSymbol
          ? String(remote.body.canonicalSymbol)
          : undefined,
        displaySymbol: remote.body.displaySymbol
          ? String(remote.body.displaySymbol)
          : undefined,
      };
    } catch (error) {
      return {
        ok: false,
        error: {
          code: "FOREXCONNECT_SERVICE_UNAVAILABLE",
          message: sanitize(
            error instanceof Error ? error.message : "ForexConnect sidecar is unreachable.",
          ),
        },
      };
    }
  }

  async unsubscribeQuotes(symbol: string): Promise<void> {
    const cfg = this.getConfig();
    try {
      await sidecarFetch(
        cfg,
        "/unsubscribe",
        { method: "POST", body: JSON.stringify({ symbol }) },
        this.fetchImpl,
      );
    } catch {
      /* best-effort */
    }
  }

  async pollQuotes(): Promise<ForexConnectLiveQuote[]> {
    const cfg = this.getConfig();
    const remote = await sidecarFetch(cfg, "/quotes", { method: "GET" }, this.fetchImpl);
    if (!remote.ok || remote.body.ok === false) {
      throw new ForexConnectMarketDataError(
        "FOREXCONNECT_STREAM_ERROR",
        sanitize(String(
          (remote.body.error as { message?: string } | undefined)?.message
            ?? "Failed to poll ForexConnect quotes.",
        )),
      );
    }
    const list = Array.isArray(remote.body.quotes) ? remote.body.quotes : [];
    const out: ForexConnectLiveQuote[] = [];
    for (const raw of list) {
      // Preserve sidecar receivedAtMs / sourceTimestampMs — never stamp Date.now() here,
      // or seeded Offers snapshots would look like fresh ticks every poll and fake LIVE.
      const n = normalizeFcOfferQuote(raw);
      if (!n || n.candlePrice == null) continue;
      out.push({
        provider: "FOREXCONNECT",
        providerSymbol: n.providerSymbol,
        canonicalSymbol: n.canonicalSymbol,
        displaySymbol: n.displaySymbol,
        bid: n.bid,
        ask: n.ask,
        mid: n.mid,
        candlePrice: n.candlePrice,
        priceBasis: "bid",
        sourceTimestampMs: n.sourceTimestampMs,
        receivedAtMs: n.receivedAtMs,
        offerId: n.offerId,
      });
    }
    return out;
  }

  async getStreamStatus(): Promise<ForexConnectStreamStatus> {
    const cfg = this.getConfig();
    if (!cfg.enabled) {
      return {
        ok: true,
        provider: "FOREXCONNECT",
        sessionStatus: "DISABLED",
        streamState: "DISABLED",
        offersListenerActive: false,
        subscriptionCount: 0,
        subscriptions: [],
        maxSubscriptions: 8,
        lastQuoteAt: null,
        lastQuoteAgeMs: null,
        lastStreamError: null,
        updateCount: 0,
        priceBasis: "bid",
        trading: "DISABLED",
        note: "ForexConnect is disabled.",
      };
    }
    try {
      const remote = await sidecarFetch(cfg, "/stream/status", { method: "GET" }, this.fetchImpl);
      const body = remote.body as Partial<ForexConnectStreamStatus>;
      return {
        ok: true,
        provider: "FOREXCONNECT",
        sessionStatus: String(body.sessionStatus ?? "UNKNOWN"),
        streamState: (body.streamState as ForexConnectStreamStatus["streamState"])
          ?? "DISCONNECTED",
        offersListenerActive: Boolean(body.offersListenerActive),
        subscriptionCount: Number(body.subscriptionCount ?? 0),
        subscriptions: Array.isArray(body.subscriptions)
          ? body.subscriptions.map(String)
          : [],
        maxSubscriptions: Number(body.maxSubscriptions ?? 8),
        lastQuoteAt: body.lastQuoteAt ? String(body.lastQuoteAt) : null,
        lastQuoteAgeMs: body.lastQuoteAgeMs == null ? null : Number(body.lastQuoteAgeMs),
        lastStreamError: body.lastStreamError
          ? sanitize(String(body.lastStreamError))
          : null,
        updateCount: Number(body.updateCount ?? 0),
        priceBasis: "bid",
        trading: "DISABLED",
        note: body.note ? String(body.note) : undefined,
      };
    } catch (error) {
      return {
        ok: false,
        provider: "FOREXCONNECT",
        sessionStatus: "SERVICE_UNAVAILABLE",
        streamState: "SERVICE_UNAVAILABLE",
        offersListenerActive: false,
        subscriptionCount: 0,
        subscriptions: [],
        maxSubscriptions: 8,
        lastQuoteAt: null,
        lastQuoteAgeMs: null,
        lastStreamError: sanitize(
          error instanceof Error ? error.message : "Sidecar unreachable.",
        ),
        updateCount: 0,
        priceBasis: "bid",
        trading: "DISABLED",
      };
    }
  }
}

let singleton: ForexConnectBridge | null = null;

export function getForexConnectBridge(): ForexConnectBridge {
  singleton ??= new ForexConnectBridge();
  return singleton;
}

export function createForexConnectBridge(options?: {
  env?: Record<string, string | undefined>;
  fetchImpl?: FetchLike;
}): ForexConnectBridge {
  return new ForexConnectBridge(options);
}

export function assertNoSecretsInForexConnectPayload(
  payload: unknown,
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
  extraSecrets: string[] = [],
): void {
  const text = JSON.stringify(payload);
  const candidates = [
    String(env.KWIZERA_FOREXCONNECT_PASSWORD ?? "").trim(),
    ...extraSecrets.map((s) => String(s ?? "").trim()),
  ].filter((s) => s.length >= 4);
  for (const secret of candidates) {
    if (text.includes(secret)) {
      throw new Error("Refusing to expose ForexConnect password in API payload.");
    }
  }
  if (/"password"\s*:\s*"[^"]{4,}"/i.test(text)) {
    throw new Error("Refusing to expose ForexConnect password field in API payload.");
  }
}
