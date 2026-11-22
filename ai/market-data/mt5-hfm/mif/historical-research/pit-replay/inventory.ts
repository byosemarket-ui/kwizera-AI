/**
 * P8.B — bounded sequential dataset integrity inventory.
 * Processes one registry entry at a time. Never promotes INCOMPLETE datasets.
 */
import type { MifHistoricalResearchStorage } from "../storage.js";
import {
  MIF_PIT_REPLAY_CONTRACT_ID,
  MIF_PIT_REPLAY_CONTRACT_VERSION,
  MIF_PIT_REPLAY_ENGINE_ID,
  MIF_PIT_REPLAY_ENGINE_VERSION,
} from "./contracts.js";
import type {
  MifPitDatasetInventoryEntry,
  MifPitDatasetInventoryReport,
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
 * Sequentially inventory sealed research datasets from `{ entries: [...] }` registry.
 * Optional filter by instruments/timeframes; does not load all bar payloads unless verifying hash.
 */
export async function buildPitDatasetIntegrityInventory(
  storage: MifHistoricalResearchStorage,
  opts?: {
    instruments?: readonly string[];
    timeframes?: readonly string[];
    /** When true (default), recompute content hash via verifyDatasetConsistency. */
    verifyHashes?: boolean;
    generatedAt?: string;
  },
): Promise<MifPitDatasetInventoryReport> {
  const verifyHashes = opts?.verifyHashes !== false;
  const instrumentFilter = opts?.instruments?.map((s) => String(s).toUpperCase()) ?? null;
  const timeframeFilter = opts?.timeframes?.map((t) => String(t).toUpperCase()) ?? null;
  const generatedAt = opts?.generatedAt ?? new Date().toISOString();

  const registry = await storage.listRegistry();
  const entries: MifPitDatasetInventoryEntry[] = [];
  let authoritativeCount = 0;
  let incompleteExcludedCount = 0;
  let hashFailureCount = 0;

  for (const reg of registry) {
    const instrument = String(reg.instrument || "").toUpperCase();
    const timeframe = String(reg.timeframe || "").toUpperCase();
    if (instrumentFilter && !instrumentFilter.includes(instrument)) continue;
    if (timeframeFilter && !timeframeFilter.includes(timeframe)) continue;

    // Sequential: one manifest (+ optional verify) at a time.
    const manifest = await storage.getDatasetManifest(reg.datasetId, reg.version);
    if (!manifest) {
      entries.push({
        datasetId: reg.datasetId,
        version: reg.version,
        instrument,
        timeframe,
        status: reg.status,
        contentHash: reg.contentHash,
        candleCount: reg.candleCount,
        startTime: reg.startTime,
        endTime: reg.endTime,
        startIso: iso(reg.startTime),
        endIso: iso(reg.endTime),
        suitableForCandleResearch: false,
        suitableForCostAdjustedBacktest: false,
        hashVerified: false,
        countVerified: false,
        authoritativeForPitReplay: false,
        integrityCode: "MANIFEST_MISSING",
        missingIntervalCount: 0,
        missingClassifications: [],
        sessionUncertainty: true,
        incompleteExportRange: true,
        blockReasons: ["MANIFEST_MISSING"],
        ...SAFETY,
      });
      continue;
    }

    const missing = manifest.missingIntervals ?? [];
    const classifications = [
      ...new Set(
        missing
          .map((m) => String(m.classification || "").trim())
          .filter(Boolean),
      ),
    ];
    const suitable = manifest.researchEligibility?.suitableForCandleResearch === true;
    const complete = manifest.status === "COMPLETE";
    let hashVerified = false;
    let countVerified = false;
    let integrityCode: string | null = null;

    if (verifyHashes) {
      const v = await storage.verifyDatasetConsistency(reg.datasetId, reg.version);
      if (v.ok) {
        hashVerified = true;
        countVerified = true;
      } else {
        hashFailureCount += 1;
        integrityCode = v.code;
        hashVerified = false;
        countVerified = false;
      }
    } else {
      // Manifest/registry agreement only (no bar reload).
      hashVerified = reg.contentHash === manifest.contentHash;
      countVerified = reg.candleCount === manifest.candleCount;
      if (!hashVerified) integrityCode = "REGISTRY_HASH_MISMATCH";
      if (!countVerified) integrityCode = integrityCode ?? "COUNT_MISMATCH";
    }

    const blockReasons = [
      ...(manifest.researchEligibility?.blockReasons ?? []),
    ];
    if (!complete) {
      incompleteExcludedCount += 1;
      if (!blockReasons.includes("STATUS_NOT_COMPLETE")) {
        blockReasons.push("STATUS_NOT_COMPLETE");
      }
    }
    if (!suitable && !blockReasons.length) {
      blockReasons.push("NOT_SUITABLE_FOR_CANDLE_RESEARCH");
    }
    if (!hashVerified) blockReasons.push("HASH_NOT_VERIFIED");

    const authoritative =
      complete
      && suitable
      && hashVerified
      && countVerified
      && manifest.candleCount > 0;

    if (authoritative) authoritativeCount += 1;

    entries.push({
      datasetId: manifest.datasetId,
      version: manifest.version,
      instrument,
      timeframe,
      status: manifest.status,
      contentHash: manifest.contentHash,
      candleCount: manifest.candleCount,
      startTime: manifest.startTime,
      endTime: manifest.endTime,
      startIso: iso(manifest.startTime),
      endIso: iso(manifest.endTime),
      suitableForCandleResearch: suitable,
      suitableForCostAdjustedBacktest:
        manifest.researchEligibility?.suitableForCostAdjustedBacktest === true,
      hashVerified,
      countVerified,
      authoritativeForPitReplay: authoritative,
      integrityCode,
      missingIntervalCount: missing.length,
      missingClassifications: classifications,
      sessionUncertainty: manifest.qualitySummary?.sessionUncertainty === true,
      incompleteExportRange: manifest.qualitySummary?.incompleteExportRange === true,
      blockReasons,
      ...SAFETY,
    });
  }

  entries.sort((a, b) =>
    `${a.instrument}:${a.timeframe}:${a.datasetId}`.localeCompare(
      `${b.instrument}:${b.timeframe}:${b.datasetId}`,
    ),
  );

  return {
    contractId: MIF_PIT_REPLAY_CONTRACT_ID,
    contractVersion: MIF_PIT_REPLAY_CONTRACT_VERSION,
    engineId: MIF_PIT_REPLAY_ENGINE_ID,
    engineVersion: MIF_PIT_REPLAY_ENGINE_VERSION,
    generatedAt,
    storageRootHint: storage.root,
    registryEntryCount: registry.length,
    scannedCount: entries.length,
    authoritativeCount,
    incompleteExcludedCount,
    hashFailureCount,
    entries,
    summaryNote:
      "Only COMPLETE + hash-verified + suitableForCandleResearch datasets are authoritativeForPitReplay. INCOMPLETE datasets are excluded.",
    ...SAFETY,
  };
}

/** Authoritative bindings only — never includes INCOMPLETE. */
export function selectAuthoritativePitDatasets(
  inventory: MifPitDatasetInventoryReport,
  opts?: { instrument?: string; timeframe?: string },
): MifPitDatasetInventoryEntry[] {
  return inventory.entries.filter((e) => {
    if (!e.authoritativeForPitReplay) return false;
    if (opts?.instrument && e.instrument !== String(opts.instrument).toUpperCase()) {
      return false;
    }
    if (opts?.timeframe && e.timeframe !== String(opts.timeframe).toUpperCase()) {
      return false;
    }
    return true;
  });
}
