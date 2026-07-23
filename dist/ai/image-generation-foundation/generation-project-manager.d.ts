import { ImageGenerationPlatformTarget, ImageGenerationProjectRegistration, ImageGenerationResolutionTarget } from "./types.js";
import { ImageGenerationFoundationLogger } from "./image-generation-logger.js";
import { ImageGenerationStorageManager } from "./image-generation-storage.js";
export declare class GenerationProjectManager {
    private readonly logger;
    private projects;
    private projectsPath;
    private catalogPath;
    constructor(logger: ImageGenerationFoundationLogger);
    initialize(storage: ImageGenerationStorageManager): void;
    createProject(input: Omit<ImageGenerationProjectRegistration, "projectId" | "version" | "createdAt" | "lastUpdated" | "imageIds" | "promptIds"> & {
        projectId?: string;
    }): ImageGenerationProjectRegistration;
    registerImage(projectId: string, imageId: string): ImageGenerationProjectRegistration | null;
    registerPrompt(projectId: string, promptId: string): ImageGenerationProjectRegistration | null;
    linkBlueprint(projectId: string, blueprintId: string): ImageGenerationProjectRegistration | null;
    getProject(projectId: string): ImageGenerationProjectRegistration | undefined;
    getProjectCount(): number;
    searchProjects(query: {
        brand?: string;
        campaign?: string;
        platform?: ImageGenerationPlatformTarget;
        resolution?: ImageGenerationResolutionTarget;
        limit?: number;
    }): ImageGenerationProjectRegistration[];
    private loadFromDisk;
    private persist;
}
//# sourceMappingURL=generation-project-manager.d.ts.map