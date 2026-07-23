import type { KnowledgeRecord } from "../knowledge-storage-engine/types.js";
export interface VersionValidationResult {
    valid: boolean;
    issues: string[];
}
export declare class KnowledgeVersionValidator {
    private readonly storageValidator;
    validate(record: KnowledgeRecord): VersionValidationResult;
}
//# sourceMappingURL=knowledge-version-validator.d.ts.map