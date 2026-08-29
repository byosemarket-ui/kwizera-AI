/**
 * KWIZERA AI — first-party Knowledge Teaching Service.
 * TEACH → VALIDATE → STORE → RETRIEVE through Knowledge Foundation (no external LLM).
 */
import type { AiKnowledgeFoundation } from "./knowledge-foundation.js";
import { KnowledgeVerificationStatus } from "./types.js";
import { KnowledgeRecordStatus, KnowledgeStorageType, type KnowledgeRecord } from "../knowledge-storage-engine/types.js";
import type { KnowledgeAcquisitionPreview } from "../knowledge-acquisition-engine/types.js";

export type KnowledgeScope = "permanent" | "project";

export interface TeachKnowledgeInput {
  topic: string;
  content: string;
  scope?: KnowledgeScope;
  projectId?: string;
  knowledgeType?: KnowledgeStorageType;
  sourceName?: string;
  autoApprove?: boolean;
  requesterId?: string;
}

export interface TeachKnowledgeResult {
  ok: boolean;
  requestId?: string;
  knowledgeId?: string;
  preview?: KnowledgeAcquisitionPreview;
  imported?: boolean;
  scope: KnowledgeScope;
  projectId?: string;
  error?: string;
}

export interface RetrieveKnowledgeInput {
  text: string;
  projectId?: string;
  /** When true with projectId, include permanent + that project's knowledge. Default true. */
  includePermanent?: boolean;
  /** When true without projectId, only permanent. Default true. */
  permanentOnly?: boolean;
  knowledgeType?: KnowledgeStorageType;
  verifiedOnly?: boolean;
  limit?: number;
  requesterId?: string;
}

export interface RetrieveKnowledgeResult {
  ok: boolean;
  records: KnowledgeRecord[];
  knowledgeIds: string[];
  count: number;
  error?: string;
}

const MIN_CONTENT = 12;
const MAX_CONTENT = 100_000;

/** Structured teaching/retrieval over the existing Knowledge Foundation storage. */
export class KnowledgeTeachingService {
  constructor(private readonly foundation: AiKnowledgeFoundation) {}

  isReady(): boolean {
    return this.foundation.isStartupComplete();
  }

  /**
   * Teach KWIZERA AI structured knowledge.
   * Uses acquisition prepare → optional approve → validation → durable store.
   */
  async teach(input: TeachKnowledgeInput): Promise<TeachKnowledgeResult> {
    const scope: KnowledgeScope = input.scope ?? "permanent";
    const topic = input.topic?.trim() ?? "";
    const content = input.content?.trim() ?? "";

    const gate = this.validateTeachInput(topic, content, scope, input.projectId);
    if (gate) return { ok: false, scope, projectId: input.projectId, error: gate };

    if (!this.isReady()) {
      return { ok: false, scope, projectId: input.projectId, error: "Knowledge Foundation is not ready" };
    }

    try {
      const acquisition = this.foundation.getKnowledgeAcquisitionEngine();
      const preview = await acquisition.prepare({
        topic,
        knowledgeType: input.knowledgeType,
        requesterId: input.requesterId ?? "knowledge-teaching-service",
        sources: [
          {
            type: "user-document",
            name: input.sourceName?.trim() || "KWIZERA teaching input",
            content,
            reliability: 78,
            approved: true,
          },
        ],
      });

      if (preview.status === "rejected") {
        const softReject = preview.rejectionReasons.every((reason) =>
          /confidence|reliability|sufficient|No approved or local source/i.test(reason),
        ) && preview.conflicts.length === 0 && preview.duplicateKnowledgeIds.length === 0 && content.length >= 40;

        if (softReject) {
          return this.teachDirectStore({
            topic,
            content,
            scope,
            projectId: input.projectId,
            knowledgeType: input.knowledgeType ?? preview.knowledgeType,
            sourceName: input.sourceName,
            requestId: preview.requestId,
            preview,
          });
        }

        return {
          ok: false,
          requestId: preview.requestId,
          preview,
          scope,
          projectId: input.projectId,
          error: preview.rejectionReasons.join(" ") || "Knowledge teaching preview rejected",
        };
      }

      if (input.autoApprove === false) {
        return { ok: true, requestId: preview.requestId, preview, imported: false, scope, projectId: input.projectId };
      }

      const imported = await acquisition.approve(preview.requestId, input.knowledgeType ?? preview.knowledgeType);
      if (!imported.imported || !imported.knowledgeId) {
        return {
          ok: false,
          requestId: preview.requestId,
          preview,
          scope,
          projectId: input.projectId,
          error: imported.reason ?? "Knowledge import failed validation",
        };
      }

      await this.applyScope(imported.knowledgeId, scope, input.projectId, topic, content);
      const validation = await this.foundation.getKnowledgeValidationEngine().validateKnowledge(imported.knowledgeId);
      if (!validation.valid) {
        return {
          ok: false,
          requestId: preview.requestId,
          knowledgeId: imported.knowledgeId,
          preview,
          imported: false,
          scope,
          projectId: input.projectId,
          error: validation.issues.join(" ") || "Post-import knowledge validation failed",
        };
      }

      return {
        ok: true,
        requestId: preview.requestId,
        knowledgeId: imported.knowledgeId,
        preview,
        imported: true,
        scope,
        projectId: input.projectId,
      };
    } catch (error) {
      return {
        ok: false,
        scope,
        projectId: input.projectId,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async approve(requestId: string, options?: { scope?: KnowledgeScope; projectId?: string; knowledgeType?: KnowledgeStorageType }): Promise<TeachKnowledgeResult> {
    const scope: KnowledgeScope = options?.scope ?? "permanent";
    if (!this.isReady()) return { ok: false, scope, projectId: options?.projectId, error: "Knowledge Foundation is not ready" };
    try {
      const imported = await this.foundation.getKnowledgeAcquisitionEngine().approve(requestId, options?.knowledgeType);
      if (!imported.imported || !imported.knowledgeId) {
        return { ok: false, requestId, scope, projectId: options?.projectId, error: imported.reason ?? "Approve failed" };
      }
      await this.applyScope(imported.knowledgeId, scope, options?.projectId);
      return { ok: true, requestId, knowledgeId: imported.knowledgeId, imported: true, scope, projectId: options?.projectId };
    } catch (error) {
      return { ok: false, requestId, scope, projectId: options?.projectId, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /** Retrieve durable knowledge for AI modules (permanent and/or project-scoped). */
  async retrieve(input: RetrieveKnowledgeInput): Promise<RetrieveKnowledgeResult> {
    if (!this.isReady()) return { ok: false, records: [], knowledgeIds: [], count: 0, error: "Knowledge Foundation is not ready" };
    const text = input.text?.trim() ?? "";
    if (!text) return { ok: false, records: [], knowledgeIds: [], count: 0, error: "Retrieval text is required" };

    try {
      const search = await this.foundation.getRetrievalEngine().search({
        text,
        knowledgeType: input.knowledgeType,
        limit: Math.min(input.limit ?? 20, 100),
        minConfidenceScore: input.verifiedOnly ? 50 : undefined,
        context: input.projectId ? { projectId: input.projectId } : undefined,
        requesterId: input.requesterId ?? "knowledge-teaching-service",
      });

      const includePermanent = input.includePermanent !== false;
      const permanentOnly = input.permanentOnly !== false && !input.projectId;
      const records: KnowledgeRecord[] = [];

      for (const item of search.results) {
        const record = item.record;
        if (!record) continue;
        if (input.verifiedOnly) {
          const acceptable = record.verificationStatus === KnowledgeVerificationStatus.Verified
            || record.verificationStatus === KnowledgeVerificationStatus.Pending;
          if (!acceptable) continue;
        }
        if (!this.matchesScope(record, {
          projectId: input.projectId,
          includePermanent,
          permanentOnly,
        })) continue;
        records.push(record);
      }

      return {
        ok: true,
        records,
        knowledgeIds: records.map((r) => r.knowledgeId),
        count: records.length,
      };
    } catch (error) {
      return {
        ok: false,
        records: [],
        knowledgeIds: [],
        count: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private validateTeachInput(topic: string, content: string, scope: KnowledgeScope, projectId?: string): string | null {
    if (!topic || topic.length < 2) return "INVALID_KNOWLEDGE: topic is required";
    if (!content || content.length < MIN_CONTENT) return "INVALID_KNOWLEDGE: content is too short to teach";
    if (content.length > MAX_CONTENT) return "INVALID_KNOWLEDGE: content exceeds maximum size";
    if (content.includes("\0")) return "INVALID_KNOWLEDGE: content contains illegal null bytes";
    if (scope === "project" && !projectId?.trim()) return "INVALID_KNOWLEDGE: projectId is required for project-scoped knowledge";
    return null;
  }

  private async teachDirectStore(input: {
    topic: string;
    content: string;
    scope: KnowledgeScope;
    projectId?: string;
    knowledgeType: KnowledgeStorageType;
    sourceName?: string;
    requestId?: string;
    preview?: KnowledgeAcquisitionPreview;
  }): Promise<TeachKnowledgeResult> {
    const lines = input.content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const write = await this.foundation.getStorageEngine().storeRecord({
      knowledgeType: input.knowledgeType,
      category: input.topic.slice(0, 80),
      title: `Taught: ${input.topic}`.slice(0, 160),
      description: input.content.slice(0, 4_000),
      summary: input.content.slice(0, 280),
      tags: [`scope-${input.scope}`, "taught", ...(input.projectId ? [`project-${input.projectId}`] : [])],
      keywords: input.topic.toLowerCase().split(/\s+/).filter((t) => t.length >= 3).slice(0, 20),
      source: input.sourceName?.trim() || "kwizera-teaching",
      sourceReliability: 75,
      confidenceScore: 72,
      qualityScore: 70,
      verificationStatus: KnowledgeVerificationStatus.Pending,
      status: KnowledgeRecordStatus.Pending,
      payload: {
        scope: input.scope,
        projectId: input.scope === "project" ? input.projectId ?? null : null,
        taughtAt: new Date().toISOString(),
        rules: lines.filter((line) => /^(rule|must|always|never|- )/i.test(line)).slice(0, 40),
        bestPractices: lines.filter((line) => /best|prefer|recommend/i.test(line)).slice(0, 40),
        teachingContentPreview: input.content.slice(0, 500),
      },
    }, "knowledge-teaching-service");

    if (!write.success || !write.record) {
      return {
        ok: false,
        requestId: input.requestId,
        preview: input.preview,
        scope: input.scope,
        projectId: input.projectId,
        error: write.validation?.message ?? "Direct knowledge store failed",
      };
    }

    const validation = await this.foundation.getKnowledgeValidationEngine().validateKnowledge(write.record.knowledgeId);
    if (!validation.valid) {
      return {
        ok: false,
        requestId: input.requestId,
        knowledgeId: write.record.knowledgeId,
        preview: input.preview,
        scope: input.scope,
        projectId: input.projectId,
        error: validation.issues.join(" ") || "Direct knowledge validation failed",
      };
    }

    await this.applyScope(write.record.knowledgeId, input.scope, input.projectId, input.topic, input.content);
    return {
      ok: true,
      requestId: input.requestId,
      knowledgeId: write.record.knowledgeId,
      preview: input.preview,
      imported: true,
      scope: input.scope,
      projectId: input.projectId,
    };
  }

  private async applyScope(
    knowledgeId: string,
    scope: KnowledgeScope,
    projectId?: string,
    topic?: string,
    content?: string,
  ): Promise<void> {
    const read = await this.foundation.getStorageEngine().getRecord(knowledgeId, "knowledge-teaching-service");
    if (!read.success || !read.record) return;
    const existingPayload = (read.record.payload && typeof read.record.payload === "object")
      ? { ...(read.record.payload as Record<string, unknown>) }
      : {};
    const tags = new Set([...(read.record.tags ?? []), `scope-${scope}`]);
    if (scope === "project" && projectId) tags.add(`project-${projectId}`);
    if (topic) {
      for (const part of topic.toLowerCase().split(/\s+/).filter((t) => t.length >= 3).slice(0, 8)) {
        tags.add(part);
      }
    }

    await this.foundation.getStorageEngine().updateRecord(
      knowledgeId,
      {
        tags: [...tags],
        status: KnowledgeRecordStatus.Active,
        verificationStatus: KnowledgeVerificationStatus.Verified,
        payload: {
          ...existingPayload,
          scope,
          projectId: scope === "project" ? projectId ?? null : null,
          taughtAt: new Date().toISOString(),
          teachingContentPreview: content?.slice(0, 500) ?? existingPayload.teachingContentPreview,
        },
      },
      "knowledge-teaching-service",
    );
  }

  private matchesScope(
    record: KnowledgeRecord,
    opts: { projectId?: string; includePermanent: boolean; permanentOnly: boolean },
  ): boolean {
    const payload = record.payload && typeof record.payload === "object"
      ? record.payload as Record<string, unknown>
      : {};
    const scope = typeof payload.scope === "string" ? payload.scope : (
      record.tags?.some((t) => t === "scope-project") ? "project" : "permanent"
    );
    const recordProjectId = typeof payload.projectId === "string" ? payload.projectId : (
      record.tags?.find((t) => t.startsWith("project-"))?.slice("project-".length)
    );

    if (opts.permanentOnly) {
      return scope !== "project" && !recordProjectId;
    }
    if (opts.projectId) {
      if (scope === "project" || recordProjectId) {
        return recordProjectId === opts.projectId;
      }
      return opts.includePermanent;
    }
    // Global retrieve: permanent only
    return scope !== "project" && !recordProjectId;
  }

  /**
   * Confirm duplicate knowledge IDs are reusable and belong to this project.
   * Never treats another project's record as a valid equivalent.
   */
  async findReusableProjectEquivalents(projectId: string, knowledgeIds: string[]): Promise<string[]> {
    const reusable: string[] = [];
    for (const knowledgeId of [...new Set(knowledgeIds.filter(Boolean))]) {
      const read = await this.foundation.getStorageEngine().getRecord(knowledgeId, "knowledge-teaching-service");
      if (!read.success || !read.record) continue;
      if (!this.isReusableEquivalent(read.record)) continue;
      if (!this.matchesScope(read.record, { projectId, includePermanent: false, permanentOnly: false })) continue;
      reusable.push(knowledgeId);
    }
    return reusable;
  }

  isReusableEquivalent(record: { status?: string; integrityStatus?: string }): boolean {
    const status = String(record.status ?? "").toLowerCase();
    const integrity = String(record.integrityStatus ?? "").toLowerCase();
    if (status === "deleted" || status === "rejected" || status === "archived") return false;
    if (integrity === "corrupted") return false;
    return true;
  }

  /** Store project-scoped knowledge when a global equivalent belongs to a different project. */
  async storeTaughtKnowledge(input: {
    topic: string;
    content: string;
    scope: KnowledgeScope;
    projectId?: string;
    knowledgeType: KnowledgeStorageType;
    sourceName?: string;
    requestId?: string;
    preview?: KnowledgeAcquisitionPreview;
  }): Promise<TeachKnowledgeResult> {
    return this.teachDirectStore(input);
  }
}

export function createKnowledgeTeachingService(foundation: AiKnowledgeFoundation): KnowledgeTeachingService {
  return new KnowledgeTeachingService(foundation);
}

/** Shared scoped retrieval for product/image/marketing/video intelligence managers. */
export async function retrieveFoundationKnowledgeForProject(
  foundation: AiKnowledgeFoundation | null | undefined,
  project: {
    id: string;
    name?: string;
    productInformation?: { name?: string; category?: string; description?: string };
    campaignInformation?: { name?: string; objective?: string };
    brandInformation?: { name?: string };
  },
  requesterId: string,
  extraTerms: string[] = [],
): Promise<string[]> {
  if (!foundation?.isStartupComplete()) return [];
  try {
    const teaching = createKnowledgeTeachingService(foundation);
    const query = [
      project.productInformation?.name,
      project.productInformation?.category,
      project.productInformation?.description,
      project.campaignInformation?.name,
      project.campaignInformation?.objective,
      project.brandInformation?.name,
      project.name,
      ...extraTerms,
    ].filter(Boolean).join(" ");
    if (!query.trim()) return [];
    const result = await teaching.retrieve({
      text: query,
      projectId: project.id,
      includePermanent: true,
      limit: 8,
      requesterId,
    });
    return result.knowledgeIds;
  } catch {
    return [];
  }
}
