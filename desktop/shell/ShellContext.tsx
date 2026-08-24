import { createContext, useContext, type ReactNode } from "react";
import type { DesktopNotification, DesktopPreferences } from "../desktop-polish/types";
import type {
  CoreStatus, LayoutManagerState, NavigationState, ProjectStatus, QuickActionId, SaveState,
  ShellLayoutState, WorkspaceId,
} from "./types";
import type { RestoreReport } from "./workspace-state/types";
import type { PerformanceSnapshot } from "./performance/types";
import type { IntegrationSnapshot } from "./integration/types";
import type { CertificationSnapshot } from "./certification/types";

export interface ShellContextValue {
  layout: ShellLayoutState;
  preferences: DesktopPreferences;
  core: CoreStatus | null;
  notifications: DesktopNotification[];
  saveState: SaveState;
  autoSave: boolean;
  projectStatus: ProjectStatus;
  navigation: NavigationState;
  layoutManager: LayoutManagerState | null;
  restoreReport: RestoreReport | null;
  performanceSnapshot: PerformanceSnapshot | null;
  integrationSnapshot: IntegrationSnapshot | null;
  certificationSnapshot: CertificationSnapshot | null;
  setLayout: (changes: Partial<ShellLayoutState> | ShellLayoutState) => void;
  switchWorkspace: (workspace: WorkspaceId) => void;
  setPreferences: (preferences: DesktopPreferences | ((current: DesktopPreferences) => DesktopPreferences)) => void;
  notify: (tone: DesktopNotification["tone"], title: string, detail: string, category?: DesktopNotification["category"]) => void;
  setNotifications: React.Dispatch<React.SetStateAction<DesktopNotification[]>>;
  setNavigation: (changes: Partial<NavigationState> | ((current: NavigationState) => NavigationState)) => void;
  setLayoutManager: ((changes: LayoutManagerState | ((current: LayoutManagerState) => LayoutManagerState)) => void) | null;
  toggleFavorite: (workspace: WorkspaceId) => void;
  runQuickAction: (action: QuickActionId) => void;
}

const ShellContext = createContext<ShellContextValue | null>(null);

export function ShellProvider({ value, children }: { value: ShellContextValue; children: ReactNode }) {
  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell(): ShellContextValue {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error("useShell must be used within ShellProvider");
  return ctx;
}
