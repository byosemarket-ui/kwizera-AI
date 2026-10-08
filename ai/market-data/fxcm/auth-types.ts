/**
 * Phase 26 — FXCM authentication state & safe status contracts.
 * Secrets never appear in these public shapes.
 */
import type { FxcmEnvironment } from "./config.js";

export const FXCM_AUTH_STATES = [
  "DISABLED",
  "NOT_CONFIGURED",
  "CONFIGURED",
  "AUTHENTICATING",
  "AUTHENTICATED",
  "AUTHENTICATION_ERROR",
  "EXPIRED",
  "RECONNECTING",
  "NETWORK_ERROR",
  "UNAVAILABLE",
  "ERROR",
] as const;

export type FxcmAuthState = (typeof FXCM_AUTH_STATES)[number];

/** Safe authentication context for adapters / UI — never includes tokens. */
export interface FxcmAuthContext {
  state: FxcmAuthState;
  environment: FxcmEnvironment;
  environmentLabel: "FXCM DEMO" | "FXCM REAL";
  configured: boolean;
  authenticatedAt: string | null;
  lastValidatedAt: string | null;
  /** Official Socket REST has no documented token expiry; always null in Phase 26. */
  expiresAt: null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  marketData: "NOT_STARTED";
  liveStream: "NOT_ENABLED_YET";
  trading: "DISABLED";
  sessionActive: boolean;
}

export interface SafeFxcmAuthenticationStatus {
  provider: "FXCM";
  enabled: boolean;
  environment: FxcmEnvironment;
  environmentLabel: "FXCM DEMO" | "FXCM REAL";
  configured: boolean;
  authentication: {
    state: FxcmAuthState;
    authenticatedAt: string | null;
    lastValidatedAt: string | null;
    expiresAt: null;
    session: "ACTIVE" | "INACTIVE" | "EXPIRED" | "NONE";
    lastErrorCode: string | null;
    lastErrorMessage: string | null;
  };
  marketData: "NOT_STARTED";
  liveStream: "NOT_ENABLED_YET";
  trading: "DISABLED";
  note: string;
}

export type FxcmAuthErrorCode =
  | "FXCM_CONFIG_MISSING"
  | "FXCM_CONFIG_INVALID"
  | "FXCM_AUTH_INVALID_CREDENTIALS"
  | "FXCM_AUTH_UNAUTHORIZED"
  | "FXCM_AUTH_EXPIRED"
  | "FXCM_AUTH_TIMEOUT"
  | "FXCM_AUTH_NETWORK_ERROR"
  | "FXCM_AUTH_RATE_LIMITED"
  | "FXCM_AUTH_PROVIDER_UNAVAILABLE"
  | "FXCM_AUTH_PROTOCOL_ERROR"
  | "FXCM_AUTH_UNKNOWN"
  | "FXCM_DISABLED";
