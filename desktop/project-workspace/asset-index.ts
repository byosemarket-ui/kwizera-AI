import type { AssetKind, AssetRecord, WorkspacePayload } from "./types";

const assetLabels: Record<AssetKind, string> = {
  product: "Product image", generated: "Generated image", video: "Video", audio: "Audio", logo: "Logo", document: "Document", ai: "AI asset", marketing: "Marketing asset", export: "Export file",
};

export class AssetIndexManager {
  build(payload: WorkspacePayload, favorites: Set<string>): AssetRecord[] {
    return payload.projects.flatMap((project) => project.productImages.map((image) => ({
      id: image.id,
      projectId: project.id,
      name: image.fileName,
      type: "product" as const,
      category: project.productInformation.category || "Product media",
      sizeBytes: image.sizeBytes,
      createdAt: image.uploadedAt,
      modifiedAt: image.uploadedAt,
      mimeType: image.mimeType,
      url: image.url,
      tags: ["product", ...(project.productInformation.category ? [project.productInformation.category] : [])],
      status: "ready" as const,
      aiGenerated: false,
      favorite: favorites.has(image.id),
      resolution: "Source resolution",
    }))).sort((left, right) => right.modifiedAt.localeCompare(left.modifiedAt));
  }

  label(type: AssetKind): string { return assetLabels[type]; }
}