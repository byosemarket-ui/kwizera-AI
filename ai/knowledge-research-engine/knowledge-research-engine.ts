import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { ResearchPlanner } from "./research-planner.js";
import { ResearchSourceDiscovery } from "./research-source-discovery.js";
import { ResearchExplainer } from "./research-explainer.js";
import { KnowledgeDownloadEngine, offlineDownloadTransport } from "./download-engine.js";
import { KnowledgeCollectionService } from "./knowledge-collection-service.js";
import type {
  AiMeKnowledgeCollectionAwareness,
  CollectedKnowledgeResource,
  DownloadRecord,
  DownloadRequest,
  DownloadTransport,
  KnowledgeCollectionRepairResult,
  KnowledgeCollectionReportData,
  KnowledgeResearchStatusReport,
  RankedSourceCandidate,
  ResearchEventLogEntry,
  ResearchPlan,
  ResearchPreview,
} from "./types.js";

const MAX_EVENT_LOG_ENTRIES = 200;

/** Research planning, trusted source discovery, safe downloading, and local knowledge collection for AI Me. */
export class AiKnowledgeResearchEngine {
  private foundation: AiKnowledgeFoundation | null = null;
  private root = "";
  private downloadsRoot = "";
  private initialized = false;
  private startupComplete = false;
  private readonly plans = new Map<string, ResearchPlan>();
  private readonly events: ResearchEventLogEntry[] = [];

  private readonly planner = new ResearchPlanner();
  private readonly discovery = new ResearchSourceDiscovery();
  private readonly explainer = new ResearchExplainer();
  private readonly downloadEngine: KnowledgeDownloadEngine;
  private collectionService: KnowledgeCollectionService | null = null;

  constructor(downloadTransport: DownloadTransport = offlineDownloadTransport) {
    this.downloadEngine = new KnowledgeDownloadEngine(downloadTransport);
  }

  initialize(foundation: AiKnowledgeFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.root = path.join(storageRoot, "knowledge", "research");
    this.downloadsRoot = path.join(storageRoot, "knowledge", "workspace");
    this.initialized = true;
  }

  async runStartup(): Promise<void> {
    this.ensureReady();
    await fs.mkdir(this.root, { recursive: true });
    await this.restore();
    await this.downloadEngine.initialize(this.downloadsRoot);
    this.collectionService = new KnowledgeCollectionService(this.foundation!, this.downloadEngine, this.downloadsRoot);
    await this.collectionService.repair();
    this.startupComplete = true;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  isStartupComplete(): boolean {
    return this.startupComplete;
  }

  async planResearch(topic: string): Promise<ResearchPlan> {
    this.ensureStarted();
    if (!topic.trim()) throw new Error("Research topic must not be empty.");
    const plan = this.planner.buildPlan(topic);
    this.plans.set(plan.id, plan);
    await this.log("plan-created", plan.id, `Research plan created for topic "${plan.topic}" with ${plan.domains.length} domain(s).`);
    await this.persist();
    return structuredClone(plan);
  }

  getPlan(planId: string): ResearchPlan | null {
    const plan = this.plans.get(planId);
    return plan ? structuredClone(plan) : null;
  }

  discoverSources(planId: string): RankedSourceCandidate[] {
    this.ensureStarted();
    const plan = this.requirePlan(planId);
    const sourceManager = this.requireSourceManager();
    const approved = sourceManager.getApprovedSources();
    return this.discovery.search(plan, approved, (sourceId) => sourceManager.evaluatePolicy(sourceId).decision === "block");
  }

  async previewResearch(planId: string): Promise<ResearchPreview> {
    this.ensureStarted();
    const plan = this.requirePlan(planId);
    const candidates = this.discoverSources(planId);
    const preview = this.explainer.buildPreview(plan, candidates);
    await this.log(
      "preview-generated",
      planId,
      `Research preview generated: ${preview.estimatedDownloads} estimated download(s), ${preview.estimatedKnowledgeCoveragePercent}% estimated coverage.`
    );
    return preview;
  }

  explainSourceSelection(candidate: RankedSourceCandidate): string {
    return this.explainer.explainSelection(candidate);
  }

  explainSourceRejection(name: string, reason: string): string {
    return this.explainer.explainRejection(name, reason);
  }

  explainDownloadRecommendation(candidate: RankedSourceCandidate): string {
    return this.explainer.explainDownloadRecommendation(candidate);
  }

  expectedKnowledgeGain(candidates: RankedSourceCandidate[]): string {
    return this.explainer.expectedKnowledgeGain(candidates);
  }

  async requestDownload(request: DownloadRequest): Promise<DownloadRecord> {
    this.ensureStarted();
    const sourceManager = this.requireSourceManager();
    const source = sourceManager.get(request.sourceId);
    const policyDecision = sourceManager.evaluatePolicy(request.sourceId).decision;
    const record = await this.downloadEngine.requestDownload(request, source, policyDecision);
    await this.log(
      record.status === "rejected" ? "download-rejected" : "download-requested",
      undefined,
      `Download of "${request.fileName}" from source "${request.sourceId}" is ${record.status}.`,
      record.id
    );
    return record;
  }

  async approveDownload(downloadId: string): Promise<DownloadRecord> {
    this.ensureStarted();
    const record = this.downloadEngine.getDownload(downloadId);
    if (!record) throw new Error(`Download not found: ${downloadId}`);
    const sourceManager = this.requireSourceManager();
    const source = sourceManager.get(record.sourceId);
    const sourceType = source?.type ?? "approved-website";
    const result = await this.downloadEngine.approveDownload(downloadId, sourceType);
    await this.log("download-completed", undefined, `Download "${downloadId}" finished with status "${result.status}".`, downloadId);
    return result;
  }

  async rejectDownload(downloadId: string, reason: string): Promise<DownloadRecord> {
    this.ensureStarted();
    const result = await this.downloadEngine.rejectDownload(downloadId, reason);
    await this.log("download-rejected", undefined, reason, downloadId);
    return result;
  }

  async markDownloadProcessed(downloadId: string): Promise<DownloadRecord> {
    this.ensureStarted();
    return this.downloadEngine.markProcessed(downloadId);
  }

  async markDownloadExtracted(downloadId: string): Promise<DownloadRecord> {
    this.ensureStarted();
    return this.downloadEngine.markExtracted(downloadId);
  }

  getDownload(downloadId: string): DownloadRecord | null {
    this.ensureStarted();
    return this.downloadEngine.getDownload(downloadId);
  }

  getDownloadHistory(): DownloadRecord[] {
    this.ensureStarted();
    return this.downloadEngine.getHistory();
  }

  getCollectionService(): KnowledgeCollectionService {
    this.ensureStarted();
    if (!this.collectionService) throw new Error("Knowledge Collection Service is not ready");
    return this.collectionService;
  }

  getWorkspaceRoot(): string {
    this.ensureStarted();
    return this.downloadsRoot;
  }

  listCollectedResources(domainId?: string): CollectedKnowledgeResource[] {
    return this.getCollectionService().listCollectedResources(domainId);
  }

  explainCollectedResource(resourceId: string): string {
    return this.getCollectionService().explainCollection(resourceId);
  }

  recommendAdditionalCollections(limit = 8) {
    return this.getCollectionService().recommendAdditionalResources(limit);
  }

  detectMissingCollectedKnowledge() {
    return this.getCollectionService().detectMissingKnowledge();
  }

  getAiMeCollectionAwareness(): AiMeKnowledgeCollectionAwareness {
    return this.getCollectionService().getAiMeAwareness();
  }

  async collectFromApprovedSource(input: {
    domainId: string;
    sourceId: string;
    fileName?: string;
    title?: string;
    localSourcePath?: string;
    autoApproveLocal?: boolean;
  }): Promise<CollectedKnowledgeResource> {
    this.ensureStarted();
    const result = await this.getCollectionService().collectFromApprovedSource(input);
    await this.log(
      "resource-collected",
      undefined,
      `Collection for domain "${input.domainId}" from "${input.sourceId}" is ${result.status}.`,
      result.id
    );
    return result;
  }

  async repairKnowledgeWorkspace(): Promise<KnowledgeCollectionRepairResult> {
    this.ensureStarted();
    const result = await this.getCollectionService().repair();
    await this.log("workspace-repaired", undefined, `Workspace repair actions: ${result.actions.length}; remaining issues: ${result.remainingIssues.length}.`);
    return result;
  }

  async buildKnowledgeCollectionReport(): Promise<KnowledgeCollectionReportData> {
    this.ensureStarted();
    const audit = await this.downloadEngine.getWorkspace().audit();
    const issuesFound = [...audit.issues];
    const repair = await this.repairKnowledgeWorkspace();
    return this.getCollectionService().buildReport(issuesFound, repair.actions);
  }

  getStatusReport(): KnowledgeResearchStatusReport {
    this.ensureStarted();
    const downloadStats = this.downloadEngine.getStatusReport();
    return { totalPlans: this.plans.size, ...downloadStats };
  }

  getLogs(): ReadonlyArray<ResearchEventLogEntry> {
    return this.events;
  }

  private requirePlan(planId: string): ResearchPlan {
    const plan = this.plans.get(planId);
    if (!plan) throw new Error(`Research plan not found: ${planId}`);
    return plan;
  }

  private requireSourceManager() {
    if (!this.foundation) throw new Error("Knowledge Research Engine is not initialized");
    return this.foundation.getKnowledgeSourceManager();
  }

  private async log(event: string, planId: string | undefined, detail: string, downloadId?: string): Promise<void> {
    const entry: ResearchEventLogEntry = { at: new Date().toISOString(), event, planId, downloadId, detail };
    this.events.unshift(entry);
    this.events.splice(MAX_EVENT_LOG_ENTRIES);
    await fs.appendFile(path.join(this.root, "research-events.jsonl"), `${JSON.stringify(entry)}\n`, "utf8");
  }

  private async restore(): Promise<void> {
    try {
      const saved = JSON.parse(await fs.readFile(path.join(this.root, "research-plans.json"), "utf8")) as ResearchPlan[];
      for (const plan of saved) this.plans.set(plan.id, plan);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  private async persist(): Promise<void> {
    const target = path.join(this.root, "research-plans.json");
    const temporary = `${target}.${randomUUID()}.tmp`;
    await fs.writeFile(temporary, `${JSON.stringify([...this.plans.values()], null, 2)}\n`, "utf8");
    await fs.rename(temporary, target);
  }

  private ensureReady(): void {
    if (!this.foundation || !this.initialized) throw new Error("Knowledge Research Engine is not initialized");
  }

  private ensureStarted(): void {
    this.ensureReady();
    if (!this.startupComplete) throw new Error("Knowledge Research Engine startup is incomplete");
  }
}
