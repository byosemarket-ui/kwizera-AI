/**
 * Persist compact Product Intelligence references in Memory and labeled
 * statements in Knowledge. Never stores image bytes. Failures do not abort analysis.
 */
import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { CreativeProject } from "../creative-workspace/creative-workspace-manager.js";
import { createKnowledgeTeachingService, retrieveFoundationKnowledgeForProject, type KnowledgeTeachingService, type TeachKnowledgeResult } from "../knowledge-foundation/knowledge-teaching-service.js";
import { KnowledgeStorageType } from "../knowledge-storage-engine/types.js";
import type { ProductIntelligenceProfile } from "./types.js";
import { PRODUCT_INTELLIGENCE_VERSION } from "./types.js";
import { isEquivalentKnowledgeMessage } from "./normalize-profile.js";

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
      const content = knowledgeContent(project, profile);
      const taught = await teaching.teach({
        topic: `Product intelligence for ${project.productInformation.name || project.name}`,
        content,
        scope: "project",
        projectId: project.id,
        knowledgeType: KnowledgeStorageType.Product,
        sourceName: "product-knowledge-engine",
        requesterId: "product-intelligence-manager",
        autoApprove: true,
      });
      Object.assign(result, await resolveProductKnowledgeTeach({
        taught,
        teaching,
        projectId: project.id,
        topic: `Product intelligence for ${project.productInformation.name || project.name}`,
        content,
        existingIds: result.foundationKnowledgeIds ?? [],
      }));
    } catch (error) {
      result.knowledgeStatus = "error";
      result.knowledgeMessage = error instanceof Error ? error.message : "Knowledge integration failed";
    }
  } else {
    result.knowledgeMessage = "Knowledge Foundation is not ready";
  }

  return result;
}

/** Re-check a stale equivalent-knowledge error without creating a new record. */
export async function refreshStaleProductKnowledgeStatus(
  core: AiCoreManager | null | undefined,
  project: CreativeProject,
  profile: ProductIntelligenceProfile,
): Promise<Pick<ProductIntelligenceProfile, "knowledgeStatus" | "knowledgeMessage" | "foundationKnowledgeIds">> {
  const current = {
    knowledgeStatus: profile.knowledgeStatus,
    knowledgeMessage: profile.knowledgeMessage,
    foundationKnowledgeIds: profile.foundationKnowledgeIds ?? [],
  };
  if (current.knowledgeStatus === "linked" || current.knowledgeStatus === "already-linked" || current.knowledgeStatus === "existing") {
    return current;
  }
  if (current.knowledgeStatus !== "error" || !isEquivalentKnowledgeMessage(current.knowledgeMessage)) {
    return current;
  }
  const knowledge = core?.knowledgeFoundation ?? null;
  if (!knowledge?.isStartupComplete?.()) return current;
  try {
    const teaching = createKnowledgeTeachingService(knowledge);
    const retrieved = await retrieveFoundationKnowledgeForProject(
      knowledge,
      project,
      "product-intelligence-manager",
      ["product"],
    );
    const reusable = await teaching.findReusableProjectEquivalents(project.id, [
      ...retrieved,
      ...(current.foundationKnowledgeIds ?? []),
    ]);
    if (reusable.length) {
      return {
        knowledgeStatus: "already-linked",
        knowledgeMessage: "Equivalent project knowledge already exists and was reused.",
        foundationKnowledgeIds: [...new Set(reusable)],
      };
    }
    return {
      ...current,
      knowledgeStatus: "error",
      knowledgeMessage: current.knowledgeMessage ?? "Equivalent knowledge exists but does not belong to this project.",
    };
  } catch {
    return current;
  }
}

export async function resolveProductKnowledgeTeach(input: {
  taught: TeachKnowledgeResult;
  teaching: Pick<KnowledgeTeachingService, "findReusableProjectEquivalents" | "storeTaughtKnowledge" | "retrieve">;
  projectId: string;
  topic: string;
  content: string;
  existingIds: string[];
}): Promise<Pick<ProductIntelligenceProfile, "knowledgeStatus" | "knowledgeMessage" | "foundationKnowledgeIds">> {
  if (input.taught.ok && input.taught.knowledgeId) {
    return {
      knowledgeStatus: "linked",
      foundationKnowledgeIds: [...new Set([...input.existingIds, input.taught.knowledgeId])],
    };
  }

  const duplicateIds = input.taught.preview?.duplicateKnowledgeIds ?? [];
  const sameProject = await input.teaching.findReusableProjectEquivalents(input.projectId, [
    ...duplicateIds,
    ...input.existingIds,
  ]);
  if (sameProject.length) {
    return {
      knowledgeStatus: "already-linked",
      knowledgeMessage: "Equivalent project knowledge already exists and was reused.",
      foundationKnowledgeIds: [...new Set([...input.existingIds, ...sameProject])],
    };
  }

  const equivalent = isEquivalentKnowledgeMessage(input.taught.error);
  if (equivalent && duplicateIds.length) {
    const stored = await input.teaching.storeTaughtKnowledge({
      topic: input.topic,
      content: input.content,
      scope: "project",
      projectId: input.projectId,
      knowledgeType: KnowledgeStorageType.Product,
      sourceName: "product-knowledge-engine",
      requestId: input.taught.requestId,
      preview: input.taught.preview,
    });
    if (stored.ok && stored.knowledgeId) {
      return {
        knowledgeStatus: "linked",
        foundationKnowledgeIds: [...new Set([...input.existingIds, stored.knowledgeId])],
      };
    }
  }

  if (equivalent && !sameProject.length) {
    return {
      knowledgeStatus: "error",
      knowledgeMessage: "Equivalent knowledge exists but does not belong to this project.",
      foundationKnowledgeIds: input.existingIds,
    };
  }

  return {
    knowledgeStatus: input.taught.ok ? "empty" : "error",
    knowledgeMessage: input.taught.error ?? "Knowledge teaching did not store a record",
    foundationKnowledgeIds: input.existingIds,
  };
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
