/**
 * P8.B — priority symbol/timeframe coverage report.
 * Separates COMPLETE authoritative coverage from INCOMPLETE archives.
 */
import type { MifHistoricalResearchStorage } from "../storage.js";
import {
  MIF_PIT_DOCUMENTED_MTF_OVERLAP,
  MIF_PIT_PRIORITY_SYMBOLS,
  MIF_PIT_PRIORITY_TIMEFRAMES,
  MIF_PIT_REPLAY_CONTRACT_ID,
  MIF_PIT_REPLAY_CONTRACT_VERSION,
} from "./contracts.js";
import {
  buildPitDatasetIntegrityInventory,
  selectAuthoritativePitDatasets,
} from "./inventory.js";
import type {
  MifPitPriorityCoverageReport,
  MifPitPriorityTfCell,
} from "./types.js";

function iso(ts: number | null | undefined): string | null {
  if (ts == null || !Number.isFinite(ts)) return null;
  try {
    return new Date(ts * 1000).toISOString();
  } catch {
    return null;
  }
}

const SAFETY = {
  placesOrders: false as const,
  mutatesBroker: false as const,
  acceptsForExecution: false as const,
  researchReadOnly: true as const,
  doesNotApproveAiReasoning: true as const,
  notExecutable: true as const,
};

/**
 * Build priority coverage for EURUSD/GBPUSD/XAUUSD × H4/H1/M30/M15/M5.
 * Chooses the largest authoritative COMPLETE dataset per cell.
 */
export async function buildPitPriorityCoverageReport(
  storage: MifHistoricalResearchStorage,
  opts?: {
    verifyHashes?: boolean;
    generatedAt?: string;
  },
): Promise<MifPitPriorityCoverageReport> {
  const generatedAt = opts?.generatedAt ?? new Date().toISOString();
  const inventory = await buildPitDatasetIntegrityInventory(storage, {
    instruments: MIF_PIT_PRIORITY_SYMBOLS,
    timeframes: [...MIF_PIT_PRIORITY_TIMEFRAMES, "D1", "M1"],
    verifyHashes: opts?.verifyHashes,
    generatedAt,
  });

  const cells: MifPitPriorityTfCell[] = [];
  const incompleteNoted: MifPitPriorityCoverageReport["incompleteDatasetsNoted"] = [];

  for (const instrument of MIF_PIT_PRIORITY_SYMBOLS) {
    for (const timeframe of MIF_PIT_PRIORITY_TIMEFRAMES) {
      const auth = selectAuthoritativePitDatasets(inventory, {
        instrument,
        timeframe,
      }).sort((a, b) => b.candleCount - a.candleCount);
      const chosen = auth[0] ?? null;
      const incomplete = inventory.entries.filter(
        (e) =>
          e.instrument === instrument
          && e.timeframe === timeframe
          && e.status !== "COMPLETE",
      );
      for (const inc of incomplete) {
        incompleteNoted.push({
          datasetId: inc.datasetId,
          instrument,
          timeframe,
          candleCount: inc.candleCount,
          reason: inc.blockReasons.join(",") || "INCOMPLETE",
        });
      }

      const notes: string[] = [];
      if (!chosen) {
        notes.push("NO_AUTHORITATIVE_COMPLETE_DATASET");
        if (incomplete.length) {
          notes.push(
            `INCOMPLETE_ARCHIVES_PRESENT_NOT_USED:${incomplete.map((i) => i.candleCount).join("/")}`,
          );
        }
      } else if (timeframe === "H1" && instrument === "EURUSD" && chosen.candleCount < 200) {
        notes.push("SHALLOW_COMPLETE_H1_DO_NOT_SUBSTITUTE_INCOMPLETE_DEEP_EXPORTS");
      }

      cells.push({
        instrument,
        timeframe,
        present: chosen != null || incomplete.length > 0,
        authoritative: chosen != null,
        datasetId: chosen?.datasetId ?? null,
        version: chosen?.version ?? null,
        contentHash: chosen?.contentHash ?? null,
        status: chosen?.status ?? (incomplete[0]?.status ?? null),
        candleCount: chosen?.candleCount ?? null,
        startTime: chosen?.startTime ?? null,
        endTime: chosen?.endTime ?? null,
        startIso: chosen?.startIso ?? null,
        endIso: chosen?.endIso ?? null,
        missingIntervalCount: chosen?.missingIntervalCount ?? null,
        sessionUncertainty: chosen?.sessionUncertainty ?? null,
        incompleteExcluded: incomplete.length > 0,
        notes,
      });
    }
  }

  // MTF overlap = max(start) .. min(end) across all five TFs per symbol, then intersection across symbols.
  const perSymbolOverlaps: Array<{ start: number; end: number; limitedBy: string }> = [];
  for (const instrument of MIF_PIT_PRIORITY_SYMBOLS) {
    const pack = cells.filter((c) => c.instrument === instrument && c.authoritative);
    if (pack.length < MIF_PIT_PRIORITY_TIMEFRAMES.length) {
      continue;
    }
    let start = -Infinity;
    let end = Infinity;
    let limitedByStart = "";
    let limitedByEnd = "";
    for (const c of pack) {
      if (c.startTime != null && c.startTime > start) {
        start = c.startTime;
        limitedByStart = `${c.timeframe}:start`;
      }
      if (c.endTime != null && c.endTime < end) {
        end = c.endTime;
        limitedByEnd = `${c.timeframe}:end`;
      }
    }
    if (Number.isFinite(start) && Number.isFinite(end) && start <= end) {
      perSymbolOverlaps.push({
        start,
        end,
        limitedBy: `${limitedByStart}+${limitedByEnd}`,
      });
    }
  }

  let mtfStart: number | null = null;
  let mtfEnd: number | null = null;
  let limitedBy: string | null = null;
  if (perSymbolOverlaps.length) {
    mtfStart = Math.max(...perSymbolOverlaps.map((o) => o.start));
    mtfEnd = Math.min(...perSymbolOverlaps.map((o) => o.end));
    limitedBy = perSymbolOverlaps.map((o) => o.limitedBy).join(";");
    if (mtfStart > mtfEnd) {
      mtfStart = null;
      mtfEnd = null;
      limitedBy = "NO_COMMON_OVERLAP";
    }
  } else {
    limitedBy = "INSUFFICIENT_AUTHORITATIVE_PACKS";
  }

  return {
    contractId: MIF_PIT_REPLAY_CONTRACT_ID,
    contractVersion: MIF_PIT_REPLAY_CONTRACT_VERSION,
    generatedAt,
    symbols: MIF_PIT_PRIORITY_SYMBOLS,
    timeframes: MIF_PIT_PRIORITY_TIMEFRAMES,
    cells,
    mtfOverlap: {
      startTime: mtfStart,
      endTime: mtfEnd,
      startIso: iso(mtfStart),
      endIso: iso(mtfEnd),
      limitedBy,
      sufficientForLongTermPerformanceClaims: false,
      note:
        `${MIF_PIT_DOCUMENTED_MTF_OVERLAP.note} Documented audit approx: `
        + `${MIF_PIT_DOCUMENTED_MTF_OVERLAP.approxStartIso} → ${MIF_PIT_DOCUMENTED_MTF_OVERLAP.approxEndIso}. `
        + `Verified from sealed manifests when start/end are non-null.`,
    },
    incompleteDatasetsNoted: incompleteNoted,
    disclaimer:
      "Three days of overlapping MTF COMPLETE data are not sufficient for long-term strategy performance validation. "
      + "INCOMPLETE deep exports (e.g. large EURUSD H1) are excluded from authoritative replay.",
    ...SAFETY,
  };
}
