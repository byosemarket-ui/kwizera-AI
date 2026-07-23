import type { AiAudioGenerationFoundation } from "../audio-generation-foundation/audio-generation-foundation.js";
import {
  AudioGenerationAssetType,
  AudioGenerationHealthLevel,
  AudioGenerationSource,
  AudioGenerationVerificationStatus,
} from "../audio-generation-foundation/types.js";
import { createDefaultGenerationAssetQuality } from "../audio-generation-foundation/audio-generation-asset-registry.js";
import { AmbientAudioGenerationAnalyzer } from "./ambient-audio-generation-analyzer.js";
import { AmbientAudioGenerationLinker } from "./ambient-audio-generation-linker.js";
import { AmbientAudioGenerationLogger } from "./ambient-audio-generation-logger.js";
import { AmbientAudioGenerationScorer } from "./ambient-audio-generation-scorer.js";
import { AmbientAudioGenerationRecordStore } from "./ambient-audio-generation-stores.js";
import {
  AmbientAudioGenerationInput,
  AmbientAudioGenerationRecord,
  AmbientAudioGenerationResult,
  AmbientAudioSearchQuery,
  NatureAmbienceType,
  WeatherType,
} from "./types.js";

export class AmbientAudioGenerationProcessor {
  constructor(
    private readonly foundation: AiAudioGenerationFoundation,
    private readonly analyzer: AmbientAudioGenerationAnalyzer,
    private readonly scorer: AmbientAudioGenerationScorer,
    private readonly linker: AmbientAudioGenerationLinker,
    private readonly records: AmbientAudioGenerationRecordStore,
    private readonly logger: AmbientAudioGenerationLogger
  ) {}

  async generateAmbientPlan(input: AmbientAudioGenerationInput): Promise<AmbientAudioGenerationResult> {
    const start = Date.now();
    this.foundation.setLifecycleGenerating();

    try {
      const context = await this.resolveContext(input);
      if (!context && !input.environmentPrompt && !input.videoId && !input.imageId) {
        return this.reject(start, "Unable to resolve ambient context — provide productId or environment prompt", [
          "Product intelligence pipeline or environment prompt required",
        ]);
      }

      const resolvedContext = context ?? this.analyzer.extractContextFromInput(input);
      const platform = this.analyzer.resolvePlatform(input, resolvedContext);
      const productKey = resolvedContext.productId ?? "standalone";
      const existing = input.productId
        ? this.records.getByProduct(input.productId).find((r) => r.profile.platform === platform)
        : undefined;
      const version = existing ? existing.profile.version + 1 : 1;

      const environmentAnalysis = this.analyzer.analyzeEnvironment(input, resolvedContext);
      const profile = this.analyzer.buildProfile(input, platform, version, resolvedContext, environmentAnalysis);
      const category = profile.environmentCategory;

      const ambientSoundPlan = this.analyzer.buildAmbientSoundPlan(environmentAnalysis, category);
      const urbanAmbiencePlan = this.analyzer.buildUrbanAmbiencePlan(environmentAnalysis, category);
      const indoorAmbiencePlan = this.analyzer.buildIndoorAmbiencePlan(environmentAnalysis, category);
      const weatherAmbiencePlan = this.analyzer.buildWeatherAmbiencePlan(environmentAnalysis);
      const spatialAudioPlan = this.analyzer.buildSpatialAudioPlan(environmentAnalysis);
      const timelinePlan = this.analyzer.buildTimelinePlan(environmentAnalysis, ambientSoundPlan, platform);
      const syncPreparation = this.analyzer.buildSyncPreparation(input, environmentAnalysis, platform);
      const productionInstructions = this.analyzer.buildProductionInstructions(profile, environmentAnalysis, spatialAudioPlan);
      const recommendations = this.analyzer.buildRecommendations(environmentAnalysis, resolvedContext, category);

      const scores = this.scorer.computeScores(
        environmentAnalysis,
        ambientSoundPlan,
        urbanAmbiencePlan,
        indoorAmbiencePlan,
        weatherAmbiencePlan,
        spatialAudioPlan,
        timelinePlan,
        syncPreparation,
        productionInstructions,
        resolvedContext
      );

      const validation = this.scorer.isAmbientPlanValid(scores, {
        environmentAnalysis,
        ambientSoundPlan,
        weatherAmbiencePlan,
        spatialAudioPlan,
        timelinePlan,
        syncPreparation,
      });

      if (!validation.valid) {
        const repaired = this.applySafeRepairs(ambientSoundPlan, weatherAmbiencePlan, spatialAudioPlan, timelinePlan, syncPreparation, validation.diagnostics);
        if (repaired.repaired) {
          this.logger.log("info", "validation", "Safe repairs applied", { repairs: repaired.repairs });
        }
        const revalidation = this.scorer.isAmbientPlanValid(scores, {
          environmentAnalysis,
          ambientSoundPlan,
          weatherAmbiencePlan,
          spatialAudioPlan,
          timelinePlan,
          syncPreparation,
        });
        if (!revalidation.valid) {
          this.logger.log("warn", "validation", "Ambient plan rejected", { diagnostics: revalidation.diagnostics });
          return {
            success: false,
            durationMs: Date.now() - start,
            diagnostics: revalidation.diagnostics,
            message: "Ambient audio validation failed — all validations must pass before approval",
          };
        }
      }

      const productionReady = this.scorer.isProductionReady(scores, {
        ambientPlanId: profile.ambientPlanId,
        profile,
        environmentAnalysis,
        ambientSoundPlan,
        urbanAmbiencePlan,
        indoorAmbiencePlan,
        weatherAmbiencePlan,
        spatialAudioPlan,
        timelinePlan,
        syncPreparation,
        productionInstructions,
        scores,
        relationships: {
          ambientPlans: [],
          soundPlans: [],
          musicPlans: [],
          voicePlans: [],
          products: [],
          brands: [],
          campaigns: [],
          videos: [],
          images: [],
          knowledgeRecords: [],
        },
        recommendations,
        validated: true,
        productionReady: false,
        brandConsistent: false,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      });
      const brandConsistent = this.scorer.isBrandConsistent(resolvedContext, productionInstructions);

      const blueprint = this.foundation.getBlueprintManager().createBlueprint({
        blueprintId: `blueprint-${profile.ambientPlanId}`,
        projectId: profile.projectId,
        name: `Ambient ${profile.environmentCategory} ${platform}`,
      });

      const draft: AmbientAudioGenerationRecord = {
        ambientPlanId: profile.ambientPlanId,
        profile,
        environmentAnalysis,
        ambientSoundPlan,
        urbanAmbiencePlan,
        indoorAmbiencePlan,
        weatherAmbiencePlan,
        spatialAudioPlan,
        timelinePlan,
        syncPreparation,
        productionInstructions,
        blueprintId: blueprint.blueprintId,
        scores,
        relationships: {
          ambientPlans: [profile.ambientPlanId],
          soundPlans: [],
          musicPlans: [],
          voicePlans: [],
          products: [],
          brands: [],
          campaigns: [],
          videos: [],
          images: [],
          knowledgeRecords: [],
        },
        recommendations,
        validated: true,
        productionReady,
        brandConsistent,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      };

      draft.relationships = this.linker.detectRelationships(
        draft,
        input,
        resolvedContext.creative,
        resolvedContext.strategy,
        resolvedContext.understanding
      );

      const generationValidation = this.foundation.validateGeneration({
        qualityScore: scores.environmentalRealismScore,
        confidenceScore: scores.aiConfidenceScore,
        verificationStatus:
          scores.aiConfidenceScore >= 75
            ? AudioGenerationVerificationStatus.Verified
            : AudioGenerationVerificationStatus.Pending,
        source: AudioGenerationSource.ProductionPlan,
        sourceRef: draft.ambientPlanId,
        versionHistory: [
          {
            version,
            timestamp: new Date().toISOString(),
            changeSummary: `Ambient plan v${version} — ${platform} ${category}`,
            source: AudioGenerationSource.ProductionPlan,
          },
        ],
        relationshipLinks: [
          ...draft.relationships.products,
          ...draft.relationships.ambientPlans,
          ...draft.relationships.videos,
        ],
        healthStatus: AudioGenerationHealthLevel.Good,
      });

      if (!generationValidation.valid) {
        return {
          success: false,
          durationMs: Date.now() - start,
          diagnostics: generationValidation.issues,
          message: "Audio generation foundation validation failed for ambient plan",
        };
      }

      this.records.upsert(draft);
      this.registerGenerationAssets(draft);

      this.logger.log("info", "blueprint-generation", "Ambient plan generated", {
        ambientPlanId: draft.ambientPlanId,
        platform,
        productionReady,
        durationMs: Date.now() - start,
      });
      this.logger.log("info", "environment-analysis", "Environment analyzed", {
        ambientPlanId: draft.ambientPlanId,
        category,
        mood: environmentAnalysis.intendedMood,
      });
      this.logger.log("info", "ambient-planning", "Ambient layers planned", {
        ambientPlanId: draft.ambientPlanId,
        nature: ambientSoundPlan.natureAmbience,
      });
      this.logger.log("info", "spatial-planning", "Spatial audio planned", {
        ambientPlanId: draft.ambientPlanId,
        spatialScore: scores.spatialAudioScore,
      });

      if (recommendations.length > 0) {
        this.logger.log("info", "recommendation", "Ambient recommendations", {
          ambientPlanId: draft.ambientPlanId,
          recommendations,
        });
      }

      return { success: true, record: draft, durationMs: Date.now() - start, diagnostics: [] };
    } finally {
      this.foundation.setLifecycleReady();
    }
  }

  search(query: AmbientAudioSearchQuery): AmbientAudioGenerationRecord[] {
    let results = this.records.getAll();

    if (query.ambientPlanId) results = results.filter((r) => r.ambientPlanId === query.ambientPlanId);
    if (query.productId) results = results.filter((r) => r.relationships.products.includes(query.productId!));
    if (query.brandId) results = results.filter((r) => r.profile.brandId === query.brandId);
    if (query.environmentCategory) results = results.filter((r) => r.profile.environmentCategory === query.environmentCategory);
    if (query.platform) results = results.filter((r) => r.profile.platform === query.platform);
    if (query.syncTarget) results = results.filter((r) => r.syncPreparation.syncTarget === query.syncTarget);
    if (query.weather) {
      const w = query.weather.toLowerCase();
      results = results.filter((r) => r.environmentAnalysis.weather.toLowerCase().includes(w));
    }
    if (query.keywords) {
      const kw = query.keywords.toLowerCase();
      results = results.filter(
        (r) =>
          r.environmentAnalysis.keywords.some((k) => k.includes(kw)) ||
          r.environmentAnalysis.location.toLowerCase().includes(kw)
      );
    }
    if (query.text) {
      const textLower = query.text.toLowerCase();
      results = results.filter(
        (r) =>
          r.ambientPlanId.toLowerCase().includes(textLower) ||
          r.profile.environmentCategory.toLowerCase().includes(textLower)
      );
    }

    return results.slice(0, query.limit ?? 50);
  }

  private async resolveContext(input: AmbientAudioGenerationInput) {
    const bridge = this.foundation.integration;
    const productFoundation = bridge.getProductIntelligenceFoundation();

    if (input.productId && productFoundation) {
      const analysis = productFoundation.getProductAnalysisEngine().getProduct(input.productId);
      const understanding = productFoundation.getProductUnderstandingEngine().getUnderstanding(input.productId);
      const creativeRecords = productFoundation.getCreativeDirectionEngine().getCreativeDirectionsByProduct(input.productId);
      const creative = creativeRecords[0] ?? null;
      const strategy = creative
        ? productFoundation.getMarketingStrategyIntelligenceEngine().getStrategy(creative.strategyId)
        : null;

      if (analysis || understanding) {
        return this.analyzer.extractContextFromProduct(
          input.productId,
          analysis?.profile.productName ?? understanding?.identity.productName ?? input.productId,
          analysis?.profile.brand ?? understanding?.identity.brand ?? input.brandName ?? "Brand",
          understanding,
          creative,
          strategy,
          input
        );
      }
    }

    if (input.environmentPrompt || input.videoId || input.imageId || input.brandGuidelines) {
      return this.analyzer.extractContextFromInput(input);
    }

    return null;
  }

  private registerGenerationAssets(record: AmbientAudioGenerationRecord): void {
    this.foundation.getAssetRegistry().registerAsset({
      assetId: record.ambientPlanId,
      assetType: AudioGenerationAssetType.AmbientSound,
      assetName: `Ambient Plan ${record.profile.environmentCategory} v${record.profile.version}`,
      projectId: record.profile.projectId,
      ...createDefaultGenerationAssetQuality(AudioGenerationSource.ProductionPlan),
      qualityScore: record.scores.environmentalRealismScore,
      confidenceScore: record.scores.aiConfidenceScore,
      relationshipLinks: [...record.relationships.ambientPlans, ...record.relationships.products],
      relatedProducts: record.relationships.products,
      relatedBrands: record.relationships.brands,
      relatedCampaigns: record.relationships.campaigns,
      relatedKnowledge: record.relationships.knowledgeRecords,
    });

    this.foundation.getAssetRegistry().registerAsset({
      assetId: `spatial-${record.ambientPlanId}`,
      assetType: AudioGenerationAssetType.Template,
      assetName: `Spatial Audio Blueprint ${record.profile.environmentCategory}`,
      projectId: record.profile.projectId,
      ...createDefaultGenerationAssetQuality(AudioGenerationSource.ProductionPlan),
      qualityScore: record.scores.spatialAudioScore,
      confidenceScore: record.scores.aiConfidenceScore,
      relationshipLinks: [record.ambientPlanId],
      relatedProducts: record.relationships.products,
    });
  }

  private applySafeRepairs(
    ambient: { natureAmbience: NatureAmbienceType[]; layers: Record<string, string> },
    weather: { weatherTypes: WeatherType[]; weatherLayers: Record<string, string> },
    spatial: { surroundPreparation: string },
    timeline: { cuePoints: { timeSec: number; label: string; layer: string }[] },
    sync: { hitPoints: string[] },
    diagnostics: string[]
  ): { repaired: boolean; repairs: string[] } {
    const repairs: string[] = [];

    if (diagnostics.some((d) => d.includes("Ambient sound"))) {
      if (ambient.natureAmbience.length < 1) {
        ambient.natureAmbience.push(NatureAmbienceType.Wind);
        ambient.layers[NatureAmbienceType.Wind] = "default wind layer";
        repairs.push("Default nature ambience applied");
      }
    }
    if (diagnostics.some((d) => d.includes("Weather"))) {
      if (weather.weatherTypes.length < 1) {
        weather.weatherTypes.push(WeatherType.Dawn);
        weather.weatherLayers[WeatherType.Dawn] = "default weather layer";
        repairs.push("Default weather layer applied");
      }
    }
    if (diagnostics.some((d) => d.includes("Spatial"))) {
      if (!spatial.surroundPreparation) {
        (spatial as { surroundPreparation: string }).surroundPreparation = "Default stereo surround bed";
        repairs.push("Default spatial preparation applied");
      }
    }
    if (diagnostics.some((d) => d.includes("Timeline"))) {
      if (timeline.cuePoints.length < 3) {
        timeline.cuePoints.push(
          { timeSec: 0, label: "Start", layer: "fade-in" },
          { timeSec: 30, label: "Sustain", layer: "bed" },
          { timeSec: 60, label: "End", layer: "fade-out" }
        );
        repairs.push("Default timeline cue points applied");
      }
    }
    if (diagnostics.some((d) => d.includes("Sync"))) {
      if (sync.hitPoints.length < 1) sync.hitPoints.push("Ambient entry at 0s");
      repairs.push("Default sync hit point applied");
    }

    return { repaired: repairs.length > 0, repairs };
  }

  private reject(start: number, message: string, diagnostics: string[]): AmbientAudioGenerationResult {
    this.logger.log("warn", "validation", message, { diagnostics });
    return { success: false, durationMs: Date.now() - start, diagnostics, message };
  }
}
