import type {
  BreadcrumbSegment, CoreStatus, NavigationState, ProjectStatus, QuickActionId,
  SearchCategory, SearchResult, WorkspaceId, WorkspaceStatusSnapshot,
} from "../types";
import { getNavByGroup, getNavItem, workspaceNav } from "../workspace-registry";

export const QUICK_ACTIONS: Array<{
  id: QuickActionId;
  label: string;
  workspace?: WorkspaceId;
  detail: string;
  shortcut?: string;
}> = [
  { id: "new-project", label: "New Project", workspace: "new-project", detail: "Create a project and import product images", shortcut: "Ctrl+N" },
  { id: "import-images", label: "Import Images", workspace: "new-project", detail: "Import product images through product intake" },
  { id: "analyze-product", label: "Analyze Product", workspace: "deep-intelligence", detail: "Open Product Intelligence for the active project" },
  { id: "generate-story", label: "Generate Story", workspace: "storyboard", detail: "Open Creative Planner for storyboard and narrative" },
  { id: "generate-images", label: "Generate Images", workspace: "image-organization", detail: "Open Image Organization — the live image workspace" },
  { id: "generate-video", label: "Generate Video", workspace: "storyboard", detail: "Open Creative Planner — the live story/video planning workspace" },
  { id: "render", label: "Render", workspace: "pipeline", detail: "Open Production Plan and the render pipeline" },
  { id: "export", label: "Export", workspace: "exports", detail: "Open Final Outputs / export packaging" },
  { id: "save", label: "Save", detail: "Save current workspace state", shortcut: "Ctrl+S" },
];

export const KEYBOARD_SHORTCUTS: Array<{ keys: string; action: string; detail: string }> = [
  { keys: "Ctrl+K", action: "global-search", detail: "Open global search" },
  { keys: "Ctrl+,", action: "settings", detail: "Open preferences" },
  { keys: "Ctrl+Shift+B", action: "toggle-sidebar", detail: "Collapse or expand left navigation" },
  { keys: "Ctrl+N", action: "new-project", detail: "New project" },
  { keys: "Ctrl+O", action: "open-project", detail: "Open project" },
  { keys: "Ctrl+S", action: "save", detail: "Save workspace" },
  { keys: "Ctrl+Shift+A", action: "ai-me", detail: "Open AI Me" },
  { keys: "Ctrl+Z", action: "undo", detail: "Undo last workspace change" },
  { keys: "Ctrl+Shift+Z", action: "redo", detail: "Redo workspace change" },
  { keys: "?", action: "shortcut-guide", detail: "Open shortcut guide" },
  { keys: "Alt+←", action: "nav-back", detail: "Previous workspace in history" },
  { keys: "Escape", action: "close-overlay", detail: "Close search, menus, and overlays" },
];

export class NavigationEngine {
  buildBreadcrumb(
    workspace: WorkspaceId,
    projectName?: string | null,
  ): BreadcrumbSegment[] {
    const item = getNavItem(workspace);
    const segments: BreadcrumbSegment[] = [
      { id: "home", label: "Home", workspace: "home" },
    ];

    if (workspace === "home") return segments;

    if (projectName) {
      segments.push({ id: "projects", label: "Projects", workspace: "open-project" });
      segments.push({ id: "project", label: projectName });
    } else {
      segments.push({
        id: `group-${item.group}`,
        label: item.groupLabel,
        workspace: item.group === "projects" ? "open-project"
          : item.group === "knowledge" ? "knowledge-center"
          : item.group === "production" ? "production"
          : item.group === "creative" ? "storyboard"
          : item.group === "assets" ? "asset-library"
          : item.group === "outputs" ? "output"
          : item.group === "system" ? "settings"
          : "home",
      });
    }

    segments.push({ id: workspace, label: item.label, workspace });
    return segments;
  }

  search(
    query: string,
    options?: {
      projectNames?: string[];
      assetHints?: string[];
      knowledgeHints?: string[];
    },
  ): SearchResult[] {
    const q = query.trim().toLowerCase();
    const results: SearchResult[] = [];

    for (const item of workspaceNav) {
      const haystack = `${item.label} ${item.groupLabel} ${item.keywords.join(" ")}`.toLowerCase();
      const score = scoreMatch(haystack, q, item.label.toLowerCase());
      if (!q || score > 0) {
        results.push({
          id: `nav-${item.id}`,
          label: item.label,
          category: "navigation",
          detail: `${item.groupLabel} · Go to workspace`,
          workspace: item.id,
          score: q ? score : 1,
        });
      }
    }

    for (const action of QUICK_ACTIONS) {
      const haystack = `${action.label} ${action.detail} command`.toLowerCase();
      const score = scoreMatch(haystack, q, action.label.toLowerCase());
      if (!q || score > 0) {
        results.push({
          id: `cmd-${action.id}`,
          label: action.label,
          category: "commands",
          detail: action.detail,
          workspace: action.workspace,
          commandId: action.id,
          score: q ? score + 0.1 : 0.9,
        });
      }
    }

    for (const name of options?.projectNames ?? []) {
      const score = scoreMatch(name.toLowerCase(), q, name.toLowerCase());
      if (!q || score > 0) {
        results.push({
          id: `project-${name}`,
          label: name,
          category: "projects",
          detail: "Local project",
          workspace: "open-project",
          score: q ? score + 0.2 : 0.8,
        });
      }
    }

    const categoryHints: Array<{ list: string[]; category: SearchCategory; workspace: WorkspaceId; detail: string }> = [
      { list: options?.assetHints ?? ["Product photos", "Brand assets"], category: "assets", workspace: "asset-library", detail: "Asset library" },
      { list: ["Campaign stills", "Hero frames"], category: "images", workspace: "generated-images", detail: "Generated images" },
      { list: ["Product reel", "Social cut"], category: "videos", workspace: "generated-videos", detail: "Generated videos" },
      { list: options?.knowledgeHints ?? ["Brand guidelines", "Audience insights"], category: "knowledge", workspace: "knowledge-center", detail: "Knowledge center" },
      { list: ["Weekly production report", "Quality summary"], category: "reports", workspace: "reports", detail: "Reports" },
      { list: ["Active SKU", "Product brief", "Product profile"], category: "products", workspace: "product-information", detail: "Product information" },
    ];

    for (const hint of categoryHints) {
      for (const label of hint.list) {
        const score = scoreMatch(label.toLowerCase(), q, label.toLowerCase());
        if (!q || score > 0) {
          results.push({
            id: `${hint.category}-${label}`,
            label,
            category: hint.category,
            detail: hint.detail,
            workspace: hint.workspace,
            score: q ? score : 0.5,
          });
        }
      }
    }

    return results
      .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
      .slice(0, 24);
  }

  getSuggestions(nav: NavigationState): SearchResult[] {
    const frequent = Object.entries(nav.visitCounts ?? {})
      .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
      .map(([id]) => id as WorkspaceId)
      .slice(0, 4);
    const fromFrequent = frequent.map((id) => {
      const item = getNavItem(id);
      return {
        id: `suggest-freq-${id}`,
        label: item.label,
        category: "navigation" as const,
        detail: "Frequently used",
        workspace: id,
        score: 2.5,
      };
    });
    const fromRecent = nav.recent.slice(0, 4).map((id) => {
      const item = getNavItem(id);
      return {
        id: `suggest-recent-${id}`,
        label: item.label,
        category: "navigation" as const,
        detail: "Recently used",
        workspace: id,
        score: 2,
      };
    });
    const fromFavorites = nav.favorites.slice(0, 4).map((id) => {
      const item = getNavItem(id);
      return {
        id: `suggest-fav-${id}`,
        label: item.label,
        category: "navigation" as const,
        detail: "Favorite",
        workspace: id,
        score: 1.5,
      };
    });
    const seen = new Set<string>();
    return [...fromFrequent, ...fromRecent, ...fromFavorites].filter((item) => {
      if (seen.has(item.workspace!)) return false;
      seen.add(item.workspace!);
      return true;
    }).slice(0, 8);
  }

  buildWorkspaceStatus(
    core: CoreStatus | null,
    projectStatus: ProjectStatus,
    zen: boolean,
  ): WorkspaceStatusSnapshot {
    return {
      mode: zen ? "Focus" : "Studio",
      production: projectStatus === "in-production" ? "Active" : projectStatus === "idle" ? "Idle" : projectStatus,
      ai: core?.aiCore ? "Ready" : "Offline",
      offline: true,
      hardware: core?.runtimeMetrics
        ? `${core.runtimeMetrics.memoryMb} MB · ${core.runtimeMetrics.gpu}`
        : "Local hardware",
    };
  }

  resolveQuickAction(id: QuickActionId): typeof QUICK_ACTIONS[number] | undefined {
    return QUICK_ACTIONS.find((action) => action.id === id);
  }

  groupSummary(): string {
    return getNavByGroup().map((g) => `${g.label} (${g.items.length})`).join(", ");
  }
}

function scoreMatch(haystack: string, query: string, label: string): number {
  if (!query) return 0;
  if (label === query) return 10;
  if (label.startsWith(query)) return 8;
  if (haystack.includes(query)) return 5;
  const tokens = query.split(/\s+/).filter(Boolean);
  const hits = tokens.filter((token) => haystack.includes(token)).length;
  return hits ? hits * 2 : 0;
}

export const navigationEngine = new NavigationEngine();
