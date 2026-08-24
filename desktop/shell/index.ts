export { AppShell } from "./AppShell";
export { ShellProvider, useShell } from "./ShellContext";
export { ShellWorkspaceContent } from "./ShellWorkspaceContent";
export { WorkspaceRouter } from "./WorkspaceRouter";
export { shellLayoutManager, defaultShellLayout } from "./layout-store";
export { panelEngine, createDefaultPanels, FUTURE_MODULE_SLOTS, FLOATABLE_PANELS } from "./panel-engine";
export { workspaceLayoutManager, createBuiltinLayouts } from "./layout/layout-manager";
export { buildAiMeLayoutContext, explainPanelForAiMe } from "./layout/aime-layout-awareness";
export { FloatingWindowsLayer } from "./layout/FloatingWindows";
export { LayoutManagerPanel } from "./layout/LayoutManagerPanel";
export { workspaceNav, mapLegacyWorkspace, getNavItem, getNavByGroup, workspaceTiers } from "./workspace-registry";
export {
  buildAiMeWorkspaceContext, serializeAiMeContext, explainWorkspaceForAiMe,
  guideUserToWorkspace, restoreLayoutForAiMe,
} from "./aime-awareness";
export { navigationEngine, QUICK_ACTIONS, KEYBOARD_SHORTCUTS } from "./navigation/navigation-engine";
export { navigationStore, defaultNavigationState } from "./navigation/navigation-store";
export { GlobalSearch } from "./navigation/GlobalSearch";
export { Breadcrumb } from "./navigation/Breadcrumb";
export { QuickActionBar } from "./navigation/QuickActionBar";
export { NotificationCenter } from "./navigation/NotificationCenter";
export {
  workspaceStateEngine, projectMemoryStore, sessionStore,
  buildAiMeStateContext, validateSnapshot, checksumPayload,
} from "./workspace-state";
export {
  personalizationEngine, decideSmartStartup, exportPreferenceProfile,
  parsePreferenceProfile, applyPreferenceProfile, buildPersonalizedQuickAccess,
} from "./personalization";
export {
  workspacePerformanceEngine, smartCacheManager, backgroundTaskManager,
  resolveEffectiveMode, buildAiMePerformanceContext,
} from "./performance";
export {
  uxEngine, commandStack, confirmationService, getTooltip, validateForm,
  buildAiMeUxContext, HelpWorkspacePanel,
} from "./ux";
export {
  workspaceIntegrationEngine, ALL_WORKSPACE_EVENT_TYPES, buildAiMeIntegrationContext,
} from "./integration";
export {
  workspaceCertificationEngine, buildAiMeCertificationContext, buildCertificationMarkdown,
  FOUNDATION_VERSION,
} from "./certification";
export type * from "./types";
