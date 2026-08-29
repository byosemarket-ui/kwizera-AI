/**
 * Persist image analysis references in Memory and labeled observations in Knowledge.
 * Never stores image bytes. Failures do not abort analysis.
 */
import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { CreativeProject, ProductImage } from "../creative-workspace/creative-workspace-manager.js";
import { createKnowledgeTeachingService } from "../knowledge-foundation/knowledge-teaching-service.js";
import { KnowledgeStorageType } from "../knowledge-storage-engine/types.js";
import type { ImageIntelligenceProfile } from "./types.js";
import { ANALYSIS_VERSION } from "./visual-metrics.js";

export async function recordImageAnalysisFoundation(
  core: AiCoreManager | null | undefined,
  project: CreativeProject,
  image: ProductImage,
  profile: ImageIntelligenceProfile,
  projectProfiles: ImageIntelligenceProfile[] = [],
): Promise<Pick<ImageIntelligenceProfile, "memoryStatus" | "memoryMessage" | "knowledgeStatus" | "knowledgeMessage" | "foundationKnowledgeIds">> {
  const result: Pick<ImageIntelligenceProfile, "memoryStatus" | "memoryMessage" | "knowledgeStatus" | "knowledgeMessage" | "foundationKnowledgeIds"> = {
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
        const analyses = [profile, ...projectProfiles.filter((item) => item.imageId !== image.id)].map((item) => ({
          assetId: item.imageId,
          profileId: item.id,
          analyzedAt: item.updatedAt,
          analysisVersion: item.analysisVersion ?? ANALYSIS_VERSION,
          originalChecksumSha256: item.provenance?.originalChecksumSha256,
          aiVisionStatus: item.aiVisionStatus,
          pixelAnalysisAvailable: Boolean(item.visualMetrics?.pixelAnalysisAvailable),
          summary: compactSummary(item),
        }));
        const updated = await memory.updateProject(project.id, {
          assets: { images: project.productImages.map((item) => item.id) },
          draftState: {
            imageAnalyses: analyses,
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
        topic: `Visual observations for project image ${image.id}`,
        content: knowledgeContent(project, image, profile),
        scope: "project",
        projectId: project.id,
        knowledgeType: KnowledgeStorageType.Image,
        sourceName: "image-intelligence-step6",
        requesterId: "image-intelligence-manager",
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

function compactSummary(profile: ImageIntelligenceProfile): string {
  const colors = profile.visualMetrics?.dominantColors?.map((color) => color.name).join(",") || "none";
  return `${profile.fileName}; ${profile.visualMetrics?.width ?? "?"}x${profile.visualMetrics?.height ?? "?"}; ${profile.visualMetrics?.method}; colors=${colors}; vision=${profile.aiVisionStatus}`;
}

function knowledgeContent(project: CreativeProject, image: ProductImage, profile: ImageIntelligenceProfile): string {
  const observed = (profile.observations ?? []).filter((item) => item.kind === "observed-from-image");
  const inferred = (profile.observations ?? []).filter((item) => item.kind === "inferred");
  const userProvided = (profile.observations ?? []).filter((item) => item.kind === "user-provided");
  return [
    `Project ${project.id} (${project.name}). Asset ${image.id}. Analysis ${profile.id} version ${ANALYSIS_VERSION}.`,
    "These are visual observations, not confirmed product facts.",
    `AI vision status: ${profile.aiVisionStatus ?? "IMAGE_ANALYSIS_UNAVAILABLE"}.`,
    `OBSERVED FROM IMAGE: ${observed.map((item) => `${item.field}=${item.value} (${item.confidence})`).join("; ") || "none"}.`,
    `INFERRED: ${inferred.map((item) => `${item.field}=${item.value} (${item.confidence})`).join("; ") || "none"}.`,
    `USER-PROVIDED PRODUCT INFORMATION: ${userProvided.map((item) => `${item.field}=${item.value}`).join("; ") || "none"}.`,
    `Provenance provider ${profile.provenance?.provider ?? "local"}; original checksum ${image.checksumSha256 ?? "unknown"}.`,
  ].join(" ");
}
