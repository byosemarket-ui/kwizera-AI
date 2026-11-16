/**
 * STEP 2B — HFM recovery engine with bounded exponential backoff + jitter.
 * Connection alone is not recovery — requires valid quote or documented condition.
 */
import {
  HFM_SUB_ENVIRONMENT,
  HFM_SUB_PROVIDER,
  HFM_SUBSCRIPTION_DEFAULTS,
  type HfmRecoveryState,
  type HfmRecoveryStatus,
} from "./subscription-types.js";

export type HfmRecoveryEventType =
  | "recovery.started"
  | "recovery.progress"
  | "recovery.completed"
  | "recovery.failed";

export interface HfmRecoveryEvent {
  type: HfmRecoveryEventType;
  provider: typeof HFM_SUB_PROVIDER;
  environment: typeof HFM_SUB_ENVIRONMENT;
  previousStatus: HfmRecoveryStatus | null;
  newStatus: HfmRecoveryStatus;
  reason: string | null;
  stage: string | null;
  attemptCount: number;
  nextRetryAt: string | null;
  timestamp: string;
}

export type HfmRecoveryErrorClass = "temporary" | "permanent" | "auth" | "capacity";

const PERMANENT_CODES = new Set([
  "PROVIDER_MISMATCH",
  "ENVIRONMENT_MISMATCH",
  "SYMBOL_NOT_IN_CATALOG",
  "SYMBOL_LIFECYCLE_BLOCKED",
  "INVALID_PASSWORD",
  "LIVE_LOCKED",
]);

export function classifyRecoveryError(code: string | null | undefined): HfmRecoveryErrorClass {
  const c = String(code ?? "").toUpperCase();
  if (!c) return "temporary";
  if (PERMANENT_CODES.has(c)) return "permanent";
  if (c.includes("HMAC") || c.includes("AUTH") || c.includes("TOKEN")) return "auth";
  if (c.includes("LIMIT") || c.includes("CAPACITY")) return "capacity";
  return "temporary";
}

export function computeBackoffMs(
  attempt: number,
  minMs: number,
  maxMs: number,
  jitterRatio = 0.2,
): number {
  const exp = Math.min(maxMs, minMs * 2 ** Math.max(0, attempt - 1));
  const jitter = exp * jitterRatio * Math.random();
  return Math.min(maxMs, Math.floor(exp + jitter));
}

type Listener = (ev: HfmRecoveryEvent) => void;

export class HfmRecoveryEngine {
  private state: HfmRecoveryState;
  private readonly listeners = new Set<Listener>();
  private readonly history: HfmRecoveryEvent[] = [];
  private readonly maxHistory: number;

  constructor(opts?: {
    maxRetries?: number;
    minRetryMs?: number;
    maxRetryMs?: number;
    maxHistory?: number;
  }) {
    this.maxHistory = opts?.maxHistory ?? HFM_SUBSCRIPTION_DEFAULTS.maxDiagnosticHistory;
    this.state = {
      provider: HFM_SUB_PROVIDER,
      environment: HFM_SUB_ENVIRONMENT,
      status: "HEALTHY",
      attemptCount: 0,
      lastAttemptAt: null,
      lastSuccessAt: null,
      reason: null,
      nextRetryAt: null,
      stage: null,
      lastError: null,
      maxRetries: opts?.maxRetries ?? HFM_SUBSCRIPTION_DEFAULTS.recoveryMaxRetries,
      minRetryMs: opts?.minRetryMs ?? HFM_SUBSCRIPTION_DEFAULTS.recoveryMinRetryMs,
      maxRetryMs: opts?.maxRetryMs ?? HFM_SUBSCRIPTION_DEFAULTS.recoveryMaxRetryMs,
    };
  }

  onEvent(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(type: HfmRecoveryEventType, previous: HfmRecoveryStatus | null, reason: string | null): void {
    const ev: HfmRecoveryEvent = {
      type,
      provider: HFM_SUB_PROVIDER,
      environment: HFM_SUB_ENVIRONMENT,
      previousStatus: previous,
      newStatus: this.state.status,
      reason,
      stage: this.state.stage,
      attemptCount: this.state.attemptCount,
      nextRetryAt: this.state.nextRetryAt,
      timestamp: new Date().toISOString(),
    };
    this.history.push(ev);
    while (this.history.length > this.maxHistory) this.history.shift();
    for (const l of this.listeners) {
      try {
        l(ev);
      } catch {
        /* isolate */
      }
    }
  }

  getState(): HfmRecoveryState {
    return { ...this.state };
  }

  getHistory(): HfmRecoveryEvent[] {
    return [...this.history];
  }

  /**
   * Begin or continue recovery. Returns whether a retry should run now.
   */
  begin(reason: string, stage = "detect"): { shouldAttempt: boolean; state: HfmRecoveryState } {
    const now = Date.now();
    if (this.state.nextRetryAt) {
      const next = Date.parse(this.state.nextRetryAt);
      if (Number.isFinite(next) && now < next) {
        return { shouldAttempt: false, state: this.getState() };
      }
    }
    const previous = this.state.status;
    if (this.state.status === "HEALTHY" || this.state.status === "RECOVERED" || this.state.status === "DEGRADED") {
      this.state.status = "RECOVERING";
      this.state.attemptCount = 0;
      this.emit("recovery.started", previous, reason);
    } else if (this.state.status === "FAILED") {
      this.state.status = "RECOVERING";
      this.emit("recovery.started", previous, reason);
    }
    this.state.reason = reason;
    this.state.stage = stage;
    this.state.lastAttemptAt = new Date(now).toISOString();
    this.state.attemptCount += 1;
    this.emit("recovery.progress", previous, reason);
    return { shouldAttempt: true, state: this.getState() };
  }

  markDegraded(reason: string): void {
    const previous = this.state.status;
    if (this.state.status === "HEALTHY" || this.state.status === "RECOVERED") {
      this.state.status = "DEGRADED";
      this.state.reason = reason;
      this.emit("recovery.progress", previous, reason);
    }
  }

  /**
   * Record attempt outcome. `validQuoteObserved` is required for full recovery.
   */
  completeAttempt(opts: {
    ok: boolean;
    errorCode?: string | null;
    stage?: string;
    validQuoteObserved?: boolean;
    transportOk?: boolean;
    terminalRunning?: boolean;
  }): HfmRecoveryState {
    const previous = this.state.status;
    if (opts.stage) this.state.stage = opts.stage;

    if (opts.ok && opts.validQuoteObserved) {
      this.state.status = "RECOVERED";
      this.state.lastSuccessAt = new Date().toISOString();
      this.state.lastError = null;
      this.state.nextRetryAt = null;
      this.state.reason = "VALID_QUOTE_RESTORED";
      this.emit("recovery.completed", previous, this.state.reason);
      // Settle to HEALTHY without another event flood.
      this.state.status = "HEALTHY";
      return this.getState();
    }

    if (opts.ok && opts.transportOk && opts.terminalRunning && !opts.validQuoteObserved) {
      // Connection alone is not recovery.
      this.state.status = "DEGRADED";
      this.state.reason = "CONNECTED_WITHOUT_VALID_QUOTE";
      this.state.lastError = this.state.reason;
      this.scheduleRetry();
      this.emit("recovery.progress", previous, this.state.reason);
      return this.getState();
    }

    const cls = classifyRecoveryError(opts.errorCode);
    this.state.lastError = String(opts.errorCode ?? "RECOVERY_FAILED").slice(0, 300);

    if (cls === "permanent" || this.state.attemptCount >= this.state.maxRetries) {
      this.state.status = "FAILED";
      this.state.nextRetryAt = null;
      this.state.reason = cls === "permanent" ? "PERMANENT_ERROR" : "RETRY_EXHAUSTED";
      this.emit("recovery.failed", previous, this.state.reason);
      return this.getState();
    }

    this.state.status = "RECOVERING";
    this.scheduleRetry();
    this.emit("recovery.progress", previous, this.state.lastError);
    return this.getState();
  }

  private scheduleRetry(): void {
    const delay = computeBackoffMs(
      this.state.attemptCount,
      this.state.minRetryMs,
      this.state.maxRetryMs,
    );
    this.state.nextRetryAt = new Date(Date.now() + delay).toISOString();
  }

  /** Metrics snapshot for observability. */
  metrics(): {
    status: HfmRecoveryStatus;
    attemptCount: number;
    successfulRecoveries: number;
    failedEvents: number;
    historySize: number;
    nextRetryAt: string | null;
  } {
    return {
      status: this.state.status,
      attemptCount: this.state.attemptCount,
      successfulRecoveries: this.history.filter((h) => h.type === "recovery.completed").length,
      failedEvents: this.history.filter((h) => h.type === "recovery.failed").length,
      historySize: this.history.length,
      nextRetryAt: this.state.nextRetryAt,
    };
  }
}

let singleton: HfmRecoveryEngine | null = null;

export function getHfmRecoveryEngine(): HfmRecoveryEngine {
  if (!singleton) singleton = new HfmRecoveryEngine();
  return singleton;
}

export function resetHfmRecoveryEngineForTests(): void {
  singleton = null;
}
