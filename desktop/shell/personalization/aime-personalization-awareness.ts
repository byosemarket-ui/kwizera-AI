import type { DesktopPreferences } from "../../desktop-polish/types";
import type { NavigationState } from "../types";
import { getNavItem } from "../workspace-registry";
import { navigationStore } from "../navigation/navigation-store";
import type { StartupDecision } from "./types";
import { buildPersonalizedQuickAccess } from "./smart-quick-access";

export function buildAiMePersonalizationContext(
  preferences: DesktopPreferences,
  navigation: NavigationState,
  startup: StartupDecision | null,
) {
  const top = navigationStore.rankFrequentWorkspaces(navigation, 4);
  const quick = buildPersonalizedQuickAccess(navigation, preferences);
  const recommendation = !preferences.autoSavePreferences?.enabled
    ? "Enable auto save in preferences to protect production progress."
    : preferences.quickAccessMode === "static"
      ? "Switch quick access to Smart to surface frequently used tools automatically."
      : top[0] === "home"
        ? "You mostly start on Home — pin Production or AI Me if that matches your workflow."
        : `Your top page is ${getNavItem(top[0]).label}. Keep it in favorites for one-click access.`;

  const startupExplanation = startup?.explanation
    ?? `Startup mode is “${preferences.startupMode}” with profile “${preferences.activeProfile}”.`;

  const explanation = [
    `Preferences: ${preferences.theme} theme, ${preferences.language}, production mode ${preferences.preferredProductionMode}.`,
    startupExplanation,
    top.length ? `Frequent pages: ${top.map((id) => getNavItem(id).label).join(", ")}.` : "",
    quick.projects.length ? `Frequent projects: ${quick.projects.slice(0, 3).join(", ")}.` : "",
    recommendation,
  ].filter(Boolean).join(" ");

  return {
    startupMode: preferences.startupMode,
    activeProfile: preferences.activeProfile,
    language: preferences.language,
    quickAccessMode: preferences.quickAccessMode,
    topWorkspaces: top,
    startupExplanation,
    recommendation,
    explanation,
  };
}
