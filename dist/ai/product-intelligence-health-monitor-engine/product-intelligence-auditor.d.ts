import type { AiProductIntelligenceFoundation } from "../product-intelligence-foundation/product-intelligence-foundation.js";
import { ProductIntelligenceHealthMonitorLogger } from "./health-logger.js";
import { ProductIntelligenceAuditResult } from "./types.js";
export declare class ProductIntelligenceAuditor {
    private readonly foundation;
    private readonly storageRoot;
    private readonly logger;
    constructor(foundation: AiProductIntelligenceFoundation, storageRoot: string, logger: ProductIntelligenceHealthMonitorLogger);
    runAudit(): Promise<ProductIntelligenceAuditResult>;
}
//# sourceMappingURL=product-intelligence-auditor.d.ts.map