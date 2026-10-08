/**
 * Phase 26 — FXCM Authentication Service (Socket REST official access-token flow).
 *
 * Server-side only. Session material stays in memory and is never serialized to APIs/logs.
 * Does NOT start market streaming, candles, or trading.
 */
import {
  resolveFxcmConfig,
  readFxcmAccessToken,
  type FxcmConfig,
} from "./config.js";
import { openFxcmSession, type FetchLike } from "./client.js";
import { FxcmMarketDataError, userFacingFxcmError } from "./errors.js";
import type {
  FxcmAuthContext,
  FxcmAuthErrorCode,
  FxcmAuthState,
  SafeFxcmAuthenticationStatus,
} from "./auth-types.js";
import type { FxcmSessionHandle } from "./types.js";

const MAX_NETWORK_RETRIES = 2;
const BASE_BACKOFF_MS = 400;

export interface FxcmAuthServiceOptions {
  env?: Record<string, string | undefined>;
  fetchImpl?: FetchLike;
  nowMs?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

interface PrivateSession {
  handle: FxcmSessionHandle;
  authenticatedAt: string;
  lastValidatedAt: string;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    t.unref?.();
  });
}

export function mapToAuthErrorCode(code: string): FxcmAuthErrorCode {
  switch (code) {
    case "FXCM_DISABLED":
      return "FXCM_DISABLED";
    case "FXCM_NOT_CONFIGURED":
      return "FXCM_CONFIG_MISSING";
    case "FXCM_AUTHENTICATION_FAILED":
      return "FXCM_AUTH_UNAUTHORIZED";
    case "FXCM_RATE_LIMITED":
      return "FXCM_AUTH_RATE_LIMITED";
    case "FXCM_TIMEOUT":
      return "FXCM_AUTH_TIMEOUT";
    case "FXCM_NETWORK":
    case "FXCM_CONNECTION_FAILED":
      return "FXCM_AUTH_NETWORK_ERROR";
    case "FXCM_UNAVAILABLE":
      return "FXCM_AUTH_PROVIDER_UNAVAILABLE";
    case "FXCM_INVALID_RESPONSE":
      return "FXCM_AUTH_PROTOCOL_ERROR";
    default:
      return "FXCM_AUTH_UNKNOWN";
  }
}

function isRetryableNetwork(code: FxcmAuthErrorCode): boolean {
  return code === "FXCM_AUTH_NETWORK_ERROR"
    || code === "FXCM_AUTH_TIMEOUT"
    || code === "FXCM_AUTH_PROVIDER_UNAVAILABLE"
    || code === "FXCM_AUTH_RATE_LIMITED";
}

export class FxcmAuthenticationService {
  private readonly env: Record<string, string | undefined>;
  private readonly fetchImpl?: FetchLike;
  private readonly nowMs: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private config: FxcmConfig;
  private state: FxcmAuthState = "DISABLED";
  private session: PrivateSession | null = null;
  private lastErrorCode: FxcmAuthErrorCode | null = null;
  private lastErrorMessage: string | null = null;
  private inflight: Promise<FxcmAuthContext> | null = null;

  constructor(options: FxcmAuthServiceOptions = {}) {
    this.env = options.env ?? (process.env as Record<string, string | undefined>);
    this.fetchImpl = options.fetchImpl;
    this.nowMs = options.nowMs ?? (() => Date.now());
    this.sleep = options.sleep ?? defaultSleep;
    this.config = resolveFxcmConfig(this.env);
    this.state = this.initialStateFromConfig();
  }

  private initialStateFromConfig(): FxcmAuthState {
    if (!this.config.enabled) return "DISABLED";
    if (!this.config.accessTokenConfigured) return "NOT_CONFIGURED";
    const token = readFxcmAccessToken(this.env);
    if (!token || token.length < 16) return "NOT_CONFIGURED";
    return "CONFIGURED";
  }

  getConfig(): FxcmConfig {
    return this.config;
  }

  getState(): FxcmAuthState {
    return this.state;
  }

  /** Reload config from env (e.g. after process restart simulation in tests). */
  reloadConfig(): void {
    this.config = resolveFxcmConfig(this.env);
    if (this.state === "AUTHENTICATED" || this.state === "AUTHENTICATING") return;
    this.state = this.initialStateFromConfig();
  }

  getSafeStatus(): SafeFxcmAuthenticationStatus {
    const sessionLabel =
      this.state === "EXPIRED" ? "EXPIRED"
        : this.session && this.state === "AUTHENTICATED" ? "ACTIVE"
          : this.session ? "INACTIVE"
            : "NONE";
    return {
      provider: "FXCM",
      enabled: this.config.enabled,
      environment: this.config.environment,
      environmentLabel: this.config.environmentLabel,
      configured: this.config.enabled && this.config.accessTokenConfigured,
      authentication: {
        state: this.state,
        authenticatedAt: this.session?.authenticatedAt ?? null,
        lastValidatedAt: this.session?.lastValidatedAt ?? null,
        expiresAt: null,
        session: sessionLabel,
        lastErrorCode: this.lastErrorCode,
        lastErrorMessage: this.lastErrorMessage,
      },
      marketData: "NOT_STARTED",
      liveStream: "NOT_ENABLED_YET",
      trading: "DISABLED",
      note: "FXCM authenticated ≠ market streaming. Live stream is not enabled in Phase 26.",
    };
  }

  getAuthContext(): FxcmAuthContext {
    return {
      state: this.state,
      environment: this.config.environment,
      environmentLabel: this.config.environmentLabel,
      configured: this.config.enabled && this.config.accessTokenConfigured,
      authenticatedAt: this.session?.authenticatedAt ?? null,
      lastValidatedAt: this.session?.lastValidatedAt ?? null,
      expiresAt: null,
      lastErrorCode: this.lastErrorCode,
      lastErrorMessage: this.lastErrorMessage,
      marketData: "NOT_STARTED",
      liveStream: "NOT_ENABLED_YET",
      trading: "DISABLED",
      sessionActive: Boolean(this.session && this.state === "AUTHENTICATED"),
    };
  }

  /**
   * Internal session handle for trusted provider code only.
   * Never include in JSON responses.
   */
  getSessionHandle(): FxcmSessionHandle | null {
    if (!this.session || this.state !== "AUTHENTICATED") return null;
    return this.session.handle;
  }

  clearSession(reason: "logout" | "expired" | "error" = "logout"): void {
    this.session = null;
    if (reason === "expired") {
      this.state = "EXPIRED";
    } else if (reason === "error") {
      // keep last error state if already set
      if (this.state === "AUTHENTICATED") this.state = "ERROR";
    } else if (this.config.enabled && this.config.accessTokenConfigured) {
      this.state = "CONFIGURED";
    } else {
      this.state = this.initialStateFromConfig();
    }
    console.info("[FXCM] session cleared", JSON.stringify({
      environment: this.config.environment,
      reason,
      state: this.state,
    }));
  }

  /**
   * Authenticate with single-flight protection.
   * Concurrent callers share one in-flight attempt.
   */
  authenticate(options?: { force?: boolean }): Promise<FxcmAuthContext> {
    if (!options?.force && this.state === "AUTHENTICATED" && this.session) {
      return Promise.resolve(this.getAuthContext());
    }
    if (this.inflight) return this.inflight;

    this.inflight = this.runAuthenticate(Boolean(options?.force))
      .finally(() => {
        this.inflight = null;
      });
    return this.inflight;
  }

  private async runAuthenticate(force: boolean): Promise<FxcmAuthContext> {
    this.config = resolveFxcmConfig(this.env);

    if (!this.config.enabled) {
      this.session = null;
      this.state = "DISABLED";
      this.lastErrorCode = "FXCM_DISABLED";
      this.lastErrorMessage = "FXCM is disabled.";
      console.info("[FXCM] authentication skipped", JSON.stringify({ environment: this.config.environment, state: this.state }));
      return this.getAuthContext();
    }

    if (!this.config.accessTokenConfigured) {
      this.session = null;
      this.state = "NOT_CONFIGURED";
      this.lastErrorCode = "FXCM_CONFIG_MISSING";
      this.lastErrorMessage = "FXCM access token is not configured on the server.";
      console.info("[FXCM] authentication skipped", JSON.stringify({ environment: this.config.environment, state: this.state }));
      return this.getAuthContext();
    }

    const token = readFxcmAccessToken(this.env);
    if (!token || token.length < 16) {
      this.session = null;
      this.state = "NOT_CONFIGURED";
      this.lastErrorCode = "FXCM_CONFIG_INVALID";
      this.lastErrorMessage = "FXCM access token configuration is invalid.";
      return this.getAuthContext();
    }

    if (force && this.session) this.clearSession("logout");

    const wasExpired = this.state === "EXPIRED" || this.state === "NETWORK_ERROR";
    this.state = wasExpired ? "RECONNECTING" : "AUTHENTICATING";
    this.lastErrorCode = null;
    this.lastErrorMessage = null;
    console.info("[FXCM] authentication started", JSON.stringify({
      environment: this.config.environment,
      state: this.state,
    }));

    let attempt = 0;
    while (true) {
      attempt += 1;
      try {
        const handle = await openFxcmSession(this.config, {
          env: this.env,
          fetchImpl: this.fetchImpl,
        });
        const nowIso = new Date(this.nowMs()).toISOString();
        this.session = {
          handle,
          authenticatedAt: nowIso,
          lastValidatedAt: nowIso,
        };
        this.state = "AUTHENTICATED";
        this.lastErrorCode = null;
        this.lastErrorMessage = null;
        console.info("[FXCM] authentication succeeded", JSON.stringify({
          environment: this.config.environment,
          state: this.state,
          attempt,
        }));
        return this.getAuthContext();
      } catch (error) {
        const mapped = userFacingFxcmError(error);
        const authCode = mapToAuthErrorCode(mapped.code);
        this.lastErrorCode = authCode;
        this.lastErrorMessage = mapped.message;
        this.session = null;

        if (isRetryableNetwork(authCode) && attempt <= MAX_NETWORK_RETRIES) {
          this.state = "RECONNECTING";
          const delay = BASE_BACKOFF_MS * (2 ** (attempt - 1));
          console.info("[FXCM] authentication retry", JSON.stringify({
            environment: this.config.environment,
            code: authCode,
            attempt,
            delayMs: delay,
          }));
          await this.sleep(delay);
          continue;
        }

        // Do not aggressively retry invalid credentials / unauthorized.
        if (authCode === "FXCM_AUTH_UNAUTHORIZED" || authCode === "FXCM_AUTH_INVALID_CREDENTIALS") {
          this.state = "AUTHENTICATION_ERROR";
        } else if (isRetryableNetwork(authCode)) {
          this.state = "NETWORK_ERROR";
        } else if (authCode === "FXCM_CONFIG_MISSING" || authCode === "FXCM_CONFIG_INVALID") {
          this.state = "NOT_CONFIGURED";
        } else {
          this.state = "ERROR";
        }

        console.info("[FXCM] authentication failed", JSON.stringify({
          environment: this.config.environment,
          code: authCode,
          state: this.state,
          attempt,
        }));
        return this.getAuthContext();
      }
    }
  }

  /** Mark session expired (e.g. after provider 401) and optionally re-authenticate. */
  async markExpiredAndReauthenticate(): Promise<FxcmAuthContext> {
    this.clearSession("expired");
    return this.authenticate({ force: true });
  }

  touchValidated(): void {
    if (this.session && this.state === "AUTHENTICATED") {
      this.session.lastValidatedAt = new Date(this.nowMs()).toISOString();
    }
  }
}

let singleton: FxcmAuthenticationService | null = null;

export function getFxcmAuthenticationService(): FxcmAuthenticationService {
  singleton ??= new FxcmAuthenticationService();
  return singleton;
}

export function createFxcmAuthenticationService(options?: FxcmAuthServiceOptions): FxcmAuthenticationService {
  return new FxcmAuthenticationService(options);
}

export function resetFxcmAuthenticationServiceForTests(): void {
  singleton = null;
}

/** Ensure serialized status never contains secret-like fields. */
export function assertSafeAuthStatus(status: SafeFxcmAuthenticationStatus, token: string | null): void {
  const json = JSON.stringify(status);
  if (token && token.length >= 8 && json.includes(token)) {
    throw new FxcmMarketDataError("FXCM_UNSUPPORTED_OPERATION", "Refusing to expose FXCM credentials.");
  }
  if (/Bearer\s+[A-Za-z0-9_-]{8,}/i.test(json)) {
    throw new FxcmMarketDataError("FXCM_UNSUPPORTED_OPERATION", "Refusing to expose authorization material.");
  }
  if (/"authorizationHeader"\s*:/i.test(json) || /"accessToken"\s*:/i.test(json) || /"password"\s*:/i.test(json)) {
    throw new FxcmMarketDataError("FXCM_UNSUPPORTED_OPERATION", "Refusing to expose credential fields.");
  }
}
