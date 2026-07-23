import { VideoAspectRatio, VideoProjectRegistration, VideoSceneRegistration, VideoTimelineRegistration } from "./types.js";
import { VideoIntelligenceFoundationLogger } from "./video-intelligence-logger.js";
import { VideoIntelligenceStorageManager } from "./video-intelligence-storage.js";
export declare class VideoProjectManager {
    private readonly logger;
    private projects;
    private timelines;
    private scenes;
    private projectsPath;
    private catalogPath;
    constructor(logger: VideoIntelligenceFoundationLogger);
    initialize(storage: VideoIntelligenceStorageManager): void;
    createProject(input: Omit<VideoProjectRegistration, "projectId" | "version" | "createdAt" | "lastUpdated" | "videoIds" | "timelineIds" | "deliverableIds"> & {
        projectId?: string;
    }): VideoProjectRegistration;
    registerVideo(projectId: string, videoId: string): VideoProjectRegistration | null;
    registerTimeline(input: Omit<VideoTimelineRegistration, "timelineId" | "version" | "createdAt" | "lastUpdated" | "audioTrackIds" | "subtitleTrackIds" | "sceneIds" | "deliverableIds"> & {
        timelineId?: string;
        audioTrackIds?: string[];
        subtitleTrackIds?: string[];
        sceneIds?: string[];
        deliverableIds?: string[];
    }): VideoTimelineRegistration;
    registerScene(input: Omit<VideoSceneRegistration, "sceneId" | "version" | "createdAt" | "shotIds"> & {
        sceneId?: string;
        shotIds?: string[];
    }): VideoSceneRegistration;
    addDeliverable(projectId: string, deliverableId: string): void;
    addPlatformVersion(projectId: string, platform: string): void;
    addLanguage(projectId: string, language: string): void;
    addAspectRatio(projectId: string, aspectRatio: VideoAspectRatio): void;
    getProject(projectId: string): VideoProjectRegistration | undefined;
    getTimeline(timelineId: string): VideoTimelineRegistration | undefined;
    getScene(sceneId: string): VideoSceneRegistration | undefined;
    getProjects(): VideoProjectRegistration[];
    getTimelinesByProject(projectId: string): VideoTimelineRegistration[];
    getScenesByTimeline(timelineId: string): VideoSceneRegistration[];
    getProjectCount(): number;
    verifyIntegrity(): {
        valid: boolean;
        issues: string[];
    };
    private loadFromDisk;
    private persist;
}
export declare function createDefaultProjectQuality(): VideoProjectRegistration["quality"];
//# sourceMappingURL=video-project-manager.d.ts.map