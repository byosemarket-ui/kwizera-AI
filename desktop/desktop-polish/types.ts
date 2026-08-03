export type ThemeMode = "dark" | "light" | "system";
export type AccentColor = "mint" | "sky" | "amber" | "rose";
export type WorkspaceProfileId = "default" | "ai" | "creative" | "marketing" | "video" | "image" | "custom";

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
}

export interface DesktopNotification {
  id: string;
  tone: "success" | "warning" | "error" | "info";
  title: string;
  detail: string;
  createdAt: string;
}

export interface WorkspaceProfile {
  id: WorkspaceProfileId;
  label: string;
  workspace: string;
  detail: string;
}