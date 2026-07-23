import type { AiProductIntelligenceFoundation } from "../product-intelligence-foundation/product-intelligence-foundation.js";
import {
  ProductIntelligenceHealthLevel,
  ProductIntelligenceSource,
  ProductIntelligenceVerificationStatus,
} from "../product-intelligence-foundation/types.js";
import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { StoryboardIntelligenceRecord } from "../storyboard-intelligence-engine/types.js";
import type { ScriptPlanningRecord } from "../script-planning-engine/types.js";
import type { VisualPlanningRecord } from "../visual-planning-engine/types.js";
import { AudioPlanningAnalyzer } from "./audio-planning-analyzer.js";
import { AudioPlanningLinker } from "./audio-planning-linker.js";
import { AudioPlanningLogger } from "./audio-planning-logger.js";
import { AudioPlanningScorer } from "./audio-planning-scorer.js";
import { AudioPlanningRecordStore } from "./audio-planning-stores.js";
import {
  AudioPlanningInput,
  AudioPlanningRecord,
  AudioPlanningResult,
  AudioPlanningSearchQuery,
} from "./types.js";

export class AudioPlanningProcessor {
  constructor(
    private readonly foundation: AiProductIntelligenceFoundation,
    private readonly analyzer: AudioPlanningAnalyzer,
    private readonly scorer: AudioPlanningScorer,
    private readonly linker: AudioPlanningLinker,
    private readonly records: AudioPlanningRecordStore,
    private readonly logger: AudioPlanningLogger
  ) {}

  async createAudioPlan(input: AudioPlanningInput): Promise<AudioPlanningResult> {
    const start = Date.now();
    const storyboardEngine = this.foundation.getStoryboardIntelligenceEngine();
    const scriptEngine = this.foundation.getScriptPlanningEngine();
    const visualEngine = this.foundation.getVisualPlanningEngine();
    const creativeEngine = this.foundation.getCreativeDirectionEngine();
    const strategyEngine = this.foundation.getMarketingStrategyIntelligenceEngine();
    const understandingEngine = this.foundation.getProductUnderstandingEngine();

    const understanding = understandingEngine.getUnderstanding(input.productId);
    if (!understanding?.validated) {
      return this.reject(start, "Complete product understanding required before audio planning", [
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
          storyboardResult.message ?? "Production-ready storyboard required before audio planning",
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
          scriptResult.message ?? "Production-ready script plan required before audio planning",
          scriptResult.diagnostics.length > 0
            ? scriptResult.diagnostics
            : ["Script plan must be validated and production-ready"]
        );
      }
      scriptPlan = scriptResult.record;
    }

    let visualPlan = input.visualPlanId
      ? visualEngine.getVisualPlan(input.visualPlanId)
      : visualEngine
          .getVisualPlansByProduct(input.productId)
          .find((r) => r.storyboardId === storyboard!.storyboardId && r.scriptPlanId === scriptPlan!.scriptPlanId);

    if (!visualPlan?.validated || !visualPlan.productionReady) {
      const visualResult = await visualEngine.createVisualPlan({
        productId: input.productId,
        storyboardId: storyboard.storyboardId,
        scriptPlanId: scriptPlan.scriptPlanId,
        visualPlanId: input.visualPlanId,
        projectId: input.projectId,
      });
      if (!visualResult.success || !visualResult.record) {
        return this.reject(
          start,
          visualResult.message ?? "Production-ready visual plan required before audio planning",
          visualResult.diagnostics.length > 0
            ? visualResult.diagnostics
            : ["Visual plan must be validated and production-ready"]
        );
      }
      visualPlan = visualResult.record;
    }

    const creative = creativeEngine.getCreativeDirection(storyboard.creativeId);
    const strategy = strategyEngine.getStrategy(storyboard.strategyId);
    if (!creative?.validated || !strategy?.validated) {
      return this.reject(start, "Validated creative direction and marketing strategy required", [
        "Upstream creative and strategy records must be validated",
      ]);
    }

    const language = input.language ?? scriptPlan.profile.language ?? "en";
    const existing = input.audioPlanId
      ? this.records.get(input.audioPlanId)
      : this.records
          .getByProduct(input.productId)
          .find((r) => r.storyboardId === storyboard!.storyboardId && r.scriptPlanId === scriptPlan!.scriptPlanId);
    const version = existing ? existing.version + 1 : 1;

    const profile = this.analyzer.buildProfile(input, storyboard, scriptPlan, visualPlan, version, language);
    let sceneAudioPlans = this.analyzer.buildSceneAudioPlans(storyboard, scriptPlan, creative);
    const voicePlanning = this.analyzer.buildVoicePlanning(scriptPlan, creative, storyboard);
    const musicPlanning = this.analyzer.buildMusicPlanning(creative, storyboard);
    const soundEffectPlanning = this.analyzer.buildSoundEffectPlanning(storyboard);
    let synchronization = this.analyzer.buildSynchronization(storyboard, scriptPlan);
    const emotionalFlow = this.analyzer.buildEmotionalFlow(creative, storyboard);
    const platformRules = this.analyzer.buildPlatformRules(storyboard);

    let alignment = this.analyzer.validateAlignment(sceneAudioPlans, storyboard, scriptPlan, visualPlan);
    if (!alignment.aligned) {
      sceneAudioPlans = this.applySceneRepairs(storyboard, scriptPlan, creative);
      synchronization = this.analyzer.buildSynchronization(storyboard, scriptPlan);
      alignment = this.analyzer.validateAlignment(sceneAudioPlans, storyboard, scriptPlan, visualPlan);
    }

    const scores = this.scorer.computeScores(
      sceneAudioPlans,
      voicePlanning,
      musicPlanning,
      synchronization,
      storyboard,
      scriptPlan,
      visualPlan,
      creative,
      strategy
    );
    let validation = this.scorer.isAudioPlanValid(
      scores,
      sceneAudioPlans,
      storyboard,
      scriptPlan,
      visualPlan,
      alignment.issues
    );

    if (!validation.valid) {
      const repaired = this.applyScoreRepairs(sceneAudioPlans);
      if (repaired.length > 0) {
        sceneAudioPlans = repaired;
        const repairedScores = this.scorer.computeScores(
          sceneAudioPlans,
          voicePlanning,
          musicPlanning,
          synchronization,
          storyboard,
          scriptPlan,
          visualPlan,
          creative,
          strategy
        );
        validation = this.scorer.isAudioPlanValid(
          repairedScores,
          sceneAudioPlans,
          storyboard,
          scriptPlan,
          visualPlan,
          this.analyzer.validateAlignment(sceneAudioPlans, storyboard, scriptPlan, visualPlan).issues
        );
        if (validation.valid) {
          Object.assign(scores, repairedScores);
        }
      }
    }

    if (!validation.valid) {
      this.logger.log("warn", "validation", "Audio plan rejected", {
        productId: input.productId,
        diagnostics: validation.diagnostics,
      });
      return {
        success: false,
        durationMs: Date.now() - start,
        diagnostics: validation.diagnostics,
        message:
          "Audio planning validation failed — plan must fully align with storyboard, script, visual plan, brand and strategy",
      };
    }

    const productionReady = this.scorer.isProductionReady(
      sceneAudioPlans,
      storyboard,
      scriptPlan,
      visualPlan,
      scores
    );

    const draft: AudioPlanningRecord = {
      audioPlanId: profile.audioPlanId,
      productId: input.productId,
      projectId: profile.projectId,
      storyboardId: storyboard.storyboardId,
      scriptPlanId: scriptPlan.scriptPlanId,
      visualPlanId: visualPlan.visualPlanId,
      creativeId: creative.creativeId,
      strategyId: strategy.strategyId,
      profile,
      sceneAudioPlans,
      voicePlanning,
      musicPlanning,
      soundEffectPlanning,
      synchronization,
      emotionalFlow,
      platformRules,
      scores,
      relationships: {
        storyboards: [storyboard.storyboardId],
        scriptPlans: [scriptPlan.scriptPlanId],
        visualPlans: [visualPlan.visualPlanId],
        creativeDirections: [creative.creativeId],
        marketingStrategies: [strategy.strategyId],
        brands: [creative.profile.brand],
        languages: [language],
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
      visualPlan,
      creative,
      strategy,
      understanding
    );

    const intelligenceValidation = this.foundation.validateProductIntelligence({
      qualityScore: scores.audioPlanningScore,
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
          changeSummary: `Audio plan v${version} — ${sceneAudioPlans.length} scene audio plans`,
          source: ProductIntelligenceSource.KnowledgeEngine,
        },
      ],
      relationshipLinks: [
        ...draft.relationships.knowledgeRecords,
        ...draft.relationships.storyboards,
        ...draft.relationships.scriptPlans,
        ...draft.relationships.visualPlans,
        ...draft.relationships.creativeDirections,
      ],
      healthStatus: ProductIntelligenceHealthLevel.Good,
    });

    if (!intelligenceValidation.valid) {
      return {
        success: false,
        durationMs: Date.now() - start,
        diagnostics: intelligenceValidation.issues,
        message: "Product intelligence validation failed for audio plan",
      };
    }

    this.records.upsert(draft);

    this.logger.log("info", "audio-planning", "Audio plan prepared", {
      audioPlanId: draft.audioPlanId,
      sceneCount: sceneAudioPlans.length,
      productionReady,
      durationMs: Date.now() - start,
    });

    this.logger.log("info", "synchronization", "Audio synchronization planned", {
      audioPlanId: draft.audioPlanId,
      sceneCount: sceneAudioPlans.length,
      platform: profile.platform,
    });

    this.logger.log("info", "relationship", "Audio planning relationships updated", {
      audioPlanId: draft.audioPlanId,
      relationshipCount: draft.relationships.productionPlans.length,
    });

    this.logger.log("info", "performance", "Audio planning completed", {
      audioPlanId: draft.audioPlanId,
      durationMs: Date.now() - start,
    });

    return { success: true, record: draft, durationMs: Date.now() - start, diagnostics: [] };
  }

  search(query: AudioPlanningSearchQuery): AudioPlanningRecord[] {
    let results = this.records.getAll();

    if (query.audioPlanId) results = results.filter((r) => r.audioPlanId === query.audioPlanId);
    if (query.storyboardId) results = results.filter((r) => r.storyboardId === query.storyboardId);
    if (query.scriptPlanId) results = results.filter((r) => r.scriptPlanId === query.scriptPlanId);
    if (query.visualPlanId) results = results.filter((r) => r.visualPlanId === query.visualPlanId);
    if (query.productId) results = results.filter((r) => r.productId === query.productId);
    if (query.platform) results = results.filter((r) => r.profile.platform === query.platform);
    if (query.campaignGoal) results = results.filter((r) => r.profile.campaignGoal === query.campaignGoal);
    if (query.language) results = results.filter((r) => r.profile.language === query.language);
    if (query.voiceStyle) {
      const styleLower = query.voiceStyle.toLowerCase();
      results = results.filter((r) => r.voicePlanning.voiceStyle.toLowerCase().includes(styleLower));
    }
    if (query.musicStyle) {
      const styleLower = query.musicStyle.toLowerCase();
      results = results.filter((r) => r.musicPlanning.musicStyle.toLowerCase().includes(styleLower));
    }
    if (query.mood) {
      const moodLower = query.mood.toLowerCase();
      results = results.filter((r) => r.musicPlanning.musicMood.toLowerCase().includes(moodLower));
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
          r.audioPlanId.toLowerCase().includes(textLower) ||
          r.musicPlanning.musicMood.toLowerCase().includes(textLower)
      );
    }

    return results.slice(0, query.limit ?? 50);
  }

  private applySceneRepairs(
    storyboard: StoryboardIntelligenceRecord,
    scriptPlan: ScriptPlanningRecord,
    creative: CreativeDirectionRecord
  ): AudioPlanningRecord["sceneAudioPlans"] {
    return this.analyzer.buildSceneAudioPlans(storyboard, scriptPlan, creative);
  }

  private applyScoreRepairs(sceneAudioPlans: AudioPlanningRecord["sceneAudioPlans"]): AudioPlanningRecord["sceneAudioPlans"] {
    const needsRepair = sceneAudioPlans.some((s) => !s.plannedVoiceOver.startsWith("Plan voice-over"));
    if (!needsRepair) return [];
    return sceneAudioPlans.map((plan) => ({
      ...plan,
      plannedVoiceOver: plan.plannedVoiceOver.startsWith("Plan voice-over")
        ? plan.plannedVoiceOver
        : `Plan voice-over: ${plan.scenePurpose} narration`,
    }));
  }

  private reject(start: number, message: string, diagnostics: string[]): AudioPlanningResult {
    this.logger.log("warn", "validation", message, { diagnostics });
    return { success: false, durationMs: Date.now() - start, diagnostics, message };
  }
}
