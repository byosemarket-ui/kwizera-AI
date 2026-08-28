import type {
  DashboardCoreStatus, DashboardLiveSnapshot, DashboardMemoryHealth,
  DashboardPipelineSnapshot, DashboardWorkspace, LiveProgressState, LiveStatusCard,
} from "./types";
import { creativeMemoryEngine } from "../creative-memory/memory-engine";
import { resolveActiveProjectName } from "../shell/project-context";

function creativeAiLine(): string | null {
  try {
    creativeMemoryEngine.hydrate();
    const snap = creativeMemoryEngine.snapshot();
    if (!snap.available || !snap.summary) return null;
    return `AI Me READY · ${snap.summary.currentVersion} · Recs ${snap.summary.recommendationCount} · Next: ${snap.summary.nextActionLabel}`;
  } catch {
    return null;
  }
}

export class DashboardLiveEngine {
  buildSnapshot(
    core: DashboardCoreStatus | null,
    workspace: DashboardWorkspace | null,
    workspaceLabel: string,
    pipeline?: DashboardPipelineSnapshot | null,
    memory?: DashboardMemoryHealth | null,
  ): DashboardLiveSnapshot {
    const activeProject = resolveActiveProjectName(
      workspace?.activeProject?.name ?? core?.activeProject,
    );
    const storageBytes = workspace?.projects.reduce(
      (sum, p) => sum + p.productImages.reduce((t, i) => t + i.sizeBytes, 0), 0,
    ) ?? 0;
    const reportedJobs = core?.runtimeMetrics?.activeJobs ?? 0;
    const progress = this.buildProgress(reportedJobs, pipeline ?? null);
    const imageCount = workspace?.projects.reduce((n, p) => n + p.productImages.length, 0) ?? 0;

    const statuses: LiveStatusCard[] = [
      {
        key: "active-project",
        label: "Active Project",
        value: activeProject ?? "None",
        detail: workspace?.activeProject
          ? `${workspace.activeProject.productImages.length} assets`
          : "Open a project to begin",
        online: Boolean(activeProject),
      },
      {
        key: "production",
        label: "Production",
        value: progress.running > 0 ? "Running" : "Idle",
        detail: `${progress.running} running · ${progress.waiting} waiting`,
        online: progress.running > 0,
        progress: progress.percent,
      },
      {
        key: "ai",
        label: "AI Status",
        value: core?.aiCore ? "Ready" : "Offline",
        detail: core?.workflowEngine ? "Workflow engine connected" : "Local mode",
        online: Boolean(core?.aiCore),
        progress: core?.aiCore ? 100 : 0,
      },
      {
        key: "rendering",
        label: "Rendering",
        value: progress.running > 0 ? "In progress" : "Standby",
        detail: progress.remainingLabel,
        online: progress.running > 0,
        progress: progress.percent,
      },
      {
        key: "knowledge",
        label: "Knowledge",
        value: memory?.knowledge === "READY" || core?.knowledgeFoundation ? "Indexed" : "Offline",
        detail: memory
          ? `${memory.knowledgeCount} knowledge · ${memory.memoryCount} memory`
          : core?.memoryFoundation ? "Memory foundation linked" : "Standby",
        online: Boolean(memory?.ready ?? core?.knowledgeFoundation),
        progress: memory?.ready || core?.knowledgeFoundation ? 100 : 0,
      },
      {
        key: "storage",
        label: "Storage",
        value: storageBytes ? `${(storageBytes / 1024 / 1024).toFixed(1)} MB` : "Local",
        detail: core?.runtimeMetrics ? `${core.runtimeMetrics.memoryMb} MB RAM in use` : "Workspace status unavailable",
        online: Boolean(core),
        progress: Math.min(100, Math.round((storageBytes / (50 * 1024 * 1024)) * 100) || 0),
      },
    ];

    const lastProject = workspace?.projects[0];
    return {
      updatedAt: new Date().toISOString(),
      statuses,
      progress,
      activeProject,
      workspaceLabel,
      aiRecommendation: this.recommendation(core, activeProject, progress, memory),
      lastActivity: lastProject
        ? `${lastProject.name} updated ${formatRelative(lastProject.modifiedAt)}`
        : "Dashboard initialized · awaiting project activity",
      recentProduction: lastProject?.name ?? "No recent production",
      imageCount,
    };
  }

  buildProgress(activeJobs: number, pipeline?: DashboardPipelineSnapshot | null): LiveProgressState {
    const jobs = pipeline?.jobs ?? [];
    const history = pipeline?.history ?? [];
    const runningFromJobs = jobs.filter((job) => job.status === "running").length;
    const running = pipeline ? runningFromJobs : (activeJobs > 0 ? activeJobs : 0);
    const waiting = jobs.filter((job) => job.status === "queued" || job.status === "paused").length;
    const completed = history.filter((job) => job.status === "completed").length
      + jobs.filter((job) => job.status === "completed").length;
    const percents = jobs.map((job) => job.progress ?? 0);
    const percent = running > 0 || waiting > 0
      ? Math.min(99, Math.round(percents.reduce((sum, n) => sum + n, 0) / Math.max(1, jobs.length)))
      : completed > 0 ? 100 : 0;

    const rendering = jobs.find((job) => job.stage === "rendering" || job.status === "running");
    const remainingLabel = rendering
      ? (pipeline?.monitor?.estimatedCompletion as string | undefined) ?? "Job in progress"
      : running > 0
        ? "Job in progress"
        : "No active render";

    const tasks = this.buildTasks(jobs, history);

    return { percent, remainingLabel, completed, running, waiting, tasks };
  }

  private buildTasks(
    jobs: NonNullable<DashboardPipelineSnapshot["jobs"]>,
    history: NonNullable<DashboardPipelineSnapshot["history"]>,
  ): LiveProgressState["tasks"] {
    const latest = [...history, ...jobs].sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
    const byStage = new Map(latest.map((job) => [job.stage ?? job.status, job]));
    const stages: Array<{ id: string; label: string; stage: string }> = [
      { id: "analyze", label: "Product analysis", stage: "analysis" },
      { id: "story", label: "Storyboard prep", stage: "storyboard" },
      { id: "render", label: "Render queue", stage: "rendering" },
      { id: "export", label: "Export packaging", stage: "export" },
    ];
    return stages.map((stage) => {
      const job = byStage.get(stage.stage) ?? jobs.find((item) => item.stage === stage.stage);
      if (!job) {
        return { id: stage.id, label: stage.label, status: "waiting" as const, progress: 0 };
      }
      const status = job.status === "completed" ? "completed"
        : job.status === "running" ? "running"
          : "waiting";
      return { id: stage.id, label: stage.label, status, progress: job.progress ?? (status === "completed" ? 100 : 0) };
    });
  }

  private recommendation(
    core: DashboardCoreStatus | null,
    project: string | null,
    progress: LiveProgressState,
    memory?: DashboardMemoryHealth | null,
  ): string {
    const fromMemory = creativeAiLine();
    if (fromMemory) return fromMemory;
    if (!core) return "Gateway status is unavailable. Confirm the public application can reach the local Core.";
    if (!project) return "Create or open a project to unlock AI-guided production recommendations.";
    if (!core.aiCore) return "AI Core is offline. Local workspace tools remain available.";
    if (progress.running > 0) return "Production is active. Review Production Queue or Command Center for live jobs.";
    if (memory && !memory.ready) return "Memory/knowledge center is not ready. System Health has diagnostics.";
    return "Ready for product intake, image organization, and production planning.";
  }
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

export const dashboardLiveEngine = new DashboardLiveEngine();
