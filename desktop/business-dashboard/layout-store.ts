import type { DashboardLayout, DashboardWidgetId } from "./types";

const KEY = "kwizera.business-dashboard.layout.v1";
const fallback: DashboardLayout = { hidden: [], compact: [] };

export class DashboardLayoutManager {
  load(): DashboardLayout {
    try { return { ...fallback, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") }; } catch { return fallback; }
  }
  save(layout: DashboardLayout): void { localStorage.setItem(KEY, JSON.stringify(layout)); }
  toggleVisibility(layout: DashboardLayout, widget: DashboardWidgetId): DashboardLayout {
    const hidden = layout.hidden.includes(widget) ? layout.hidden.filter((id) => id !== widget) : [...layout.hidden, widget];
    return { ...layout, hidden };
  }
  toggleDensity(layout: DashboardLayout, widget: DashboardWidgetId): DashboardLayout {
    const compact = layout.compact.includes(widget) ? layout.compact.filter((id) => id !== widget) : [...layout.compact, widget];
    return { ...layout, compact };
  }
}