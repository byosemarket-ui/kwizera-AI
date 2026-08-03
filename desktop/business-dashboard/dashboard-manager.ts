import type { DashboardCoreStatus, DashboardProject, DashboardWidgetId, DashboardWorkspace } from "./types";

export class BusinessDashboardManager {
  async load(): Promise<{ core: DashboardCoreStatus | null; workspace: DashboardWorkspace | null }> {
    const [core, workspace] = await Promise.all([read<DashboardCoreStatus>("/api/desktop-workspace/status"), read<DashboardWorkspace>("/api/workspace")]);
    return { core, workspace };
  }
}

export class WidgetManager {
  readonly ids: DashboardWidgetId[] = ["kpis", "ai", "activity", "projects", "health", "notifications", "actions"];
}

export class DashboardNavigationManager {
  go(workspace: string, navigate: (workspace: string) => void): void { navigate(workspace); }
}

export class KpiWidgetEngine {
  storage(projects: DashboardProject[]): number { return projects.reduce((sum, project) => sum + project.productImages.reduce((total, image) => total + image.sizeBytes, 0), 0); }
}

export class ActivityFeedManager {
  projects(projects: DashboardProject[]): DashboardProject[] { return [...projects].sort((left, right) => right.modifiedAt.localeCompare(left.modifiedAt)).slice(0, 4); }
}

export class RecentProjectManager extends ActivityFeedManager {}
export class AiStatusDashboard { ready(core: DashboardCoreStatus | null): boolean { return Boolean(core?.aiCore); } }
export class SystemHealthDashboard { connected(core: DashboardCoreStatus | null): number { return [core?.aiCore, core?.workflowEngine, core?.memoryFoundation, core?.knowledgeFoundation].filter(Boolean).length; } }
export class NotificationDashboard { systemMessage(core: DashboardCoreStatus | null): string { return core?.aiCore ? "AI Core connected" : "AI Core waiting"; } }
export class QuickActionManager { destinations = ["projects", "ai", "image", "video", "marketing", "knowledge", "settings"]; }
export class DashboardPersonalizationManager { key = "kwizera.business-dashboard.layout.v1"; }

async function read<T>(path: string): Promise<T | null> { try { const response = await fetch(path); return response.ok ? await response.json() as T : null; } catch { return null; } }