/**
 * Engine 3 remediation — chart series coordinate-domain selection.
 *
 * A single Lightweight Charts series must never mix broker-domain and UTC-domain
 * coordinates. Prefer UTC only when every candle in the displayed series has
 * trusted openTimeUtc; otherwise use broker time consistently and label explicitly.
 */
import type { HfmChartCandle } from "./types";

export type HfmChartTimeDomain = "UTC" | "BROKER";

const TRUSTED_UTC_STATUSES = new Set(["NORMALIZED", "PARTIAL"]);

export function isTrustedChartUtcStatus(status: string | null | undefined): boolean {
  return typeof status === "string" && TRUSTED_UTC_STATUSES.has(status);
}

export function candleHasTrustedUtc(bar: HfmChartCandle): boolean {
  return (
    isTrustedChartUtcStatus(bar.timestampNormalizationStatus) &&
    typeof bar.openTimeUtc === "number" &&
    Number.isFinite(bar.openTimeUtc) &&
    bar.openTimeUtc > 0
  );
}

/**
 * Resolve a single coordinate domain for the whole series.
 * Mixed availability → BROKER (never mix domains in one series).
 */
export function resolveHfmChartTimeDomain(bars: HfmChartCandle[]): HfmChartTimeDomain {
  if (!bars.length) return "BROKER";
  return bars.every(candleHasTrustedUtc) ? "UTC" : "BROKER";
}

/** Series coordinate time for Lightweight Charts (unix seconds). */
export function chartSeriesTime(bar: HfmChartCandle, domain: HfmChartTimeDomain): number {
  if (domain === "UTC" && typeof bar.openTimeUtc === "number" && bar.openTimeUtc > 0) {
    return Math.trunc(bar.openTimeUtc);
  }
  const broker = bar.brokerOpenTime ?? bar.time;
  return Math.trunc(broker);
}

export function chartTimeDomainLabel(domain: HfmChartTimeDomain): string {
  return domain === "UTC" ? "UTC" : "Broker";
}

export function formatChartCoordinateTime(
  sec: number,
  domain: HfmChartTimeDomain,
): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const d = new Date(sec * 1000);
  const iso = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
  return `${iso} (${chartTimeDomainLabel(domain)})`;
}

/**
 * Map bars onto a consistent chart coordinate while preserving provenance fields.
 * `time` becomes the series coordinate; brokerOpenTime/openTimeUtc remain explicit.
 */
export function projectBarsToChartDomain(
  bars: HfmChartCandle[],
  domain?: HfmChartTimeDomain,
): { domain: HfmChartTimeDomain; bars: HfmChartCandle[] } {
  const resolved = domain ?? resolveHfmChartTimeDomain(bars);
  return {
    domain: resolved,
    bars: bars.map((b) => ({
      ...b,
      brokerOpenTime: b.brokerOpenTime ?? b.time,
      time: chartSeriesTime(b, resolved),
    })),
  };
}

/** Domains are compatible for cross-chart sync only when identical. */
export function chartDomainsCompatible(
  a: HfmChartTimeDomain,
  b: HfmChartTimeDomain,
): boolean {
  return a === b;
}
