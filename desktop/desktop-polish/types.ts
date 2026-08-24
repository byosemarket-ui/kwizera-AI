export type ThemeMode = "dark" | "light" | "system";
export type AccentColor = "mint" | "sky" | "amber" | "rose";
export type WorkspaceProfileId = "default" | "ai" | "creative" | "marketing" | "video" | "image" | "custom";
export type StartupMode =
  | "restore-session"
  | "last-project"
  | "dashboard"
  | "production"
  | "welcome"
  | "profile";
export type UiDensity = "compact" | "comfortable";
export type ProductionMode = "guided" | "pro" | "focus";
export type QuickAccessMode = "static" | "smart";
export type LanguageCode = "en" | "fr" | "rw";
export type WorkspacePerformanceModePref =
  | "balanced"
  | "performance"
  | "quality"
  | "power-saving"
  | "auto";

export interface NotificationPreferences {
  information: boolean;
  warnings: boolean;
  errors: boolean;
  productionComplete: boolean;
  updates: boolean;
  aiSuggestions: boolean;
}

export interface AutoSavePreferences {
  enabled: boolean;
  debounceMs: number;
}

export interface DefaultProjectSettings {
  defaultNamePrefix: string;
  openProductionOnCreate: boolean;
}

export interface DesktopPreferences {
  theme: ThemeMode;
  accent: AccentColor;
  uiScale: number;
  fontScale: number;
  highContrast: boolean;
  reducedMotion: boolean;
  activeProfile: WorkspaceProfileId;
  lastWorkspace: string;
  window: { width: number; height: number; x: number; y: number };
  /** Step 6 personalization */
  language: LanguageCode;
  startupMode: StartupMode;
  defaultLayoutId: string | null;
  sidebarPinnedDefault: boolean;
  panelVisibilityDefaults: Record<string, boolean>;
  defaultExportProfile: string;
  defaultProjectSettings: DefaultProjectSettings;
  preferredProductionMode: ProductionMode;
  notificationPreferences: NotificationPreferences;
  autoSavePreferences: AutoSavePreferences;
  uiDensity: UiDensity;
  quickAccessMode: QuickAccessMode;
  showWelcomeOnStartup: boolean;
  lastOpenedProject: string | null;
  /** Step 7 performance */
  performanceMode: WorkspacePerformanceModePref;
  metricsPollMs: number;
  cacheMaxMb: number;
  autoPerformanceAlerts: boolean;
  /** Step 8 UX / accessibility */
  tooltipsEnabled: boolean;
  confirmDestructive: boolean;
  showKeyboardHints: boolean;
  tourCompleted: boolean;
}

export type NotificationCategory =
  | "information"
  | "warnings"
  | "errors"
  | "production-complete"
  | "updates"
  | "ai-suggestions";

export interface DesktopNotification {
  id: string;
  tone: "success" | "warning" | "error" | "info";
  category?: NotificationCategory;
  title: string;
  detail: string;
  createdAt: string;
  read?: boolean;
}

export interface WorkspaceProfile {
  id: WorkspaceProfileId;
  label: string;
  workspace: string;
  detail: string;
  layoutId?: string | null;
}

export interface PreferenceProfilePackage {
  version: 1;
  kind: "kwizera-preference-profile";
  exportedAt: string;
  label: string;
  preferences: DesktopPreferences;
  navigation?: {
    favorites?: string[];
    pinned?: boolean;
    collapsedGroups?: string[];
    quickAccess?: string[];
  };
  layoutId?: string | null;
  checksum: string;
}

export interface PreferenceValidationResult {
  valid: boolean;
  repaired: boolean;
  errors: string[];
  warnings: string[];
  preferences: DesktopPreferences;
}
