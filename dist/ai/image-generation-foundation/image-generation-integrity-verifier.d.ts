import { ImageGenerationIntegrityResult } from "./types.js";
import { ImageGenerationFoundationLogger } from "./image-generation-logger.js";
import { ImageGenerationBlueprintManager } from "./generation-blueprint-manager.js";
import { ImageGenerationRegistry } from "./image-generation-registry.js";
import { ImageGenerationStorageManager } from "./image-generation-storage.js";
export declare class ImageGenerationIntegrityVerifier {
    private readonly logger;
    constructor(logger: ImageGenerationFoundationLogger);
    verify(storage: ImageGenerationStorageManager, registry: ImageGenerationRegistry, blueprintManager: ImageGenerationBlueprintManager): ImageGenerationIntegrityResult;
    writeManifest(storage: ImageGenerationStorageManager, storageRoot: string): void;
}
//# sourceMappingURL=image-generation-integrity-verifier.d.ts.map