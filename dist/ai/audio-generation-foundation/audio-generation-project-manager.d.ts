import { AudioGenerationPlatformTarget, AudioGenerationProjectRegistration, AudioGenerationQualityTarget } from "./types.js";
import { AudioGenerationFoundationLogger } from "./audio-generation-logger.js";
import { AudioGenerationStorageManager } from "./audio-generation-storage.js";
export declare class GenerationProjectManager {
    private readonly logger;
    private projects;
    private projectsPath;
    private catalogPath;
    constructor(logger: AudioGenerationFoundationLogger);
    initialize(storage: AudioGenerationStorageManager): void;
    createProject(input: Omit<AudioGenerationProjectRegistration, "projectId" | "version" | "createdAt" | "lastUpdated" | "trackIds" | "voiceIds" | "promptIds"> & {
        projectId?: string;
    }): AudioGenerationProjectRegistration;
    registerTrack(projectId: string, trackId: string): AudioGenerationProjectRegistration | null;
    registerVoice(projectId: string, voiceId: string): AudioGenerationProjectRegistration | null;
    registerSpeaker(projectId: string, speakerId: string): AudioGenerationProjectRegistration | null;
    registerPrompt(projectId: string, promptId: string): AudioGenerationProjectRegistration | null;
    linkBlueprint(projectId: string, blueprintId: string): AudioGenerationProjectRegistration | null;
    getProject(projectId: string): AudioGenerationProjectRegistration | undefined;
    getProjectCount(): number;
    searchProjects(query: {
        brand?: string;
        campaign?: string;
        platform?: AudioGenerationPlatformTarget;
        quality?: AudioGenerationQualityTarget;
        limit?: number;
    }): AudioGenerationProjectRegistration[];
    private loadFromDisk;
    private persist;
}
//# sourceMappingURL=audio-generation-project-manager.d.ts.map