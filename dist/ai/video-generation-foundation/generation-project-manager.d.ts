import { GenerationPlatformTarget, GenerationProjectRegistration } from "./types.js";
import { VideoGenerationFoundationLogger } from "./video-generation-logger.js";
import { VideoGenerationStorageManager } from "./video-generation-storage.js";
export declare class GenerationProjectManager {
    private readonly logger;
    private projects;
    private projectsPath;
    private catalogPath;
    constructor(logger: VideoGenerationFoundationLogger);
    initialize(storage: VideoGenerationStorageManager): void;
    createProject(input: Omit<GenerationProjectRegistration, "projectId" | "version" | "createdAt" | "lastUpdated" | "videoIds" | "sceneIds" | "timelineIds"> & {
        projectId?: string;
    }): GenerationProjectRegistration;
    registerVideo(projectId: string, videoId: string): GenerationProjectRegistration | null;
    registerScene(projectId: string, sceneId: string): GenerationProjectRegistration | null;
    registerTimeline(projectId: string, timelineId: string): GenerationProjectRegistration | null;
    linkBlueprint(projectId: string, blueprintId: string): GenerationProjectRegistration | null;
    getProject(projectId: string): GenerationProjectRegistration | undefined;
    getProjectCount(): number;
    searchProjects(query: {
        brand?: string;
        campaign?: string;
        platform?: GenerationPlatformTarget;
        limit?: number;
    }): GenerationProjectRegistration[];
    private loadFromDisk;
    private persist;
}
//# sourceMappingURL=generation-project-manager.d.ts.map