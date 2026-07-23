import path from "node:path";
import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { MemoryStorageType } from "../memory-storage-engine/types.js";
import { MemoryAccessPermission, MemoryCategory, MemoryModuleStatus } from "../memory-foundation/types.js";
import { MarketingCustomerStore } from "./marketing-customer-store.js";
import { MarketingHistoryStore } from "./marketing-history-store.js";
import { MarketingLearner } from "./marketing-learner.js";
import { MarketingMemoryLogger } from "./marketing-logger.js";
import { MarketingPatternDetector } from "./marketing-pattern-detector.js";
import { MarketingPatternStore } from "./marketing-pattern-store.js";
import { MarketingProcessor, recordFromMemory } from "./marketing-processor.js";
import { MarketingRelationshipLinker } from "./marketing-relationship-linker.js";
import { MarketingScorer } from "./marketing-scorer.js";
import {
  CampaignStatus,
  CustomerMemoryProfile,
  MarketingCreateInput,
  MarketingLearningResult,
  MarketingMemoryEngineError,
  MarketingMemoryStatusReport,
  MarketingPattern,
  MarketingProcessResult,
  MarketingRecord,
  MarketingRelationships,
  MarketingUpdateInput,
} from "./types.js";

/**
 * Marketing Memory Engine — permanent marketing knowledge storage and learning.
 */
export class AiMarketingMemoryEngine {
  private foundation: AiMemoryFoundation | null = null;
  private storageRoot = "";
  private initialized = false;
  private startupComplete = false;

  readonly logger = new MarketingMemoryLogger();
  readonly history = new MarketingHistoryStore();
  readonly patterns = new MarketingPatternStore();
  readonly customers = new MarketingCustomerStore();

  private readonly campaigns = new Map<string, MarketingRecord>();
  private readonly scorer = new MarketingScorer();
  private linker: MarketingRelationshipLinker | null = null;
  private patternDetector: MarketingPatternDetector | null = null;
  private learner: MarketingLearner | null = null;
  private processor: MarketingProcessor | null = null;

  private saveTimes: number[] = [];
  private loadTimes: number[] = [];
  private searchTimes: number[] = [];

  initialize(foundation: AiMemoryFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.storageRoot = storageRoot;

    const logDir = path.join(storageRoot, "logs");
    const marketingDir = path.join(storageRoot, "memory", "marketing");
    this.logger.initialize(logDir);
    this.history.initialize(marketingDir);
    this.patterns.initialize(marketingDir);
    this.customers.initialize(marketingDir);

    this.linker = new MarketingRelationshipLinker(foundation, this.logger);
    this.patternDetector = new MarketingPatternDetector(this.patterns);
    this.learner = new MarketingLearner(foundation, this.logger);
    this.processor = new MarketingProcessor(
      foundation,
      this.history,
      this.customers,
      this.scorer,
      this.patternDetector,
      this.linker,
      this.learner,
      this.logger,
      this.campaigns
    );

    this.initialized = true;
    this.logger.log("info", "startup", "Marketing Memory Engine initialized", { storageRoot });
  }

  async runStartup(): Promise<void> {
    this.ensureReady();
    const start = Date.now();

    const entries = this.foundation!
      .getStorageEngine()
      .getIndexEntries()
      .filter((e) => e.memoryType === MemoryStorageType.Marketing);

    for (const entry of entries) {
      const read = await this.foundation!.getStorageEngine().getRecord(entry.memoryId);
      if (read.success && read.record) {
        this.campaigns.set(entry.memoryId, recordFromMemory(read.record));
      }
    }

    this.foundation!.registerMemoryModule({
      memoryId: "marketing-memory",
      memoryName: "Marketing Memory",
      category: MemoryCategory.Marketing,
      version: "0.1.0",
      status: MemoryModuleStatus.Active,
      dependencies: ["memory-engine"],
      storageLocation: path.join(this.storageRoot, "memory", "marketing"),
      accessPermissions: [MemoryAccessPermission.Read, MemoryAccessPermission.Write],
      implemented: true,
    });

    this.startupComplete = true;
    this.logger.log("info", "startup", "Marketing Memory Engine startup complete", {
      campaignsLoaded: this.campaigns.size,
      patternsLoaded: this.patterns.getCount(),
      durationMs: Date.now() - start,
    });
  }

  async createCampaign(input: MarketingCreateInput): Promise<MarketingProcessResult> {
    this.ensureReady();
    const result = await this.processor!.create(input);
    if (result.success) this.saveTimes.push(result.durationMs);
    return result;
  }

  async updateCampaign(campaignId: string, input: MarketingUpdateInput): Promise<MarketingProcessResult> {
    this.ensureReady();
    const result = await this.processor!.update(campaignId, input);
    if (result.success) this.saveTimes.push(result.durationMs);
    return result;
  }

  async completeCampaign(
    campaignId: string,
    effectivenessRating?: number
  ): Promise<MarketingLearningResult> {
    this.ensureReady();
    return this.processor!.complete(campaignId, effectivenessRating);
  }

  async getCampaign(campaignId: string): Promise<MarketingRecord | null> {
    this.ensureReady();
    const start = Date.now();
    const campaign = await this.processor!.loadCampaign(campaignId);
    this.loadTimes.push(Date.now() - start);
    return campaign;
  }

  async listCampaigns(): Promise<MarketingRecord[]> {
    this.ensureReady();
    return [...this.campaigns.values()];
  }

  getCustomerMemory(): CustomerMemoryProfile {
    return this.customers.get();
  }

  learnCustomerInsights(partial: Partial<CustomerMemoryProfile>): CustomerMemoryProfile {
    this.ensureReady();
    const updated = this.customers.learn(partial);
    this.logger.log("info", "customer", "Customer insights updated", {
      fields: Object.keys(partial).length,
    });
    return updated;
  }

  getCampaignRelationships(campaignId: string): MarketingRelationships | null {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign || !this.linker) return null;
    return this.linker.link(
      campaign.campaignId,
      campaign.projectId,
      campaign.brand,
      campaign.product,
      campaign.tags
    );
  }

  getDetectedPatterns(): MarketingPattern[] {
    return [...this.patterns.getAll()];
  }

  getReusablePatterns(): MarketingPattern[] {
    return this.patterns.getReusable();
  }

  searchCampaigns(query: {
    name?: string;
    brand?: string;
    product?: string;
    platform?: string;
    style?: string;
    language?: string;
    targetAudience?: string;
    cta?: string;
    hook?: string;
    keywords?: string[];
    goal?: string;
    tags?: string[];
  }): MarketingRecord[] {
    this.ensureReady();
    const start = Date.now();

    let results = [...this.campaigns.values()];

    if (query.name) {
      const lower = query.name.toLowerCase();
      results = results.filter((c) => c.campaignName.toLowerCase().includes(lower));
    }
    if (query.brand) {
      const lower = query.brand.toLowerCase();
      results = results.filter((c) => c.brand.toLowerCase().includes(lower));
    }
    if (query.product) {
      const lower = query.product.toLowerCase();
      results = results.filter((c) => c.product.toLowerCase().includes(lower));
    }
    if (query.platform) {
      results = results.filter((c) => c.platform === query.platform);
    }
    if (query.language) results = results.filter((c) => c.language === query.language);
    if (query.targetAudience) {
      const lower = query.targetAudience.toLowerCase();
      results = results.filter((c) => c.targetAudience.toLowerCase().includes(lower));
    }
    if (query.goal) {
      const lower = query.goal.toLowerCase();
      results = results.filter((c) => c.goal.toLowerCase().includes(lower));
    }
    if (query.cta) {
      const lower = query.cta.toLowerCase();
      results = results.filter((c) =>
        c.content.callToActions.some((cta) => cta.toLowerCase().includes(lower))
      );
    }
    if (query.hook) {
      const lower = query.hook.toLowerCase();
      results = results.filter((c) =>
        c.content.hooks.some((h) => h.toLowerCase().includes(lower))
      );
    }
    if (query.style) {
      const lower = query.style.toLowerCase();
      results = results.filter(
        (c) =>
          c.branding.brandStyle.toLowerCase().includes(lower) ||
          c.tags.some((t) => t.toLowerCase().includes(lower))
      );
    }
    if (query.keywords?.length) {
      results = results.filter((c) =>
        query.keywords!.some(
          (kw) =>
            c.keywords.includes(kw) ||
            c.content.keywords.some((k) => k.toLowerCase().includes(kw.toLowerCase()))
        )
      );
    }
    if (query.tags?.length) {
      results = results.filter((c) => query.tags!.some((t) => c.tags.includes(t)));
    }

    const searchMs = Date.now() - start;
    this.searchTimes.push(searchMs);
    this.logger.log("info", "search", "Campaign search complete", {
      results: results.length,
      searchMs,
    });

    return results;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  isStartupComplete(): boolean {
    return this.startupComplete;
  }

  buildStatusReport(): MarketingMemoryStatusReport {
    const campaigns = [...this.campaigns.values()];
    const patterns = this.patterns.getAll();
    const avg = (times: number[]) =>
      times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

    let readinessScore = 100;
    if (!this.initialized) readinessScore = 0;
    if (!this.startupComplete) readinessScore -= 25;

    const withBranding = campaigns.filter((c) => c.branding.brandVoice).length;

    return {
      engineStatus: this.startupComplete ? "operational" : "initializing",
      campaignStatus: `${campaigns.length} campaign(s), ${campaigns.filter((c) => c.status === CampaignStatus.Completed).length} completed`,
      patternDetectionStatus: `${patterns.length} pattern(s), ${this.patterns.getReusable().length} reusable`,
      brandMemoryStatus: `${withBranding} campaign(s) with brand memory`,
      relationshipStatus: `${campaigns.reduce((s, c) => s + c.relatedMemories.length, 0)} relationship link(s)`,
      totalCampaigns: campaigns.length,
      totalPatterns: patterns.length,
      totalCustomerProfiles: this.customers.getFieldCount(),
      performance: {
        averageSaveMs: avg(this.saveTimes),
        averageLoadMs: avg(this.loadTimes),
        averageSearchMs: avg(this.searchTimes),
        totalVersions: campaigns.reduce((s, c) => s + c.versions.length, 0),
      },
      knownIssues: [],
      readinessScore: Math.max(0, readinessScore),
      timestamp: new Date().toISOString(),
    };
  }

  private ensureReady(): void {
    if (!this.initialized || !this.foundation) {
      throw new MarketingMemoryEngineError(
        "Marketing Memory Engine not initialized",
        "NOT_INITIALIZED"
      );
    }
  }
}
