import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  MemoryStorageType,
  ProjectStatus,
  ProjectType,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-project-memory-test-"));
}

describe("AiProjectMemoryEngine", () => {
  let storageRoot: string;

  beforeEach(() => {
    storageRoot = createTempStorageRoot();
  });

  afterEach(() => {
    AiCore.resetInstance();
    if (fs.existsSync(storageRoot)) {
      fs.rmSync(storageRoot, { recursive: true, force: true });
    }
  });

  async function startCore() {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("project-memory-test");
    const foundation = core.getManager().memoryFoundation!;
    const projects = foundation.getProjectMemoryEngine();
    const storage = foundation.getStorageEngine();
    return { core, foundation, projects, storage };
  }

  it("initializes with memory foundation startup", async () => {
    const { core, projects } = await startCore();
    expect(projects.isInitialized()).toBe(true);
    expect(projects.isStartupComplete()).toBe(true);

    const projectDir = path.join(storageRoot, "memory", "projects");
    expect(fs.existsSync(projectDir)).toBe(true);

    await core.stop();
  });

  it("creates and stores project memory", async () => {
    const { core, projects } = await startCore();

    const result = await projects.createProject({
      projectId: "proj-test-001",
      projectName: "KWIZERA Launch Promo",
      projectType: ProjectType.Promotional,
      description: "Promotional video project for KWIZERA AI STUDIO launch campaign.",
      targetAudience: "Creative professionals",
      marketingGoal: "Brand awareness",
      language: "en",
      tags: ["kwizera", "launch", "brand"],
    });

    expect(result.success).toBe(true);
    expect(result.checkpointCreated).toBe(true);

    const project = await projects.getProject("proj-test-001");
    expect(project).not.toBeNull();
    expect(project!.projectName).toBe("KWIZERA Launch Promo");
    expect(project!.status).toBe(ProjectStatus.Created);
    expect(project!.scores.qualityScore).toBeGreaterThan(0);

    await core.stop();
  });

  it("tracks project progress and versions on update", async () => {
    const { core, projects } = await startCore();

    await projects.createProject({
      projectId: "proj-version-001",
      projectName: "Version Test Project",
      projectType: ProjectType.Marketing,
      description: "Project for version tracking validation",
    });

    const update = await projects.updateProject("proj-version-001", {
      status: ProjectStatus.Editing,
      completionPercentage: 45,
      assets: { images: ["img/logo.png"], scripts: ["script-v1.txt"] },
      workflowHistory: { taskHistory: ["task-001", "task-002"] },
    });

    expect(update.success).toBe(true);
    expect(update.version).toBe(2);
    expect(update.checkpointCreated).toBe(true);

    const project = await projects.getProject("proj-version-001");
    expect(project!.completionPercentage).toBe(45);
    expect(project!.assets.images).toContain("img/logo.png");
    expect(project!.versions.length).toBe(2);

    await core.stop();
  });

  it("restores project from latest checkpoint", async () => {
    const { core, projects } = await startCore();

    await projects.createProject({
      projectId: "proj-restore-001",
      projectName: "Recovery Test",
      projectType: ProjectType.Brand,
      description: "Project for recovery validation",
    });

    await projects.updateProject("proj-restore-001", {
      status: ProjectStatus.Processing,
      completionPercentage: 60,
      assets: { videos: ["draft/promo-v1.mp4"] },
      workflowState: { currentStep: "render" },
    });

    await projects.updateProject("proj-restore-001", {
      status: ProjectStatus.Paused,
      completionPercentage: 5,
    });

    const restore = await projects.restoreProject("proj-restore-001");
    expect(restore.success).toBe(true);
    expect(restore.status).toBe(ProjectStatus.Recovered);
    expect(restore.completionPercentage).toBe(5);

    const project = await projects.getProject("proj-restore-001");
    expect(project!.status).toBe(ProjectStatus.Recovered);

    await core.stop();
  });

  it("persists projects across application restart", async () => {
    const core1 = createAiCore({ storageRootOverride: storageRoot });
    await core1.start("persist-test");
    const engine1 = core1.getManager().memoryFoundation!.getProjectMemoryEngine();

    await engine1.createProject({
      projectId: "proj-persist-001",
      projectName: "Persistent Project",
      projectType: ProjectType.Campaign,
      description: "Must survive restart",
      tags: ["persist"],
    });
    await core1.stop();

    AiCore.resetInstance();
    const core2 = createAiCore({ storageRootOverride: storageRoot });
    await core2.start("persist-test-restart");
    const engine2 = core2.getManager().memoryFoundation!.getProjectMemoryEngine();

    const project = await engine2.getProject("proj-persist-001");
    expect(project).not.toBeNull();
    expect(project!.projectName).toBe("Persistent Project");

    await core2.stop();
  });

  it("links projects to related memories via index", async () => {
    const { core, projects, storage } = await startCore();

    await projects.createProject({
      projectId: "proj-link-001",
      projectName: "Linked Project",
      projectType: ProjectType.Promotional,
      description: "Project with related memories",
      tags: ["brand-launch"],
    });

    await storage.storeRecord({
      memoryId: "mkt-link-001",
      memoryType: MemoryStorageType.Marketing,
      category: "marketing",
      title: "Launch Campaign",
      description: "Marketing for linked project",
      source: "test",
      tags: ["brand-launch"],
      relatedProject: "proj-link-001",
    });

    await projects.updateProject("proj-link-001", {
      completionPercentage: 30,
    });

    const project = await projects.getProject("proj-link-001");
    expect(project!.relatedMemories.length).toBeGreaterThanOrEqual(1);

    await core.stop();
  });

  it("supports project search by name, type, and tags", async () => {
    const { core, projects } = await startCore();

    await projects.createProject({
      projectId: "proj-search-001",
      projectName: "Social Media Campaign",
      projectType: ProjectType.Social,
      description: "Social content project",
      language: "en",
      tags: ["social", "instagram"],
    });

    const byName = projects.searchProjects({ name: "Social" });
    expect(byName.length).toBe(1);

    const byType = projects.searchProjects({ projectType: ProjectType.Social });
    expect(byType.length).toBe(1);

    const byTag = projects.searchProjects({ tags: ["instagram"] });
    expect(byTag.length).toBe(1);

    await core.stop();
  });

  it("compares project versions", async () => {
    const { core, projects } = await startCore();

    await projects.createProject({
      projectId: "proj-compare-001",
      projectName: "Compare Versions",
      projectType: ProjectType.General,
      description: "Version comparison test",
    });

    await projects.updateProject("proj-compare-001", {
      completionPercentage: 50,
      status: ProjectStatus.Editing,
    });

    const comparison = await projects.compareVersions("proj-compare-001", 1, 2);
    expect(comparison.differences.length).toBeGreaterThan(0);

    await core.stop();
  });

  it("writes project logs and builds status report", async () => {
    const { core, projects } = await startCore();

    await projects.createProject({
      projectId: "proj-report-001",
      projectName: "Report Test",
      projectType: ProjectType.Product,
      description: "Status report validation project",
    });

    const logDir = path.join(storageRoot, "logs");
    const logFiles = fs.readdirSync(logDir).filter((f) => f.startsWith("project-memory-engine"));
    expect(logFiles.length).toBeGreaterThan(0);

    const report = projects.buildStatusReport();
    expect(report.engineStatus).toBe("operational");
    expect(report.readinessScore).toBeGreaterThanOrEqual(85);
    expect(report.totalProjects).toBe(1);

    await core.stop();
  });
});
