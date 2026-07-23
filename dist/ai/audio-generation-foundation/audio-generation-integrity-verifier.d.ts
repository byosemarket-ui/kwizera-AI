import { AudioGenerationIntegrityResult } from "./types.js";
import { AudioGenerationFoundationLogger } from "./audio-generation-logger.js";
import { AudioGenerationBlueprintManager } from "./audio-generation-blueprint-manager.js";
import { AudioGenerationRegistry } from "./audio-generation-registry.js";
import { AudioGenerationStorageManager } from "./audio-generation-storage.js";
export declare class AudioGenerationIntegrityVerifier {
    private readonly logger;
    constructor(logger: AudioGenerationFoundationLogger);
    verify(storage: AudioGenerationStorageManager, registry: AudioGenerationRegistry, blueprintManager: AudioGenerationBlueprintManager): AudioGenerationIntegrityResult;
    writeManifest(storage: AudioGenerationStorageManager, storageRoot: string): void;
}
//# sourceMappingURL=audio-generation-integrity-verifier.d.ts.map