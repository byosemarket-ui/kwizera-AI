/**
 * Knowledge Collection Service — gathers learning resources from approved trusted sources
 * into the Local Knowledge Workspace. Does not extract or transform knowledge.
 */

import fs from "node:fs/promises";
import path from "node:path";
import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import type { RegisteredKnowledgeSource } from "../knowledge-source-manager/types.js";
import type { KnowledgeDownloadEngine } from "./download-engine.js";
import {
  PREPARED_WORKSPACE_DOMAIN_SLUGS,
  WORKSPACE_DOMAIN_FOLDERS,
  domainIdToWorkspaceSlug,
} from "./knowledge-collection-workspace.js";
import type {
  AiMeKnowledgeCollectionAwareness,
  CollectedKnowledgeResource,
  DownloadRequest,
  DownloadableResourceType,
  KnowledgeCollectionCoverage,
  KnowledgeCollectionMissingReport,
  KnowledgeCollectionRecommendation,
  KnowledgeCollectionRepairResult,
  KnowledgeCollectionReportData,
} from "./types.js";

const COLLECTABLE_TYPES: DownloadableResourceType[] = [
  "documentation",
  "api-specification",
  "pdf",
  "markdown",
  "html",
  "json",
];

function mapSourceTypeToResourceType(source: RegisteredKnowledgeSource): DownloadableResourceType {
  switch (source.type) {
    case "official-api-documentation":
      return "api-specification";
    case "research-paper":
    case "white-paper":
      return "pdf";
    case "user-document":
    case "company-document":
    case "local-documentation":
      return source.location.value.endsWith(".md")
        ? "markdown"
        : source.location.value.endsWith(".json")
          ? "json"
          : source.location.value.endsWith(".html")
            ? "html"
            : "pdf";
    default:
      return "documentation";
  }
}

export class KnowledgeCollectionService {
  constructor(
    private readonly foundation: AiKnowledgeFoundation,
    private readonly downloadEngine: KnowledgeDownloadEngine,
    private readonly workspaceRoot: string
  ) {}

  getPreparedDomains(): string[] {
    return Object.keys(WORKSPACE_DOMAIN_FOLDERS);
  }

  listCollectedResources(domainId?: string): CollectedKnowledgeResource[] {
    const history = this.downloadEngine.getHistory();
    return domainId ? history.filter((resource) => resource.domainId === domainId) : history;
  }

  explainCollection(resourceId: string): string {
    const resource = this.downloadEngine.getDownload(resourceId);
    if (!resource) return `Resource "${resourceId}" was not found in the local knowledge workspace.`;
    if (resource.status === "duplicate") {
      return `Resource "${resource.title ?? resource.fileName}" was not stored because duplicate protection blocked it: ${resource.rejectionReason ?? "duplicate detected"}.`;
    }
    if (resource.status === "rejected") {
      return `Resource "${resource.title ?? resource.fileName}" was not collected: ${resource.rejectionReason ?? "rejected"}.`;
    }
    return (
      `Collected "${resource.title ?? resource.fileName}" for domain ${resource.domainId ?? "general"} ` +
      `from source ${resource.sourceName ?? resource.sourceId} ` +
      `(type ${resource.resourceType}, trust ${resource.trustScore ?? "n/a"}/100, quality ${resource.qualityScore ?? "n/a"}/100). ` +
      `Stored at ${resource.localStoragePath ?? resource.filePath ?? "pending"}. ` +
      `Status: ${resource.status}. No extraction was performed.`
    );
  }

  getResourceMetadata(resourceId: string): CollectedKnowledgeResource | null {
    return this.downloadEngine.getDownload(resourceId);
  }

  async collectFromApprovedSource(input: {
    domainId: string;
    sourceId: string;
    fileName?: string;
    title?: string;
    resourceType?: DownloadableResourceType;
    localSourcePath?: string;
    autoApproveLocal?: boolean;
  }): Promise<CollectedKnowledgeResource> {
    const sourceManager = this.foundation.getKnowledgeSourceManager();
    const source = sourceManager.get(input.sourceId);
    if (!source) throw new Error(`Source not registered: ${input.sourceId}`);
    if (source.status !== "approved") {
      throw new Error(`Source "${input.sourceId}" is not approved; collection from untrusted sources is forbidden.`);
    }
    const policy = sourceManager.evaluatePolicy(input.sourceId);
    if (policy.decision === "block") {
      throw new Error(`Source "${input.sourceId}" is blocked by policy.`);
    }

    const resourceType = input.resourceType ?? mapSourceTypeToResourceType(source);
    const fileName =
      input.fileName ??
      `${source.id}.${resourceType === "markdown" ? "md" : resourceType === "json" ? "json" : resourceType === "html" ? "html" : "pdf"}`;

    const localPath =
      input.localSourcePath ??
      (source.location.kind === "local-path" ? source.location.value : undefined);

    const request: DownloadRequest = {
      topic: input.domainId,
      sourceId: source.id,
      resourceType,
      url: source.location.kind === "url" ? source.location.value : `local://${source.location.value}`,
      fileName,
      domainId: input.domainId,
      title: input.title ?? source.name,
      language: source.language ?? "en",
      localSourcePath: localPath,
    };

    const pending = await this.downloadEngine.requestDownload(request, source, policy.decision);
    if (pending.status !== "pending-approval") return pending;

    if (localPath && input.autoApproveLocal !== false) {
      return this.downloadEngine.approveDownload(pending.id, source.type);
    }
    return pending;
  }

  /**
   * Collects local learning resources for every prepared domain that has approved linked sources.
   * Remote URL sources are queued as pending-approval (offline-first; no silent network fetch).
   */
  async collectForPreparedDomains(): Promise<CollectedKnowledgeResource[]> {
    const sourceManager = this.foundation.getKnowledgeSourceManager();
    const approved = sourceManager.getApprovedSources();
    const collected: CollectedKnowledgeResource[] = [];

    for (const domainId of this.getPreparedDomains()) {
      const linked = approved.filter((source) => (source.domainIds ?? []).includes(domainId));
      for (const source of linked) {
        if (source.location.kind === "local-path") {
          const result = await this.collectFromApprovedSource({
            domainId,
            sourceId: source.id,
            autoApproveLocal: true,
          });
          collected.push(result);
        } else {
          const result = await this.collectFromApprovedSource({
            domainId,
            sourceId: source.id,
            autoApproveLocal: false,
          });
          collected.push(result);
        }
      }
    }
    return collected;
  }

  buildCoverage(): KnowledgeCollectionCoverage[] {
    const history = this.downloadEngine.getHistory();
    return this.getPreparedDomains().map((domainId) => {
      const resources = history.filter((resource) => resource.domainId === domainId);
      const completed = resources.filter((resource) => resource.status === "completed");
      const pending = resources.filter((resource) => resource.status === "pending-approval");
      return {
        domainId,
        domainLabel: domainIdToWorkspaceSlug(domainId),
        resourceCount: resources.length,
        completedCount: completed.length,
        pendingCount: pending.length,
        resourceIds: resources.map((resource) => resource.id),
        coverageLevel:
          completed.length === 0
            ? resources.length === 0
              ? "missing"
              : "weak"
            : completed.length === 1
              ? "weak"
              : completed.length <= 3
                ? "adequate"
                : "strong",
      };
    });
  }

  detectMissingKnowledge(): KnowledgeCollectionMissingReport[] {
    return this.buildCoverage()
      .filter((coverage) => coverage.coverageLevel === "missing" || coverage.coverageLevel === "weak")
      .map((coverage) => ({
        domainId: coverage.domainId,
        domainLabel: coverage.domainLabel,
        reason:
          coverage.coverageLevel === "missing"
            ? "No learning resources collected for this domain yet."
            : "Only weak collection coverage — recommend additional approved sources.",
        suggestedResourceTypes: COLLECTABLE_TYPES,
      }));
  }

  recommendAdditionalResources(limit = 8): KnowledgeCollectionRecommendation[] {
    const sourceManager = this.foundation.getKnowledgeSourceManager();
    const approved = sourceManager.getApprovedSources();
    const collectedSourceIds = new Set(
      this.downloadEngine
        .getHistory()
        .filter((resource) => resource.status === "completed" || resource.status === "pending-approval")
        .map((resource) => resource.sourceId)
    );
    const recommendations: KnowledgeCollectionRecommendation[] = [];

    for (const domainId of this.getPreparedDomains()) {
      const candidates = approved.filter(
        (source) => (source.domainIds ?? []).includes(domainId) && !collectedSourceIds.has(source.id)
      );
      for (const source of candidates.slice(0, 2)) {
        recommendations.push({
          domainId,
          sourceId: source.id,
          sourceName: source.name,
          rationale: `Approved trusted source linked to ${domainId} has not been collected into the local workspace yet.`,
          trustScore: source.verification.trustScore,
          qualityScore: source.quality?.qualityScore ?? 0,
        });
      }
    }
    return recommendations.slice(0, limit);
  }

  getAiMeAwareness(): AiMeKnowledgeCollectionAwareness {
    const stats = this.downloadEngine.getStatusReport();
    const coverage = this.buildCoverage();
    const missing = this.detectMissingKnowledge();
    const recommendations = this.recommendAdditionalResources();
    return {
      totalResources: stats.totalDownloads,
      completedResources: stats.completedDownloads,
      pendingApproval: stats.pendingApprovalDownloads,
      duplicatesBlocked: stats.duplicateDownloadsBlocked,
      domainsPrepared: [...PREPARED_WORKSPACE_DOMAIN_SLUGS],
      domainCoverage: coverage,
      missingKnowledge: missing,
      recommendations,
      workspaceRoot: this.workspaceRoot,
      summary:
        `Knowledge collection workspace: ${stats.completedDownloads} resource(s) collected, ` +
        `${stats.pendingApprovalDownloads} pending approval, ${stats.duplicateDownloadsBlocked} duplicate(s) blocked, ` +
        `${missing.length} domain gap(s). Extraction has not started.`,
    };
  }

  async repair(): Promise<KnowledgeCollectionRepairResult> {
    return this.downloadEngine.repairWorkspace();
  }

  async buildReport(issuesFound: string[] = [], issuesRepaired: string[] = []): Promise<KnowledgeCollectionReportData> {
    const history = this.downloadEngine.getHistory();
    const audit = await this.downloadEngine.getWorkspace().audit();
    const withFingerprint = history.filter((resource) => Boolean(resource.metadataFingerprint)).length;
    const completeMetadata = history.filter(
      (resource) =>
        Boolean(resource.title) &&
        Boolean(resource.domainId || resource.topic) &&
        Boolean(resource.sourceId) &&
        Boolean(resource.resourceType) &&
        Boolean(resource.license || resource.status !== "completed")
    ).length;

    return {
      generatedAt: new Date().toISOString(),
      existingCollectionSystem: "AiKnowledgeResearchEngine + KnowledgeDownloadEngine",
      componentsUpgraded: [
        "KnowledgeDownloadEngine (domain paths, metadata, duplicate fingerprints, repair)",
        "download-safety folder mapping for OER/company docs",
        "AiKnowledgeResearchEngine collection APIs",
      ],
      componentsCreated: [
        "KnowledgeCollectionWorkspace",
        "KnowledgeCollectionService",
        "AI Me knowledge-collection intent",
      ],
      knowledgeDomainsPrepared: this.getPreparedDomains(),
      resourcesCollected: history.map((resource) => ({
        resourceId: resource.id,
        title: resource.title ?? resource.fileName,
        domainId: resource.domainId ?? "general",
        status: resource.status,
      })),
      localWorkspaceStatus: {
        root: this.workspaceRoot,
        domainFolders: [...PREPARED_WORKSPACE_DOMAIN_SLUGS],
        typeFolders: this.downloadEngine.getWorkspace().listTypeFolders(),
        healthy: audit.healthy,
      },
      metadataStatus: {
        indexed: history.length,
        withFingerprint: withFingerprint,
        completeMetadata,
      },
      duplicateProtectionStatus: {
        fileNameBlocks: history.filter((resource) => resource.status === "duplicate" && resource.rejectionReason?.includes("already exists")).length,
        checksumBlocks: history.filter((resource) => resource.status === "duplicate" && resource.rejectionReason?.includes("Identical content")).length,
        versionBlocks: history.filter((resource) => resource.status === "duplicate" && resource.rejectionReason?.includes("Same version")).length,
        metadataBlocks: history.filter((resource) => resource.status === "duplicate" && resource.rejectionReason?.includes("metadata")).length,
      },
      aiMeIntegration:
        "AI Me can list collected resources, explain collection reasons, show metadata, recommend additional approved sources, and report missing domain knowledge via knowledge-collection intent.",
      issuesFound,
      issuesRepaired,
      remainingWorkBeforeStep4: [
        "Approve pending remote collections and inject a network transport when online collection is required.",
        "Extract and structure collected resources into Knowledge Foundation records (Step 4).",
        "Link processed downloads via markDownloadProcessed after extraction.",
      ],
    };
  }

  async ensureLocalFixture(domainId: string, fileName: string, contents: string): Promise<string> {
    const fixtures = path.join(this.workspaceRoot, "metadata", "fixtures");
    await fs.mkdir(fixtures, { recursive: true });
    const target = path.join(fixtures, `${domainIdToWorkspaceSlug(domainId)}-${fileName}`);
    await fs.writeFile(target, contents, "utf8");
    return target;
  }
}
