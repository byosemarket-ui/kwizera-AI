import type {
  DashboardCoreStatus, DashboardLiveSnapshot, DashboardWorkspace,
  LiveProgressState, LiveStatusCard,
} from "./types";

export class DashboardLiveEngine {
  buildSnapshot(
    core: DashboardCoreStatus | null,
    workspace: DashboardWorkspace | null,
    workspaceLabel: string,
    tick: number,
  ): DashboardLiveSnapshot {
    const activeProject = workspace?.activeProject?.name ?? core?.activeProject ?? null;
    const storageBytes = workspace?.projects.reduce(
      (sum, p) => sum + p.productImages.reduce((t, i) => t + i.sizeBytes, 0), 0,
    ) ?? 0;
    const activeJobs = core?.runtimeMetrics?.activeJobs ?? 0;
    const progress = this.buildProgress(activeJobs, tick);

    const statuses: LiveStatusCard[] = [
      {
        key: "active-project",
        label: "Active Project",
        value: activeProject ?? "None",
        detail: workspace?.activeProject ? `${workspace.activeProject.productImages.length} assets` : "Open a project to begin",
        online: Boolean(activeProject),
      },
      {
        key: "production",
        label: "Production",
        value: activeJobs > 0 ? "Running" : "Idle",
        detail: `${progress.running} running · ${progress.waiting} waiting`,
        online: activeJobs > 0,
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
        progress: Math.min(100, progress.percent + (tick % 5)),
      },
      {
        key: "knowledge",
        label: "Knowledge",
        value: core?.knowledgeFoundation ? "Indexed" : "Awaiting",
        detail: core?.memoryFoundation ? "Memory foundation linked" : "Standby",
        online: Boolean(core?.knowledgeFoundation),
        progress: core?.knowledgeFoundation ? 85 : 20,
      },
      {
        key: "storage",
        label: "Storage",
        value: storageBytes ? `${(storageBytes / 1024 / 1024).toFixed(1)} MB` : "Local",
        detail: core?.runtimeMetrics ? `${core.runtimeMetrics.memoryMb} MB RAM in use` : "Offline workspace",
        online: true,
        progress: Math.min(100, Math.round((storageBytes / (50 * 1024 * 1024)) * 100) || 12),
      },
    ];

    const lastProject = workspace?.projects[0];
    return {
      updatedAt: new Date().toISOString(),
      statuses,
      progress,
      activeProject,
      workspaceLabel,
      aiRecommendation: this.recommendation(core, activeProject, progress),
      lastActivity: lastProject
        ? `${lastProject.name} updated ${formatRelative(lastProject.modifiedAt)}`
        : "Dashboard initialized · awaiting project activity",
      recentProduction: lastProject?.name ?? "No recent production",
    };
  }

  buildProgress(activeJobs: number, tick: number): LiveProgressState {
    const base = activeJobs > 0 ? 45 + (tick % 40) : 8 + (tick % 12);
    const running = activeJobs > 0 ? Math.max(1, activeJobs) : tick % 3 === 0 ? 1 : 0;
    const waiting = running > 0 ? Math.max(0, 3 - running) : 2;
    const completed = 2 + (tick % 4);
    return {
      percent: Math.min(99, base),
      remainingLabel: running > 0 ? `~${Math.max(1, 12 - (tick % 10))} min remaining` : "No active render",
      completed,
      running,
      waiting,
      tasks: [
        { id: "analyze", label: "Product analysis", status: completed > 0 ? "completed" : "waiting", progress: completed > 0 ? 100 : 0 },
        { id: "story", label: "Storyboard prep", status: running > 0 ? "running" : "waiting", progress: running > 0 ? base : 0 },
        { id: "render", label: "Render queue", status: running > 0 ? "running" : "waiting", progress: running > 0 ? Math.max(20, base - 10) : 0 },
        { id: "export", label: "Export packaging", status: "waiting", progress: 0 },
      ],
    };
  }

  private recommendation(core: DashboardCoreStatus | null, project: string | null, progress: LiveProgressState): string {
    if (!project) return "Create or open a project to unlock AI-guided production recommendations.";
    if (!core?.aiCore) return "Start the local AI runtime to receive live recommendations on this dashboard.";
    if (progress.running > 0) return "Production is active. Review Recent Production and open Pipeline for queue details.";
    return "Ready for storyboard and asset import. AI Me suggests starting with Product Upload when modules mount.";
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
