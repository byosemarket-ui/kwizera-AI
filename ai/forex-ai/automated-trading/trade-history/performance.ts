/**
 * Phase 60.0.4 — Verified Trade Monitor performance analytics (pure).
 * Missing values are never treated as zero. Incomplete history is never labeled all-time.
 */
import { safeFiniteNumber } from "./safe-number.js";

export type MetricAvailability = "AVAILABLE" | "PARTIAL" | "UNAVAILABLE";
export type MetricScope =
  | "trade"
  | "instrument"
  | "account"
  | "selected_period"
  | "current_snapshot"
  | "mixed_scopes";
export type MetricSourceKind = "broker-reported" | "locally-calculated" | "mixed";

export interface MetricContractMeta {
  id: string;
  label: string;
  scope: MetricScope;
  source: string;
  sourceKind: MetricSourceKind;
  currency: string | null;
  freshness: string | null;
  availability: MetricAvailability;
  definition: string;
  coverageNote: string | null;
}

export interface MetricValue extends MetricContractMeta {
  value: number | null;
  unit: "currency" | "ratio" | "percent" | "count";
}

export interface ClosedTradeForAnalytics {
  recordKey?: string | null;
  tradeId?: string | null;
  accountIdMasked?: string | null;
  lifecycleStatus?: string | null;
  grossPl?: number | null;
  netPl?: number | null;
  commission?: number | null;
  rolloverInterest?: number | null;
  closeTime?: string | null;
  openTime?: string | null;
  currency?: string | null;
}

export interface OpenTradeForAnalytics {
  tradeId?: string | null;
  accountIdMasked?: string | null;
  floatingPl?: number | null;
  currency?: string | null;
}

export interface PerformancePeriodInput {
  fromUtc?: string | null;
  toUtc?: string | null;
  /** Earliest persisted observation — not broker account birth. */
  historyAvailableFromUtc?: string | null;
  accountCurrency?: string | null;
  /** Broker equity/NAV when used as % denominator (must already include floating if broker says so). */
  equity?: number | null;
  equityIncludesFloatingPl?: boolean;
  nowMs?: number;
}

export interface PerformanceSummary {
  schemaVersion: "60.0.4";
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
  period: {
    fromUtc: string | null;
    toUtc: string | null;
    label: string;
  };
  historyAvailableFromUtc: string | null;
  coverage: {
    availability: MetricAvailability;
    partial: boolean;
    note: string;
  };
  openTradeCount: MetricValue;
  activeOrderCount: MetricValue;
  floatingPl: MetricValue;
  realizedGrossPl: MetricValue;
  realizedNetPl: MetricValue;
  closedTradeCount: MetricValue;
  profitableCount: MetricValue;
  losingCount: MetricValue;
  zeroResultCount: MetricValue;
  winRate: MetricValue;
  plPercentOfEquity: MetricValue;
  /** Never combine floating + realized without explicit label — provided as optional labeled sum. */
  combinedLabeledPl: MetricValue;
  evaluatedAtUtc: string;
}

function finite(n: unknown): number | null {
  return safeFiniteNumber(n);
}

function parseMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

function metric(
  partial: Omit<MetricValue, "value" | "unit"> & { value: number | null; unit: MetricValue["unit"] },
): MetricValue {
  return partial;
}

/** Deduplicate by recordKey, else tradeId+account+closeTime. Keeps first occurrence. */
export function dedupeClosedTradesForAnalytics(
  rows: ReadonlyArray<ClosedTradeForAnalytics>,
): ClosedTradeForAnalytics[] {
  const seen = new Set<string>();
  const out: ClosedTradeForAnalytics[] = [];
  for (const row of rows) {
    const key =
      (row.recordKey && String(row.recordKey).trim())
      || [
        String(row.tradeId ?? "").trim(),
        String(row.accountIdMasked ?? "").trim(),
        String(row.closeTime ?? "").trim(),
      ].join("|");
    if (!key || key === "||") continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

export function filterClosedInPeriod(
  rows: ReadonlyArray<ClosedTradeForAnalytics>,
  fromUtc?: string | null,
  toUtc?: string | null,
): ClosedTradeForAnalytics[] {
  const fromMs = parseMs(fromUtc ?? null);
  const toMs = parseMs(toUtc ?? null);
  return rows.filter((r) => {
    if (String(r.lifecycleStatus ?? "CLOSED").toUpperCase() !== "CLOSED") return false;
    const t = parseMs(r.closeTime) ?? parseMs(r.openTime);
    if (t == null) return false; // invalid/missing timestamps excluded — never invent
    if (fromMs != null && t < fromMs) return false;
    if (toMs != null && t > toMs) return false;
    return true;
  });
}

/**
 * Floating P/L: sum of broker-reported open-trade floatingPl only.
 * Missing rows skipped (not zero). Mixed currencies → UNAVAILABLE.
 */
export function computeFloatingPl(
  openTrades: ReadonlyArray<OpenTradeForAnalytics>,
  currency: string | null,
): MetricValue {
  const base = {
    id: "floating_pl",
    label: "Floating P/L",
    scope: "current_snapshot" as const,
    source: "forexconnect-trades.gross_pl",
    sourceKind: "broker-reported" as const,
    currency,
    freshness: "current_open_trades_snapshot",
    definition:
      "Sum of broker-reported open-trade floating/gross P/L. Missing values excluded (not treated as 0).",
    coverageNote: null as string | null,
    unit: "currency" as const,
  };
  const currencies = new Set<string>();
  let sum = 0;
  let any = false;
  for (const t of openTrades) {
    const pl = finite(t.floatingPl);
    if (pl == null) continue;
    const ccy = t.currency ?? currency;
    if (ccy) currencies.add(String(ccy).toUpperCase());
    sum += pl;
    any = true;
  }
  if (currencies.size > 1) {
    return metric({
      ...base,
      availability: "UNAVAILABLE",
      coverageNote: "Mixed currencies across open trades — floating P/L not aggregated.",
      value: null,
    });
  }
  return metric({
    ...base,
    availability: any ? "AVAILABLE" : "UNAVAILABLE",
    value: any ? sum : null,
  });
}

export type RealizedPlBasis = "gross" | "net";

/**
 * Realized P/L over selected closed-trade set.
 * gross: sum grossPl when present.
 * net: prefer netPl; else gross+commission+rollover only when all three components exist.
 * Zero-P/L trades included in totals as 0 when PL field is explicitly 0.
 */
export function computeRealizedPl(
  closed: ReadonlyArray<ClosedTradeForAnalytics>,
  options: {
    currency: string | null;
    basis: RealizedPlBasis;
    historyAvailableFromUtc?: string | null;
    fromUtc?: string | null;
    partialCoverage: boolean;
  },
): MetricValue {
  const id = options.basis === "net" ? "realized_net_pl" : "realized_gross_pl";
  const base = {
    id,
    label: options.basis === "net" ? "Realized Net P/L" : "Realized Gross P/L",
    scope: "selected_period" as const,
    source:
      options.basis === "net"
        ? "persisted-closed netPl or gross+commission+rollover"
        : "persisted-closed grossPl",
    sourceKind: "locally-calculated" as const,
    currency: options.currency,
    freshness: "selected_period_closed_records",
    definition:
      options.basis === "net"
        ? "Sum of closed-trade net P/L when available; else gross+commission+rollover only when all components present. Open trades excluded."
        : "Sum of closed-trade gross P/L when present. Open trades excluded. Missing grossPl excluded (not 0).",
    coverageNote: options.partialCoverage
      ? "History coverage is partial — not an all-time account result."
      : null,
    unit: "currency" as const,
  };

  const currencies = new Set<string>();
  let sum = 0;
  let included = 0;
  let skippedMissing = 0;
  for (const row of closed) {
    const ccy = row.currency ?? options.currency;
    if (ccy) currencies.add(String(ccy).toUpperCase());
    if (options.basis === "gross") {
      const g = finite(row.grossPl);
      if (g == null) {
        skippedMissing += 1;
        continue;
      }
      sum += g;
      included += 1;
    } else {
      let n = finite(row.netPl);
      if (n == null) {
        const g = finite(row.grossPl);
        const c = finite(row.commission);
        const r = finite(row.rolloverInterest);
        if (g != null && c != null && r != null) n = g + c + r;
      }
      if (n == null) {
        skippedMissing += 1;
        continue;
      }
      sum += n;
      included += 1;
    }
  }

  if (currencies.size > 1) {
    return metric({
      ...base,
      availability: "UNAVAILABLE",
      coverageNote: "Mixed currencies — realized P/L not aggregated.",
      value: null,
    });
  }

  if (included === 0) {
    return metric({
      ...base,
      availability: "UNAVAILABLE",
      coverageNote:
        skippedMissing > 0
          ? `${skippedMissing} closed trade(s) lacked trustworthy P/L fields.`
          : "No closed trades with verified P/L in the selected period.",
      value: null,
    });
  }

  const availability: MetricAvailability =
    options.partialCoverage || skippedMissing > 0 ? "PARTIAL" : "AVAILABLE";

  return metric({
    ...base,
    availability,
    coverageNote:
      [
        options.partialCoverage ? "Partial history coverage." : null,
        skippedMissing > 0 ? `${skippedMissing} closed row(s) excluded for missing P/L.` : null,
        base.coverageNote,
      ]
        .filter(Boolean)
        .join(" ") || null,
    value: sum,
  });
}

/**
 * Win rate = profitable / (profitable + losing).
 * Zero-P/L trades are excluded from the denominator and reported separately.
 * Uses grossPl when present; else netPl. Incomplete history → PARTIAL.
 */
export function computeWinRate(
  closed: ReadonlyArray<ClosedTradeForAnalytics>,
  options: { partialCoverage: boolean; currency: string | null },
): {
  winRate: MetricValue;
  profitableCount: MetricValue;
  losingCount: MetricValue;
  zeroResultCount: MetricValue;
  closedTradeCount: MetricValue;
} {
  let wins = 0;
  let losses = 0;
  let zeros = 0;
  let withPl = 0;
  let closedCount = 0;

  for (const row of closed) {
    closedCount += 1;
    const pl = finite(row.grossPl) ?? finite(row.netPl);
    if (pl == null) continue;
    withPl += 1;
    if (pl > 0) wins += 1;
    else if (pl < 0) losses += 1;
    else zeros += 1;
  }

  const denom = wins + losses;
  const rate = denom > 0 ? wins / denom : null;
  const availability: MetricAvailability =
    rate == null
      ? "UNAVAILABLE"
      : options.partialCoverage || withPl < closedCount
        ? "PARTIAL"
        : "AVAILABLE";

  const countBase = {
    scope: "selected_period" as const,
    source: "persisted-closed grossPl|netPl",
    sourceKind: "locally-calculated" as const,
    currency: options.currency,
    freshness: "selected_period_closed_records",
    unit: "count" as const,
  };

  return {
    closedTradeCount: metric({
      ...countBase,
      id: "closed_trade_count",
      label: "Closed trades",
      definition: "Count of CLOSED records in the selected period (after dedupe).",
      availability: closedCount > 0 ? (options.partialCoverage ? "PARTIAL" : "AVAILABLE") : "UNAVAILABLE",
      coverageNote: options.partialCoverage ? "Partial history coverage." : null,
      value: closedCount > 0 ? closedCount : null,
    }),
    profitableCount: metric({
      ...countBase,
      id: "profitable_count",
      label: "Profitable",
      definition: "Closed trades with verified P/L > 0.",
      availability: withPl > 0 ? availability : "UNAVAILABLE",
      coverageNote: null,
      value: withPl > 0 ? wins : null,
    }),
    losingCount: metric({
      ...countBase,
      id: "losing_count",
      label: "Losing",
      definition: "Closed trades with verified P/L < 0.",
      availability: withPl > 0 ? availability : "UNAVAILABLE",
      coverageNote: null,
      value: withPl > 0 ? losses : null,
    }),
    zeroResultCount: metric({
      ...countBase,
      id: "zero_result_count",
      label: "Zero-result",
      definition: "Closed trades with verified P/L === 0 (excluded from win-rate denominator).",
      availability: withPl > 0 ? availability : "UNAVAILABLE",
      coverageNote: null,
      value: withPl > 0 ? zeros : null,
    }),
    winRate: metric({
      id: "win_rate",
      label: "Win rate",
      scope: "selected_period",
      source: "persisted-closed outcomes",
      sourceKind: "locally-calculated",
      currency: null,
      freshness: "selected_period_closed_records",
      definition:
        "wins / (wins + losses). Zero-P/L trades excluded from denominator. Unavailable when no win/loss outcomes.",
      availability,
      coverageNote: options.partialCoverage
        ? "Partial history — win rate is not an all-time account statistic."
        : zeros > 0
          ? `${zeros} zero-P/L trade(s) excluded from denominator.`
          : null,
      unit: "ratio",
      value: rate,
    }),
  };
}

/**
 * P/L % of equity = realizedGross / equity * 100.
 * Requires equity > 0, same currency, and a realized value. Never divides by zero/unknown.
 */
export function computePlPercentOfEquity(
  realizedGross: MetricValue,
  equity: number | null | undefined,
  currency: string | null,
  options: { equityIncludesFloatingPl: boolean; partialCoverage: boolean },
): MetricValue {
  const base = {
    id: "pl_percent_of_equity",
    label: "P/L % of equity",
    scope: "selected_period" as const,
    source: "realized_gross_pl / account.equity",
    sourceKind: "locally-calculated" as const,
    currency,
    freshness: "selected_period_vs_current_equity",
    definition:
      "Realized gross P/L for the selected period ÷ current broker equity × 100. Equity may already include floating P/L — floating is not added to the numerator.",
    unit: "percent" as const,
  };
  const eq = finite(equity);
  if (realizedGross.value == null || realizedGross.availability === "UNAVAILABLE") {
    return metric({
      ...base,
      availability: "UNAVAILABLE",
      coverageNote: "Realized P/L unavailable — percentage not computed.",
      value: null,
    });
  }
  if (eq == null || eq <= 0) {
    return metric({
      ...base,
      availability: "UNAVAILABLE",
      coverageNote: "Equity missing, zero, or non-positive — invalid denominator.",
      value: null,
    });
  }
  const availability: MetricAvailability =
    options.partialCoverage || realizedGross.availability === "PARTIAL" ? "PARTIAL" : "AVAILABLE";
  return metric({
    ...base,
    availability,
    coverageNote: [
      options.equityIncludesFloatingPl
        ? "Denominator equity already includes floating P/L per broker."
        : null,
      options.partialCoverage ? "Partial history coverage." : null,
    ]
      .filter(Boolean)
      .join(" ") || null,
    value: (realizedGross.value / eq) * 100,
  });
}

export function detectPartialCoverage(input: {
  fromUtc?: string | null;
  historyAvailableFromUtc?: string | null;
}): { partial: boolean; note: string; availability: MetricAvailability } {
  const fromMs = parseMs(input.fromUtc ?? null);
  const availMs = parseMs(input.historyAvailableFromUtc ?? null);
  if (availMs == null) {
    return {
      partial: true,
      availability: "PARTIAL",
      note:
        "Persisted history start is unknown — treat all period statistics as partial or unavailable.",
    };
  }
  if (fromMs != null && fromMs < availMs) {
    return {
      partial: true,
      availability: "PARTIAL",
      note:
        "Selected period begins before historyAvailableFromUtc — earlier broker closes may be missing.",
    };
  }
  return {
    partial: true, // ClosedTrades source is day-scoped; local persistence is observation-scoped — never claim complete all-time.
    availability: "PARTIAL",
    note:
      "Local persistence starts at first observation; ForexConnect ClosedTrades is current-trading-day only. Statistics are never all-time complete.",
  };
}

export function startOfUtcDayMs(nowMs: number): number {
  const d = new Date(nowMs);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function buildPerformanceSummary(input: {
  openTrades: ReadonlyArray<OpenTradeForAnalytics>;
  activeOrderCount: number | null;
  closedTrades: ReadonlyArray<ClosedTradeForAnalytics>;
  period: PerformancePeriodInput;
  periodLabel?: string;
}): PerformanceSummary {
  const nowMs = input.period.nowMs ?? Date.now();
  const currency = input.period.accountCurrency ?? null;
  const coverage = detectPartialCoverage({
    fromUtc: input.period.fromUtc,
    historyAvailableFromUtc: input.period.historyAvailableFromUtc,
  });

  const deduped = dedupeClosedTradesForAnalytics(input.closedTrades);
  const inPeriod = filterClosedInPeriod(deduped, input.period.fromUtc, input.period.toUtc);

  const floatingPl = computeFloatingPl(input.openTrades, currency);
  const realizedGrossPl = computeRealizedPl(inPeriod, {
    currency,
    basis: "gross",
    historyAvailableFromUtc: input.period.historyAvailableFromUtc,
    fromUtc: input.period.fromUtc,
    partialCoverage: coverage.partial,
  });
  const realizedNetPl = computeRealizedPl(inPeriod, {
    currency,
    basis: "net",
    historyAvailableFromUtc: input.period.historyAvailableFromUtc,
    fromUtc: input.period.fromUtc,
    partialCoverage: coverage.partial,
  });
  const outcomes = computeWinRate(inPeriod, {
    partialCoverage: coverage.partial,
    currency,
  });
  const plPercentOfEquity = computePlPercentOfEquity(
    realizedGrossPl,
    input.period.equity,
    currency,
    {
      equityIncludesFloatingPl: input.period.equityIncludesFloatingPl !== false,
      partialCoverage: coverage.partial,
    },
  );

  const openCount = input.openTrades.length;
  const orderCount = input.activeOrderCount;

  // Combined labeled metric — only when both sides available; clearly not a broker NAV figure.
  let combinedValue: number | null = null;
  let combinedAvailability: MetricAvailability = "UNAVAILABLE";
  if (floatingPl.value != null && realizedGrossPl.value != null) {
    combinedValue = floatingPl.value + realizedGrossPl.value;
    combinedAvailability =
      floatingPl.availability === "AVAILABLE" && realizedGrossPl.availability === "AVAILABLE"
        ? coverage.partial
          ? "PARTIAL"
          : "AVAILABLE"
        : "PARTIAL";
  }

  return {
    schemaVersion: "60.0.4",
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    period: {
      fromUtc: input.period.fromUtc ?? null,
      toUtc: input.period.toUtc ?? null,
      label: input.periodLabel
        ?? (input.period.fromUtc || input.period.toUtc ? "selected_range" : "all_persisted"),
    },
    historyAvailableFromUtc: input.period.historyAvailableFromUtc ?? null,
    coverage: {
      availability: coverage.availability,
      partial: coverage.partial,
      note: coverage.note,
    },
    openTradeCount: metric({
      id: "open_trade_count",
      label: "Open trades",
      scope: "current_snapshot",
      source: "forexconnect-trades",
      sourceKind: "broker-reported",
      currency: null,
      freshness: "current_open_trades_snapshot",
      definition: "Count of executed open broker trades (not working orders).",
      availability: "AVAILABLE",
      coverageNote: null,
      unit: "count",
      value: openCount,
    }),
    activeOrderCount: metric({
      id: "active_order_count",
      label: "Active orders",
      scope: "current_snapshot",
      source: "forexconnect-orders",
      sourceKind: "broker-reported",
      currency: null,
      freshness: "current_orders_snapshot",
      definition: "Count of pending/unfilled working orders — never counted as executed trades.",
      availability: orderCount == null ? "UNAVAILABLE" : "AVAILABLE",
      coverageNote: null,
      unit: "count",
      value: orderCount,
    }),
    floatingPl,
    realizedGrossPl,
    realizedNetPl,
    closedTradeCount: outcomes.closedTradeCount,
    profitableCount: outcomes.profitableCount,
    losingCount: outcomes.losingCount,
    zeroResultCount: outcomes.zeroResultCount,
    winRate: outcomes.winRate,
    plPercentOfEquity,
    combinedLabeledPl: metric({
      id: "combined_floating_plus_realized_gross",
      label: "Floating + realized (labeled)",
      scope: "mixed_scopes",
      source: "floating_pl + realized_gross_pl",
      sourceKind: "locally-calculated",
      currency,
      freshness: "mixed_scopes",
      definition:
        "Sum of current floating P/L and selected-period realized gross P/L. Not equity/NAV. Not a broker-reported figure. Scopes differ (snapshot vs period).",
      availability: combinedAvailability,
      coverageNote:
        "Do not confuse with account equity. Equity already includes floating when the broker reports it.",
      unit: "currency",
      value: combinedValue,
    }),
    evaluatedAtUtc: new Date(nowMs).toISOString(),
  };
}
