import type { AiMeDashboardContext, DashboardLayoutV2, DashboardLiveSnapshot } from "./types";
import { dashboardWidgetStore } from "./widget-store";

export function buildAiMeDashboardContext(
  layout: DashboardLayoutV2,
  live: DashboardLiveSnapshot,
): AiMeDashboardContext {
  const visible = dashboardWidgetStore.visibleWidgets(layout);
  const pinned = visible.filter((w) => w.pinned).map((w) => w.id);
  const locked = visible.filter((w) => w.locked).map((w) => w.id);

  const explanation = [
    "You are on the KWIZERA AI STUDIO professional dashboard.",
    `${visible.length} widgets are visible in a ${layout.columns}-column layout.`,
    pinned.length ? `Pinned widgets: ${pinned.join(", ")}.` : "",
    live.activeProject ? `Active project: ${live.activeProject}.` : "No active project selected.",
    `AI recommendation: ${live.aiRecommendation}`,
    `Production progress: ${live.progress.percent}% with ${live.progress.running} running tasks.`,
    "I can guide you to any widget or production module from here.",
  ].filter(Boolean).join(" ");

  return {
    layout: {
      columns: layout.columns,
      visibleWidgets: visible.map((w) => w.id),
      pinnedWidgets: pinned,
      lockedWidgets: locked,
    },
    live: {
      activeProject: live.activeProject,
      workspaceLabel: live.workspaceLabel,
      aiRecommendation: live.aiRecommendation,
      lastActivity: live.lastActivity,
    },
    progress: live.progress,
    explanation,
  };
}

export function guideDashboardWidget(widgetId: string): string {
  return `The "${widgetId}" widget is on your dashboard home. Use Personalize to show, hide, pin, or resize it. Locked widgets stay fixed for layout stability.`;
}

export function serializeAiMeDashboardContext(ctx: AiMeDashboardContext): Record<string, unknown> {
  return {
    dashboardLayout: ctx.layout,
    dashboardLive: ctx.live,
    dashboardProgress: ctx.progress,
    dashboardExplanation: ctx.explanation,
  };
}
