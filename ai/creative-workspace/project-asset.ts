/**
 * Stable project asset references for future Image/Video/Render engines.
 * Storage is always an API URL — never a raw filesystem path for clients.
 */

export type ProjectAssetType =
  | "original-image"
  | "derived-image"
  | "generated-image"
  | "video"
  | "audio"
  | "rendered"
  | "document";

export type AssetOrigin = "upload" | "derived" | "generated" | "system";
export type AssetProcessingStatus = "pending" | "processing" | "ready" | "failed";
export type AssetAnalysisState =
  | "pending"
  | "analyzing"
  | "ready"
  | "failed"
  | "unavailable"
  | "not-applicable";
export type DerivedImageKind = "thumbnail" | "preview" | "optimized" | "analyzed" | "mask" | "enhanced" | "generated";
export type AssetRole =
  | "primary"
  | "secondary"
  | "packaging"
  | "detail"
  | "lifestyle"
  | "generated"
  | "reference"
  | "unassigned";

export interface ProjectAssetRef {
  assetId: string;
  projectId: string;
  assetType: ProjectAssetType;
  originalFilename: string;
  storageRef: string;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  createdAt: string;
  processingStatus: AssetProcessingStatus;
  origin: AssetOrigin;
  parentAssetId?: string;
  checksumSha256?: string;
  analysisState?: AssetAnalysisState;
  derivedKind?: DerivedImageKind;
  assetRole?: AssetRole;
  metadata: Record<string, unknown>;
}

export interface ProjectFoundationLinks {
  memoryId: string | null;
  memoryStatus: "linked" | "unavailable" | "error";
  memoryMessage?: string;
  knowledgeScope: "project";
  knowledgeIds: string[];
  knowledgeStatus: "linked" | "unavailable" | "empty" | "error";
  knowledgeMessage?: string;
}

export function isSafeProjectId(projectId: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId);
}

/** Original uploaded product photographs only — never derived, generated, video, or final outputs. */
export function isOriginalProductImage(image: {
  origin?: string;
  assetType?: string;
  parentAssetId?: string;
  mimeType?: string;
  fileName?: string;
  sourceFileName?: string;
}): boolean {
  if (image.parentAssetId) return false;
  if (image.origin === "derived" || image.origin === "generated") return false;
  if (image.assetType === "derived-image" || image.assetType === "generated-image") return false;
  if (image.assetType === "video" || image.assetType === "audio" || image.assetType === "rendered") return false;
  const mime = (image.mimeType ?? "").toLowerCase();
  if (mime.startsWith("video/") || mime.startsWith("audio/")) return false;
  const names = `${image.fileName ?? ""} ${image.sourceFileName ?? ""}`.toLowerCase();
  if (/\.(mp4|webm|mov|mkv|avi|mp3|wav)(\b|$)/.test(names)) return false;
  if (/product-video/.test(names)) return false;
  return true;
}

export function listOriginalProductImages<T extends Parameters<typeof isOriginalProductImage>[0]>(images: T[]): T[] {
  return images.filter(isOriginalProductImage);
}

export type AssetBucket = "original" | "processed" | "production" | "final";

/** Separate source photographs from processed derivatives, production clips, and final video outputs. */
export function classifyAssetBucket(image: Parameters<typeof isOriginalProductImage>[0] & {
  derivedKind?: string;
}): AssetBucket {
  const mime = (image.mimeType ?? "").toLowerCase();
  const names = `${image.fileName ?? ""} ${image.sourceFileName ?? ""}`.toLowerCase();
  if (
    image.assetType === "video"
    || image.assetType === "rendered"
    || mime.startsWith("video/")
    || /\.(mp4|webm|mov|mkv)(\b|$)/.test(names)
    || /product-video/.test(names)
  ) {
    return "final";
  }
  if (image.assetType === "audio" || mime.startsWith("audio/")) return "production";
  if (!isOriginalProductImage(image)) return "processed";
  return "original";
}

export class CreativeWorkspaceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus = 400,
  ) {
    super(message);
    this.name = "CreativeWorkspaceError";
  }
}
