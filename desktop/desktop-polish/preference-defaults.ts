import type {
  DesktopPreferences, NotificationPreferences,
} from "./types";

export const defaultNotificationPreferences: NotificationPreferences = {
  information: true,
  warnings: true,
  errors: true,
  productionComplete: true,
  updates: true,
  aiSuggestions: true,
};

export const defaultPreferences: DesktopPreferences = {
  theme: "dark",
  accent: "mint",
  uiScale: 100,
  fontScale: 100,
  highContrast: false,
  reducedMotion: false,
  activeProfile: "default",
  lastWorkspace: "home",
  window: { width: 0, height: 0, x: 0, y: 0 },
  language: "en",
  startupMode: "dashboard",
  defaultLayoutId: "default",
  sidebarPinnedDefault: false,
  panelVisibilityDefaults: {},
  defaultExportProfile: "standard",
  defaultProjectSettings: {
    defaultNamePrefix: "Project",
    openProductionOnCreate: true,
  },
  preferredProductionMode: "guided",
  notificationPreferences: { ...defaultNotificationPreferences },
  autoSavePreferences: { enabled: true, debounceMs: 1200 },
  uiDensity: "comfortable",
  quickAccessMode: "smart",
  showWelcomeOnStartup: false,
  lastOpenedProject: null,
  performanceMode: "balanced",
  metricsPollMs: 2000,
  cacheMaxMb: 32,
  autoPerformanceAlerts: true,
  tooltipsEnabled: true,
  confirmDestructive: true,
  showKeyboardHints: true,
  tourCompleted: false,
};
