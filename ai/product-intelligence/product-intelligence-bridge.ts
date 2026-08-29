/**
 * Persist compact Product Intelligence references in Memory and labeled
 * statements in Knowledge. Never stores image bytes. Failures do not abort analysis.
 */
import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { CreativeProject } from "../creative-workspace/creative-workspace-manager.js";
import { createKnowledgeTeachingService } from "../knowledge-foundation/knowledge-teaching-service.js";
import { KnowledgeStorageType } from "../knowledge-storage-engine/types.js";
import type { ProductIntelligenceProfile } from "./types.js";
import { PRODUCT_INTELLIGENCE_VERSION } from "./types.js";

export async function recordProductIntelligenceFoundation(
  core: AiCoreManager | null | undefined,
  project: CreativeProject,
  profile: ProductIntelligenceProfile,
): Promise<Pick<ProductIntelligenceProfile, "memoryStatus" | "memoryMessage" | "knowledgeStatus" | "knowledgeMessage" | "foundationKnowledgeIds">> {
  const result: Pick<ProductIntelligenceProfile, "memoryStatus" | "memoryMessage" | "knowledgeStatus" | "knowledgeMessage" | "foundationKnowledgeIds"> = {
    memoryStatus: "unavailable",
    knowledgeStatus: "unavailable",
    foundationKnowledgeIds: profile.foundationKnowledgeIds ?? [],
  };

  try {
    const memory = core?.memoryFoundation?.getProjectMemoryEngine?.() ?? null;
    if (memory) {
      const existing = await memory.getProject(project.id);
      if (!existing) {
        result.memoryStatus = "unavailable";
        result.memoryMessage = "Project is not linked in Memory yet";
      } else {
        const previousDraft = memory.checkpoints.getLatest(project.id)?.draftState ?? {};
        const updated = await memory.updateProject(project.id, {
          assets: { images: project.productImages.map((item) => item.id) },
          draftState: {
            ...previousDraft,
            productIntelligence: {
              profileId: profile.id,
              productId: profile.productId || project.id,
              analysisVersion: profile.analysisVersion ?? PRODUCT_INTELLIGENCE_VERSION,
              analysisState: profile.analysisState,
              analyzedAt: profile.updatedAt,
              productSummary: profile.valueProposition?.productSummary ?? profile.identifiedAs,
            },
          },
        });
        result.memoryStatus = updated.success ? "linked" : "error";
        if (!updated.success) result.memoryMessage = updated.reason ?? "Memory update failed";
      }
    } else {
      result.memoryMessage = "Project Memory Engine is not ready";
    }
  } catch (error) {
    result.memoryStatus = "error";
    result.memoryMessage = error instanceof Error ? error.message : "Memory integration failed";
  }

  const knowledge = core?.knowledgeFoundation ?? null;
  if (knowledge?.isStartupComplete?.()) {
    try {
      const teaching = createKnowledgeTeachingService(knowledge);
      const taught = await teaching.teach({
        topic: `Product intelligence for ${project.productInformation.name || project.name}`,
        content: knowledgeContent(project, profile),
        scope: "project",
        projectId: project.id,
        knowledgeType: KnowledgeStorageType.Product,
        sourceName: "product-knowledge-engine",
        requesterId: "product-intelligence-manager",
        autoApprove: true,
      });
      if (taught.ok && taught.knowledgeId) {
        result.knowledgeStatus = "linked";
        result.foundationKnowledgeIds = [...new Set([...(result.foundationKnowledgeIds ?? []), taught.knowledgeId])];
      } else {
        result.knowledgeStatus = taught.ok ? "empty" : "error";
        result.knowledgeMessage = taught.error ?? "Knowledge teaching did not store a record";
      }
    } catch (error) {
      result.knowledgeStatus = "error";
      result.knowledgeMessage = error instanceof Error ? error.message : "Knowledge integration failed";
    }
  } else {
    result.knowledgeMessage = "Knowledge Foundation is not ready";
  }

  return result;
}

function knowledgeContent(project: CreativeProject, profile: ProductIntelligenceProfile): string {
  const user = (profile.userFacts ?? []).map((item) => `${item.field}=${item.value}`).join("; ") || "none";
  const observed = (profile.imageObservations ?? []).map((item) => `${item.field}=${item.value} (${item.confidence})`).join("; ") || "none";
  const inferred = (profile.inferences ?? []).map((item) => `${item.field}=${item.value} (${item.confidence})`).join("; ") || "none";
  const recommended = (profile.recommendations ?? []).map((item) => `${item.field}=${item.value}`).join("; ") || "none";
  return [
    `Project ${project.id} (${project.name}). Product ${profile.productId || project.id}. Analysis ${profile.id} version ${PRODUCT_INTELLIGENCE_VERSION}.`,
    "USER-PROVIDED FACTS are confirmed only when supplied by the user.",
    "IMAGE OBSERVATIONS are visual, not confirmed product identity.",
    "INFERRED statements are not product facts.",
    "MARKETING RECOMMENDATIONS are suggested directions, not confirmed claims.",
    `USER FACTS: ${user}.`,
    `IMAGE OBSERVATIONS: ${observed}.`,
    `INFERRED: ${inferred}.`,
    `MARKETING RECOMMENDATIONS: ${recommended}.`,
    `Value proposition: ${profile.valueProposition?.productSummary ?? profile.identifiedAs}.`,
    `AI inference status: ${profile.aiInferenceStatus ?? "deterministic-only"}.`,
  ].join(" ");
}
