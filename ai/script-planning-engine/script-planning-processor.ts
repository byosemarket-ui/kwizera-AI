import type { AiProductIntelligenceFoundation } from "../product-intelligence-foundation/product-intelligence-foundation.js";
import {
  ProductIntelligenceHealthLevel,
  ProductIntelligenceSource,
  ProductIntelligenceVerificationStatus,
} from "../product-intelligence-foundation/types.js";
import { CreativePlatform } from "../creative-direction-engine/types.js";
import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import type { StoryboardIntelligenceRecord } from "../storyboard-intelligence-engine/types.js";
import { ScriptPlanningAnalyzer } from "./script-planning-analyzer.js";
import { ScriptPlanningLinker } from "./script-planning-linker.js";
import { ScriptPlanningLogger } from "./script-planning-logger.js";
import { ScriptPlanningScorer } from "./script-planning-scorer.js";
import { ScriptPlanningRecordStore } from "./script-planning-stores.js";
import {
  ScriptPlanningInput,
  ScriptPlanningRecord,
  ScriptPlanningResult,
  ScriptPlanningSearchQuery,
} from "./types.js";

export class ScriptPlanningProcessor {
  constructor(
    private readonly foundation: AiProductIntelligenceFoundation,
    private readonly analyzer: ScriptPlanningAnalyzer,
    private readonly scorer: ScriptPlanningScorer,
    private readonly linker: ScriptPlanningLinker,
    private readonly records: ScriptPlanningRecordStore,
    private readonly logger: ScriptPlanningLogger
  ) {}

  async createScriptPlan(input: ScriptPlanningInput): Promise<ScriptPlanningResult> {
    const start = Date.now();
    const storyboardEngine = this.foundation.getStoryboardIntelligenceEngine();
    const creativeEngine = this.foundation.getCreativeDirectionEngine();
    const strategyEngine = this.foundation.getMarketingStrategyIntelligenceEngine();
    const understandingEngine = this.foundation.getProductUnderstandingEngine();

    const understanding = understandingEngine.getUnderstanding(input.productId);
    if (!understanding?.validated) {
      return this.reject(start, "Complete product understanding required before script planning", [
        "Product must be understood and validated",
      ]);
    }

    let storyboard = input.storyboardId
      ? storyboardEngine.getStoryboard(input.storyboardId)
      : storyboardEngine.getStoryboardsByProduct(input.productId)[0];

    if (!storyboard?.validated || !storyboard.productionReady) {
      const storyboardResult = await storyboardEngine.createStoryboard({
        productId: input.productId,
        storyboardId: input.storyboardId,
        projectId: input.projectId,
      });
      if (!storyboardResult.success || !storyboardResult.record) {
        return this.reject(
          start,
          storyboardResult.message ?? "Production-ready storyboard required before script planning",
          storyboardResult.diagnostics.length > 0
            ? storyboardResult.diagnostics
            : ["Storyboard must be validated and production-ready"]
        );
      }
      storyboard = storyboardResult.record;
    }

    const creative = creativeEngine.getCreativeDirection(storyboard.creativeId);
    const strategy = strategyEngine.getStrategy(storyboard.strategyId);
    if (!creative?.validated || !strategy?.validated) {
      return this.reject(start, "Validated creative direction and marketing strategy required", [
        "Upstream creative and strategy records must be validated",
      ]);
    }

    const language = input.language ?? "en";
    const existing = input.scriptPlanId
      ? this.records.get(input.scriptPlanId)
      : this.records.getByProduct(input.productId).find((r) => r.storyboardId === storyboard!.storyboardId);
    const version = existing ? existing.version + 1 : 1;

    const profile = this.analyzer.buildProfile(input, storyboard, version, language);
    let scenePlans = this.analyzer.buildScenePlans(storyboard, understanding, creative, language);
    const scriptStructure = this.analyzer.buildScriptStructure(storyboard);
    const voicePreparation = this.analyzer.buildVoicePreparation(creative, storyboard, understanding);
    let subtitlePreparation = this.analyzer.buildSubtitlePreparation(scenePlans, storyboard);
    const platformRules = this.analyzer.buildPlatformRules(storyboard);

    let alignment = this.analyzer.validateSceneAlignment(scenePlans, storyboard);
    if (!alignment.aligned) {
      scenePlans = this.applySceneRepairs(scenePlans, storyboard, understanding, creative, language);
      alignment = this.analyzer.validateSceneAlignment(scenePlans, storyboard);
      subtitlePreparation = this.analyzer.buildSubtitlePreparation(scenePlans, storyboard);
    }

    const scores = this.scorer.computeScores(
      scenePlans,
      scriptStructure,
      voicePreparation,
      subtitlePreparation,
      storyboard,
      creative,
      strategy
    );
    let validation = this.scorer.isScriptPlanValid(scores, scenePlans, storyboard, alignment.issues);

    if (!validation.valid) {
      const repaired = this.applyScoreRepairs(scenePlans, scores);
      if (repaired.length > 0) {
        scenePlans = repaired;
        subtitlePreparation = this.analyzer.buildSubtitlePreparation(scenePlans, storyboard);
        const repairedScores = this.scorer.computeScores(
          scenePlans,
          scriptStructure,
          voicePreparation,
          subtitlePreparation,
          storyboard,
          creative,
          strategy
        );
        validation = this.scorer.isScriptPlanValid(
          repairedScores,
          scenePlans,
          storyboard,
          this.analyzer.validateSceneAlignment(scenePlans, storyboard).issues
        );
        if (validation.valid) {
          Object.assign(scores, repairedScores);
        }
      }
    }

    if (!validation.valid) {
      this.logger.log("warn", "validation", "Script plan rejected", {
        productId: input.productId,
        diagnostics: validation.diagnostics,
      });
      return {
        success: false,
        durationMs: Date.now() - start,
        diagnostics: validation.diagnostics,
        message: "Script planning validation failed — every scene must support the approved storyboard",
      };
    }

    const productionReady = this.scorer.isProductionReady(scenePlans, storyboard, scores);

    const draft: ScriptPlanningRecord = {
      scriptPlanId: profile.scriptPlanId,
      productId: input.productId,
      projectId: profile.projectId,
      storyboardId: storyboard.storyboardId,
      creativeId: creative.creativeId,
      strategyId: strategy.strategyId,
      profile,
      scenePlans,
      scriptStructure,
      voicePreparation,
      subtitlePreparation,
      platformRules,
      scores,
      relationships: {
        storyboards: [storyboard.storyboardId],
        creativeDirections: [creative.creativeId],
        marketingStrategies: [strategy.strategyId],
        products: [input.productId],
        brands: [creative.profile.brand],
        languages: [language],
        audioPlans: [],
        productionPlans: [],
        knowledgeRecords: [],
      },
      validated: true,
      productionReady,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      version,
    };

    draft.relationships = this.linker.detectRelationships(
      draft,
      this.records.getAll(),
      storyboard,
      creative,
      strategy,
      understanding
    );

    const intelligenceValidation = this.foundation.validateProductIntelligence({
      qualityScore: scores.scriptPlanningScore,
      confidenceScore: scores.aiConfidenceScore,
      verificationStatus:
        scores.aiConfidenceScore >= 75
          ? ProductIntelligenceVerificationStatus.Verified
          : ProductIntelligenceVerificationStatus.Pending,
      source: ProductIntelligenceSource.KnowledgeEngine,
      sourceRef: storyboard.storyboardId,
      versionHistory: [
        {
          version,
          timestamp: new Date().toISOString(),
          changeSummary: `Script plan v${version} — ${scenePlans.length} scene plans`,
          source: ProductIntelligenceSource.KnowledgeEngine,
        },
      ],
      relationshipLinks: [
        ...draft.relationships.knowledgeRecords,
        ...draft.relationships.products,
        ...draft.relationships.storyboards,
        ...draft.relationships.creativeDirections,
      ],
      healthStatus: ProductIntelligenceHealthLevel.Good,
    });

    if (!intelligenceValidation.valid) {
      return {
        success: false,
        durationMs: Date.now() - start,
        diagnostics: intelligenceValidation.issues,
        message: "Product intelligence validation failed for script plan",
      };
    }

    this.records.upsert(draft);

    this.logger.log("info", "script-planning", "Script plan prepared", {
      scriptPlanId: draft.scriptPlanId,
      sceneCount: scenePlans.length,
      productionReady,
      durationMs: Date.now() - start,
    });

    this.logger.log("info", "scene-planning", "Scene script plans prepared", {
      scriptPlanId: draft.scriptPlanId,
      sceneCount: scenePlans.length,
      platform: profile.platform,
    });

    this.logger.log("info", "relationship", "Script planning relationships updated", {
      scriptPlanId: draft.scriptPlanId,
      relationshipCount:
        draft.relationships.audioPlans.length + draft.relationships.productionPlans.length,
    });

    this.logger.log("info", "performance", "Script planning completed", {
      scriptPlanId: draft.scriptPlanId,
      durationMs: Date.now() - start,
    });

    return { success: true, record: draft, durationMs: Date.now() - start, diagnostics: [] };
  }

  search(query: ScriptPlanningSearchQuery): ScriptPlanningRecord[] {
    let results = this.records.getAll();

    if (query.scriptPlanId) results = results.filter((r) => r.scriptPlanId === query.scriptPlanId);
    if (query.storyboardId) results = results.filter((r) => r.storyboardId === query.storyboardId);
    if (query.productId) results = results.filter((r) => r.productId === query.productId);
    if (query.platform) results = results.filter((r) => r.profile.platform === query.platform);
    if (query.campaignGoal) results = results.filter((r) => r.profile.campaignGoal === query.campaignGoal);
    if (query.language) results = results.filter((r) => r.profile.language === query.language);
    if (query.brand) {
      const brandLower = query.brand.toLowerCase();
      results = results.filter(
        (r) =>
          r.profile.brand.toLowerCase().includes(brandLower) ||
          r.relationships.brands.some((b) => b.toLowerCase().includes(brandLower))
      );
    }
    if (query.audience) {
      const audienceLower = query.audience.toLowerCase();
      results = results.filter((r) => r.profile.targetAudience.toLowerCase().includes(audienceLower));
    }
    if (query.text) {
      const textLower = query.text.toLowerCase();
      results = results.filter(
        (r) =>
          r.scriptPlanId.toLowerCase().includes(textLower) ||
          r.scriptStructure.hook.toLowerCase().includes(textLower)
      );
    }

    return results.slice(0, query.limit ?? 50);
  }

  private applySceneRepairs(
    _scenePlans: ScriptPlanningRecord["scenePlans"],
    storyboard: StoryboardIntelligenceRecord,
    understanding: ProductUnderstandingRecord,
    creative: CreativeDirectionRecord,
    language: string
  ): ScriptPlanningRecord["scenePlans"] {
    return this.analyzer.buildScenePlans(storyboard, understanding, creative, language);
  }

  private applyScoreRepairs(
    scenePlans: ScriptPlanningRecord["scenePlans"],
    scores: ScriptPlanningRecord["scores"]
  ): ScriptPlanningRecord["scenePlans"] {
    if (scores.readabilityScore >= 50 && scores.scriptPlanningScore >= 55) {
      return [];
    }
    return scenePlans.map((plan) => ({
      ...plan,
      plannedNarration:
        plan.plannedNarration.length >= 20
          ? plan.plannedNarration
          : `Plan narration (${plan.scenePurpose}): ${plan.messageObjective}`,
      plannedSubtitle: plan.plannedSubtitle.startsWith("Plan subtitle")
        ? plan.plannedSubtitle
        : `Plan subtitle: ${plan.keyProductBenefit}`,
    }));
  }

  private reject(start: number, message: string, diagnostics: string[]): ScriptPlanningResult {
    this.logger.log("warn", "validation", message, { diagnostics });
    return { success: false, durationMs: Date.now() - start, diagnostics, message };
  }
}
