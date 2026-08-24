import type {
  FutureModuleId, NavGroupId, WorkspaceId, WorkspaceModuleSlot, WorkspaceNavItem,
} from "./types";
import { ALL_WORKSPACE_IDS } from "./types";
import { FUTURE_MODULE_SLOTS } from "./panel-engine";

export const workspaceNav: WorkspaceNavItem[] = [
  { id: "home", label: "Home", group: "dashboard", groupLabel: "Dashboard", keywords: ["dashboard", "home", "overview"] },

  { id: "new-project", label: "New Project", group: "projects", groupLabel: "Projects", keywords: ["new", "create", "project", "intake", "import", "images"], shortcut: "Ctrl+N" },
  { id: "open-project", label: "Open Project", group: "projects", groupLabel: "Projects", keywords: ["open", "projects", "files"], shortcut: "Ctrl+O" },
  { id: "recent-projects", label: "Recent Projects", group: "projects", groupLabel: "Projects", keywords: ["recent", "history", "projects"] },

  { id: "knowledge-center", label: "Knowledge Center", group: "knowledge", groupLabel: "Knowledge", keywords: ["knowledge", "center", "memory"] },
  { id: "knowledge-packs", label: "Knowledge Packs", group: "knowledge", groupLabel: "Knowledge", keywords: ["packs", "import", "knowledge"] },
  { id: "knowledge-search", label: "Knowledge Search", group: "knowledge", groupLabel: "Knowledge", keywords: ["search", "query", "knowledge"] },
  { id: "ai-me", label: "AI Me", group: "knowledge", groupLabel: "Knowledge", keywords: ["ai", "assistant", "conversation"], shortcut: "Ctrl+Shift+A" },

  { id: "production", label: "Production", group: "production", groupLabel: "Production", keywords: ["production", "editor", "create"] },
  { id: "pipeline", label: "Pipeline", group: "production", groupLabel: "Production", keywords: ["pipeline", "flow", "stages"] },
  { id: "queue", label: "Queue", group: "production", groupLabel: "Production", keywords: ["queue", "jobs", "tasks"] },
  { id: "active-production", label: "Active Production", group: "production", groupLabel: "Production", keywords: ["active", "live", "running"] },

  { id: "storyboard", label: "Storyboard", group: "creative", groupLabel: "Creative", keywords: ["storyboard", "scenes", "story"] },
  { id: "marketing", label: "Marketing Input", group: "creative", groupLabel: "Creative", keywords: ["marketing", "campaign", "brand", "cta", "audience", "brief", "platform"] },

  { id: "asset-library", label: "Asset Library", group: "assets", groupLabel: "Assets", keywords: ["assets", "library", "media"] },
  { id: "image-organization", label: "Image Organization", group: "assets", groupLabel: "Assets", keywords: ["organize", "views", "front", "classification", "product images"] },
  { id: "product-information", label: "Product Information", group: "assets", groupLabel: "Assets", keywords: ["product", "profile", "price", "sku", "description", "specifications", "variants"] },
  { id: "product-validation", label: "Live Validation", group: "assets", groupLabel: "Assets", keywords: ["validation", "readiness", "review", "production package", "handoff"] },
  { id: "generated-images", label: "Generated Images", group: "assets", groupLabel: "Assets", keywords: ["images", "generated", "visual"] },
  { id: "generated-videos", label: "Generated Videos", group: "assets", groupLabel: "Assets", keywords: ["videos", "generated", "motion"] },
  { id: "generated-audio", label: "Generated Audio", group: "assets", groupLabel: "Assets", keywords: ["audio", "sound", "voice"] },

  { id: "output", label: "Outputs", group: "outputs", groupLabel: "Outputs", keywords: ["output", "results"] },
  { id: "exports", label: "Exports", group: "outputs", groupLabel: "Outputs", keywords: ["export", "download", "deliver"] },
  { id: "reports", label: "Reports", group: "outputs", groupLabel: "Outputs", keywords: ["reports", "analytics", "intelligence"] },
  { id: "history", label: "History", group: "outputs", groupLabel: "Outputs", keywords: ["history", "timeline", "past"] },

  { id: "settings", label: "Settings", group: "system", groupLabel: "Settings", keywords: ["settings", "preferences", "config"], shortcut: "Ctrl+," },
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
  "open-project": "live",
  "recent-projects": "partial",
  "knowledge-center": "placeholder",
  "knowledge-packs": "placeholder",
  "knowledge-search": "placeholder",
  "ai-me": "live",
  production: "partial",
  pipeline: "placeholder",
  queue: "placeholder",
  "active-production": "placeholder",
  storyboard: "placeholder",
  marketing: "live",
  "asset-library": "live",
  "image-organization": "live",
  "product-information": "live",
  "product-validation": "live",
  "generated-images": "placeholder",
  "generated-videos": "placeholder",
  "generated-audio": "placeholder",
  output: "placeholder",
  exports: "placeholder",
  reports: "live",
  history: "placeholder",
  settings: "placeholder",
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
