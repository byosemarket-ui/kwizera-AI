export const BINANCE_DEFAULT_REST_BASE = "https://api.binance.com";
export const BINANCE_DEFAULT_WS_BASE = "wss://stream.binance.com:9443";
export const BINANCE_DEFAULT_TIMEOUT_MS = 8000;
export const BINANCE_EXCHANGE_INFO_TIMEOUT_MS = 25000;
export const BINANCE_MARKET_CACHE_MS = 10 * 60 * 1000;

/** Official public REST origins only. Used when the configured host is unreachable. */
export const BINANCE_PUBLIC_REST_FALLBACKS = [
  "https://api.binance.com",
  "https://api1.binance.com",
  "https://api2.binance.com",
  "https://api3.binance.com",
  "https://data-api.binance.vision",
] as const;

export const BINANCE_PUBLIC_REST_PATHS = {
  ping: "/api/v3/ping",
  time: "/api/v3/time",
  exchangeInfo: "/api/v3/exchangeInfo",
  klines: "/api/v3/klines",
  ticker24h: "/api/v3/ticker/24hr",
} as const;

export const BINANCE_PUBLIC_WS_STREAMS = {
  trade: "{symbol}@trade",
  miniTicker: "{symbol}@miniTicker",
  kline: "{symbol}@kline_{interval}",
} as const;

export interface BinancePublicConfig {
  enabled: boolean;
  restBaseUrl: string;
  websocketBaseUrl: string;
  timeoutMs: number;
  environment: "development" | "production";
  restBaseHost: string;
  usedOfficialFallback: boolean;
  restFallbackUrls: string[];
}

function isProductionEnv(env: Record<string, string | undefined>): boolean {
  return env.NODE_ENV === "production" || env.KWIZERA_ENV === "production";
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 500 && n <= 30000 ? Math.floor(n) : fallback;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

function isPrivateOrLocalHost(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host.endsWith(".local") ||
      host.startsWith("10.") ||
      host.startsWith("192.168.") ||
      host.startsWith("172.16.")
    );
  } catch {
    return true;
  }
}

/**
 * Public Binance configuration only. API keys / secrets are never read here.
 */
export function resolveBinancePublicConfig(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): BinancePublicConfig {
  const environment = isProductionEnv(env) ? "production" : "development";
  const enabledRaw = (env.KWIZERA_BINANCE_ENABLED ?? "1").trim().toLowerCase();
  const enabled = enabledRaw !== "0" && enabledRaw !== "false" && enabledRaw !== "off";
  const requestedRest = stripTrailingSlash((env.KWIZERA_BINANCE_REST_BASE ?? BINANCE_DEFAULT_REST_BASE).trim());
  const requestedWs = stripTrailingSlash((env.KWIZERA_BINANCE_WS_BASE ?? BINANCE_DEFAULT_WS_BASE).trim());

  let restBaseUrl = requestedRest || BINANCE_DEFAULT_REST_BASE;
  let usedOfficialFallback = false;
  const restIsHttps = restBaseUrl.startsWith("https://");
  if (!restIsHttps || isPrivateOrLocalHost(restBaseUrl)) {
    restBaseUrl = BINANCE_DEFAULT_REST_BASE;
    usedOfficialFallback = requestedRest !== BINANCE_DEFAULT_REST_BASE;
  }

  let websocketBaseUrl = requestedWs || BINANCE_DEFAULT_WS_BASE;
  if (!websocketBaseUrl.startsWith("wss://") || isPrivateOrLocalHost(websocketBaseUrl.replace("wss://", "https://"))) {
    websocketBaseUrl = BINANCE_DEFAULT_WS_BASE;
  }

  return {
    enabled,
    restBaseUrl,
    websocketBaseUrl,
    timeoutMs: parsePositiveInt(env.KWIZERA_BINANCE_TIMEOUT_MS, BINANCE_DEFAULT_TIMEOUT_MS),
    environment,
    restBaseHost: hostOf(restBaseUrl),
    usedOfficialFallback,
    restFallbackUrls: uniqueOfficialRestBases(restBaseUrl),
  };
}

function uniqueOfficialRestBases(primary: string): string[] {
  const allow = new Set<string>(BINANCE_PUBLIC_REST_FALLBACKS);
  const ordered: string[] = [];
  for (const url of [primary, ...BINANCE_PUBLIC_REST_FALLBACKS]) {
    if (!allow.has(url) && url !== primary) continue;
    if (!ordered.includes(url)) ordered.push(url);
  }
  return ordered;
}
