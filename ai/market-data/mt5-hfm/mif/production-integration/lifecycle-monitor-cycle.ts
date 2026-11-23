/**
 * Phase 04 — one HFM MT5 opportunity lifecycle monitoring cycle.
 * Deterministic observation only: no OD re-run, no OpenAI, no broker orders.
 * Provider locked to HFM_MT5. FORMING candles never confirm.
 */
import { adaptHfmHistoricalBars } from "../adapters/historical-adapter.js";
import type { MifCanonicalCandle } from "../canonical/candle.js";
import { observeCandidateAgainstCandles } from "./lifecycle-observe.js";
import {
  HFM_LIFECYCLE_PROVIDER_ID,
  HFM_LIFECYCLE_TRANSITION_RULE_VERSION,
  isMonitorableLifecycleState,
  toSemanticLifecycleStage,
} from "./lifecycle-semantics.js";
import { getMifOpportunityStorage } from "./persistence/storage.js";
import type { MifPersistedCandidate } from "./persistence/types.js";

export type HfmLifecycleMonitorEvidenceHealth =
  | "FRESH"
  | "STALE"
  | "MISSING"
  | "INVALID_TIMESTAMP"
  | "SYMBOL_MISMATCH"
  | "PROVIDER_MISMATCH"
  | "INCOMPLETE_SNAPSHOT"
  | "FORMING_ONLY";

export interface HfmLifecycleMonitorCycleInput {
  providerSymbol: string;
  /** Primary observation timeframe (default H1). */
  timeframe?: string;
  candleLimit?: number;
  /** Max candidates processed per cycle (bounded). */
  batchLimit?: number;
  maxAgeBars?: number;
  /** Injected candle fetch for unit tests. */
  fetchCandles?: (opts: {
    symbol: string;
    timeframe: string;
    limit: number;
  }) => Promise<{
    provider?: string;
    available: boolean;
    bars: Array<Record<string, unknown>>;
    freshness?: string | null;
    newestTimestamp?: number | null;
    errors: string[];
    timeframe?: string;
  }>;
  /** Wall clock override for freshness age checks. */
  nowMs?: number;
  /** Max age of newest closed bar before evidence is STALE (ms). Default 6h. */
  maxBarAgeMs?: number;
  correlationId?: string | null;
}

export interface HfmLifecycleMonitorCandidateResult {
  candidateId: string;
  providerSymbol: string;
  fromState: string;
  toState: string | null;
  semanticStage: string;
  evidenceHealth: HfmLifecycleMonitorEvidenceHealth;
  transitioned: boolean;
  duplicate: boolean;
  resultKind: string | null;
  error: string | null;
  candleTimeframe: string | null;
  candleStatusUsed: "CLOSED" | "FORMING" | "MIXED" | "NONE" | null;
}

export interface HfmLifecycleMonitorCycleResult {
  ok: boolean;
  providerId: typeof HFM_LIFECYCLE_PROVIDER_ID;
  providerSymbol: string;
  timeframe: string;
  startedAt: string;
  completedAt: string;
  ruleVersion: typeof HFM_LIFECYCLE_TRANSITION_RULE_VERSION;
  candidatesConsidered: number;
  candidatesObserved: number;
  transitionsApplied: number;
  skipped: number;
  evidenceHealth: HfmLifecycleMonitorEvidenceHealth;
  closedCandleCount: number;
  formingCandleCount: number;
  newestClosedOpenTimeSec: number | null;
  diagnostics: string[];
  results: HfmLifecycleMonitorCandidateResult[];
  placesOrders: false;
  mutatesBroker: false;
  acceptsForExecution: false;
  callsOpenAi: false;
  runsOpportunityDetection: false;
}

function classifyBarFreshness(input: {
  newestOpenTimeSec: number | null;
  nowMs: number;
  maxBarAgeMs: number;
  available: boolean;
  providerOk: boolean;
}): HfmLifecycleMonitorEvidenceHealth {
  if (!input.providerOk) return "PROVIDER_MISMATCH";
  if (!input.available || input.newestOpenTimeSec == null) return "MISSING";
  if (!Number.isFinite(input.newestOpenTimeSec) || input.newestOpenTimeSec <= 0) {
    return "INVALID_TIMESTAMP";
  }
  const ageMs = input.nowMs - input.newestOpenTimeSec * 1000;
  if (!Number.isFinite(ageMs)) return "INVALID_TIMESTAMP";
  // Broker/server clock skew: bars slightly "in the future" are still usable.
  // Only reject absurd forward skew (> 24h), which indicates corrupt timestamps.
  const MAX_FORWARD_SKEW_MS = 24 * 60 * 60 * 1000;
  if (ageMs < -MAX_FORWARD_SKEW_MS) return "INVALID_TIMESTAMP";
  if (ageMs > input.maxBarAgeMs) return "STALE";
  return "FRESH";
}

async function defaultFetchCandles(opts: {
  symbol: string;
  timeframe: string;
  limit: number;
}): Promise<{
  provider?: string;
  available: boolean;
  bars: Array<Record<string, unknown>>;
  freshness?: string | null;
  newestTimestamp?: number | null;
  errors: string[];
  timeframe?: string;
}> {
  const { fetchHfmHistoricalCandles } = await import("../../historical-engine.js");
  const hist = await fetchHfmHistoricalCandles({
    symbol: opts.symbol,
    timeframe: opts.timeframe,
    limit: opts.limit,
    refresh: false,
  });
  return {
    provider: hist.provider,
    available: hist.available,
    bars: hist.bars as unknown as Array<Record<string, unknown>>,
    freshness: hist.freshness,
    newestTimestamp: hist.newestTimestamp,
    errors: hist.errors,
    timeframe: hist.timeframe || opts.timeframe,
  };
}

/**
 * Run a single monitoring cycle for active HFM MT5 opportunities.
 */
export async function runHfmLifecycleMonitorCycle(
  input: HfmLifecycleMonitorCycleInput,
): Promise<HfmLifecycleMonitorCycleResult> {
  const startedAt = new Date().toISOString();
  const symbol = String(input.providerSymbol || "").trim().toUpperCase();
  const timeframe = String(input.timeframe || "H1").trim().toUpperCase();
  const candleLimit = Math.min(500, Math.max(10, input.candleLimit ?? 120));
  const batchLimit = Math.min(50, Math.max(1, input.batchLimit ?? 20));
  const nowMs = input.nowMs ?? Date.now();
  const maxBarAgeMs = input.maxBarAgeMs ?? 6 * 60 * 60 * 1000;
  const correlationId =
    input.correlationId ?? `life-mon-${symbol}-${timeframe}-${nowMs}`;
  const diagnostics: string[] = [];
  const empty = (
    evidenceHealth: HfmLifecycleMonitorEvidenceHealth,
    extra: Partial<HfmLifecycleMonitorCycleResult> = {},
  ): HfmLifecycleMonitorCycleResult => ({
    ok: evidenceHealth === "FRESH" || evidenceHealth === "STALE",
    providerId: HFM_LIFECYCLE_PROVIDER_ID,
    providerSymbol: symbol,
    timeframe,
    startedAt,
    completedAt: new Date().toISOString(),
    ruleVersion: HFM_LIFECYCLE_TRANSITION_RULE_VERSION,
    candidatesConsidered: 0,
    candidatesObserved: 0,
    transitionsApplied: 0,
    skipped: 0,
    evidenceHealth,
    closedCandleCount: 0,
    formingCandleCount: 0,
    newestClosedOpenTimeSec: null,
    diagnostics,
    results: [],
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    callsOpenAi: false,
    runsOpportunityDetection: false,
    ...extra,
  });

  if (!symbol) {
    diagnostics.push("missing_provider_symbol");
    return empty("MISSING");
  }

  const fetchFn = input.fetchCandles ?? defaultFetchCandles;
  let hist: Awaited<ReturnType<typeof defaultFetchCandles>>;
  try {
    hist = await fetchFn({ symbol, timeframe, limit: candleLimit });
  } catch (err) {
    diagnostics.push(err instanceof Error ? err.message : String(err));
    return empty("MISSING");
  }

  const provider = String(hist.provider || "").trim().toUpperCase();
  if (provider && provider !== HFM_LIFECYCLE_PROVIDER_ID) {
    diagnostics.push(`provider_mismatch:${provider}`);
    return empty("PROVIDER_MISMATCH");
  }
  // Historical engine always HFM when available; empty provider treated as HFM path only.
  if (!hist.available || !hist.bars?.length) {
    diagnostics.push(...(hist.errors || []), "no_bars");
    return empty("MISSING");
  }

  const adapted = adaptHfmHistoricalBars(
    hist.bars as never,
    { symbol, timeframe: hist.timeframe || timeframe },
  );
  const closedCandles: MifCanonicalCandle[] = adapted.candles.filter(
    (c) => c.candleState === "CLOSED" && c.providerSymbol === symbol,
  );
  const formingCandleCount = adapted.candles.filter((c) => c.candleState === "FORMING").length;
  if (adapted.candles.some((c) => c.providerSymbol !== symbol)) {
    diagnostics.push("symbol_mismatch_in_adapted_candles");
    return empty("SYMBOL_MISMATCH", {
      closedCandleCount: closedCandles.length,
      formingCandleCount,
    });
  }
  if (!closedCandles.length) {
    diagnostics.push(
      formingCandleCount > 0
        ? "forming_only_no_closed_confirmation"
        : "no_closed_candles",
    );
    return empty(formingCandleCount > 0 ? "FORMING_ONLY" : "MISSING", {
      closedCandleCount: 0,
      formingCandleCount,
    });
  }

  const newestClosedOpenTimeSec = closedCandles.reduce(
    (m, c) => Math.max(m, c.openTimeSec),
    0,
  );
  const evidenceHealth = classifyBarFreshness({
    newestOpenTimeSec: newestClosedOpenTimeSec,
    nowMs,
    maxBarAgeMs,
    available: true,
    providerOk: true,
  });
  if (evidenceHealth === "STALE") {
    diagnostics.push("newest_closed_bar_stale_skip_confirmation");
  }
  if (evidenceHealth === "INVALID_TIMESTAMP") {
    diagnostics.push("invalid_bar_timestamp");
    return empty("INVALID_TIMESTAMP", {
      closedCandleCount: closedCandles.length,
      formingCandleCount,
      newestClosedOpenTimeSec,
    });
  }

  const store = getMifOpportunityStorage();
  const listed = await store.listMonitorableCandidates({
    providerSymbol: symbol,
    limit: batchLimit,
  });
  const candidates = listed.items.filter(
    (c) =>
      c.providerId === HFM_LIFECYCLE_PROVIDER_ID
      && c.providerSymbol === symbol
      && isMonitorableLifecycleState(c.lifecycleState),
  );

  const results: HfmLifecycleMonitorCandidateResult[] = [];
  let transitionsApplied = 0;
  let candidatesObserved = 0;
  let skipped = 0;

  for (const candidate of candidates) {
    const baseResult = (
      partial: Partial<HfmLifecycleMonitorCandidateResult>,
    ): HfmLifecycleMonitorCandidateResult => ({
      candidateId: candidate.candidateId,
      providerSymbol: candidate.providerSymbol,
      fromState: candidate.lifecycleState,
      toState: candidate.lifecycleState,
      semanticStage: toSemanticLifecycleStage(
        candidate.lifecycleState,
        candidate.outcomeKind,
      ),
      evidenceHealth,
      transitioned: false,
      duplicate: false,
      resultKind: null,
      error: null,
      candleTimeframe: timeframe,
      candleStatusUsed: "CLOSED",
      ...partial,
    });

    // Stale evidence must never trigger confirmation (NEEDS_CONFIRMATION → CONFIRMED).
    // Decisive invalidation/expiry still allowed for other monitorable states when stale.

    if (evidenceHealth === "STALE" && candidate.lifecycleState === "NEEDS_CONFIRMATION") {
      skipped += 1;
      results.push(
        baseResult({
          error: "stale_evidence_blocks_confirmation",
          evidenceHealth: "STALE",
        }),
      );
      continue;
    }

    candidatesObserved += 1;
    const fromState = candidate.lifecycleState;
    try {
      const obs = await observeCandidateAgainstCandles({
        candidateId: candidate.candidateId,
        closedCandles,
        maxAgeBars: input.maxAgeBars,
        correlationId,
        persistEvaluation: true,
      });
      const updated = obs.lifecycleState ?? fromState;
      const transitioned = updated !== fromState;
      if (transitioned) transitionsApplied += 1;
      const refreshed: MifPersistedCandidate | null =
        (await store.getCandidate(candidate.candidateId)) ?? candidate;
      results.push(
        baseResult({
          toState: updated,
          semanticStage: toSemanticLifecycleStage(
            refreshed.lifecycleState,
            refreshed.outcomeKind,
          ),
          transitioned,
          duplicate: !transitioned && obs.ok,
          resultKind: obs.evaluation?.resultKind ?? null,
          error: obs.error ?? null,
          candleStatusUsed: "CLOSED",
        }),
      );
    } catch (err) {
      skipped += 1;
      results.push(
        baseResult({
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }

  return {
    ok: true,
    providerId: HFM_LIFECYCLE_PROVIDER_ID,
    providerSymbol: symbol,
    timeframe,
    startedAt,
    completedAt: new Date().toISOString(),
    ruleVersion: HFM_LIFECYCLE_TRANSITION_RULE_VERSION,
    candidatesConsidered: candidates.length,
    candidatesObserved,
    transitionsApplied,
    skipped,
    evidenceHealth,
    closedCandleCount: closedCandles.length,
    formingCandleCount,
    newestClosedOpenTimeSec,
    diagnostics,
    results,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    callsOpenAi: false,
    runsOpportunityDetection: false,
  };
}
