import { KnowledgeIntegrityResult } from "./types.js";
import { KnowledgeFoundationLogger } from "./knowledge-logger.js";
import { KnowledgeRegistry } from "./knowledge-registry.js";
import { KnowledgeStorageManager } from "./knowledge-storage.js";
export declare class KnowledgeIntegrityVerifier {
    private readonly logger;
    constructor(logger: KnowledgeFoundationLogger);
    verify(storage: KnowledgeStorageManager, registry: KnowledgeRegistry): KnowledgeIntegrityResult;
    writeManifest(storage: KnowledgeStorageManager, storageRoot: string): void;
}
//# sourceMappingURL=knowledge-integrity-verifier.d.ts.map