/**
 * FXCM Socket REST API configuration (official hosts only).
 * Env naming follows KWIZERA_* convention used by Binance.
 *
 * Official docs:
 * https://fxcm-rest.readthedocs.io/en/latest/socketrestapispecs.html
 * - Demo host: api-demo.fxcm.com
 * - Real host: api.fxcm.com
 * - Auth: Trading Station Web access token
 */
export const FXCM_OFFICIAL_DEMO_REST_BASE = "https://api-demo.fxcm.com";
export const FXCM_OFFICIAL_REAL_REST_BASE = "https://api.fxcm.com";
export const FXCM_DEFAULT_TIMEOUT_MS = 12_000;
export const FXCM_INSTRUMENT_CACHE_MS = 15 * 60 * 1000;

export const FXCM_REST_PATHS = {
  socketIo: "/socket.io/",
  getInstruments: "/trading/get_instruments",
} as const;

/** Phase 25 capabilities — foundation only. */
export const FXCM_PHASE25_CAPABILITIES = {
  instruments: true,
  liveQuotes: false,
  streamingQuotes: false,
  historicalPrices: false,
  candles: false,
  trading: false,
} as const;

export type FxcmEnvironment = "demo" | "real";

export interface FxcmConfig {
  enabled: boolean;
  environment: FxcmEnvironment;
  environmentLabel: "FXCM DEMO" | "FXCM REAL";
  restBaseUrl: string;
  restBaseHost: string;
  timeoutMs: number;
  /** True when a non-empty access token is present in server env. Never expose the token. */
  accessTokenConfigured: boolean;
  apiPath: "FXCM_SOCKET_REST";
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 500 && n <= 60_000 ? Math.floor(n) : fallback;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

function parseEnvironment(raw: string | undefined): FxcmEnvironment {
  const v = String(raw ?? "demo").trim().toLowerCase();
  if (v === "real" || v === "live" || v === "production" || v === "prod") return "real";
  return "demo";
}

/**
 * Resolve FXCM config from env. Access token is never returned in the public config object.
 */
export function resolveFxcmConfig(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): FxcmConfig {
  const enabledRaw = (env.KWIZERA_FXCM_ENABLED ?? "0").trim().toLowerCase();
  const enabled = enabledRaw === "1" || enabledRaw === "true" || enabledRaw === "on" || enabledRaw === "yes";
  const environment = parseEnvironment(env.KWIZERA_FXCM_ENVIRONMENT ?? env.FXCM_ENVIRONMENT);
  const officialBase = environment === "real" ? FXCM_OFFICIAL_REAL_REST_BASE : FXCM_OFFICIAL_DEMO_REST_BASE;

  // Only allow official FXCM hosts — ignore arbitrary browser/user URLs.
  let restBaseUrl = officialBase;
  const override = stripTrailingSlash((env.KWIZERA_FXCM_REST_BASE ?? "").trim());
  if (override) {
    const host = hostOf(override).toLowerCase();
    if (host === "api-demo.fxcm.com" || host === "api.fxcm.com") {
      restBaseUrl = override.startsWith("https://") ? override : officialBase;
    }
  }

  const token = String(env.KWIZERA_FXCM_ACCESS_TOKEN ?? env.FXCM_ACCESS_TOKEN ?? "").trim();

  return {
    enabled,
    environment,
    environmentLabel: environment === "real" ? "FXCM REAL" : "FXCM DEMO",
    restBaseUrl,
    restBaseHost: hostOf(restBaseUrl),
    timeoutMs: parsePositiveInt(env.KWIZERA_FXCM_TIMEOUT_MS, FXCM_DEFAULT_TIMEOUT_MS),
    accessTokenConfigured: token.length >= 16,
    apiPath: "FXCM_SOCKET_REST",
  };
}

/** Server-only token reader — never call from frontend modules. */
export function readFxcmAccessToken(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): string | null {
  const token = String(env.KWIZERA_FXCM_ACCESS_TOKEN ?? env.FXCM_ACCESS_TOKEN ?? "").trim();
  return token.length >= 16 ? token : null;
}
