import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { MemoryOptimizationLogger } from "./optimization-logger.js";
import { MemoryAnalysisReport } from "./types.js";
export declare class MemoryAnalyzer {
    private readonly foundation;
    private readonly logger;
    constructor(foundation: AiMemoryFoundation, logger: MemoryOptimizationLogger);
    analyze(): Promise<MemoryAnalysisReport>;
}
//# sourceMappingURL=memory-analyzer.d.ts.map