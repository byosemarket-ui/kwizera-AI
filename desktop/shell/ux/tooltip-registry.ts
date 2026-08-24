import type { TooltipSpec } from "./types";

const TOOLTIPS: Record<string, TooltipSpec> = {
  "global-search": {
    id: "global-search",
    purpose: "Find projects, assets, knowledge, and commands instantly.",
    usage: "Press Ctrl+K or click the search field, then type a keyword.",
    expectedResult: "A ranked list of navigation and command matches.",
    relatedActions: ["open-project", "ai-me", "save"],
    shortcut: "Ctrl+K",
  },
  save: {
    id: "save",
    purpose: "Persist workspace, layout, session, and project memory locally.",
    usage: "Press Ctrl+S or use Quick Actions → Save.",
    expectedResult: "Snapshot stored offline without interrupting production.",
    relatedActions: ["restore-workspace", "auto-save"],
    shortcut: "Ctrl+S",
  },
  "ai-me": {
    id: "ai-me",
    purpose: "Open AI Me for workspace guidance and recommendations.",
    usage: "Press Ctrl+Shift+A or open AI Me from navigation.",
    expectedResult: "Contextual explanation of layout, prefs, performance, and UX.",
    relatedActions: ["global-search", "help"],
    shortcut: "Ctrl+Shift+A",
  },
  "toggle-sidebar": {
    id: "toggle-sidebar",
    purpose: "Collapse or expand left navigation for focus.",
    usage: "Press Ctrl+Shift+B or use the sidebar chevron.",
    expectedResult: "More space for the production workspace.",
    relatedActions: ["zen", "layout-manager"],
    shortcut: "Ctrl+Shift+B",
  },
  "layout-manager": {
    id: "layout-manager",
    purpose: "Switch, save, or reset dockable workspace layouts.",
    usage: "Press Ctrl+Shift+L or open Layout Manager from the workspace.",
    expectedResult: "Panels rearrange without losing project state.",
    relatedActions: ["undo", "hardware-monitor"],
    shortcut: "Ctrl+Shift+L",
  },
  undo: {
    id: "undo",
    purpose: "Reverse the last workspace change.",
    usage: "Press Ctrl+Z after layout or preference edits that support undo.",
    expectedResult: "Previous state restored; redo becomes available.",
    relatedActions: ["redo", "save"],
    shortcut: "Ctrl+Z",
  },
  redo: {
    id: "redo",
    purpose: "Re-apply an undone workspace change.",
    usage: "Press Ctrl+Shift+Z or Ctrl+Y.",
    expectedResult: "The undone action returns.",
    relatedActions: ["undo"],
    shortcut: "Ctrl+Shift+Z",
  },
  "performance-mode": {
    id: "performance-mode",
    purpose: "Balance quality vs responsiveness during production.",
    usage: "Open Preferences → Performance and pick a mode.",
    expectedResult: "Background tasks throttle; production stays prioritized.",
    relatedActions: ["hardware-monitor", "auto-save"],
  },
  help: {
    id: "help",
    purpose: "Learn shortcuts, tours, and workspace workflows.",
    usage: "Open Help from navigation or press ? while not typing.",
    expectedResult: "Shortcut guide and interactive tour controls.",
    relatedActions: ["ai-me", "global-search"],
    shortcut: "?",
  },
};

export function getTooltip(id: string): TooltipSpec | null {
  return TOOLTIPS[id] ?? null;
}

export function listTooltips(): TooltipSpec[] {
  return Object.values(TOOLTIPS);
}

export function formatTooltipText(spec: TooltipSpec): string {
  const related = spec.relatedActions.length ? ` Related: ${spec.relatedActions.join(", ")}.` : "";
  const shortcut = spec.shortcut ? ` (${spec.shortcut})` : "";
  return `${spec.purpose} ${spec.usage} Result: ${spec.expectedResult}.${related}${shortcut}`;
}

export function explainToolForAiMe(id: string): string {
  const spec = getTooltip(id);
  if (!spec) return `No registered explanation for “${id}”. Ask AI Me after opening Help.`;
  return [
    `${spec.id}: ${spec.purpose}`,
    `How: ${spec.usage}`,
    `Result: ${spec.expectedResult}`,
    spec.relatedActions.length ? `Try next: ${spec.relatedActions.join(", ")}.` : "",
  ].filter(Boolean).join(" ");
}
