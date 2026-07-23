import { ProductIntelligenceQualityMetadata, ProductIntelligenceValidationResult } from "./types.js";
import { ProductIntelligenceFoundationLogger } from "./product-intelligence-logger.js";
import { ProductIntelligenceRegistry } from "./product-intelligence-registry.js";
export declare class ProductIntelligenceQualityValidator {
    private readonly logger;
    private readonly registry;
    private validationTimes;
    constructor(logger: ProductIntelligenceFoundationLogger, registry: ProductIntelligenceRegistry);
    validateMetadata(metadata: ProductIntelligenceQualityMetadata): ProductIntelligenceValidationResult;
    validateModule(moduleId: string): ProductIntelligenceValidationResult;
    getAverageValidationMs(): number;
}
//# sourceMappingURL=product-intelligence-quality-validator.d.ts.map