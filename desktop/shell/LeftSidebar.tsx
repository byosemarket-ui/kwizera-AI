import {
  Activity, BarChart3, BookOpen, Bot, ChevronDown, ChevronLeft, ChevronRight, Clapperboard,
  Download, FileAudio, FileImage, FileVideo, FolderOpen, FolderPlus, Gauge, HeartPulse, HelpCircle, History,
  Home, Layers, Library, ListOrdered, MoreHorizontal, Package, Pin, PinOff, Search, Settings,
  ShieldCheck, Sparkles, Star, Tag, Workflow, Eye, Brain, Globe, FileText, Megaphone,
} from "lucide-react";
import type { WorkspaceId } from "./types";
import { useShell } from "./ShellContext";
import { getNavByGroup, getNavItem } from "./workspace-registry";

const navIcons: Record<WorkspaceId, typeof Home> = {
  home: Home,
  "new-project": FolderPlus,
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

interface LeftSidebarProps {
  onPreferencesOpen: () => void;
  onNewProject?: () => void;
}

export function LeftSidebar({ onPreferencesOpen, onNewProject }: LeftSidebarProps) {
  const {
    layout, switchWorkspace, setLayout, navigation, setNavigation, toggleFavorite, notify,
  } = useShell();
  const groups = getNavByGroup();

  const handleSelect = (id: WorkspaceId, action?: "navigate" | "modal") => {
    if (action === "modal" || id === "new-project") {
      onNewProject?.();
      switchWorkspace("new-project");
      return;
    }
    switchWorkspace(id);
  };

  const togglePin = () => {
    setNavigation((current) => ({ ...current, pinned: !current.pinned }));
    notify("info", navigation.pinned ? "Sidebar unpinned" : "Sidebar pinned", "Pin keeps the sidebar expanded across sessions.");
  };

  return (
    <aside className={`left-sidebar shell-left-sidebar ${navigation.pinned ? "pinned" : ""}`} aria-label="Workspace navigation">
      <div className="sidebar-top">
        <span className="sidebar-caption">Navigation</span>
        <div className="sidebar-top-actions">
          <button
            className="icon-button"
            title={navigation.pinned ? "Unpin sidebar" : "Pin sidebar"}
            onClick={togglePin}
            aria-pressed={navigation.pinned}
          >
            {navigation.pinned ? <PinOff size={14} /> : <Pin size={14} />}
          </button>
          {!navigation.pinned && (
            <button
              className="sidebar-collapse icon-button"
              onClick={() => setLayout({ leftCollapsed: !layout.leftCollapsed })}
              title={layout.leftCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!layout.leftCollapsed}
            >
              {layout.leftCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          )}
        </div>
      </div>

      {!layout.leftCollapsed && navigation.favorites.length > 0 && (
        <div className="nav-quick-section">
          <span className="nav-group">Favorites</span>
          {navigation.favorites.map((id) => {
            const item = getNavItem(id);
            const Icon = navIcons[id];
            return (
              <button
                key={`fav-${id}`}
                className={`nav-item ${layout.workspace === id ? "active" : ""}`}
                onClick={() => handleSelect(id, item.action)}
              >
                <Icon size={16} />
                <span>{item.label}</span>
                <Star size={12} className="nav-star filled" />
              </button>
            );
          })}
        </div>
      )}

      {!layout.leftCollapsed && (navigation.quickAccess?.length ?? 0) > 0 && (
        <div className="nav-quick-section">
          <span className="nav-group">Frequent</span>
          {(navigation.quickAccess ?? []).slice(0, 5).map((id) => {
            const item = getNavItem(id);
            const Icon = navIcons[id];
            return (
              <button
                key={`freq-${id}`}
                className={`nav-item ${layout.workspace === id ? "active" : ""}`}
                onClick={() => handleSelect(id, item.action)}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {!layout.leftCollapsed && navigation.recent.length > 0 && (
        <div className="nav-quick-section">
          <span className="nav-group">Recently Used</span>
          {navigation.recent.slice(0, 5).map((id) => {
            const item = getNavItem(id);
            const Icon = navIcons[id];
            return (
              <button
                key={`recent-${id}`}
                className={`nav-item ${layout.workspace === id ? "active" : ""}`}
                onClick={() => handleSelect(id, item.action)}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}

      <nav className="nav-tree">
        {groups.map(({ group, label, items }) => {
          const collapsed = navigation.collapsedGroups.includes(group);
          return (
            <div key={group} className="nav-group-block">
              <button
                className="nav-group-toggle"
                onClick={() => setNavigation((current) => ({
                  ...current,
                  collapsedGroups: collapsed
                    ? current.collapsedGroups.filter((g) => g !== group)
                    : [...current.collapsedGroups, group],
                }))}
                aria-expanded={!collapsed}
              >
                <span className="nav-group">{label}</span>
                {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
              </button>
              {!collapsed && items.map((item) => {
                const Icon = navIcons[item.id];
                const fav = navigation.favorites.includes(item.id);
                return (
                  <div key={item.id} className="nav-item-row">
                    <button
                      className={`nav-item ${layout.workspace === item.id ? "active" : ""}`}
                      onClick={() => handleSelect(item.id, item.action)}
                      onKeyDown={(event) => {
                        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                          event.preventDefault();
                          const buttons = Array.from(
                            event.currentTarget.closest("nav")?.querySelectorAll<HTMLButtonElement>(".nav-item") ?? [],
                          );
                          const index = buttons.indexOf(event.currentTarget);
                          const next = event.key === "ArrowDown" ? buttons[index + 1] : buttons[index - 1];
                          next?.focus();
                        }
                      }}
                      aria-current={layout.workspace === item.id ? "page" : undefined}
                      title={item.shortcut ? `${item.label} (${item.shortcut})` : item.label}
                    >
                      <Icon size={18} />
                      <span>{item.label}</span>
                    </button>
                    <button
                      className={`nav-fav-toggle ${fav ? "active" : ""}`}
                      title={fav ? "Remove favorite" : "Add favorite"}
                      onClick={() => toggleFavorite(item.id)}
                    >
                      <Star size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <button className="nav-item" onClick={onPreferencesOpen}>
          <MoreHorizontal size={18} />
          <span>Desktop preferences</span>
        </button>
      </div>
    </aside>
  );
}

export function getActiveWorkspaceLabel(workspace: WorkspaceId): string {
  return getNavItem(workspace).label;
}
