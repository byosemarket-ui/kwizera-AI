import type {
  DesktopNotification, DesktopPreferences, PreferenceValidationResult,
} from "./types";
import { defaultNotificationPreferences, defaultPreferences } from "./preference-defaults";
import { validateAndRepairPreferences } from "./preference-validation";

export { defaultPreferences, defaultNotificationPreferences };

const PREFERENCES_KEY = "kwizera.desktop.preferences.v1";
const NOTIFICATIONS_KEY = "kwizera.desktop.notifications.v1";
const BACKUP_KEY = "kwizera.desktop.workspace-backup.v1";

export class DesktopPreferenceManager {
  load(): DesktopPreferences {
    try {
      const raw = JSON.parse(localStorage.getItem(PREFERENCES_KEY) ?? "null");
      const result = validateAndRepairPreferences(raw);
      if (result.repaired) this.save(result.preferences);
      return result.preferences;
    } catch {
      return {
        ...defaultPreferences,
        notificationPreferences: { ...defaultNotificationPreferences },
        autoSavePreferences: { ...defaultPreferences.autoSavePreferences },
        defaultProjectSettings: { ...defaultPreferences.defaultProjectSettings },
      };
    }
  }

  save(preferences: DesktopPreferences): void {
    const result = validateAndRepairPreferences(preferences);
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(result.preferences));
  }

  validate(raw: unknown): PreferenceValidationResult {
    return validateAndRepairPreferences(raw);
  }

  backup(snapshot: unknown): void {
    localStorage.setItem(BACKUP_KEY, JSON.stringify({ savedAt: new Date().toISOString(), snapshot }));
  }

  restore<T>(): T | null {
    try {
      return (JSON.parse(localStorage.getItem(BACKUP_KEY) ?? "null") as { snapshot?: T } | null)?.snapshot ?? null;
    } catch {
      return null;
    }
  }
}

export class DesktopNotificationManager {
  load(): DesktopNotification[] {
    try {
      return JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY) ?? "[]") as DesktopNotification[];
    } catch {
      return [];
    }
  }

  save(notifications: DesktopNotification[]): void {
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications.slice(0, 80)));
  }

  create(
    tone: DesktopNotification["tone"],
    title: string,
    detail: string,
    category?: DesktopNotification["category"],
  ): DesktopNotification {
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      tone,
      category: category ?? (tone === "error" ? "errors" : tone === "warning" ? "warnings" : tone === "success" ? "production-complete" : "information"),
      title,
      detail,
      createdAt: new Date().toISOString(),
      read: false,
    };
  }

  isCategoryEnabled(prefs: DesktopPreferences, category?: DesktopNotification["category"]): boolean {
    const np = prefs.notificationPreferences ?? defaultNotificationPreferences;
    switch (category) {
      case "warnings": return np.warnings;
      case "errors": return np.errors;
      case "production-complete": return np.productionComplete;
      case "updates": return np.updates;
      case "ai-suggestions": return np.aiSuggestions;
      default: return np.information;
    }
  }
}
