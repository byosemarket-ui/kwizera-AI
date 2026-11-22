/**
 * P8.B — immutable Point-in-Time replay input manifest builder.
 * Identity excludes wall-clock createdAt; includes dataset hashes + cutoff.
 */
import { createHash } from "node:crypto";
import { stableSerialize } from "../../quality/stable-identity.js";
import {
  MIF_PIT_VISIBILITY_POLICY_ID,
  MIF_PIT_VISIBILITY_POLICY_VERSION,
} from "../replay-bridge.js";
import type { MifHistoricalResearchStorage } from "../storage.js";
import type { MifResearchDatasetManifest } from "../types.js";
import {
  MIF_PIT_REPLAY_CONTRACT_ID,
  MIF_PIT_REPLAY_CONTRACT_VERSION,
  MIF_PIT_REPLAY_ENGINE_ID,
  MIF_PIT_REPLAY_ENGINE_VERSION,
  MIF_PIT_REPLAY_MANIFEST_POLICY_ID,
  MIF_PIT_REPLAY_MANIFEST_POLICY_VERSION,
} from "./contracts.js";
import type {
  MifPitReplayInputManifest,
  MifPitReplayTimeframeBinding,
} from "./types.js";

const SAFETY = {
  placesOrders: false as const,
  mutatesBroker: false as const,
  acceptsForExecution: false as const,
  researchReadOnly: true as const,
  doesNotApproveAiReasoning: true as const,
  notExecutable: true as const,
};

export interface BuildPitReplayInputManifestInput {
  instrument: string;
  primaryTimeframe: string;
  /** datasetId + version pairs; must all be COMPLETE + suitable + hash-verified. */
  datasets: readonly { datasetId: string; version: number }[];
  decisionCutoffSec: number;
  requestedStartTimeSec?: number | null;
  requestedEndTimeSec?: number | null;
  createdAt?: string;
  /** Inject preloaded manifests for tests (skips storage). */
  manifests?: readonly MifResearchDatasetManifest[];
  /** When using storage, verify hashes (default true). */
  verifyHashes?: boolean;
}

function contentIdentityMaterial(input: {
  instrument: string;
  primaryTimeframe: string;
  decisionCutoffSec: number;
  requestedStartTimeSec: number | null;
  requestedEndTimeSec: number | null;
  bindings: readonly MifPitReplayTimeframeBinding[];
}): string {
  return stableSerialize({
    contractId: MIF_PIT_REPLAY_CONTRACT_ID,
    contractVersion: MIF_PIT_REPLAY_CONTRACT_VERSION,
    manifestPolicyVersion: MIF_PIT_REPLAY_MANIFEST_POLICY_VERSION,
    instrument: input.instrument,
    primaryTimeframe: input.primaryTimeframe,
    decisionCutoffSec: input.decisionCutoffSec,
    requestedStartTimeSec: input.requestedStartTimeSec,
    requestedEndTimeSec: input.requestedEndTimeSec,
    clipMode: "CLOSE_TIME_AT_DECISION",
    closeTimeVisibilityPolicyVersion: MIF_PIT_VISIBILITY_POLICY_VERSION,
    bindings: input.bindings.map((b) => ({
      timeframe: b.timeframe,
      datasetId: b.datasetId,
      version: b.version,
      contentHash: b.contentHash,
      candleCount: b.candleCount,
      startTime: b.startTime,
      endTime: b.endTime,
    })),
  });
}

export function computePitReplayManifestContentIdentityHash(
  material: Parameters<typeof contentIdentityMaterial>[0],
): string {
  return createHash("sha256")
    .update(contentIdentityMaterial(material), "utf8")
    .digest("hex");
}

export function computePitReplayManifestId(contentIdentityHash: string): string {
  return `pitrm:${contentIdentityHash.slice(0, 32)}`;
}

export type BuildPitReplayInputManifestResult =
  | { ok: true; manifest: MifPitReplayInputManifest }
  | { ok: false; code: string; message: string };

/**
 * Build a frozen PIT replay input manifest. Incomplete / unverified datasets are rejected.
 */
export async function buildPitReplayInputManifest(
  storage: MifHistoricalResearchStorage | null,
  input: BuildPitReplayInputManifestInput,
): Promise<BuildPitReplayInputManifestResult> {
  const instrument = String(input.instrument || "").trim().toUpperCase();
  const primaryTimeframe = String(input.primaryTimeframe || "").trim().toUpperCase();
  const decisionCutoffSec = input.decisionCutoffSec;
  if (!instrument || !primaryTimeframe) {
    return { ok: false, code: "MISSING_INSTRUMENT_OR_TF", message: "instrument and primaryTimeframe required" };
  }
  if (!Number.isFinite(decisionCutoffSec) || decisionCutoffSec <= 0) {
    return { ok: false, code: "INVALID_CUTOFF", message: "decisionCutoffSec must be positive unix seconds" };
  }
  if (!input.datasets.length && !(input.manifests && input.manifests.length)) {
    return { ok: false, code: "NO_DATASETS", message: "at least one dataset binding required" };
  }

  const verifyHashes = input.verifyHashes !== false;
  const bindings: MifPitReplayTimeframeBinding[] = [];
  const limitations: string[] = [];

  const manifests: MifResearchDatasetManifest[] = input.manifests
    ? [...input.manifests]
    : [];

  if (!input.manifests) {
    if (!storage) {
      return { ok: false, code: "STORAGE_REQUIRED", message: "storage required when manifests not injected" };
    }
    for (const ds of input.datasets) {
      const m = await storage.getDatasetManifest(ds.datasetId, ds.version);
      if (!m) {
        return {
          ok: false,
          code: "MANIFEST_MISSING",
          message: `missing ${ds.datasetId} v${ds.version}`,
        };
      }
      if (verifyHashes) {
        const v = await storage.verifyDatasetConsistency(ds.datasetId, ds.version);
        if (!v.ok) {
          return {
            ok: false,
            code: "HASH_VERIFY_FAILED",
            message: `${ds.datasetId}: ${v.code} ${v.message}`,
          };
        }
      }
      manifests.push(m);
    }
  }

  for (const m of manifests) {
    if (String(m.instrument).toUpperCase() !== instrument) {
      return {
        ok: false,
        code: "INSTRUMENT_MISMATCH",
        message: `dataset ${m.datasetId} instrument ${m.instrument} != ${instrument}`,
      };
    }
    if (m.status !== "COMPLETE") {
      return {
        ok: false,
        code: "INCOMPLETE_DATASET_EXCLUDED",
        message: `refusing incomplete dataset ${m.datasetId} status=${m.status}`,
      };
    }
    if (m.researchEligibility?.suitableForCandleResearch !== true) {
      return {
        ok: false,
        code: "NOT_SUITABLE",
        message: `dataset ${m.datasetId} not suitableForCandleResearch`,
      };
    }
    const tf = String(m.timeframe).toUpperCase();
    bindings.push({
      timeframe: tf,
      datasetId: m.datasetId,
      version: m.version,
      contentHash: m.contentHash,
      candleCount: m.candleCount,
      startTime: m.startTime,
      endTime: m.endTime,
      missingIntervalCount: (m.missingIntervals ?? []).length,
      missingIntervals: m.missingIntervals ?? [],
      suitableForCandleResearch: true,
      status: "COMPLETE",
    });
    if (m.qualitySummary?.sessionUncertainty) {
      limitations.push(`SESSION_UNCERTAINTY:${tf}`);
    }
    if ((m.missingIntervals ?? []).some((x) => x.classification === "UNKNOWN_SESSION_GAP")) {
      limitations.push(`UNKNOWN_SESSION_GAP:${tf}`);
    }
  }

  if (!bindings.some((b) => b.timeframe === primaryTimeframe)) {
    return {
      ok: false,
      code: "PRIMARY_TF_MISSING",
      message: `no binding for primaryTimeframe=${primaryTimeframe}`,
    };
  }

  bindings.sort((a, b) => a.timeframe.localeCompare(b.timeframe));

  const requestedStartTimeSec = input.requestedStartTimeSec ?? null;
  const requestedEndTimeSec = input.requestedEndTimeSec ?? null;
  const starts = bindings.map((b) => b.startTime).filter((t): t is number => t != null);
  const ends = bindings.map((b) => b.endTime).filter((t): t is number => t != null);
  const actualStartTimeSec = starts.length ? Math.max(...starts) : null;
  const actualEndTimeSec = ends.length ? Math.min(...ends) : null;

  const identity = {
    instrument,
    primaryTimeframe,
    decisionCutoffSec,
    requestedStartTimeSec,
    requestedEndTimeSec,
    bindings,
  };
  const contentIdentityHash = computePitReplayManifestContentIdentityHash(identity);
  const manifestId = computePitReplayManifestId(contentIdentityHash);
  const createdAt = input.createdAt ?? new Date().toISOString();

  const manifest: MifPitReplayInputManifest = {
    contractId: MIF_PIT_REPLAY_CONTRACT_ID,
    contractVersion: MIF_PIT_REPLAY_CONTRACT_VERSION,
    engineId: MIF_PIT_REPLAY_ENGINE_ID,
    engineVersion: MIF_PIT_REPLAY_ENGINE_VERSION,
    manifestPolicyId: MIF_PIT_REPLAY_MANIFEST_POLICY_ID,
    manifestPolicyVersion: MIF_PIT_REPLAY_MANIFEST_POLICY_VERSION,
    manifestId,
    contentIdentityHash,
    instrument,
    primaryTimeframe,
    timeframes: bindings,
    requestedStartTimeSec,
    requestedEndTimeSec,
    actualStartTimeSec,
    actualEndTimeSec,
    decisionCutoffSec,
    clipMode: "CLOSE_TIME_AT_DECISION",
    closeTimeVisibilityPolicyId: MIF_PIT_VISIBILITY_POLICY_ID,
    closeTimeVisibilityPolicyVersion: MIF_PIT_VISIBILITY_POLICY_VERSION,
    createdAt,
    status: "FROZEN",
    limitations: [...new Set(limitations)],
    ...SAFETY,
  };

  return { ok: true, manifest };
}
