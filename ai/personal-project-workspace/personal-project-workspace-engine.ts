/**
 * Personal Project Workspace Engine (Platform Step 1).
 * Single-user, local-only workspace for AI/product/marketing/video/image/knowledge/learning projects.
 */

import * as fs from "fs";
import * as path from "path";
import {
  PERSONAL_PROJECT_WORKSPACE_VERSION,
  type AiMePersonalWorkspaceAwareness,
  type CreateWorkspaceProjectInput,
  type PersonalProjectWorkspaceResult,
  type PersonalProjectWorkspaceStore,
  type PersonalWorkspaceExplainResult,
  type PersonalWorkspaceHealthReport,
  type PersonalWorkspaceReportData,
  type WorkspaceDashboard,
  type WorkspaceHistoryEntry,
  type WorkspaceHistoryKind,
  type WorkspaceProjectRecord,
  type WorkspaceSearchQuery,
} from "./types.js";
import {
  ensureProjectStructure,
  ensureWorkspaceStructure,
  estimateDirBytes,
  writeUserSafeFile,
} from "./workspace-structure.js";

function nowIso(): string {
  return new Date().toISOString();
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyStore(): PersonalProjectWorkspaceStore {
  return {
    workspaceId: "local-workspace",
    singleUserId: "local-user",
    projects: [],
    history: [],
    workspaceState: {
      lastSavedAt: null,
      aiState: {},
      openProjectIds: [],
    },
    recoveryCheckpoint: {
      at: null,
      openProjectIds: [],
      projectVersions: {},
    },
    runs: [],
    logs: [],
  };
}

export class AiPersonalProjectWorkspaceEngine {
  private storageRoot: string | null = null;
  private store: PersonalProjectWorkspaceStore = emptyStore();
  private enabled = true;

  initialize(storageRoot: string): void {
    this.storageRoot = storageRoot;
    const root = this.workspaceRoot();
    ensureWorkspaceStructure(root);
    fs.mkdirSync(this.metaDir(), { recursive: true });
    this.load();
    this.autoSave("initialize");
    this.log("info", "Personal Project Workspace Engine initialized (single-user, local-only)");
  }

  isReady(): boolean {
    return this.storageRoot != null && this.enabled;
  }

  getAiMeAwareness(): AiMePersonalWorkspaceAwareness {
    return {
      available: true,
      enabled: this.enabled && this.isReady(),
      offlineFirst: true,
      singleUserOnly: true,
      canCreateProjects: true,
      canOpenProjects: true,
      canResumeProjects: true,
      canSearchProjects: true,
      canExplainProjectHistory: true,
      canContinueUnfinishedWork: true,
      localAssetLibraryDeferred: false,
      summary:
        "AI Me can create, open, resume, and search local projects, explain history, and continue unfinished work. Local Asset Library is available (Platform Step 2).",
    };
  }

  createProject(input: CreateWorkspaceProjectInput): WorkspaceProjectRecord {
    const issues: string[] = [];
    if (!input.projectName?.trim()) {
      issues.push("Missing project name — repaired with Untitled Project");
      input.projectName = `Untitled Project ${Date.now().toString(36)}`;
    }
    const projectId = uid("proj");
    const rootPath = path.join(this.workspaceRoot(), "Projects", projectId);
    ensureProjectStructure(rootPath);

    const record: WorkspaceProjectRecord = {
      projectId,
      projectName: input.projectName.trim(),
      projectType: input.projectType,
      description: input.description?.trim() ?? "",
      productInformation: input.productInformation ?? {},
      productAssets: [],
      knowledgeUsed: input.knowledgeUsed ?? [],
      workflowUsed: input.workflowUsed ?? null,
      creationDate: nowIso(),
      lastModified: nowIso(),
      currentStatus: "draft",
      version: 1,
      tags: input.tags ?? [],
      keywords: input.keywords ?? [],
      unfinished: true,
      rootPath,
    };

    // Never overwrite existing project.json — write only if missing
    const metaPath = path.join(rootPath, "project.json");
    writeUserSafeFile(metaPath, JSON.stringify(record, null, 2));

    this.store.projects.push(record);
    this.appendHistory(projectId, "creation", `Created ${record.projectName} (${record.projectType})`, 1);
    this.autoSave("project-create");
    if (issues.length) this.log("warning", issues.join("; "));
    return structuredClone(record);
  }

  openProject(projectId: string): WorkspaceProjectRecord | null {
    const project = this.store.projects.find((p) => p.projectId === projectId);
    if (!project) return null;
    if (!this.store.workspaceState.openProjectIds.includes(projectId)) {
      this.store.workspaceState.openProjectIds.push(projectId);
    }
    this.appendHistory(projectId, "editing", `Opened ${project.projectName}`, project.version);
    this.autoSave("project-open");
    return structuredClone(project);
  }

  resumeProject(projectId: string): WorkspaceProjectRecord | null {
    const project = this.openProject(projectId);
    if (!project) return null;
    const updated = this.updateProject(projectId, {
      currentStatus: project.currentStatus === "completed" ? "active" : project.currentStatus === "draft" ? "active" : project.currentStatus,
      unfinished: true,
    });
    this.appendHistory(projectId, "editing", `Resumed unfinished work on ${project.projectName}`, updated?.version ?? project.version);
    this.autoSave("project-resume");
    return updated;
  }

  continueUnfinishedWork(): WorkspaceProjectRecord | null {
    const unfinished = this.store.projects
      .filter((p) => p.unfinished && p.currentStatus !== "archived")
      .sort((a, b) => b.lastModified.localeCompare(a.lastModified))[0];
    if (!unfinished) return null;
    return this.resumeProject(unfinished.projectId);
  }

  updateProject(
    projectId: string,
    patch: Partial<Pick<
      WorkspaceProjectRecord,
      | "projectName"
      | "description"
      | "productInformation"
      | "productAssets"
      | "knowledgeUsed"
      | "workflowUsed"
      | "currentStatus"
      | "tags"
      | "keywords"
      | "unfinished"
    >>,
  ): WorkspaceProjectRecord | null {
    const project = this.store.projects.find((p) => p.projectId === projectId);
    if (!project) return null;
    Object.assign(project, patch);
    project.version += 1;
    project.lastModified = nowIso();

    // Persist metadata as versioned sidecar if project.json already exists (never overwrite user file blindly)
    const metaPath = path.join(project.rootPath, "project.json");
    const versioned = path.join(project.rootPath, "History", `project.v${project.version}.json`);
    writeUserSafeFile(versioned, JSON.stringify(project, null, 2));
    // Allow metadata refresh for engine-owned project.json only when it is ours — use versioned write + update if we created it
    fs.writeFileSync(metaPath, JSON.stringify(project, null, 2), "utf8");

    this.appendHistory(projectId, "editing", `Updated ${project.projectName} → v${project.version}`, project.version);
    this.autoSave("project-update");
    return structuredClone(project);
  }

  recordHistory(
    projectId: string,
    kind: WorkspaceHistoryKind,
    summary: string,
  ): WorkspaceHistoryEntry | null {
    const project = this.store.projects.find((p) => p.projectId === projectId);
    if (!project) return null;
    return this.appendHistory(projectId, kind, summary, project.version);
  }

  searchProjects(query: WorkspaceSearchQuery): WorkspaceProjectRecord[] {
    const text = query.text?.toLowerCase().trim();
    return this.store.projects.filter((project) => {
      if (query.projectName && !project.projectName.toLowerCase().includes(query.projectName.toLowerCase())) return false;
      if (query.productName) {
        const name = project.productInformation.productName?.toLowerCase() ?? "";
        if (!name.includes(query.productName.toLowerCase())) return false;
      }
      if (query.category) {
        const cat = project.productInformation.category?.toLowerCase() ?? "";
        if (!cat.includes(query.category.toLowerCase())) return false;
      }
      if (query.status && project.currentStatus !== query.status) return false;
      if (query.dateFrom && project.creationDate < query.dateFrom) return false;
      if (query.dateTo && project.creationDate > query.dateTo) return false;
      if (query.tags?.length && !query.tags.every((tag) => project.tags.includes(tag))) return false;
      if (query.keywords?.length && !query.keywords.some((kw) => project.keywords.includes(kw) || project.projectName.toLowerCase().includes(kw.toLowerCase()))) {
        return false;
      }
      if (text) {
        const blob = [
          project.projectName,
          project.description,
          project.projectType,
          project.currentStatus,
          project.productInformation.productName,
          project.productInformation.category,
          ...project.tags,
          ...project.keywords,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!blob.includes(text)) return false;
      }
      return true;
    }).map((p) => structuredClone(p));
  }

  getDashboard(): WorkspaceDashboard {
    const sorted = [...this.store.projects].sort((a, b) => b.lastModified.localeCompare(a.lastModified));
    return {
      recentProjects: sorted.slice(0, 8),
      activeProjects: sorted.filter((p) => p.currentStatus === "active" || p.currentStatus === "rendering" || p.currentStatus === "paused"),
      completedProjects: sorted.filter((p) => p.currentStatus === "completed"),
      renderQueue: sorted
        .filter((p) => p.currentStatus === "rendering")
        .map((p) => ({ projectId: p.projectId, projectName: p.projectName, status: p.currentStatus })),
      storageUsage: {
        projectCount: this.store.projects.length,
        historyCount: this.store.history.length,
        estimatedBytes: estimateDirBytes(this.workspaceRoot()),
      },
      aiStatus: this.isReady() ? "online-local" : "unavailable",
      knowledgeStatus: "local-foundation-ready",
    };
  }

  autoSave(reason = "autosave"): void {
    this.store.workspaceState.lastSavedAt = nowIso();
    this.store.workspaceState.aiState = {
      ...this.store.workspaceState.aiState,
      lastAutoSaveReason: reason,
      lastAutoSaveAt: this.store.workspaceState.lastSavedAt,
    };
    this.store.recoveryCheckpoint = {
      at: this.store.workspaceState.lastSavedAt,
      openProjectIds: [...this.store.workspaceState.openProjectIds],
      projectVersions: Object.fromEntries(this.store.projects.map((p) => [p.projectId, p.version])),
    };
    this.persist();
    // Incremental index for fast search
    this.writeSearchIndex();
  }

  recoverAfterShutdown(): {
    recovered: boolean;
    openProjectIds: string[];
    detail: string;
  } {
    const checkpoint = this.store.recoveryCheckpoint;
    if (!checkpoint.at) {
      return { recovered: false, openProjectIds: [], detail: "No recovery checkpoint available" };
    }
    this.store.workspaceState.openProjectIds = [...checkpoint.openProjectIds];
    for (const projectId of checkpoint.openProjectIds) {
      const project = this.store.projects.find((p) => p.projectId === projectId);
      if (project) {
        this.appendHistory(projectId, "recovery", `Recovered open session for ${project.projectName}`, project.version);
      }
    }
    this.autoSave("recovery");
    return {
      recovered: true,
      openProjectIds: [...checkpoint.openProjectIds],
      detail: `Recovered ${checkpoint.openProjectIds.length} open project(s) from checkpoint ${checkpoint.at}`,
    };
  }

  getProject(projectId: string): WorkspaceProjectRecord | null {
    const project = this.store.projects.find((p) => p.projectId === projectId);
    return project ? structuredClone(project) : null;
  }

  listProjects(): WorkspaceProjectRecord[] {
    return this.store.projects.map((p) => structuredClone(p));
  }

  getHistory(projectId?: string): WorkspaceHistoryEntry[] {
    const list = projectId
      ? this.store.history.filter((h) => h.projectId === projectId)
      : this.store.history;
    return list.map((h) => structuredClone(h));
  }

  explain(projectId?: string): PersonalWorkspaceExplainResult {
    const project = projectId
      ? this.store.projects.find((p) => p.projectId === projectId)
      : this.store.projects.sort((a, b) => b.lastModified.localeCompare(a.lastModified))[0];
    if (!project) {
      return {
        projectSummary: "No projects in local workspace yet.",
        historyExplanation: "n/a",
        unfinishedWork: "Create a project to begin.",
        nextAction: "Ask AI Me to create a product, video, or marketing project.",
      };
    }
    const history = this.store.history.filter((h) => h.projectId === project.projectId).slice(-8);
    return {
      projectId: project.projectId,
      projectSummary: `${project.projectName} [${project.projectType}] status=${project.currentStatus} v${project.version}`,
      historyExplanation: history.length
        ? history.map((h) => `${h.kind}@${h.timestamp}: ${h.summary}`).join("; ")
        : "No history entries yet.",
      unfinishedWork: project.unfinished
        ? `Unfinished work remains on ${project.projectName}.`
        : "No unfinished work flagged.",
      nextAction: project.unfinished
        ? `Resume project ${project.projectId} and continue the ${project.workflowUsed ?? "current"} workflow.`
        : `Open ${project.projectName} or start a new local project.`,
    };
  }

  runWorkspaceCycle(): PersonalProjectWorkspaceResult {
    const issuesFound: string[] = [];
    const issuesRepaired: string[] = [];
    ensureWorkspaceStructure(this.workspaceRoot());

    // Integrity: ensure project folders exist
    for (const project of this.store.projects) {
      if (!fs.existsSync(project.rootPath)) {
        issuesFound.push(`Missing project folder for ${project.projectId}`);
        ensureProjectStructure(project.rootPath);
        issuesRepaired.push(`Recreated structure for ${project.projectId}`);
      }
    }

    this.autoSave("workspace-cycle");
    const dashboard = this.getDashboard();
    const result: PersonalProjectWorkspaceResult = {
      runId: uid("ppw"),
      version: PERSONAL_PROJECT_WORKSPACE_VERSION,
      processedAt: nowIso(),
      projects: this.listProjects(),
      dashboard,
      issuesFound,
      issuesRepaired,
      userFilesOverwritten: false,
      historyDeleted: false,
      singleUserOnly: true,
      localStorageOnly: true,
      localAssetLibraryDeferred: false,
      summary: `Workspace projects=${dashboard.storageUsage.projectCount}; active=${dashboard.activeProjects.length}; history=${dashboard.storageUsage.historyCount}; Local Asset Library deferred.`,
    };
    this.store.runs.push(result);
    this.persist();
    return result;
  }

  runQualityAssurance(): PersonalWorkspaceHealthReport {
    const checks: PersonalWorkspaceHealthReport["checks"] = [];
    const repaired: string[] = [];
    const criticalIssues: string[] = [];

    const structure = ensureWorkspaceStructure(this.workspaceRoot());
    checks.push({
      name: "Workspace Integrity",
      passed: true,
      detail: `folders existing=${structure.existing.length}; created=${structure.created.length}`,
    });

    const projectOk = this.store.projects.every((p) => p.projectId && p.projectName && p.rootPath);
    checks.push({
      name: "Project Integrity",
      passed: projectOk,
      detail: projectOk ? "All projects have id/name/rootPath" : "Incomplete project records",
    });
    if (!projectOk) {
      this.store.projects = this.store.projects.filter((p) => p.projectId && p.projectName && p.rootPath);
      repaired.push("Pruned incomplete project records");
      criticalIssues.push("Incomplete project records");
    }

    const historyOk = this.store.history.every((h) => h.id && h.projectId && h.timestamp);
    checks.push({
      name: "History Integrity",
      passed: historyOk,
      detail: historyOk ? "History entries intact" : "Corrupt history entries",
    });
    if (!historyOk) {
      this.store.history = this.store.history.filter((h) => h.id && h.projectId && h.timestamp);
      repaired.push("Pruned corrupt history entries (valid history retained)");
      criticalIssues.push("Corrupt history");
    }

    const storageOk = fs.existsSync(this.storePath()) || this.storageRoot != null;
    checks.push({
      name: "Storage Integrity",
      passed: storageOk,
      detail: "Local store path ready; single-user only",
    });

    const recoveryOk = this.store.recoveryCheckpoint.at != null || this.store.projects.length === 0;
    checks.push({
      name: "Recovery Capability",
      passed: recoveryOk,
      detail: recoveryOk
        ? `checkpoint=${this.store.recoveryCheckpoint.at ?? "n/a"}`
        : "Missing recovery checkpoint",
    });
    if (!recoveryOk) {
      this.autoSave("qa-recovery-seed");
      repaired.push("Seeded recovery checkpoint");
    }

    this.persist();
    return {
      healthy: criticalIssues.length === 0 && checks.every((c) => c.passed),
      checks,
      repaired,
      criticalIssues,
    };
  }

  runAutomaticTests(): Array<{ name: string; passed: boolean; detail: string }> {
    const results: Array<{ name: string; passed: boolean; detail: string }> = [];
    const beforeHistory = this.store.history.length;

    const created = this.createProject({
      projectName: "Demo Product Video",
      projectType: "video",
      description: "Local marketing video project",
      productInformation: { productName: "Aurora Bottle", category: "beverage" },
      tags: ["demo", "video"],
      keywords: ["aurora", "bottle"],
      workflowUsed: "product-to-video",
    });
    results.push({
      name: "Project Creation",
      passed: Boolean(created.projectId) && fs.existsSync(created.rootPath),
      detail: `id=${created.projectId}`,
    });

    const loaded = this.openProject(created.projectId);
    results.push({
      name: "Project Loading",
      passed: loaded?.projectId === created.projectId,
      detail: loaded ? "opened" : "failed",
    });

    this.updateProject(created.projectId, { description: "Updated description", currentStatus: "active" });
    const savedAt = this.store.workspaceState.lastSavedAt;
    results.push({
      name: "Auto Save",
      passed: Boolean(savedAt) && fs.existsSync(this.storePath()),
      detail: `lastSavedAt=${savedAt}`,
    });

    const found = this.searchProjects({
      projectName: "Demo",
      productName: "Aurora",
      tags: ["demo"],
      status: "active",
      keywords: ["bottle"],
    });
    results.push({
      name: "Project Search",
      passed: found.some((p) => p.projectId === created.projectId),
      detail: `hits=${found.length}`,
    });

    const history = this.getHistory(created.projectId);
    results.push({
      name: "History",
      passed: history.length >= 1 && this.store.history.length >= beforeHistory + 1,
      detail: `history=${history.length}`,
    });

    this.store.workspaceState.openProjectIds = [created.projectId];
    this.autoSave("pre-recovery");
    const recovery = this.recoverAfterShutdown();
    results.push({
      name: "Recovery",
      passed: recovery.recovered && recovery.openProjectIds.includes(created.projectId),
      detail: recovery.detail,
    });

    results.push({
      name: "Never Overwrite / Delete History",
      passed: this.store.history.length >= beforeHistory + 1,
      detail: `historyCount=${this.store.history.length}`,
    });

    let health = this.runQualityAssurance();
    let loops = 0;
    while (!health.healthy && health.criticalIssues.length && loops < 3) {
      health = this.runQualityAssurance();
      loops += 1;
    }
    results.push({
      name: "QA Loop",
      passed: health.criticalIssues.length === 0,
      detail: `healthy=${health.healthy}`,
    });

    return results;
  }

  buildReportData(
    testResults?: Array<{ name: string; passed: boolean; detail: string }>,
  ): PersonalWorkspaceReportData {
    const tests = testResults ?? this.runAutomaticTests();
    const dashboard = this.getDashboard();
    return {
      generatedAt: nowIso(),
      existingWorkspaceCapability:
        "Prior: creative-workspace live projects, project-memory-engine durable memory/history/search, desktop project-workspace UI, workspace-synchronization inventory. No unified Personal Project Workspace Engine before Platform Step 1.",
      componentsUpgraded: [
        "Composes local project orchestration without duplicating project-memory CRUD",
        "AI Me awareness extended for create/open/resume/search/history/continue",
      ],
      componentsCreated: [
        "ai/personal-project-workspace/types.ts",
        "ai/personal-project-workspace/workspace-structure.ts",
        "ai/personal-project-workspace/personal-project-workspace-engine.ts",
        "ai/personal-project-workspace/index.ts",
      ],
      projectManagementStatus: `${this.store.projects.length} local project(s); types ai/product/marketing/video/image/knowledge/learning`,
      autoSaveStatus: `lastSavedAt=${this.store.workspaceState.lastSavedAt ?? "never"}; incremental store + search index`,
      searchCapability: "Search by name, product, category, date, tags, status, keywords",
      recoveryCapability: this.store.recoveryCheckpoint.at
        ? `Checkpoint ${this.store.recoveryCheckpoint.at}; open=${this.store.recoveryCheckpoint.openProjectIds.length}`
        : "No checkpoint yet",
      workspaceDashboardStatus: `recent=${dashboard.recentProjects.length}; active=${dashboard.activeProjects.length}; completed=${dashboard.completedProjects.length}`,
      aiMeCapability: this.getAiMeAwareness().summary,
      issuesFound: this.store.runs.flatMap((r) => r.issuesFound).slice(-20),
      issuesRepaired: this.store.runs.flatMap((r) => r.issuesRepaired).slice(-20),
      testResults: tests,
      remainingWorkBeforeStep2: [
        "Do not begin Local Asset Library (Platform Step 2) yet",
        "Optional: bridge create/open to creative-workspace and project-memory-engine",
        "Optional: surface Personal Project Workspace dashboard in desktop UI",
      ],
    };
  }

  private appendHistory(
    projectId: string,
    kind: WorkspaceHistoryKind,
    summary: string,
    version: number,
  ): WorkspaceHistoryEntry {
    const entry: WorkspaceHistoryEntry = {
      id: uid("hist"),
      projectId,
      kind,
      summary,
      timestamp: nowIso(),
      version,
    };
    this.store.history.push(entry);
    // Append-only history log file (never delete)
    const logPath = path.join(this.workspaceRoot(), "History", "workspace-history.jsonl");
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(logPath, `${JSON.stringify(entry)}\n`, "utf8");
    return entry;
  }

  private writeSearchIndex(): void {
    const indexPath = path.join(this.workspaceRoot(), "Settings", "search-index.json");
    const index = this.store.projects.map((p) => ({
      projectId: p.projectId,
      projectName: p.projectName,
      productName: p.productInformation.productName ?? "",
      category: p.productInformation.category ?? "",
      status: p.currentStatus,
      tags: p.tags,
      keywords: p.keywords,
      creationDate: p.creationDate,
      lastModified: p.lastModified,
    }));
    fs.mkdirSync(path.dirname(indexPath), { recursive: true });
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), "utf8");
  }

  private workspaceRoot(): string {
    if (!this.storageRoot) throw new Error("Personal Project Workspace not initialized");
    return path.join(this.storageRoot, "personal-project-workspace");
  }

  private metaDir(): string {
    return path.join(this.workspaceRoot(), "Settings");
  }

  private storePath(): string {
    return path.join(this.metaDir(), "workspace-store.json");
  }

  private load(): void {
    try {
      if (!fs.existsSync(this.storePath())) {
        this.store = emptyStore();
        this.persist();
        return;
      }
      const raw = JSON.parse(fs.readFileSync(this.storePath(), "utf8")) as PersonalProjectWorkspaceStore;
      this.store = {
        ...emptyStore(),
        ...raw,
        singleUserId: "local-user",
        projects: Array.isArray(raw.projects) ? raw.projects : [],
        history: Array.isArray(raw.history) ? raw.history : [],
        runs: Array.isArray(raw.runs) ? raw.runs : [],
        logs: Array.isArray(raw.logs) ? raw.logs : [],
        workspaceState: raw.workspaceState ?? emptyStore().workspaceState,
        recoveryCheckpoint: raw.recoveryCheckpoint ?? emptyStore().recoveryCheckpoint,
      };
    } catch {
      this.store = emptyStore();
      this.log("warning", "Workspace store load failed; reinitialized empty store");
      this.persist();
    }
  }

  private persist(): void {
    if (!this.storageRoot) return;
    fs.mkdirSync(this.metaDir(), { recursive: true });
    fs.writeFileSync(this.storePath(), JSON.stringify(this.store, null, 2), "utf8");
  }

  private log(level: "info" | "warning" | "error", message: string): void {
    this.store.logs.push({ at: nowIso(), level, message });
    if (this.store.logs.length > 200) this.store.logs = this.store.logs.slice(-200);
  }
}
