/**
 * Phase 7 — per-scene entry point used by the cinematic render loop.
 * Reads the customer creative request, decides the cheapest path, and runs only the
 * operations that are needed. Returns the original photo whenever nothing was accepted.
 */

import fs from "node:fs/promises";
import path from "node:path";
import type { CapabilityRuntime } from "../admin-control-plane/capability-runtime.js";
import type { I2vIdentityConstraints } from "../video-production/i2v-prompt.js";
import type { ProductIdentityLock } from "../../desktop/product-identity-lock/types.js";
import { runVisionIdentityCheck } from "../pmv-qa/vision-identity-check.js";
import { decideImagePreparation, imagePrepFingerprint, needsImagePreparation } from "./decision.js";
import { describeImagePrepAvailability, runImagePreparation, type IdentityVerdict, type ImagePrepDeps } from "./pipeline.js";
import { imagePrepMaxAttempts, type ImagePreparationRecord } from "./types.js";
import { readDimensions } from "./validation.js";

export const PMV_SETTINGS_KEY = "productMarketingVideo";

export function readCreativeRequest(workspaceSettings: Record<string, unknown> | null | undefined): string {
  const pmv = workspaceSettings?.[PMV_SETTINGS_KEY];
  if (!pmv || typeof pmv !== "object") return "";
  const direction = (pmv as Record<string, unknown>).creativeDirection;
  if (!direction || typeof direction !== "object") return "";
  const value = (direction as Record<string, unknown>).creativeRequest;
  return typeof value === "string" ? value.slice(0, 600) : "";
}

function lockedIdentity(workspaceSettings: Record<string, unknown> | null | undefined): ProductIdentityLock | null {
  const raw = workspaceSettings?.productIdentityLock;
  if (!raw || typeof raw !== "object") return null;
  const lock = raw as ProductIdentityLock;
  return lock.status === "LOCKED" ? lock : null;
}

export interface ScenePreparationInput {
  root: string;
  projectId: string;
  sourceAssetId: string;
  sourcePath: string;
  workspaceSettings: Record<string, unknown> | null | undefined;
  identity: I2vIdentityConstraints | null;
  /** Normalized product region from framing analysis. */
  productRegion?: { x: number; y: number; width: number; height: number } | null;
  prior?: Record<string, ImagePreparationRecord> | null;
  runtime: CapabilityRuntime | null;
  ops: Pick<ImagePrepDeps, "readRaster" | "writeEditMask" | "reencodeJpeg">;
}

export interface ScenePreparationResult {
  imagePath: string;
  key: string | null;
  record: ImagePreparationRecord | null;
}

export async function prepareSceneImage(input: ScenePreparationInput): Promise<ScenePreparationResult> {
  const creativeRequest = readCreativeRequest(input.workspaceSettings);
  const bytes = await fs.readFile(input.sourcePath).catch(() => null);
  const dims = readDimensions(bytes);
  const availability = describeImagePrepAvailability(input.runtime);
  const decision = decideImagePreparation({
    generativeVideo: true,
    creativeRequest,
    sourceWidth: dims?.width ?? null,
    sourceHeight: dims?.height ?? null,
    editorAcceptsMask: availability.editorAcceptsMask,
  });
  if (!needsImagePreparation(decision)) {
    return { imagePath: input.sourcePath, key: null, record: null };
  }

  const fingerprint = imagePrepFingerprint(decision, availability.editorAcceptsMask);
  const key = `${input.sourceAssetId}:${fingerprint}`;
  const region = input.productRegion;
  const targetPoint = region
    ? { x: region.x + region.width / 2, y: region.y + region.height / 2 }
    : null;
  const lock = lockedIdentity(input.workspaceSettings);

  const verifyIdentity = lock
    ? async (filePath: string, mimeType: string): Promise<IdentityVerdict> => {
      const image = await fs.readFile(filePath);
      const result = await runVisionIdentityCheck({
        runtime: input.runtime,
        lock,
        projectId: input.projectId,
        imageBase64: image.toString("base64"),
        mimeType,
      });
      if (!result.onlineExecuted) return "UNAVAILABLE";
      return result.status;
    }
    : undefined;

  const outcome = await runImagePreparation(
    {
      key,
      fingerprint,
      projectId: input.projectId,
      sourceAssetId: input.sourceAssetId,
      sourcePath: input.sourcePath,
      outDir: path.join(input.root, "image-prep", input.projectId),
      decision,
      identity: input.identity,
      targetPoint,
      prior: input.prior?.[key] ?? null,
      maxAttempts: imagePrepMaxAttempts(),
    },
    { runtime: input.runtime, ...input.ops, verifyIdentity },
  );
  return { imagePath: outcome.imagePath, key, record: outcome.record };
}
