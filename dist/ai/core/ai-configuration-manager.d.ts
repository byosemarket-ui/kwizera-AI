import { AiCoreConfiguration } from "./types.js";
import type { AiCoreLogger } from "./logger.js";
export interface AiConfigurationManagerOptions {
    configRoot?: string;
    storageRootOverride?: string;
}
export declare class AiConfigurationManager {
    private configuration;
    private readonly configRoot;
    constructor(options?: AiConfigurationManagerOptions);
    load(logger: AiCoreLogger, storageRootOverride?: string): AiCoreConfiguration;
    getConfiguration(): AiCoreConfiguration;
    isLoaded(): boolean;
    ensureStorageDirectories(logger: AiCoreLogger): void;
}
//# sourceMappingURL=ai-configuration-manager.d.ts.map