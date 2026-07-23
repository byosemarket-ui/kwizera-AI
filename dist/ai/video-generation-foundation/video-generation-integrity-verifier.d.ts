import { VideoGenerationIntegrityResult } from "./types.js";
import { VideoGenerationFoundationLogger } from "./video-generation-logger.js";
import { GenerationBlueprintManager } from "./generation-blueprint-manager.js";
import { VideoGenerationRegistry } from "./video-generation-registry.js";
import { VideoGenerationStorageManager } from "./video-generation-storage.js";
export declare class VideoGenerationIntegrityVerifier {
    private readonly logger;
    constructor(logger: VideoGenerationFoundationLogger);
    verify(storage: VideoGenerationStorageManager, registry: VideoGenerationRegistry, blueprintManager: GenerationBlueprintManager): VideoGenerationIntegrityResult;
    writeManifest(storage: VideoGenerationStorageManager, storageRoot: string): void;
}
//# sourceMappingURL=video-generation-integrity-verifier.d.ts.map