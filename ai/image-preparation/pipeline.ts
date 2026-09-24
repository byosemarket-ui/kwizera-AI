/**
 * Phase 7 — conditional image preparation pipeline.
 * SEGMENTATION → mask validation → EDITING → validation → ENHANCEMENT → validation.
 * Every operation goes through CapabilityRuntime (Admin feature mapping → provider → credential → adapter).
 * Originals are never modified; each stage writes a new derived file and records its input (lineage).
 */

import fs from "node:fs/promises";
import path from "node:path";
import type { CapabilityRuntime } from "../admin-control-plane/capability-runtime.js";
import type { FeatureKey } from "../admin-control-plane/types.js";
import type { I2vIdentityConstraints } from "../video-production/i2v-prompt.js";
import { buildImageEditPrompt } from "./edit-prompt.js";
import {
  ENHANCEMENT_MAX_DELTA,
  PRODUCT_REGION_MAX_DELTA,
  rasterDelta,
  readDimensions,
  validateDerivedImage,
  validateMask,
  type Dimensions,
} from "./validation.js";
import {
  IMAGE_PREP_CAPABILITY,
  type ImagePrepAvailability,
  type ImagePrepDecision,
  type ImagePrepIdentityStatus,
  type ImagePrepOperation,
  type ImagePrepStageRecord,
  type ImagePreparationRecord,
} from "./types.js";

export type IdentityVerdict = "PASS" | "FAIL" | "UNCERTAIN" | "UNAVAILABLE";

export interface ImagePrepDeps {
  runtime: CapabilityRuntime | null;
  readRaster: (filePath: string) => Promise<Uint8Array | null>;
  writeEditMask: (productMaskPath: string, outputPath: string, inverted: boolean) => Promise<boolean>;
  reencodeJpeg: (inputPath: string, outputPath: string) => Promise<boolean>;
  /** Admin-routed VISION_ANALYSIS identity check; returns UNAVAILABLE when not configured. */
  verifyIdentity?: (filePath: string, mimeType: string) => Promise<IdentityVerdict>;
  now?: () => string;
}

export interface ImagePrepInput {
  key: string;
  fingerprint: string;
  projectId: string;
  sourceAssetId: string;
  sourcePath: string;
  outDir: string;
  decision: ImagePrepDecision;
  identity: I2vIdentityConstraints | null;
  /** Normalized 0..1 product target (defaults to frame center). */
  targetPoint?: { x: number; y: number } | null;
  prior?: ImagePreparationRecord | null;
  maxAttempts: number;
}

export interface ImagePrepOutcome {
  record: ImagePreparationRecord;
  /** Path handed to I2V (original when nothing was accepted). */
  imagePath: string;
}

const I2V_UPLOAD_MAX_BYTES = 5_500_000;

function mimeFromPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

async function readFileOrNull(filePath: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(filePath);
  } catch {
    return null;
  }
}

async function fileUsable(filePath: string): Promise<boolean> {
  const stat = await fs.stat(filePath).catch(() => null);
  return Boolean(stat?.isFile() && stat.size > 128);
}

export function describeImagePrepAvailability(runtime: CapabilityRuntime | null): ImagePrepAvailability {
  const online = (feature: FeatureKey) => {
    if (!runtime) return { ok: false, acceptsMask: false };
    try {
      const view = runtime.describe(feature);
      return {
        ok: view.source === "ONLINE" && (view.status === "READY" || view.status === "FALLBACK"),
        acceptsMask: view.acceptsMask === true,
      };
    } catch {
      return { ok: false, acceptsMask: false };
    }
  };
  const editing = online("IMAGE_EDITING");
  return {
    segmentation: online("IMAGE_SEGMENTATION").ok,
    editing: editing.ok,
    enhancement: online("IMAGE_UPSCALE").ok,
    editorAcceptsMask: editing.ok && editing.acceptsMask,
  };
}

function newStage(
  operation: ImagePrepOperation,
  inputRef: string,
  maxAttempts: number,
  at: string,
): ImagePrepStageRecord {
  return {
    operation,
    capability: IMAGE_PREP_CAPABILITY[operation],
    status: "REJECTED",
    attempts: 0,
    maxAttempts,
    inputRef,
    outputFileName: null,
    onlineExecuted: false,
    identityStatus: null,
    width: null,
    height: null,
    issues: [],
    history: [],
    updatedAt: at,
  };
}

function customerSafeReason(message: string | undefined, code: string | undefined): string {
  const text = String(message ?? "").trim();
  if (!text || /fal|flux|sam|esrgan|replicate|openai|api.?key|token|secret|credential|http/i.test(text)) {
    return code ? `Operation failed (${code})` : "Operation failed";
  }
  return text.slice(0, 160);
}

type AttemptResult =
  | { ok: true; outputPath: string; dims: Dimensions; identity: ImagePrepIdentityStatus | null; maskInverted?: boolean }
  | { ok: false; reason: string; issues: string[] };

export async function runImagePreparation(input: ImagePrepInput, deps: ImagePrepDeps): Promise<ImagePrepOutcome> {
  const now = deps.now ?? (() => new Date().toISOString());
  const at = now();
  const availability = describeImagePrepAvailability(deps.runtime);
  const prior = input.prior && input.prior.key === input.key ? input.prior : null;
  const decisionView: ImagePreparationRecord["decision"] = {
    segmentationRequired: input.decision.segmentationRequired,
    imageEditingRequired: input.decision.imageEditingRequired,
    enhancementRequired: input.decision.enhancementRequired,
    upscaleFactor: input.decision.upscaleFactor,
    reasonCodes: input.decision.reasonCodes,
    rejectedInstructionCount: input.decision.rejectedInstructionCount,
  };
  const record: ImagePreparationRecord = prior
    ? { ...prior, decision: decisionView, stages: { ...prior.stages }, updatedAt: at }
    : {
      key: input.key,
      projectId: input.projectId,
      sourceAssetId: input.sourceAssetId,
      fingerprint: input.fingerprint,
      decision: decisionView,
      stages: {},
      finalFileName: null,
      finalSource: "ORIGINAL",
      fallbackUsed: false,
      createdAt: at,
      updatedAt: at,
    };

  await fs.mkdir(input.outDir, { recursive: true });
  const sourceBytes = await readFileOrNull(input.sourcePath);
  const sourceDims = readDimensions(sourceBytes);
  const originalRef = `original:${input.sourceAssetId}`;
  let current = { path: input.sourcePath, ref: originalRef, dims: sourceDims };
  let fallbackUsed = false;
  let productMask: { path: string; inverted: boolean; raster: Uint8Array | null } | null = null;
  const point = input.targetPoint ?? { x: 0.5, y: 0.5 };

  const runStage = async (
    operation: ImagePrepOperation,
    inputRef: string,
    attemptFn: (attempt: number) => Promise<AttemptResult>,
  ): Promise<ImagePrepStageRecord> => {
    const existing = record.stages[operation];
    if (existing && existing.inputRef === inputRef) {
      if (existing.status === "ACCEPTED" && existing.outputFileName
        && await fileUsable(path.join(input.outDir, existing.outputFileName))) {
        return existing;
      }
      if (existing.attempts >= existing.maxAttempts) {
        const exhausted = { ...existing, status: "REJECTED" as const, updatedAt: now() };
        record.stages[operation] = exhausted;
        return exhausted;
      }
    }
    const stage = existing && existing.inputRef === inputRef
      ? { ...existing, history: [...existing.history], issues: [] as string[] }
      : newStage(operation, inputRef, input.maxAttempts, now());
    stage.maxAttempts = input.maxAttempts;
    while (stage.attempts < stage.maxAttempts) {
      stage.attempts += 1;
      const result = await attemptFn(stage.attempts);
      stage.onlineExecuted = true;
      if (result.ok) {
        stage.status = "ACCEPTED";
        stage.outputFileName = path.basename(result.outputPath);
        stage.width = result.dims.width;
        stage.height = result.dims.height;
        stage.identityStatus = result.identity;
        if (result.maskInverted !== undefined) stage.maskInverted = result.maskInverted;
        stage.issues = [];
        stage.history.push({ attempt: stage.attempts, result: "ACCEPTED", reason: "Validated", at: now() });
        break;
      }
      stage.status = "REJECTED";
      stage.outputFileName = null;
      stage.issues = result.issues;
      stage.history.push({ attempt: stage.attempts, result: "FAILED", reason: result.reason, at: now() });
    }
    stage.updatedAt = now();
    record.stages[operation] = stage;
    return stage;
  };

  const execute = async (
    operation: ImagePrepOperation,
    attempt: number,
    extra: Parameters<CapabilityRuntime["execute"]>[1],
  ): Promise<{ ok: true; outputPath: string } | { ok: false; reason: string }> => {
    const runtime = deps.runtime;
    if (!runtime) return { ok: false, reason: "Capability runtime unavailable" };
    const ext = operation === "EDITING" ? "jpg" : "png";
    const outputPath = path.join(
      input.outDir,
      `${input.sourceAssetId}-${input.fingerprint}-${operation.toLowerCase()}-a${attempt}.${ext}`,
    );
    const result = await runtime.execute(IMAGE_PREP_CAPABILITY[operation], {
      ...extra,
      outputPath,
      projectId: input.projectId,
      sourceAssetId: input.sourceAssetId,
    });
    if (!result.ok) return { ok: false, reason: customerSafeReason(result.errorMessage, result.errorCode) };
    const written = (result.output as { imagePath?: unknown } | undefined)?.imagePath;
    const finalPath = typeof written === "string" && written.trim() ? written.trim() : outputPath;
    return { ok: true, outputPath: finalPath };
  };

  const identityCheck = async (filePath: string): Promise<IdentityVerdict> => {
    if (!deps.verifyIdentity) return "UNAVAILABLE";
    try {
      return await deps.verifyIdentity(filePath, mimeFromPath(filePath));
    } catch {
      return "UNCERTAIN";
    }
  };

  if (!sourceDims || !sourceBytes) {
    record.fallbackUsed = true;
    record.finalFileName = null;
    record.finalSource = "ORIGINAL";
    return { record, imagePath: input.sourcePath };
  }

  // ── EDITING (with optional SEGMENTATION) ─────────────────────────────
  if (input.decision.imageEditingRequired) {
    if (!availability.editing) {
      record.stages.EDITING = { ...newStage("EDITING", originalRef, input.maxAttempts, now()), status: "SKIPPED_UNAVAILABLE" };
      fallbackUsed = true;
    } else {
      let editBlocked = false;
      if (input.decision.segmentationRequired) {
        if (!availability.segmentation) {
          record.stages.SEGMENTATION = {
            ...newStage("SEGMENTATION", originalRef, input.maxAttempts, now()),
            status: "SKIPPED_UNAVAILABLE",
          };
          editBlocked = true;
        } else {
          const seg = await runStage("SEGMENTATION", originalRef, async (attempt) => {
            const run = await execute("SEGMENTATION", attempt, {
              mode: "image-segmentation",
              images: [{ mimeType: mimeFromPath(input.sourcePath), base64: sourceBytes.toString("base64") }],
              targetPoint: { x: point.x * sourceDims.width, y: point.y * sourceDims.height },
            });
            if (!run.ok) return { ok: false, reason: run.reason, issues: [run.reason] };
            const maskBytes = await readFileOrNull(run.outputPath);
            const maskDims = readDimensions(maskBytes);
            const raster = await deps.readRaster(run.outputPath);
            const validation = validateMask({ source: sourceDims, mask: maskDims, raster, targetPoint: point });
            if (!validation.ok || !maskDims) {
              return { ok: false, reason: validation.issues[0] ?? "Mask rejected", issues: validation.issues };
            }
            return { ok: true, outputPath: run.outputPath, dims: maskDims, identity: null, maskInverted: validation.inverted };
          });
          if (seg.status === "ACCEPTED" && seg.outputFileName) {
            const maskPath = path.join(input.outDir, seg.outputFileName);
            productMask = { path: maskPath, inverted: seg.maskInverted === true, raster: await deps.readRaster(maskPath) };
          } else {
            editBlocked = true;
          }
        }
      }

      if (editBlocked && availability.editorAcceptsMask) {
        record.stages.EDITING = {
          ...newStage("EDITING", originalRef, input.maxAttempts, now()),
          status: "BLOCKED",
          issues: ["Product mask unavailable — mask-guided edit skipped to protect the product"],
        };
        fallbackUsed = true;
      } else {
        const editRef = productMask ? `${originalRef}+mask:${path.basename(productMask.path)}` : originalRef;
        let editMaskPath: string | null = null;
        if (productMask) {
          editMaskPath = path.join(input.outDir, `${input.sourceAssetId}-${input.fingerprint}-editmask.png`);
          if (!(await deps.writeEditMask(productMask.path, editMaskPath, productMask.inverted))) editMaskPath = null;
        }
        const editMaskBytes = editMaskPath ? await readFileOrNull(editMaskPath) : null;
        const sourceRaster = productMask ? await deps.readRaster(input.sourcePath) : null;
        const edit = await runStage("EDITING", editRef, async (attempt) => {
          const run = await execute("EDITING", attempt, {
            mode: "image-editing",
            prompt: buildImageEditPrompt({
              request: input.decision.editRequest,
              identity: input.identity,
              maskGuided: Boolean(editMaskBytes),
            }),
            images: [{ mimeType: mimeFromPath(input.sourcePath), base64: sourceBytes.toString("base64") }],
            maskImage: editMaskBytes ? { mimeType: "image/png", base64: editMaskBytes.toString("base64") } : undefined,
            seed: 1000 + attempt,
          });
          if (!run.ok) return { ok: false, reason: run.reason, issues: [run.reason] };
          const bytes = await readFileOrNull(run.outputPath);
          const validation = validateDerivedImage({ bytes, source: sourceDims });
          if (!validation.ok || !validation.dimensions) {
            return { ok: false, reason: validation.issues[0] ?? "Edited image rejected", issues: validation.issues };
          }
          let identity: ImagePrepIdentityStatus = "NOT_VERIFIED";
          if (productMask?.raster && sourceRaster) {
            const editedRaster = await deps.readRaster(run.outputPath);
            const delta = editedRaster
              ? rasterDelta(sourceRaster, editedRaster, { raster: productMask.raster, inverted: productMask.inverted })
              : null;
            if (delta === null) {
              return { ok: false, reason: "Product region could not be compared", issues: ["Product region could not be compared"] };
            }
            if (delta > PRODUCT_REGION_MAX_DELTA) {
              return { ok: false, reason: "Product pixels changed during editing", issues: [`Product region delta ${delta.toFixed(1)}`] };
            }
            identity = "DETERMINISTIC_PASS";
          }
          const verdict = await identityCheck(run.outputPath);
          if (verdict === "FAIL") {
            return { ok: false, reason: "Product identity check failed", issues: ["Product identity check failed"] };
          }
          if (verdict === "PASS") identity = "ONLINE_PASS";
          else if (verdict === "UNCERTAIN" && identity !== "DETERMINISTIC_PASS") identity = "UNCERTAIN";
          return { ok: true, outputPath: run.outputPath, dims: validation.dimensions, identity };
        });
        if (edit.status === "ACCEPTED" && edit.outputFileName) {
          const editedPath = path.join(input.outDir, edit.outputFileName);
          current = { path: editedPath, ref: edit.outputFileName, dims: { width: edit.width!, height: edit.height! } };
        } else {
          fallbackUsed = true;
        }
      }
    }
  }

  // ── ENHANCEMENT ───────────────────────────────────────────────────────
  if (input.decision.enhancementRequired && current.dims) {
    if (!availability.enhancement) {
      record.stages.ENHANCEMENT = {
        ...newStage("ENHANCEMENT", current.ref, input.maxAttempts, now()),
        status: "SKIPPED_UNAVAILABLE",
      };
      fallbackUsed = true;
    } else {
      const inputPath = current.path;
      const inputDims = current.dims;
      const inputBytes = await readFileOrNull(inputPath);
      const enhance = inputBytes ? await runStage("ENHANCEMENT", current.ref, async (attempt) => {
        const run = await execute("ENHANCEMENT", attempt, {
          mode: "image-enhancement",
          images: [{ mimeType: mimeFromPath(inputPath), base64: inputBytes.toString("base64") }],
          upscaleFactor: input.decision.upscaleFactor ?? 2,
        });
        if (!run.ok) return { ok: false, reason: run.reason, issues: [run.reason] };
        const bytes = await readFileOrNull(run.outputPath);
        const validation = validateDerivedImage({ bytes, source: inputDims, expectLarger: true, aspectTolerance: 0.02 });
        if (!validation.ok || !validation.dimensions) {
          return { ok: false, reason: validation.issues[0] ?? "Enhanced image rejected", issues: validation.issues };
        }
        const before = await deps.readRaster(inputPath);
        const after = await deps.readRaster(run.outputPath);
        const delta = before && after ? rasterDelta(before, after) : null;
        if (delta === null || delta > ENHANCEMENT_MAX_DELTA) {
          return { ok: false, reason: "Enhancement changed image content", issues: ["Enhancement changed image content"] };
        }
        let identity: ImagePrepIdentityStatus = "DETERMINISTIC_PASS";
        const verdict = await identityCheck(run.outputPath);
        if (verdict === "FAIL") {
          return { ok: false, reason: "Product identity check failed", issues: ["Product identity check failed"] };
        }
        if (verdict === "PASS") identity = "ONLINE_PASS";
        return { ok: true, outputPath: run.outputPath, dims: validation.dimensions, identity };
      }) : null;
      if (enhance?.status === "ACCEPTED" && enhance.outputFileName) {
        current = {
          path: path.join(input.outDir, enhance.outputFileName),
          ref: enhance.outputFileName,
          dims: { width: enhance.width!, height: enhance.height! },
        };
      } else {
        fallbackUsed = true;
      }
    }
  }

  // ── FINAL ─────────────────────────────────────────────────────────────
  let finalPath = current.path;
  if (current.ref !== originalRef) {
    const stat = await fs.stat(finalPath).catch(() => null);
    if (stat && stat.size > I2V_UPLOAD_MAX_BYTES) {
      const compact = path.join(input.outDir, `${input.sourceAssetId}-${input.fingerprint}-i2v.jpg`);
      if (await deps.reencodeJpeg(finalPath, compact)) finalPath = compact;
    }
  }
  record.finalFileName = current.ref === originalRef ? null : path.basename(finalPath);
  record.finalSource = current.ref === originalRef ? "ORIGINAL" : "PREPARED";
  record.fallbackUsed = fallbackUsed;
  record.updatedAt = now();
  return { record, imagePath: finalPath };
}
