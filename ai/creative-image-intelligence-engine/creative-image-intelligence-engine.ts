import path from "node:path";

import type { AiImageIntelligenceFoundation } from "../image-intelligence-foundation/image-intelligence-foundation.js";

import {

  ImageIntelligenceAccessPermission,

  ImageIntelligenceCategory,

  ImageIntelligenceModuleStatus,

} from "../image-intelligence-foundation/types.js";

import { CreativeImageAnalyzer } from "./creative-image-analyzer.js";

import { CreativeImageLinker } from "./creative-image-linker.js";

import { CreativeImageLogger } from "./creative-image-logger.js";

import { CreativeImageProcessor } from "./creative-image-processor.js";

import { CreativeImageScorer } from "./creative-image-scorer.js";

import { CreativeImageIntelligenceRecordStore } from "./creative-image-stores.js";

import {

  CreativeImageIntelligenceEngineError,

  CreativeImageIntelligenceEngineStatusReport,

  CreativeImageIntelligenceInput,

  CreativeImageIntelligenceRecord,

  CreativeImageIntelligenceResult,

  CreativeImageIntelligenceSearchQuery,

} from "./types.js";



/**

 * Creative Image Intelligence Engine — prepares creative layout and production planning before image generation.

 */

export class AiCreativeImageIntelligenceEngine {

  private foundation: AiImageIntelligenceFoundation | null = null;

  private engineDir = "";

  private initialized = false;

  private startupComplete = false;



  readonly logger = new CreativeImageLogger();

  readonly records = new CreativeImageIntelligenceRecordStore();



  private readonly analyzer = new CreativeImageAnalyzer();

  private readonly scorer = new CreativeImageScorer();

  private readonly linker = new CreativeImageLinker();

  private processor: CreativeImageProcessor | null = null;



  private planningTimes: number[] = [];

  private searchTimes: number[] = [];

  private relationshipTimes: number[] = [];



  initialize(foundation: AiImageIntelligenceFoundation, storageRoot: string): void {

    this.foundation = foundation;

    this.engineDir = path.join(foundation.getIntelligenceRoot(), "creative", "engine");



    this.logger.initialize(path.join(storageRoot, "logs"));

    this.records.initialize(this.engineDir);



    this.processor = new CreativeImageProcessor(

      foundation,

      this.analyzer,

      this.scorer,

      this.linker,

      this.records,

      this.logger

    );



    this.initialized = true;

    this.logger.log("info", "startup", "Creative Image Intelligence Engine initialized", {

      engineDir: this.engineDir,

    });

  }



  async runStartup(): Promise<void> {

    this.ensureReady();



    this.foundation!.registerImageIntelligenceModule({

      moduleId: "creative-image-intelligence",

      moduleName: "Creative Image Intelligence",

      category: ImageIntelligenceCategory.CreativeImage,

      version: "0.1.0",

      status: ImageIntelligenceModuleStatus.Active,

      dependencies: [

        "image-engine",

        "product-engine",

        "composition-intelligence",

        "image-analysis-engine",

        "image-understanding-engine",

        "brand-visual-intelligence",

      ],

      qualityScore: 90,

      confidenceScore: 88,

      storageLocation: path.join(this.foundation!.getIntelligenceRoot(), "creative"),

      accessPermissions: [

        ImageIntelligenceAccessPermission.Read,

        ImageIntelligenceAccessPermission.Write,

        ImageIntelligenceAccessPermission.Validate,

      ],

      implemented: true,

    });



    this.startupComplete = true;

    this.logger.log("info", "startup", "Creative Image Intelligence Engine startup complete", {

      recordsLoaded: this.records.getCount(),

    });

  }



  async planCreativeImage(input: CreativeImageIntelligenceInput): Promise<CreativeImageIntelligenceResult> {

    this.ensureReady();

    const result = await this.processor!.plan(input);

    if (result.success) this.planningTimes.push(result.durationMs);

    return result;

  }



  getCreativePlan(imageId: string): CreativeImageIntelligenceRecord | null {

    this.ensureReady();

    return this.records.get(imageId) ?? null;

  }



  searchCreativePlans(query: CreativeImageIntelligenceSearchQuery): CreativeImageIntelligenceRecord[] {

    this.ensureReady();

    const start = Date.now();

    const results = this.processor!.search(query);

    this.searchTimes.push(Date.now() - start);

    return results;

  }



  detectRelationships(imageId: string): CreativeImageIntelligenceRecord["relationships"] | null {

    this.ensureReady();

    const start = Date.now();

    const record = this.records.get(imageId);

    if (!record) return null;



    const analysis = this.foundation!.getImageAnalysisEngine().getImage(imageId);

    const understanding = this.foundation!.getImageUnderstandingEngine().getUnderstanding(imageId);

    const composition = this.foundation!.getCompositionIntelligenceEngine().getComposition(imageId);

    const brandVisual = this.foundation!.getBrandVisualIntelligenceEngine().getBrandVisual(imageId);

    const enhancementPlan = this.foundation!.getImageEnhancementPlanningEngine().getEnhancementPlan(imageId);



    if (!analysis || !understanding || !composition || !brandVisual) return record.relationships;



    const updated = this.linker.detectRelationships(

      record,

      this.records.getAll(),

      analysis,

      understanding,

      composition,

      brandVisual,

      enhancementPlan,

      record.relationships.relatedProjects,

      record.relationships.relatedKnowledge

    );

    this.relationshipTimes.push(Date.now() - start);

    return updated;

  }



  async repairCreativePlan(imageId: string): Promise<CreativeImageIntelligenceResult | null> {

    this.ensureReady();



    let analysis = this.foundation!.getImageAnalysisEngine().getImage(imageId);

    let understanding = this.foundation!.getImageUnderstandingEngine().getUnderstanding(imageId);

    let composition = this.foundation!.getCompositionIntelligenceEngine().getComposition(imageId);

    let brandVisual = this.foundation!.getBrandVisualIntelligenceEngine().getBrandVisual(imageId);



    if (!analysis?.validated) {

      const repaired = await this.foundation!.getImageAnalysisEngine().repairImage(imageId);

      if (!repaired?.success || !repaired.record) return null;

      analysis = repaired.record;

    }



    if (!understanding?.validated) {

      const repaired = await this.foundation!.getImageUnderstandingEngine().repairUnderstanding(imageId);

      if (!repaired?.success) return null;

      understanding = this.foundation!.getImageUnderstandingEngine().getUnderstanding(imageId);

      if (!understanding) return null;

    }



    if (!composition?.validated) {

      const repaired = await this.foundation!.getCompositionIntelligenceEngine().repairComposition(imageId);

      if (!repaired?.success) return null;

      composition = this.foundation!.getCompositionIntelligenceEngine().getComposition(imageId);

      if (!composition) return null;

    }



    if (!brandVisual?.validated) {

      const repaired = await this.foundation!.getBrandVisualIntelligenceEngine().repairBrandVisual(imageId);

      if (!repaired?.success) return null;

      brandVisual = this.foundation!.getBrandVisualIntelligenceEngine().getBrandVisual(imageId);

      if (!brandVisual) return null;

    }



    this.logger.log("info", "validation", "Repairing creative image plan", { imageId });

    const existing = this.records.get(imageId);

    return this.planCreativeImage({

      imageId,

      projectId: existing?.profile.projectId,

      campaign: existing?.profile.campaign,

      platform: existing?.profile.platform,

      layoutType: existing?.layoutPlanning.layoutType,

      creativeStyle: existing?.creativeStyle.primaryStyle,

      relatedKnowledge: understanding.relationships.relatedKnowledge,

      relatedProjects: understanding.relationships.relatedProjects,

    });

  }



  buildStatusReport(): CreativeImageIntelligenceEngineStatusReport {

    const avg = (times: number[]) =>

      times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;



    const all = this.records.getAll();

    const avgLayout =

      all.length > 0

        ? Math.round(all.reduce((s, r) => s + r.scores.creativeLayoutScore, 0) / all.length)

        : 0;

    const avgMarketing =

      all.length > 0

        ? Math.round(all.reduce((s, r) => s + r.scores.marketingScore, 0) / all.length)

        : 0;



    const integration = this.foundation?.integration.getStatus();



    let readinessScore = 100;

    if (!this.initialized) readinessScore = 0;

    if (!this.startupComplete) readinessScore -= 25;

    if (!this.foundation?.getImageAnalysisEngine().isStartupComplete()) readinessScore -= 8;

    if (!this.foundation?.getImageUnderstandingEngine().isStartupComplete()) readinessScore -= 8;

    if (!this.foundation?.getCompositionIntelligenceEngine().isStartupComplete()) readinessScore -= 8;

    if (!this.foundation?.getBrandVisualIntelligenceEngine().isStartupComplete()) readinessScore -= 8;



    return {

      engineStatus: this.startupComplete ? "operational" : "initializing",

      creativePlanningStatus:

        "poster, advertisement, thumbnail, banner, social and branding layouts planned",

      layoutPlanningStatus:

        "visual hierarchy, product, logo, headline, CTA and safe area planning prepared",

      brandConsistencyStatus: "brand-aligned creative planning with visual intelligence integration",

      marketingAlignmentStatus: "promotional, showcase, offer, campaign and lead-gen layouts prepared",

      relationshipStatus: `${all.length} creative plans indexed`,

      knowledgeBridgeStatus: integration?.knowledgeEngine ? "connected" : "unavailable",

      memoryBridgeStatus: integration?.memoryEngine ? "connected" : "unavailable",

      productIntelligenceBridgeStatus: integration?.productIntelligenceEngine ? "connected" : "unavailable",

      plansCreated: all.length,

      averageLayoutScore: avgLayout,

      averageMarketingScore: avgMarketing,

      performance: {

        averagePlanningMs: avg(this.planningTimes),

        averageSearchMs: avg(this.searchTimes),

        averageRelationshipMs: avg(this.relationshipTimes),

      },

      knownIssues: [],

      readinessScore: Math.max(0, readinessScore),

      timestamp: new Date().toISOString(),

    };

  }



  isInitialized(): boolean {

    return this.initialized;

  }



  isStartupComplete(): boolean {

    return this.startupComplete;

  }



  private ensureReady(): void {

    if (!this.initialized || !this.foundation || !this.processor) {

      throw new CreativeImageIntelligenceEngineError(

        "Creative Image Intelligence Engine not initialized",

        "NOT_INITIALIZED"

      );

    }

  }

}

