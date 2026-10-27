/**
 * Phase 59.0.12E — Classify DEMO mutation readiness blockers.
 * Distinguishes owner-config, grant/auth, session, market, and SDK surfaces
 * so operators do not treat every fail-closed gate as one generic BLOCKED.
 * Never enables mutation; never exposes secrets.
 */

export type DemoReadinessBlockerCategory =
  | "OWNER_CONFIG"
  | "GRANT_AUTHORIZATION"
  | "SESSION"
  | "MARKET"
  | "SDK"
  | "UNKNOWN";

const OWNER_CONFIG = new Set([
  "SIDECAR_MUTATION_ENV_DISABLED",
  "NODE_MUTATION_ENV_DISABLED",
  "MUTATION_SECRET_NOT_CONFIGURED",
  "SIDECAR_MUTATION_SECRET_NOT_CONFIGURED",
  "NODE_MUTATION_SECRET_NOT_CONFIGURED",
]);

const GRANT_AUTHORIZATION = new Set([
  "NO_ACTIVE_DEMO_GRANT",
  "NO_GRANT_COVERING_INSTRUMENT",
  "GRANT_LOTS_INSUFFICIENT",
  "GRANT_EXPIRED_OR_REVOKED",
  "GRANT_NOT_FOUND",
  "INSTRUMENT_NOT_ALLOWLISTED",
  "LOTS_EXCEED_GRANT",
]);

const SESSION = new Set([
  "SESSION_NOT_CONNECTED",
  "ENVIRONMENT_NOT_DEMO",
]);

const MARKET = new Set([
  "QUOTE_UNAVAILABLE",
  "QUOTE_NOT_RECEIVED",
  "QUOTE_STALE",
  "QUOTE_AGE_EXCEEDED",
  "QUOTE_CROSSED",
  "QUOTE_INSTRUMENT_MISMATCH",
  "INSTRUMENT_NOT_SUBSCRIBED",
  "INSTRUMENT_NOT_PERMITTED",
  "CATALOG_UNAVAILABLE",
  "SUBSCRIPTION_FAILED",
  "TRADING_STATUS_CLOSED",
  "TRADING_STATUS_UNKNOWN",
]);

const SDK = new Set([
  "SDK_MUTATION_SURFACE_UNVERIFIED",
  "SDK_PROTECTIVE_SURFACE_UNVERIFIED",
]);

export function classifyDemoReadinessBlocker(code: string): DemoReadinessBlockerCategory {
  const c = String(code || "").trim();
  if (!c) return "UNKNOWN";
  if (OWNER_CONFIG.has(c)) return "OWNER_CONFIG";
  if (GRANT_AUTHORIZATION.has(c)) return "GRANT_AUTHORIZATION";
  if (SESSION.has(c)) return "SESSION";
  if (MARKET.has(c) || c.startsWith("QUOTE_") || c.startsWith("SUBSCRIPTION_")) return "MARKET";
  if (SDK.has(c) || c.startsWith("SDK_")) return "SDK";
  return "UNKNOWN";
}

export function groupDemoReadinessBlockers(
  blockers: string[],
): Record<DemoReadinessBlockerCategory, string[]> {
  const out: Record<DemoReadinessBlockerCategory, string[]> = {
    OWNER_CONFIG: [],
    GRANT_AUTHORIZATION: [],
    SESSION: [],
    MARKET: [],
    SDK: [],
    UNKNOWN: [],
  };
  for (const raw of blockers) {
    const code = String(raw || "").trim();
    if (!code) continue;
    out[classifyDemoReadinessBlocker(code)].push(code);
  }
  return out;
}

/**
 * Prefer a specific readiness blocker over a generic READINESS_BLOCKED label
 * so lifecycle records and API clients can distinguish owner-config vs market vs grant.
 */
export function primaryDemoReadinessBlocker(blockers: unknown): string {
  if (!Array.isArray(blockers) || blockers.length === 0) return "READINESS_BLOCKED";
  const first = String(blockers[0] ?? "").trim();
  return first || "READINESS_BLOCKED";
}

export interface GrantCoverageInput {
  instrument?: string | null;
  lots?: number | null;
  grants: Array<{
    instrumentAllowlist?: string[];
    maxLots?: number;
    expiresAtUtc?: string;
    revokedAtUtc?: string | null;
    environment?: string;
  }>;
  nowMs?: number;
}

export interface GrantCoverageResult {
  activeGrantCount: number;
  coveringGrantCount: number;
  requestedInstrument: string | null;
  requestedLots: number | null;
  blockers: string[];
  ok: boolean;
}

function normalizeSymbol(s: string): string {
  return s.replace(/\s+/g, "").toUpperCase();
}

/**
 * When instrument/lots are supplied, require at least one unexpired DEMO grant
 * that allowlists the instrument (empty allowlist = unrestricted) and maxLots >= lots.
 * When instrument is omitted, only active-grant presence is evaluated by the caller.
 */
export function evaluateDemoGrantCoverage(input: GrantCoverageInput): GrantCoverageResult {
  const nowMs = input.nowMs ?? Date.now();
  const instrument = input.instrument != null ? String(input.instrument).trim() : "";
  const lotsRaw = input.lots;
  const lots =
    lotsRaw == null || lotsRaw === ("" as unknown)
      ? null
      : Number.isFinite(Number(lotsRaw))
        ? Math.floor(Number(lotsRaw))
        : null;

  const active = input.grants.filter((g) => {
    if (g.revokedAtUtc) return false;
    if (g.environment && String(g.environment).toUpperCase() !== "DEMO") return false;
    const exp = g.expiresAtUtc ? Date.parse(g.expiresAtUtc) : NaN;
    return Number.isFinite(exp) && exp > nowMs;
  });

  const blockers: string[] = [];
  if (active.length === 0) {
    blockers.push("NO_ACTIVE_DEMO_GRANT");
    return {
      activeGrantCount: 0,
      coveringGrantCount: 0,
      requestedInstrument: instrument || null,
      requestedLots: lots,
      blockers,
      ok: false,
    };
  }

  if (!instrument) {
    return {
      activeGrantCount: active.length,
      coveringGrantCount: active.length,
      requestedInstrument: null,
      requestedLots: lots,
      blockers: [],
      ok: true,
    };
  }

  const want = normalizeSymbol(instrument);
  const covering = active.filter((g) => {
    const allow = Array.isArray(g.instrumentAllowlist) ? g.instrumentAllowlist : [];
    if (allow.length === 0) return true;
    return allow.some((a) => normalizeSymbol(String(a)) === want);
  });

  if (covering.length === 0) {
    blockers.push("NO_GRANT_COVERING_INSTRUMENT");
  }

  if (lots != null && lots >= 1) {
    const lotOk = covering.some((g) => Number(g.maxLots ?? 0) >= lots);
    if (covering.length > 0 && !lotOk) {
      blockers.push("GRANT_LOTS_INSUFFICIENT");
    }
  }

  return {
    activeGrantCount: active.length,
    coveringGrantCount: covering.filter((g) =>
      lots == null || lots < 1 ? true : Number(g.maxLots ?? 0) >= lots,
    ).length,
    requestedInstrument: instrument,
    requestedLots: lots,
    blockers,
    ok: blockers.length === 0,
  };
}
