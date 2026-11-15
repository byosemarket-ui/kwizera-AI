/**
 * HFM MT5 Demo MarketDataProvider — explicit provider identity.
 * Never falls back to ForexConnect or Binance for FX symbols.
 * Read-only. Trading always disabled.
 */
import { callMt5HfmAgent } from "./agent-client.js";
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
  streamingQuotes: false,
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

function classifySymbol(sym: string): MarketInstrument["marketType"] {
  const u = sym.toUpperCase();
  if (u.includes("XAU") || u.includes("XAG") || u.includes("GOLD") || u.includes("SILVER")) {
    return "COMMODITY";
  }
  if (/^[A-Z]{6}/.test(u.replace(/[^A-Z]/g, ""))) return "FOREX";
  return "OTHER";
}

export class HfmMt5MarketDataProvider implements MarketDataProvider {
  getProviderInfo(): MarketProviderInfo {
    return {
      provider: "HFM_MT5" as MarketProviderInfo["provider"],
      displayName: "HFM MetaTrader 5 (Demo)",
      apiPath: "AF_UNIX mt5-hfm-agent → MT5 MCP",
      marketTypes: ["FOREX", "CFD", "COMMODITY", "INDEX", "OTHER"],
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

  async listInstruments(): Promise<MarketInstrument[]> {
    const res = await callMt5HfmAgent("demo.symbols", {});
    if (!res.ok) return [];
    const result = (res.result ?? {}) as { symbols?: Array<Record<string, unknown>> };
    const symbols = Array.isArray(result.symbols) ? result.symbols : [];
    return symbols.map((s) => {
      const broker = String(s.brokerSymbol ?? s.symbol ?? "");
      return {
        provider: "HFM_MT5" as MarketInstrument["provider"],
        providerSymbol: broker,
        canonicalSymbol: broker,
        displaySymbol: String(s.displayName ?? broker),
        marketType: classifySymbol(broker),
        baseAsset: s.baseCurrency != null ? String(s.baseCurrency) : null,
        quoteAsset: s.quoteCurrency != null ? String(s.quoteCurrency) : null,
        status: "available" as const,
        capabilities: CAPS,
        metadata: {
          source: "HFM_MT5",
          environment: "demo",
          digits: typeof s.digits === "number" ? s.digits : null,
          point: typeof s.point === "number" ? s.point : null,
        },
      };
    });
  }

  async getInstrument(symbol: string): Promise<MarketInstrument | null> {
    const all = await this.listInstruments();
    const u = symbol.toUpperCase();
    return all.find((i) => i.providerSymbol.toUpperCase() === u || i.canonicalSymbol.toUpperCase() === u) ?? null;
  }

  async getQuotes(symbols?: string[]): Promise<HfmMt5QuoteResult> {
    const res = await callMt5HfmAgent("demo.quotes_snapshot", { symbols: symbols ?? [] });
    const result = (res.result ?? {}) as Record<string, unknown>;
    const rawQuotes = Array.isArray(result.quotes) ? result.quotes : [];
    const retrievedAt = String(result.retrievedAt ?? nowIso());
    const quotes: NormalizedMarketQuote[] = rawQuotes.map((q) => {
      const row = q as Record<string, unknown>;
      const bid = typeof row.bid === "number" ? row.bid : null;
      const ask = typeof row.ask === "number" ? row.ask : null;
      const mid = bid != null && ask != null ? (bid + ask) / 2 : null;
      const stale = row.stale === true;
      const fresh = row.fresh === true;
      return {
        provider: "HFM_MT5" as NormalizedMarketQuote["provider"],
        marketType: classifySymbol(String(row.symbol ?? "")),
        providerSymbol: String(row.symbol ?? ""),
        canonicalSymbol: String(row.symbol ?? ""),
        providerTimestamp: row.tickTime != null ? String(row.tickTime) : null,
        normalizedTimestamp: retrievedAt,
        bid,
        ask,
        mid,
        last: typeof row.last === "number" ? row.last : null,
        source: "HFM_MT5",
        dataQuality: !res.ok ? "DISCONNECTED" : stale ? "STALE" : fresh ? "LIVE" : "NO_DATA",
      };
    });
    return {
      quotes,
      quotesAvailable: Boolean(result.quotesAvailable) && quotes.length > 0,
      stale: typeof result.stale === "boolean" ? result.stale : null,
      source: "HFM_MT5",
      environment: "demo",
      retrievedAt,
      unavailableReason: res.ok
        ? (result.unavailableReason != null ? String(result.unavailableReason) : null)
        : String(res.code ?? "AGENT_ERROR"),
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
