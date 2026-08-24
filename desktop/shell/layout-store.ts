import type { BottomPanelTab, LegacyWorkspaceId, PanelDefinition, ShellLayoutState, WorkspaceId } from "./types";
import { ALL_WORKSPACE_IDS } from "./types";
import { createDefaultPanels } from "./panel-engine";

const STORAGE_KEY = "kwizera.desktop-workspace.v2";
const LEGACY_KEY = "kwizera.desktop-workspace.v1";

const LEGACY_MAP: Record<LegacyWorkspaceId | "settings" | "marketing", WorkspaceId> = {
  dashboard: "home",
  projects: "open-project",
  products: "production",
  media: "asset-library",
  brand: "marketing",
  ai: "ai-me",
  editor: "production",
  marketing: "marketing",
  video: "generated-videos",
  image: "generated-images",
  intelligence: "reports",
  knowledge: "knowledge-center",
  memory: "knowledge-center",
  platform: "settings",
  settings: "settings",
};

export const defaultShellLayout: ShellLayoutState = {
  workspace: "home",
  leftCollapsed: false,
  rightOpen: true,
  rightCollapsed: false,
  bottomExpanded: false,
  bottomHeight: 200,
  bottomTab: "activity",
  zen: false,
  panels: createDefaultPanels(),
};

function migrateWorkspace(raw: string): WorkspaceId {
  if (raw in LEGACY_MAP) return LEGACY_MAP[raw as keyof typeof LEGACY_MAP];
  return ALL_WORKSPACE_IDS.includes(raw as WorkspaceId) ? (raw as WorkspaceId) : "home";
}

function loadLegacy(): Partial<ShellLayoutState> | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { workspace?: string; leftCollapsed?: boolean; rightOpen?: boolean; zen?: boolean };
    return {
      workspace: migrateWorkspace(parsed.workspace ?? "home"),
      leftCollapsed: parsed.leftCollapsed,
      rightOpen: parsed.rightOpen,
      zen: parsed.zen,
    };
  } catch {
    return null;
  }
}

export class ShellLayoutManager {
  load(): ShellLayoutState {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<ShellLayoutState>;
      const legacy = Object.keys(stored).length === 0 ? loadLegacy() : null;
      const merged = { ...defaultShellLayout, ...legacy, ...stored };
      merged.workspace = migrateWorkspace(merged.workspace);
      merged.panels = mergePanels(defaultShellLayout.panels, stored.panels);
      return merged;
    } catch {
      return { ...defaultShellLayout };
    }
  }

  save(layout: ShellLayoutState): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  }

  patch(current: ShellLayoutState, changes: Partial<ShellLayoutState>): ShellLayoutState {
    return { ...current, ...changes };
  }

  setBottomTab(layout: ShellLayoutState, tab: BottomPanelTab): ShellLayoutState {
    return { ...layout, bottomTab: tab, bottomExpanded: true };
  }

  toggleBottom(layout: ShellLayoutState): ShellLayoutState {
    return { ...layout, bottomExpanded: !layout.bottomExpanded };
  }
}

function mergePanels(defaults: PanelDefinition[], stored?: PanelDefinition[]): PanelDefinition[] {
  if (!stored?.length) return defaults;
  const byId = new Map(stored.map((p) => [p.id, p]));
  const merged = defaults.map((d) => ({ ...d, ...byId.get(d.id) }));
  for (const panel of stored) {
    if (!merged.some((p) => p.id === panel.id)) merged.push(panel);
  }
  return merged;
}

export const shellLayoutManager = new ShellLayoutManager();
