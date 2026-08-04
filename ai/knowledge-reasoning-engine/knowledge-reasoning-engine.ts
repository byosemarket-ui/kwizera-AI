import fs from "node:fs/promises";
import path from "node:path";
import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { KnowledgeVerificationStatus } from "../knowledge-foundation/types.js";
import type { StructuredKnowledge } from "../knowledge-processing-engine/knowledge-processing-engine.js";
import type { KnowledgeImpactReport, ProfessionalKnowledgeReasoningResult, ProfessionalKnowledgeRecommendation } from "./types.js";

/** Reasons over validated structured knowledge and graph context; never treats raw documents as evidence. */
export class AiKnowledgeReasoningEngine {
  private foundation: AiKnowledgeFoundation | null = null;
  private impactDirectory = "";
  private initialized = false;

  async initialize(foundation: AiKnowledgeFoundation, storageRoot: string): Promise<void> {
    this.foundation = foundation;
    this.impactDirectory = path.join(storageRoot, "knowledge", "impact");
    await fs.mkdir(this.impactDirectory, { recursive: true });
    this.initialized = true;
  }

  async reason(topic: string, limit = 8): Promise<ProfessionalKnowledgeReasoningResult> {
    this.ensureReady();
    const search = await this.foundation!.getRetrievalEngine().search({
      text: topic,
      limit,
      minConfidenceScore: 65,
      requesterId: "knowledge-reasoning-engine",
    });
    const candidates: Array<ProfessionalKnowledgeRecommendation & { risks: string[]; rules: string[]; score: number }> = [];
    const relatedKnowledgeIds = new Set<string>();

    for (const result of search.results) {
      const record = result.record;
      if (!record || record.verificationStatus !== KnowledgeVerificationStatus.Verified) continue;
      const structured = asStructuredKnowledge(record.payload);
      if (!structured) continue;
      const guidance = [...structured.decisionRules, ...structured.bestPractices, ...structured.professionalTechniques][0];
      if (!guidance) continue;
      const graphLinks = this.foundation!.getGraphEngine().getRelationships(record.knowledgeId);
      graphLinks.forEach((edge) => relatedKnowledgeIds.add(edge.sourceId === record.knowledgeId ? edge.targetId : edge.sourceId));
      candidates.push({
        knowledgeId: record.knowledgeId,
        guidance,
        reason: `Validated source (${record.confidenceScore}/100 confidence) with ${graphLinks.length} graph relationship(s).`,
        confidenceScore: record.confidenceScore,
        risks: structured.commonMistakes,
        rules: structured.decisionRules,
        score: Math.round(record.confidenceScore * 0.7 + record.qualityScore * 0.3 + Math.min(graphLinks.length, 5)),
      });
    }

    candidates.sort((first, second) => second.score - first.score);
    const selected = candidates[0] ?? null;
    const alternatives = candidates.slice(1, 4).map(stripCandidate);
    const decisionRules = unique(candidates.flatMap((candidate) => candidate.rules)).slice(0, 12);
    const risks = unique(candidates.flatMap((candidate) => candidate.risks)).slice(0, 8);
    const confidenceScore = selected?.confidenceScore ?? 0;
    return {
      topic,
      available: Boolean(selected),
      confidenceScore,
      selected: selected ? stripCandidate(selected) : null,
      alternatives,
      decisionRules,
      risks,
      tradeOffs: alternatives.map((alternative) => `Alternative from ${alternative.knowledgeId}: ${alternative.guidance}`),
      relatedKnowledgeIds: [...relatedKnowledgeIds],
      explanation: selected
        ? `Selected validated guidance from ${selected.knowledgeId} because it has the strongest combined confidence, quality, and relationship evidence.`
        : `No validated structured knowledge matches "${topic}". Learn and approve reliable source material before using a professional recommendation.`,
    };
  }

  async analyzeImpact(knowledgeId: string, operation: "create" | "update"): Promise<KnowledgeImpactReport> {
    this.ensureReady();
    const read = await this.foundation!.getStorageEngine().getRecord(knowledgeId, "knowledge-reasoning-engine");
    const record = read.record;
    const text = [record?.title, record?.category, record?.classification.businessDomain, record?.classification.creativeDomain].filter(Boolean).join(" ").toLowerCase();
    const relatedKnowledgeIds = record ? this.foundation!.getGraphEngine().getRelationships(record.knowledgeId).map((edge) => edge.sourceId === record.knowledgeId ? edge.targetId : edge.sourceId) : [];
    const report: KnowledgeImpactReport = {
      knowledgeId,
      operation,
      affectedWorkflows: match(text, { video: "video-production", camera: "camera-planning", motion: "motion-planning", render: "rendering-preparation", marketing: "marketing-campaign", image: "image-production" }),
      affectedDecisions: match(text, { video: "video-planning", camera: "camera-direction", marketing: "marketing-strategy", image: "image-generation", product: "product-presentation" }),
      affectedRecommendations: match(text, { render: "rendering", camera: "camera", marketing: "marketing", image: "image", video: "video" }) as KnowledgeImpactReport["affectedRecommendations"],
      relatedKnowledgeIds: unique(relatedKnowledgeIds),
      createdAt: new Date().toISOString(),
    };
    await fs.writeFile(path.join(this.impactDirectory, `${knowledgeId}.json`), `${JSON.stringify(report, null, 2)}\n`, "utf8");
    return report;
  }

  private ensureReady(): void {
    if (!this.initialized || !this.foundation) throw new Error("Knowledge Reasoning Engine is not initialized");
  }
}

function asStructuredKnowledge(payload: Record<string, unknown> | undefined): StructuredKnowledge | null {
  if (!payload || !Array.isArray(payload.decisionRules) || !Array.isArray(payload.bestPractices) || !Array.isArray(payload.professionalTechniques)) return null;
  return payload as unknown as StructuredKnowledge;
}

function stripCandidate(candidate: ProfessionalKnowledgeRecommendation & { risks: string[]; rules: string[]; score: number }): ProfessionalKnowledgeRecommendation {
  return { knowledgeId: candidate.knowledgeId, guidance: candidate.guidance, reason: candidate.reason, confidenceScore: candidate.confidenceScore };
}

function match(text: string, entries: Record<string, string>): string[] {
  return Object.entries(entries).filter(([term]) => text.includes(term)).map(([, value]) => value);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}