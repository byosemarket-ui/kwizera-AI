import type { DesktopPreferences, PreferenceProfilePackage } from "../../desktop-polish/types";
import type { NavigationState, ShellLayoutState, WorkspaceId } from "../types";
import type { RestoreReport } from "../workspace-state/types";

export interface StartupDecision {
  mode: DesktopPreferences["startupMode"];
  workspace: WorkspaceId;
  openWelcome: boolean;
  openLastProject: boolean;
  explanation: string;
  applied: boolean;
}

export interface PersonalizedQuickAccess {
  workspaces: WorkspaceId[];
  commands: string[];
  projects: string[];
  assets: string[];
  aiActions: string[];
  templates: string[];
}

export interface PersonalizationContext {
  preferences: DesktopPreferences;
  navigation: NavigationState;
  startup: StartupDecision | null;
  quickAccess: PersonalizedQuickAccess;
}

export type { PreferenceProfilePackage };

export interface ProfileImportResult {
  ok: boolean;
  confirmed: boolean;
  package: PreferenceProfilePackage | null;
  errors: string[];
  explanation: string;
}

export interface SmartStartupInput {
  preferences: DesktopPreferences;
  restore: RestoreReport;
  shell: ShellLayoutState;
  lastProject: string | null;
}
