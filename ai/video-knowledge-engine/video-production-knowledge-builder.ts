import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { KnowledgeVerificationStatus } from "../knowledge-foundation/types.js";
import type { StructuredKnowledge } from "../knowledge-processing-engine/knowledge-processing-engine.js";

export interface VideoProductionKnowledgeAdvisory {
  topic: string;
  available: boolean;
  confidenceScore: number;
  recommendations: Array<{ area: "camera" | "lighting" | "storytelling" | "motion" | "editing" | "rendering" | "marketing"; guidance: string; reason: string; knowledgeId: string }>;
  relatedKnowledgeIds: string[];
  learningRecommendation?: string;
}

/** Produces explainable production guidance only from validated structured knowledge. */
export class VideoProductionKnowledgeBuilder {
  constructor(private readonly foundation: AiKnowledgeFoundation) {}

  async advise(topic: string, limit = 8): Promise<VideoProductionKnowledgeAdvisory> {
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

    const unique = recommendations.filter((recommendation, index, values) =>
      values.findIndex((candidate) => candidate.guidance === recommendation.guidance) === index
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
      learningRecommendation: unique.length ? undefined : `No validated production knowledge matches "${topic}". Learn it from approved sources before relying on a recommendation.`,
    };
  }
}

function asStructuredKnowledge(payload: Record<string, unknown> | undefined): StructuredKnowledge | null {
  if (!payload || !Array.isArray(payload.professionalTechniques) || !Array.isArray(payload.bestPractices) || !Array.isArray(payload.decisionRules)) return null;
  return payload as unknown as StructuredKnowledge;
}

function areaFor(value: string): VideoProductionKnowledgeAdvisory["recommendations"][number]["area"] {
  const lower = value.toLowerCase();
  if (/camera|shot|framing|composition/.test(lower)) return "camera";
  if (/light|color|grade|visual/.test(lower)) return "lighting";
  if (/story|scene|narrative/.test(lower)) return "storytelling";
  if (/motion|animation/.test(lower)) return "motion";
  if (/edit|transition|subtitle/.test(lower)) return "editing";
  if (/render|export|codec|resolution/.test(lower)) return "rendering";
  return "marketing";
}