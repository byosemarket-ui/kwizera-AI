import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { ResearchPlanner } from "./research-planner.js";
import { ResearchSourceDiscovery } from "./research-source-discovery.js";
import { ResearchExplainer } from "./research-explainer.js";
import { KnowledgeDownloadEngine, offlineDownloadTransport } from "./download-engine.js";
import { KnowledgeCollectionService } from "./knowledge-collection-service.js";
import {
  ConnectivityDetector,
  dnsConnectivityProbe,
  offlineConnectivityProbe,
  type ConnectivityProbe,
} from "./connectivity-detector.js";
import { KnowledgeReviewStagingArea } from "./knowledge-review-staging.js";
import { KnowledgeExtractionPreviewEngine } from "./knowledge-extraction-preview.js";
import { listProfessionalResearchDomains } from "./professional-research-domains.js";
import type {
  AiMeKnowledgeCollectionAwareness,
  AiMeOnlineResearchAwareness,
  CollectedKnowledgeResource,
  ConnectivitySnapshot,
  DownloadRecord,
  DownloadRequest,
  DownloadTransport,
  KnowledgeCollectionRepairResult,
  KnowledgeCollectionReportData,
  KnowledgeExtractionPreview,
  KnowledgeResearchStatusReport,
  OnlineResearchReportData,
  OnlineResearchSessionResult,
  RankedSourceCandidate,
  ResearchEventLogEntry,
  ResearchPlan,
  ResearchPreview,
  ReviewStagingRecord,
} from "./types.js";

const MAX_EVENT_LOG_ENTRIES = 200;

/** Research planning, connectivity-aware discovery, safe downloading, review staging, and extraction preview for AI Me. */
export class AiKnowledgeResearchEngine {
  private foundation: AiKnowledgeFoundation | null = null;
  private root = "";
  private downloadsRoot = "";
  private initialized = false;
  private startupComplete = false;
  private readonly plans = new Map<string, ResearchPlan>();
  private readonly events: ResearchEventLogEntry[] = [];
  private readonly sessions: OnlineResearchSessionResult[] = [];

  private readonly planner = new ResearchPlanner();
  private readonly discovery = new ResearchSourceDiscovery();
  private readonly explainer = new ResearchExplainer();
  private readonly downloadEngine: KnowledgeDownloadEngine;
  private readonly connectivity = new ConnectivityDetector(offlineConnectivityProbe);
  private readonly reviewStaging = new KnowledgeReviewStagingArea();
  private readonly extractionPreview = new KnowledgeExtractionPreviewEngine();
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
    await this.reviewStaging.initialize(this.downloadsRoot);
    this.collectionService = new KnowledgeCollectionService(this.foundation!, this.downloadEngine, this.downloadsRoot);
    await this.collectionService.repair();
    await this.connectivity.detect();
    this.startupComplete = true;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  isStartupComplete(): boolean {
    return this.startupComplete;
  }

  setConnectivityProbe(probe: ConnectivityProbe): void {
    this.connectivity.setProbe(probe);
  }

  enableLiveConnectivityProbe(): void {
    this.connectivity.setProbe(dnsConnectivityProbe);
  }

  async detectConnectivity(): Promise<ConnectivitySnapshot> {
    this.ensureStarted();
    const snapshot = await this.connectivity.detect();
    await this.log(
      snapshot.internetAvailable ? "connectivity-online" : "connectivity-offline",
      undefined,
      snapshot.detail,
    );
    return snapshot;
  }

  getConnectivity(): ConnectivitySnapshot | null {
    return this.connectivity.getLastSnapshot();
  }

  listProfessionalResearchDomains() {
    return listProfessionalResearchDomains();
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
      `Research preview generated: ${preview.estimatedDownloads} estimated download(s), ${preview.estimatedKnowledgeCoveragePercent}% estimated coverage.`,
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

  recommendAdditionalResearchTopics(planId?: string): string[] {
    this.ensureStarted();
    const plan = planId ? this.plans.get(planId) : [...this.plans.values()][0];
    const labels = plan?.domains.map((domain) => domain.domain) ?? [];
    return this.explainer.recommendAdditionalTopics(labels);
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
      record.id,
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
    if (result.status === "completed") {
      await this.reviewStaging.stageCompletedDownload(result);
      await this.log("download-staged-for-review", undefined, `Download "${downloadId}" staged in temporary review area.`, downloadId);
    }
    return result;
  }

  async rejectDownload(downloadId: string, reason: string): Promise<DownloadRecord> {
    this.ensureStarted();
    const result = await this.downloadEngine.rejectDownload(downloadId, reason);
    await this.log("download-rejected", undefined, reason, downloadId);
    return result;
  }

  async stageDownloadForReview(downloadId: string): Promise<ReviewStagingRecord> {
    this.ensureStarted();
    const download = this.downloadEngine.getDownload(downloadId);
    if (!download) throw new Error(`Download not found: ${downloadId}`);
    return this.reviewStaging.stageCompletedDownload(download);
  }

  listReviewStaging(): ReviewStagingRecord[] {
    this.ensureStarted();
    return this.reviewStaging.list();
  }

  async acceptReviewForLaterIntegration(downloadId: string, note?: string): Promise<ReviewStagingRecord> {
    this.ensureStarted();
    return this.reviewStaging.acceptForLaterIntegration(downloadId, note);
  }

  async rejectReview(downloadId: string, reason: string): Promise<ReviewStagingRecord> {
    this.ensureStarted();
    return this.reviewStaging.rejectFromReview(downloadId, reason);
  }

  async extractKnowledgePreview(downloadId: string): Promise<KnowledgeExtractionPreview> {
    this.ensureStarted();
    const download = this.downloadEngine.getDownload(downloadId);
    if (!download?.filePath) throw new Error(`Completed download file required for extraction preview: ${downloadId}`);
    const preview = await this.extractionPreview.extractFromFile({
      downloadId,
      topic: download.topic,
      filePath: download.filePath,
    });
    await this.log("extraction-preview", undefined, preview.summary, downloadId);
    return preview;
  }

  /**
   * Orchestrates Online Research Mode when connectivity allows; otherwise uses local KF only.
   * Never imports into Knowledge Foundation (Step 2 owns validation/integration).
   */
  async runOnlineResearchSession(options?: {
    topic?: string;
    probeLiveNetwork?: boolean;
    collectLocalFixture?: { sourceId: string; localSourcePath: string; fileName?: string; domainId?: string };
  }): Promise<OnlineResearchSessionResult> {
    this.ensureStarted();
    const issuesFound: string[] = [];
    const issuesRepaired: string[] = [];
    const topic = options?.topic?.trim() || "Product Marketing Video Production";

    if (options?.probeLiveNetwork) this.enableLiveConnectivityProbe();
    else this.setConnectivityProbe(offlineConnectivityProbe);

    const connectivity = await this.detectConnectivity();
    let plan: ResearchPlan | null = null;
    let preview: ResearchPreview | null = null;
    let acceptedSources: RankedSourceCandidate[] = [];
    const rejectedSources: Array<{ name: string; reason: string }> = [];
    const stagedDownloads: ReviewStagingRecord[] = [];
    const extractionPreviews: KnowledgeExtractionPreview[] = [];

    if (!connectivity.internetAvailable) {
      issuesFound.push("Internet unavailable — Professional Research Mode disabled; using local Knowledge Foundation only.");
    }

    try {
      plan = await this.planResearch(topic);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      issuesFound.push(message);
    }

    if (plan) {
      const ranked = this.discoverSources(plan.id);
      acceptedSources = this.discovery.listAccepted(ranked);
      for (const rejected of this.discovery.listRejected(ranked)) {
        rejectedSources.push({
          name: rejected.name,
          reason: rejected.rejectionReason ?? "Rejected by quality gates.",
        });
      }
      preview = await this.previewResearch(plan.id);
    }

    if (options?.collectLocalFixture) {
      try {
        const collected = await this.collectFromApprovedSource({
          domainId: options.collectLocalFixture.domainId ?? plan?.domains[0]?.workspaceDomainId ?? "marketing-knowledge",
          sourceId: options.collectLocalFixture.sourceId,
          localSourcePath: options.collectLocalFixture.localSourcePath,
          fileName: options.collectLocalFixture.fileName,
          autoApproveLocal: true,
        });
        if (collected.status === "completed") {
          const staged = await this.stageDownloadForReview(collected.id);
          stagedDownloads.push(staged);
          extractionPreviews.push(await this.extractKnowledgePreview(collected.id));
          issuesRepaired.push(`Staged local research resource ${collected.id} into temporary review area.`);
        } else {
          issuesFound.push(`Local collection status=${collected.status}; ${collected.rejectionReason ?? "not completed"}`);
        }
      } catch (error) {
        issuesFound.push(error instanceof Error ? error.message : String(error));
      }
    }

    const recommendedTopics = this.explainer.recommendAdditionalTopics(plan?.domains.map((domain) => domain.domain) ?? []);
    const session: OnlineResearchSessionResult = {
      sessionId: randomUUID(),
      topic,
      connectivity,
      plan,
      preview,
      acceptedSources,
      rejectedSources,
      stagedDownloads,
      extractionPreviews,
      recommendedTopics,
      usedLocalKnowledgeFoundationOnly: !connectivity.internetAvailable,
      knowledgeFoundationModified: false,
      issuesFound: [...new Set(issuesFound)],
      issuesRepaired: [...new Set(issuesRepaired)],
      summary: connectivity.internetAvailable
        ? `Professional Research Mode active for "${topic}". ${acceptedSources.length} trusted source(s) accepted; KF unmodified.`
        : `Offline mode for "${topic}". Local Knowledge Foundation only; research preview prepared without network downloads.`,
    };
    this.sessions.unshift(session);
    this.sessions.splice(20);
    await this.log("online-research-session", plan?.id, session.summary);
    return structuredClone(session);
  }

  getLatestOnlineResearchSession(): OnlineResearchSessionResult | null {
    return this.sessions[0] ? structuredClone(this.sessions[0]) : null;
  }

  getAiMeOnlineResearchAwareness(): AiMeOnlineResearchAwareness {
    const available = this.isStartupComplete();
    const connectivity = this.connectivity.getLastSnapshot();
    return {
      available,
      enabled: available,
      offlineFirst: true,
      canDetectConnectivity: available,
      canSearchTrustedSources: available,
      canExplainSelection: available,
      canExplainRejection: available,
      canRecommendTopics: available,
      canStageDownloadsForReview: available,
      canExtractWithoutImport: available,
      professionalResearchMode: Boolean(connectivity?.professionalResearchMode),
      validationIntegrationDeferred: true,
      summary: available
        ? connectivity?.internetAvailable
          ? "AI Me Online Research online. Professional Research Mode can discover and stage trusted sources without importing into the Knowledge Foundation."
          : "AI Me Online Research online in Offline Mode — using local Knowledge Foundation only until connectivity is available."
        : "Online Research runtime is not ready.",
    };
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

  getReviewStagingRoot(): string {
    this.ensureStarted();
    return this.reviewStaging.getRoot();
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
      result.id,
    );
    return result;
  }

  async repairKnowledgeWorkspace(): Promise<KnowledgeCollectionRepairResult> {
    this.ensureStarted();
    const result = await this.getCollectionService().repair();
    await this.reviewStaging.initialize(this.downloadsRoot);
    result.actions.push("Ensured temporary review staging area");
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

  async buildOnlineResearchReport(testResults: OnlineResearchReportData["testResults"] = []): Promise<OnlineResearchReportData> {
    this.ensureStarted();
    const session = this.sessions[0] ?? (await this.runOnlineResearchSession({ topic: "Product Photography Lighting" }));
    const repair = await this.repairKnowledgeWorkspace();
    return {
      generatedAt: new Date().toISOString(),
      existingResearchCapability:
        "Upgraded AiKnowledgeResearchEngine (planning, discovery, download, collection) plus Knowledge Source Manager trusted catalog.",
      componentsUpgraded: [
        "ai/knowledge-research-engine/knowledge-research-engine.ts",
        "ai/knowledge-research-engine/research-planner.ts",
        "ai/knowledge-research-engine/research-source-discovery.ts",
        "ai/knowledge-research-engine/research-explainer.ts",
        "ai/knowledge-research-engine/types.ts",
        "ai/knowledge-research-engine/index.ts",
      ],
      componentsCreated: [
        "connectivity-detector.ts",
        "professional-research-domains.ts",
        "knowledge-review-staging.ts",
        "knowledge-extraction-preview.ts",
      ],
      internetDetectionStatus: session.connectivity.detail,
      trustedSourcesDiscovered: [
        ...session.acceptedSources.map((source) => ({
          sourceId: source.sourceId,
          name: source.name,
          compositeScore: source.compositeScore,
          accepted: true,
        })),
        ...session.rejectedSources.map((source) => ({
          sourceId: "rejected",
          name: source.name,
          compositeScore: 0,
          accepted: false,
        })),
      ],
      downloadCapability:
        "Offline-first download engine with injectable transport, license/trust/size gates, workspace collection, and temporary review staging before any KF import.",
      knowledgeExtractionQuality:
        session.extractionPreviews[0]
          ? `Preview quality ${session.extractionPreviews[0].qualityScore}/100; KF import deferred (importedToKnowledgeFoundation=false).`
          : "Extraction preview ready; no staged document in this session.",
      aiMeCapability: this.getAiMeOnlineResearchAwareness().summary,
      issuesFound: [...session.issuesFound, ...repair.remainingIssues],
      issuesRepaired: [...session.issuesRepaired, ...repair.actions],
      testResults,
      remainingWorkBeforeStep2: [
        "Knowledge Validation & Integration (Step 2) — verify staged review items before Knowledge Foundation import.",
        "Optional live DownloadTransport injection for production network downloads when legally allowed.",
        "Do not begin automatic KF import from the review area in this step.",
      ],
    };
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
