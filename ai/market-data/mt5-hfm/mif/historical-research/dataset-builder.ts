/**
 * Phase 5F STEP 1 — immutable dataset builder + registry seal.
 */
import {
  MIF_HISTORICAL_RESEARCH_CONTRACT_ID,
  MIF_HISTORICAL_RESEARCH_CONTRACT_VERSION,
  MIF_HISTORICAL_RESEARCH_ENGINE_ID,
  MIF_HISTORICAL_RESEARCH_ENGINE_VERSION,
} from "./contracts.js";
import { buildDatasetId, computeResearchDatasetContentHash } from "./hash.js";
import { buildPitMetadataBundle, type MifResearchCatalogInstrumentSnapshot } from "./pit-metadata.js";
import { buildQualitySummary } from "./quality.js";
import { assessResearchEligibility } from "./research-eligibility.js";
import {
  sanitizeResearchStorageId,
  type MifHistoricalResearchStorage,
} from "./storage.js";
import type {
  MifResearchDatasetManifest,
  MifResearchExportProvenance,
  MifResearchInclusionRules,
  MifResearchStoredBar,
} from "./types.js";

export interface BuildResearchDatasetInput {
  instrument: string;
  timeframe: string;
  version?: number;
  bars: readonly MifResearchStoredBar[];
  rejectedCandles: number;
  duplicateOrOutOfOrderRejected: number;
  invalidOhlcRejected: number;
  incompleteExportRange: boolean;
  inclusionRules: MifResearchInclusionRules;
  exportProvenance: MifResearchExportProvenance;
  catalogRow?: MifResearchCatalogInstrumentSnapshot | null;
  sourceSnapshotId?: string | null;
  createdAt?: string;
  notes?: readonly string[];
}

export function buildResearchDatasetManifest(
  input: BuildResearchDatasetInput,
): MifResearchDatasetManifest {
  const instrument = String(input.instrument).trim().toUpperCase();
  const timeframe = String(input.timeframe).trim().toUpperCase();
  const version = input.version ?? 1;
  const createdAt = input.createdAt ?? new Date().toISOString();
  const sorted = [...input.bars].sort((a, b) => a.time - b.time);

  const contentHash = computeResearchDatasetContentHash({
    provider: "HFM_MT5",
    instrument,
    timeframe,
    timebase: "BROKER_SERVER",
    version,
    bars: sorted,
  });
  const datasetId = buildDatasetId({ instrument, timeframe, contentHash });

  const pitMetadata = buildPitMetadataBundle({
    instrument,
    catalogRow: input.catalogRow,
    observedAt: createdAt,
  });

  // Until historically authoritative PIT sources exist, treat metadata as uncertain.
  const pitMetadataUncertainty =
    pitMetadata.instrumentSpec.availability !== "SOURCE_BACKED" ||
    pitMetadata.sessions.historicalAuthority === false;

  const qualitySummary = buildQualitySummary({
    bars: sorted,
    timeframe,
    rejectedCandles: input.rejectedCandles,
    duplicateOrOutOfOrderRejected: input.duplicateOrOutOfOrderRejected,
    invalidOhlcRejected: input.invalidOhlcRejected,
    incompleteExportRange: input.incompleteExportRange,
    pitMetadataUncertainty,
    notes: input.notes,
  });

  const status = input.incompleteExportRange || sorted.length === 0 ? "INCOMPLETE" : "COMPLETE";

  const researchEligibility = assessResearchEligibility({
    status,
    qualitySummary,
    pitMetadata,
    candleCount: sorted.length,
  });

  const safeDatasetDir = sanitizeResearchStorageId(datasetId);
  const barsRelativePath = `datasets/${safeDatasetDir}/v${version}/bars.json`;
  const metadataRef = `metadata/${sanitizeResearchStorageId(`${datasetId}.v${version}`)}.json`;

  return {
    contractId: MIF_HISTORICAL_RESEARCH_CONTRACT_ID,
    contractVersion: MIF_HISTORICAL_RESEARCH_CONTRACT_VERSION,
    engineId: MIF_HISTORICAL_RESEARCH_ENGINE_ID,
    engineVersion: MIF_HISTORICAL_RESEARCH_ENGINE_VERSION,
    datasetId,
    version,
    status,
    provider: "HFM_MT5",
    instrument,
    timeframe,
    timebase: "BROKER_SERVER",
    startTime: sorted[0]?.time ?? null,
    endTime: sorted[sorted.length - 1]?.time ?? null,
    candleCount: sorted.length,
    sourceSnapshotId: input.sourceSnapshotId ?? null,
    qualitySummary,
    missingIntervals: qualitySummary.missingIntervals,
    inclusionRules: input.inclusionRules,
    createdAt,
    contentHash,
    metadataRef,
    pitMetadata,
    exportProvenance: input.exportProvenance,
    barsRelativePath,
    researchEligibility,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    doesNotApproveAiReasoning: true,
    researchReadOnly: true,
  };
}

export async function sealResearchDataset(
  storage: MifHistoricalResearchStorage,
  input: BuildResearchDatasetInput,
): Promise<
  | { ok: true; manifest: MifResearchDatasetManifest }
  | { ok: false; code: string; message: string; manifest?: MifResearchDatasetManifest }
> {
  const manifest = buildResearchDatasetManifest(input);
  await storage.persistPitMetadata(
    `${manifest.datasetId}.v${manifest.version}`,
    manifest.pitMetadata,
  );
  const persisted = await storage.persistImmutableDataset({
    manifest,
    bars: [...input.bars].sort((a, b) => a.time - b.time),
  });
  if (!persisted.ok) {
    return { ok: false, code: persisted.code, message: persisted.message, manifest };
  }
  return { ok: true, manifest };
}
