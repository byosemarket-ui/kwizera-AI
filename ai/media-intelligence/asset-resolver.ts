/**
 * Resolve production image paths — original preserved, derived foreground preferred when ready.
 */
import type { CreativeWorkspaceManager } from "../creative-workspace/creative-workspace-manager.js";
import { isOriginalProductImage } from "../creative-workspace/project-asset.js";
import type { ProductionImageResolution } from "./types.js";

export interface ResolveProductionImageOptions {
  /** When true, use isolated foreground derived asset if available and quality-ready. */
  preferDerivedForeground?: boolean;
}

/**
 * Timeline clips reference original asset IDs. This resolver maps an original assetId
 * to the best filesystem path for FFmpeg rendering without modifying originals.
 */
export async function resolveProductionImagePath(
  workspace: CreativeWorkspaceManager,
  projectId: string,
  originalAssetId: string,
  options: ResolveProductionImageOptions = {},
): Promise<ProductionImageResolution | null> {
  const preferDerived = options.preferDerivedForeground !== false;
  const project = await workspace.getProject(projectId);
  if (!project) return null;

  const original = project.productImages.find((item) => item.id === originalAssetId);
  if (!original || !isOriginalProductImage(original)) return null;

  if (preferDerived) {
    const foreground = project.productImages.find(
      (item) => item.parentAssetId === originalAssetId
        && item.origin === "derived"
        && item.derivedKind === "analyzed"
        && item.processingStatus === "ready",
    );
    if (foreground) {
      const derivedPath = await workspace.getImagePath(
        projectId,
        `${foreground.id}.${extensionForMime(foreground.mimeType)}`,
      );
      if (derivedPath) {
        return {
          path: derivedPath,
          source: "derived-foreground",
          assetId: foreground.id,
          parentAssetId: originalAssetId,
        };
      }
    }
  }

  const originalPath = await workspace.getOriginalImagePath(projectId, originalAssetId);
  if (!originalPath) return null;
  return {
    path: originalPath,
    source: "original",
    assetId: originalAssetId,
    parentAssetId: originalAssetId,
  };
}

function extensionForMime(mimeType: string): string {
  if (mimeType === "image/jpeg") return "jpeg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return mimeType.split("/")[1] ?? "png";
}
