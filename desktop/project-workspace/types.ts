export type AssetKind = "product" | "generated" | "video" | "audio" | "logo" | "document" | "ai" | "marketing" | "export";

export interface WorkspaceProject {
  id: string;
  name: string;
  createdAt: string;
  modifiedAt: string;
  status?: "open" | "closed";
  productImages: Array<{
    id: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    uploadedAt: string;
    url: string;
    width?: number;
    height?: number;
    assetType?: string;
    origin?: string;
    parentAssetId?: string;
  }>;
  productInformation: { name: string; category: string };
  foundation?: {
    memoryStatus?: string;
    knowledgeStatus?: string;
    memoryId?: string | null;
  };
}

export interface AssetRecord {
  id: string;
  projectId: string;
  name: string;
  type: AssetKind;
  category: string;
  sizeBytes: number;
  createdAt: string;
  modifiedAt: string;
  mimeType: string;
  url?: string;
  tags: string[];
  status: "ready" | "processing" | "draft";
  aiGenerated: boolean;
  favorite: boolean;
  resolution?: string;
  duration?: string;
}

export interface WorkspacePayload {
  activeProject: WorkspaceProject | null;
  projects: WorkspaceProject[];
  integrations: Record<string, boolean>;
}

export type AssetView = "grid" | "list" | "thumbnail";