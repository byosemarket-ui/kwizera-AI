import fs from "node:fs";
import path from "node:path";
import { VideoIntelligenceHealthLevel, VideoIntelligenceSource, VideoIntelligenceVerificationStatus, } from "./types.js";
export class VideoProjectManager {
    logger;
    projects = new Map();
    timelines = new Map();
    scenes = new Map();
    projectsPath = "";
    catalogPath = "";
    constructor(logger) {
        this.logger = logger;
    }
    initialize(storage) {
        this.projectsPath = storage.getProjectsPath();
        this.catalogPath = path.join(this.projectsPath, "video-project-catalog.json");
        fs.mkdirSync(this.projectsPath, { recursive: true });
        if (fs.existsSync(this.catalogPath)) {
            this.loadFromDisk();
        }
        else {
            this.persist();
        }
        this.logger.log("info", "project", "Video project manager initialized", {
            projectCount: this.projects.size,
        });
    }
    createProject(input) {
        const now = new Date().toISOString();
        const projectId = input.projectId ?? `project-${Date.now()}`;
        const project = {
            ...input,
            projectId,
            videoIds: [],
            timelineIds: [],
            deliverableIds: [],
            version: 1,
            createdAt: now,
            lastUpdated: now,
        };
        this.projects.set(projectId, project);
        this.persist();
        this.logger.log("info", "project", `Video project created: ${projectId}`, {
            projectName: project.projectName,
        });
        return project;
    }
    registerVideo(projectId, videoId) {
        const project = this.projects.get(projectId);
        if (!project)
            return null;
        if (!project.videoIds.includes(videoId)) {
            project.videoIds.push(videoId);
            project.version += 1;
            project.lastUpdated = new Date().toISOString();
            this.projects.set(projectId, project);
            this.persist();
        }
        return project;
    }
    registerTimeline(input) {
        const now = new Date().toISOString();
        const timelineId = input.timelineId ?? `timeline-${Date.now()}`;
        const timeline = {
            ...input,
            timelineId,
            audioTrackIds: input.audioTrackIds ?? [],
            subtitleTrackIds: input.subtitleTrackIds ?? [],
            sceneIds: input.sceneIds ?? [],
            deliverableIds: input.deliverableIds ?? [],
            version: 1,
            createdAt: now,
            lastUpdated: now,
        };
        this.timelines.set(timelineId, timeline);
        const project = this.projects.get(timeline.projectId);
        if (project && !project.timelineIds.includes(timelineId)) {
            project.timelineIds.push(timelineId);
            project.lastUpdated = now;
            this.projects.set(project.projectId, project);
        }
        this.persist();
        return timeline;
    }
    registerScene(input) {
        const now = new Date().toISOString();
        const sceneId = input.sceneId ?? `scene-${Date.now()}`;
        const scene = {
            ...input,
            sceneId,
            shotIds: input.shotIds ?? [],
            cameraIds: input.cameraIds ?? [],
            relationshipLinks: input.relationshipLinks ?? [input.videoId, input.timelineId],
            version: 1,
            createdAt: now,
        };
        this.scenes.set(sceneId, scene);
        const timeline = this.timelines.get(scene.timelineId);
        if (timeline && !timeline.sceneIds.includes(sceneId)) {
            timeline.sceneIds.push(sceneId);
            this.timelines.set(timeline.timelineId, timeline);
        }
        this.persist();
        return scene;
    }
    addDeliverable(projectId, deliverableId) {
        const project = this.projects.get(projectId);
        if (!project)
            return;
        if (!project.deliverableIds.includes(deliverableId)) {
            project.deliverableIds.push(deliverableId);
            project.lastUpdated = new Date().toISOString();
            this.projects.set(projectId, project);
            this.persist();
        }
    }
    addPlatformVersion(projectId, platform) {
        const project = this.projects.get(projectId);
        if (!project)
            return;
        if (!project.platformVersions.includes(platform)) {
            project.platformVersions.push(platform);
            project.lastUpdated = new Date().toISOString();
            this.projects.set(projectId, project);
            this.persist();
        }
    }
    addLanguage(projectId, language) {
        const project = this.projects.get(projectId);
        if (!project)
            return;
        if (!project.languages.includes(language)) {
            project.languages.push(language);
            project.lastUpdated = new Date().toISOString();
            this.projects.set(projectId, project);
            this.persist();
        }
    }
    addAspectRatio(projectId, aspectRatio) {
        const project = this.projects.get(projectId);
        if (!project)
            return;
        if (!project.aspectRatios.includes(aspectRatio)) {
            project.aspectRatios.push(aspectRatio);
            project.lastUpdated = new Date().toISOString();
            this.projects.set(projectId, project);
            this.persist();
        }
    }
    getProject(projectId) {
        return this.projects.get(projectId);
    }
    getTimeline(timelineId) {
        return this.timelines.get(timelineId);
    }
    getScene(sceneId) {
        return this.scenes.get(sceneId);
    }
    getProjects() {
        return [...this.projects.values()];
    }
    getTimelinesByProject(projectId) {
        return [...this.timelines.values()].filter((t) => t.projectId === projectId);
    }
    getScenesByTimeline(timelineId) {
        return [...this.scenes.values()].filter((s) => s.timelineId === timelineId);
    }
    getProjectCount() {
        return this.projects.size;
    }
    verifyIntegrity() {
        const issues = [];
        for (const timeline of this.timelines.values()) {
            const project = this.projects.get(timeline.projectId);
            if (!project) {
                issues.push(`Timeline ${timeline.timelineId} references missing project ${timeline.projectId}`);
            }
        }
        for (const scene of this.scenes.values()) {
            if (!this.timelines.has(scene.timelineId)) {
                issues.push(`Scene ${scene.sceneId} references missing timeline ${scene.timelineId}`);
            }
        }
        return { valid: issues.length === 0, issues };
    }
    loadFromDisk() {
        const raw = fs.readFileSync(this.catalogPath, "utf8");
        const catalog = JSON.parse(raw);
        this.projects.clear();
        this.timelines.clear();
        this.scenes.clear();
        for (const project of catalog.projects)
            this.projects.set(project.projectId, project);
        for (const timeline of catalog.timelines ?? [])
            this.timelines.set(timeline.timelineId, timeline);
        for (const scene of catalog.scenes ?? [])
            this.scenes.set(scene.sceneId, scene);
    }
    persist() {
        const catalog = {
            lastUpdated: new Date().toISOString(),
            projectCount: this.projects.size,
            timelineCount: this.timelines.size,
            sceneCount: this.scenes.size,
            projects: [...this.projects.values()],
            timelines: [...this.timelines.values()],
            scenes: [...this.scenes.values()],
        };
        fs.writeFileSync(this.catalogPath, JSON.stringify(catalog, null, 2), "utf8");
    }
}
export function createDefaultProjectQuality() {
    return {
        qualityScore: 82,
        confidenceScore: 80,
        verificationStatus: VideoIntelligenceVerificationStatus.Pending,
        source: VideoIntelligenceSource.System,
        versionHistory: [
            {
                version: 1,
                timestamp: new Date().toISOString(),
                changeSummary: "Project created",
                source: VideoIntelligenceSource.System,
            },
        ],
        relationshipLinks: [],
        healthStatus: VideoIntelligenceHealthLevel.Good,
    };
}
//# sourceMappingURL=video-project-manager.js.map