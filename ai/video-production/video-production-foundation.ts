/**
 * Compact Memory/Knowledge references for video production.
 * Never stores video bytes. Failures do not abort rendering.
 */
import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { CreativeProject } from "../creative-workspace/creative-workspace-manager.js";
import { createKnowledgeTeachingService } from "../knowledge-foundation/knowledge-teaching-service.js";
import { KnowledgeStorageType } from "../knowledge-storage-engine/types.js";
import { isEquivalentKnowledgeMessage } from "../product-intelligence/normalize-profile.js";
import type { VideoProject } from "./types.js";

export async function recordVideoProductionFoundation(
  core: AiCoreManager | null | undefined,
  project: CreativeProject,
  video: VideoProject,
): Promise<Pick<VideoProject, "memoryStatus" | "memoryMessage" | "knowledgeStatus" | "knowledgeMessage" | "foundationKnowledgeIds">> {
  const result: Pick<VideoProject, "memoryStatus" | "memoryMessage" | "knowledgeStatus" | "knowledgeMessage" | "foundationKnowledgeIds"> = {
    memoryStatus: "unavailable",
    knowledgeStatus: "unavailable",
    foundationKnowledgeIds: video.foundationKnowledgeIds ?? [],
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
          draftState: {
            ...previousDraft,
            videoProduction: {
              videoProjectId: video.id,
              creativePlanId: video.creativePlanId,
              renderState: video.renderState,
              outputAssetId: video.output?.assetId,
              aspectRatio: video.renderPlan.aspectRatio,
              sceneCount: video.timeline.length,
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
      const content = knowledgeContent(project, video);
      const taught = await teaching.teach({
        topic: `Video production for ${project.productInformation.name || project.name}`,
        content,
        scope: "project",
        projectId: project.id,
        knowledgeType: KnowledgeStorageType.Video,
        sourceName: "video-knowledge-engine",
        requesterId: "video-production-manager",
        autoApprove: true,
      });
      if (taught.ok && taught.knowledgeId) {
        result.knowledgeStatus = "linked";
        result.foundationKnowledgeIds = [...new Set([...(result.foundationKnowledgeIds ?? []), taught.knowledgeId])];
      } else {
        const duplicateIds = taught.preview?.duplicateKnowledgeIds ?? [];
        const sameProject = await teaching.findReusableProjectEquivalents(project.id, [
          ...duplicateIds,
          ...(result.foundationKnowledgeIds ?? []),
        ]);
        if (sameProject.length) {
          result.knowledgeStatus = "already-linked";
          result.knowledgeMessage = "Equivalent project knowledge already exists and was reused.";
          result.foundationKnowledgeIds = [...new Set([...(result.foundationKnowledgeIds ?? []), ...sameProject])];
        } else if (isEquivalentKnowledgeMessage(taught.error) && !sameProject.length) {
          result.knowledgeStatus = "error";
          result.knowledgeMessage = "Equivalent knowledge exists but does not belong to this project.";
        } else {
          result.knowledgeStatus = taught.ok ? "empty" : "error";
          result.knowledgeMessage = taught.error ?? "Knowledge teaching did not store a record";
        }
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

function knowledgeContent(project: CreativeProject, video: VideoProject): string {
  const scenes = video.timeline.map((clip) =>
    `${clip.order}:${clip.purpose} asset=${clip.assetId} camera=${clip.camera} motion=${clip.motion} ${clip.durationMs}ms`,
  ).join(" | ");
  return [
    `Project ${project.id} (${project.name}). Product ${video.productId}. Video project ${video.id}.`,
    `Creative plan ${video.creativePlanId} version ${video.creativePlanVersion}.`,
    `Aspect ${video.renderPlan.aspectRatio} ${video.renderPlan.width}x${video.renderPlan.height} ${video.renderPlan.frameRate}fps.`,
    `Scenes: ${scenes || "none"}.`,
    `Output asset ${video.output?.assetId ?? "none"} job ${video.output?.renderJobId ?? "none"}.`,
    "This record is production configuration, not a generated video file.",
  ].join(" ");
}
