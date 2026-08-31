import {
  Activity, BarChart3, BookOpen, Bot, Clapperboard, Download, Eye, FileAudio, FileImage,
  FileVideo, FolderOpen, FolderPlus, Gauge, HeartPulse, HelpCircle, History, Home, Layers,
  Library, ListOrdered, Megaphone, Package, Search, Settings, ShieldCheck, Sparkles, Tag,
  Workflow, Brain, Globe, FileText,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ALL_WORKSPACE_IDS, type WorkspaceId } from "./types";

/** Sidebar / navigation icon for every workspace route. Missing entries cause React error #130. */
export const NAV_ICONS: Record<WorkspaceId, LucideIcon> = {
  home: Home,
  "new-project": FolderPlus,
  "video-requirements": Clapperboard,
  "video-style": Sparkles,
  "final-video-review": Eye,
  "open-project": FolderOpen,
  "recent-projects": History,
  "knowledge-center": BookOpen,
  "knowledge-packs": Library,
  "knowledge-search": Search,
  "ai-me": Sparkles,
  production: Bot,
  pipeline: Workflow,
  queue: ListOrdered,
  "active-production": Activity,
  "command-center": Gauge,
  storyboard: Clapperboard,
  marketing: Layers,
  "marketing-strategy": Megaphone,
  "asset-library": Package,
  "image-organization": Layers,
  "product-information": Tag,
  "product-validation": ShieldCheck,
  "visual-analysis": Eye,
  "deep-intelligence": Brain,
  "market-research": Globe,
  "master-intelligence": FileText,
  "generated-images": FileImage,
  "generated-videos": FileVideo,
  "generated-audio": FileAudio,
  output: Download,
  exports: Download,
  "creative-review": Eye,
  reports: BarChart3,
  history: History,
  settings: Settings,
  "system-health": HeartPulse,
  help: HelpCircle,
};

export function isNavIconComponent(icon: unknown): icon is LucideIcon {
  return typeof icon === "function" || (typeof icon === "object" && icon !== null);
}

export function resolveNavIcon(id: WorkspaceId): LucideIcon {
  const icon = NAV_ICONS[id];
  return isNavIconComponent(icon) ? icon : Sparkles;
}

/** Dev/test guard — every workspace id must map to a valid component. */
export function assertNavIconsComplete(): void {
  for (const id of ALL_WORKSPACE_IDS) {
    if (!isNavIconComponent(NAV_ICONS[id])) {
      throw new Error(`Missing nav icon for workspace: ${id}`);
    }
  }
}
