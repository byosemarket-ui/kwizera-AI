/**
 * STEP 2B — HFM subscription, freshness, and recovery contracts (Demo read-only).
 * Provider-isolated: HFM_MT5 / demo only.
 */

export const HFM_SUB_PROVIDER = "HFM_MT5" as const;
export const HFM_SUB_ENVIRONMENT = "demo" as const;

export const HFM_SUBSCRIPTION_STATUSES = [
  "PENDING",
  "ACTIVE",
  "PAUSED",
  "UNSUBSCRIBING",
  "UNSUBSCRIBED",
  "FAILED",
  "RECOVERING",
] as const;
export type HfmSubscriptionStatus = (typeof HFM_SUBSCRIPTION_STATUSES)[number];

export const HFM_SUBSCRIPTION_PRIORITIES = ["CRITICAL", "HIGH", "NORMAL", "LOW"] as const;
export type HfmSubscriptionPriority = (typeof HFM_SUBSCRIPTION_PRIORITIES)[number];

export const HFM_PRIORITY_WEIGHT: Record<HfmSubscriptionPriority, number> = {
  CRITICAL: 1000,
  HIGH: 750,
  NORMAL: 500,
  LOW: 250,
};

/** Allowed lifecycle transitions (deterministic). */
export const HFM_SUBSCRIPTION_TRANSITIONS: Record<HfmSubscriptionStatus, readonly HfmSubscriptionStatus[]> = {
  PENDING: ["ACTIVE", "FAILED", "UNSUBSCRIBED"],
  ACTIVE: ["PAUSED", "UNSUBSCRIBING", "FAILED", "RECOVERING"],
  PAUSED: ["ACTIVE", "UNSUBSCRIBING", "FAILED"],
  UNSUBSCRIBING: ["UNSUBSCRIBED", "FAILED"],
  UNSUBSCRIBED: ["PENDING", "ACTIVE"],
  FAILED: ["PENDING", "RECOVERING", "UNSUBSCRIBED", "ACTIVE"],
  RECOVERING: ["ACTIVE", "FAILED", "PAUSED", "UNSUBSCRIBING"],
};

export interface HfmSubscriptionConfig {
  /** Soft hint for acquisition interval override (ms). Null = scheduler default. */
  acquisitionIntervalMs: number | null;
  /** Category-derived freshness threshold override (ms). */
  freshnessThresholdMs: number | null;
  /** Whether this manager may attempt SymbolSelect for the symbol. */
  allowEngineSelect: boolean;
}

export interface HfmSubscriptionRecord {
  subscriptionId: string;
  provider: typeof HFM_SUB_PROVIDER;
  environment: typeof HFM_SUB_ENVIRONMENT;
  symbol: string;
  status: HfmSubscriptionStatus;
  priority: HfmSubscriptionPriority;
  priorityWeight: number;
  requestedBy: string;
  createdAt: string;
  updatedAt: string;
  lastAcquiredAt: string | null;
  lastValidQuoteAt: string | null;
  lastError: string | null;
  subscriptionConfig: HfmSubscriptionConfig;
  /** True when this engine requested SymbolSelect for the symbol. */
  engineSelected: boolean;
  previousStatus: HfmSubscriptionStatus | null;
  statusReason: string | null;
  delayedForCapacity: boolean;
}

export const HFM_SYMBOL_FRESHNESS_STATUSES = [
  "FRESH",
  "AGING",
  "STALE",
  "NO_QUOTE",
  "MARKET_CLOSED",
  "TERMINAL_DISCONNECTED",
  "TRANSPORT_UNAVAILABLE",
  "INVALID",
] as const;
export type HfmSymbolFreshnessStatus = (typeof HFM_SYMBOL_FRESHNESS_STATUSES)[number];

export interface HfmSymbolFreshnessState {
  provider: typeof HFM_SUB_PROVIDER;
  environment: typeof HFM_SUB_ENVIRONMENT;
  symbol: string;
  lastTickTimestamp: number | null;
  lastReceivedAt: string | null;
  lastValidQuoteAt: string | null;
  lastAcquisitionAttemptAt: string | null;
  lastAcquisitionSuccessAt: string | null;
  quoteAgeMs: number | null;
  lastKnownGoodAgeMs: number | null;
  freshnessThresholdMs: number;
  freshnessStatus: HfmSymbolFreshnessStatus;
  freshnessReason: string | null;
  previousFreshnessStatus: HfmSymbolFreshnessStatus | null;
  changedAt: string | null;
  category: string | null;
}

export const HFM_RECOVERY_STATUSES = [
  "HEALTHY",
  "DEGRADED",
  "RECOVERING",
  "RECOVERED",
  "FAILED",
] as const;
export type HfmRecoveryStatus = (typeof HFM_RECOVERY_STATUSES)[number];

export interface HfmRecoveryState {
  provider: typeof HFM_SUB_PROVIDER;
  environment: typeof HFM_SUB_ENVIRONMENT;
  status: HfmRecoveryStatus;
  attemptCount: number;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  reason: string | null;
  nextRetryAt: string | null;
  stage: string | null;
  lastError: string | null;
  maxRetries: number;
  minRetryMs: number;
  maxRetryMs: number;
}

export interface HfmSnapshotBatchTracker {
  snapshotId: string | null;
  batchId: string | null;
  sequence: number | null;
  expectedBatchCount: number | null;
  receivedBatchCount: number;
  snapshotStartedAt: string | null;
  snapshotCompletedAt: string | null;
  isComplete: boolean;
  missingSymbols: string[];
  duplicateSequences: number[];
  outOfOrder: boolean;
  lastGap: number | null;
}

export interface HfmSubscriptionCapacity {
  maxActive: number;
  maxBatch: number;
  maxPendingOps: number;
  maxRetrying: number;
  maxDiagnosticHistory: number;
  active: number;
  paused: number;
  pending: number;
  failed: number;
  recovering: number;
  utilization: number;
}

export interface HfmSchedulerStatus {
  provider: typeof HFM_SUB_PROVIDER;
  environment: typeof HFM_SUB_ENVIRONMENT;
  acquisitionIntervalMs: number;
  batchSize: number;
  lastCycleAt: string | null;
  lastCycleDurationMs: number | null;
  lastSymbolsScheduled: string[];
  overlappingPrevented: number;
  missedCycles: number;
  roundRobinCursor: number;
}

/** Category-aware freshness thresholds (ms). */
export const HFM_CATEGORY_FRESHNESS_MS: Record<string, { fresh: number; aging: number; stale: number }> = {
  FOREX: { fresh: 15_000, aging: 45_000, stale: 180_000 },
  METALS: { fresh: 20_000, aging: 60_000, stale: 240_000 },
  ENERGY: { fresh: 20_000, aging: 60_000, stale: 240_000 },
  INDICES: { fresh: 20_000, aging: 60_000, stale: 300_000 },
  SHARES: { fresh: 30_000, aging: 90_000, stale: 600_000 },
  CRYPTO: { fresh: 15_000, aging: 45_000, stale: 180_000 },
  OTHER: { fresh: 30_000, aging: 90_000, stale: 300_000 },
};

export const HFM_SUBSCRIPTION_DEFAULTS = {
  maxActive: 32,
  /** Preserve existing nine-symbol default activation. */
  defaultActiveCap: 9,
  maxBatch: 9,
  maxPendingOps: 64,
  maxRetrying: 16,
  maxDiagnosticHistory: 100,
  acquisitionIntervalMs: 3000,
  monitorIntervalMs: 5000,
  recoveryMinRetryMs: 2000,
  recoveryMaxRetryMs: 60_000,
  recoveryMaxRetries: 12,
} as const;
