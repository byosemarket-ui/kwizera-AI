import crypto from "node:crypto";
import { MemoryStorageType } from "../memory-storage-engine/types.js";
import { ProjectStatus, ProjectType, } from "./types.js";
function emptyAssets() {
    return {
        images: [],
        videos: [],
        audio: [],
        logos: [],
        brandAssets: [],
        scripts: [],
        captions: [],
        posters: [],
        marketingContent: [],
        generatedVideos: [],
    };
}
function emptyWorkflow() {
    return {
        workflowHistory: [],
        aiDecisions: [],
        reasoningHistory: [],
        planningHistory: [],
        taskHistory: [],
        recoveryHistory: [],
        validationHistory: [],
    };
}
export function recordFromMemory(record) {
    const payload = (record.payload ?? {});
    return {
        projectId: payload.projectId ?? record.memoryId,
        memoryId: record.memoryId,
        projectName: record.title,
        projectType: payload.projectType ?? ProjectType.General,
        creationDate: record.creationTime,
        lastModified: record.lastUpdate,
        status: payload.status ?? ProjectStatus.Created,
        completionPercentage: payload.completionPercentage ?? 0,
        description: record.description,
        targetAudience: payload.targetAudience ?? "",
        marketingGoal: payload.marketingGoal ?? "",
        brandInformation: payload.brandInformation ?? {},
        language: payload.language ?? "en",
        exportHistory: payload.exportHistory ?? [],
        assets: payload.assets ?? emptyAssets(),
        workflowHistory: payload.workflowHistory ?? emptyWorkflow(),
        scores: payload.scores ?? {
            qualityScore: record.qualityScore,
            learningScore: 0,
            completionScore: 0,
            recoveryScore: 50,
            aiConfidenceScore: record.qualityScore,
        },
        relatedMemories: payload.relatedMemories ?? [],
        versions: payload.versions ?? [],
        latestCheckpointId: payload.latestCheckpointId,
        tags: record.tags,
        keywords: record.keywords,
    };
}
export class ProjectProcessor {
    foundation;
    history;
    checkpoints;
    scorer;
    linker;
    logger;
    projects;
    constructor(foundation, history, checkpoints, scorer, linker, logger, projects) {
        this.foundation = foundation;
        this.history = history;
        this.checkpoints = checkpoints;
        this.scorer = scorer;
        this.linker = linker;
        this.logger = logger;
        this.projects = projects;
    }
    async create(input) {
        const start = Date.now();
        const projectId = input.projectId ?? `proj-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
        const now = new Date().toISOString();
        const draft = {
            projectId,
            memoryId: projectId,
            projectName: input.projectName,
            projectType: input.projectType,
            creationDate: now,
            lastModified: now,
            status: ProjectStatus.Created,
            completionPercentage: 0,
            description: input.description,
            targetAudience: input.targetAudience ?? "",
            marketingGoal: input.marketingGoal ?? "",
            brandInformation: input.brandInformation ?? {},
            language: input.language ?? "en",
            exportHistory: [],
            assets: emptyAssets(),
            workflowHistory: emptyWorkflow(),
            scores: { qualityScore: 0, learningScore: 0, completionScore: 0, recoveryScore: 50, aiConfidenceScore: 0 },
            relatedMemories: [],
            versions: [{ version: 1, timestamp: now, changeSummary: "Project created", memoryVersion: 1 }],
            tags: input.tags ?? [],
            keywords: input.keywords ?? [input.projectType, input.projectName.toLowerCase()],
        };
        draft.scores = this.scorer.computeScores(draft);
        const relationships = this.linker.link(projectId, draft.tags);
        draft.relatedMemories = relationships.relatedMemories;
        const storeResult = await this.foundation.getStorageEngine().storeRecord(this.toMemoryInput(draft), "project-memory-engine");
        if (!storeResult.success || !storeResult.record) {
            return this.fail(projectId, projectId, start, "Failed to store project");
        }
        const checkpoint = this.checkpoints.create(projectId, {
            status: draft.status,
            completionPercentage: draft.completionPercentage,
            assetRefs: draft.assets,
            scores: draft.scores,
        });
        draft.latestCheckpointId = checkpoint.checkpointId;
        await this.foundation.getStorageEngine().updateRecord(projectId, { payload: this.toPayload(draft) }, "project-memory-engine");
        this.projects.set(projectId, draft);
        this.history.append({
            timestamp: now,
            event: "create",
            projectId,
            detail: `Created project: ${input.projectName}`,
            version: 1,
            status: ProjectStatus.Created,
        });
        this.logger.log("info", "project-create", "Project created", { projectId });
        return {
            success: true,
            projectId,
            memoryId: storeResult.record.memoryId,
            version: 1,
            durationMs: Date.now() - start,
            checkpointCreated: true,
        };
    }
    async update(projectId, input) {
        const start = Date.now();
        const existing = await this.loadProject(projectId);
        if (!existing) {
            return this.fail(projectId, projectId, start, "Project not found");
        }
        const now = new Date().toISOString();
        const updated = {
            ...existing,
            projectName: input.projectName ?? existing.projectName,
            projectType: input.projectType ?? existing.projectType,
            status: input.status ?? existing.status,
            completionPercentage: input.completionPercentage ?? existing.completionPercentage,
            description: input.description ?? existing.description,
            targetAudience: input.targetAudience ?? existing.targetAudience,
            marketingGoal: input.marketingGoal ?? existing.marketingGoal,
            brandInformation: input.brandInformation ?? existing.brandInformation,
            language: input.language ?? existing.language,
            tags: input.tags ?? existing.tags,
            keywords: input.keywords ?? existing.keywords,
            assets: input.assetsReplace
                ? input.assetsReplace
                : input.assets
                    ? this.mergeAssets(existing.assets, input.assets)
                    : existing.assets,
            workflowHistory: input.workflowHistory
                ? this.mergeWorkflow(existing.workflowHistory, input.workflowHistory)
                : existing.workflowHistory,
            lastModified: now,
        };
        if (input.exportRecord) {
            updated.exportHistory = [...updated.exportHistory, input.exportRecord];
            if (updated.status !== ProjectStatus.Archived) {
                updated.status = ProjectStatus.Exported;
            }
        }
        const relationships = this.linker.link(projectId, updated.tags);
        updated.relatedMemories = relationships.relatedMemories;
        updated.scores = this.scorer.computeScores(updated);
        const memoryRead = await this.foundation.getStorageEngine().getRecord(projectId);
        const memoryVersion = (memoryRead.record?.version ?? existing.versions.length) + 1;
        const versionInfo = {
            version: existing.versions.length + 1,
            timestamp: now,
            changeSummary: this.summarizeChanges(input),
            memoryVersion,
        };
        updated.versions = [...existing.versions, versionInfo];
        const updateResult = await this.foundation.getStorageEngine().updateRecord(projectId, {
            title: updated.projectName,
            description: updated.description,
            tags: updated.tags,
            keywords: updated.keywords,
            qualityScore: updated.scores.qualityScore,
            payload: this.toPayload(updated, input),
        }, "project-memory-engine");
        if (!updateResult.success) {
            return this.fail(projectId, projectId, start, "Failed to update project");
        }
        const shouldCheckpoint = input.status !== undefined ||
            input.completionPercentage !== undefined ||
            input.assets !== undefined ||
            input.workflowState !== undefined ||
            input.draftState !== undefined;
        let checkpointCreated = false;
        if (shouldCheckpoint) {
            const checkpoint = this.checkpoints.create(projectId, {
                status: updated.status,
                completionPercentage: updated.completionPercentage,
                assetRefs: updated.assets,
                scores: updated.scores,
                workflowState: input.workflowState,
                draftState: input.draftState,
                aiContext: input.aiContext,
            });
            updated.latestCheckpointId = checkpoint.checkpointId;
            checkpointCreated = true;
            await this.foundation.getStorageEngine().updateRecord(projectId, { payload: this.toPayload(updated) }, "project-memory-engine");
        }
        this.projects.set(projectId, updated);
        this.history.append({
            timestamp: now,
            event: checkpointCreated ? "checkpoint" : "update",
            projectId,
            detail: versionInfo.changeSummary,
            version: versionInfo.version,
            status: updated.status,
        });
        this.logger.log("info", "project-update", "Project updated", {
            projectId,
            version: versionInfo.version,
        });
        return {
            success: true,
            projectId,
            memoryId: projectId,
            version: versionInfo.version,
            durationMs: Date.now() - start,
            checkpointCreated,
        };
    }
    async loadProject(projectId) {
        const cached = this.projects.get(projectId);
        if (cached)
            return cached;
        const read = await this.foundation.getStorageEngine().getRecord(projectId);
        if (!read.success || !read.record)
            return null;
        const record = recordFromMemory(read.record);
        this.projects.set(projectId, record);
        return record;
    }
    toMemoryInput(project) {
        return {
            memoryId: project.projectId,
            memoryType: MemoryStorageType.Project,
            category: "project",
            title: project.projectName,
            description: project.description,
            source: "project-memory-engine",
            tags: project.tags,
            keywords: project.keywords,
            relatedProject: project.projectId,
            qualityScore: project.scores.qualityScore,
            payload: this.toPayload(project),
        };
    }
    toPayload(project, input) {
        return {
            projectId: project.projectId,
            projectType: project.projectType,
            status: project.status,
            completionPercentage: project.completionPercentage,
            targetAudience: project.targetAudience,
            marketingGoal: project.marketingGoal,
            brandInformation: project.brandInformation,
            language: project.language,
            exportHistory: project.exportHistory,
            assets: project.assets,
            workflowHistory: project.workflowHistory,
            scores: project.scores,
            relatedMemories: project.relatedMemories,
            versions: project.versions,
            latestCheckpointId: project.latestCheckpointId,
            draftState: input?.draftState,
            aiContext: input?.aiContext,
            workflowState: input?.workflowState,
        };
    }
    mergeAssets(existing, partial) {
        const merged = { ...existing };
        for (const key of Object.keys(partial)) {
            if (partial[key]) {
                merged[key] = [...existing[key], ...partial[key]];
            }
        }
        return merged;
    }
    mergeWorkflow(existing, partial) {
        const merged = { ...existing };
        for (const key of Object.keys(partial)) {
            if (partial[key]) {
                merged[key] = [...existing[key], ...partial[key]];
            }
        }
        return merged;
    }
    summarizeChanges(input) {
        const parts = [];
        if (input.status)
            parts.push(`status→${input.status}`);
        if (input.completionPercentage !== undefined)
            parts.push(`progress→${input.completionPercentage}%`);
        if (input.projectName)
            parts.push("name updated");
        if (input.assets)
            parts.push("assets added");
        if (input.workflowHistory)
            parts.push("workflow history updated");
        if (input.exportRecord)
            parts.push("export recorded");
        return parts.length > 0 ? parts.join(", ") : "Project updated";
    }
    fail(projectId, memoryId, start, reason) {
        this.logger.log("error", "error", reason, { projectId });
        return {
            success: false,
            projectId,
            memoryId,
            version: 0,
            durationMs: Date.now() - start,
            checkpointCreated: false,
            reason,
        };
    }
}
//# sourceMappingURL=project-processor.js.map