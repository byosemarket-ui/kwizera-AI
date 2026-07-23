import { MemoryIntegrityResult } from "./types.js";
import { MemoryFoundationLogger } from "./memory-logger.js";
import { MemoryRegistry } from "./memory-registry.js";
import { MemoryStorageManager } from "./memory-storage.js";
export declare class IntegrityVerifier {
    private readonly logger;
    constructor(logger: MemoryFoundationLogger);
    verify(storage: MemoryStorageManager, registry: MemoryRegistry): MemoryIntegrityResult;
    writeManifest(storage: MemoryStorageManager, storageRoot: string): void;
}
//# sourceMappingURL=integrity-verifier.d.ts.map