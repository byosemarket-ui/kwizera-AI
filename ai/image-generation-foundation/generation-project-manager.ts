import fs from "node:fs";
import path from "node:path";
import {
  ImageGenerationPlatformTarget,
  ImageGenerationProjectRegistration,
  ImageGenerationResolutionTarget,
} from "./types.js";
import { ImageGenerationFoundationLogger } from "./image-generation-logger.js";
import { ImageGenerationStorageManager } from "./image-generation-storage.js";

export class GenerationProjectManager {
  private projects = new Map<string, ImageGenerationProjectRegistration>();
  private projectsPath = "";
  private catalogPath = "";

  constructor(private readonly logger: ImageGenerationFoundationLogger) {}

  initialize(storage: ImageGenerationStorageManager): void {
    this.projectsPath = storage.getProjectsPath();
    this.catalogPath = path.join(this.projectsPath, "image-generation-project-catalog.json");
    fs.mkdirSync(this.projectsPath, { recursive: true });

    if (fs.existsSync(this.catalogPath)) {
      this.loadFromDisk();
    } else {
      this.persist();
    }

    this.logger.log("info", "project", "Image generation project manager initialized", {
      projectCount: this.projects.size,
    });
  }

  createProject(
    input: Omit<
      ImageGenerationProjectRegistration,
      "projectId" | "version" | "createdAt" | "lastUpdated" | "imageIds" | "promptIds"
    > & { projectId?: string }
  ): ImageGenerationProjectRegistration {
    const now = new Date().toISOString();
    const projectId = input.projectId ?? `img-project-${Date.now()}`;
    const project: ImageGenerationProjectRegistration = {
      ...input,
      projectId,
      imageIds: [],
      promptIds: [],
      version: 1,
      createdAt: now,
      lastUpdated: now,
    };
    this.projects.set(projectId, project);
    this.persist();
    this.logger.log("info", "project", `Image generation project created: ${projectId}`, {
      projectName: project.projectName,
    });
    return project;
  }

  registerImage(projectId: string, imageId: string): ImageGenerationProjectRegistration | null {
    const project = this.projects.get(projectId);
    if (!project) return null;
    if (!project.imageIds.includes(imageId)) {
      project.imageIds.push(imageId);
      project.version += 1;
      project.lastUpdated = new Date().toISOString();
      this.projects.set(projectId, project);
      this.persist();
    }
    return project;
  }

  registerPrompt(projectId: string, promptId: string): ImageGenerationProjectRegistration | null {
    const project = this.projects.get(projectId);
    if (!project) return null;
    if (!project.promptIds.includes(promptId)) {
      project.promptIds.push(promptId);
      project.version += 1;
      project.lastUpdated = new Date().toISOString();
      this.projects.set(projectId, project);
      this.persist();
    }
    return project;
  }

  linkBlueprint(projectId: string, blueprintId: string): ImageGenerationProjectRegistration | null {
    const project = this.projects.get(projectId);
    if (!project) return null;
    project.blueprintId = blueprintId;
    project.version += 1;
    project.lastUpdated = new Date().toISOString();
    this.projects.set(projectId, project);
    this.persist();
    return project;
  }

  getProject(projectId: string): ImageGenerationProjectRegistration | undefined {
    return this.projects.get(projectId);
  }

  getProjectCount(): number {
    return this.projects.size;
  }

  searchProjects(query: {
    brand?: string;
    campaign?: string;
    platform?: ImageGenerationPlatformTarget;
    resolution?: ImageGenerationResolutionTarget;
    limit?: number;
  }): ImageGenerationProjectRegistration[] {
    let results = [...this.projects.values()];
    if (query.brand) results = results.filter((p) => p.brand === query.brand);
    if (query.campaign) results = results.filter((p) => p.campaign === query.campaign);
    if (query.platform) results = results.filter((p) => p.platforms.includes(query.platform!));
    if (query.resolution) results = results.filter((p) => p.resolutions.includes(query.resolution!));
    return results.slice(0, query.limit ?? 50);
  }

  private loadFromDisk(): void {
    const data = JSON.parse(fs.readFileSync(this.catalogPath, "utf8")) as {
      projects: ImageGenerationProjectRegistration[];
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
