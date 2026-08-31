/**
 * Cold-start navigation policy: every fresh application launch opens Home.
 * Project/session data is restored separately; only transient route state is reset.
 */
import type { DesktopPreferences } from "../desktop-polish/types";
import type { ShellLayoutState, WorkspaceId } from "./types";
import { shellLayoutManager, defaultShellLayout } from "./layout-store";
import { DesktopPreferenceManager } from "../desktop-polish/preference-store";
import type { WorkspaceStateSnapshot } from "./workspace-state/types";
import { recomputeSnapshotChecksum } from "./workspace-state/state-validation";
import { ALL_WORKSPACE_IDS } from "./types";
import { mapLegacyWorkspace } from "./workspace-registry";

export const PERSISTED_NAVIGATION_SCHEMA_VERSION = 2;
export const PERSISTED_NAVIGATION_VERSION_KEY = "kwizera.desktop.navigation-schema.v1";

export const STARTUP_HOME_WORKSPACE: WorkspaceId = "home";

export function isValidWorkspaceId(value: string): value is WorkspaceId {
  const mapped = mapLegacyWorkspace(value);
  return ALL_WORKSPACE_IDS.includes(mapped);
}

export function patchShellForHomeStartup(shell: ShellLayoutState): ShellLayoutState {
  return { ...shell, workspace: STARTUP_HOME_WORKSPACE };
}

export function patchPreferencesForHomeStartup(preferences: DesktopPreferences): DesktopPreferences {
  return { ...preferences, lastWorkspace: STARTUP_HOME_WORKSPACE };
}

/** Strip persisted route from a snapshot while keeping project/session data. */
export function sanitizeSnapshotForColdStart(snapshot: WorkspaceStateSnapshot): WorkspaceStateSnapshot {
  const patched: WorkspaceStateSnapshot = {
    ...snapshot,
    shell: patchShellForHomeStartup(snapshot.shell),
    preferences: patchPreferencesForHomeStartup(snapshot.preferences),
    session: snapshot.session
      ? { ...snapshot.session, workspace: STARTUP_HOME_WORKSPACE }
      : snapshot.session,
  };
  return recomputeSnapshotChecksum(patched);
}

export function markNavigationSchemaCurrent(): void {
  try {
    localStorage.setItem(PERSISTED_NAVIGATION_VERSION_KEY, String(PERSISTED_NAVIGATION_SCHEMA_VERSION));
  } catch {
    /* best effort */
  }
}

/**
 * Patch only navigation keys in localStorage — does not clear projects or snapshots.
 */
export function resetPersistedNavigationInStorage(): void {
  try {
    const shell = shellLayoutManager.load();
    shellLayoutManager.save(patchShellForHomeStartup(shell));
  } catch (error) {
    console.warn("[KWIZERA] Could not reset shell navigation key:", error);
  }
  try {
    const prefs = new DesktopPreferenceManager().load();
    new DesktopPreferenceManager().save(patchPreferencesForHomeStartup(prefs));
  } catch (error) {
    console.warn("[KWIZERA] Could not reset preference navigation key:", error);
  }
  markNavigationSchemaCurrent();
}

export function fallbackShellLayout(): ShellLayoutState {
  return { ...defaultShellLayout, workspace: STARTUP_HOME_WORKSPACE };
}

export function coldStartRestoreExplanation(
  base: string,
  projectName?: string | null,
): string {
  const projectNote = projectName ? ` Project “${projectName}” data is preserved.` : "";
  return `${base}${projectNote} This session starts at Home.`;
}
