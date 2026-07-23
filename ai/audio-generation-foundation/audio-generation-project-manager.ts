import fs from "node:fs";
import path from "node:path";
import {
  AudioGenerationPlatformTarget,
  AudioGenerationProjectRegistration,
  AudioGenerationQualityTarget,
} from "./types.js";
import { AudioGenerationFoundationLogger } from "./audio-generation-logger.js";
import { AudioGenerationStorageManager } from "./audio-generation-storage.js";

export class GenerationProjectManager {
  private projects = new Map<string, AudioGenerationProjectRegistration>();
  private projectsPath = "";
  private catalogPath = "";

  constructor(private readonly logger: AudioGenerationFoundationLogger) {}

  initialize(storage: AudioGenerationStorageManager): void {
    this.projectsPath = storage.getProjectsPath();
    this.catalogPath = path.join(this.projectsPath, "audio-generation-project-catalog.json");
    fs.mkdirSync(this.projectsPath, { recursive: true });

    if (fs.existsSync(this.catalogPath)) {
      this.loadFromDisk();
    } else {
      this.persist();
    }

    this.logger.log("info", "project", "Audio generation project manager initialized", {
      projectCount: this.projects.size,
    });
  }

  createProject(
    input: Omit<
      AudioGenerationProjectRegistration,
      "projectId" | "version" | "createdAt" | "lastUpdated" | "trackIds" | "voiceIds" | "promptIds"
    > & { projectId?: string }
  ): AudioGenerationProjectRegistration {
    const now = new Date().toISOString();
    const projectId = input.projectId ?? `aud-project-${Date.now()}`;
    const project: AudioGenerationProjectRegistration = {
      ...input,
      projectId,
      trackIds: [],
      voiceIds: [],
      promptIds: [],
      version: 1,
      createdAt: now,
      lastUpdated: now,
    };
    this.projects.set(projectId, project);
    this.persist();
    this.logger.log("info", "project", `Audio generation project created: ${projectId}`, {
      projectName: project.projectName,
    });
    return project;
  }

  registerTrack(projectId: string, trackId: string): AudioGenerationProjectRegistration | null {
    const project = this.projects.get(projectId);
    if (!project) return null;
    if (!project.trackIds.includes(trackId)) {
      project.trackIds.push(trackId);
      project.version += 1;
      project.lastUpdated = new Date().toISOString();
      this.projects.set(projectId, project);
      this.persist();
    }
    return project;
  }

  registerVoice(projectId: string, voiceId: string): AudioGenerationProjectRegistration | null {
    const project = this.projects.get(projectId);
    if (!project) return null;
    if (!project.voiceIds.includes(voiceId)) {
      project.voiceIds.push(voiceId);
      project.version += 1;
      project.lastUpdated = new Date().toISOString();
      this.projects.set(projectId, project);
      this.persist();
    }
    return project;
  }

  registerSpeaker(projectId: string, speakerId: string): AudioGenerationProjectRegistration | null {
    const project = this.projects.get(projectId);
    if (!project) return null;
    if (!project.speakers.includes(speakerId)) {
      project.speakers.push(speakerId);
      project.version += 1;
      project.lastUpdated = new Date().toISOString();
      this.projects.set(projectId, project);
      this.persist();
    }
    return project;
  }

  registerPrompt(projectId: string, promptId: string): AudioGenerationProjectRegistration | null {
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

  linkBlueprint(projectId: string, blueprintId: string): AudioGenerationProjectRegistration | null {
    const project = this.projects.get(projectId);
    if (!project) return null;
    project.blueprintId = blueprintId;
    project.version += 1;
    project.lastUpdated = new Date().toISOString();
    this.projects.set(projectId, project);
    this.persist();
    return project;
  }

  getProject(projectId: string): AudioGenerationProjectRegistration | undefined {
    return this.projects.get(projectId);
  }

  getProjectCount(): number {
    return this.projects.size;
  }

  searchProjects(query: {
    brand?: string;
    campaign?: string;
    platform?: AudioGenerationPlatformTarget;
    quality?: AudioGenerationQualityTarget;
    limit?: number;
  }): AudioGenerationProjectRegistration[] {
    let results = [...this.projects.values()];
    if (query.brand) results = results.filter((p) => p.brand === query.brand);
    if (query.campaign) results = results.filter((p) => p.campaign === query.campaign);
    if (query.platform) results = results.filter((p) => p.platforms.includes(query.platform!));
    if (query.quality) results = results.filter((p) => p.qualities.includes(query.quality!));
    return results.slice(0, query.limit ?? 50);
  }

  private loadFromDisk(): void {
    const data = JSON.parse(fs.readFileSync(this.catalogPath, "utf8")) as {
      projects: AudioGenerationProjectRegistration[];
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
