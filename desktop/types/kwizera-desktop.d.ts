/**
 * Minimal type surface for the secure desktop bridge (Phase 7 Step 1 + Product Intake).
 */

export interface DesktopPickedImage {
  name: string;
  mimeType: string;
  size: number;
  dataBase64: string;
  error?: string;
}

export interface DesktopOpenImagesResult {
  canceled: boolean;
  files: DesktopPickedImage[];
  folder?: string | null;
}

export interface KwizeraDesktopBridge {
  getAppInfo: () => Promise<Record<string, unknown>>;
  getMachineStatus: () => Promise<Record<string, unknown>>;
  getLocalServiceStatus: () => Promise<Record<string, unknown>>;
  restartApplication: () => Promise<unknown>;
  openLogs: () => Promise<{ ok: boolean; path: string }>;
  retryStartup: () => Promise<unknown>;
  closeApplication: () => Promise<unknown>;
  openProductImages?: () => Promise<DesktopOpenImagesResult>;
  openProductImageFolder?: () => Promise<DesktopOpenImagesResult>;
  onStartupUpdate: (handler: (payload: unknown) => void) => () => void;
  onStartupFailed: (handler: (payload: unknown) => void) => () => void;
}

declare global {
  interface Window {
    kwizeraDesktop?: KwizeraDesktopBridge;
  }
}

export {};
