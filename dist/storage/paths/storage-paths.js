import path from "node:path";
/** Default permanent storage root per TECHNOLOGY-STACK-BLUEPRINT Step 1M */
export const DEFAULT_STORAGE_ROOT = "D:\\KWIZERA-AI-STUDIO";
export function resolveStorageRoot(override) {
    return (override ??
        process.env.KWIZERA_STORAGE_ROOT ??
        DEFAULT_STORAGE_ROOT);
}
export function resolveStoragePath(storageRoot, segment) {
    const segments = {
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
export function resolveLogDirectory(storageRoot) {
    return resolveStoragePath(storageRoot, "logs");
}
//# sourceMappingURL=storage-paths.js.map