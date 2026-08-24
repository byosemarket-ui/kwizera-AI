import type {
  DockEdge, FloatablePanelId, FutureModuleId, PanelDefinition, PanelMode, PanelZone, ShellLayoutState,
} from "./types";

export const FUTURE_MODULE_SLOTS: Array<{ id: FutureModuleId; label: string; description: string }> = [
  { id: "product-input", label: "Product Input", description: "Reserved for product brief and asset intake" },
  { id: "product-analysis", label: "Product Analysis", description: "Reserved for AI product understanding" },
  { id: "marketing", label: "Marketing", description: "Reserved for campaign and positioning modules" },
  { id: "storyboard", label: "Storyboard", description: "Reserved for scene planning and boards" },
  { id: "image-generation", label: "Image Generation", description: "Reserved for visual production" },
  { id: "audio-generation", label: "Audio Generation", description: "Reserved for voice and sound" },
  { id: "video-generation", label: "Video Generation", description: "Reserved for motion production" },
  { id: "rendering", label: "Rendering", description: "Reserved for export pipeline" },
  { id: "output-preview", label: "Output Preview", description: "Reserved for final preview surface" },
];

export const FLOATABLE_PANELS: Array<{ id: FloatablePanelId; label: string; defaultWidth: number; defaultHeight: number }> = [
  { id: "ai-assist", label: "AI Me", defaultWidth: 360, defaultHeight: 480 },
  { id: "live-preview", label: "Live Preview", defaultWidth: 480, defaultHeight: 360 },
  { id: "product-analysis", label: "Product Analysis", defaultWidth: 400, defaultHeight: 420 },
  { id: "asset-browser", label: "Asset Browser", defaultWidth: 380, defaultHeight: 440 },
  { id: "timeline", label: "Timeline", defaultWidth: 640, defaultHeight: 220 },
  { id: "logs", label: "Logs", defaultWidth: 420, defaultHeight: 280 },
  { id: "hardware-monitor", label: "Hardware Monitor", defaultWidth: 320, defaultHeight: 260 },
];

const MIN_WIDTH = 180;
const MIN_HEIGHT = 100;
const SNAP_THRESHOLD = 24;

export function createDefaultPanels(): PanelDefinition[] {
  const floatables: PanelDefinition[] = FLOATABLE_PANELS.filter((p) => p.id !== "ai-assist").map((p, index) => ({
    id: p.id,
    label: p.label,
    zone: "float" as PanelZone,
    mode: "hidden" as PanelMode,
    width: p.defaultWidth,
    height: p.defaultHeight,
    defaultWidth: p.defaultWidth,
    defaultHeight: p.defaultHeight,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    floatX: 80 + index * 28,
    floatY: 80 + index * 28,
    locked: false,
    pinned: false,
    floatable: true,
    order: 10 + index,
    zIndex: 20 + index,
  }));

  return [
    {
      id: "production-main", label: "Production Workspace", zone: "center", mode: "docked",
      locked: false, pinned: true, order: 0, minWidth: 320, minHeight: 240,
    },
    {
      id: "ai-assist", label: "AI Me", zone: "right", mode: "docked",
      width: 276, defaultWidth: 276, minWidth: 220, maxWidth: 480,
      height: 480, defaultHeight: 480, minHeight: 200,
      locked: false, pinned: false, floatable: true, order: 0, zIndex: 30,
    },
    {
      id: "bottom-activity", label: "Activity Timeline", zone: "bottom", mode: "docked",
      height: 200, defaultHeight: 200, minHeight: 120, maxHeight: 420,
      locked: false, order: 0,
    },
    {
      id: "nav-sidebar", label: "Navigation", zone: "left", mode: "docked",
      width: 232, defaultWidth: 232, minWidth: 58, maxWidth: 320,
      locked: false, pinned: false, order: 0,
    },
    ...floatables,
    ...FUTURE_MODULE_SLOTS.map((slot, index) => ({
      id: `slot-${slot.id}`,
      label: slot.label,
      zone: "center" as PanelZone,
      mode: "hidden" as PanelMode,
      locked: true,
      order: index + 1,
      moduleSlot: slot.id,
    })),
  ];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function zoneFromEdge(edge: DockEdge): PanelZone {
  return edge === "center" ? "center" : edge;
}

/** Prevent two panels occupying the same dock zone in docked mode (except center allows main only). */
function clearZoneOccupancy(layout: ShellLayoutState, zone: PanelZone, exceptId: string): ShellLayoutState {
  if (zone === "float" || zone === "center") return layout;
  return {
    ...layout,
    panels: layout.panels.map((p) => {
      if (p.id === exceptId || p.zone !== zone || p.mode !== "docked") return p;
      return { ...p, mode: "hidden" as PanelMode };
    }),
  };
}

export class PanelEngine {
  getPanel(layout: ShellLayoutState, id: string): PanelDefinition | undefined {
    return layout.panels.find((p) => p.id === id);
  }

  getPanelsInZone(layout: ShellLayoutState, zone: PanelZone): PanelDefinition[] {
    return layout.panels
      .filter((p) => p.zone === zone && p.mode !== "hidden" && p.mode !== "minimized")
      .sort((a, b) => a.order - b.order);
  }

  getFloatingPanels(layout: ShellLayoutState): PanelDefinition[] {
    return layout.panels
      .filter((p) => p.mode === "floating")
      .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
  }

  updatePanel(layout: ShellLayoutState, id: string, changes: Partial<PanelDefinition>): ShellLayoutState {
    return {
      ...layout,
      panels: layout.panels.map((p) => (p.id === id ? { ...p, ...changes } : p)),
    };
  }

  setMode(layout: ShellLayoutState, id: string, mode: PanelMode): ShellLayoutState {
    const panel = this.getPanel(layout, id);
    if (!panel || panel.locked) return layout;
    return this.updatePanel(layout, id, { mode });
  }

  setZone(layout: ShellLayoutState, id: string, zone: PanelZone): ShellLayoutState {
    const panel = this.getPanel(layout, id);
    if (!panel || panel.locked) return layout;
    let next = clearZoneOccupancy(layout, zone, id);
    return this.updatePanel(next, id, { zone, mode: zone === "float" ? "floating" : "docked", collapsed: false, maximized: false });
  }

  dockPanel(layout: ShellLayoutState, id: string, edge: DockEdge): ShellLayoutState {
    const panel = this.getPanel(layout, id);
    if (!panel || panel.locked) return layout;
    const zone = zoneFromEdge(edge);
    let next = clearZoneOccupancy(layout, zone, id);
    next = this.updatePanel(next, id, {
      zone,
      mode: "docked",
      collapsed: false,
      maximized: false,
      floatX: undefined,
      floatY: undefined,
    });
    return this.syncShellFromPanels(next);
  }

  /** Snap float position to nearest dock edge when within threshold; otherwise keep floating. */
  autoDock(layout: ShellLayoutState, id: string, viewport = { width: 1280, height: 800 }): ShellLayoutState {
    const panel = this.getPanel(layout, id);
    if (!panel || panel.mode !== "floating" || panel.locked) return layout;
    const x = panel.floatX ?? 0;
    const y = panel.floatY ?? 0;
    const w = panel.width ?? panel.defaultWidth ?? 320;
    const h = panel.height ?? panel.defaultHeight ?? 240;

    if (x <= SNAP_THRESHOLD) return this.dockPanel(layout, id, "left");
    if (viewport.width - (x + w) <= SNAP_THRESHOLD) return this.dockPanel(layout, id, "right");
    if (y <= SNAP_THRESHOLD) return this.dockPanel(layout, id, "top");
    if (viewport.height - (y + h) <= SNAP_THRESHOLD) return this.dockPanel(layout, id, "bottom");
    return this.snapAlign(layout, id);
  }

  /** Snap float coords to a 8px grid to avoid visual overlap drift. */
  snapAlign(layout: ShellLayoutState, id: string, grid = 8): ShellLayoutState {
    const panel = this.getPanel(layout, id);
    if (!panel || panel.mode !== "floating") return layout;
    const floatX = Math.round((panel.floatX ?? 0) / grid) * grid;
    const floatY = Math.round((panel.floatY ?? 0) / grid) * grid;
    return this.preventFloatOverlap(this.updatePanel(layout, id, { floatX, floatY }), id);
  }

  preventFloatOverlap(layout: ShellLayoutState, movingId: string): ShellLayoutState {
    const moving = this.getPanel(layout, movingId);
    if (!moving || moving.mode !== "floating") return layout;
    const mx = moving.floatX ?? 0;
    const my = moving.floatY ?? 0;
    const mw = moving.width ?? 320;
    const mh = moving.height ?? 240;
    let offset = 0;
    for (const other of this.getFloatingPanels(layout)) {
      if (other.id === movingId) continue;
      const ox = other.floatX ?? 0;
      const oy = other.floatY ?? 0;
      const ow = other.width ?? 320;
      const oh = other.height ?? 240;
      const overlap = mx < ox + ow && mx + mw > ox && my < oy + oh && my + mh > oy;
      if (overlap) offset += 28;
    }
    if (!offset) return layout;
    return this.updatePanel(layout, movingId, { floatX: mx + offset, floatY: my + offset });
  }

  floatPanel(layout: ShellLayoutState, id: string, position?: { x: number; y: number }): ShellLayoutState {
    const panel = this.getPanel(layout, id);
    if (!panel || panel.locked) return layout;
    const meta = FLOATABLE_PANELS.find((p) => p.id === id);
    const maxZ = Math.max(0, ...layout.panels.map((p) => p.zIndex ?? 0));
    let next = this.updatePanel(layout, id, {
      zone: "float",
      mode: "floating",
      floatX: position?.x ?? panel.floatX ?? 96,
      floatY: position?.y ?? panel.floatY ?? 96,
      width: panel.width ?? panel.defaultWidth ?? meta?.defaultWidth ?? 360,
      height: panel.height ?? panel.defaultHeight ?? meta?.defaultHeight ?? 320,
      collapsed: false,
      maximized: false,
      zIndex: maxZ + 1,
      floatable: true,
    });
    next = this.preventFloatOverlap(next, id);
    return this.syncShellFromPanels(next);
  }

  resizePanel(layout: ShellLayoutState, id: string, size: { width?: number; height?: number }): ShellLayoutState {
    const panel = this.getPanel(layout, id);
    if (!panel || panel.locked || panel.mode === "fullscreen" || panel.maximized) return layout;
    const width = size.width !== undefined
      ? clamp(size.width, panel.minWidth ?? MIN_WIDTH, panel.maxWidth ?? 1200)
      : panel.width;
    const height = size.height !== undefined
      ? clamp(size.height, panel.minHeight ?? MIN_HEIGHT, panel.maxHeight ?? 900)
      : panel.height;
    return this.updatePanel(layout, id, { width, height });
  }

  moveFloating(layout: ShellLayoutState, id: string, x: number, y: number): ShellLayoutState {
    const panel = this.getPanel(layout, id);
    if (!panel || panel.mode !== "floating" || panel.locked) return layout;
    return this.updatePanel(layout, id, { floatX: Math.max(0, x), floatY: Math.max(0, y) });
  }

  maximizePanel(layout: ShellLayoutState, id: string): ShellLayoutState {
    const panel = this.getPanel(layout, id);
    if (!panel || panel.locked) return layout;
    return this.updatePanel(layout, id, { maximized: true, mode: panel.mode === "floating" ? "floating" : "fullscreen", collapsed: false });
  }

  minimizePanel(layout: ShellLayoutState, id: string): ShellLayoutState {
    const panel = this.getPanel(layout, id);
    if (!panel || panel.locked) return layout;
    return this.updatePanel(layout, id, { mode: "minimized", maximized: false });
  }

  collapsePanel(layout: ShellLayoutState, id: string): ShellLayoutState {
    const panel = this.getPanel(layout, id);
    if (!panel || panel.locked) return layout;
    return this.updatePanel(layout, id, { collapsed: true, mode: panel.mode === "floating" ? "floating" : "collapsed" });
  }

  expandPanel(layout: ShellLayoutState, id: string): ShellLayoutState {
    const panel = this.getPanel(layout, id);
    if (!panel || panel.locked) return layout;
    const mode: PanelMode = panel.zone === "float" ? "floating" : "docked";
    return this.updatePanel(layout, id, { collapsed: false, mode, maximized: false });
  }

  restoreDefaultSize(layout: ShellLayoutState, id: string): ShellLayoutState {
    const panel = this.getPanel(layout, id);
    if (!panel || panel.locked) return layout;
    return this.updatePanel(layout, id, {
      width: panel.defaultWidth ?? panel.width,
      height: panel.defaultHeight ?? panel.height,
      maximized: false,
      collapsed: false,
      mode: panel.zone === "float" ? "floating" : "docked",
    });
  }

  toggleLock(layout: ShellLayoutState, id: string): ShellLayoutState {
    const panel = this.getPanel(layout, id);
    if (!panel) return layout;
    return this.updatePanel(layout, id, { locked: !panel.locked });
  }

  togglePin(layout: ShellLayoutState, id: string): ShellLayoutState {
    const panel = this.getPanel(layout, id);
    if (!panel) return layout;
    return this.updatePanel(layout, id, { pinned: !panel.pinned });
  }

  toggleFullscreen(layout: ShellLayoutState, id: string): ShellLayoutState {
    const panel = this.getPanel(layout, id);
    if (!panel || panel.locked) return layout;
    if (panel.mode === "fullscreen" || panel.maximized) {
      return this.restoreDefaultSize(layout, id);
    }
    return this.maximizePanel(layout, id);
  }

  showPanel(layout: ShellLayoutState, id: string): ShellLayoutState {
    const panel = this.getPanel(layout, id);
    if (!panel) return layout;
    const mode: PanelMode = panel.zone === "float" ? "floating" : "docked";
    return this.syncShellFromPanels(this.updatePanel(layout, id, { mode, collapsed: false }));
  }

  hidePanel(layout: ShellLayoutState, id: string): ShellLayoutState {
    const panel = this.getPanel(layout, id);
    if (!panel || panel.pinned) return layout;
    return this.syncShellFromPanels(this.updatePanel(layout, id, { mode: "hidden" }));
  }

  setAutoHide(layout: ShellLayoutState, id: string, autoHide: boolean): ShellLayoutState {
    return this.updatePanel(layout, id, { autoHide });
  }

  /** Keep shell region flags in sync with panel modes for live UI. */
  syncShellFromPanels(layout: ShellLayoutState): ShellLayoutState {
    const ai = this.getPanel(layout, "ai-assist");
    const bottom = this.getPanel(layout, "bottom-activity");
    const nav = this.getPanel(layout, "nav-sidebar");
    return {
      ...layout,
      rightOpen: ai ? ai.mode === "docked" && ai.zone === "right" : layout.rightOpen,
      rightCollapsed: ai?.collapsed ?? layout.rightCollapsed,
      bottomExpanded: bottom ? bottom.mode === "docked" && !bottom.collapsed : layout.bottomExpanded,
      bottomHeight: bottom?.height ?? layout.bottomHeight,
      leftCollapsed: nav ? nav.collapsed || nav.width === nav.minWidth : layout.leftCollapsed,
    };
  }

  visiblePanelIds(layout: ShellLayoutState): string[] {
    return layout.panels.filter((p) => p.mode !== "hidden" && p.mode !== "minimized").map((p) => p.id);
  }

  recommendLayout(layout: ShellLayoutState): string {
    const floating = this.getFloatingPanels(layout).length;
    const hidden = layout.panels.filter((p) => p.mode === "hidden").length;
    if (floating > 3) return "Too many floating windows — dock AI Me and Timeline for a cleaner Production layout.";
    if (!layout.rightOpen && floating === 0) return "Enable the AI Me panel (dock right or float) for guided production.";
    if (hidden > 8) return "Many panels are hidden — try the Creative or Review workspace layout.";
    return "Current layout is balanced. Save it as a custom layout if you want to reuse it.";
  }
}

export const panelEngine = new PanelEngine();
