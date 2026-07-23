import type { KnowledgeValidationStatusReport } from "./types.js";
import type { KnowledgeValidationRunner } from "./knowledge-validation-runner.js";
import type { KnowledgeIntegrityValidator } from "./knowledge-integrity-validator.js";
import type { KnowledgeRelationshipValidator } from "./knowledge-relationship-validator.js";
export declare class ValidationReportGenerator {
    private readonly storageRoot;
    private readonly runner;
    private readonly integrityValidator;
    private readonly relationshipValidator;
    constructor(storageRoot: string, runner: KnowledgeValidationRunner, integrityValidator: KnowledgeIntegrityValidator, relationshipValidator: KnowledgeRelationshipValidator);
    generateAll(status: KnowledgeValidationStatusReport): Promise<{
        validationReportPath: string;
        qualityReportPath: string;
        integrityReportPath: string;
    }>;
    private buildValidationReport;
    private buildQualityReport;
    private buildIntegrityReport;
}
//# sourceMappingURL=validation-report-generator.d.ts.map