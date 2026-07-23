import { ProductIntelligenceFoundationLogger } from "./product-intelligence-logger.js";
export declare class ProductIntelligenceStorageManager {
    private readonly logger;
    private intelligenceRoot;
    private registryDir;
    constructor(logger: ProductIntelligenceFoundationLogger);
    initialize(storageRoot: string): string;
    getIntelligenceRoot(): string;
    getRegistryPath(): string;
    getModulePath(subdirectory: string): string;
    getQualityPath(): string;
    verifyPersistence(): {
        passed: boolean;
        pathsVerified: number;
        detail: string;
    };
}
//# sourceMappingURL=product-intelligence-storage.d.ts.map