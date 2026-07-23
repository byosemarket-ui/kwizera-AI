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
import type { ScriptPlanningRecord } from "../script-planning-engine/types.js";
import { VisualPlanningAnalyzer } from "./visual-planning-analyzer.js";
import { VisualPlanningLinker } from "./visual-planning-linker.js";
import { VisualPlanningLogger } from "./visual-planning-logger.js";
import { VisualPlanningScorer } from "./visual-planning-scorer.js";
import { VisualPlanningRecordStore } from "./visual-planning-stores.js";
import {
  VisualPlanningInput,
  VisualPlanningRecord,
  VisualPlanningResult,
  VisualPlanningSearchQuery,
} from "./types.js";

export class VisualPlanningProcessor {
  constructor(
    private readonly foundation: AiProductIntelligenceFoundation,
    private readonly analyzer: VisualPlanningAnalyzer,
    private readonly scorer: VisualPlanningScorer,
    private readonly linker: VisualPlanningLinker,
    private readonly records: VisualPlanningRecordStore,
    private readonly logger: VisualPlanningLogger
  ) {}

  async createVisualPlan(input: VisualPlanningInput): Promise<VisualPlanningResult> {
    const start = Date.now();
    const storyboardEngine = this.foundation.getStoryboardIntelligenceEngine();
    const scriptEngine = this.foundation.getScriptPlanningEngine();
    const creativeEngine = this.foundation.getCreativeDirectionEngine();
    const strategyEngine = this.foundation.getMarketingStrategyIntelligenceEngine();
    const understandingEngine = this.foundation.getProductUnderstandingEngine();

    const understanding = understandingEngine.getUnderstanding(input.productId);
    if (!understanding?.validated) {
      return this.reject(start, "Complete product understanding required before visual planning", [
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
          storyboardResult.message ?? "Production-ready storyboard required before visual planning",
          storyboardResult.diagnostics.length > 0
            ? storyboardResult.diagnostics
            : ["Storyboard must be validated and production-ready"]
        );
      }
      storyboard = storyboardResult.record;
    }

    let scriptPlan = input.scriptPlanId
      ? scriptEngine.getScriptPlan(input.scriptPlanId)
      : scriptEngine.getScriptPlansByProduct(input.productId).find((r) => r.storyboardId === storyboard!.storyboardId);

    if (!scriptPlan?.validated || !scriptPlan.productionReady) {
      const scriptResult = await scriptEngine.createScriptPlan({
        productId: input.productId,
        storyboardId: storyboard.storyboardId,
        scriptPlanId: input.scriptPlanId,
        projectId: input.projectId,
      });
      if (!scriptResult.success || !scriptResult.record) {
        return this.reject(
          start,
          scriptResult.message ?? "Production-ready script plan required before visual planning",
          scriptResult.diagnostics.length > 0
            ? scriptResult.diagnostics
            : ["Script plan must be validated and production-ready"]
        );
      }
      scriptPlan = scriptResult.record;
    }

    const creative = creativeEngine.getCreativeDirection(storyboard.creativeId);
    const strategy = strategyEngine.getStrategy(storyboard.strategyId);
    if (!creative?.validated || !strategy?.validated) {
      return this.reject(start, "Validated creative direction and marketing strategy required", [
        "Upstream creative and strategy records must be validated",
      ]);
    }

    const existing = input.visualPlanId
      ? this.records.get(input.visualPlanId)
      : this.records.getByProduct(input.productId).find((r) => r.storyboardId === storyboard!.storyboardId);
    const version = existing ? existing.version + 1 : 1;

    const profile = this.analyzer.buildProfile(input, storyboard, scriptPlan, understanding, version);
    let scenePlans = this.analyzer.buildScenePlans(storyboard, scriptPlan, creative, understanding);
    const backgroundPlanning = this.analyzer.buildBackgroundPlanning(creative, storyboard);
    const cameraPlanning = this.analyzer.buildCameraPlanning(creative, storyboard);
    const visualStyle = this.analyzer.buildVisualStyle(creative, understanding);
    let brandConsistency = this.analyzer.buildBrandConsistency(creative, scenePlans);
    const graphicElements = this.analyzer.buildGraphicElements(creative, understanding);

    let alignment = this.analyzer.validateSceneAlignment(scenePlans, storyboard, scriptPlan);
    if (!alignment.aligned) {
      scenePlans = this.applySceneRepairs(storyboard, scriptPlan, creative, understanding);
      alignment = this.analyzer.validateSceneAlignment(scenePlans, storyboard, scriptPlan);
      brandConsistency = this.analyzer.buildBrandConsistency(creative, scenePlans);
    }

    const scores = this.scorer.computeScores(
      scenePlans,
      backgroundPlanning,
      cameraPlanning,
      brandConsistency,
      storyboard,
      scriptPlan,
      creative,
      strategy
    );
    let validation = this.scorer.isVisualPlanValid(
      scores,
      scenePlans,
      storyboard,
      scriptPlan,
      brandConsistency,
      alignment.issues
    );

    if (!validation.valid) {
      const repaired = this.applyScoreRepairs(scenePlans, brandConsistency, creative);
      if (repaired.length > 0) {
        scenePlans = repaired;
        brandConsistency = this.analyzer.buildBrandConsistency(creative, scenePlans);
        const repairedScores = this.scorer.computeScores(
          scenePlans,
          backgroundPlanning,
          cameraPlanning,
          brandConsistency,
          storyboard,
          scriptPlan,
          creative,
          strategy
        );
        validation = this.scorer.isVisualPlanValid(
          repairedScores,
          scenePlans,
          storyboard,
          scriptPlan,
          brandConsistency,
          this.analyzer.validateSceneAlignment(scenePlans, storyboard, scriptPlan).issues
        );
        if (validation.valid) {
          Object.assign(scores, repairedScores);
        }
      }
    }

    if (!validation.valid) {
      this.logger.log("warn", "validation", "Visual plan rejected", {
        productId: input.productId,
        diagnostics: validation.diagnostics,
      });
      return {
        success: false,
        durationMs: Date.now() - start,
        diagnostics: validation.diagnostics,
        message:
          "Visual planning validation failed — plan must fully align with storyboard, script plan, brand and strategy",
      };
    }

    const productionReady = this.scorer.isProductionReady(scenePlans, storyboard, scriptPlan, scores);

    const draft: VisualPlanningRecord = {
      visualPlanId: profile.visualPlanId,
      productId: input.productId,
      projectId: profile.projectId,
      storyboardId: storyboard.storyboardId,
      scriptPlanId: scriptPlan.scriptPlanId,
      creativeId: creative.creativeId,
      strategyId: strategy.strategyId,
      profile,
      scenePlans,
      backgroundPlanning,
      cameraPlanning,
      visualStyle,
      brandConsistency,
      graphicElements,
      scores,
      relationships: {
        storyboards: [storyboard.storyboardId],
        scriptPlans: [scriptPlan.scriptPlanId],
        creativeDirections: [creative.creativeId],
        marketingStrategies: [strategy.strategyId],
        products: [input.productId],
        brands: [creative.profile.brand],
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
      storyboard,
      scriptPlan,
      creative,
      strategy,
      understanding
    );

    const intelligenceValidation = this.foundation.validateProductIntelligence({
      qualityScore: scores.visualPlanningScore,
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
          changeSummary: `Visual plan v${version} — ${scenePlans.length} scene visual plans`,
          source: ProductIntelligenceSource.KnowledgeEngine,
        },
      ],
      relationshipLinks: [
        ...draft.relationships.knowledgeRecords,
        ...draft.relationships.products,
        ...draft.relationships.storyboards,
        ...draft.relationships.scriptPlans,
        ...draft.relationships.creativeDirections,
      ],
      healthStatus: ProductIntelligenceHealthLevel.Good,
    });

    if (!intelligenceValidation.valid) {
      return {
        success: false,
        durationMs: Date.now() - start,
        diagnostics: intelligenceValidation.issues,
        message: "Product intelligence validation failed for visual plan",
      };
    }

    this.records.upsert(draft);

    this.logger.log("info", "visual-planning", "Visual plan prepared", {
      visualPlanId: draft.visualPlanId,
      sceneCount: scenePlans.length,
      productionReady,
      durationMs: Date.now() - start,
    });

    this.logger.log("info", "scene-planning", "Scene visual plans prepared", {
      visualPlanId: draft.visualPlanId,
      sceneCount: scenePlans.length,
      platform: profile.platform,
    });

    this.logger.log("info", "relationship", "Visual planning relationships updated", {
      visualPlanId: draft.visualPlanId,
      relationshipCount:
        draft.relationships.audioPlans.length + draft.relationships.productionPlans.length,
    });

    this.logger.log("info", "performance", "Visual planning completed", {
      visualPlanId: draft.visualPlanId,
      durationMs: Date.now() - start,
    });

    return { success: true, record: draft, durationMs: Date.now() - start, diagnostics: [] };
  }

  search(query: VisualPlanningSearchQuery): VisualPlanningRecord[] {
    let results = this.records.getAll();

    if (query.visualPlanId) results = results.filter((r) => r.visualPlanId === query.visualPlanId);
    if (query.storyboardId) results = results.filter((r) => r.storyboardId === query.storyboardId);
    if (query.scriptPlanId) results = results.filter((r) => r.scriptPlanId === query.scriptPlanId);
    if (query.productId) results = results.filter((r) => r.productId === query.productId);
    if (query.platform) results = results.filter((r) => r.profile.platform === query.platform);
    if (query.campaignGoal) results = results.filter((r) => r.profile.campaignGoal === query.campaignGoal);
    if (query.creativeStyle) results = results.filter((r) => r.profile.creativeStyle === query.creativeStyle);
    if (query.industry) {
      const industryLower = query.industry.toLowerCase();
      results = results.filter((r) => r.profile.industry.toLowerCase().includes(industryLower));
    }
    if (query.sceneNumber !== undefined) {
      results = results.filter((r) => r.scenePlans.some((s) => s.sceneNumber === query.sceneNumber));
    }
    if (query.brand) {
      const brandLower = query.brand.toLowerCase();
      results = results.filter(
        (r) =>
          r.profile.brand.toLowerCase().includes(brandLower) ||
          r.relationships.brands.some((b) => b.toLowerCase().includes(brandLower))
      );
    }
    if (query.text) {
      const textLower = query.text.toLowerCase();
      results = results.filter(
        (r) =>
          r.visualPlanId.toLowerCase().includes(textLower) ||
          r.scenePlans.some((s) => s.visualGoal.toLowerCase().includes(textLower))
      );
    }

    return results.slice(0, query.limit ?? 50);
  }

  private applySceneRepairs(
    storyboard: StoryboardIntelligenceRecord,
    scriptPlan: ScriptPlanningRecord,
    creative: CreativeDirectionRecord,
    understanding: ProductUnderstandingRecord
  ): VisualPlanningRecord["scenePlans"] {
    return this.analyzer.buildScenePlans(storyboard, scriptPlan, creative, understanding);
  }

  private applyScoreRepairs(
    scenePlans: VisualPlanningRecord["scenePlans"],
    brandConsistency: VisualPlanningRecord["brandConsistency"],
    creative: CreativeDirectionRecord
  ): VisualPlanningRecord["scenePlans"] {
    if (brandConsistency.logoPlacement && brandConsistency.brandColors) {
      return [];
    }
    return scenePlans.map((plan, index) => ({
      ...plan,
      logoPlacement:
        plan.logoPlacement !== "none" && plan.logoPlacement.length > 5
          ? plan.logoPlacement
          : index === scenePlans.length - 1
            ? `Plan logo — ${creative.brandDirection.logoPlacement}`
            : plan.logoPlacement,
      colorPalette:
        plan.colorPalette.includes(creative.profile.brand) || plan.colorPalette.length > 15
          ? plan.colorPalette
          : `Plan palette — ${creative.visualDirection.colorPalette.join(" / ")} (${creative.profile.brand})`,
    }));
  }

  private reject(start: number, message: string, diagnostics: string[]): VisualPlanningResult {
    this.logger.log("warn", "validation", message, { diagnostics });
    return { success: false, durationMs: Date.now() - start, diagnostics, message };
  }
}
