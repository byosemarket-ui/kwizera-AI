/**
 * Connects Creative Workspace projects to Memory + Knowledge without
 * duplicating assets. Failures are recorded on the project; they do not
 * abort create/open/upload.
 */
import type { AiProjectMemoryEngine } from "../project-memory-engine/project-memory-engine.js";
import { ProjectType } from "../project-memory-engine/types.js";
import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { retrieveFoundationKnowledgeForProject } from "../knowledge-foundation/knowledge-teaching-service.js";
import type { CreativeProject } from "./creative-workspace-manager.js";
import type { ProjectFoundationLinks } from "./project-asset.js";

export interface FoundationRuntime {
  memoryFoundation?: { getProjectMemoryEngine(): AiProjectMemoryEngine } | null;
  knowledgeFoundation?: AiKnowledgeFoundation | null;
}

export async function linkProjectFoundation(
  project: CreativeProject,
  runtime: FoundationRuntime | null | undefined,
  reason: "create" | "open" | "asset",
): Promise<ProjectFoundationLinks> {
  const links: ProjectFoundationLinks = {
    memoryId: null,
    memoryStatus: "unavailable",
    knowledgeScope: "project",
    knowledgeIds: [],
    knowledgeStatus: "unavailable",
  };

  let memory: AiProjectMemoryEngine | null = null;
  try {
    memory = runtime?.memoryFoundation?.getProjectMemoryEngine() ?? null;
  } catch {
    memory = null;
  }

  if (memory) {
    try {
      const existing = await memory.getProject(project.id);
      if (!existing && reason === "create") {
        const created = await memory.createProject({
          projectId: project.id,
          projectName: project.name,
          projectType: ProjectType.Product,
          description: project.description || project.productInformation?.description || project.name,
          language: project.language,
          tags: ["creative-workspace", "step5"],
        });
        links.memoryId = created.success ? created.memoryId : null;
        links.memoryStatus = created.success ? "linked" : "error";
        if (!created.success) links.memoryMessage = created.reason ?? "Memory create failed";
      } else if (!existing) {
        const created = await memory.createProject({
          projectId: project.id,
          projectName: project.name,
          projectType: ProjectType.Product,
          description: project.description || project.name,
          language: project.language,
          tags: ["creative-workspace", "step5"],
        });
        links.memoryId = created.success ? created.memoryId : null;
        links.memoryStatus = created.success ? "linked" : "error";
        if (!created.success) links.memoryMessage = created.reason ?? "Memory create failed";
      } else {
        const imageIds = project.productImages.map((image) => image.id);
        const updated = await memory.updateProject(project.id, {
          projectName: project.name,
          assets: { images: imageIds },
          draftState: {
            workspaceStatus: project.status ?? "open",
            assetCount: imageIds.length,
            reason,
          },
        });
        links.memoryId = existing.memoryId ?? project.id;
        links.memoryStatus = updated.success ? "linked" : "error";
        if (!updated.success) links.memoryMessage = updated.reason;
      }
    } catch (error) {
      links.memoryStatus = "error";
      links.memoryMessage = error instanceof Error ? error.message : "Memory integration failed";
    }
  } else {
    links.memoryMessage = "Project Memory Engine is not ready";
  }

  const knowledge = runtime?.knowledgeFoundation ?? null;
  if (knowledge?.isStartupComplete?.()) {
    try {
      const ids = await retrieveFoundationKnowledgeForProject(
        knowledge,
        project,
        "creative-workspace",
        project.productImages.map((image) => image.id),
      );
      links.knowledgeIds = ids;
      links.knowledgeStatus = ids.length ? "linked" : "empty";
      if (!ids.length) {
        links.knowledgeMessage = "No project-scoped knowledge yet. Image Intelligence can attach later.";
      }
    } catch (error) {
      links.knowledgeStatus = "error";
      links.knowledgeMessage = error instanceof Error ? error.message : "Knowledge integration failed";
    }
  } else {
    links.knowledgeMessage = "Knowledge Foundation is not ready";
  }

  return links;
}
