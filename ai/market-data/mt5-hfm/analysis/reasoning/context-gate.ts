/**
 * Phase 3 pre-OpenAI gate: load + verify Phase 2 context and images.
 */
import { createHash } from "node:crypto";
import {
  HFM_ANALYSIS_DEFAULT_TF_PACK,
  HFM_ANALYSIS_PROVIDER,
} from "../constants.js";
import { validateChartImageIdentity } from "../image-identity.js";
import { getHfmAnalysisStorage } from "../storage.js";
import type { HfmAnalysisContextResult } from "../types.js";
import {
  HFM_REASONING_MAX_CONTEXT_AGE_HOURS,
  HFM_REASONING_REQUIRED_TFS,
} from "./constants.js";
import type { HfmReasoningErrorCode, HfmReasoningImageRef } from "./types.js";

export interface HfmReasoningPreparedEvidence {
  context: HfmAnalysisContextResult;
  contextId: string;
  snapshotId: string;
  snapshotHash: string;
  symbol: string;
  imageRefs: HfmReasoningImageRef[];
  images: Array<{ timeframe: string; mimeType: string; base64: string; imageId: string }>;
}

export type HfmReasoningGateResult =
  | { ok: true; evidence: HfmReasoningPreparedEvidence }
  | { ok: false; code: HfmReasoningErrorCode; message: string };

export async function loadAndValidateHfmReasoningContext(
  contextIdRaw: string,
): Promise<HfmReasoningGateResult> {
  const contextId = String(contextIdRaw || "").trim();
  if (!contextId) {
    return { ok: false, code: "CONTEXT_NOT_FOUND", message: "contextId is required" };
  }

  const storage = getHfmAnalysisStorage();
  const context = await storage.loadContext(contextId);
  if (!context || !context.snapshot) {
    return { ok: false, code: "CONTEXT_NOT_FOUND", message: "Phase 2 context not found" };
  }

  const snap = context.snapshot;
  if (snap.provider !== HFM_ANALYSIS_PROVIDER) {
    return { ok: false, code: "PROVIDER_MISMATCH", message: `provider ${snap.provider} rejected` };
  }
  if (snap.snapshotId !== contextId) {
    return {
      ok: false,
      code: "SNAPSHOT_HASH_MISMATCH",
      message: "stored snapshotId does not match request contextId",
    };
  }
  if (!snap.snapshotHash || snap.snapshotHash.length < 32) {
    return { ok: false, code: "SNAPSHOT_HASH_MISMATCH", message: "snapshotHash missing" };
  }
  if (!snap.dataQuality?.approvedForAiReasoning || snap.dataQuality.status !== "VALID") {
    return {
      ok: false,
      code: "AI_NOT_APPROVED",
      message: `Context quality ${snap.dataQuality?.status ?? "unknown"} is not approved for AI reasoning`,
    };
  }
  if (snap.synchronization.status === "INVALID" || snap.synchronization.status === "INCOMPLETE") {
    return {
      ok: false,
      code: "TIMEFRAME_NOT_SYNCHRONIZED",
      message: `synchronization status ${snap.synchronization.status}`,
    };
  }

  const ageMs = Date.now() - Date.parse(snap.capturedAt);
  if (!Number.isFinite(ageMs) || ageMs < 0) {
    return { ok: false, code: "CONTEXT_NOT_VALID", message: "capturedAt invalid" };
  }
  if (ageMs > HFM_REASONING_MAX_CONTEXT_AGE_HOURS * 3600_000) {
    return {
      ok: false,
      code: "CONTEXT_TOO_OLD",
      message: `Context older than ${HFM_REASONING_MAX_CONTEXT_AGE_HOURS}h`,
    };
  }

  for (const tf of HFM_REASONING_REQUIRED_TFS) {
    const ds = snap.timeframes[tf];
    if (!ds || ds.candleCount < 1 || !ds.historical.length) {
      return { ok: false, code: "TIMEFRAME_DATA_MISSING", message: `Missing timeframe ${tf}` };
    }
    if (ds.symbol.toUpperCase() !== snap.symbol.toUpperCase()) {
      return { ok: false, code: "SYMBOL_MISMATCH", message: `${tf} symbol mismatch` };
    }
  }

  const imageRefs: HfmReasoningImageRef[] = [];
  const images: HfmReasoningPreparedEvidence["images"] = [];

  for (const tf of HFM_REASONING_REQUIRED_TFS) {
    const meta = context.chartImages[tf];
    if (!meta) {
      return { ok: false, code: "IMAGE_MISSING", message: `Missing chart image for ${tf}` };
    }
    if (meta.validationStatus !== "ok") {
      return { ok: false, code: "IMAGE_VALIDATION_FAILED", message: `${tf} image validationStatus=${meta.validationStatus}` };
    }
    const loaded = await storage.loadImage(meta.imageId);
    if (!loaded) {
      return { ok: false, code: "IMAGE_MISSING", message: `Image bytes missing for ${tf}` };
    }
    const hash = createHash("sha256").update(loaded.png).digest("hex");
    if (hash !== meta.imageHash || hash !== loaded.meta.imageHash) {
      return { ok: false, code: "IMAGE_IDENTITY_MISMATCH", message: `${tf} imageHash mismatch` };
    }
    const identity = validateChartImageIdentity({
      meta: loaded.meta,
      png: loaded.png,
      snapshot: snap,
      timeframe: tf,
    });
    if (!identity.ok) {
      return {
        ok: false,
        code: "IMAGE_IDENTITY_MISMATCH",
        message: `${tf}: ${identity.errors.join("; ")}`,
      };
    }
    if (loaded.meta.symbol.toUpperCase() !== snap.symbol.toUpperCase()) {
      return { ok: false, code: "SYMBOL_MISMATCH", message: `${tf} image symbol mismatch` };
    }
    if (loaded.meta.snapshotId !== snap.snapshotId || loaded.meta.snapshotHash !== snap.snapshotHash) {
      return { ok: false, code: "IMAGE_IDENTITY_MISMATCH", message: `${tf} image snapshot mismatch` };
    }

    imageRefs.push({
      timeframe: tf,
      imageId: meta.imageId,
      imageHash: meta.imageHash,
      snapshotId: meta.snapshotId,
      snapshotHash: meta.snapshotHash,
      validationStatus: meta.validationStatus,
    });
    images.push({
      timeframe: tf,
      mimeType: "image/png",
      base64: loaded.png.toString("base64"),
      imageId: meta.imageId,
    });
  }

  // Ensure pack order matches default analysis pack.
  void HFM_ANALYSIS_DEFAULT_TF_PACK;

  return {
    ok: true,
    evidence: {
      context,
      contextId: snap.snapshotId,
      snapshotId: snap.snapshotId,
      snapshotHash: snap.snapshotHash,
      symbol: snap.symbol.toUpperCase(),
      imageRefs,
      images,
    },
  };
}
