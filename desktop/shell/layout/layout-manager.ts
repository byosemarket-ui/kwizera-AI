import type {
  LayoutManagerState, PanelDefinition, ShellLayoutState, WorkspaceLayoutPreset, WorkspaceLayoutPresetId,
} from "../types";
import { createDefaultPanels } from "./panel-engine";

const STORAGE_KEY = "kwizera.workspace-layouts.v1";

function now(): string {
  return new Date().toISOString();
}

function snapshotShell(layout: ShellLayoutState): WorkspaceLayoutPreset["shell"] {
  return {
    leftCollapsed: layout.leftCollapsed,
    rightOpen: layout.rightOpen,
    rightCollapsed: layout.rightCollapsed,
    bottomExpanded: layout.bottomExpanded,
    bottomHeight: layout.bottomHeight,
    zen: layout.zen,
  };
}

function clonePanels(panels: PanelDefinition[]): PanelDefinition[] {
  return panels.map((p) => ({ ...p }));
}

function builtin(
  id: string,
  name: string,
  preset: WorkspaceLayoutPresetId,
  customize: (panels: PanelDefinition[], shell: WorkspaceLayoutPreset["shell"]) => void,
): WorkspaceLayoutPreset {
  const panels = createDefaultPanels();
  const shell: WorkspaceLayoutPreset["shell"] = {
    leftCollapsed: false,
    rightOpen: true,
    rightCollapsed: false,
    bottomExpanded: false,
    bottomHeight: 200,
    zen: false,
  };
  customize(panels, shell);
  const stamp = now();
  return { id, name, preset, createdAt: stamp, updatedAt: stamp, shell, panels, isBuiltin: true };
}

function setPanel(panels: PanelDefinition[], id: string, patch: Partial<PanelDefinition>): void {
  const index = panels.findIndex((p) => p.id === id);
  if (index >= 0) panels[index] = { ...panels[index], ...patch };
}

export function createBuiltinLayouts(): WorkspaceLayoutPreset[] {
  return [
    builtin("default", "Default Workspace", "default", () => { /* defaults */ }),
    builtin("product-input", "Product Input Workspace", "product-input", (panels, shell) => {
      setPanel(panels, "ai-assist", { zone: "right", mode: "docked", width: 300 });
      setPanel(panels, "asset-browser", { zone: "left", mode: "docked", width: 280 });
      setPanel(panels, "product-analysis", { mode: "floating", zone: "float", floatX: 420, floatY: 120 });
      setPanel(panels, "nav-sidebar", { mode: "collapsed", collapsed: true, width: 58 });
      shell.leftCollapsed = true;
      shell.rightOpen = true;
      shell.bottomExpanded = false;
    }),
    builtin("marketing", "Marketing Workspace", "marketing", (panels, shell) => {
      setPanel(panels, "ai-assist", { zone: "right", mode: "docked" });
      setPanel(panels, "live-preview", { mode: "floating", zone: "float", floatX: 360, floatY: 100, width: 520, height: 360 });
      setPanel(panels, "bottom-activity", { mode: "docked", height: 160 });
      shell.bottomExpanded = true;
      shell.bottomHeight = 160;
    }),
    builtin("creative", "Creative Workspace", "creative", (panels, shell) => {
      setPanel(panels, "ai-assist", { mode: "floating", zone: "float", floatX: 40, floatY: 80, width: 340, height: 460 });
      setPanel(panels, "timeline", { zone: "bottom", mode: "docked", height: 220 });
      setPanel(panels, "live-preview", { zone: "right", mode: "docked", width: 320 });
      setPanel(panels, "bottom-activity", { mode: "hidden" });
      shell.rightOpen = false;
      shell.bottomExpanded = true;
      shell.bottomHeight = 220;
    }),
    builtin("production", "Production Workspace", "production", (panels, shell) => {
      setPanel(panels, "ai-assist", { zone: "right", mode: "docked", width: 280 });
      setPanel(panels, "timeline", { zone: "bottom", mode: "docked", height: 200 });
      setPanel(panels, "logs", { mode: "floating", zone: "float", floatX: 80, floatY: 480, width: 400, height: 220 });
      setPanel(panels, "bottom-activity", { mode: "hidden" });
      shell.rightOpen = true;
      shell.bottomExpanded = true;
      shell.bottomHeight = 200;
      shell.zen = false;
    }),
    builtin("rendering", "Rendering Workspace", "rendering", (panels, shell) => {
      setPanel(panels, "hardware-monitor", { zone: "right", mode: "docked", width: 300 });
      setPanel(panels, "logs", { zone: "bottom", mode: "docked", height: 240 });
      setPanel(panels, "ai-assist", { mode: "floating", zone: "float", floatX: 60, floatY: 80 });
      setPanel(panels, "bottom-activity", { mode: "hidden" });
      shell.rightOpen = true;
      shell.bottomExpanded = true;
      shell.bottomHeight = 240;
    }),
    builtin("review", "Review Workspace", "review", (panels, shell) => {
      setPanel(panels, "live-preview", { zone: "center", mode: "docked" });
      setPanel(panels, "ai-assist", { zone: "right", mode: "docked", width: 300 });
      setPanel(panels, "timeline", { zone: "bottom", mode: "docked", height: 180 });
      setPanel(panels, "bottom-activity", { mode: "hidden" });
      shell.rightOpen = true;
      shell.bottomExpanded = true;
      shell.bottomHeight = 180;
      shell.leftCollapsed = true;
    }),
  ];
}

function defaultState(): LayoutManagerState {
  const layouts = createBuiltinLayouts();
  return {
    activeLayoutId: "default",
    layouts,
    history: [{ layoutId: "default", at: now(), action: "init" }],
  };
}

function mergeLayouts(builtins: WorkspaceLayoutPreset[], stored: WorkspaceLayoutPreset[]): WorkspaceLayoutPreset[] {
  const custom = stored.filter((l) => !l.isBuiltin);
  const byId = new Map(stored.map((l) => [l.id, l]));
  const mergedBuiltins = builtins.map((b) => {
    const existing = byId.get(b.id);
    return existing && existing.isBuiltin ? { ...b, updatedAt: existing.updatedAt } : b;
  });
  return [...mergedBuiltins, ...custom];
}

export class WorkspaceLayoutManager {
  load(): LayoutManagerState {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<LayoutManagerState>;
      const builtins = createBuiltinLayouts();
      if (!raw.layouts?.length) return defaultState();
      return {
        activeLayoutId: raw.activeLayoutId ?? "default",
        layouts: mergeLayouts(builtins, raw.layouts),
        history: (raw.history ?? []).slice(0, 40),
      };
    } catch {
      return defaultState();
    }
  }

  save(state: LayoutManagerState): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  getActive(state: LayoutManagerState): WorkspaceLayoutPreset {
    return state.layouts.find((l) => l.id === state.activeLayoutId) ?? state.layouts[0];
  }

  applyToShell(shell: ShellLayoutState, preset: WorkspaceLayoutPreset): ShellLayoutState {
    const byId = new Map(preset.panels.map((p) => [p.id, p]));
    const panels = shell.panels.map((p) => ({ ...p, ...byId.get(p.id) }));
    for (const p of preset.panels) {
      if (!panels.some((x) => x.id === p.id)) panels.push({ ...p });
    }
    return {
      ...shell,
      ...preset.shell,
      panels,
    };
  }

  saveLayout(
    state: LayoutManagerState,
    shell: ShellLayoutState,
    options: { id?: string; name: string; preset?: WorkspaceLayoutPresetId },
  ): LayoutManagerState {
    const id = options.id ?? `custom-${Date.now().toString(36)}`;
    const existing = state.layouts.find((l) => l.id === id);
    const entry: WorkspaceLayoutPreset = {
      id,
      name: options.name,
      preset: options.preset ?? existing?.preset ?? "custom",
      createdAt: existing?.createdAt ?? now(),
      updatedAt: now(),
      shell: snapshotShell(shell),
      panels: clonePanels(shell.panels),
      isBuiltin: false,
    };
    const layouts = existing
      ? state.layouts.map((l) => (l.id === id ? entry : l))
      : [...state.layouts, entry];
    return this.pushHistory({ ...state, layouts, activeLayoutId: id }, id, existing ? "save" : "create");
  }

  loadLayout(state: LayoutManagerState, layoutId: string): LayoutManagerState {
    if (!state.layouts.some((l) => l.id === layoutId)) return state;
    return this.pushHistory({ ...state, activeLayoutId: layoutId }, layoutId, "load");
  }

  renameLayout(state: LayoutManagerState, layoutId: string, name: string): LayoutManagerState {
    const target = state.layouts.find((l) => l.id === layoutId);
    if (!target || target.isBuiltin) return state;
    return {
      ...state,
      layouts: state.layouts.map((l) => (l.id === layoutId ? { ...l, name, updatedAt: now() } : l)),
    };
  }

  duplicateLayout(state: LayoutManagerState, layoutId: string, name?: string): LayoutManagerState {
    const source = state.layouts.find((l) => l.id === layoutId);
    if (!source) return state;
    const id = `custom-${Date.now().toString(36)}`;
    const copy: WorkspaceLayoutPreset = {
      ...source,
      id,
      name: name ?? `${source.name} Copy`,
      preset: "custom",
      createdAt: now(),
      updatedAt: now(),
      isBuiltin: false,
      panels: clonePanels(source.panels),
      shell: { ...source.shell },
    };
    return this.pushHistory({ ...state, layouts: [...state.layouts, copy], activeLayoutId: id }, id, "duplicate");
  }

  deleteLayout(state: LayoutManagerState, layoutId: string): LayoutManagerState {
    const target = state.layouts.find((l) => l.id === layoutId);
    if (!target || target.isBuiltin) return state;
    const layouts = state.layouts.filter((l) => l.id !== layoutId);
    const activeLayoutId = state.activeLayoutId === layoutId ? "default" : state.activeLayoutId;
    return this.pushHistory({ ...state, layouts, activeLayoutId }, activeLayoutId, "delete");
  }

  resetToDefault(state: LayoutManagerState): LayoutManagerState {
    const builtins = createBuiltinLayouts();
    const custom = state.layouts.filter((l) => !l.isBuiltin);
    return this.pushHistory({
      ...state,
      layouts: [...builtins, ...custom],
      activeLayoutId: "default",
    }, "default", "reset");
  }

  private pushHistory(state: LayoutManagerState, layoutId: string, action: string): LayoutManagerState {
    return {
      ...state,
      history: [{ layoutId, at: now(), action }, ...state.history].slice(0, 40),
    };
  }
}

export const workspaceLayoutManager = new WorkspaceLayoutManager();
