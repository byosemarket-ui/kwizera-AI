/**
 * Phase 38F — monitor limits with KWIZERA_FOREX_MONITOR_* env overrides.
 */

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export interface ForexMonitorLimits {
  MAX_SESSIONS: number;
  POLL_INTERVAL_MS: number;
  MAX_EVENTS_PER_SESSION: number;
  CANDLE_LIMIT: number;
  MAX_NARRATIVE_QUEUE: number;
  MAX_NARRATIVE_CONCURRENCY: number;
  NARRATIVE_TIMEOUT_MS: number;
  FAILURE_BACKOFF_MS: number;
  FAILURE_BACKOFF_MAX_MS: number;
  MIN_EVAL_GAP_MS: number;
  MAX_STOPPED_SESSIONS: number;
}

export const DEFAULT_FOREX_MONITOR_LIMITS: ForexMonitorLimits = {
  MAX_SESSIONS: 5,
  POLL_INTERVAL_MS: 30_000,
  MAX_EVENTS_PER_SESSION: 100,
  CANDLE_LIMIT: 300,
  MAX_NARRATIVE_QUEUE: 3,
  MAX_NARRATIVE_CONCURRENCY: 1,
  NARRATIVE_TIMEOUT_MS: 45_000,
  FAILURE_BACKOFF_MS: 15_000,
  FAILURE_BACKOFF_MAX_MS: 5 * 60_000,
  MIN_EVAL_GAP_MS: 10_000,
  MAX_STOPPED_SESSIONS: 50,
};

export function resolveForexMonitorLimits(
  overrides?: Partial<ForexMonitorLimits>,
): ForexMonitorLimits {
  const base = { ...DEFAULT_FOREX_MONITOR_LIMITS, ...overrides };
  return {
    MAX_SESSIONS: envInt("KWIZERA_FOREX_MONITOR_MAX_SESSIONS", base.MAX_SESSIONS),
    POLL_INTERVAL_MS: envInt("KWIZERA_FOREX_MONITOR_POLL_INTERVAL_MS", base.POLL_INTERVAL_MS),
    MAX_EVENTS_PER_SESSION: envInt(
      "KWIZERA_FOREX_MONITOR_MAX_EVENTS",
      base.MAX_EVENTS_PER_SESSION,
    ),
    CANDLE_LIMIT: envInt("KWIZERA_FOREX_MONITOR_CANDLE_LIMIT", base.CANDLE_LIMIT),
    MAX_NARRATIVE_QUEUE: envInt(
      "KWIZERA_FOREX_MONITOR_MAX_NARRATIVE_QUEUE",
      base.MAX_NARRATIVE_QUEUE,
    ),
    MAX_NARRATIVE_CONCURRENCY: envInt(
      "KWIZERA_FOREX_MONITOR_MAX_NARRATIVE_CONCURRENCY",
      base.MAX_NARRATIVE_CONCURRENCY,
    ),
    NARRATIVE_TIMEOUT_MS: envInt(
      "KWIZERA_FOREX_MONITOR_NARRATIVE_TIMEOUT_MS",
      base.NARRATIVE_TIMEOUT_MS,
    ),
    FAILURE_BACKOFF_MS: envInt(
      "KWIZERA_FOREX_MONITOR_FAILURE_BACKOFF_MS",
      base.FAILURE_BACKOFF_MS,
    ),
    FAILURE_BACKOFF_MAX_MS: envInt(
      "KWIZERA_FOREX_MONITOR_FAILURE_BACKOFF_MAX_MS",
      base.FAILURE_BACKOFF_MAX_MS,
    ),
    MIN_EVAL_GAP_MS: envInt("KWIZERA_FOREX_MONITOR_MIN_EVAL_GAP_MS", base.MIN_EVAL_GAP_MS),
    MAX_STOPPED_SESSIONS: envInt(
      "KWIZERA_FOREX_MONITOR_MAX_STOPPED",
      base.MAX_STOPPED_SESSIONS,
    ),
  };
}
