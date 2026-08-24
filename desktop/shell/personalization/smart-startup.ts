import { mapLegacyWorkspace } from "../workspace-registry";
import { workspaceProfiles } from "../../desktop-polish/profiles";
import type { ShellLayoutState, WorkspaceId } from "../types";
import type { SmartStartupInput, StartupDecision } from "./types";

export function decideSmartStartup(input: SmartStartupInput): StartupDecision {
  const { preferences, restore, shell, lastProject } = input;
  const mode = preferences.startupMode ?? "restore-session";

  // Crash recovery always wins — never discard emergency restore
  if (restore.recoveredFromCrash) {
    return {
      mode,
      workspace: shell.workspace,
      openWelcome: false,
      openLastProject: Boolean(lastProject),
      explanation: `Startup followed crash recovery: kept restored workspace “${shell.workspace}” despite preference “${mode}”.`,
      applied: true,
    };
  }

  if (mode === "restore-session" && restore.restored) {
    return {
      mode,
      workspace: shell.workspace,
      openWelcome: false,
      openLastProject: Boolean(lastProject || preferences.lastOpenedProject),
      explanation: `Resumed previous session on “${shell.workspace}” as configured in startup preferences.`,
      applied: true,
    };
  }

  if (mode === "last-project" && (lastProject || preferences.lastOpenedProject)) {
    return {
      mode,
      workspace: "production",
      openWelcome: false,
      openLastProject: true,
      explanation: `Opened Production workspace for last project “${lastProject || preferences.lastOpenedProject}”.`,
      applied: true,
    };
  }

  if (mode === "dashboard" || mode === "welcome") {
    return {
      mode,
      workspace: "home",
      openWelcome: mode === "welcome" || preferences.showWelcomeOnStartup,
      openLastProject: false,
      explanation: mode === "welcome"
        ? "Opened Home with welcome guidance per startup preference."
        : "Opened Dashboard (Home) per startup preference.",
      applied: true,
    };
  }

  if (mode === "production") {
    return {
      mode,
      workspace: "production",
      openWelcome: false,
      openLastProject: Boolean(lastProject || preferences.lastOpenedProject),
      explanation: "Opened Production workspace per startup preference.",
      applied: true,
    };
  }

  if (mode === "profile") {
    const profile = workspaceProfiles.find((p) => p.id === preferences.activeProfile) ?? workspaceProfiles[0];
    const workspace = mapLegacyWorkspace(profile.workspace) as WorkspaceId;
    return {
      mode,
      workspace,
      openWelcome: false,
      openLastProject: false,
      explanation: `Opened “${profile.label}” starting page (${workspace}) from active preference profile.`,
      applied: true,
    };
  }

  // Fallback: last workspace preference
  const last = mapLegacyWorkspace(preferences.lastWorkspace || shell.workspace) as WorkspaceId;
  return {
    mode,
    workspace: last,
    openWelcome: preferences.showWelcomeOnStartup,
    openLastProject: Boolean(preferences.lastOpenedProject),
    explanation: `Opened last active workspace “${last}”.`,
    applied: true,
  };
}

export function applyStartupWorkspace(shell: ShellLayoutState, workspace: WorkspaceId): ShellLayoutState {
  return { ...shell, workspace };
}
