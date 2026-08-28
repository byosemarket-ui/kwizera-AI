import type { DashboardLayoutV2, DashboardWidgetId, WidgetKind, WidgetPlacement } from "./types";

const STORAGE_KEY = "kwizera.dashboard.widgets.v2";
const LEGACY_KEY = "kwizera.business-dashboard.layout.v1";

const LEGACY_MAP: Record<string, DashboardWidgetId> = {
  kpis: "statistics",
  ai: "ai-recommendation",
  activity: "last-activity",
  projects: "recent-production",
  health: "system-health",
  notifications: "notifications",
  actions: "quick-actions",
};

export const DEFAULT_WIDGETS: WidgetPlacement[] = [
  { id: "live-status", x: 1, y: 1, w: 12, h: 2, pinned: true, locked: false, hidden: false, compact: false, kind: "statistics" },
  { id: "active-project", x: 1, y: 3, w: 4, h: 3, pinned: false, locked: false, hidden: false, compact: false, kind: "information" },
  { id: "current-workspace", x: 5, y: 3, w: 4, h: 3, pinned: false, locked: false, hidden: false, compact: false, kind: "information" },
  { id: "ai-recommendation", x: 9, y: 3, w: 4, h: 3, pinned: false, locked: false, hidden: false, compact: false, kind: "ai" },
  { id: "last-activity", x: 1, y: 6, w: 6, h: 3, pinned: false, locked: false, hidden: false, compact: false, kind: "notification" },
  { id: "recent-production", x: 7, y: 6, w: 6, h: 3, pinned: false, locked: false, hidden: false, compact: false, kind: "preview" },
  { id: "system-health", x: 1, y: 9, w: 4, h: 3, pinned: false, locked: false, hidden: false, compact: false, kind: "statistics" },
  { id: "statistics", x: 5, y: 9, w: 4, h: 3, pinned: false, locked: false, hidden: false, compact: false, kind: "statistics" },
  { id: "quick-actions", x: 9, y: 9, w: 4, h: 3, pinned: false, locked: false, hidden: false, compact: false, kind: "action" },
  { id: "production-modules", x: 1, y: 12, w: 8, h: 4, pinned: false, locked: true, hidden: true, compact: false, kind: "preview" },
  { id: "reserved-panels", x: 9, y: 12, w: 4, h: 4, pinned: false, locked: true, hidden: true, compact: false, kind: "preview" },
  { id: "notifications", x: 1, y: 16, w: 12, h: 2, pinned: false, locked: false, hidden: false, compact: true, kind: "notification" },
];

export const defaultDashboardLayout: DashboardLayoutV2 = {
  version: 3,
  columns: 12,
  widgets: DEFAULT_WIDGETS,
};

function migrateLegacy(): Partial<DashboardLayoutV2> | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const legacy = JSON.parse(raw) as { hidden?: string[]; compact?: string[] };
    const widgets = DEFAULT_WIDGETS.map((w) => {
      const legacyId = Object.entries(LEGACY_MAP).find(([, v]) => v === w.id)?.[0];
      const hidden = legacy.hidden?.includes(legacyId ?? w.id) ?? false;
      const compact = legacy.compact?.includes(legacyId ?? w.id) ?? w.compact;
      return { ...w, hidden, compact };
    });
    return { widgets };
  } catch {
    return null;
  }
}

function mergeWidgets(defaults: WidgetPlacement[], stored?: WidgetPlacement[]): WidgetPlacement[] {
  if (!stored?.length) return defaults;
  const byId = new Map(stored.map((w) => [w.id, w]));
  return defaults.map((d) => ({ ...d, ...byId.get(d.id) }));
}

function hideDecorativePlaceholders(widgets: WidgetPlacement[], version?: number): WidgetPlacement[] {
  if (version === 3) return widgets;
  return widgets.map((widget) => (
    widget.id === "production-modules" || widget.id === "reserved-panels"
      ? { ...widget, hidden: true }
      : widget
  ));
}

export class DashboardWidgetStore {
  load(): DashboardLayoutV2 {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<DashboardLayoutV2>;
      const legacy = !stored.widgets?.length ? migrateLegacy() : null;
      const widgets = hideDecorativePlaceholders(
        mergeWidgets(DEFAULT_WIDGETS, stored.widgets ?? legacy?.widgets),
        stored.version,
      );
      return {
        ...defaultDashboardLayout,
        ...legacy,
        ...stored,
        version: 3,
        widgets,
      };
    } catch {
      return { ...defaultDashboardLayout };
    }
  }

  save(layout: DashboardLayoutV2): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  }

  visibleWidgets(layout: DashboardLayoutV2): WidgetPlacement[] {
    return layout.widgets.filter((w) => !w.hidden).sort((a, b) => a.y - b.y || a.x - b.x);
  }

  updateWidget(layout: DashboardLayoutV2, id: DashboardWidgetId, patch: Partial<WidgetPlacement>): DashboardLayoutV2 {
    return {
      ...layout,
      widgets: layout.widgets.map((w) => (w.id === id ? { ...w, ...patch } : w)),
    };
  }

  moveWidget(layout: DashboardLayoutV2, id: DashboardWidgetId, x: number, y: number): DashboardLayoutV2 {
    const widget = layout.widgets.find((w) => w.id === id);
    if (!widget || widget.locked) return layout;
    return this.updateWidget(layout, id, {
      x: Math.max(1, Math.min(layout.columns - widget.w + 1, x)),
      y: Math.max(1, y),
    });
  }

  resizeWidget(layout: DashboardLayoutV2, id: DashboardWidgetId, w: number, h: number): DashboardLayoutV2 {
    const widget = layout.widgets.find((item) => item.id === id);
    if (!widget || widget.locked) return layout;
    return this.updateWidget(layout, id, {
      w: Math.max(2, Math.min(layout.columns - widget.x + 1, w)),
      h: Math.max(2, h),
    });
  }

  togglePin(layout: DashboardLayoutV2, id: DashboardWidgetId): DashboardLayoutV2 {
    const widget = layout.widgets.find((w) => w.id === id);
    if (!widget) return layout;
    return this.updateWidget(layout, id, { pinned: !widget.pinned });
  }

  toggleLock(layout: DashboardLayoutV2, id: DashboardWidgetId): DashboardLayoutV2 {
    const widget = layout.widgets.find((w) => w.id === id);
    if (!widget) return layout;
    return this.updateWidget(layout, id, { locked: !widget.locked });
  }

  toggleHidden(layout: DashboardLayoutV2, id: DashboardWidgetId): DashboardLayoutV2 {
    const widget = layout.widgets.find((w) => w.id === id);
    if (!widget) return layout;
    return this.updateWidget(layout, id, { hidden: !widget.hidden });
  }

  toggleCompact(layout: DashboardLayoutV2, id: DashboardWidgetId): DashboardLayoutV2 {
    const widget = layout.widgets.find((w) => w.id === id);
    if (!widget) return layout;
    return this.updateWidget(layout, id, { compact: !widget.compact });
  }
}

export const dashboardWidgetStore = new DashboardWidgetStore();

export const WIDGET_LABELS: Record<DashboardWidgetId, { title: string; detail: string; kind: WidgetKind }> = {
  "active-project": { title: "Active Project", detail: "Current production context", kind: "information" },
  "last-activity": { title: "Last Activity", detail: "Recent workspace events", kind: "notification" },
  "ai-recommendation": { title: "AI Recommendation", detail: "AI Me suggestions", kind: "ai" },
  "recent-production": { title: "Recent Production", detail: "Latest project work", kind: "preview" },
  "system-health": { title: "System Health", detail: "Local runtime readiness", kind: "statistics" },
  "current-workspace": { title: "Current Workspace", detail: "Active studio surface", kind: "information" },
  "live-status": { title: "Live Status", detail: "Real-time production signals", kind: "statistics" },
  "production-modules": { title: "Production Dashboard", detail: "Future module slots", kind: "preview" },
  "reserved-panels": { title: "Reserved Panels", detail: "Architecture placeholders", kind: "preview" },
  "quick-actions": { title: "Quick Actions", detail: "Navigate production", kind: "action" },
  statistics: { title: "Statistics", detail: "Workspace metrics", kind: "statistics" },
  notifications: { title: "Notifications", detail: "Dashboard alerts", kind: "notification" },
};
