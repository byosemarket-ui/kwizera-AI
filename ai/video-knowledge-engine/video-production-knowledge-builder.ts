import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { KnowledgeVerificationStatus } from "../knowledge-foundation/types.js";
import type { StructuredKnowledge } from "../knowledge-processing-engine/knowledge-processing-engine.js";
import type { ProfessionalVideoProductionKnowledge } from "./professional-video-production-knowledge.js";

export interface VideoProductionKnowledgeAdvisory {
  topic: string;
  available: boolean;
  confidenceScore: number;
  recommendations: Array<{
    area:
      | "camera"
      | "lighting"
      | "storytelling"
      | "motion"
      | "editing"
      | "rendering"
      | "marketing"
      | "production";
    guidance: string;
    reason: string;
    knowledgeId: string;
  }>;
  relatedKnowledgeIds: string[];
  learningRecommendation?: string;
}

/** Produces explainable production guidance from curated expansion knowledge and validated structured records. */
export class VideoProductionKnowledgeBuilder {
  private professional: ProfessionalVideoProductionKnowledge | null = null;

  constructor(private readonly foundation: AiKnowledgeFoundation) {}

  bindProfessionalKnowledge(professional: ProfessionalVideoProductionKnowledge): void {
    this.professional = professional;
  }

  async advise(topic: string, limit = 8): Promise<VideoProductionKnowledgeAdvisory> {
    const curated = this.adviseFromCurated(topic, limit);
    if (curated.available) return curated;

    const search = await this.foundation.getRetrievalEngine().search({
      text: topic,
      limit,
      minConfidenceScore: 65,
      requesterId: "video-production-knowledge-builder",
    });
    const recommendations: VideoProductionKnowledgeAdvisory["recommendations"] = [];
    const relatedKnowledgeIds = new Set<string>();
    const confidences: number[] = [];

    for (const result of search.results) {
      const record = result.record;
      if (!record || record.verificationStatus !== KnowledgeVerificationStatus.Verified) continue;
      const structured = asStructuredKnowledge(record.payload);
      if (!structured) continue;
      confidences.push(record.confidenceScore);
      relatedKnowledgeIds.add(record.knowledgeId);
      for (const edge of this.foundation.getGraphEngine().getRelationships(record.knowledgeId)) {
        relatedKnowledgeIds.add(edge.sourceId === record.knowledgeId ? edge.targetId : edge.sourceId);
      }
      for (const guidance of [...structured.professionalTechniques, ...structured.bestPractices, ...structured.decisionRules].slice(0, 3)) {
        recommendations.push({
          area: areaFor([record.title, structured.domain, guidance].join(" ")),
          guidance,
          reason: `Validated ${record.title} (${record.confidenceScore}/100 confidence).`,
          knowledgeId: record.knowledgeId,
        });
      }
    }

    const unique = recommendations.filter(
      (recommendation, index, values) => values.findIndex((candidate) => candidate.guidance === recommendation.guidance) === index
    );
    const confidenceScore = confidences.length
      ? Math.round(confidences.reduce((total, score) => total + score, 0) / confidences.length)
      : 0;
    return {
      topic,
      available: unique.length > 0,
      confidenceScore,
      recommendations: unique.slice(0, limit),
      relatedKnowledgeIds: [...relatedKnowledgeIds],
      learningRecommendation: unique.length
        ? undefined
        : `No validated production knowledge matches "${topic}". Learn it from approved sources before relying on a recommendation.`,
    };
  }

  explain(topic: string) {
    if (!this.professional?.isStartupComplete()) {
      return {
        available: false,
        knowledgeId: null,
        title: topic,
        explanation: "Professional Video Production Knowledge is not ready.",
        professionalDefinition: "",
        bestPractices: [],
        workflow: [],
        decisionRules: [],
        relatedTopics: [],
        confidenceScore: 0,
        qualityScore: 0,
      };
    }
    return this.professional.explain(topic);
  }

  recommendWorkflow(topic = "production workflow") {
    if (!this.professional?.isStartupComplete()) {
      return { available: false, workflow: [], reason: "Professional knowledge not ready.", confidenceScore: 0 };
    }
    return this.professional.recommendWorkflow(topic);
  }

  recommendBestPractices(topic: string) {
    if (!this.professional?.isStartupComplete()) {
      return { available: false, practices: [], reason: "Professional knowledge not ready.", confidenceScore: 0 };
    }
    return this.professional.recommendBestPractices(topic);
  }

  compare(topicA: string, topicB: string) {
    if (!this.professional?.isStartupComplete()) {
      return {
        topicA,
        topicB,
        similarities: [],
        differences: [],
        recommendation: "Professional knowledge not ready.",
        confidenceScore: 0,
      };
    }
    return this.professional.compare(topicA, topicB);
  }

  answer(question: string) {
    if (!this.professional?.isStartupComplete()) {
      return { available: false, answer: "Professional knowledge not ready.", knowledgeIds: [], confidenceScore: 0 };
    }
    return this.professional.answer(question);
  }

  private adviseFromCurated(topic: string, limit: number): VideoProductionKnowledgeAdvisory {
    if (!this.professional?.isStartupComplete()) {
      return { topic, available: false, confidenceScore: 0, recommendations: [], relatedKnowledgeIds: [] };
    }
    const explained = this.professional.explain(topic);
    if (!explained.available || !explained.knowledgeId) {
      const answered = this.professional.answer(topic);
      if (!answered.available) {
        return { topic, available: false, confidenceScore: 0, recommendations: [], relatedKnowledgeIds: [] };
      }
      return {
        topic,
        available: true,
        confidenceScore: answered.confidenceScore,
        recommendations: [
          {
            area: "production",
            guidance: answered.answer,
            reason: "Curated professional video production knowledge.",
            knowledgeId: answered.knowledgeIds[0] ?? "vp-video-production-fundamentals",
          },
        ],
        relatedKnowledgeIds: answered.knowledgeIds,
      };
    }
    const recommendations: VideoProductionKnowledgeAdvisory["recommendations"] = [
      ...explained.bestPractices.slice(0, 2).map((guidance) => ({
        area: areaFor(explained.title) as VideoProductionKnowledgeAdvisory["recommendations"][number]["area"],
        guidance,
        reason: `Curated best practice from ${explained.title}.`,
        knowledgeId: explained.knowledgeId!,
      })),
      ...explained.decisionRules.slice(0, 2).map((guidance) => ({
        area: "production" as const,
        guidance,
        reason: `Curated decision rule from ${explained.title}.`,
        knowledgeId: explained.knowledgeId!,
      })),
      ...explained.workflow.slice(0, 2).map((guidance) => ({
        area: "production" as const,
        guidance,
        reason: `Curated workflow step from ${explained.title}.`,
        knowledgeId: explained.knowledgeId!,
      })),
    ].slice(0, limit);
    return {
      topic,
      available: recommendations.length > 0,
      confidenceScore: explained.confidenceScore,
      recommendations,
      relatedKnowledgeIds: [explained.knowledgeId, ...explained.relatedTopics.map((id) => `vp-${id}`)],
    };
  }
}

function asStructuredKnowledge(payload: Record<string, unknown> | undefined): StructuredKnowledge | null {
  if (
    !payload ||
    !Array.isArray(payload.professionalTechniques) ||
    !Array.isArray(payload.bestPractices) ||
    !Array.isArray(payload.decisionRules)
  ) {
    // Expansion payloads nest structuredKnowledge
    const nested = payload?.structuredKnowledge as StructuredKnowledge | undefined;
    if (
      nested &&
      Array.isArray(nested.professionalTechniques) &&
      Array.isArray(nested.bestPractices) &&
      Array.isArray(nested.decisionRules)
    ) {
      return nested;
    }
    return null;
  }
  return payload as unknown as StructuredKnowledge;
}

function areaFor(value: string): VideoProductionKnowledgeAdvisory["recommendations"][number]["area"] {
  const lower = value.toLowerCase();
  if (/camera|shot|framing|composition|coverage/.test(lower)) return "camera";
  if (/light|color|grade|visual style/.test(lower)) return "lighting";
  if (/story|scene|narrative/.test(lower)) return "storytelling";
  if (/motion|animation|rhythm/.test(lower)) return "motion";
  if (/edit|transition|subtitle|pacing|post-production/.test(lower)) return "editing";
  if (/render|export|codec|resolution/.test(lower)) return "rendering";
  if (/market|commercial|social|cta|advert/.test(lower)) return "marketing";
  return "production";
}
