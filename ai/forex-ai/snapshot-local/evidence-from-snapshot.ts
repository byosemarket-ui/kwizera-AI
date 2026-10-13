/**
 * Bounded evidence package from an immutable analysis snapshot (Phase 43D).
 */
import {
  buildForexAiEvidencePack,
  formatEvidenceForPrompt,
} from "../evidence/index.js";
import type { AnalysisMarketSnapshot } from "../../market-data/analysis-snapshot/types.js";
import type {
  LocalSnapshotEvidencePackage,
  SnapshotEvidenceCategories,
} from "./types.js";

/** Keep prompt tiny for llama3.2:1b on constrained VPS. */
export const MAX_EVIDENCE_CANDLES = 48;

export function buildEvidenceFromSnapshot(
  snapshot: AnalysisMarketSnapshot,
): LocalSnapshotEvidencePackage {
  const unavailable: string[] = [];
  const closed = snapshot.candles.filter((c) => c.isClosed);
  const sample = closed.slice(-MAX_EVIDENCE_CANDLES);

  let detectorSummary = "";
  let patterns = false;
  let structure = false;
  try {
    if (sample.length >= 5) {
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
        })),
        priceBasis: snapshot.priceBasis === "unknown" ? null : snapshot.priceBasis,
      });
      detectorSummary = formatEvidenceForPrompt(pack, 700);
      patterns = pack.patterns.detections.length > 0;
      structure = pack.structure.events.length > 0
        || pack.structure.zones.length > 0
        || pack.structure.swingSummary.confirmedCount > 0;
      if (!patterns) unavailable.push("patterns_empty");
      if (!structure) unavailable.push("structure_sparse");
    } else {
      unavailable.push("patterns");
      unavailable.push("structure");
      detectorSummary = "DETECTOR_EVIDENCE: insufficient candles for detectors.";
    }
  } catch {
    unavailable.push("patterns");
    unavailable.push("structure");
    detectorSummary = "DETECTOR_EVIDENCE: unavailable.";
  }

  // Knowledge is optional and skipped by default for latency/budget in 43D.
  unavailable.push("knowledge");

  const categories: SnapshotEvidenceCategories = {
    snapshotMeta: true,
    candles: sample.length > 0,
    quote: Boolean(snapshot.latestQuote),
    validation: true,
    patterns,
    structure,
    knowledge: false,
    unavailable,
  };

  if (!categories.candles) unavailable.push("candles");
  if (!categories.quote) unavailable.push("quote");

  return {
    schemaVersion: "forex-local-snapshot-evidence-v1",
    snapshotId: snapshot.snapshotId,
    contentFingerprint: snapshot.contentFingerprint,
    provider: snapshot.provider,
    instrument: {
      providerSymbol: snapshot.instrument.providerSymbol,
      canonicalSymbol: snapshot.instrument.canonicalSymbol,
      displaySymbol: snapshot.instrument.displaySymbol,
    },
    candleTimeframe: snapshot.candleTimeframe,
    analysisPeriod: snapshot.analysisPeriod,
    requestedRange: {
      startUtc: snapshot.requestedRange.startUtc,
      endUtc: snapshot.requestedRange.endUtc,
    },
    returnedRange: snapshot.returnedRange
      ? {
          startUtc: snapshot.returnedRange.startUtc,
          endUtc: snapshot.returnedRange.endUtc,
        }
      : null,
    priceBasis: snapshot.priceBasis,
    environment: snapshot.environment,
    quoteFreshness: snapshot.freshness.quote,
    marketStatus: snapshot.marketStatus,
    candleCount: snapshot.candleCount,
    candlesRequestedEstimate: snapshot.candlesRequestedEstimate,
    candles: sample.map((c) => ({
      t: c.time,
      o: c.open,
      h: c.high,
      l: c.low,
      c: c.close,
      v: c.volume,
      closed: c.isClosed,
    })),
    dataGaps: snapshot.dataGaps.map((g) => ({
      startUtc: g.startUtc,
      endUtc: g.endUtc,
      missingIntervals: g.missingIntervals,
      reason: g.reason,
    })),
    warnings: [...snapshot.warnings, ...snapshot.validation.warnings].slice(0, 12),
    validationStatus: snapshot.validation.status,
    evidenceReady: snapshot.evidenceReady,
    detectorSummary,
    categories,
  };
}

export function formatLocalEvidenceForPrompt(pkg: LocalSnapshotEvidencePackage): string {
  const last = pkg.candles[pkg.candles.length - 1];
  const first = pkg.candles[0];
  const lines = [
    "SNAPSHOT_EVIDENCE (authoritative; do not invent or change):",
    `id=${pkg.snapshotId.slice(0, 8)} fp=${pkg.contentFingerprint.slice(0, 12)}`,
    `provider=${pkg.provider} instrument=${pkg.instrument.displaySymbol}`,
    `tf=${pkg.candleTimeframe} period=${pkg.analysisPeriod} basis=${pkg.priceBasis}`,
    `window=${pkg.requestedRange.startUtc}→${pkg.requestedRange.endUtc}`,
    `candles=${pkg.candles.length}/${pkg.candleCount} est=${pkg.candlesRequestedEstimate}`,
    `quote=${pkg.quoteFreshness} market=${pkg.marketStatus} validation=${pkg.validationStatus}`,
    first && last
      ? `ohlc_span first=${first.o}/${first.h}/${first.l}/${first.c} last=${last.o}/${last.h}/${last.l}/${last.c}`
      : "ohlc_span=none",
    pkg.warnings.length ? `warnings=${pkg.warnings.slice(0, 4).join(" | ")}` : "warnings=none",
    pkg.dataGaps.length
      ? `gaps=${pkg.dataGaps.length} firstReason=${pkg.dataGaps[0]?.reason}`
      : "gaps=0",
    pkg.detectorSummary,
    `categories_unavailable=${pkg.categories.unavailable.join(",") || "none"}`,
  ];
  let body = lines.join("\n");
  if (body.length > 1800) body = body.slice(0, 1800);
  return body;
}
