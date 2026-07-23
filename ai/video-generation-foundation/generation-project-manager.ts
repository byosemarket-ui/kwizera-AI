import fs from "node:fs";
import path from "node:path";
import { GenerationPlatformTarget, GenerationProjectRegistration } from "./types.js";
import { VideoGenerationFoundationLogger } from "./video-generation-logger.js";
import { VideoGenerationStorageManager } from "./video-generation-storage.js";

export class GenerationProjectManager {
  private projects = new Map<string, GenerationProjectRegistration>();
  private projectsPath = "";
  private catalogPath = "";

  constructor(private readonly logger: VideoGenerationFoundationLogger) {}

  initialize(storage: VideoGenerationStorageManager): void {
    this.projectsPath = storage.getProjectsPath();
    this.catalogPath = path.join(this.projectsPath, "generation-project-catalog.json");
    fs.mkdirSync(this.projectsPath, { recursive: true });

    if (fs.existsSync(this.catalogPath)) {
      this.loadFromDisk();
    } else {
      this.persist();
    }

    this.logger.log("info", "project", "Generation project manager initialized", {
      projectCount: this.projects.size,
    });
  }

  createProject(
    input: Omit<
      GenerationProjectRegistration,
      "projectId" | "version" | "createdAt" | "lastUpdated" | "videoIds" | "sceneIds" | "timelineIds"
    > & { projectId?: string }
  ): GenerationProjectRegistration {
    const now = new Date().toISOString();
    const projectId = input.projectId ?? `gen-project-${Date.now()}`;
    const project: GenerationProjectRegistration = {
      ...input,
      projectId,
      videoIds: [],
      sceneIds: [],
      timelineIds: [],
      version: 1,
      createdAt: now,
      lastUpdated: now,
    };
    this.projects.set(projectId, project);
    this.persist();
    this.logger.log("info", "project", `Generation project created: ${projectId}`, {
      projectName: project.projectName,
    });
    return project;
  }

  registerVideo(projectId: string, videoId: string): GenerationProjectRegistration | null {
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

  registerScene(projectId: string, sceneId: string): GenerationProjectRegistration | null {
    const project = this.projects.get(projectId);
    if (!project) return null;
    if (!project.sceneIds.includes(sceneId)) {
      project.sceneIds.push(sceneId);
      project.version += 1;
      project.lastUpdated = new Date().toISOString();
      this.projects.set(projectId, project);
      this.persist();
    }
    return project;
  }

  registerTimeline(projectId: string, timelineId: string): GenerationProjectRegistration | null {
    const project = this.projects.get(projectId);
    if (!project) return null;
    if (!project.timelineIds.includes(timelineId)) {
      project.timelineIds.push(timelineId);
      project.version += 1;
      project.lastUpdated = new Date().toISOString();
      this.projects.set(projectId, project);
      this.persist();
    }
    return project;
  }

  linkBlueprint(projectId: string, blueprintId: string): GenerationProjectRegistration | null {
    const project = this.projects.get(projectId);
    if (!project) return null;
    project.blueprintId = blueprintId;
    project.version += 1;
    project.lastUpdated = new Date().toISOString();
    this.projects.set(projectId, project);
    this.persist();
    return project;
  }

  getProject(projectId: string): GenerationProjectRegistration | undefined {
    return this.projects.get(projectId);
  }

  getProjectCount(): number {
    return this.projects.size;
  }

  searchProjects(query: { brand?: string; campaign?: string; platform?: GenerationPlatformTarget; limit?: number }): GenerationProjectRegistration[] {
    let results = [...this.projects.values()];
    if (query.brand) results = results.filter((p) => p.brand === query.brand);
    if (query.campaign) results = results.filter((p) => p.campaign === query.campaign);
    if (query.platform) results = results.filter((p) => p.platforms.includes(query.platform!));
    return results.slice(0, query.limit ?? 50);
  }

  private loadFromDisk(): void {
    const data = JSON.parse(fs.readFileSync(this.catalogPath, "utf8")) as {
      projects: GenerationProjectRegistration[];
    };
    this.projects.clear();
    for (const project of data.projects ?? []) {
      this.projects.set(project.projectId, project);
    }
  }

  private persist(): void {
    fs.writeFileSync(
      this.catalogPath,
      JSON.stringify({ projects: [...this.projects.values()] }, null, 2),
      "utf8"
    );
  }
}