import {
  Clapperboard, Download, FileImage, FileVideo, FolderPlus, ImagePlus, Save, ScanSearch, Sparkles,
} from "lucide-react";
import type { QuickActionId } from "../types";
import { useShell } from "../ShellContext";
import { personalizationEngine } from "../personalization/personalization-engine";
import { SmartTooltip } from "../ux/SmartTooltip";

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

export function QuickActionBar() {
  const { runQuickAction, navigation, preferences } = useShell();
  const actions = personalizationEngine.getRankedActions(navigation, preferences);

  return (
    <div className="quick-action-bar" role="toolbar" aria-label="Quick actions">
      {actions.map((action) => {
        const Icon = actionIcons[action.id];
        const button = (
          <button
            key={action.id}
            className="quick-action-btn"
            title={action.shortcut ? `${action.detail} (${action.shortcut})` : action.detail}
            onClick={() => runQuickAction(action.id)}
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
      })}
    </div>
  );
}
