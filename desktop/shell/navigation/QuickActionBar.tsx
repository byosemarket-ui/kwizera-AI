import { useMemo, useState } from "react";
import {
  Clapperboard, Download, FileImage, FileVideo, FolderPlus, ImagePlus, MoreHorizontal, Save, ScanSearch, Sparkles,
} from "lucide-react";
import type { QuickActionId, WorkspaceId } from "../types";
import { useShell } from "../ShellContext";
import { personalizationEngine } from "../personalization/personalization-engine";
import { SmartTooltip } from "../ux/SmartTooltip";
import { QUICK_ACTIONS } from "./navigation-engine";

const actionIcons: Record<QuickActionId, typeof Save> = {
  "new-project": FolderPlus,
  "import-images": ImagePlus,
  "analyze-product": ScanSearch,
  "generate-story": Clapperboard,
  "generate-images": FileImage,
  "generate-video": FileVideo,
  render: Sparkles,
  export: Download,
  save: Save,
};

const tipIds: Partial<Record<QuickActionId, string>> = {
  save: "save",
  "new-project": "global-search",
};

const WORKFLOW_PRIMARY: Partial<Record<WorkspaceId, QuickActionId[]>> = {
  "new-project": ["import-images", "analyze-product", "save"],
  "video-requirements": ["save", "export"],
  "video-style": ["save", "export"],
  "final-video-review": ["save", "export"],
};

function filterForWorkspace(workspace: WorkspaceId, actions: typeof QUICK_ACTIONS) {
  const allowed = WORKFLOW_PRIMARY[workspace];
  if (!allowed) return actions;
  const byId = new Map(actions.map((a) => [a.id, a]));
  const primary = allowed.map((id) => byId.get(id)).filter(Boolean) as typeof QUICK_ACTIONS;
  const overflow = actions.filter((a) => !allowed.includes(a.id));
  return { primary, overflow };
}

export function QuickActionBar() {
  const { runQuickAction, navigation, preferences, layout } = useShell();
  const [overflowOpen, setOverflowOpen] = useState(false);
  const ranked = personalizationEngine.getRankedActions(navigation, preferences);
  const filtered = useMemo(
    () => filterForWorkspace(layout.workspace, ranked),
    [layout.workspace, ranked],
  );
  const actions = Array.isArray(filtered) ? filtered : filtered.primary;
  const overflow = Array.isArray(filtered) ? [] : filtered.overflow;

  const renderButton = (action: (typeof QUICK_ACTIONS)[number], compact = false) => {
    const Icon = actionIcons[action.id];
    const button = (
      <button
        key={action.id}
        className={`quick-action-btn${action.id === "save" ? " is-secondary" : ""}${compact ? " is-compact" : ""}`}
        title={action.shortcut ? `${action.detail} (${action.shortcut})` : action.detail}
        onClick={() => {
          runQuickAction(action.id);
          setOverflowOpen(false);
        }}
      >
        <Icon size={14} />
        <span>{action.label}</span>
      </button>
    );
    const tipId = tipIds[action.id];
    if (!tipId || preferences.tooltipsEnabled === false) return button;
    return (
      <SmartTooltip key={action.id} tipId={tipId} enabled={preferences.tooltipsEnabled !== false}>
        {button}
      </SmartTooltip>
    );
  };

  return (
    <div className="quick-action-bar" role="toolbar" aria-label="Quick actions">
      {actions.map((action) => renderButton(action))}
      {overflow.length > 0 && (
        <div className="quick-action-overflow">
          <button
            type="button"
            className="quick-action-btn is-secondary"
            aria-expanded={overflowOpen}
            onClick={() => setOverflowOpen((v) => !v)}
          >
            <MoreHorizontal size={14} />
            <span>More</span>
          </button>
          {overflowOpen && (
            <div className="quick-action-overflow-menu" role="menu">
              {overflow.map((action) => renderButton(action, true))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
