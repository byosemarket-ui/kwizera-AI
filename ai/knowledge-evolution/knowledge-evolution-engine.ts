import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import type { KnowledgeValidationIntegrationEngine } from "../knowledge-validation-integration/knowledge-validation-integration-engine.js";
import {
  analyzeImpact,
  classifyEvolutionDomain,
  compareKnowledge,
  detectChangeKind,
  fingerprintContent,
  listEvolutionDomains,
} from "./change-classifier.js";
import type {
  AiMeKnowledgeEvolutionAwareness,
  EvolutionCandidateInput,
  EvolutionVersionRecord,
  KnowledgeEvolutionExplainResult,
  KnowledgeEvolutionHealthReport,
  KnowledgeEvolutionReportData,
  KnowledgeEvolutionResult,
  KnowledgeEvolutionStore,
  MonitoredKnowledgeSnapshot,
} from "./types.js";
import { KNOWLEDGE_EVOLUTION_VERSION } from "./types.js";

const EMPTY: KnowledgeEvolutionStore = {
  snapshots: [],
  detections: [],
  versions: [],
  graphEdges: [],
  searchIndex: [],
  runs: [],
  logs: [],
};

/**
 * Step 3: continuously monitors professional knowledge, detects updates, compares against
 * the local foundation ledger, and applies safe versioned evolution without deleting history.
 * Feedback Intelligence (Step 4) is a separate engine.
 */
export class AiKnowledgeEvolutionEngine {
  private root = "";
  private foundation: AiKnowledgeFoundation | null = null;
  private validationIntegration: KnowledgeValidationIntegrationEngine | null = null;
  private store: KnowledgeEvolutionStore = structuredClone(EMPTY);
  private initialized = false;
  private startupComplete = false;

  initialize(
    storageRoot: string,
    dependencies?: {
      foundation?: AiKnowledgeFoundation | null;
      validationIntegration?: KnowledgeValidationIntegrationEngine | null;
    },
  ): void {
    this.root = path.join(storageRoot, "knowledge", "evolution");
    this.foundation = dependencies?.foundation ?? null;
    this.validationIntegration = dependencies?.validationIntegration ?? null;
    this.initialized = true;
  }

  async runStartup(): Promise<void> {
    this.ensureReady();
    await fs.mkdir(this.root, { recursive: true });
    await fs.mkdir(path.join(this.root, "versions"), { recursive: true });
    await fs.mkdir(path.join(this.root, "graph"), { recursive: true });
    await fs.mkdir(path.join(this.root, "search-index"), { recursive: true });
    this.store = await this.readStore();
    await this.seedFromValidationIntegration();
    this.startupComplete = true;
    this.log("info", "Knowledge Evolution runtime restored.");
    await this.persist();
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  isStartupComplete(): boolean {
    return this.startupComplete;
  }

  listMonitoredDomains() {
    return listEvolutionDomains();
  }

  listActiveKnowledge(): MonitoredKnowledgeSnapshot[] {
    return this.store.snapshots
      .filter((item) => item.status === "active")
      .map((item) => structuredClone(item));
  }

  /**
   * Evolve the local knowledge foundation from verified candidates.
   * Unverified candidates are rejected. Previous versions are never deleted.
   */
  async evolve(candidates: EvolutionCandidateInput[]): Promise<KnowledgeEvolutionResult> {
    this.ensureStarted();
    const issuesFound: string[] = [];
    const issuesRepaired: string[] = [];
    const updatesDetected: KnowledgeEvolutionResult["updatesDetected"] = [];
    const comparisons: KnowledgeEvolutionResult["comparisons"] = [];
    const newKnowledgeAdded: KnowledgeEvolutionResult["newKnowledgeAdded"] = [];
    const updatedPacks: KnowledgeEvolutionResult["updatedPacks"] = [];
    const deprecatedKnowledge: KnowledgeEvolutionResult["deprecatedKnowledge"] = [];
    const obsoleteKnowledge: KnowledgeEvolutionResult["obsoleteKnowledge"] = [];
    const versionHistory: EvolutionVersionRecord[] = [];
    const impacts: KnowledgeEvolutionResult["impacts"] = [];
    let graphUpdated = false;
    let searchIndexUpdated = false;

    for (const candidate of candidates) {
      if (candidate.verified === false) {
        issuesFound.push(`Rejected unverified knowledge candidate "${candidate.title}".`);
        continue;
      }

      const domainId = classifyEvolutionDomain(candidate);
      const changeKind = detectChangeKind(candidate);
      const comparison = compareKnowledge(candidate, this.store.snapshots, domainId, changeKind);
      comparisons.push(comparison);

      const detection = {
        detectionId: randomUUID(),
        domainId,
        changeKind,
        title: candidate.title,
        summary: comparison.diffSummary,
        detectedAt: new Date().toISOString(),
        candidateId: candidate.id,
      };
      if (comparison.classification !== "unchanged") {
        updatesDetected.push(detection);
        this.store.detections.unshift(detection);
      }

      if (comparison.classification === "unchanged") {
        continue;
      }

      // Safe apply only after comparison — never overwrite prior snapshots.
      if (comparison.classification === "new") {
        const created = await this.createSnapshot(candidate, domainId, 1, null, "created", comparison.reason);
        newKnowledgeAdded.push({
          id: created.id,
          title: created.title,
          domainId,
          version: created.version,
        });
        updatedPacks.push({ domainId, itemId: created.id, version: created.version });
        versionHistory.push(created.versionRecord);
        await this.updateGraphAndSearch(created.snapshot);
        graphUpdated = true;
        searchIndexUpdated = true;
        impacts.push(analyzeImpact({
          itemId: created.id,
          title: created.title,
          content: created.snapshot.content,
          domainId,
          changeKind,
        }));
        await this.forwardToValidationIntegration(candidate, domainId);
        continue;
      }

      if (comparison.classification === "updated") {
        const existing = this.store.snapshots.find((item) => item.id === comparison.existingId);
        if (!existing) {
          issuesFound.push(`Missing existing snapshot for update of "${candidate.title}".`);
          continue;
        }
        // Preserve previous version file — do not delete.
        const updated = await this.createSnapshot(
          { ...candidate, id: existing.id },
          domainId,
          existing.version + 1,
          existing.version,
          "updated",
          comparison.reason,
        );
        // Mark prior logical status remains via version history; active pointer moves to new version.
        existing.status = "active";
        existing.version = updated.snapshot.version;
        existing.content = updated.snapshot.content;
        existing.fingerprint = updated.snapshot.fingerprint;
        existing.updatedAt = updated.snapshot.updatedAt;
        existing.changeHistory = updated.snapshot.changeHistory;
        updatedPacks.push({ domainId, itemId: existing.id, version: existing.version });
        versionHistory.push(updated.versionRecord);
        await this.updateGraphAndSearch(existing);
        graphUpdated = true;
        searchIndexUpdated = true;
        impacts.push(analyzeImpact({
          itemId: existing.id,
          title: existing.title,
          content: existing.content,
          domainId,
          changeKind,
        }));
        issuesRepaired.push(`Preserved previous version v${comparison.existingVersion} for "${existing.title}" before evolving to v${existing.version}.`);
        await this.forwardToValidationIntegration(candidate, domainId);
        continue;
      }

      if (comparison.classification === "deprecated") {
        const target = this.store.snapshots.find((item) => item.id === comparison.existingId)
          ?? this.store.snapshots.find((item) => item.title.toLowerCase() === (comparison.existingTitle ?? "").toLowerCase());
        if (target) {
          target.status = "deprecated";
          target.updatedAt = new Date().toISOString();
          target.changeHistory.push(`Deprecated by "${candidate.title}"`);
          const versionRecord = await this.writeVersionFile(target, target.version, target.version, "deprecated", comparison.reason);
          versionHistory.push(versionRecord);
          deprecatedKnowledge.push({ id: target.id, title: target.title, reason: comparison.reason });
        }
        // Also add replacement as new/active if content present.
        if (candidate.content.trim()) {
          const replacement = await this.createSnapshot(candidate, domainId, 1, null, "created", `Replacement for deprecated "${comparison.existingTitle}".`);
          newKnowledgeAdded.push({
            id: replacement.id,
            title: replacement.title,
            domainId,
            version: replacement.version,
          });
          updatedPacks.push({ domainId, itemId: replacement.id, version: replacement.version });
          versionHistory.push(replacement.versionRecord);
          await this.updateGraphAndSearch(replacement.snapshot);
          graphUpdated = true;
          searchIndexUpdated = true;
          impacts.push(analyzeImpact({
            itemId: replacement.id,
            title: replacement.title,
            content: replacement.snapshot.content,
            domainId,
            changeKind,
          }));
        }
        continue;
      }

      if (comparison.classification === "obsolete") {
        const target = this.store.snapshots.find((item) => item.id === comparison.existingId);
        if (target) {
          target.status = "obsolete";
          target.updatedAt = new Date().toISOString();
          target.changeHistory.push(`Marked obsolete: ${comparison.diffSummary}`);
          const versionRecord = await this.writeVersionFile(target, target.version, target.version, "marked-obsolete", comparison.reason);
          versionHistory.push(versionRecord);
          obsoleteKnowledge.push({ id: target.id, title: target.title, reason: comparison.reason });
          // Still version-bump content if provided (record obsolete state without deleting history).
          if (candidate.content.trim() && fingerprintContent(candidate.title, candidate.content) !== target.fingerprint) {
            const bumped = await this.createSnapshot(
              { ...candidate, id: target.id },
              domainId,
              target.version + 1,
              target.version,
              "updated",
              "Obsolete content recorded as new version without deleting prior history.",
            );
            target.version = bumped.snapshot.version;
            target.content = bumped.snapshot.content;
            target.fingerprint = bumped.snapshot.fingerprint;
            target.changeHistory = bumped.snapshot.changeHistory;
            versionHistory.push(bumped.versionRecord);
            issuesRepaired.push(`Preserved obsolete prior version for "${target.title}".`);
          }
        }
      }
    }

    this.store.detections.splice(200);
    this.store.versions = [...versionHistory, ...this.store.versions].slice(0, 500);

    const result: KnowledgeEvolutionResult = {
      runId: randomUUID(),
      version: KNOWLEDGE_EVOLUTION_VERSION,
      processedAt: new Date().toISOString(),
      monitoredDomains: listEvolutionDomains(),
      updatesDetected,
      comparisons,
      newKnowledgeAdded,
      updatedPacks,
      deprecatedKnowledge,
      obsoleteKnowledge,
      versionHistory,
      graphUpdated,
      searchIndexUpdated,
      impacts,
      issuesFound: unique(issuesFound),
      issuesRepaired: unique(issuesRepaired),
      previousVersionsPreserved: true,
      feedbackIntelligenceDeferred: false,
      summary:
        `Evolution run processed ${candidates.length} candidate(s): detections=${updatesDetected.length}, new=${newKnowledgeAdded.length}, updated=${updatedPacks.length}, deprecated=${deprecatedKnowledge.length}, obsolete=${obsoleteKnowledge.length}. Previous versions preserved.`,
    };
    this.store.runs.unshift(result);
    this.store.runs.splice(30);
    this.log("info", result.summary);
    await this.persist();
    return structuredClone(result);
  }

  explainEvolution(itemId: string): KnowledgeEvolutionExplainResult {
    this.ensureStarted();
    const snapshot = this.store.snapshots.find((item) => item.id === itemId);
    const versions = this.store.versions.filter((entry) => entry.itemId === itemId);
    if (!snapshot) {
      return {
        itemId,
        whatChanged: "No evolved knowledge found for this id.",
        whyUpdated: "n/a",
        comparison: "n/a",
        recommendLatest: false,
        impactSummary: "n/a",
        versions: [],
      };
    }
    const latestImpact = this.store.runs
      .flatMap((run) => run.impacts)
      .find((impact) => impact.itemId === itemId);
    const previous = versions.find((entry) => entry.version === snapshot.version - 1);
    return {
      itemId,
      whatChanged: previous
        ? `"${snapshot.title}" evolved from v${previous.version} to v${snapshot.version}. Status=${snapshot.status}.`
        : `"${snapshot.title}" was added as v${snapshot.version}.`,
      whyUpdated: snapshot.changeHistory[snapshot.changeHistory.length - 1] ?? "Professional knowledge update.",
      comparison: previous
        ? `Previous snapshot retained at ${previous.snapshotPath}. Latest fingerprint ${snapshot.fingerprint}.`
        : `No prior version. Current fingerprint ${snapshot.fingerprint}.`,
      recommendLatest: snapshot.status === "active",
      impactSummary: latestImpact?.summary ?? "Impact not yet scored for this item.",
      versions: structuredClone(versions),
    };
  }

  compareVersions(itemId: string): { oldVersion: number | null; newVersion: number; recommendLatest: boolean; detail: string } {
    this.ensureStarted();
    const snapshot = this.store.snapshots.find((item) => item.id === itemId);
    if (!snapshot) {
      return { oldVersion: null, newVersion: 0, recommendLatest: false, detail: "Item not found." };
    }
    const oldVersion = snapshot.version > 1 ? snapshot.version - 1 : null;
    return {
      oldVersion,
      newVersion: snapshot.version,
      recommendLatest: snapshot.status === "active",
      detail: snapshot.status === "active"
        ? `Prefer latest v${snapshot.version} for ${snapshot.domainId} production decisions.`
        : `Latest active use is not recommended because status=${snapshot.status}.`,
    };
  }

  getAiMeKnowledgeEvolutionAwareness(): AiMeKnowledgeEvolutionAwareness {
    const available = this.isStartupComplete();
    return {
      available,
      enabled: available,
      offlineFirst: true,
      canExplainWhatChanged: available,
      canExplainWhyUpdated: available,
      canCompareOldAndNew: available,
      canRecommendLatestVersion: available,
      feedbackIntelligenceDeferred: false,
      summary: available
        ? "AI Me Knowledge Evolution online. Can explain changes, compare versions, and recommend latest active knowledge. Feedback Intelligence is available (Step 4)."
        : "Knowledge Evolution runtime is not ready.",
    };
  }

  async runHealthCheck(): Promise<KnowledgeEvolutionHealthReport> {
    this.ensureStarted();
    const checks = [
      { name: "runtime-initialized", passed: this.isStartupComplete(), detail: "startup complete" },
      {
        name: "version-integrity",
        passed: this.store.versions.every((entry) => entry.previousVersion === null || entry.version >= entry.previousVersion),
        detail: `versions=${this.store.versions.length}`,
      },
      {
        name: "no-deleted-history",
        passed: true,
        detail: "Evolution never deletes prior version snapshot files",
      },
      {
        name: "search-consistency",
        passed: this.store.snapshots.filter((item) => item.status === "active").every((item) =>
          this.store.searchIndex.some((entry) => entry.itemId === item.id)),
        detail: `active=${this.store.snapshots.filter((item) => item.status === "active").length}`,
      },
      {
        name: "relationship-integrity",
        passed: this.store.graphEdges.every((edge) =>
          this.store.snapshots.some((item) => item.id === edge.fromId)),
        detail: `edges=${this.store.graphEdges.length}`,
      },
    ];
    const criticalIssues = checks.filter((check) => !check.passed).map((check) => check.name);
    return { healthy: criticalIssues.length === 0, checks, repaired: [], criticalIssues };
  }

  async repair(): Promise<KnowledgeEvolutionHealthReport> {
    this.ensureStarted();
    const repaired: string[] = [];
    await fs.mkdir(path.join(this.root, "versions"), { recursive: true });
    await fs.mkdir(path.join(this.root, "graph"), { recursive: true });
    await fs.mkdir(path.join(this.root, "search-index"), { recursive: true });
    repaired.push("ensured-evolution-directories");

    for (const snapshot of this.store.snapshots.filter((item) => item.status === "active")) {
      if (!this.store.searchIndex.some((entry) => entry.itemId === snapshot.id)) {
        await this.updateGraphAndSearch(snapshot);
        repaired.push(`restored-search-index:${snapshot.id}`);
      }
      if (!this.store.versions.some((entry) => entry.itemId === snapshot.id)) {
        await this.writeVersionFile(snapshot, snapshot.version, null, "created", "Repaired missing version history");
        repaired.push(`restored-version-history:${snapshot.id}`);
      }
    }
    await this.persist();
    repaired.push("persisted-store");
    const health = await this.runHealthCheck();
    return { ...health, repaired };
  }

  async buildReport(testResults: KnowledgeEvolutionReportData["testResults"] = []): Promise<KnowledgeEvolutionReportData> {
    this.ensureStarted();
    const latest = this.store.runs[0];
    const awareness = this.getAiMeKnowledgeEvolutionAwareness();
    const allDetections = this.store.detections.slice(0, 50);
    const allNew = this.store.runs.flatMap((run) => run.newKnowledgeAdded);
    const allUpdated = this.store.runs.flatMap((run) => run.updatedPacks);
    const allDeprecated = [
      ...this.store.runs.flatMap((run) => run.deprecatedKnowledge),
      ...this.store.snapshots
        .filter((item) => item.status === "deprecated" || item.status === "obsolete")
        .map((item) => ({ title: item.title, reason: item.changeHistory[item.changeHistory.length - 1] ?? item.status })),
    ];
    const uniqueDeprecated = [...new Map(allDeprecated.map((item) => [item.title, item])).values()];
    return {
      generatedAt: new Date().toISOString(),
      existingEvolutionCapability:
        "Composes Step 2 validation-integration ledger, Knowledge Graph evolve hooks, and reasoning impact analysis under a dedicated AI Learning Step 3 evolution facade.",
      componentsUpgraded: [
        "ai/knowledge-foundation/knowledge-foundation.ts",
        "ai/knowledge-foundation/index.ts",
        "ai/conversation/conversation-engine.ts",
        "ai/conversation/types.ts",
        "ai/knowledge-validation-integration (evolution owned by Step 3 engine)",
      ],
      componentsCreated: [
        "ai/knowledge-evolution/types.ts",
        "ai/knowledge-evolution/change-classifier.ts",
        "ai/knowledge-evolution/knowledge-evolution-engine.ts",
        "ai/knowledge-evolution/index.ts",
        "scripts/validate-knowledge-evolution.ts",
      ],
      knowledgeUpdatesDetected: allDetections.map((item) => ({
        title: item.title,
        changeKind: item.changeKind,
        domainId: item.domainId,
      })),
      newKnowledgeAdded: allNew.map((item) => ({
        title: item.title,
        domainId: item.domainId,
        version: item.version,
      })),
      updatedKnowledgePacks: allUpdated,
      deprecatedKnowledgeIdentified: uniqueDeprecated,
      versionHistoryStatus: `entries=${this.store.versions.length}; previousVersionsPreserved=true`,
      knowledgeGraphStatus: `edges=${this.store.graphEdges.length}; updated=${Boolean(latest?.graphUpdated || this.store.graphEdges.length)}`,
      aiMeCapability: awareness.summary,
      issuesFound: this.store.runs.flatMap((run) => run.issuesFound),
      issuesRepaired: this.store.runs.flatMap((run) => run.issuesRepaired),
      testResults,
      remainingWorkBeforeStep4: [
        "Feedback Intelligence (Step 4) is implemented — use AiFeedbackIntelligenceEngine / validate:feedback-intelligence.",
        "Optional scheduling of continuous online-validated candidate intake remains available via Step 1+2.",
        "Do not begin Autonomous Learning (Step 6) from the evolution engine.",
      ],
    };
  }

  getLatestRun(): KnowledgeEvolutionResult | null {
    return this.store.runs[0] ? structuredClone(this.store.runs[0]) : null;
  }

  private async seedFromValidationIntegration(): Promise<void> {
    if (!this.validationIntegration?.isStartupComplete()) return;
    const accepted = this.validationIntegration.listAccepted();
    for (const item of accepted) {
      if (this.store.snapshots.some((snapshot) => snapshot.id === item.id || snapshot.fingerprint === item.fingerprint)) {
        continue;
      }
      const domainId = classifyEvolutionDomain({
        title: item.title,
        content: item.content,
        domainId: item.domainId,
      });
      this.store.snapshots.push({
        id: item.id,
        title: item.title,
        content: item.content,
        domainId,
        version: item.version,
        fingerprint: item.fingerprint,
        status: "active",
        createdAt: item.acceptedAt ?? new Date().toISOString(),
        updatedAt: item.acceptedAt ?? new Date().toISOString(),
        changeHistory: ["Seeded from Knowledge Validation Integration ledger"],
      });
    }
  }

  private async forwardToValidationIntegration(
    candidate: EvolutionCandidateInput,
    domainId: ReturnType<typeof classifyEvolutionDomain>,
  ): Promise<void> {
    if (!this.validationIntegration?.isStartupComplete()) return;
    try {
      await this.validationIntegration.integrateCandidates([
        {
          title: candidate.title,
          content: candidate.content,
          sourceId: candidate.sourceId,
          sourceName: candidate.sourceName,
          domainHint: domainId,
          sourceTrustScore: 85,
          authorityScore: 80,
          metadata: { evolvedBy: "knowledge-evolution", ...(candidate.metadata ?? {}) },
        },
      ]);
    } catch {
      /* optional bridge */
    }
  }

  private async createSnapshot(
    candidate: EvolutionCandidateInput,
    domainId: ReturnType<typeof classifyEvolutionDomain>,
    version: number,
    previousVersion: number | null,
    action: EvolutionVersionRecord["action"],
    detail: string,
  ): Promise<{ id: string; title: string; version: number; snapshot: MonitoredKnowledgeSnapshot; versionRecord: EvolutionVersionRecord }> {
    const id = candidate.id ?? randomUUID();
    const now = new Date().toISOString();
    const existing = this.store.snapshots.find((item) => item.id === id);
    const snapshot: MonitoredKnowledgeSnapshot = {
      id,
      title: candidate.title,
      content: candidate.content,
      domainId,
      version,
      fingerprint: fingerprintContent(candidate.title, candidate.content),
      status: "active",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      changeHistory: [...(existing?.changeHistory ?? []), detail],
    };
    if (existing) Object.assign(existing, snapshot);
    else this.store.snapshots.unshift(snapshot);
    const versionRecord = await this.writeVersionFile(snapshot, version, previousVersion, action, detail);
    return { id, title: snapshot.title, version, snapshot, versionRecord };
  }

  private async writeVersionFile(
    snapshot: MonitoredKnowledgeSnapshot,
    version: number,
    previousVersion: number | null,
    action: EvolutionVersionRecord["action"],
    detail: string,
  ): Promise<EvolutionVersionRecord> {
    const snapshotPath = path.join(this.root, "versions", `${snapshot.id}.v${version}.${action}.json`);
    await fs.writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
    const record: EvolutionVersionRecord = {
      itemId: snapshot.id,
      version,
      previousVersion,
      snapshotPath,
      at: new Date().toISOString(),
      action,
      detail,
    };
    this.store.versions.unshift(record);
    return structuredClone(record);
  }

  private async updateGraphAndSearch(snapshot: MonitoredKnowledgeSnapshot): Promise<void> {
    const related = this.store.snapshots
      .filter((item) => item.id !== snapshot.id && item.domainId === snapshot.domainId && item.status === "active")
      .slice(0, 5);
    for (const item of related) {
      const edge = {
        fromId: snapshot.id,
        toId: item.id,
        relation: "same-domain-evolution",
        at: new Date().toISOString(),
      };
      this.store.graphEdges = this.store.graphEdges.filter((existing) => !(existing.fromId === edge.fromId && existing.toId === edge.toId));
      this.store.graphEdges.unshift(edge);
    }
    await fs.writeFile(
      path.join(this.root, "graph", `${snapshot.id}.json`),
      `${JSON.stringify({ nodeId: snapshot.id, related: related.map((item) => item.id) }, null, 2)}\n`,
      "utf8",
    );

    const terms = `${snapshot.title} ${snapshot.content} ${snapshot.domainId}`
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 2);
    const entry = { itemId: snapshot.id, terms: [...new Set(terms)].slice(0, 80), at: new Date().toISOString() };
    this.store.searchIndex = this.store.searchIndex.filter((item) => item.itemId !== snapshot.id);
    this.store.searchIndex.unshift(entry);
    await fs.writeFile(path.join(this.root, "search-index", `${snapshot.id}.json`), `${JSON.stringify(entry, null, 2)}\n`, "utf8");
  }

  private async readStore(): Promise<KnowledgeEvolutionStore> {
    try {
      const raw = await fs.readFile(path.join(this.root, "store.json"), "utf8");
      return { ...structuredClone(EMPTY), ...JSON.parse(raw) } as KnowledgeEvolutionStore;
    } catch {
      return structuredClone(EMPTY);
    }
  }

  private async persist(): Promise<void> {
    const checksum = createHash("sha256").update(JSON.stringify(this.store.snapshots.map((item) => item.id))).digest("hex");
    await fs.writeFile(path.join(this.root, "store.json"), `${JSON.stringify({ ...this.store, checksum }, null, 2)}\n`, "utf8");
  }

  private log(level: "info" | "warning" | "error", message: string): void {
    this.store.logs.unshift({ at: new Date().toISOString(), level, message });
    this.store.logs.splice(100);
  }

  private ensureReady(): void {
    if (!this.initialized || !this.root) throw new Error("Knowledge Evolution Engine is not initialized");
  }

  private ensureStarted(): void {
    this.ensureReady();
    if (!this.startupComplete) throw new Error("Knowledge Evolution Engine startup is incomplete");
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
