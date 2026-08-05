import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { verifyKnowledgeSource } from "./knowledge-source-verifier.js";
import { KnowledgeSourceQualityScorer } from "./knowledge-source-quality-scorer.js";
import { KnowledgeSourcePolicyEngine } from "./knowledge-source-policy-engine.js";
import { KnowledgeSourceHealthMonitor, offlineAvailabilityProber } from "./knowledge-source-health-monitor.js";
import { KnowledgeSourceComparator, type QualityRatedSource } from "./knowledge-source-comparator.js";
import { KnowledgeSourceExplainer } from "./knowledge-source-explainer.js";
import { TRUSTED_SOURCE_LIBRARY } from "./trusted-knowledge-source-library.js";
import { TrustedSourceClassifier } from "./trusted-source-classifier.js";
import { TrustedSourceDiscoveryService } from "./trusted-source-discovery.js";
import type {
  AiMeTrustedSourceAwareness,
  KnowledgeSourceAvailabilityProber,
  KnowledgeSourceComparison,
  KnowledgeSourceDefinition,
  KnowledgeSourceEventLogEntry,
  KnowledgeSourceExplanation,
  KnowledgeSourceHealthRecord,
  KnowledgeSourceHealthReport,
  KnowledgeSourceManagerStatusReport,
  KnowledgeSourcePolicyConfig,
  KnowledgeSourcePolicyEvaluation,
  KnowledgeSourceQualityScores,
  KnowledgeSourceRecommendation,
  KnowledgeSourceStatus,
  RegisteredKnowledgeSource,
  TrustedSourceDiscoveryCoverage,
  TrustedSourceDiscoveryRecommendation,
  TrustedSourceDiscoveryReportData,
  TrustedSourceMissingReport,
} from "./types.js";

const MIN_TRUST_FOR_APPROVAL = 60;
const MAX_EVENT_LOG_ENTRIES = 200;

/** Registers, verifies, discovers, and ranks trusted knowledge sources — without downloading. */
export class AiKnowledgeSourceManager {
  private foundation: AiKnowledgeFoundation | null = null;
  private root = "";
  private initialized = false;
  private startupComplete = false;
  private readonly sources = new Map<string, RegisteredKnowledgeSource>();
  private readonly events: KnowledgeSourceEventLogEntry[] = [];
  private readonly qualityScorer = new KnowledgeSourceQualityScorer();
  private readonly policyEngine = new KnowledgeSourcePolicyEngine();
  private readonly healthMonitor: KnowledgeSourceHealthMonitor;
  private readonly comparator = new KnowledgeSourceComparator();
  private readonly explainer = new KnowledgeSourceExplainer();
  private readonly classifier = new TrustedSourceClassifier();
  private readonly discovery = new TrustedSourceDiscoveryService();

  constructor(availabilityProber: KnowledgeSourceAvailabilityProber = offlineAvailabilityProber) {
    this.healthMonitor = new KnowledgeSourceHealthMonitor(availabilityProber);
  }

  initialize(foundation: AiKnowledgeFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.root = path.join(storageRoot, "knowledge", "source-manager");
    this.initialized = true;
  }

  async runStartup(): Promise<void> {
    this.ensureReady();
    await fs.mkdir(this.root, { recursive: true });
    await this.restore();
    await this.policyEngine.initialize(path.join(this.root, "policy"));
    await this.healthMonitor.initialize(path.join(this.root, "health"));
    for (const source of this.sources.values()) {
      source.quality = this.computeQuality(source);
    }
    this.startupComplete = true;
    await this.seedTrustedSourceLibrary();
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  isStartupComplete(): boolean {
    return this.startupComplete;
  }

  list(status?: KnowledgeSourceStatus): RegisteredKnowledgeSource[] {
    this.ensureStarted();
    return [...this.sources.values()]
      .filter((source) => source.status !== "removed" && (!status || source.status === status))
      .map((source) => structuredClone(source));
  }

  get(sourceId: string): RegisteredKnowledgeSource | null {
    this.ensureStarted();
    const source = this.sources.get(sourceId);
    return source && source.status !== "removed" ? structuredClone(source) : null;
  }

  async register(definition: KnowledgeSourceDefinition): Promise<RegisteredKnowledgeSource> {
    this.ensureStarted();
    const existing = this.sources.get(definition.id);
    if (existing && existing.status !== "removed") {
      throw new Error(`Knowledge source already registered: ${definition.id}`);
    }

    const verification = verifyKnowledgeSource(definition);
    const now = new Date().toISOString();
    const trustClass = definition.trustClass ?? this.classifier.classify(definition);
    const source: RegisteredKnowledgeSource = {
      ...definition,
      tags: definition.tags ?? [],
      trustClass,
      resourceType: definition.resourceType ?? definition.type,
      category: definition.category ?? definition.tags?.[0],
      domainIds: definition.domainIds ?? [],
      officialWebsite:
        definition.officialWebsite ??
        (definition.location.kind === "url" ? safeOrigin(definition.location.value) : undefined),
      language: definition.language ?? "unknown",
      updateFrequency: definition.updateFrequency ?? "unknown",
      accessMethod: definition.accessMethod ?? (definition.location.kind === "local-path" ? "local-filesystem" : "https-documentation"),
      status: verification.verified ? "pending" : "rejected",
      verification,
      quality: null,
      registeredAt: now,
      updatedAt: now,
    };
    source.quality = this.computeQuality(source);
    this.sources.set(source.id, source);
    await this.log(
      "registration",
      source.id,
      verification.verified ? "Source registered and pending approval" : "Source registration failed verification"
    );
    await this.persist();
    return structuredClone(source);
  }

  async discover(definitions: KnowledgeSourceDefinition[]): Promise<number> {
    this.ensureStarted();
    let count = 0;
    for (const definition of definitions) {
      const existing = this.sources.get(definition.id);
      if (!existing || existing.status === "removed") {
        await this.register(definition);
        count++;
      }
    }
    return count;
  }

  async reverify(sourceId: string): Promise<RegisteredKnowledgeSource> {
    const source = this.require(sourceId);
    const verification = verifyKnowledgeSource(source);
    source.verification = verification;
    source.quality = this.computeQuality(source);
    source.updatedAt = new Date().toISOString();
    if (!verification.verified && source.status === "approved") source.status = "pending";
    await this.log("reverify", source.id, `Reverified with trust score ${verification.trustScore}`);
    await this.persist();
    return structuredClone(source);
  }

  async approve(sourceId: string): Promise<RegisteredKnowledgeSource> {
    const source = this.require(sourceId);
    if (!source.verification.verified) {
      throw new Error(`Knowledge source failed verification: ${source.verification.issues.join(" ")}`);
    }
    if (source.verification.trustScore < MIN_TRUST_FOR_APPROVAL) {
      throw new Error(
        `Knowledge source trust score ${source.verification.trustScore} is below the minimum threshold of ${MIN_TRUST_FOR_APPROVAL}.`
      );
    }
    const policy = this.policyEngine.evaluate(source.id);
    if (policy.decision === "block") {
      throw new Error(`Knowledge source is blocked by policy: ${policy.reason}`);
    }
    source.status = "approved";
    source.approvedAt = new Date().toISOString();
    source.updatedAt = source.approvedAt;
    source.lastError = undefined;
    source.quality = this.computeQuality(source);
    await this.log("approved", source.id, "Source approved as trusted");
    await this.persist();
    return structuredClone(source);
  }

  async reject(sourceId: string, reason: string): Promise<RegisteredKnowledgeSource> {
    const source = this.require(sourceId);
    source.status = "rejected";
    source.lastError = reason;
    source.updatedAt = new Date().toISOString();
    await this.log("rejected", source.id, reason);
    await this.persist();
    return structuredClone(source);
  }

  async suspend(sourceId: string, reason: string): Promise<RegisteredKnowledgeSource> {
    const source = this.require(sourceId);
    if (source.status !== "approved") throw new Error("Only approved sources can be suspended");
    source.status = "suspended";
    source.lastError = reason;
    source.updatedAt = new Date().toISOString();
    await this.log("suspended", source.id, reason);
    await this.persist();
    return structuredClone(source);
  }

  async remove(sourceId: string): Promise<void> {
    const source = this.require(sourceId);
    source.status = "removed";
    source.updatedAt = new Date().toISOString();
    await this.log("removed", source.id, "Source removed");
    await this.persist();
  }

  getApprovedSources(type?: KnowledgeSourceDefinition["type"]): RegisteredKnowledgeSource[] {
    return this.list("approved").filter((source) => !type || source.type === type);
  }

  getStatusReport(): KnowledgeSourceManagerStatusReport {
    this.ensureStarted();
    const active = [...this.sources.values()].filter((source) => source.status !== "removed");
    const count = (status: KnowledgeSourceStatus) => active.filter((source) => source.status === status).length;
    const averageTrustScore = active.length
      ? Math.round(active.reduce((total, source) => total + source.verification.trustScore, 0) / active.length)
      : 0;
    const averageQualityScore = active.length
      ? Math.round(active.reduce((total, source) => total + (source.quality?.qualityScore ?? 0), 0) / active.length)
      : 0;
    return {
      totalSources: active.length,
      approved: count("approved"),
      pending: count("pending"),
      rejected: count("rejected"),
      suspended: count("suspended"),
      removed: [...this.sources.values()].filter((source) => source.status === "removed").length,
      averageTrustScore,
      averageQualityScore,
    };
  }

  getLogs(): ReadonlyArray<KnowledgeSourceEventLogEntry> {
    return this.events;
  }

  // ---- Trusted Source Verification & Source Quality Engine (Step 2) ----

  assessQuality(sourceId: string): KnowledgeSourceQualityScores {
    const source = this.require(sourceId);
    return this.computeQuality(source);
  }

  evaluatePolicy(sourceId: string): KnowledgeSourcePolicyEvaluation {
    this.ensureStarted();
    return this.policyEngine.evaluate(sourceId);
  }

  getPolicyConfig(): KnowledgeSourcePolicyConfig {
    this.ensureStarted();
    return this.policyEngine.getConfig();
  }

  async updatePolicy(changes: Partial<KnowledgeSourcePolicyConfig>): Promise<KnowledgeSourcePolicyConfig> {
    this.ensureStarted();
    const updated = await this.policyEngine.updateConfig(changes);
    for (const source of this.sources.values()) source.quality = this.computeQuality(source);
    await this.persist();
    return updated;
  }

  async checkSourceHealth(sourceId: string): Promise<KnowledgeSourceHealthRecord> {
    const source = this.require(sourceId);
    return this.healthMonitor.check(source);
  }

  async checkAllSourcesHealth(): Promise<KnowledgeSourceHealthReport> {
    this.ensureStarted();
    return this.healthMonitor.checkAll(this.list());
  }

  getSourceHealth(sourceId: string): KnowledgeSourceHealthRecord | null {
    this.ensureStarted();
    return this.healthMonitor.getRecord(sourceId);
  }

  compareSources(sourceIds: string[]): KnowledgeSourceComparison {
    this.ensureStarted();
    const rated = this.rateSources(sourceIds);
    return this.comparator.compare(rated);
  }

  recommendSource(sourceIds: string[]): KnowledgeSourceRecommendation | null {
    this.ensureStarted();
    const rated = this.rateSources(sourceIds);
    const comparison = this.comparator.compare(rated);
    return this.explainer.recommend(comparison, rated);
  }

  explainDecision(sourceId: string): KnowledgeSourceExplanation {
    const source = this.require(sourceId);
    return source.status === "approved"
      ? this.explainer.explainApproval(source, this.computeQuality(source).qualityScore)
      : this.explainer.explainRejection(source);
  }

  async seedTrustedSourceLibrary(): Promise<number> {
    this.ensureStarted();
    let registeredOrUpgraded = 0;
    for (const entry of TRUSTED_SOURCE_LIBRARY) {
      const definition = {
        ...entry.definition,
        category: entry.definition.category ?? entry.category,
        trustClass: entry.definition.trustClass ?? this.classifier.classify(entry.definition),
      };
      const existing = this.sources.get(definition.id);
      if (!existing || existing.status === "removed") {
        await this.register(definition);
        registeredOrUpgraded += 1;
        continue;
      }
      const upgraded = this.applyDiscoveryMetadata(existing, definition);
      if (upgraded) {
        existing.quality = this.computeQuality(existing);
        existing.updatedAt = new Date().toISOString();
        registeredOrUpgraded += 1;
      }
    }
    // Never auto-approve — classifier explicitly forbids it.
    void this.classifier.mayAutoApprove();
    await this.persist();
    await this.log("seed-trusted-library", undefined, `Seeded/upgraded ${registeredOrUpgraded} trusted source discovery entries (pending approval)`);
    return registeredOrUpgraded;
  }

  /** Discover and rank trusted sources for a knowledge domain or discovery topic. Does not download. */
  discoverSourcesForTopic(topicOrDomain: string): RegisteredKnowledgeSource[] {
    this.ensureStarted();
    return this.discovery.sourcesForTopic(this.list(), this.discovery.findTopic(topicOrDomain)?.topicId ?? topicOrDomain);
  }

  getTopicCoverage(): TrustedSourceDiscoveryCoverage[] {
    this.ensureStarted();
    return this.discovery.buildCoverage(this.list());
  }

  detectMissingTrustedSources(): TrustedSourceMissingReport[] {
    this.ensureStarted();
    return this.discovery.detectMissing(this.list());
  }

  recommendBestTrustedSource(topicOrDomain: string): TrustedSourceDiscoveryRecommendation | null {
    this.ensureStarted();
    return this.discovery.recommendBest(this.list(), topicOrDomain);
  }

  recommendAdditionalTrustedSources(topicOrDomain: string, limit = 5): TrustedSourceDiscoveryRecommendation[] {
    this.ensureStarted();
    return this.discovery.recommendAdditional(this.list(), topicOrDomain, limit);
  }

  explainTrustedSourceSelection(topicOrDomain: string): KnowledgeSourceExplanation {
    this.ensureStarted();
    const recommendation = this.recommendBestTrustedSource(topicOrDomain);
    if (!recommendation) {
      return {
        summary: `No trusted source discovered yet for "${topicOrDomain}".`,
        rejectedAlternatives: [],
        internalNotes: ["Discovery only — no download was attempted.", "Recommend registering official documentation for this topic."],
      };
    }
    const additional = this.recommendAdditionalTrustedSources(topicOrDomain, 3);
    return {
      summary: recommendation.whySelected,
      whyBest: `${recommendation.name} ranked highest (${recommendation.trustClass}, quality ${recommendation.qualityScore}/100).`,
      rejectedAlternatives: additional.map((item) => ({
        sourceId: item.sourceId,
        reason: `Ranked below best candidate with quality ${item.qualityScore}/100 (${item.trustClass}).`,
      })),
      internalNotes: [
        "Trusted Source Discovery never auto-approves sources.",
        "Download/import remains gated behind later seeding steps and explicit approval.",
      ],
    };
  }

  getAiMeTrustedSourceAwareness(): AiMeTrustedSourceAwareness {
    this.ensureStarted();
    return this.discovery.buildAiMeAwareness(this.list());
  }

  buildTrustedSourceDiscoveryReport(): TrustedSourceDiscoveryReportData {
    this.ensureStarted();
    return this.discovery.buildDiscoveryReport(this.list());
  }

  private applyDiscoveryMetadata(target: RegisteredKnowledgeSource, definition: KnowledgeSourceDefinition): boolean {
    let changed = false;
    const assign = <K extends keyof KnowledgeSourceDefinition>(key: K, value: KnowledgeSourceDefinition[K]) => {
      if (value === undefined) return;
      if (target[key] !== value) {
        (target as KnowledgeSourceDefinition)[key] = value;
        changed = true;
      }
    };
    assign("description", definition.description);
    assign("publisher", definition.publisher);
    assign("license", definition.license);
    assign("category", definition.category);
    assign("domainIds", definition.domainIds);
    assign("officialWebsite", definition.officialWebsite);
    assign("resourceType", definition.resourceType ?? definition.type);
    assign("language", definition.language);
    assign("trustClass", definition.trustClass ?? this.classifier.classify(definition));
    assign("updateFrequency", definition.updateFrequency);
    assign("accessMethod", definition.accessMethod);
    assign("lastUpdated", definition.lastUpdated);
    if (definition.tags?.length) {
      target.tags = definition.tags;
      changed = true;
    }
    return changed;
  }

  private rateSources(sourceIds: string[]): QualityRatedSource[] {
    return sourceIds.map((id) => {
      const source = this.require(id);
      return { source, qualityScore: this.computeQuality(source).qualityScore };
    });
  }

  private computeQuality(source: RegisteredKnowledgeSource): KnowledgeSourceQualityScores {
    const policy = this.policyEngine.isInitialized()
      ? this.policyEngine.evaluate(source.id)
      : ({ sourceId: source.id, decision: "review", reason: "Policy engine not yet started." } as KnowledgeSourcePolicyEvaluation);
    return this.qualityScorer.score(source, policy);
  }

  private require(sourceId: string): RegisteredKnowledgeSource {
    this.ensureStarted();
    const source = this.sources.get(sourceId);
    if (!source || source.status === "removed") throw new Error(`Knowledge source not found: ${sourceId}`);
    return source;
  }

  private async log(event: string, sourceId: string | undefined, detail: string): Promise<void> {
    const entry: KnowledgeSourceEventLogEntry = { at: new Date().toISOString(), event, sourceId, detail };
    this.events.unshift(entry);
    this.events.splice(MAX_EVENT_LOG_ENTRIES);
    await fs.appendFile(path.join(this.root, "source-events.jsonl"), `${JSON.stringify(entry)}\n`, "utf8");
  }

  private async restore(): Promise<void> {
    try {
      const saved = JSON.parse(await fs.readFile(path.join(this.root, "sources.json"), "utf8")) as RegisteredKnowledgeSource[];
      for (const source of saved) this.sources.set(source.id, source);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  private async persist(): Promise<void> {
    const target = path.join(this.root, "sources.json");
    const temporary = `${target}.${randomUUID()}.tmp`;
    await fs.writeFile(temporary, `${JSON.stringify([...this.sources.values()], null, 2)}\n`, "utf8");
    await fs.rename(temporary, target);
  }

  private ensureReady(): void {
    if (!this.foundation || !this.initialized) throw new Error("Knowledge Source Manager is not initialized");
  }

  private ensureStarted(): void {
    this.ensureReady();
    if (!this.startupComplete) throw new Error("Knowledge Source Manager startup is incomplete");
  }
}

function safeOrigin(urlValue: string): string | undefined {
  try {
    return new URL(urlValue).origin;
  } catch {
    return undefined;
  }
}
