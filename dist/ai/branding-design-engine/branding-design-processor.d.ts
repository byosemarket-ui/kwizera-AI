import type { AiImageGenerationFoundation } from "../image-generation-foundation/image-generation-foundation.js";
import { BrandingDesignAnalyzer } from "./branding-design-analyzer.js";
import { BrandingDesignLinker } from "./branding-design-linker.js";
import { BrandingDesignLogger } from "./branding-design-logger.js";
import { BrandingDesignScorer } from "./branding-design-scorer.js";
import { BrandingDesignRecordStore } from "./branding-design-stores.js";
import { BrandingDesignInput, BrandingDesignRecord, BrandingDesignResult, BrandingDesignSearchQuery } from "./types.js";
export declare class BrandingDesignProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiImageGenerationFoundation, analyzer: BrandingDesignAnalyzer, scorer: BrandingDesignScorer, linker: BrandingDesignLinker, records: BrandingDesignRecordStore, logger: BrandingDesignLogger);
    generateBrandingPlan(input: BrandingDesignInput): Promise<BrandingDesignResult>;
    search(query: BrandingDesignSearchQuery): BrandingDesignRecord[];
    private resolveContext;
    private registerGenerationAssets;
    private applySafeRepairs;
    private reject;
}
//# sourceMappingURL=branding-design-processor.d.ts.map