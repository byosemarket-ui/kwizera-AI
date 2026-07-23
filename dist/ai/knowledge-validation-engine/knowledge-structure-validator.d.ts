import type { KnowledgeRecord } from "../knowledge-storage-engine/types.js";
export interface StructureValidationResult {
    valid: boolean;
    issues: string[];
    warnings: string[];
}
export declare class KnowledgeStructureValidator {
    validate(record: KnowledgeRecord): StructureValidationResult;
}
//# sourceMappingURL=knowledge-structure-validator.d.ts.map