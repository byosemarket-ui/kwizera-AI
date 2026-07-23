import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { MemoryOptimizationLogger } from "./optimization-logger.js";
export declare class MetadataCompressor {
    private readonly foundation;
    private readonly logger;
    constructor(foundation: AiMemoryFoundation, logger: MemoryOptimizationLogger);
    compress(): Promise<{
        compressed: number;
        bytesSaved: number;
        durationMs: number;
    }>;
    private cleanPayload;
}
//# sourceMappingURL=metadata-compressor.d.ts.map