/**
 * HFM MT5 Demo MarketDataProvider — explicit provider identity.
 * Never falls back to ForexConnect or Binance for FX symbols.
 * Read-only. Trading always disabled.
 * Instrument listing prefers the Phase 1 verified HFM catalog.
 */
import { callMt5HfmAgent } from "./agent-client.js";
import { getHfmCatalogService, instrumentToMarketType } from "./catalog-service.js";
import type {
  MarketDataCapabilities,
  MarketDataProvider,
  MarketInstrument,
  MarketProviderHealth,
  MarketProviderInfo,
  NormalizedMarketQuote,
} from "../providers/types.js";

const CAPS: MarketDataCapabilities = {
  instruments: true,
  liveQuotes: true,
  streamingQuotes: true,
  historicalPrices: true,
  candles: true,
  liveCandles: false,
  trading: false,
};

export const HFM_MT5_PROVIDER_ID = "HFM_MT5" as const;

export interface HfmMt5QuoteResult {
  quotes: NormalizedMarketQuote[];
  quotesAvailable: boolean;
  stale: boolean | null;
  source: "HFM_MT5";
  environment: "demo";
  retrievedAt: string;
  unavailableReason: string | null;
}

export interface HfmMt5CandleBar {
  time: number | string;
  open: number;
  high: number;
  low: number;
  close: number;
  tickVolume: number | null;
  realVolume: number | null;
  spread: number | null;
}

export interface HfmMt5CandleResult {
  symbol: string;
  timeframe: string;
  candles: HfmMt5CandleBar[];
  available: boolean;
  source: "HFM_MT5";
  environment: "demo";
  retrievedAt: string | null;
  unavailableReason: string | null;
}

function nowIso(): string {
  return new Date().toISOString();
}

/** Quote-path fallback only — never used as catalog classification. */
function classifyQuoteSymbolFallback(sym: string): MarketInstrument["marketType"] {
  const u = sym.toUpperCase();
  if (/^(XAU|XAG|XPT|XPD)/.test(u)) return "COMMODITY";
  return "OTHER";
}

export class HfmMt5MarketDataProvider implements MarketDataProvider {
  getProviderInfo(): MarketProviderInfo {
    return {
      provider: "HFM_MT5" as MarketProviderInfo["provider"],
      displayName: "HFM MetaTrader 5 (Demo)",
      apiPath: "AF_UNIX mt5-hfm-agent → MQL5 catalog + quotes",
      marketTypes: ["FOREX", "CFD", "COMMODITY", "INDEX", "SHARE", "CRYPTO", "OTHER", "UNKNOWN"],
      environmentLabel: "HFM Demo (read-only)",
      capabilities: CAPS,
    };
  }

  getCapabilities(): MarketDataCapabilities {
    return { ...CAPS };
  }

  async healthCheck(): Promise<MarketProviderHealth> {
    const checkedAt = nowIso();
    try {
      const res = await callMt5HfmAgent("demo.connection_status", {});
      const result = (res.result ?? {}) as Record<string, unknown>;
      const mcp = (result.mcp ?? {}) as Record<string, unknown>;
      const running = Boolean(result.terminalRunning);
      const authenticated = Boolean(result.authenticated);
      const reachable = Boolean(mcp.reachable) || running;
      return {
        provider: "HFM_MT5" as MarketProviderHealth["provider"],
        enabled: true,
        environment: "demo",
        environmentLabel: "HFM Demo (read-only)",
        configured: Boolean(mcp.apiKeyConfigured),
        authenticated,
        reachable,
        status: !res.ok
          ? "UNAVAILABLE"
          : authenticated
            ? "CONNECTED"
            : running
              ? "CONFIGURED"
              : "NOT_CONFIGURED",
        connectionState: authenticated ? "CONNECTED" : running ? "CONNECTING" : "DISCONNECTED",
        liveStreamEnabled: false,
        tradingEnabled: false,
        instrumentDiscovery: authenticated ? "READY" : running ? "NOT_CONFIGURED" : "DISABLED",
        checkedAt,
        errorCode: res.ok ? null : String(res.code ?? "AGENT_ERROR"),
        errorMessage: res.ok ? null : String(res.error ?? res.code ?? "agent unavailable"),
        notes: [
          "Provider identity: HFM_MT5 — never silent ForexConnect/Binance fallback.",
          "Trading disabled. Live environment blocked.",
          `MCP reachable: ${String(mcp.reachable ?? false)}`,
        ],
      };
    } catch (error) {
      return {
        provider: "HFM_MT5" as MarketProviderHealth["provider"],
        enabled: true,
        environment: "demo",
        environmentLabel: "HFM Demo (read-only)",
        configured: false,
        authenticated: false,
        reachable: false,
        status: "UNAVAILABLE",
        connectionState: "DISCONNECTED",
        liveStreamEnabled: false,
        tradingEnabled: false,
        instrumentDiscovery: "DISABLED",
        checkedAt,
        errorCode: "AGENT_UNAVAILABLE",
        errorMessage: error instanceof Error ? error.message : "agent unavailable",
        notes: ["HFM MT5 agent socket unavailable."],
      };
    }
  }

  async listInstruments(options?: { refresh?: boolean }): Promise<MarketInstrument[]> {
    const catalog = getHfmCatalogService();
    if (options?.refresh) {
      await catalog.syncFromAgent({ forceRefresh: false });
    } else {
      const loaded = await catalog.load();
      if (!loaded) {
        await catalog.syncFromAgent({ forceRefresh: false });
      }
    }
    const snap = await catalog.load();
    if (!snap || snap.provider !== "HFM_MT5") {
      // Explicit empty — never fall back to FXCM / ForexConnect / Binance / MCP Market Watch.
      return [];
    }
    return snap.symbols
      .filter((s) => s.lifecycle !== "REMOVED_OR_UNAVAILABLE")
      .map((s) => ({
        provider: "HFM_MT5" as MarketInstrument["provider"],
        providerSymbol: s.symbol,
        canonicalSymbol: s.symbol,
        displaySymbol: s.description ?? s.symbol,
        marketType: instrumentToMarketType(s),
        baseAsset: s.currencyBase,
        quoteAsset: s.currencyProfit,
        status: s.lifecycle === "ACTIVE" || s.lifecycle === "METADATA_INCOMPLETE" ? ("available" as const) : ("hidden" as const),
        capabilities: CAPS,
        metadata: {
          source: "HFM_MT5",
          environment: "demo",
          catalogVersion: s.catalogVersion,
          lifecycle: s.lifecycle,
          category: s.classification.category,
          subcategory: s.classification.subcategory,
          classificationStatus: s.classification.classificationStatus,
          classificationMethod: s.classification.method,
          classificationConfidence: s.classification.classificationConfidence,
          classificationConfidenceBand: s.classification.confidence,
          classificationEvidence: s.classification.evidence,
          classificationWarnings: s.classification.classificationWarnings,
          path: s.path,
          digits: s.digits,
          point: s.point,
          selected: s.selected,
          customSymbol: s.customSymbol,
          metadataCompleteness: s.metadataCompleteness,
          requiredFieldsComplete: s.metadataQuality?.requiredFieldsComplete ?? null,
          missingRequiredFields: s.metadataQuality?.missingRequiredFields ?? null,
        },
      }));
  }

  async getInstrument(symbol: string): Promise<MarketInstrument | null> {
    const catalog = getHfmCatalogService();
    await catalog.load();
    const row = await catalog.getSymbol(symbol);
    if (!row) return null;
    return {
      provider: "HFM_MT5" as MarketInstrument["provider"],
      providerSymbol: row.symbol,
      canonicalSymbol: row.symbol,
      displaySymbol: row.description ?? row.symbol,
      marketType: instrumentToMarketType(row),
      baseAsset: row.currencyBase,
      quoteAsset: row.currencyProfit,
      status: row.lifecycle === "ACTIVE" || row.lifecycle === "METADATA_INCOMPLETE" ? "available" : "hidden",
      capabilities: CAPS,
      metadata: {
        source: "HFM_MT5",
        environment: "demo",
        catalogVersion: row.catalogVersion,
        lifecycle: row.lifecycle,
        category: row.classification.category,
        path: row.path,
        digits: row.digits,
        point: row.point,
        metadataCompleteness: row.metadataCompleteness,
      },
    };
  }

  async getQuotes(symbols?: string[]): Promise<HfmMt5QuoteResult> {
    // STEP 1B.3 — canonical Quote Service (never raw agent as accepted Forex quotes).
    const { getHfmQuoteService } = await import("./quote-service.js");
    const { ensureMt5HfmRealtimeHubStarted } = await import("./realtime-hub.js");
    ensureMt5HfmRealtimeHubStarted();
    const svc = getHfmQuoteService();
    const syms =
      symbols && symbols.length > 0
        ? symbols
        : ["XAUUSD", "EURUSD", "GBPUSD", "USDJPY"];
    const retrievedAt = nowIso();
    const quotes: NormalizedMarketQuote[] = syms.map((symbol) => {
      const q = svc.getQuote(symbol);
      const bid = q?.bid ?? null;
      const ask = q?.ask ?? null;
      const mid = bid != null && ask != null ? (bid + ask) / 2 : null;
      const live = q?.status === "LIVE" && q.quoteFreshnessStatus === "FRESH_TICK";
      const stale =
        q?.status === "STALE" ||
        q?.quoteFreshnessStatus === "STALE_TICK" ||
        q?.quoteFreshnessStatus === "DELAYED_TICK" ||
        q?.quoteFreshnessStatus === "QUIET_OPEN_MARKET";
      return {
        provider: "HFM_MT5" as NormalizedMarketQuote["provider"],
        marketType: classifyQuoteSymbolFallback(symbol),
        providerSymbol: q?.symbol ?? symbol,
        canonicalSymbol: q?.symbol ?? symbol,
        /** Broker-domain tick when present — NOT UTC. Prefer metadata.quoteTimestampUtc. */
        providerTimestamp: q?.quoteTimestamp != null ? String(q.quoteTimestamp) : null,
        /** Receipt UTC ISO — not the market tick time. */
        normalizedTimestamp:
          q?.quoteTimestampUtc != null
            ? new Date(q.quoteTimestampUtc * 1000).toISOString()
            : q?.receivedAt ?? retrievedAt,
        bid,
        ask,
        mid,
        last: q?.last ?? null,
        source: "HFM_MT5",
        dataQuality: !q
          ? "NO_DATA"
          : q.status === "ERROR"
            ? "DISCONNECTED"
            : stale
              ? "STALE"
              : live
                ? "LIVE"
                : q.status === "NO_QUOTE" || q.status === "INVALID"
                  ? "NO_DATA"
                  : "LIVE",
      };
    });
    const available = quotes.some((q) => q.bid != null && q.ask != null);
    return {
      quotes,
      quotesAvailable: available,
      stale: available ? quotes.every((q) => q.dataQuality === "STALE") : null,
      source: "HFM_MT5",
      environment: "demo",
      retrievedAt,
      unavailableReason: available ? null : "NO_CANONICAL_QUOTE",
    };
  }

  async getCandles(symbol: string, timeframe: string, limit = 100): Promise<HfmMt5CandleResult> {
    const res = await callMt5HfmAgent("demo.candles", { symbol, timeframe, limit });
    const result = (res.result ?? {}) as Record<string, unknown>;
    const raw = Array.isArray(result.candles) ? result.candles : [];
    const candles: HfmMt5CandleBar[] = raw.map((c) => {
      const row = c as Record<string, unknown>;
      return {
        time: (row.time as number | string) ?? 0,
        open: Number(row.open),
        high: Number(row.high),
        low: Number(row.low),
        close: Number(row.close),
        tickVolume: typeof row.tickVolume === "number" ? row.tickVolume : null,
        realVolume: typeof row.realVolume === "number" ? row.realVolume : null,
        spread: typeof row.spread === "number" ? row.spread : null,
      };
    });
    return {
      symbol,
      timeframe,
      candles,
      available: Boolean(result.available) && candles.length > 0,
      source: "HFM_MT5",
      environment: "demo",
      retrievedAt: result.retrievedAt != null ? String(result.retrievedAt) : nowIso(),
      unavailableReason: res.ok
        ? (result.unavailableReason != null ? String(result.unavailableReason) : null)
        : String(res.code ?? "AGENT_ERROR"),
    };
  }
}

export function createHfmMt5MarketDataProvider(): HfmMt5MarketDataProvider {
  return new HfmMt5MarketDataProvider();
}
