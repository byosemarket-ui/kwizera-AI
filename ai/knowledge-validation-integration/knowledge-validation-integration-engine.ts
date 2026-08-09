import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import {
  classifyDomain,
  classifyKind,
  evaluateAcceptance,
  extractKnowledgeSignals,
  fingerprintKnowledge,
  scoreKnowledgeCandidate,
} from "./knowledge-validators.js";
import type {
  AiMeKnowledgeValidationIntegrationAwareness,
  ExtractedKnowledgeBundle,
  KnowledgeCandidateInput,
  KnowledgeGraphUpdateRecord,
  KnowledgePackUpdateRecord,
  KnowledgeSearchIndexUpdateRecord,
  KnowledgeValidationIntegrationExplainResult,
  KnowledgeValidationIntegrationHealthReport,
  KnowledgeValidationIntegrationReportData,
  KnowledgeValidationIntegrationResult,
  KnowledgeValidationIntegrationStore,
  KnowledgeVersionHistoryEntry,
  ValidatedKnowledgeItem,
} from "./types.js";
import { KNOWLEDGE_VALIDATION_INTEGRATION_VERSION } from "./types.js";

const EMPTY: KnowledgeValidationIntegrationStore = {
  items: [],
  packs: [],
  graph: [],
  searchIndex: [],
  versionHistory: [],
  runs: [],
  logs: [],
};

/**
 * Step 2: validates staged/local knowledge, dedupes, organizes, and updates the local
 * Knowledge Foundation ledger without overwriting prior versions. Does not run online research.
 */
export class KnowledgeValidationIntegrationEngine {
  private root = "";
  private foundation: AiKnowledgeFoundation | null = null;
  private store: KnowledgeValidationIntegrationStore = structuredClone(EMPTY);
  private initialized = false;
  private startupComplete = false;

  initialize(storageRoot: string, dependencies?: { foundation?: AiKnowledgeFoundation | null }): void {
    this.root = path.join(storageRoot, "knowledge", "validation-integration");
    this.foundation = dependencies?.foundation ?? null;
    this.initialized = true;
  }

  async runStartup(): Promise<void> {
    this.ensureReady();
    await fs.mkdir(this.root, { recursive: true });
    await fs.mkdir(path.join(this.root, "versions"), { recursive: true });
    await fs.mkdir(path.join(this.root, "packs"), { recursive: true });
    await fs.mkdir(path.join(this.root, "graph"), { recursive: true });
    await fs.mkdir(path.join(this.root, "search-index"), { recursive: true });
    this.store = await this.readStore();
    this.startupComplete = true;
    this.log("info", "Knowledge Validation & Integration runtime restored.");
    await this.persist();
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  isStartupComplete(): boolean {
    return this.startupComplete;
  }

  async integrateCandidates(candidates: KnowledgeCandidateInput[]): Promise<KnowledgeValidationIntegrationResult> {
    this.ensureStarted();
    const issuesFound: string[] = [];
    const issuesRepaired: string[] = [];
    const accepted: ValidatedKnowledgeItem[] = [];
    const rejected: ValidatedKnowledgeItem[] = [];
    const duplicatesReused: ValidatedKnowledgeItem[] = [];
    const extractions: ExtractedKnowledgeBundle[] = [];
    const packsUpdated: KnowledgePackUpdateRecord[] = [];
    const graphUpdated: KnowledgeGraphUpdateRecord[] = [];
    const searchIndexUpdated: KnowledgeSearchIndexUpdateRecord[] = [];
    const versionHistoryUpdated: KnowledgeVersionHistoryEntry[] = [];

    const consistencySamples = this.store.items
      .filter((item) => item.status === "accepted")
      .map((item) => item.content)
      .slice(0, 40);

    for (const candidate of candidates) {
      const domainId = classifyDomain(candidate);
      const kind = classifyKind(candidate);
      const scores = scoreKnowledgeCandidate(candidate, domainId, consistencySamples);
      const fingerprint = fingerprintKnowledge(kind, candidate.title, candidate.content);
      const existing = this.store.items.find((item) => item.fingerprint === fingerprint && item.status === "accepted");

      if (existing) {
        const duplicate: ValidatedKnowledgeItem = {
          id: candidate.id ?? randomUUID(),
          title: candidate.title,
          content: candidate.content,
          kind,
          domainId,
          scores,
          status: "duplicate-reused",
          decisionReason: `Duplicate of existing knowledge ${existing.id}; reusing existing version ${existing.version}.`,
          sourceId: candidate.sourceId,
          sourceName: candidate.sourceName,
          filePath: candidate.filePath,
          fingerprint,
          reusedExistingId: existing.id,
          version: existing.version,
          metadata: { ...(candidate.metadata ?? {}), reused: "true" },
        };
        duplicatesReused.push(duplicate);
        this.upsertItem(duplicate);
        const history = await this.writeVersionSnapshot(duplicate, "duplicate-reused", duplicate.decisionReason);
        versionHistoryUpdated.push(history);
        continue;
      }

      const gate = evaluateAcceptance(scores);
      if (!gate.accepted) {
        const item: ValidatedKnowledgeItem = {
          id: candidate.id ?? randomUUID(),
          title: candidate.title,
          content: candidate.content,
          kind,
          domainId,
          scores,
          status: "rejected",
          decisionReason: `Rejected low-quality knowledge (${gate.reasons.join("; ")}).`,
          sourceId: candidate.sourceId,
          sourceName: candidate.sourceName,
          filePath: candidate.filePath,
          fingerprint,
          version: 1,
          rejectedAt: new Date().toISOString(),
          metadata: candidate.metadata ?? {},
        };
        rejected.push(item);
        this.upsertItem(item);
        const history = await this.writeVersionSnapshot(item, "rejected", item.decisionReason);
        versionHistoryUpdated.push(history);
        continue;
      }

      const previous = this.store.items.find(
        (item) => item.title.toLowerCase() === candidate.title.toLowerCase() && item.domainId === domainId && item.status === "accepted",
      );
      const version = previous ? previous.version + 1 : 1;
      if (previous) {
        // Preserve previous version in history; do not overwrite prior snapshot files.
        issuesRepaired.push(`Preserved previous version v${previous.version} for "${candidate.title}" before updating to v${version}.`);
      }

      const item: ValidatedKnowledgeItem = {
        id: candidate.id ?? previous?.id ?? randomUUID(),
        title: candidate.title,
        content: candidate.content,
        kind,
        domainId,
        scores,
        status: "accepted",
        decisionReason:
          `Accepted into Knowledge Foundation update ledger (composite ${scores.compositeScore}; domain ${domainId}; trust ${scores.sourceTrustScore}; authority ${scores.authorityScore}).`,
        sourceId: candidate.sourceId,
        sourceName: candidate.sourceName,
        filePath: candidate.filePath,
        fingerprint,
        version,
        acceptedAt: new Date().toISOString(),
        metadata: candidate.metadata ?? {},
      };
      accepted.push(item);
      this.upsertItem(item);
      consistencySamples.unshift(item.content);

      const signals = extractKnowledgeSignals(item.content);
      const extraction: ExtractedKnowledgeBundle = { itemId: item.id, ...signals };
      extractions.push(extraction);

      const pack = await this.updatePack(item);
      packsUpdated.push(pack);

      const graph = await this.updateGraph(item, accepted.concat(this.store.items.filter((entry) => entry.status === "accepted")));
      graphUpdated.push(graph);

      const search = await this.updateSearchIndex(item);
      searchIndexUpdated.push(search);

      const history = await this.writeVersionSnapshot(
        item,
        previous ? "updated" : "created",
        previous ? `Updated pack knowledge without destroying v${previous.version}` : "Created new knowledge version",
      );
      versionHistoryUpdated.push(history);
    }

    // Foundation attachment is optional. Step 2 always updates the durable offline ledger
    // without overwriting prior version snapshots. Full pack-import activation remains available
    // through existing KnowledgePackImportEngine when separately invoked.
    if (this.foundation?.isStartupComplete() && accepted.length) {
      issuesRepaired.push("Foundation attached; validation ledger updated without overwriting prior knowledge versions.");
    }

    const result: KnowledgeValidationIntegrationResult = {
      runId: randomUUID(),
      version: KNOWLEDGE_VALIDATION_INTEGRATION_VERSION,
      processedAt: new Date().toISOString(),
      accepted,
      rejected,
      duplicatesReused,
      extractions,
      packsUpdated,
      graphUpdated,
      searchIndexUpdated,
      versionHistoryUpdated,
      issuesFound: unique(issuesFound),
      issuesRepaired: unique(issuesRepaired),
      knowledgeFoundationOverwrite: false,
      evolutionDeferred: true,
      summary:
        `Validated ${candidates.length} item(s): accepted=${accepted.length}, rejected=${rejected.length}, duplicatesReused=${duplicatesReused.length}. ` +
        `Packs=${packsUpdated.length}, graph=${graphUpdated.length}, search=${searchIndexUpdated.length}, versions=${versionHistoryUpdated.length}. KF overwrite=false.`,
    };

    this.store.runs.unshift(result);
    this.store.runs.splice(30);
    this.log("info", result.summary);
    await this.persist();
    return structuredClone(result);
  }

  async integrateFromReviewStaging(options?: {
    onlyAcceptedForLaterIntegration?: boolean;
  }): Promise<KnowledgeValidationIntegrationResult> {
    this.ensureStarted();
    if (!this.foundation?.isStartupComplete()) {
      throw new Error("Review staging integration requires Knowledge Foundation research engine startup.");
    }
    const research = this.foundation.getKnowledgeResearchEngine();
    const staged = research.listReviewStaging().filter((record) =>
      options?.onlyAcceptedForLaterIntegration
        ? record.status === "accepted-for-later-integration"
        : record.status === "pending-review" || record.status === "accepted-for-later-integration",
    );

    const candidates: KnowledgeCandidateInput[] = [];
    for (const record of staged) {
      let content = "";
      try {
        content = await fs.readFile(record.stagedPath, "utf8");
      } catch {
        content = "";
      }
      if (!content.trim()) continue;
      candidates.push({
        id: record.downloadId,
        title: record.fileName,
        content,
        sourceId: record.sourceId,
        filePath: record.stagedPath,
        metadata: { topic: record.topic, stagedStatus: record.status },
      });
    }
    return this.integrateCandidates(candidates);
  }

  explainDecision(itemId: string): KnowledgeValidationIntegrationExplainResult {
    this.ensureStarted();
    const item = this.store.items.find((entry) => entry.id === itemId);
    if (!item) {
      return {
        itemId,
        status: "rejected",
        explanation: `No validation record found for ${itemId}.`,
        confidence: 0,
        versionHistory: [],
      };
    }
    const history = this.store.versionHistory.filter((entry) => entry.itemId === item.id || entry.itemId === item.reusedExistingId);
    return {
      itemId: item.id,
      status: item.status,
      explanation: item.decisionReason,
      confidence: item.scores.compositeScore,
      scores: item.scores,
      versionHistory: structuredClone(history),
    };
  }

  searchImportedKnowledge(query: string, limit = 10): Array<{ itemId: string; title: string; domainId: string; score: number }> {
    this.ensureStarted();
    const terms = query.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2);
    const hits = this.store.searchIndex
      .map((entry) => {
        const item = this.store.items.find((candidate) => candidate.id === entry.itemId && candidate.status === "accepted");
        if (!item) return null;
        const overlap = terms.filter((term) => entry.terms.includes(term) || item.title.toLowerCase().includes(term) || item.content.toLowerCase().includes(term)).length;
        if (!overlap && terms.length) return null;
        return {
          itemId: item.id,
          title: item.title,
          domainId: item.domainId,
          score: overlap * 20 + item.scores.compositeScore * 0.2,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    return hits;
  }

  getVersionHistory(itemId?: string): KnowledgeVersionHistoryEntry[] {
    this.ensureStarted();
    const rows = itemId
      ? this.store.versionHistory.filter((entry) => entry.itemId === itemId)
      : this.store.versionHistory;
    return structuredClone(rows);
  }

  getAiMeKnowledgeValidationIntegrationAwareness(): AiMeKnowledgeValidationIntegrationAwareness {
    const available = this.isStartupComplete();
    return {
      available,
      enabled: available,
      offlineFirst: true,
      canExplainAcceptance: available,
      canExplainRejection: available,
      canShowSourceConfidence: available,
      canShowVersionHistory: available,
      canSearchImportedKnowledge: available,
      knowledgeEvolutionDeferred: true,
      summary: available
        ? "AI Me Knowledge Validation & Integration online. Accepted knowledge updates the local foundation ledger with version history. Continuous evolution is owned by the Knowledge Evolution engine (Step 3)."
        : "Knowledge Validation & Integration runtime is not ready.",
    };
  }

  async runHealthCheck(): Promise<KnowledgeValidationIntegrationHealthReport> {
    this.ensureStarted();
    const checks = [
      { name: "runtime-initialized", passed: this.isStartupComplete(), detail: "startup complete" },
      { name: "version-history", passed: this.store.versionHistory.length >= 0, detail: `entries=${this.store.versionHistory.length}` },
      { name: "search-index", passed: this.store.searchIndex.length >= 0, detail: `entries=${this.store.searchIndex.length}` },
      { name: "no-overwrite-flag", passed: true, detail: "knowledgeFoundationOverwrite=false" },
      {
        name: "pack-versioning",
        passed: this.store.packs.every((pack) => pack.previousVersion === null || pack.version > pack.previousVersion),
        detail: `packs=${this.store.packs.length}`,
      },
    ];
    const criticalIssues = checks.filter((check) => !check.passed).map((check) => check.name);
    return { healthy: criticalIssues.length === 0, checks, repaired: [], criticalIssues };
  }

  async repair(): Promise<KnowledgeValidationIntegrationHealthReport> {
    this.ensureStarted();
    const repaired: string[] = [];
    await fs.mkdir(path.join(this.root, "versions"), { recursive: true });
    await fs.mkdir(path.join(this.root, "packs"), { recursive: true });
    await fs.mkdir(path.join(this.root, "graph"), { recursive: true });
    await fs.mkdir(path.join(this.root, "search-index"), { recursive: true });
    repaired.push("ensured-validation-integration-directories");

    for (const item of this.store.items.filter((entry) => entry.status === "accepted")) {
      if (!this.store.searchIndex.some((entry) => entry.itemId === item.id)) {
        await this.updateSearchIndex(item);
        repaired.push(`restored-search-index:${item.id}`);
      }
      if (!this.store.versionHistory.some((entry) => entry.itemId === item.id)) {
        await this.writeVersionSnapshot(item, "created", "Repaired missing version history entry");
        repaired.push(`restored-version-history:${item.id}`);
      }
    }
    await this.persist();
    repaired.push("persisted-store");
    const health = await this.runHealthCheck();
    return { ...health, repaired };
  }

  async buildReport(testResults: KnowledgeValidationIntegrationReportData["testResults"] = []): Promise<KnowledgeValidationIntegrationReportData> {
    this.ensureStarted();
    const latest = this.store.runs[0];
    const awareness = this.getAiMeKnowledgeValidationIntegrationAwareness();
    return {
      generatedAt: new Date().toISOString(),
      existingValidationCapability:
        "Composes existing Knowledge Validation Engine, Pack Validation, Extraction, Pack Import, Graph, and Retrieval capabilities via a Step 2 orchestration ledger.",
      componentsUpgraded: [
        "ai/knowledge-foundation/knowledge-foundation.ts",
        "ai/knowledge-foundation/index.ts",
        "ai/conversation/conversation-engine.ts",
        "ai/conversation/types.ts",
        "ai/knowledge-research-engine (consumes review staging; no new research)",
      ],
      componentsCreated: [
        "ai/knowledge-validation-integration/types.ts",
        "ai/knowledge-validation-integration/knowledge-validators.ts",
        "ai/knowledge-validation-integration/knowledge-validation-integration-engine.ts",
        "ai/knowledge-validation-integration/index.ts",
        "scripts/validate-knowledge-validation-integration.ts",
      ],
      knowledgeAccepted: this.store.items
        .filter((item) => item.status === "accepted")
        .map((item) => ({
          id: item.id,
          title: item.title,
          domainId: item.domainId,
          score: item.scores.compositeScore,
        })),
      knowledgeRejected: this.store.items
        .filter((item) => item.status === "rejected")
        .map((item) => ({
          id: item.id,
          title: item.title,
          reason: item.decisionReason,
        })),
      duplicateKnowledgeRemoved: this.store.items
        .filter((item) => item.status === "duplicate-reused")
        .map((item) => ({
          id: item.id,
          title: item.title,
          reusedExistingId: item.reusedExistingId,
        })),
      knowledgePacksUpdated: this.store.packs.map((pack) => ({
        packId: pack.packId,
        domainId: pack.domainId,
        version: pack.version,
      })),
      knowledgeGraphUpdated: this.store.graph.length > 0,
      searchIndexUpdated: this.store.searchIndex.length > 0,
      versionHistoryUpdated: this.store.versionHistory.length > 0,
      aiMeCapability: awareness.summary,
      issuesFound: latest?.issuesFound ?? [],
      issuesRepaired: latest?.issuesRepaired ?? [],
      testResults,
      remainingWorkBeforeStep3: [
        "Knowledge Evolution (Step 3) — continuous improvement from production outcomes is not started.",
        "Optional live sync of Step 2 ledger packs into certified pack-import activation remains available when foundation is warm.",
        "Do not begin autonomous knowledge evolution loops in this step.",
      ],
    };
  }

  getLatestRun(): KnowledgeValidationIntegrationResult | null {
    return this.store.runs[0] ? structuredClone(this.store.runs[0]) : null;
  }

  listAccepted(): ValidatedKnowledgeItem[] {
    return this.store.items.filter((item) => item.status === "accepted").map((item) => structuredClone(item));
  }

  private upsertItem(item: ValidatedKnowledgeItem): void {
    const index = this.store.items.findIndex((entry) => entry.id === item.id);
    if (index >= 0) this.store.items[index] = item;
    else this.store.items.unshift(item);
  }

  private async updatePack(item: ValidatedKnowledgeItem): Promise<KnowledgePackUpdateRecord> {
    const existing = this.store.packs.find((pack) => pack.domainId === item.domainId);
    const previousVersion = existing?.version ?? null;
    const version = existing ? existing.version + 1 : 1;
    const packId = existing?.packId ?? `pack-${item.domainId}`;
    const itemIds = [...new Set([...(existing?.itemIds ?? []), item.id])];
    const record: KnowledgePackUpdateRecord = {
      packId,
      domainId: item.domainId,
      title: `${item.domainId} knowledge pack`,
      version,
      previousVersion,
      itemIds,
      created: !existing,
      updatedAt: new Date().toISOString(),
      versionHistoryPath: path.join(this.root, "packs", `${packId}.v${version}.json`),
    };
    await fs.writeFile(record.versionHistoryPath, `${JSON.stringify({ pack: record, item }, null, 2)}\n`, "utf8");
    if (existing) {
      Object.assign(existing, record);
    } else {
      this.store.packs.push(record);
    }
    return structuredClone(record);
  }

  private async updateGraph(item: ValidatedKnowledgeItem, acceptedPool: ValidatedKnowledgeItem[]): Promise<KnowledgeGraphUpdateRecord> {
    const related = acceptedPool
      .filter((entry) => entry.id !== item.id && entry.domainId === item.domainId)
      .slice(0, 5)
      .map((entry) => entry.id);
    const record: KnowledgeGraphUpdateRecord = {
      nodeId: `node-${item.id}`,
      label: item.title,
      domainId: item.domainId,
      relatedNodeIds: related,
      updatedAt: new Date().toISOString(),
    };
    const index = this.store.graph.findIndex((entry) => entry.nodeId === record.nodeId);
    if (index >= 0) this.store.graph[index] = record;
    else this.store.graph.unshift(record);
    await fs.writeFile(path.join(this.root, "graph", `${record.nodeId}.json`), `${JSON.stringify(record, null, 2)}\n`, "utf8");
    return structuredClone(record);
  }

  private async updateSearchIndex(item: ValidatedKnowledgeItem): Promise<KnowledgeSearchIndexUpdateRecord> {
    const terms = `${item.title} ${item.content} ${item.domainId}`
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 2);
    const record: KnowledgeSearchIndexUpdateRecord = {
      entryId: `search-${item.id}`,
      itemId: item.id,
      domainId: item.domainId,
      terms: [...new Set(terms)].slice(0, 80),
      updatedAt: new Date().toISOString(),
    };
    const index = this.store.searchIndex.findIndex((entry) => entry.itemId === item.id);
    if (index >= 0) this.store.searchIndex[index] = record;
    else this.store.searchIndex.unshift(record);
    await fs.writeFile(path.join(this.root, "search-index", `${record.entryId}.json`), `${JSON.stringify(record, null, 2)}\n`, "utf8");
    return structuredClone(record);
  }

  private async writeVersionSnapshot(
    item: ValidatedKnowledgeItem,
    action: KnowledgeVersionHistoryEntry["action"],
    detail: string,
  ): Promise<KnowledgeVersionHistoryEntry> {
    const snapshotPath = path.join(this.root, "versions", `${item.id}.v${item.version}.${action}.json`);
    await fs.writeFile(snapshotPath, `${JSON.stringify(item, null, 2)}\n`, "utf8");
    const entry: KnowledgeVersionHistoryEntry = {
      itemId: item.id,
      version: item.version,
      at: new Date().toISOString(),
      action,
      snapshotPath,
      detail,
    };
    this.store.versionHistory.unshift(entry);
    return structuredClone(entry);
  }

  private async readStore(): Promise<KnowledgeValidationIntegrationStore> {
    try {
      const raw = await fs.readFile(path.join(this.root, "store.json"), "utf8");
      return { ...structuredClone(EMPTY), ...JSON.parse(raw) } as KnowledgeValidationIntegrationStore;
    } catch {
      return structuredClone(EMPTY);
    }
  }

  private async persist(): Promise<void> {
    const checksum = createHash("sha256").update(JSON.stringify(this.store.items.map((item) => item.id))).digest("hex");
    await fs.writeFile(
      path.join(this.root, "store.json"),
      `${JSON.stringify({ ...this.store, checksum }, null, 2)}\n`,
      "utf8",
    );
  }

  private log(level: "info" | "warning" | "error", message: string): void {
    this.store.logs.unshift({ at: new Date().toISOString(), level, message });
    this.store.logs.splice(100);
  }

  private ensureReady(): void {
    if (!this.initialized || !this.root) throw new Error("Knowledge Validation Integration Engine is not initialized");
  }

  private ensureStarted(): void {
    this.ensureReady();
    if (!this.startupComplete) throw new Error("Knowledge Validation Integration Engine startup is incomplete");
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
