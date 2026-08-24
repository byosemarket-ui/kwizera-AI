import type { DesktopPreferences } from "../../desktop-polish/types";
import type { AiMeUxContext, UxSnapshot } from "./types";

export function buildAiMeUxContext(
  snapshot: UxSnapshot,
  prefs: Pick<DesktopPreferences, "highContrast" | "reducedMotion" | "fontScale"> | null | undefined,
  pendingConfirm: string | null,
): AiMeUxContext {
  const mistakes: string[] = [];
  if (!snapshot.tooltipsEnabled) mistakes.push("Tooltips are off — re-enable them to learn tools faster.");
  if (!snapshot.tourCompleted) mistakes.push("Workspace tour not completed — start it from Help.");
  if (snapshot.undoDepth === 0 && snapshot.recentActions.length > 8) {
    mistakes.push("You make many changes — remember Ctrl+Z undoes layout edits.");
  }

  const recommendation = mistakes[0]
    ?? (snapshot.showKeyboardHints
      ? "Use ? for the shortcut guide and Ctrl+Shift+A for AI Me when navigating feels slow."
      : "Enable keyboard hints in preferences to surface faster workflows.");

  const explanation = [
    `UX engine active · focus ${snapshot.focusMode} · undo ${snapshot.undoDepth} / redo ${snapshot.redoDepth}.`,
    prefs?.highContrast ? "High contrast is on." : "Standard contrast.",
    prefs?.reducedMotion ? "Reduced motion is on." : "",
    `Font scale ${prefs?.fontScale ?? 100}%.`,
    pendingConfirm ? `Confirm pending: ${pendingConfirm}.` : "No destructive confirmation pending.",
    snapshot.multiSelectCount ? `Multi-select: ${snapshot.multiSelectCount} items.` : "",
    recommendation,
  ].filter(Boolean).join(" ");

  return {
    tooltipsEnabled: snapshot.tooltipsEnabled,
    undoDepth: snapshot.undoDepth,
    redoDepth: snapshot.redoDepth,
    tourCompleted: snapshot.tourCompleted,
    highContrast: Boolean(prefs?.highContrast),
    reducedMotion: Boolean(prefs?.reducedMotion),
    fontScale: prefs?.fontScale ?? 100,
    pendingConfirm,
    recommendation,
    explanation,
  };
}
