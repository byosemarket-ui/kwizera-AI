import type { LayoutManagerState, MultiMonitorConfig, ShellLayoutState } from "../types";
import { panelEngine } from "./panel-engine";
import { workspaceLayoutManager } from "./layout-manager";

export interface AiMeLayoutContext {
  activeLayoutId: string;
  activeLayoutName: string;
  floatingPanels: string[];
  dockedPanels: string[];
  hiddenPanels: string[];
  lockedPanels: string[];
  pinnedPanels: string[];
  recommendation: string;
  multiMonitor: MultiMonitorConfig;
  explanation: string;
}

export const defaultMultiMonitorConfig: MultiMonitorConfig = {
  enabled: false,
  primaryId: 0,
  secondaryPrepared: true,
  displays: [
    { id: 0, label: "Primary Display", primary: true },
    { id: 1, label: "Secondary Display (prepared)", primary: false },
  ],
};

export function buildAiMeLayoutContext(
  shell: ShellLayoutState,
  layoutState: LayoutManagerState,
  multiMonitor: MultiMonitorConfig = defaultMultiMonitorConfig,
): AiMeLayoutContext {
  const active = workspaceLayoutManager.getActive(layoutState);
  const floating = panelEngine.getFloatingPanels(shell).map((p) => p.label);
  const docked = shell.panels.filter((p) => p.mode === "docked").map((p) => p.label);
  const hidden = shell.panels.filter((p) => p.mode === "hidden").map((p) => p.label);
  const locked = shell.panels.filter((p) => p.locked).map((p) => p.label);
  const pinned = shell.panels.filter((p) => p.pinned).map((p) => p.label);
  const recommendation = panelEngine.recommendLayout(shell);

  const explanation = [
    `Active workspace layout: ${active.name}.`,
    `Docked panels: ${docked.slice(0, 6).join(", ") || "none"}.`,
    floating.length ? `Floating windows: ${floating.join(", ")}.` : "No floating windows.",
    pinned.length ? `Pinned: ${pinned.join(", ")}.` : "",
    `Layout recommendation: ${recommendation}`,
    multiMonitor.secondaryPrepared
      ? "Secondary monitor architecture is prepared for independent floating panels."
      : "",
    "Ask me to switch to Creative, Production, Rendering, or Review layouts anytime.",
  ].filter(Boolean).join(" ");

  return {
    activeLayoutId: active.id,
    activeLayoutName: active.name,
    floatingPanels: floating,
    dockedPanels: docked,
    hiddenPanels: hidden,
    lockedPanels: locked,
    pinnedPanels: pinned,
    recommendation,
    multiMonitor,
    explanation,
  };
}

export function explainPanelForAiMe(panelId: string, shell: ShellLayoutState): string {
  const panel = panelEngine.getPanel(shell, panelId);
  if (!panel) return `Panel "${panelId}" is not registered.`;
  return `${panel.label} is ${panel.mode} in the ${panel.zone} zone${panel.locked ? " (locked)" : ""}${panel.pinned ? " (pinned)" : ""}.`;
}
