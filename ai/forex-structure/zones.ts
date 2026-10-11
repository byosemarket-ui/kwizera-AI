/**
 * Support / resistance zones from confirmed swings — market-structure-v1.
 *
 * Cluster confirmed swing prices within zoneToleranceRel * mid price.
 * Scale-aware via relative tolerance.
 * Empty / insufficient when fewer than 2 confirmed swings.
 *
 * BROKEN: confirmed close beyond zone (support below low; resistance above high).
 * STALE: no touch within staleZoneBars from last touch.
 */

import type {
  StructureCandle,
  StructureRuleParams,
  StructureSwing,
  StructureZone,
  ZoneKind,
} from "./types.js";
import { isStructureCandleClosed, priceScale } from "./validate.js";

interface ClusterSeed {
  swings: StructureSwing[];
  prices: number[];
}

function clusterSwings(
  swings: StructureSwing[],
  toleranceRel: number,
): ClusterSeed[] {
  if (swings.length === 0) return [];
  const sorted = [...swings].sort((a, b) => a.price - b.price);
  const clusters: ClusterSeed[] = [];
  let current: ClusterSeed = { swings: [sorted[0]!], prices: [sorted[0]!.price] };

  for (let i = 1; i < sorted.length; i += 1) {
    const swing = sorted[i]!;
    const mid =
      current.prices.reduce((s, p) => s + p, 0) / current.prices.length;
    const tol = toleranceRel * priceScale(mid);
    if (Math.abs(swing.price - mid) <= tol) {
      current.swings.push(swing);
      current.prices.push(swing.price);
    } else {
      clusters.push(current);
      current = { swings: [swing], prices: [swing.price] };
    }
  }
  clusters.push(current);
  return clusters;
}

function inferKind(swings: StructureSwing[]): ZoneKind {
  const highs = swings.filter((s) => s.kind === "HIGH").length;
  const lows = swings.filter((s) => s.kind === "LOW").length;
  if (highs > 0 && lows === 0) return "RESISTANCE";
  if (lows > 0 && highs === 0) return "SUPPORT";
  return "PIVOT";
}

function touchesZone(
  candle: StructureCandle,
  low: number,
  high: number,
): boolean {
  return candle.low <= high && candle.high >= low;
}

export function buildStructureZones(
  candles: StructureCandle[],
  closedCount: number,
  swings: StructureSwing[],
  params: StructureRuleParams,
): StructureZone[] {
  const confirmed = swings
    .filter((s) => s.status === "CONFIRMED")
    .sort((a, b) => a.index - b.index);

  if (confirmed.length < 2) {
    return [];
  }

  const clusters = clusterSwings(confirmed, params.zoneToleranceRel);
  const lastClosedIndex = closedCount - 1;
  const zones: StructureZone[] = [];

  for (let ci = 0; ci < clusters.length; ci += 1) {
    const cluster = clusters[ci]!;
    const low = Math.min(...cluster.prices);
    const high = Math.max(...cluster.prices);
    const mid = (low + high) / 2;
    const kind = inferKind(cluster.swings);
    const sourceSwingIds = cluster.swings.map((s) => s.id);

    let touchCount = 0;
    let lastTouchIndex = -1;
    let broken = false;

    const scanStart = Math.max(0, closedCount - params.scanBars);
    for (let i = scanStart; i < closedCount; i += 1) {
      const candle = candles[i]!;
      if (!isStructureCandleClosed(candle)) continue;
      if (touchesZone(candle, low, high)) {
        touchCount += 1;
        lastTouchIndex = i;
      }
      if (kind === "SUPPORT" || kind === "PIVOT") {
        if (candle.close < low) broken = true;
      }
      if (kind === "RESISTANCE" || kind === "PIVOT") {
        if (candle.close > high) broken = true;
      }
    }

    let status: StructureZone["status"] = "ACTIVE";
    if (broken) {
      status = "BROKEN";
    } else if (
      lastTouchIndex >= 0
      && lastClosedIndex - lastTouchIndex >= params.staleZoneBars
    ) {
      status = "STALE";
    } else if (lastTouchIndex < 0 && confirmed[0]!.index >= 0) {
      // Never touched in scan window after formation — still ACTIVE if recent enough
      const newestSource = Math.max(...cluster.swings.map((s) => s.index));
      if (lastClosedIndex - newestSource >= params.staleZoneBars) {
        status = "STALE";
      }
    }

    zones.push({
      id: `zone-${kind.toLowerCase()}-${ci}-${mid}`,
      kind,
      low,
      high,
      mid,
      sourceSwingIds,
      touchCount,
      lastTouchIndex,
      status,
      evidence: [
        `Cluster of ${cluster.swings.length} confirmed swing(s)`,
        `bounds=[${low}, ${high}] mid=${mid}`,
        `toleranceRel=${params.zoneToleranceRel}`,
        `status=${status} touches=${touchCount}`,
      ],
    });
  }

  // Prefer ACTIVE zones first, then by touch count; cap
  zones.sort((a, b) => {
    const rank = (s: StructureZone["status"]) =>
      s === "ACTIVE" ? 0 : s === "BROKEN" ? 1 : 2;
    if (rank(a.status) !== rank(b.status)) return rank(a.status) - rank(b.status);
    if (a.touchCount !== b.touchCount) return b.touchCount - a.touchCount;
    return a.mid - b.mid;
  });

  return zones.slice(0, params.maxZones);
}
