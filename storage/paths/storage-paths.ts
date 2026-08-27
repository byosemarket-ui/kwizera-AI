import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Windows desktop preferred root. Never used automatically on Linux/macOS. */
export const WINDOWS_PREFERRED_STORAGE_ROOT = "D:\\KWIZERA-AI-STUDIO";

/**
 * True when a configured storage root can be used on this operating system.
 * Rejects empty values and Windows drive-letter paths on non-Windows hosts.
 */
export function isUsableStorageRoot(value?: string | null): value is string {
  if (!value || !value.trim()) return false;
  const trimmed = value.trim();
  if (process.platform !== "win32" && /^[A-Za-z]:[\\/]/.test(trimmed)) {
    return false;
  }
  return true;
}

export function findProjectRoot(fromDir?: string): string {
  const envRoot = process.env.KWIZERA_PROJECT_ROOT;
  if (envRoot && fs.existsSync(path.join(envRoot, "package.json"))) {
    return path.resolve(envRoot);
  }

  let dir = fromDir ?? path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 16; i++) {
    const pkgPath = path.join(dir, "package.json");
    if (fs.existsSync(pkgPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as { name?: string };
        if (parsed.name === "kwizera-ai-studio") {
          return dir;
        }
      } catch {
        /* keep walking */
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  throw new Error(
    "Unable to locate KWIZERA AI STUDIO project root (package.json). Set KWIZERA_PROJECT_ROOT.",
  );
}

export function platformDefaultStorageRoot(): string {
  if (process.platform === "win32") {
    const preferred = WINDOWS_PREFERRED_STORAGE_ROOT;
    try {
      if (fs.existsSync(preferred)) return preferred;
    } catch {
      /* fall through */
    }
    const localApp = process.env.LOCALAPPDATA;
    if (localApp) return path.join(localApp, "KWIZERA-AI-STUDIO");
    return path.join(os.homedir(), "KWIZERA-AI-STUDIO");
  }

  const xdg = process.env.XDG_DATA_HOME;
  if (xdg) return path.join(xdg, "kwizera-ai-studio");
  return path.join(os.homedir(), ".local", "share", "kwizera-ai-studio");
}

/** Snapshot of the platform default at module load. Prefer resolveStorageRoot(). */
export const DEFAULT_STORAGE_ROOT = platformDefaultStorageRoot();

export interface StorageDirectories {
  config: string;
  database: string;
  projects: string;
  uploads: string;
  exports: string;
  media: string;
  memory: string;
  knowledge: string;
  productIntelligence: string;
  imageIntelligence: string;
  videoIntelligence: string;
  videoGeneration: string;
  imageGeneration: string;
  audioGeneration: string;
  learning: string;
  logs: string;
  backups: string;
  cache: string;
  temp: string;
}

export function resolveStorageRoot(override?: string): string {
  if (isUsableStorageRoot(override)) {
    return path.resolve(override);
  }
  if (isUsableStorageRoot(process.env.KWIZERA_STORAGE_ROOT)) {
    return path.resolve(process.env.KWIZERA_STORAGE_ROOT);
  }
  return path.resolve(platformDefaultStorageRoot());
}

export function resolveStoragePath(
  storageRoot: string,
  segment: keyof StorageDirectories,
): string {
  const segments: StorageDirectories = {
    config: "config",
    database: "database",
    projects: "projects",
    uploads: "uploads",
    exports: "exports",
    media: "media",
    memory: "memory",
    knowledge: "knowledge",
    productIntelligence: "product-intelligence",
    imageIntelligence: "image-intelligence",
    videoIntelligence: "video-intelligence",
    videoGeneration: "video-generation",
    imageGeneration: "image-generation",
    audioGeneration: "audio-generation",
    learning: "learning",
    logs: "logs",
    backups: "backups",
    cache: "cache",
    temp: "temp",
  };
  return path.join(storageRoot, segments[segment]);
}

export function resolveLogDirectory(storageRoot: string): string {
  return resolveStoragePath(storageRoot, "logs");
}
