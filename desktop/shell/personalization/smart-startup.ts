import { mapLegacyWorkspace } from "../workspace-registry";
import { workspaceProfiles } from "../../desktop-polish/profiles";
import type { ShellLayoutState, WorkspaceId } from "../types";
import type { SmartStartupInput, StartupDecision } from "./types";

/**
 * Fresh application session (Desktop icon / cold start): always open Home.
 *
 * Project data, snapshots, preferences, and navigation memory remain intact.
 * Only the initial UI route is forced to Home — in-session navigation is unchanged.
 */
export function decideSmartStartup(input: SmartStartupInput): StartupDecision {
  const { preferences, restore, lastProject } = input;
  const mode = preferences.startupMode ?? "dashboard";

  // Crash recovery still restores persistent data via workspace-state-engine;
  // the initial visible route remains Home so users are not dropped onto a mid-flow step.
  const crashNote = restore.recoveredFromCrash
    ? " Crash recovery restored workspace data; UI starts on Home."
    : "";
  const projectNote = lastProject || preferences.lastOpenedProject
    ? ` Previous project “${lastProject || preferences.lastOpenedProject}” remains available from Home.`
    : "";

  return {
    mode,
    workspace: "home",
    openWelcome: mode === "welcome" || Boolean(preferences.showWelcomeOnStartup),
    openLastProject: false,
    explanation: `Opened Home for this application session.${projectNote}${crashNote}`,
    applied: true,
  };
}

export function applyStartupWorkspace(shell: ShellLayoutState, workspace: WorkspaceId): ShellLayoutState {
  return { ...shell, workspace: mapLegacyWorkspace(workspace) as WorkspaceId };
}

/** Resolve preferred workspace from a preference profile (used when user explicitly switches profile). */
export function resolveProfileStartupWorkspace(activeProfile: string | undefined): WorkspaceId {
  const profile = workspaceProfiles.find((p) => p.id === activeProfile) ?? workspaceProfiles[0];
  return mapLegacyWorkspace(profile.workspace) as WorkspaceId;
}
