import { VideoIntelligenceIntegrityResult } from "./types.js";
import { VideoIntelligenceFoundationLogger } from "./video-intelligence-logger.js";
import { VideoIntelligenceRegistry } from "./video-intelligence-registry.js";
import { VideoIntelligenceStorageManager } from "./video-intelligence-storage.js";
export declare class VideoIntelligenceIntegrityVerifier {
    private readonly logger;
    constructor(logger: VideoIntelligenceFoundationLogger);
    verify(storage: VideoIntelligenceStorageManager, registry: VideoIntelligenceRegistry): VideoIntelligenceIntegrityResult;
    writeManifest(storage: VideoIntelligenceStorageManager, storageRoot: string): void;
}
//# sourceMappingURL=video-intelligence-integrity-verifier.d.ts.map