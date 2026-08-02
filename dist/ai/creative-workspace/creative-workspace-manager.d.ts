import type { AiCoreManager } from "../core/ai-core-manager.js";
export interface ProductInformation {
    name: string;
    category: string;
    description: string;
    sku?: string;
}
export interface BrandInformation {
    name: string;
    website?: string;
    voice?: string;
    guidelines?: string;
}
export interface CampaignInformation {
    name: string;
    objective: string;
    callToAction?: string;
    notes?: string;
}
export interface ProductImage {
    id: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    uploadedAt: string;
    url: string;
}
export interface CreativeProject {
    id: string;
    name: string;
    createdAt: string;
    modifiedAt: string;
    productImages: ProductImage[];
    productInformation: ProductInformation;
    brandInformation: BrandInformation;
    campaignInformation: CampaignInformation;
    targetAudience: string;
    language: string;
    platform: string;
    workspaceSettings: Record<string, unknown>;
}
export interface ValidationResult {
    valid: boolean;
    errors: string[];
}
export interface UploadedImageInput {
    fileName: string;
    mimeType: string;
    dataBase64: string;
}
/**
 * Creative Workspace Manager owns Step 1 project inputs only. It deliberately
 * has no generation, prompt, rendering, or export responsibilities.
 */
export declare class CreativeWorkspaceManager {
    private core;
    private root;
    private index;
    initialize(storageRoot: string, core?: AiCoreManager): Promise<void>;
    createProject(name: string): Promise<CreativeProject>;
    listProjects(): Promise<CreativeProject[]>;
    getProject(projectId: string): Promise<CreativeProject | null>;
    getActiveProject(): Promise<CreativeProject | null>;
    openProject(projectId: string): Promise<CreativeProject>;
    updateProject(projectId: string, changes: Partial<Omit<CreativeProject, "id" | "createdAt" | "modifiedAt" | "productImages">>): Promise<CreativeProject>;
    uploadImage(projectId: string, image: UploadedImageInput): Promise<ProductImage>;
    getImagePath(projectId: string, imageFile: string): Promise<string | null>;
    validate(project: CreativeProject | null): ValidationResult;
    getIntegrationStatus(): Record<string, boolean>;
    private persist;
    private transition;
    private requireProject;
    private saveIndex;
    private readJson;
    private writeJson;
    private ensureInitialized;
    private indexPath;
    private projectPath;
    private projectFile;
}
//# sourceMappingURL=creative-workspace-manager.d.ts.map