/**
 * STEP 6 ingest: original stays untouched; derived thumbnail is a separate asset.
 */
import type { CreativeProject, CreativeWorkspaceManager, ProductImage } from "../creative-workspace/creative-workspace-manager.js";
import { isOriginalProductImage } from "../creative-workspace/project-asset.js";
import { decodePngRgba, buildThumbnailPng } from "../creative-workspace/png-pixels.js";
import type { ImageIntelligenceManager } from "./image-intelligence-manager.js";

export interface IngestResult {
  originalId: string;
  thumbnailId?: string;
  thumbnailCreated: boolean;
  skippedReason?: string;
}

export async function ensureThumbnailAsset(
  workspace: CreativeWorkspaceManager,
  project: CreativeProject,
  image: ProductImage,
  bytes: Buffer | null,
): Promise<IngestResult> {
  if (!isOriginalProductImage(image)) {
    return { originalId: image.id, thumbnailCreated: false, skippedReason: "not-original" };
  }
  const latest = await workspace.getProject(project.id) ?? project;
  const existing = latest.productImages.find((item) => item.parentAssetId === image.id && item.derivedKind === "thumbnail");
  if (existing) {
    return { originalId: image.id, thumbnailId: existing.id, thumbnailCreated: false, skippedReason: "already-present" };
  }
  if (!bytes || image.mimeType !== "image/png") {
    return { originalId: image.id, thumbnailCreated: false, skippedReason: "pixel-thumbnail-unavailable" };
  }
  const decoded = decodePngRgba(bytes);
  if (!decoded) {
    return { originalId: image.id, thumbnailCreated: false, skippedReason: "png-decode-failed" };
  }
  const thumb = buildThumbnailPng(decoded);
  const derived = await workspace.registerDerivedAsset(project.id, {
    fileName: thumbnailName(image.fileName),
    mimeType: "image/png",
    dataBase64: thumb.png.toString("base64"),
    parentAssetId: image.id,
    assetType: "derived-image",
    derivedKind: "thumbnail",
  });
  return { originalId: image.id, thumbnailId: derived.id, thumbnailCreated: true };
}

export async function ingestUploadedImage(
  workspace: CreativeWorkspaceManager,
  intelligence: ImageIntelligenceManager,
  projectId: string,
  imageId: string,
): Promise<{ ingest: IngestResult; profileId?: string; error?: string }> {
  try {
    const profile = await intelligence.analyzeAsset(projectId, imageId);
    return {
      ingest: {
        originalId: imageId,
        thumbnailId: profile.derivedThumbnailId,
        thumbnailCreated: Boolean(profile.derivedThumbnailId),
      },
      profileId: profile.id,
    };
  } catch (error) {
    return {
      ingest: { originalId: imageId, thumbnailCreated: false, skippedReason: "failed" },
      error: error instanceof Error ? error.message : "Ingest failed",
    };
  }
}

function thumbnailName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "") || "image";
  return `${base}-thumb.png`;
}
