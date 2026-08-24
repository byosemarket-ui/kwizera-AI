import type { DesktopPreferences } from "../../desktop-polish/types";
import type { NavigationState, QuickActionId } from "../types";
import { QUICK_ACTIONS } from "../navigation/navigation-engine";
import { navigationStore } from "../navigation/navigation-store";
import type { PersonalizedQuickAccess } from "./types";

export function buildPersonalizedQuickAccess(
  navigation: NavigationState,
  preferences: DesktopPreferences,
): PersonalizedQuickAccess {
  const smart = (preferences.quickAccessMode ?? "smart") === "smart";
  const workspaces = smart
    ? mergeUnique(navigation.quickAccess, navigationStore.rankFrequentWorkspaces(navigation, 6), navigation.favorites).slice(0, 8)
    : navigation.favorites.slice(0, 8);

  const commands = smart
    ? rankCommands(navigation).slice(0, 6)
    : QUICK_ACTIONS.map((a) => a.id);

  return {
    workspaces,
    commands,
    projects: navigation.frequentProjects.slice(0, 6),
    assets: navigation.frequentAssets.slice(0, 6),
    aiActions: navigation.frequentAiActions.slice(0, 6),
    templates: navigation.favoriteTemplates.slice(0, 6),
  };
}

export function rankQuickActions(navigation: NavigationState, preferences: DesktopPreferences): typeof QUICK_ACTIONS {
  if ((preferences.quickAccessMode ?? "smart") !== "smart") return QUICK_ACTIONS;
  const rankedIds = rankCommands(navigation);
  const byId = new Map(QUICK_ACTIONS.map((a) => [a.id, a]));
  const ordered = rankedIds.map((id) => byId.get(id as QuickActionId)).filter(Boolean) as typeof QUICK_ACTIONS;
  const rest = QUICK_ACTIONS.filter((a) => !rankedIds.includes(a.id));
  return [...ordered, ...rest];
}

function rankCommands(navigation: NavigationState): string[] {
  const scored = QUICK_ACTIONS.map((action) => ({
    id: action.id,
    score: navigation.commandCounts[action.id] ?? 0,
  })).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return scored.map((s) => s.id);
}

function mergeUnique(...lists: string[][]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const id of list) {
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}
