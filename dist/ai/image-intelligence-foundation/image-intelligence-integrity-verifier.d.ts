import { ImageIntelligenceIntegrityResult } from "./types.js";
import { ImageIntelligenceFoundationLogger } from "./image-intelligence-logger.js";
import { ImageIntelligenceRegistry } from "./image-intelligence-registry.js";
import { ImageIntelligenceStorageManager } from "./image-intelligence-storage.js";
export declare class ImageIntelligenceIntegrityVerifier {
    private readonly logger;
    constructor(logger: ImageIntelligenceFoundationLogger);
    verify(storage: ImageIntelligenceStorageManager, registry: ImageIntelligenceRegistry): ImageIntelligenceIntegrityResult;
    writeManifest(storage: ImageIntelligenceStorageManager, storageRoot: string): void;
}
//# sourceMappingURL=image-intelligence-integrity-verifier.d.ts.map