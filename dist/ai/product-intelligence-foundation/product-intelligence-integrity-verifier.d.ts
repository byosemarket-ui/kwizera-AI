import { ProductIntelligenceIntegrityResult } from "./types.js";
import { ProductIntelligenceFoundationLogger } from "./product-intelligence-logger.js";
import { ProductIntelligenceRegistry } from "./product-intelligence-registry.js";
import { ProductIntelligenceStorageManager } from "./product-intelligence-storage.js";
export declare class ProductIntelligenceIntegrityVerifier {
    private readonly logger;
    constructor(logger: ProductIntelligenceFoundationLogger);
    verify(storage: ProductIntelligenceStorageManager, registry: ProductIntelligenceRegistry): ProductIntelligenceIntegrityResult;
    writeManifest(storage: ProductIntelligenceStorageManager, storageRoot: string): void;
}
//# sourceMappingURL=product-intelligence-integrity-verifier.d.ts.map