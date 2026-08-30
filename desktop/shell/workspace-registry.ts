import type {
  FutureModuleId, NavGroupId, WorkspaceId, WorkspaceModuleSlot, WorkspaceNavItem,
} from "./types";
import { ALL_WORKSPACE_IDS } from "./types";
import { FUTURE_MODULE_SLOTS } from "./panel-engine";

export const workspaceNav: WorkspaceNavItem[] = [
  { id: "home", label: "Home", group: "dashboard", groupLabel: "Dashboard", keywords: ["dashboard", "home", "overview"] },

  { id: "new-project", label: "Product Setup", group: "projects", groupLabel: "Projects", keywords: ["new", "create", "project", "intake", "import", "images", "product setup", "step 1"], shortcut: "Ctrl+N" },
  { id: "video-requirements", label: "Video Requirements", group: "projects", groupLabel: "Projects", keywords: ["video requirements", "step 2", "platform", "duration"], inSidebar: false },
  { id: "open-project", label: "Open Project", group: "projects", groupLabel: "Projects", keywords: ["open", "projects", "files"], shortcut: "Ctrl+O" },
  { id: "recent-projects", label: "Recent Projects", group: "projects", groupLabel: "Projects", keywords: ["recent", "history", "projects"] },

  { id: "knowledge-center", label: "Knowledge Center", group: "knowledge", groupLabel: "Knowledge", keywords: ["knowledge", "center", "memory"] },
  { id: "knowledge-packs", label: "Knowledge Packs", group: "knowledge", groupLabel: "Knowledge", keywords: ["packs", "import", "knowledge"], inSidebar: false },
  { id: "knowledge-search", label: "Knowledge Search", group: "knowledge", groupLabel: "Knowledge", keywords: ["search", "query", "knowledge"] },
  { id: "ai-me", label: "AI Me", group: "knowledge", groupLabel: "Knowledge", keywords: ["ai", "assistant", "conversation"], shortcut: "Ctrl+Shift+A" },

  { id: "production", label: "Production", group: "production", groupLabel: "Production", keywords: ["production", "editor", "create"] },
  { id: "pipeline", label: "Production Plan", group: "production", groupLabel: "Production", keywords: ["pipeline", "flow", "stages", "production plan", "pre-production", "snapshot", "phase 4", "readiness"] },
  { id: "queue", label: "Production Queue", group: "production", groupLabel: "Production", keywords: ["queue", "jobs", "tasks", "orchestration", "production job", "phase 5", "ready to execute"] },
  { id: "active-production", label: "Active Production", group: "production", groupLabel: "Production", keywords: ["active", "live", "running", "pipeline engine", "start production", "phase 5", "execute"] },
  { id: "command-center", label: "Command Center", group: "production", groupLabel: "Production", keywords: ["command center", "monitor", "live", "progress", "resource", "gpu", "cpu", "logs", "phase 5", "step 3"] },

  { id: "storyboard", label: "Creative Planner", group: "creative", groupLabel: "Creative", keywords: ["storyboard", "scenes", "story", "script", "creative planner", "blueprint", "phase 4"] },
  { id: "marketing", label: "Marketing Input", group: "creative", groupLabel: "Creative", keywords: ["marketing", "campaign", "brand", "cta", "audience", "brief", "platform"] },
  { id: "marketing-strategy", label: "Marketing Strategy", group: "creative", groupLabel: "Creative", keywords: ["strategy", "campaign", "positioning", "usp", "angle", "cta", "phase 4"] },

  { id: "asset-library", label: "Asset Library", group: "assets", groupLabel: "Assets", keywords: ["assets", "library", "media"] },
  { id: "image-organization", label: "Image Organization", group: "assets", groupLabel: "Assets", keywords: ["organize", "views", "front", "classification", "product images"], inSidebar: false },
  { id: "product-information", label: "Product Information", group: "assets", groupLabel: "Assets", keywords: ["product", "profile", "price", "sku", "description", "specifications", "variants"], inSidebar: false },
  { id: "product-validation", label: "Live Validation", group: "assets", groupLabel: "Assets", keywords: ["validation", "readiness", "review", "production package", "handoff"] },
  { id: "visual-analysis", label: "AI Visual Analysis", group: "assets", groupLabel: "Assets", keywords: ["analysis", "visual", "detection", "background", "color", "logo", "intelligence"] },
  { id: "deep-intelligence", label: "Product Intelligence", group: "assets", groupLabel: "Assets", keywords: ["intelligence", "cross-validation", "identity", "features", "consistency", "inference"] },
  { id: "market-research", label: "Product Research", group: "assets", groupLabel: "Assets", keywords: ["research", "market", "customer", "knowledge", "insights", "online", "offline"] },
  { id: "master-intelligence", label: "Master Intelligence", group: "assets", groupLabel: "Assets", keywords: ["master", "creative brief", "claim safety", "intelligence report", "phase 3", "content production"] },
  { id: "generated-images", label: "Generated Images", group: "assets", groupLabel: "Assets", keywords: ["images", "generated", "visual"], inSidebar: false },
  { id: "generated-videos", label: "Video Production", group: "assets", groupLabel: "Assets", keywords: ["videos", "generated", "motion", "timeline", "render", "ffmpeg"] },
  { id: "generated-audio", label: "Generated Audio", group: "assets", groupLabel: "Assets", keywords: ["audio", "sound", "voice"], inSidebar: false },

  { id: "output", label: "Final Outputs", group: "outputs", groupLabel: "Outputs", keywords: ["output", "results", "final", "render", "export", "phase 5", "step 4", "qc", "thumbnail"] },
  { id: "exports", label: "Exports", group: "outputs", groupLabel: "Outputs", keywords: ["export", "download", "deliver", "final package", "phase 5"] },
  { id: "creative-review", label: "Creative Review", group: "outputs", groupLabel: "Outputs", keywords: ["review", "preview", "approve", "feedback", "creative review", "phase 6", "qc preview"] },
  { id: "reports", label: "Reports", group: "outputs", groupLabel: "Outputs", keywords: ["reports", "analytics", "intelligence"] },
  { id: "history", label: "History", group: "outputs", groupLabel: "Outputs", keywords: ["history", "timeline", "past", "production history", "versions"] },

  { id: "settings", label: "Settings", group: "system", groupLabel: "Settings", keywords: ["settings", "preferences", "config"], shortcut: "Ctrl+," },
  { id: "system-health", label: "System Health", group: "system", groupLabel: "Settings", keywords: ["health", "diagnostics", "repair", "update", "windows", "monitor"] },
  { id: "help", label: "Help", group: "system", groupLabel: "Settings", keywords: ["help", "docs", "guide", "support"] },
];

export const NAV_GROUP_ORDER: NavGroupId[] = [
  "dashboard", "projects", "knowledge", "production", "creative", "assets", "outputs", "system",
];

export function getNavItem(id: WorkspaceId): WorkspaceNavItem {
  return workspaceNav.find((item) => item.id === id) ?? workspaceNav[0];
}

export function getNavByGroup(): Array<{ group: NavGroupId; label: string; items: WorkspaceNavItem[] }> {
  return NAV_GROUP_ORDER.map((group) => {
    const items = workspaceNav.filter((item) => item.group === group);
    return { group, label: items[0]?.groupLabel ?? group, items };
  }).filter((entry) => entry.items.length > 0);
}

/** Primary sidebar: Core / Creative / Production / System. Remaining routes stay searchable. */
export const SIDEBAR_SECTIONS: Array<{ group: NavGroupId; label: string; ids: WorkspaceId[] }> = [
  { group: "dashboard", label: "Core", ids: ["home", "ai-me", "new-project", "open-project", "production"] },
  {
    group: "assets",
    label: "Creative / Assets",
    ids: ["visual-analysis", "deep-intelligence", "storyboard", "generated-videos"],
  },
  {
    group: "production",
    label: "Production",
    ids: ["pipeline", "queue", "active-production", "command-center", "output"],
  },
  { group: "system", label: "System", ids: ["system-health", "knowledge-center", "settings"] },
];

export function getSidebarNavByGroup(): Array<{ group: NavGroupId; label: string; items: WorkspaceNavItem[] }> {
  return SIDEBAR_SECTIONS.map((section) => ({
    group: section.group,
    label: section.label,
    items: section.ids.map((id) => getNavItem(id)),
  }));
}

export function getFutureModuleSlots(): WorkspaceModuleSlot[] {
  return FUTURE_MODULE_SLOTS.map((slot) => ({
    id: slot.id,
    label: slot.label,
    description: slot.description,
    reserved: true as const,
  }));
}

export type WorkspaceTier = "live" | "partial" | "placeholder";

export const workspaceTiers: Record<WorkspaceId, WorkspaceTier> = {
  home: "live",
  "new-project": "live",
  "video-requirements": "partial",
  "open-project": "live",
  "recent-projects": "partial",
  "knowledge-center": "live",
  "knowledge-packs": "placeholder",
  "knowledge-search": "live",
  "ai-me": "live",
  production: "partial",
  pipeline: "live",
  queue: "live",
  "active-production": "live",
  "command-center": "live",
  storyboard: "live",
  marketing: "live",
  "marketing-strategy": "live",
  "asset-library": "live",
  "image-organization": "live",
  "product-information": "live",
  "product-validation": "live",
  "visual-analysis": "live",
  "deep-intelligence": "live",
  "market-research": "live",
  "master-intelligence": "live",
  "generated-images": "placeholder",
  "generated-videos": "live",
  "generated-audio": "placeholder",
  output: "live",
  exports: "live",
  "creative-review": "live",
  reports: "live",
  history: "live",
  settings: "placeholder",
  "system-health": "live",
  help: "placeholder",
};

const LEGACY_NAV_MAP: Record<string, WorkspaceId> = {
  dashboard: "home",
  projects: "open-project",
  products: "production",
  media: "asset-library",
  brand: "marketing",
  ai: "ai-me",
  editor: "production",
  video: "generated-videos",
  image: "generated-images",
  intelligence: "reports",
  knowledge: "knowledge-center",
  memory: "knowledge-center",
  platform: "settings",
  settings: "settings",
  marketing: "marketing",
};

export function mapLegacyWorkspace(id: string): WorkspaceId {
  if (id in LEGACY_NAV_MAP) return LEGACY_NAV_MAP[id];
  return ALL_WORKSPACE_IDS.includes(id as WorkspaceId) ? (id as WorkspaceId) : "home";
}

export function isFutureModule(id: string): id is FutureModuleId {
  return FUTURE_MODULE_SLOTS.some((s) => s.id === id);
}

export function isWorkspaceId(id: string): id is WorkspaceId {
  return ALL_WORKSPACE_IDS.includes(id as WorkspaceId);
}
