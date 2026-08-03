import type { DesktopNotification, DesktopPreferences } from "./types";

const PREFERENCES_KEY = "kwizera.desktop.preferences.v1";
const NOTIFICATIONS_KEY = "kwizera.desktop.notifications.v1";
const BACKUP_KEY = "kwizera.desktop.workspace-backup.v1";
export const defaultPreferences: DesktopPreferences = { theme: "dark", accent: "mint", uiScale: 100, fontScale: 100, highContrast: false, reducedMotion: false, activeProfile: "default", lastWorkspace: "dashboard", window: { width: 0, height: 0, x: 0, y: 0 } };

function safeRead<T>(key: string, fallback: T): T { try { return { ...fallback, ...JSON.parse(localStorage.getItem(key) ?? "{}") }; } catch { return fallback; } }
export class DesktopPreferenceManager {
  load(): DesktopPreferences { return safeRead(PREFERENCES_KEY, defaultPreferences); }
  save(preferences: DesktopPreferences): void { localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences)); }
  backup(snapshot: unknown): void { localStorage.setItem(BACKUP_KEY, JSON.stringify({ savedAt: new Date().toISOString(), snapshot })); }
  restore<T>(): T | null { try { return (JSON.parse(localStorage.getItem(BACKUP_KEY) ?? "null") as { snapshot?: T } | null)?.snapshot ?? null; } catch { return null; } }
}
export class DesktopNotificationManager {
  load(): DesktopNotification[] { try { return JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY) ?? "[]") as DesktopNotification[]; } catch { return []; } }
  save(notifications: DesktopNotification[]): void { localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications.slice(0, 80))); }
  create(tone: DesktopNotification["tone"], title: string, detail: string): DesktopNotification { return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, tone, title, detail, createdAt: new Date().toISOString() }; }
}