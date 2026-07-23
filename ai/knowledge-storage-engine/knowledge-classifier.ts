import { KnowledgeClassification, KnowledgeRecord, KnowledgeRecordInput } from "./types.js";
import { KnowledgeStorageType } from "./types.js";
import { getKnowledgeStorageTypeDefinition } from "./storage-type-config.js";

export class KnowledgeClassifier {
  classify(
    input: Pick<
      KnowledgeRecordInput,
      "knowledgeType" | "category" | "title" | "description" | "tags" | "qualityScore" | "sourceReliability"
    >
  ): KnowledgeClassification {
    const def = getKnowledgeStorageTypeDefinition(input.knowledgeType);
    const quality = input.qualityScore ?? 80;
    const reliability = input.sourceReliability ?? 75;
    const topic = this.inferTopic(input.title, input.description, input.tags ?? []);

    return {
      category: input.category || def.categoryLabel,
      topic,
      importance: this.inferImportance(quality, reliability, input.knowledgeType),
      reliability: reliability >= 85 ? "high" : reliability >= 60 ? "medium" : "low",
      businessDomain: this.inferBusinessDomain(input.knowledgeType),
      creativeDomain: this.inferCreativeDomain(input.knowledgeType),
      learningValue: Math.round((quality + reliability) / 2),
      futureUsage: this.inferFutureUsage(input.knowledgeType, quality),
    };
  }

  reclassify(record: KnowledgeRecord): KnowledgeClassification {
    return this.classify({
      knowledgeType: record.knowledgeType,
      category: record.category,
      title: record.title,
      description: record.description,
      tags: record.tags,
      qualityScore: record.qualityScore,
      sourceReliability: record.sourceReliability,
    });
  }

  private inferTopic(title: string, description: string, tags: string[]): string {
    const words = `${title} ${description} ${tags.join(" ")}`
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);
    return words.slice(0, 3).join("-") || "general";
  }

  private inferImportance(
    quality: number,
    reliability: number,
    type: KnowledgeStorageType
  ): KnowledgeClassification["importance"] {
    const score = (quality + reliability) / 2;
    if (type === KnowledgeStorageType.Decision || type === KnowledgeStorageType.Workflow) {
      return score >= 80 ? "critical" : score >= 65 ? "high" : "medium";
    }
    if (score >= 90) return "critical";
    if (score >= 75) return "high";
    if (score >= 55) return "medium";
    return "low";
  }

  private inferBusinessDomain(type: KnowledgeStorageType): string {
    switch (type) {
      case KnowledgeStorageType.Product:
      case KnowledgeStorageType.Business:
      case KnowledgeStorageType.Industry:
        return "business";
      case KnowledgeStorageType.Marketing:
      case KnowledgeStorageType.Brand:
        return "marketing";
      case KnowledgeStorageType.Workflow:
      case KnowledgeStorageType.Decision:
        return "operations";
      default:
        return "general";
    }
  }

  private inferCreativeDomain(type: KnowledgeStorageType): string {
    switch (type) {
      case KnowledgeStorageType.Image:
      case KnowledgeStorageType.Video:
      case KnowledgeStorageType.Creative:
        return "creative-production";
      case KnowledgeStorageType.Language:
        return "language-localization";
      case KnowledgeStorageType.Marketing:
        return "campaign-creative";
      default:
        return "none";
    }
  }

  private inferFutureUsage(type: KnowledgeStorageType, quality: number): string {
    if (quality < 50) return "archive-candidate";
    if (
      type === KnowledgeStorageType.Reasoning ||
      type === KnowledgeStorageType.Decision ||
      type === KnowledgeStorageType.Workflow
    ) {
      return "reasoning-planning";
    }
    if (type === KnowledgeStorageType.Product || type === KnowledgeStorageType.Industry) {
      return "product-intelligence";
    }
    return "search-retrieval";
  }
}
