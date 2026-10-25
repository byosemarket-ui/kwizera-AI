/**
 * Phase 60.0.4 — format performance summary metrics for Trade Monitor UI.
 */
import { formatSignedPl, formatUnavailable } from "./format";

export type PerformancePeriodPreset = "today" | "all" | "custom";

export interface MetricValueView {
  id: string;
  label: string;
  value: number | null;
  availability: string;
  definition?: string;
  coverageNote?: string | null;
  currency?: string | null;
  unit?: string;
}

export interface TradeMonitorPerformancePayload {
  ok: boolean;
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
  coverageNote?: string;
  performance: {
    schemaVersion: "60.0.4";
    period: { fromUtc: string | null; toUtc: string | null; label: string };
    historyAvailableFromUtc: string | null;
    coverage: { availability: string; partial: boolean; note: string };
    openTradeCount: MetricValueView;
    activeOrderCount: MetricValueView;
    floatingPl: MetricValueView;
    realizedGrossPl: MetricValueView;
    realizedNetPl: MetricValueView;
    closedTradeCount: MetricValueView;
    profitableCount: MetricValueView;
    losingCount: MetricValueView;
    zeroResultCount: MetricValueView;
    winRate: MetricValueView;
    plPercentOfEquity: MetricValueView;
    combinedLabeledPl: MetricValueView;
    evaluatedAtUtc: string;
  };
}

export function parseTradePerformance(raw: unknown): TradeMonitorPerformancePayload | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as Record<string, unknown>;
  if (body.ok !== true || !body.performance || typeof body.performance !== "object") return null;
  return body as unknown as TradeMonitorPerformancePayload;
}

export function formatMetricCurrency(
  m: MetricValueView | null | undefined,
  currency?: string | null,
): { text: string; tone: "positive" | "negative" | "neutral" | "unknown"; availability: string } {
  if (!m || m.availability === "UNAVAILABLE" || m.value == null || !Number.isFinite(m.value)) {
    return {
      text: formatUnavailable(),
      tone: "unknown",
      availability: m?.availability ?? "UNAVAILABLE",
    };
  }
  const pl = formatSignedPl(m.value, currency ?? m.currency);
  return { ...pl, availability: m.availability };
}

export function formatMetricRatio(
  m: MetricValueView | null | undefined,
): { text: string; tone: "positive" | "negative" | "neutral" | "unknown"; availability: string } {
  if (!m || m.availability === "UNAVAILABLE" || m.value == null || !Number.isFinite(m.value)) {
    return {
      text: formatUnavailable(),
      tone: "unknown",
      availability: m?.availability ?? "UNAVAILABLE",
    };
  }
  const pct = (m.value * 100).toLocaleString(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return {
    text: `${pct}%`,
    tone: "neutral",
    availability: m.availability,
  };
}

export function formatMetricPercent(
  m: MetricValueView | null | undefined,
): { text: string; tone: "positive" | "negative" | "neutral" | "unknown"; availability: string } {
  if (!m || m.availability === "UNAVAILABLE" || m.value == null || !Number.isFinite(m.value)) {
    return {
      text: formatUnavailable(),
      tone: "unknown",
      availability: m?.availability ?? "UNAVAILABLE",
    };
  }
  const abs = Math.abs(m.value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const sign = m.value > 0 ? "+" : m.value < 0 ? "−" : "";
  const tone = m.value > 0 ? "positive" : m.value < 0 ? "negative" : "neutral";
  return { text: `${sign}${abs}%`, tone, availability: m.availability };
}

export function formatMetricCount(
  m: MetricValueView | null | undefined,
): { text: string; tone: "neutral" | "unknown"; availability: string } {
  if (!m || m.value == null || !Number.isFinite(m.value)) {
    return {
      text: formatUnavailable(),
      tone: "unknown",
      availability: m?.availability ?? "UNAVAILABLE",
    };
  }
  return {
    text: String(Math.trunc(m.value)),
    tone: "neutral",
    availability: m.availability,
  };
}
