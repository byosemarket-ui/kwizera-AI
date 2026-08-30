/**
 * Compact Memory/Knowledge references for video production.
 * Never stores video bytes. Failures do not abort rendering.
 */
import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { CreativeProject } from "../creative-workspace/creative-workspace-manager.js";
import { createKnowledgeTeachingService, type KnowledgeTeachingService, type TeachKnowledgeResult } from "../knowledge-foundation/knowledge-teaching-service.js";
import { KnowledgeStorageType } from "../knowledge-storage-engine/types.js";
import { isEquivalentKnowledgeMessage } from "../product-intelligence/normalize-profile.js";
import { VIDEO_PRODUCTION_VERSION, type VideoKnowledgeStatus, type VideoProject } from "./types.js";

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
              version: VIDEO_PRODUCTION_VERSION,
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
      const topic = `Video production for ${project.productInformation.name || project.name}`;
      const content = buildVideoKnowledgeContent(project, video);
      const taught = await teaching.teach({
        topic,
        content,
        scope: "project",
        projectId: project.id,
        knowledgeType: KnowledgeStorageType.Video,
        sourceName: "video-knowledge-engine",
        requesterId: "video-production-manager",
        autoApprove: true,
      });
      Object.assign(result, await resolveVideoKnowledgeTeach({
        taught,
        teaching,
        projectId: project.id,
        topic,
        content,
        existingIds: result.foundationKnowledgeIds ?? [],
      }));
    } catch (error) {
      result.knowledgeStatus = "failed";
      result.knowledgeMessage = error instanceof Error ? error.message : "Knowledge integration failed";
    }
  } else {
    result.knowledgeMessage = "Knowledge Foundation is not ready";
  }

  return result;
}

export async function resolveVideoKnowledgeTeach(input: {
  taught: TeachKnowledgeResult;
  teaching: Pick<KnowledgeTeachingService, "findReusableProjectEquivalents" | "storeTaughtKnowledge" | "retrieve">;
  projectId: string;
  topic: string;
  content: string;
  existingIds: string[];
}): Promise<{ knowledgeStatus: VideoKnowledgeStatus; knowledgeMessage?: string; foundationKnowledgeIds: string[] }> {
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
  if (equivalent) {
    const stored = await input.teaching.storeTaughtKnowledge({
      topic: input.topic,
      content: input.content,
      scope: "project",
      projectId: input.projectId,
      knowledgeType: KnowledgeStorageType.Video,
      sourceName: "video-knowledge-engine",
      requestId: input.taught.requestId,
      preview: input.taught.preview,
    });
    if (stored.ok && stored.knowledgeId) {
      return {
        knowledgeStatus: "created",
        knowledgeMessage: "Project-scoped video knowledge was stored for this project.",
        foundationKnowledgeIds: [...new Set([...input.existingIds, stored.knowledgeId])],
      };
    }
    return {
      knowledgeStatus: "failed",
      knowledgeMessage: stored.error ?? "Unable to store project-scoped video knowledge.",
      foundationKnowledgeIds: input.existingIds,
    };
  }

  return {
    knowledgeStatus: input.taught.ok ? "empty" : "failed",
    knowledgeMessage: input.taught.error ?? "Knowledge teaching did not store a record",
    foundationKnowledgeIds: input.existingIds,
  };
}

export function buildVideoKnowledgeContent(project: CreativeProject, video: VideoProject): string {
  const scenes = video.timeline.map((clip) =>
    `${clip.order}:${clip.purpose} asset=${clip.assetId} camera=${clip.camera} motion=${clip.motion} ${clip.durationMs}ms`,
  ).join(" | ");
  const sources = [...new Set(video.timeline.map((clip) => clip.assetId))].join(",");
  return [
    `Project ${project.id} (${project.name}). Product ${video.productId}. Video project ${video.id}.`,
    `Creative plan ${video.creativePlanId} version ${video.creativePlanVersion}. Pipeline ${VIDEO_PRODUCTION_VERSION}.`,
    `Aspect ${video.renderPlan.aspectRatio} ${video.renderPlan.width}x${video.renderPlan.height} ${video.renderPlan.frameRate}fps.`,
    `Source assets ${sources || "none"}. Output asset ${video.output?.assetId ?? "none"} job ${video.output?.renderJobId ?? "none"}.`,
    `Source video-knowledge-engine. Knowledge type video-knowledge. Recorded at ${video.modifiedAt}. Scenes: ${scenes || "none"}.`,
    "This record is production configuration, not a generated video file. Project-scoped only.",
  ].join(" ");
}
