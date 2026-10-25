/**
 * Phase 59.0.3 — Precise quote-subscription readiness for Automated Trading / order execution.
 * CONNECTED alone is never READY. Fresh valid bid/ask evidence is required for execution readiness.
 * Never fabricates prices. Never enables trading.
 */
import {
  AT_QUOTE_FRESHNESS_CLOCK_SKEW_MS,
  MARKET_QUOTE_STALE_MS,
} from "./quote-freshness.js";
import { normalizeInstrumentForAllowlist } from "./simulation-risk/allowlist.js";

export const AT_QUOTE_SUBSCRIPTION_READINESS_PHASE = "59.0.3";

/** Diagnostic / execution codes (machine-readable). */
export type AtQuoteSubscriptionReadinessCode =
  | "SESSION_DISCONNECTED"
  | "INSTRUMENT_NOT_CONFIGURED"
  | "INSTRUMENT_NOT_PERMITTED"
  | "SUBSCRIPTION_NOT_INITIALIZED"
  | "SUBSCRIPTION_REQUESTED"
  | "SUBSCRIPTION_FAILED"
  | "QUOTE_NOT_RECEIVED"
  | "QUOTE_INVALID"
  | "QUOTE_STALE"
  | "QUOTE_READY"
  /** @deprecated alias — prefer QUOTE_READY */
  | "FRESH_VALID_QUOTE"
  /** @deprecated alias — prefer INSTRUMENT_NOT_CONFIGURED */
  | "SESSION_CONNECTED_INSTRUMENTS_NOT_CONFIGURED"
  /** @deprecated alias — prefer SUBSCRIPTION_NOT_INITIALIZED */
  | "SESSION_CONNECTED_NO_SUBSCRIPTION"
  /** @deprecated alias — prefer QUOTE_NOT_RECEIVED */
  | "SUBSCRIPTION_ACTIVE_WAITING_FOR_QUOTE";

export interface AtQuoteSubscriptionReadinessInput {
  sessionStatus: string | null | undefined;
  configuredInstrumentCount: number;
  intendedCount: number;
  subscriptionCount: number;
  offersListenerActive: boolean | null | undefined;
  streamState: string | null | undefined;
  /** Requested instrument for execution (optional for session-wide diagnostics). */
  requestedInstrument?: string | null | undefined;
  /** Instrument reported on the quote snapshot. */
  quoteInstrument?: string | null | undefined;
  lastQuoteAt: string | number | null | undefined;
  lastQuoteAgeMs: number | null | undefined;
  freshnessThresholdMs?: number;
  bid: number | null | undefined;
  ask: number | null | undefined;
  subscriptionError: string | null | undefined;
  instrumentPermissionError?: string | null | undefined;
  /** Injected clock for deterministic tests. */
  nowMs?: number;
  clockSkewMs?: number;
}

export interface AtQuoteSubscriptionReadinessResult {
  phase: typeof AT_QUOTE_SUBSCRIPTION_READINESS_PHASE;
  code: AtQuoteSubscriptionReadinessCode;
  readyForExecutionQuote: boolean;
  message: string;
  quoteAgeMs: number | null;
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
}

function finitePositive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

function instrumentsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizeInstrumentForAllowlist(a);
  const nb = normalizeInstrumentForAllowlist(b);
  if (!na || !nb) return false;
  return na === nb;
}

/**
 * Parse broker/offer timestamp into epoch ms. Returns null when unknown/invalid.
 */
export function parseQuoteTimestampMs(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return raw > 1e12 ? Math.floor(raw) : Math.floor(raw * 1000);
  }
  if (typeof raw === "string" && raw.trim()) {
    const trimmed = raw.trim();
    const asNum = Number(trimmed);
    if (Number.isFinite(asNum) && asNum > 0) {
      if (asNum > 1e12) return Math.floor(asNum);
      if (asNum > 1e9) return Math.floor(asNum * 1000);
    }
    const parsed = Date.parse(trimmed);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

/**
 * Evaluate bid/ask + timestamp evidence for a requested instrument.
 * Unknown age fails closed. CONNECTED alone never returns ready.
 */
export function evaluateExecutionQuoteEvidence(input: {
  requestedInstrument: string;
  quoteInstrument?: string | null;
  bid: number | null | undefined;
  ask: number | null | undefined;
  lastQuoteAt?: string | number | null;
  lastQuoteAgeMs?: number | null;
  nowMs?: number;
  freshnessThresholdMs?: number;
  clockSkewMs?: number;
}): {
  ok: boolean;
  code: AtQuoteSubscriptionReadinessCode;
  readyForExecutionQuote: boolean;
  message: string;
  quoteAgeMs: number | null;
} {
  const nowMs = input.nowMs ?? Date.now();
  const threshold = Math.max(
    0,
    Math.floor(input.freshnessThresholdMs ?? MARKET_QUOTE_STALE_MS),
  );
  const skew = Math.max(0, Math.floor(input.clockSkewMs ?? AT_QUOTE_FRESHNESS_CLOCK_SKEW_MS));
  const requested = String(input.requestedInstrument || "").trim();

  if (!requested) {
    return {
      ok: false,
      code: "INSTRUMENT_NOT_CONFIGURED",
      readyForExecutionQuote: false,
      message: "Requested instrument is missing.",
      quoteAgeMs: null,
    };
  }

  const quoteInst = input.quoteInstrument != null && String(input.quoteInstrument).trim()
    ? String(input.quoteInstrument).trim()
    : null;
  if (quoteInst && !instrumentsMatch(requested, quoteInst)) {
    return {
      ok: false,
      code: "QUOTE_INVALID",
      readyForExecutionQuote: false,
      message: `Quote instrument "${quoteInst}" does not match requested "${requested}".`,
      quoteAgeMs: null,
    };
  }

  const bid = input.bid;
  const ask = input.ask;
  if (!finitePositive(bid) || !finitePositive(ask)) {
    return {
      ok: false,
      code: "QUOTE_NOT_RECEIVED",
      readyForExecutionQuote: false,
      message: "Missing bid/ask — no usable quote evidence.",
      quoteAgeMs: null,
    };
  }
  if (!(ask >= bid)) {
    return {
      ok: false,
      code: "QUOTE_INVALID",
      readyForExecutionQuote: false,
      message: "Crossed or invalid bid/ask — rejected.",
      quoteAgeMs: null,
    };
  }

  let ageMs: number | null =
    typeof input.lastQuoteAgeMs === "number" && Number.isFinite(input.lastQuoteAgeMs)
      ? Math.max(0, Math.floor(input.lastQuoteAgeMs))
      : null;

  const tsMs = parseQuoteTimestampMs(input.lastQuoteAt);
  if (tsMs != null) {
    if (tsMs > nowMs + skew) {
      return {
        ok: false,
        code: "QUOTE_INVALID",
        readyForExecutionQuote: false,
        message: "Quote timestamp is in the future beyond clock-skew tolerance.",
        quoteAgeMs: tsMs - nowMs,
      };
    }
    const fromTs = Math.max(0, nowMs - tsMs);
    ageMs = ageMs == null ? fromTs : Math.max(ageMs, fromTs);
  }

  if (ageMs == null) {
    return {
      ok: false,
      code: "QUOTE_INVALID",
      readyForExecutionQuote: false,
      message: "Quote age unknown — refuse execution without broker timestamp evidence.",
      quoteAgeMs: null,
    };
  }

  if (ageMs > threshold) {
    return {
      ok: false,
      code: "QUOTE_STALE",
      readyForExecutionQuote: false,
      message: `Last quote age ${ageMs}ms exceeds freshness threshold ${threshold}ms.`,
      quoteAgeMs: ageMs,
    };
  }

  return {
    ok: true,
    code: "QUOTE_READY",
    readyForExecutionQuote: true,
    message: "Fresh valid bid/ask observed for readiness.",
    quoteAgeMs: ageMs,
  };
}

/**
 * Map stream/session diagnostics to an explicit readiness code.
 * readyForExecutionQuote is true only for QUOTE_READY (with real bid/ask + age).
 */
export function evaluateQuoteSubscriptionReadiness(
  input: AtQuoteSubscriptionReadinessInput,
): AtQuoteSubscriptionReadinessResult {
  const base = {
    phase: AT_QUOTE_SUBSCRIPTION_READINESS_PHASE,
    placesOrders: false as const,
    acceptsForExecution: false as const,
    mutatesBroker: false as const,
    quoteAgeMs: null as number | null,
  };

  const status = String(input.sessionStatus || "").toUpperCase();
  if (!status || status === "DISCONNECTED" || status === "DISABLED" || status === "ERROR") {
    return {
      ...base,
      code: "SESSION_DISCONNECTED",
      readyForExecutionQuote: false,
      message: "ForexConnect session is not CONNECTED.",
    };
  }

  if (input.instrumentPermissionError) {
    return {
      ...base,
      code: "INSTRUMENT_NOT_PERMITTED",
      readyForExecutionQuote: false,
      message: String(input.instrumentPermissionError).slice(0, 200),
    };
  }

  if (input.subscriptionError) {
    return {
      ...base,
      code: "SUBSCRIPTION_FAILED",
      readyForExecutionQuote: false,
      message: `Subscription failed: ${String(input.subscriptionError).slice(0, 160)}`,
    };
  }

  if (input.configuredInstrumentCount <= 0 && input.intendedCount <= 0) {
    return {
      ...base,
      code: "INSTRUMENT_NOT_CONFIGURED",
      readyForExecutionQuote: false,
      message:
        "Session may be connected, but no Automated Trading instrument is configured for Offers subscribe.",
    };
  }

  if (input.intendedCount <= 0 && input.subscriptionCount <= 0) {
    return {
      ...base,
      code: "SUBSCRIPTION_NOT_INITIALIZED",
      readyForExecutionQuote: false,
      message: "Connected but no intended/active Offers subscription — quote stream idle.",
    };
  }

  const stream = String(input.streamState || "").toUpperCase();
  if (stream === "AUTHENTICATED_IDLE" && input.subscriptionCount <= 0) {
    return {
      ...base,
      code: "SUBSCRIPTION_NOT_INITIALIZED",
      readyForExecutionQuote: false,
      message: "streamState=AUTHENTICATED_IDLE with zero subscriptions.",
    };
  }

  if (input.subscriptionCount > 0 && !input.offersListenerActive) {
    return {
      ...base,
      code: "SUBSCRIPTION_REQUESTED",
      readyForExecutionQuote: false,
      message: "Subscription present but Offers listener is not active yet.",
    };
  }

  const requested = String(input.requestedInstrument || "").trim();
  const hasQuotePrices = finitePositive(input.bid) && finitePositive(input.ask);
  const hasTimestamp = input.lastQuoteAt != null && String(input.lastQuoteAt).length > 0
    || (typeof input.lastQuoteAgeMs === "number" && Number.isFinite(input.lastQuoteAgeMs));

  // When a requested instrument is set, require coherent quote evidence (authoritative gate).
  if (requested) {
    const evidence = evaluateExecutionQuoteEvidence({
      requestedInstrument: requested,
      quoteInstrument: input.quoteInstrument,
      bid: input.bid,
      ask: input.ask,
      lastQuoteAt: input.lastQuoteAt,
      lastQuoteAgeMs: input.lastQuoteAgeMs,
      nowMs: input.nowMs,
      freshnessThresholdMs: input.freshnessThresholdMs,
      clockSkewMs: input.clockSkewMs,
    });
    return {
      ...base,
      code: evidence.code === "QUOTE_READY" ? "QUOTE_READY" : evidence.code,
      readyForExecutionQuote: evidence.readyForExecutionQuote,
      message: evidence.message,
      quoteAgeMs: evidence.quoteAgeMs,
    };
  }

  // Session-wide diagnostic without a specific instrument request.
  if (!hasQuotePrices && !hasTimestamp) {
    if (input.subscriptionCount > 0 || input.offersListenerActive) {
      return {
        ...base,
        code: "QUOTE_NOT_RECEIVED",
        readyForExecutionQuote: false,
        message: "Subscription active (or intended) but no bid/ask change received yet.",
      };
    }
    return {
      ...base,
      code: "SUBSCRIPTION_REQUESTED",
      readyForExecutionQuote: false,
      message: "Subscription requested; awaiting broker quote evidence.",
    };
  }

  if (hasQuotePrices && !(input.ask! >= input.bid!)) {
    return {
      ...base,
      code: "QUOTE_INVALID",
      readyForExecutionQuote: false,
      message: "Crossed or invalid bid/ask — rejected.",
    };
  }

  const evidence = evaluateExecutionQuoteEvidence({
    requestedInstrument: "SESSION",
    quoteInstrument: "SESSION",
    bid: input.bid,
    ask: input.ask,
    lastQuoteAt: input.lastQuoteAt,
    lastQuoteAgeMs: input.lastQuoteAgeMs,
    nowMs: input.nowMs,
    freshnessThresholdMs: input.freshnessThresholdMs,
    clockSkewMs: input.clockSkewMs,
  });
  return {
    ...base,
    code: evidence.code,
    readyForExecutionQuote: false, // session-wide never authorizes execution without requestedInstrument
    message: evidence.readyForExecutionQuote
      ? "Fresh quote observed at session level; specify requestedInstrument for execution readiness."
      : evidence.message,
    quoteAgeMs: evidence.quoteAgeMs,
  };
}
