import type {
  DesktopPreferences, PreferenceValidationResult, StartupMode, ThemeMode, AccentColor,
  LanguageCode, ProductionMode, UiDensity, QuickAccessMode, WorkspaceProfileId,
  WorkspacePerformanceModePref,
} from "./types";
import { defaultNotificationPreferences, defaultPreferences } from "./preference-defaults";

const STARTUP_MODES: StartupMode[] = [
  "restore-session", "last-project", "dashboard", "production", "welcome", "profile",
];

function isNumber(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

export function validateAndRepairPreferences(raw: unknown): PreferenceValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let repaired = false;

  if (raw == null || typeof raw !== "object") {
    return {
      valid: false,
      repaired: true,
      errors: ["Preferences missing or corrupt — restored defaults"],
      warnings,
      preferences: clonePrefs(defaultPreferences),
    };
  }

  const input = raw as Partial<DesktopPreferences>;
  const next: DesktopPreferences = clonePrefs(defaultPreferences);

  const theme = input.theme;
  if (theme === "dark" || theme === "light" || theme === "system") next.theme = theme as ThemeMode;
  else if (theme != null) { warnings.push("Invalid theme repaired"); repaired = true; }

  const accent = input.accent;
  if (accent === "mint" || accent === "sky" || accent === "amber" || accent === "rose") next.accent = accent as AccentColor;
  else if (accent != null) { warnings.push("Invalid accent repaired"); repaired = true; }

  if (isNumber(input.uiScale, 85, 125)) next.uiScale = input.uiScale;
  else if (input.uiScale != null) { warnings.push("uiScale clamped"); repaired = true; }

  if (isNumber(input.fontScale, 85, 125)) next.fontScale = input.fontScale;
  else if (input.fontScale != null) { warnings.push("fontScale clamped"); repaired = true; }

  next.highContrast = Boolean(input.highContrast ?? next.highContrast);
  next.reducedMotion = Boolean(input.reducedMotion ?? next.reducedMotion);

  const profiles: WorkspaceProfileId[] = ["default", "ai", "creative", "marketing", "video", "image", "custom"];
  if (input.activeProfile && profiles.includes(input.activeProfile)) next.activeProfile = input.activeProfile;
  else if (input.activeProfile != null) { warnings.push("activeProfile repaired"); repaired = true; }

  if (typeof input.lastWorkspace === "string" && input.lastWorkspace) {
    next.lastWorkspace = input.lastWorkspace === "dashboard" ? "home" : input.lastWorkspace;
    if (input.lastWorkspace === "dashboard") repaired = true;
  }

  if (input.window && typeof input.window === "object") {
    next.window = {
      width: Number(input.window.width) || 0,
      height: Number(input.window.height) || 0,
      x: Number(input.window.x) || 0,
      y: Number(input.window.y) || 0,
    };
  }

  const lang = input.language;
  if (lang === "en" || lang === "fr" || lang === "rw") next.language = lang as LanguageCode;
  else if (lang != null) { warnings.push("language repaired"); repaired = true; }

  if (input.startupMode && STARTUP_MODES.includes(input.startupMode)) next.startupMode = input.startupMode;
  else if (input.startupMode != null) { warnings.push("startupMode repaired"); repaired = true; }

  next.defaultLayoutId = typeof input.defaultLayoutId === "string" || input.defaultLayoutId === null
    ? input.defaultLayoutId ?? null
    : next.defaultLayoutId;

  next.sidebarPinnedDefault = Boolean(input.sidebarPinnedDefault ?? next.sidebarPinnedDefault);
  next.panelVisibilityDefaults = typeof input.panelVisibilityDefaults === "object" && input.panelVisibilityDefaults
    ? { ...input.panelVisibilityDefaults }
    : {};

  if (typeof input.defaultExportProfile === "string" && input.defaultExportProfile) {
    next.defaultExportProfile = input.defaultExportProfile;
  }

  if (input.defaultProjectSettings && typeof input.defaultProjectSettings === "object") {
    next.defaultProjectSettings = {
      defaultNamePrefix: String(input.defaultProjectSettings.defaultNamePrefix || "Project"),
      openProductionOnCreate: Boolean(input.defaultProjectSettings.openProductionOnCreate),
    };
  } else if (input.defaultProjectSettings != null) {
    warnings.push("defaultProjectSettings repaired");
    repaired = true;
  }

  const prod = input.preferredProductionMode;
  if (prod === "guided" || prod === "pro" || prod === "focus") next.preferredProductionMode = prod as ProductionMode;
  else if (prod != null) { warnings.push("preferredProductionMode repaired"); repaired = true; }

  if (input.notificationPreferences && typeof input.notificationPreferences === "object") {
    next.notificationPreferences = { ...defaultNotificationPreferences, ...input.notificationPreferences };
  } else if (input.notificationPreferences != null) {
    warnings.push("notificationPreferences repaired");
    repaired = true;
  }

  if (input.autoSavePreferences && typeof input.autoSavePreferences === "object") {
    const debounce = Number(input.autoSavePreferences.debounceMs);
    next.autoSavePreferences = {
      enabled: Boolean(input.autoSavePreferences.enabled),
      debounceMs: Number.isFinite(debounce) ? Math.min(10_000, Math.max(300, debounce)) : 1200,
    };
  } else if (input.autoSavePreferences != null) {
    warnings.push("autoSavePreferences repaired");
    repaired = true;
  }

  const density = input.uiDensity;
  if (density === "compact" || density === "comfortable") next.uiDensity = density as UiDensity;
  else if (density != null) { warnings.push("uiDensity repaired"); repaired = true; }

  const qa = input.quickAccessMode;
  if (qa === "static" || qa === "smart") next.quickAccessMode = qa as QuickAccessMode;
  else if (qa != null) { warnings.push("quickAccessMode repaired"); repaired = true; }

  next.showWelcomeOnStartup = Boolean(input.showWelcomeOnStartup ?? next.showWelcomeOnStartup);
  next.lastOpenedProject = typeof input.lastOpenedProject === "string" || input.lastOpenedProject === null
    ? input.lastOpenedProject ?? null
    : next.lastOpenedProject;

  const perfModes: WorkspacePerformanceModePref[] = ["balanced", "performance", "quality", "power-saving", "auto"];
  if (input.performanceMode && perfModes.includes(input.performanceMode)) {
    next.performanceMode = input.performanceMode;
  } else if (input.performanceMode != null) {
    warnings.push("performanceMode repaired");
    repaired = true;
  }

  if (typeof input.metricsPollMs === "number" && Number.isFinite(input.metricsPollMs)) {
    next.metricsPollMs = Math.min(10_000, Math.max(1000, input.metricsPollMs));
  } else if (input.metricsPollMs != null) {
    warnings.push("metricsPollMs repaired");
    repaired = true;
  }

  if (typeof input.cacheMaxMb === "number" && Number.isFinite(input.cacheMaxMb)) {
    next.cacheMaxMb = Math.min(256, Math.max(8, input.cacheMaxMb));
  } else if (input.cacheMaxMb != null) {
    warnings.push("cacheMaxMb repaired");
    repaired = true;
  }

  next.autoPerformanceAlerts = Boolean(input.autoPerformanceAlerts ?? next.autoPerformanceAlerts);

  next.tooltipsEnabled = Boolean(input.tooltipsEnabled ?? next.tooltipsEnabled);
  next.confirmDestructive = Boolean(input.confirmDestructive ?? next.confirmDestructive);
  next.showKeyboardHints = Boolean(input.showKeyboardHints ?? next.showKeyboardHints);
  next.tourCompleted = Boolean(input.tourCompleted ?? next.tourCompleted);

  const legacyMissing = !("startupMode" in input) || !("language" in input) || !("autoSavePreferences" in input);
  if (legacyMissing) {
    warnings.push("Legacy preferences upgraded with personalization defaults");
    repaired = true;
  }
  if (!("performanceMode" in input)) {
    warnings.push("Legacy preferences upgraded with performance defaults");
    repaired = true;
  }
  if (!("tooltipsEnabled" in input)) {
    warnings.push("Legacy preferences upgraded with UX defaults");
    repaired = true;
  }

  return {
    valid: errors.length === 0,
    repaired,
    errors,
    warnings,
    preferences: next,
  };
}

function clonePrefs(prefs: DesktopPreferences): DesktopPreferences {
  return {
    ...prefs,
    window: { ...prefs.window },
    panelVisibilityDefaults: { ...prefs.panelVisibilityDefaults },
    defaultProjectSettings: { ...prefs.defaultProjectSettings },
    notificationPreferences: { ...prefs.notificationPreferences },
    autoSavePreferences: { ...prefs.autoSavePreferences },
  };
}
