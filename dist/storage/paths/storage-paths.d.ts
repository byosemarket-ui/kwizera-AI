/** Default permanent storage root per TECHNOLOGY-STACK-BLUEPRINT Step 1M */
export declare const DEFAULT_STORAGE_ROOT = "D:\\KWIZERA-AI-STUDIO";
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
export declare function resolveStorageRoot(override?: string): string;
export declare function resolveStoragePath(storageRoot: string, segment: keyof StorageDirectories): string;
export declare function resolveLogDirectory(storageRoot: string): string;
//# sourceMappingURL=storage-paths.d.ts.map