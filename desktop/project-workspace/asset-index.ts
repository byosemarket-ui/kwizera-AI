import type { AssetKind, AssetRecord, WorkspacePayload } from "./types";

const assetLabels: Record<AssetKind, string> = {
  product: "Product image", generated: "Generated image", video: "Video", audio: "Audio", logo: "Logo", document: "Document", ai: "AI asset", marketing: "Marketing asset", export: "Export file",
};

export class AssetIndexManager {
  build(payload: WorkspacePayload, favorites: Set<string>, scope: "active" | "all" = "active"): AssetRecord[] {
    const projects = scope === "all"
      ? payload.projects
      : payload.activeProject
        ? [payload.activeProject]
        : [];
    return projects.flatMap((project) => project.productImages.map((image) => ({
      id: image.id,
      projectId: project.id,
      name: image.fileName,
      type: ((image as { assetType?: string }).assetType === "generated-image" ? "generated"
        : (image as { assetType?: string }).assetType === "video" ? "video"
        : (image as { assetType?: string }).assetType === "audio" ? "audio"
        : (image as { assetType?: string }).assetType === "rendered" ? "export"
        : "product") as AssetKind,
      category: project.productInformation.category || "Product media",
      sizeBytes: image.sizeBytes,
      createdAt: image.uploadedAt,
      modifiedAt: image.uploadedAt,
      mimeType: image.mimeType,
      url: image.url,
      tags: ["product", ...(project.productInformation.category ? [project.productInformation.category] : [])],
      status: "ready" as const,
      aiGenerated: (image as { origin?: string }).origin === "generated",
      favorite: favorites.has(image.id),
      resolution: image.width && image.height ? `${image.width}×${image.height}` : "Source resolution",
    }))).sort((left, right) => right.modifiedAt.localeCompare(left.modifiedAt));
  }

  label(type: AssetKind): string { return assetLabels[type]; }
}