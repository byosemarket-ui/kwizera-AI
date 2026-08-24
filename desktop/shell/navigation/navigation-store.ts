import type { NavGroupId, NavigationState, QuickActionId, WorkspaceId } from "../types";
import { isWorkspaceId } from "../workspace-registry";

const STORAGE_KEY = "kwizera.desktop-navigation.v1";

export const defaultNavigationState: NavigationState = {
  favorites: ["home", "ai-me", "production"],
  recent: ["home"],
  pinned: false,
  collapsedGroups: [],
  history: [{ workspace: "home", at: new Date().toISOString() }],
  visitCounts: { home: 1 },
  lastVisitedAt: {},
  recentPanels: [],
  quickAccess: ["home", "production", "ai-me"],
  commandCounts: {},
  frequentProjects: [],
  frequentAssets: [],
  frequentAiActions: [],
  favoriteTemplates: [],
  selectedViews: {},
};

function safeRead(): NavigationState {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<NavigationState>;
    const visitCounts = { ...(parsed.visitCounts ?? defaultNavigationState.visitCounts) };
    const lastVisitedAt = { ...(parsed.lastVisitedAt ?? {}) };
    return {
      ...defaultNavigationState,
      ...parsed,
      favorites: (parsed.favorites ?? defaultNavigationState.favorites).filter(isWorkspaceId),
      recent: (parsed.recent ?? defaultNavigationState.recent).filter(isWorkspaceId),
      collapsedGroups: parsed.collapsedGroups ?? [],
      history: (parsed.history ?? defaultNavigationState.history)
        .filter((entry) => isWorkspaceId(entry.workspace))
        .slice(0, 40),
      visitCounts,
      lastVisitedAt,
      recentPanels: (parsed.recentPanels ?? []).slice(0, 20),
      quickAccess: (parsed.quickAccess ?? defaultNavigationState.quickAccess).filter(isWorkspaceId),
      commandCounts: { ...(parsed.commandCounts ?? {}) },
      frequentProjects: (parsed.frequentProjects ?? []).slice(0, 12),
      frequentAssets: (parsed.frequentAssets ?? []).slice(0, 12),
      frequentAiActions: (parsed.frequentAiActions ?? []).slice(0, 12),
      favoriteTemplates: (parsed.favoriteTemplates ?? []).slice(0, 12),
      selectedViews: { ...(parsed.selectedViews ?? {}) },
    };
  } catch {
    return { ...defaultNavigationState, visitCounts: { ...defaultNavigationState.visitCounts } };
  }
}

export class NavigationStore {
  load(): NavigationState {
    return safeRead();
  }

  save(state: NavigationState): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  visit(state: NavigationState, workspace: WorkspaceId): NavigationState {
    const at = new Date().toISOString();
    const recent = [workspace, ...state.recent.filter((id) => id !== workspace)].slice(0, 12);
    const history = [{ workspace, at }, ...state.history].slice(0, 40);
    const visitCounts = {
      ...state.visitCounts,
      [workspace]: (state.visitCounts[workspace] ?? 0) + 1,
    };
    const lastVisitedAt = { ...state.lastVisitedAt, [workspace]: at };
    const ranked = this.rankFrequentWorkspaces({ ...state, visitCounts, lastVisitedAt });
    const quickAccess = mergeUnique(state.quickAccess, ranked).slice(0, 8);
    return { ...state, recent, history, visitCounts, lastVisitedAt, quickAccess };
  }

  recordPanel(state: NavigationState, panelId: string): NavigationState {
    const recentPanels = [panelId, ...state.recentPanels.filter((id) => id !== panelId)].slice(0, 20);
    return { ...state, recentPanels };
  }

  recordCommand(state: NavigationState, commandId: QuickActionId): NavigationState {
    const commandCounts = {
      ...state.commandCounts,
      [commandId]: (state.commandCounts[commandId] ?? 0) + 1,
    };
    return { ...state, commandCounts };
  }

  recordProject(state: NavigationState, projectName: string): NavigationState {
    if (!projectName) return state;
    const frequentProjects = [projectName, ...state.frequentProjects.filter((p) => p !== projectName)].slice(0, 12);
    return { ...state, frequentProjects };
  }

  recordAsset(state: NavigationState, assetName: string): NavigationState {
    if (!assetName) return state;
    const frequentAssets = [assetName, ...state.frequentAssets.filter((a) => a !== assetName)].slice(0, 12);
    return { ...state, frequentAssets };
  }

  recordAiAction(state: NavigationState, action: string): NavigationState {
    if (!action) return state;
    const frequentAiActions = [action, ...state.frequentAiActions.filter((a) => a !== action)].slice(0, 12);
    return { ...state, frequentAiActions };
  }

  toggleTemplate(state: NavigationState, templateId: string): NavigationState {
    const favoriteTemplates = state.favoriteTemplates.includes(templateId)
      ? state.favoriteTemplates.filter((id) => id !== templateId)
      : [templateId, ...state.favoriteTemplates].slice(0, 12);
    return { ...state, favoriteTemplates };
  }

  setSelectedView(state: NavigationState, surface: string, viewId: string): NavigationState {
    return { ...state, selectedViews: { ...state.selectedViews, [surface]: viewId } };
  }

  rankFrequentWorkspaces(state: NavigationState, limit = 6): WorkspaceId[] {
    return Object.entries(state.visitCounts)
      .filter(([id]) => isWorkspaceId(id))
      .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
      .map(([id]) => id as WorkspaceId)
      .slice(0, limit);
  }

  toggleFavorite(state: NavigationState, workspace: WorkspaceId): NavigationState {
    const favorites = state.favorites.includes(workspace)
      ? state.favorites.filter((id) => id !== workspace)
      : [...state.favorites, workspace];
    return { ...state, favorites };
  }

  togglePin(state: NavigationState): NavigationState {
    return { ...state, pinned: !state.pinned };
  }

  toggleGroup(state: NavigationState, group: NavGroupId): NavigationState {
    const collapsedGroups = state.collapsedGroups.includes(group)
      ? state.collapsedGroups.filter((id) => id !== group)
      : [...state.collapsedGroups, group];
    return { ...state, collapsedGroups };
  }

  isFavorite(state: NavigationState, workspace: WorkspaceId): boolean {
    return state.favorites.includes(workspace);
  }

  isGroupCollapsed(state: NavigationState, group: NavGroupId): boolean {
    return state.collapsedGroups.includes(group);
  }
}

function mergeUnique(primary: WorkspaceId[], secondary: WorkspaceId[]): WorkspaceId[] {
  const seen = new Set<WorkspaceId>();
  const out: WorkspaceId[] = [];
  for (const id of [...primary, ...secondary]) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export const navigationStore = new NavigationStore();
