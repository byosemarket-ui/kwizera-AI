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
  "MUTATION_SECRET_MISMATCH",
]);

const SDK_CANCEL = new Set([
  "SDK_CANCEL_SURFACE_UNVERIFIED",
]);

const SDK_CLOSE = new Set([
  "SDK_CLOSE_SURFACE_UNVERIFIED",
]);

const GRANT_AUTHORIZATION = new Set([
  "NO_ACTIVE_DEMO_GRANT",
  "NO_GRANT_COVERING_INSTRUMENT",
  "GRANT_LOTS_INSUFFICIENT",
  "GRANT_EXPIRED_OR_REVOKED",
  "GRANT_NOT_FOUND",
  "INSTRUMENT_NOT_ALLOWLISTED",
  "LOTS_EXCEED_GRANT",
  "GRANT_ALLOWLIST_EMPTY",
  "GRANT_ALLOWLIST_REQUIRED",
  "INSTRUMENT_REQUIRED",
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
  ...SDK_CANCEL,
  ...SDK_CLOSE,
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

export type DemoReadinessComponentId =
  | "connection"
  | "marketData"
  | "instrumentEligibility"
  | "mutationConfig"
  | "secret"
  | "grant"
  | "orderSubmission"
  | "modificationCancellation"
  | "positionCloseMonitor";

export interface DemoReadinessComponent {
  id: DemoReadinessComponentId;
  ok: boolean;
  blockers: string[];
  remediation: string | null;
}

const COMPONENT_REMEDIATION: Record<DemoReadinessComponentId, string> = {
  connection:
    "Ensure ForexConnect DEMO session is CONNECTED (sidecar /status). LIVE sessions are rejected for mutation.",
  marketData:
    "Subscribe Offers for the target instrument and wait for a fresh non-crossed bid/ask (CONNECTED alone is not quote-ready).",
  instrumentEligibility:
    "Confirm the instrument is catalog-permitted for the DEMO account (e.g. XAU/USD) and symbol normalization matches broker form.",
  mutationConfig:
    "Owner: set KWIZERA_FOREXCONNECT_ALLOW_DEMO_MUTATION=1 in /opt/kwizera-ai/.env for BOTH Node and sidecar, then restart both services. Do not enable until authorized.",
  secret:
    "Owner: set identical KWIZERA_FOREXCONNECT_DEMO_MUTATION_SECRET on Node and sidecar via .env (never in git/chat). Restart both. Presence is not proof of equality — readiness reports mutationSecretsConsistent.",
  grant:
    "Owner/admin: after env+secret are consistent, POST /demo-lifecycle/grant with non-empty instrumentAllowlist (e.g. [\"XAU/USD\"]), short ttlMs, and explicit maxLots. Empty allowlists are rejected.",
  orderSubmission:
    "Requires connection + DEMO + mutation config + matching secrets + covering grant + fresh quote + SDK TRUE_MARKET_OPEN. Connection or quotes alone never authorize submission.",
  modificationCancellation:
    "Requires the same auth gates as submission plus verified DELETE_ORDER / cancel surface. Pending order cancel is not implied by Offers freshness.",
  positionCloseMonitor:
    "Requires the same auth gates plus verified TRUE_MARKET_CLOSE / partial-close surface. Open positions are distinct from pending orders.",
};

function pickBlockers(all: string[], pred: (code: string) => boolean): string[] {
  return all.filter((c) => pred(String(c)));
}

/**
 * Consolidated component readiness. Each surface is independently scored so operators
 * do not treat CONNECTED/quotes as order-execution readiness.
 */
export function buildDemoReadinessComponents(input: {
  blockers: string[];
  connected: boolean;
  demoSession: boolean;
  nodeMutationEnvEnabled: boolean;
  sidecarMutationEnvEnabled: boolean;
  nodeMutationSecretConfigured: boolean;
  sidecarMutationSecretConfigured: boolean;
  mutationSecretsConsistent: boolean | null;
  grantCoverageOk: boolean;
  quoteReady: boolean;
  sdkMutationOk: boolean;
  sdkProtectiveOk: boolean;
  sdkCancelOk: boolean;
  sdkCloseOk: boolean;
}): {
  components: DemoReadinessComponent[];
  mayAttemptDemoMutation: boolean;
  mayAttemptDemoCancel: boolean;
  mayAttemptDemoClose: boolean;
} {
  const blockers = input.blockers.map((b) => String(b || "").trim()).filter(Boolean);

  const connectionBlockers = pickBlockers(
    blockers,
    (c) => SESSION.has(c) || c === "SESSION_NOT_CONNECTED" || c === "ENVIRONMENT_NOT_DEMO",
  );
  if (!input.connected && !connectionBlockers.includes("SESSION_NOT_CONNECTED")) {
    connectionBlockers.push("SESSION_NOT_CONNECTED");
  }
  if (!input.demoSession && !connectionBlockers.includes("ENVIRONMENT_NOT_DEMO")) {
    connectionBlockers.push("ENVIRONMENT_NOT_DEMO");
  }

  const marketBlockers = pickBlockers(
    blockers,
    (c) => classifyDemoReadinessBlocker(c) === "MARKET",
  );
  const instrumentBlockers = pickBlockers(
    blockers,
    (c) =>
      c === "INSTRUMENT_NOT_PERMITTED"
      || c === "CATALOG_UNAVAILABLE"
      || c === "INSTRUMENT_NOT_SUBSCRIBED"
      || c === "TRADING_STATUS_CLOSED"
      || c === "TRADING_STATUS_UNKNOWN",
  );
  const mutationConfigBlockers = pickBlockers(
    blockers,
    (c) => c === "NODE_MUTATION_ENV_DISABLED" || c === "SIDECAR_MUTATION_ENV_DISABLED",
  );
  const secretBlockers = pickBlockers(
    blockers,
    (c) =>
      c === "NODE_MUTATION_SECRET_NOT_CONFIGURED"
      || c === "SIDECAR_MUTATION_SECRET_NOT_CONFIGURED"
      || c === "MUTATION_SECRET_NOT_CONFIGURED"
      || c === "MUTATION_SECRET_MISMATCH",
  );
  const grantBlockers = pickBlockers(
    blockers,
    (c) => classifyDemoReadinessBlocker(c) === "GRANT_AUTHORIZATION",
  );
  const sdkOpenBlockers = pickBlockers(
    blockers,
    (c) => c === "SDK_MUTATION_SURFACE_UNVERIFIED" || c === "SDK_PROTECTIVE_SURFACE_UNVERIFIED",
  );
  const sdkCancelBlockers = pickBlockers(blockers, (c) => c === "SDK_CANCEL_SURFACE_UNVERIFIED");
  const sdkCloseBlockers = pickBlockers(blockers, (c) => c === "SDK_CLOSE_SURFACE_UNVERIFIED");

  // Proven mismatch fails closed; null (unknown/legacy) allows presence-only until both fingerprints exist.
  const secretsAligned = input.mutationSecretsConsistent !== false;
  const authOk =
    input.connected
    && input.demoSession
    && input.nodeMutationEnvEnabled
    && input.sidecarMutationEnvEnabled
    && input.nodeMutationSecretConfigured
    && input.sidecarMutationSecretConfigured
    && secretsAligned
    && input.grantCoverageOk;

  const submissionBlockers = [
    ...connectionBlockers,
    ...mutationConfigBlockers,
    ...secretBlockers,
    ...grantBlockers,
    ...marketBlockers,
    ...instrumentBlockers,
    ...sdkOpenBlockers,
  ].filter((c, i, a) => a.indexOf(c) === i);

  const cancelBlockers = [
    ...connectionBlockers,
    ...mutationConfigBlockers,
    ...secretBlockers,
    ...grantBlockers,
    ...sdkCancelBlockers,
  ].filter((c, i, a) => a.indexOf(c) === i);

  const closeBlockers = [
    ...connectionBlockers,
    ...mutationConfigBlockers,
    ...secretBlockers,
    ...grantBlockers,
    ...sdkCloseBlockers,
  ].filter((c, i, a) => a.indexOf(c) === i);

  const mk = (
    id: DemoReadinessComponentId,
    ok: boolean,
    componentBlockers: string[],
  ): DemoReadinessComponent => ({
    id,
    ok,
    blockers: componentBlockers,
    remediation: ok ? null : COMPONENT_REMEDIATION[id],
  });

  const components: DemoReadinessComponent[] = [
    mk("connection", connectionBlockers.length === 0 && input.connected && input.demoSession, connectionBlockers),
    mk("marketData", marketBlockers.length === 0 && input.quoteReady, marketBlockers),
    mk("instrumentEligibility", instrumentBlockers.length === 0, instrumentBlockers),
    mk(
      "mutationConfig",
      mutationConfigBlockers.length === 0
        && input.nodeMutationEnvEnabled
        && input.sidecarMutationEnvEnabled,
      mutationConfigBlockers,
    ),
    mk(
      "secret",
      secretBlockers.length === 0
        && input.nodeMutationSecretConfigured
        && input.sidecarMutationSecretConfigured
        && secretsAligned,
      secretBlockers,
    ),
    mk("grant", grantBlockers.length === 0 && input.grantCoverageOk, grantBlockers),
    mk(
      "orderSubmission",
      authOk && input.quoteReady && input.sdkMutationOk && submissionBlockers.length === 0,
      submissionBlockers,
    ),
    mk(
      "modificationCancellation",
      authOk && input.sdkCancelOk && cancelBlockers.length === 0,
      cancelBlockers,
    ),
    mk(
      "positionCloseMonitor",
      authOk && input.sdkCloseOk && closeBlockers.length === 0,
      closeBlockers,
    ),
  ];

  return {
    components,
    mayAttemptDemoMutation: components.find((c) => c.id === "orderSubmission")?.ok === true,
    mayAttemptDemoCancel: components.find((c) => c.id === "modificationCancellation")?.ok === true,
    mayAttemptDemoClose: components.find((c) => c.id === "positionCloseMonitor")?.ok === true,
  };
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
 * that explicitly allowlists the instrument and maxLots >= lots.
 * Empty allowlists never cover any instrument (fail closed).
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
    // Fail closed: empty allowlist covers nothing.
    if (allow.length === 0) return false;
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
