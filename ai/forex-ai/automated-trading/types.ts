/**
 * Phase 51/52 — Automated Trading foundation + verification types.
 * DEMO/LIVE isolation. No broker order submission.
 */
import type { AutomatedTradingVerificationResult } from "./verification-types.js";
export type { AutomatedTradingVerificationResult } from "./verification-types.js";

export const AUTOMATED_TRADING_SCHEMA = "forex-automated-trading-v1";
export const AUTOMATED_TRADING_PHASE = "53.3";
export const AUTOMATED_EXECUTION_BANNER =
  "AUTOMATED EXECUTION NOT IMPLEMENTED — PHASE 53.3";

export type AutomatedTradingEnvironment = "DEMO" | "LIVE";

export type AutomatedTradingModuleStatus =
  | "INITIALIZING"
  | "READY"
  | "BLOCKED"
  | "ERROR";

export type AutomatedTradingBrokerConnectionStatus =
  | "CONNECTED"
  | "DISCONNECTED"
  | "UNKNOWN"
  | "UNAVAILABLE"
  | "MISMATCH";

export interface AutomatedTradingEnvControls {
  /** Master switch — configures future workflow only; never enables Phase 51 execution. */
  masterEnable: boolean;
  /** Automatic entry — always treated as disabled for execution in Phase 51. */
  automaticEntry: boolean;
  /** Position management — not active in Phase 51. */
  positionManagement: boolean;
  /**
   * When true, future automated entries are blocked.
   * Does not close existing broker positions.
   */
  emergencyEntryLock: boolean;
}

export interface AutomatedTradingEnvState {
  environment: AutomatedTradingEnvironment;
  controls: AutomatedTradingEnvControls;
  /** Opaque account id last verified for this environment (never a password). */
  lastVerifiedAccountId: string | null;
  lastVerifiedAtUtc: string | null;
  lastVerificationStatus: string | null;
  credentialsConfigured: boolean;
  usernameHint: string | null;
  /** Selected ForexConnect instrument for this environment (provider symbol). */
  selectedInstrument: string | null;
  /** Last successful verification payload (no secrets). */
  lastVerification: AutomatedTradingVerificationResult | null;
}

export interface AutomatedTradingPersistedState {
  schemaVersion: typeof AUTOMATED_TRADING_SCHEMA;
  phase: typeof AUTOMATED_TRADING_PHASE;
  configVersion: number;
  selectedEnvironment: AutomatedTradingEnvironment;
  /** Bumped on every environment switch to reject stale clients. */
  environmentEpoch: number;
  environments: {
    DEMO: AutomatedTradingEnvState;
    LIVE: AutomatedTradingEnvState;
  };
  updatedAtUtc: string;
}

export interface AutomatedTradingAuditEvent {
  id: string;
  atUtc: string;
  action: string;
  environment: AutomatedTradingEnvironment | null;
  ok: boolean;
  code: string | null;
  detail: string;
  configVersion: number;
  environmentEpoch: number;
}

export interface AutomatedTradingPublicStatus {
  schemaVersion: typeof AUTOMATED_TRADING_SCHEMA;
  phase: typeof AUTOMATED_TRADING_PHASE;
  moduleStatus: AutomatedTradingModuleStatus;
  selectedEnvironment: AutomatedTradingEnvironment;
  environmentEpoch: number;
  configVersion: number;
  banner: typeof AUTOMATED_EXECUTION_BANNER;
  broker: {
    connectionStatus: AutomatedTradingBrokerConnectionStatus;
    activeSessionEnvironment: AutomatedTradingEnvironment | null;
    sessionMatchesSelection: boolean | null;
    accountIdMasked: string | null;
    openPositionsCount: number | null;
    lastStatusAtUtc: string | null;
    credentialsConfigured: boolean;
    usernameHint: string | null;
    accountVerified: boolean;
  };
  controls: {
    masterEnable: boolean;
    automaticEntry: "DISABLED";
    positionManagement: "NOT_ACTIVE";
    emergencyEntryLock: boolean;
    automatedExecutionEnabled: false;
  };
  blockers: string[];
  explanation: string;
  selectedEnvState: AutomatedTradingEnvState;
  verification: AutomatedTradingVerificationResult | null;
  readiness: AutomatedTradingVerificationResult["readiness"] | null;
  updatedAtUtc: string;
  placesOrders: false;
}

export function defaultEnvControls(): AutomatedTradingEnvControls {
  return {
    masterEnable: false,
    automaticEntry: false,
    positionManagement: false,
    emergencyEntryLock: true,
  };
}

export function defaultEnvState(environment: AutomatedTradingEnvironment): AutomatedTradingEnvState {
  return {
    environment,
    controls: defaultEnvControls(),
    lastVerifiedAccountId: null,
    lastVerifiedAtUtc: null,
    lastVerificationStatus: null,
    credentialsConfigured: false,
    usernameHint: null,
    selectedInstrument: null,
    lastVerification: null,
  };
}

export function defaultPersistedState(): AutomatedTradingPersistedState {
  const now = new Date().toISOString();
  return {
    schemaVersion: AUTOMATED_TRADING_SCHEMA,
    phase: AUTOMATED_TRADING_PHASE,
    configVersion: 1,
    selectedEnvironment: "DEMO",
    environmentEpoch: 1,
    environments: {
      DEMO: defaultEnvState("DEMO"),
      LIVE: defaultEnvState("LIVE"),
    },
    updatedAtUtc: now,
  };
}

export function parseAutomatedTradingEnvironment(
  raw: unknown,
): AutomatedTradingEnvironment | null {
  const v = String(raw ?? "").trim().toUpperCase();
  if (v === "DEMO") return "DEMO";
  if (v === "LIVE") return "LIVE";
  return null;
}

export function maskAccountId(id: string | null | undefined): string | null {
  if (!id || !String(id).trim()) return null;
  const s = String(id).trim();
  if (s.length <= 4) return "••••";
  return `${"•".repeat(Math.min(6, s.length - 4))}${s.slice(-4)}`;
}
