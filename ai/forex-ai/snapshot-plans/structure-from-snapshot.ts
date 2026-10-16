/**
 * Rebuild compact detector evidence for plan levels from an immutable snapshot.
 */
import { buildForexAiEvidencePack } from "../evidence/index.js";
import type { AnalysisMarketSnapshot } from "../../market-data/analysis-snapshot/types.js";
import { STRUCTURE_MIN_CLOSED_CANDLES } from "../../market-data/analysis-snapshot/periods.js";
import type { SnapshotStructureEvidenceSummary } from "./types.js";

const MAX_CANDLES = 48;

export function buildStructureEvidenceFromSnapshot(
  snapshot: AnalysisMarketSnapshot,
): SnapshotStructureEvidenceSummary {
  const quoteFreshness = snapshot.latestQuote?.freshness ?? snapshot.freshness?.quote ?? null;
  const closed = snapshot.candles.filter((c) => c.isClosed);
  const sample = closed.slice(-MAX_CANDLES);
  const expected = snapshot.freshness.expectedClosedCandles
    ?? snapshot.candlesRequestedEstimate;
  const dataUsable =
    snapshot.evidenceReady
    && sample.length >= STRUCTURE_MIN_CLOSED_CANDLES
    && snapshot.validation.status !== "INVALID"
    && snapshot.validation.status !== "ERROR";

  if (sample.length < STRUCTURE_MIN_CLOSED_CANDLES) {
    return {
      trendState: null,
      lastSwingHigh: null,
      lastSwingLow: null,
      events: [],
      zones: [],
      patterns: [],
      warnings: [
        `Insufficient closed candles for structure/pattern detectors `
          + `(have ${sample.length}, need ≥${STRUCTURE_MIN_CLOSED_CANDLES}; `
          + `window expected ${expected} for ${snapshot.candleTimeframe}/${snapshot.analysisPeriod}). `
          + "Coverage of a short window can be 100% without being structure-ready.",
      ],
      insufficientHistory: true,
      quoteFreshness,
      dataUsable: false,
    };
  }

  try {
    const pack = buildForexAiEvidencePack({
      provider: snapshot.provider,
      environment: snapshot.environment,
      symbol: snapshot.instrument.canonicalSymbol,
      timeframe: snapshot.candleTimeframe,
      candles: sample.map((c) => ({
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
        isClosed: c.isClosed,
      })),
      priceBasis: snapshot.priceBasis === "unknown" ? null : snapshot.priceBasis,
    });

    return {
      trendState: pack.structure.trendState,
      lastSwingHigh: pack.structure.swingSummary.lastHigh,
      lastSwingLow: pack.structure.swingSummary.lastLow,
      events: pack.structure.events.slice(0, 6).map((e) => ({
        type: e.type,
        direction: e.direction,
        status: e.status,
        level: Number.isFinite(e.level) ? e.level : null,
      })),
      zones: pack.structure.zones.slice(0, 6).map((z) => ({
        side: z.side,
        low: z.low,
        high: z.high,
        status: z.status,
      })),
      patterns: pack.patterns.detections.slice(0, 6).map((p) => {
        const completedAt = Number.isFinite(p.candleEndTime)
          ? new Date(p.candleEndTime * 1000).toISOString().replace(".000Z", "Z")
          : null;
        return {
          name: p.name,
          direction: p.direction,
          status: p.status,
          candleEndTime: Number.isFinite(p.candleEndTime) ? p.candleEndTime : null,
          completedAt,
          timeframe: snapshot.candleTimeframe,
        };
      }),
      warnings: [
        ...pack.warnings.slice(0, 4),
        ...(dataUsable ? [] : ["Snapshot validation or evidence readiness limits plan confirmation."]),
      ],
      insufficientHistory: pack.insufficientHistory,
      quoteFreshness,
      dataUsable: dataUsable && !pack.insufficientHistory,
    };
  } catch {
    return {
      trendState: null,
      lastSwingHigh: null,
      lastSwingLow: null,
      events: [],
      zones: [],
      patterns: [],
      warnings: ["Structure/pattern detectors unavailable for this snapshot."],
      insufficientHistory: true,
      quoteFreshness,
      dataUsable: false,
    };
  }
}

export function resolveReferencePrice(snapshot: AnalysisMarketSnapshot): number | null {
  const q = snapshot.latestQuote;
  const candidates = [q?.last, q?.mid, q?.bid, q?.ask].filter(
    (n): n is number => typeof n === "number" && Number.isFinite(n),
  );
  if (candidates.length) return candidates[0]!;
  const last = snapshot.candles.filter((c) => c.isClosed).at(-1);
  return last && Number.isFinite(last.close) ? last.close : null;
}
