import fs from "node:fs";
import path from "node:path";
import {
  VideoAspectRatio,
  VideoIntelligenceHealthLevel,
  VideoIntelligenceSource,
  VideoIntelligenceVerificationStatus,
  VideoProjectRegistration,
  VideoSceneRegistration,
  VideoTimelineRegistration,
} from "./types.js";
import { VideoIntelligenceFoundationLogger } from "./video-intelligence-logger.js";
import { VideoIntelligenceStorageManager } from "./video-intelligence-storage.js";

export class VideoProjectManager {
  private projects = new Map<string, VideoProjectRegistration>();
  private timelines = new Map<string, VideoTimelineRegistration>();
  private scenes = new Map<string, VideoSceneRegistration>();
  private projectsPath = "";
  private catalogPath = "";

  constructor(private readonly logger: VideoIntelligenceFoundationLogger) {}

  initialize(storage: VideoIntelligenceStorageManager): void {
    this.projectsPath = storage.getProjectsPath();
    this.catalogPath = path.join(this.projectsPath, "video-project-catalog.json");
    fs.mkdirSync(this.projectsPath, { recursive: true });

    if (fs.existsSync(this.catalogPath)) {
      this.loadFromDisk();
    } else {
      this.persist();
    }

    this.logger.log("info", "project", "Video project manager initialized", {
      projectCount: this.projects.size,
    });
  }

  createProject(
    input: Omit<VideoProjectRegistration, "projectId" | "version" | "createdAt" | "lastUpdated" | "videoIds" | "timelineIds" | "deliverableIds"> & {
      projectId?: string;
    }
  ): VideoProjectRegistration {
    const now = new Date().toISOString();
    const projectId = input.projectId ?? `project-${Date.now()}`;
    const project: VideoProjectRegistration = {
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

  registerVideo(projectId: string, videoId: string): VideoProjectRegistration | null {
    const project = this.projects.get(projectId);
    if (!project) return null;
    if (!project.videoIds.includes(videoId)) {
      project.videoIds.push(videoId);
      project.version += 1;
      project.lastUpdated = new Date().toISOString();
      this.projects.set(projectId, project);
      this.persist();
    }
    return project;
  }

  registerTimeline(
    input: Omit<
      VideoTimelineRegistration,
      | "timelineId"
      | "version"
      | "createdAt"
      | "lastUpdated"
      | "audioTrackIds"
      | "subtitleTrackIds"
      | "sceneIds"
      | "deliverableIds"
    > & {
      timelineId?: string;
      audioTrackIds?: string[];
      subtitleTrackIds?: string[];
      sceneIds?: string[];
      deliverableIds?: string[];
    }
  ): VideoTimelineRegistration {
    const now = new Date().toISOString();
    const timelineId = input.timelineId ?? `timeline-${Date.now()}`;
    const timeline: VideoTimelineRegistration = {
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

  registerScene(
    input: Omit<VideoSceneRegistration, "sceneId" | "version" | "createdAt" | "shotIds"> & {
      sceneId?: string;
      shotIds?: string[];
    }
  ): VideoSceneRegistration {
    const now = new Date().toISOString();
    const sceneId = input.sceneId ?? `scene-${Date.now()}`;
    const scene: VideoSceneRegistration = {
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

  addDeliverable(projectId: string, deliverableId: string): void {
    const project = this.projects.get(projectId);
    if (!project) return;
    if (!project.deliverableIds.includes(deliverableId)) {
      project.deliverableIds.push(deliverableId);
      project.lastUpdated = new Date().toISOString();
      this.projects.set(projectId, project);
      this.persist();
    }
  }

  addPlatformVersion(projectId: string, platform: string): void {
    const project = this.projects.get(projectId);
    if (!project) return;
    if (!project.platformVersions.includes(platform)) {
      project.platformVersions.push(platform);
      project.lastUpdated = new Date().toISOString();
      this.projects.set(projectId, project);
      this.persist();
    }
  }

  addLanguage(projectId: string, language: string): void {
    const project = this.projects.get(projectId);
    if (!project) return;
    if (!project.languages.includes(language)) {
      project.languages.push(language);
      project.lastUpdated = new Date().toISOString();
      this.projects.set(projectId, project);
      this.persist();
    }
  }

  addAspectRatio(projectId: string, aspectRatio: VideoAspectRatio): void {
    const project = this.projects.get(projectId);
    if (!project) return;
    if (!project.aspectRatios.includes(aspectRatio)) {
      project.aspectRatios.push(aspectRatio);
      project.lastUpdated = new Date().toISOString();
      this.projects.set(projectId, project);
      this.persist();
    }
  }

  getProject(projectId: string): VideoProjectRegistration | undefined {
    return this.projects.get(projectId);
  }

  getTimeline(timelineId: string): VideoTimelineRegistration | undefined {
    return this.timelines.get(timelineId);
  }

  getScene(sceneId: string): VideoSceneRegistration | undefined {
    return this.scenes.get(sceneId);
  }

  getProjects(): VideoProjectRegistration[] {
    return [...this.projects.values()];
  }

  getTimelinesByProject(projectId: string): VideoTimelineRegistration[] {
    return [...this.timelines.values()].filter((t) => t.projectId === projectId);
  }

  getScenesByTimeline(timelineId: string): VideoSceneRegistration[] {
    return [...this.scenes.values()].filter((s) => s.timelineId === timelineId);
  }

  getProjectCount(): number {
    return this.projects.size;
  }

  verifyIntegrity(): { valid: boolean; issues: string[] } {
    const issues: string[] = [];
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

  private loadFromDisk(): void {
    const raw = fs.readFileSync(this.catalogPath, "utf8");
    const catalog = JSON.parse(raw) as {
      projects: VideoProjectRegistration[];
      timelines: VideoTimelineRegistration[];
      scenes: VideoSceneRegistration[];
    };
    this.projects.clear();
    this.timelines.clear();
    this.scenes.clear();
    for (const project of catalog.projects) this.projects.set(project.projectId, project);
    for (const timeline of catalog.timelines ?? []) this.timelines.set(timeline.timelineId, timeline);
    for (const scene of catalog.scenes ?? []) this.scenes.set(scene.sceneId, scene);
  }

  private persist(): void {
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

export function createDefaultProjectQuality(): VideoProjectRegistration["quality"] {
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
