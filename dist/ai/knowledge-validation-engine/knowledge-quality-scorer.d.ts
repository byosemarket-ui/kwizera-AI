import type { KnowledgeRecord } from "../knowledge-storage-engine/types.js";
import { KnowledgeQualityScores } from "./types.js";
export declare class KnowledgeQualityScorer {
    score(record: KnowledgeRecord, structureWarnings: string[], relationshipIssues: string[], sourceIssues: string[]): KnowledgeQualityScores;
    private scoreCompleteness;
    private scoreConsistency;
}
//# sourceMappingURL=knowledge-quality-scorer.d.ts.map