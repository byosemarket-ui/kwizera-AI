/**
 * Phase 5F STEP 1 — coverage matrix layers (not interchangeable).
 */
import { HFM_DEFAULT_QUOTE_SYMBOLS } from "../../quote-types.js";
import { HFM_VERIFIED_LIVE_TFS } from "../../live-candle-engine.js";
import { MIF_PRODUCTION_DEFAULT_TIMEFRAMES } from "../production-integration/contracts.js";
import {
  classifyTimeframeLayer,
  isCodeSupportedTimeframe,
  isOperationallyExportableTimeframe,
  isVerifiedLiveTimeframe,
} from "./timeframe-layers.js";
import type { MifHistoricalResearchStorage } from "./storage.js";
import { eligibilityFromManifest } from "./research-eligibility.js";

export interface MifResearchCoverageCell {
  instrument: string;
  timeframe: string;
  codeSupported: boolean;
  verifiedLive: boolean;
  configuredMifProduction: boolean;
  operationallyExportable: boolean;
  actuallyArchived: boolean;
  qualityValidated: boolean;
  researchEligible: boolean;
  datasetId?: string;
  status?: string;
  candleCount?: number;
  startTime?: number | null;
  endTime?: number | null;
  contentHash?: string;
  costCompleteness?: string;
  suitableForCandleResearch?: boolean;
  suitableForCostAdjustedBacktest?: boolean;
  metadataAuthority?: string;
  versionCount?: number;
}

export async function buildResearchCoverageMatrix(
  storage: MifHistoricalResearchStorage,
  opts?: {
    instruments?: readonly string[];
    timeframes?: readonly string[];
  },
): Promise<{
  instruments: readonly string[];
  timeframes: readonly string[];
  cells: MifResearchCoverageCell[];
  summary: {
    cells: number;
    archivedCells: number;
    completeCells: number;
    researchEligibleCells: number;
  };
}> {
  const instruments = [...(opts?.instruments ?? HFM_DEFAULT_QUOTE_SYMBOLS)].map((s) =>
    String(s).toUpperCase(),
  );
  const timeframes = [...(opts?.timeframes ?? HFM_VERIFIED_LIVE_TFS)].map((t) =>
    String(t).toUpperCase(),
  );
  const registry = await storage.listRegistry();
  const cells: MifResearchCoverageCell[] = [];

  for (const instrument of instruments) {
    for (const timeframe of timeframes) {
      const layer = classifyTimeframeLayer(timeframe);
      const versions = registry.filter(
        (e) => e.instrument === instrument && e.timeframe === timeframe,
      );
      const complete = versions.filter((e) => e.status === "COMPLETE");
      const chosen =
        complete.sort((a, b) => b.candleCount - a.candleCount)[0] ??
        versions.sort((a, b) => b.candleCount - a.candleCount)[0] ??
        null;

      let qualityValidated = false;
      let researchEligible = false;
      let costCompleteness: string | undefined;
      let suitableForCandleResearch: boolean | undefined;
      let suitableForCostAdjustedBacktest: boolean | undefined;
      let metadataAuthority: string | undefined;
      let contentHash: string | undefined;

      if (chosen) {
        const manifest = await storage.getDatasetManifest(chosen.datasetId, chosen.version);
        if (manifest) {
          const el = eligibilityFromManifest(manifest);
          contentHash = manifest.contentHash;
          costCompleteness = el.costCompleteness;
          suitableForCandleResearch = el.suitableForCandleResearch;
          suitableForCostAdjustedBacktest = el.suitableForCostAdjustedBacktest;
          metadataAuthority = el.metadataAuthority;
          researchEligible = el.suitableForCandleResearch;
          qualityValidated =
            manifest.status === "COMPLETE" &&
            manifest.qualitySummary.invalidOhlcRejected === 0 &&
            manifest.candleCount > 0;
        }
      }

      cells.push({
        instrument,
        timeframe,
        codeSupported: isCodeSupportedTimeframe(timeframe),
        verifiedLive: isVerifiedLiveTimeframe(timeframe),
        configuredMifProduction: (MIF_PRODUCTION_DEFAULT_TIMEFRAMES as readonly string[]).includes(
          timeframe,
        ),
        operationallyExportable: isOperationallyExportableTimeframe(timeframe),
        actuallyArchived: chosen != null,
        qualityValidated,
        researchEligible,
        datasetId: chosen?.datasetId,
        status: chosen?.status,
        candleCount: chosen?.candleCount,
        startTime: chosen?.startTime,
        endTime: chosen?.endTime,
        contentHash,
        costCompleteness,
        suitableForCandleResearch,
        suitableForCostAdjustedBacktest,
        metadataAuthority,
        versionCount: versions.length,
        // layer retained for debugging consumers
        ...(layer.durationSec != null ? {} : {}),
      });
    }
  }

  return {
    instruments,
    timeframes,
    cells,
    summary: {
      cells: cells.length,
      archivedCells: cells.filter((c) => c.actuallyArchived).length,
      completeCells: cells.filter((c) => c.status === "COMPLETE").length,
      researchEligibleCells: cells.filter((c) => c.researchEligible).length,
    },
  };
}
