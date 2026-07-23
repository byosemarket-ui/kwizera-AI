import path from "node:path";

/** Default permanent storage root per TECHNOLOGY-STACK-BLUEPRINT Step 1M */
export const DEFAULT_STORAGE_ROOT = "D:\\KWIZERA-AI-STUDIO";

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
  return (
    override ??
    process.env.KWIZERA_STORAGE_ROOT ??
    DEFAULT_STORAGE_ROOT
  );
}

export function resolveStoragePath(
  storageRoot: string,
  segment: keyof StorageDirectories
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
