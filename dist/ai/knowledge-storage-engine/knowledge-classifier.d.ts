import { KnowledgeClassification, KnowledgeRecord, KnowledgeRecordInput } from "./types.js";
export declare class KnowledgeClassifier {
    classify(input: Pick<KnowledgeRecordInput, "knowledgeType" | "category" | "title" | "description" | "tags" | "qualityScore" | "sourceReliability">): KnowledgeClassification;
    reclassify(record: KnowledgeRecord): KnowledgeClassification;
    private inferTopic;
    private inferImportance;
    private inferBusinessDomain;
    private inferCreativeDomain;
    private inferFutureUsage;
}
//# sourceMappingURL=knowledge-classifier.d.ts.map