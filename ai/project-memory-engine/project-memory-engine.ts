import path from "node:path";
import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { MemoryStorageType } from "../memory-storage-engine/types.js";
import { MemoryAccessPermission, MemoryCategory, MemoryModuleStatus } from "../memory-foundation/types.js";
import { ProjectCheckpointStore } from "./project-checkpoint-store.js";
import { ProjectHistoryStore } from "./project-history-store.js";
import { ProjectMemoryLogger } from "./project-logger.js";
import { ProjectProcessor, recordFromMemory } from "./project-processor.js";
import { ProjectRelationshipLinker } from "./project-relationship-linker.js";
import { ProjectRestorer } from "./project-restorer.js";
import { ProjectScorer } from "./project-scorer.js";
import {
  ProjectCreateInput,
  ProjectMemoryEngineError,
  ProjectMemoryStatusReport,
  ProjectProcessResult,
  ProjectRecord,
  ProjectRestoreResult,
  ProjectStatus,
  ProjectUpdateInput,
  ProjectVersionComparison,
  ProjectVersionInfo,
} from "./types.js";

/**
 * Project Memory Engine — permanent project storage, versioning, and recovery.
 */
export class AiProjectMemoryEngine {
  private foundation: AiMemoryFoundation | null = null;
  private storageRoot = "";
  private initialized = false;
  private startupComplete = false;

  readonly logger = new ProjectMemoryLogger();
  readonly history = new ProjectHistoryStore();
  readonly checkpoints = new ProjectCheckpointStore();

  private readonly projects = new Map<string, ProjectRecord>();
  private readonly scorer = new ProjectScorer();
  private linker: ProjectRelationshipLinker | null = null;
  private processor: ProjectProcessor | null = null;
  private restorer: ProjectRestorer | null = null;

  private saveTimes: number[] = [];
  private loadTimes: number[] = [];
  private restoreTimes: number[] = [];

  initialize(foundation: AiMemoryFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.storageRoot = storageRoot;

    const logDir = path.join(storageRoot, "logs");
    const projectDir = path.join(storageRoot, "memory", "projects");
    this.logger.initialize(logDir);
    this.history.initialize(projectDir);
    this.checkpoints.initialize(projectDir);

    this.linker = new ProjectRelationshipLinker(foundation, this.logger);
    this.processor = new ProjectProcessor(
      foundation,
      this.history,
      this.checkpoints,
      this.scorer,
      this.linker,
      this.logger,
      this.projects
    );
    this.restorer = new ProjectRestorer(
      this.processor,
      this.checkpoints,
      this.history,
      this.logger
    );

    this.initialized = true;
    this.logger.log("info", "startup", "Project Memory Engine initialized", { storageRoot });
  }

  async runStartup(): Promise<void> {
    this.ensureReady();
    const start = Date.now();

    const entries = this.foundation!
      .getStorageEngine()
      .getIndexEntries()
      .filter((e) => e.memoryType === MemoryStorageType.Project);

    for (const entry of entries) {
      const read = await this.foundation!.getStorageEngine().getRecord(entry.memoryId);
      if (read.success && read.record) {
        this.projects.set(entry.memoryId, recordFromMemory(read.record));
      }
    }

    this.foundation!.registerMemoryModule({
      memoryId: "project-memory",
      memoryName: "Project Memory",
      category: MemoryCategory.Project,
      version: "0.1.0",
      status: MemoryModuleStatus.Active,
      dependencies: ["memory-engine"],
      storageLocation: path.join(this.storageRoot, "memory", "projects"),
      accessPermissions: [
        MemoryAccessPermission.Read,
        MemoryAccessPermission.Write,
        MemoryAccessPermission.Update,
      ],
      implemented: true,
    });

    this.startupComplete = true;
    this.logger.log("info", "startup", "Project Memory Engine startup complete", {
      projectsLoaded: this.projects.size,
      durationMs: Date.now() - start,
    });
  }

  async createProject(input: ProjectCreateInput): Promise<ProjectProcessResult> {
    this.ensureReady();
    const result = await this.processor!.create(input);
    if (result.success) this.saveTimes.push(result.durationMs);
    return result;
  }

  async updateProject(projectId: string, input: ProjectUpdateInput): Promise<ProjectProcessResult> {
    this.ensureReady();
    const result = await this.processor!.update(projectId, input);
    if (result.success) this.saveTimes.push(result.durationMs);
    return result;
  }

  async getProject(projectId: string): Promise<ProjectRecord | null> {
    this.ensureReady();
    const start = Date.now();
    const project = await this.processor!.loadProject(projectId);
    this.loadTimes.push(Date.now() - start);
    return project;
  }

  async listProjects(): Promise<ProjectRecord[]> {
    this.ensureReady();
    return [...this.projects.values()];
  }

  async restoreProject(projectId: string, checkpointId?: string): Promise<ProjectRestoreResult> {
    this.ensureReady();
    const result = await this.restorer!.restore(projectId, checkpointId);
    if (result.success) this.restoreTimes.push(result.durationMs);
    return result;
  }

  async archiveProject(projectId: string): Promise<ProjectProcessResult> {
    return this.updateProject(projectId, { status: ProjectStatus.Archived });
  }

  getProjectHistory(projectId: string) {
    return this.history.getByProject(projectId);
  }

  getProjectVersions(projectId: string): ProjectVersionInfo[] {
    const project = this.projects.get(projectId);
    return project?.versions ?? [];
  }

  async compareVersions(
    projectId: string,
    versionA: number,
    versionB: number
  ): Promise<ProjectVersionComparison> {
    const versions = this.getProjectVersions(projectId);
    const a = versions.find((v) => v.version === versionA);
    const b = versions.find((v) => v.version === versionB);
    const differences: string[] = [];

    if (!a || !b) {
      differences.push("One or both versions not found");
    } else {
      if (a.changeSummary !== b.changeSummary) {
        differences.push(`v${versionA}: ${a.changeSummary}`);
        differences.push(`v${versionB}: ${b.changeSummary}`);
      }
      differences.push(`Memory version ${a.memoryVersion} → ${b.memoryVersion}`);
    }

    return { projectId, versionA, versionB, differences };
  }

  searchProjects(query: {
    name?: string;
    projectType?: string;
    brand?: string;
    language?: string;
    tags?: string[];
  }): ProjectRecord[] {
    let results = [...this.projects.values()];

    if (query.name) {
      const lower = query.name.toLowerCase();
      results = results.filter((p) => p.projectName.toLowerCase().includes(lower));
    }
    if (query.projectType) {
      results = results.filter((p) => p.projectType === query.projectType);
    }
    if (query.language) {
      results = results.filter((p) => p.language === query.language);
    }
    if (query.brand) {
      const lower = query.brand.toLowerCase();
      results = results.filter(
        (p) =>
          p.tags.some((t) => t.toLowerCase().includes(lower)) ||
          JSON.stringify(p.brandInformation).toLowerCase().includes(lower)
      );
    }
    if (query.tags?.length) {
      results = results.filter((p) => query.tags!.some((t) => p.tags.includes(t)));
    }

    return results;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  isStartupComplete(): boolean {
    return this.startupComplete;
  }

  buildStatusReport(): ProjectMemoryStatusReport {
    const projects = [...this.projects.values()];
    const active = projects.filter(
      (p) => p.status !== ProjectStatus.Archived && p.status !== ProjectStatus.Completed
    ).length;
    const archived = projects.filter((p) => p.status === ProjectStatus.Archived).length;
    const totalVersions = projects.reduce((sum, p) => sum + p.versions.length, 0);

    const avg = (times: number[]) =>
      times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

    let readinessScore = 100;
    if (!this.initialized) readinessScore = 0;
    if (!this.startupComplete) readinessScore -= 25;

    return {
      engineStatus: this.startupComplete ? "operational" : "initializing",
      projectStorageStatus: `${projects.length} project(s) loaded`,
      versionManagementStatus: `${totalVersions} version(s) tracked`,
      recoveryStatus: `${this.checkpoints.getCount()} checkpoint(s) available`,
      totalProjects: projects.length,
      activeProjects: active,
      archivedProjects: archived,
      performance: {
        averageSaveMs: avg(this.saveTimes),
        averageLoadMs: avg(this.loadTimes),
        averageRestoreMs: avg(this.restoreTimes),
        totalVersions,
        totalCheckpoints: this.checkpoints.getCount(),
      },
      knownIssues: [],
      readinessScore: Math.max(0, readinessScore),
      timestamp: new Date().toISOString(),
    };
  }

  private ensureReady(): void {
    if (!this.initialized || !this.foundation) {
      throw new ProjectMemoryEngineError(
        "Project Memory Engine not initialized",
        "NOT_INITIALIZED"
      );
    }
  }
}
