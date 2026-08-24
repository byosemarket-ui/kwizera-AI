import type { DesktopPreferences } from "../../desktop-polish/types";
import { DesktopPreferenceManager } from "../../desktop-polish/preference-store";
import { workspaceProfiles } from "../../desktop-polish/profiles";
import { mapLegacyWorkspace } from "../workspace-registry";
import type { NavigationState, ShellLayoutState, WorkspaceId } from "../types";
import { navigationStore } from "../navigation/navigation-store";
import type { RestoreReport } from "../workspace-state/types";
import {
  applyPreferenceProfile,
  createBackupProfile,
  exportPreferenceProfile,
  mergeNavigationFromProfile,
  parsePreferenceProfile,
  saveCustomProfileBackup,
} from "./preference-profiles";
import { applyStartupWorkspace, decideSmartStartup } from "./smart-startup";
import { buildPersonalizedQuickAccess, rankQuickActions } from "./smart-quick-access";
import { buildAiMePersonalizationContext } from "./aime-personalization-awareness";
import type { PreferenceProfilePackage } from "../../desktop-polish/types";
import type { PersonalizedQuickAccess, StartupDecision } from "./types";

export class PersonalizationEngine {
  private preferenceManager = new DesktopPreferenceManager();
  private lastStartup: StartupDecision | null = null;

  getLastStartup(): StartupDecision | null {
    return this.lastStartup;
  }

  applySmartStartup(
    preferences: DesktopPreferences,
    restore: RestoreReport,
    shell: ShellLayoutState,
    lastProject: string | null,
  ): { shell: ShellLayoutState; decision: StartupDecision; preferences: DesktopPreferences } {
    const decision = decideSmartStartup({ preferences, restore, shell, lastProject });
    this.lastStartup = decision;
    let nextShell = applyStartupWorkspace(shell, decision.workspace);
    let nextPrefs = { ...preferences, lastWorkspace: decision.workspace };

    if (decision.openLastProject && (lastProject || preferences.lastOpenedProject)) {
      nextPrefs = {
        ...nextPrefs,
        lastOpenedProject: lastProject || preferences.lastOpenedProject,
      };
    }

    // Apply sidebar pin default when not restoring a full session layout preference conflict
    if (!restore.restored || preferences.startupMode !== "restore-session") {
      // Soft default only — session restore already applied nav.pinned
    }

    if (preferences.defaultLayoutId && preferences.startupMode === "profile") {
      // Layout id is applied by callers via layout manager when profile switches
    }

    this.preferenceManager.save(nextPrefs);
    return { shell: nextShell, decision, preferences: nextPrefs };
  }

  syncProjectMemory(preferences: DesktopPreferences, projectName: string | null): DesktopPreferences {
    if (!projectName) return preferences;
    const next = { ...preferences, lastOpenedProject: projectName };
    this.preferenceManager.save(next);
    return next;
  }

  recordNavigation(
    navigation: NavigationState,
    workspace: WorkspaceId,
  ): NavigationState {
    return navigationStore.visit(navigation, workspace);
  }

  getQuickAccess(navigation: NavigationState, preferences: DesktopPreferences): PersonalizedQuickAccess {
    return buildPersonalizedQuickAccess(navigation, preferences);
  }

  getRankedActions(navigation: NavigationState, preferences: DesktopPreferences) {
    return rankQuickActions(navigation, preferences);
  }

  exportProfile(
    label: string,
    preferences: DesktopPreferences,
    navigation: NavigationState,
  ): PreferenceProfilePackage {
    const pkg = exportPreferenceProfile(label, preferences, {
      favorites: navigation.favorites,
      pinned: navigation.pinned,
      collapsedGroups: navigation.collapsedGroups,
      quickAccess: navigation.quickAccess,
    }, preferences.defaultLayoutId);
    saveCustomProfileBackup(pkg);
    return pkg;
  }

  importProfile(
    raw: unknown,
    confirmed: boolean,
  ): {
    result: ReturnType<typeof applyPreferenceProfile>;
    preferences?: DesktopPreferences;
    navigationPatch?: ReturnType<typeof mergeNavigationFromProfile>;
  } {
    const parsed = parsePreferenceProfile(raw);
    if (!parsed.ok || !parsed.package) return { result: parsed };
    const applied = applyPreferenceProfile(parsed.package, confirmed);
    if (!applied.ok || !applied.confirmed || !applied.package) return { result: applied };
    // Backup current before overwrite is caller's responsibility; engine still saves imported backup
    saveCustomProfileBackup(applied.package);
    return {
      result: applied,
      preferences: applied.package.preferences,
      navigationPatch: undefined,
    };
  }

  importProfileInto(
    raw: unknown,
    confirmed: boolean,
    currentNav: NavigationState,
  ): {
    result: ReturnType<typeof applyPreferenceProfile>;
    preferences?: DesktopPreferences;
    navigation?: NavigationState;
  } {
    const parsed = parsePreferenceProfile(raw);
    if (!parsed.ok || !parsed.package) return { result: parsed };
    const applied = applyPreferenceProfile(parsed.package, confirmed);
    if (!applied.ok || !applied.confirmed || !applied.package) return { result: applied };
    saveCustomProfileBackup(applied.package);
    return {
      result: applied,
      preferences: applied.package.preferences,
      navigation: mergeNavigationFromProfile(currentNav, applied.package),
    };
  }

  backupCurrent(preferences: DesktopPreferences, navigation: NavigationState): PreferenceProfilePackage {
    const pkg = createBackupProfile(preferences, navigation);
    saveCustomProfileBackup(pkg);
    return pkg;
  }

  resolveProfileWorkspace(preferences: DesktopPreferences): WorkspaceId {
    const profile = workspaceProfiles.find((p) => p.id === preferences.activeProfile) ?? workspaceProfiles[0];
    return mapLegacyWorkspace(profile.workspace) as WorkspaceId;
  }

  buildAiMeContext(preferences: DesktopPreferences, navigation: NavigationState) {
    return buildAiMePersonalizationContext(preferences, navigation, this.lastStartup);
  }
}

export const personalizationEngine = new PersonalizationEngine();
