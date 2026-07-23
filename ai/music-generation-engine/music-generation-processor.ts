import type { AiAudioGenerationFoundation } from "../audio-generation-foundation/audio-generation-foundation.js";
import {
  AudioGenerationAssetType,
  AudioGenerationHealthLevel,
  AudioGenerationSource,
  AudioGenerationVerificationStatus,
} from "../audio-generation-foundation/types.js";
import { createDefaultGenerationAssetQuality } from "../audio-generation-foundation/audio-generation-asset-registry.js";
import { MusicGenerationAnalyzer } from "./music-generation-analyzer.js";
import { MusicGenerationLinker } from "./music-generation-linker.js";
import { MusicGenerationLogger } from "./music-generation-logger.js";
import { MusicGenerationScorer } from "./music-generation-scorer.js";
import { MusicGenerationRecordStore } from "./music-generation-stores.js";
import {
  MusicGenerationInput,
  MusicGenerationRecord,
  MusicGenerationResult,
  MusicSearchQuery,
} from "./types.js";

export class MusicGenerationProcessor {
  constructor(
    private readonly foundation: AiAudioGenerationFoundation,
    private readonly analyzer: MusicGenerationAnalyzer,
    private readonly scorer: MusicGenerationScorer,
    private readonly linker: MusicGenerationLinker,
    private readonly records: MusicGenerationRecordStore,
    private readonly logger: MusicGenerationLogger
  ) {}

  async generateMusicPlan(input: MusicGenerationInput): Promise<MusicGenerationResult> {
    const start = Date.now();
    this.foundation.setLifecycleGenerating();

    try {
      const context = await this.resolveContext(input);
      if (!context && !input.musicPrompt && !input.videoId && !input.imageId) {
        return this.reject(start, "Unable to resolve music context — provide productId or music prompt", [
          "Product intelligence pipeline or music prompt required",
        ]);
      }

      const resolvedContext = context ?? this.analyzer.extractContextFromInput(input);
      const platform = this.analyzer.resolvePlatform(input, resolvedContext);
      const productKey = resolvedContext.productId ?? "standalone";
      const existing = input.productId
        ? this.records.getByProduct(input.productId).find((r) => r.profile.platform === platform)
        : undefined;
      const version = existing ? existing.profile.version + 1 : 1;

      const musicAnalysis = this.analyzer.analyzeMusic(input, resolvedContext);
      const profile = this.analyzer.buildProfile(input, platform, version, resolvedContext, musicAnalysis);
      const compositionPlan = this.analyzer.buildCompositionPlan(musicAnalysis, resolvedContext);
      const arrangementPlan = this.analyzer.buildArrangementPlan(musicAnalysis);
      const moodPlan = this.analyzer.buildMoodPlan(input, musicAnalysis, resolvedContext);
      const syncPreparation = this.analyzer.buildSyncPreparation(input, musicAnalysis, platform);
      const loopPlan = this.analyzer.buildLoopPlan(input, musicAnalysis);
      const productionInstructions = this.analyzer.buildProductionInstructions(
        profile,
        musicAnalysis,
        arrangementPlan
      );
      const recommendations = this.analyzer.buildRecommendations(musicAnalysis, moodPlan, resolvedContext);

      const scores = this.scorer.computeScores(
        musicAnalysis,
        compositionPlan,
        arrangementPlan,
        moodPlan,
        syncPreparation,
        productionInstructions,
        resolvedContext
      );

      const validation = this.scorer.isMusicPlanValid(scores, {
        musicAnalysis,
        compositionPlan,
        arrangementPlan,
        moodPlan,
        syncPreparation,
      });

      if (!validation.valid) {
        const repaired = this.applySafeRepairs(
          compositionPlan,
          arrangementPlan,
          moodPlan,
          syncPreparation,
          validation.diagnostics
        );
        if (repaired.repaired) {
          this.logger.log("info", "validation", "Safe repairs applied", { repairs: repaired.repairs });
        }
        const revalidation = this.scorer.isMusicPlanValid(scores, {
          musicAnalysis,
          compositionPlan,
          arrangementPlan,
          moodPlan,
          syncPreparation,
        });
        if (!revalidation.valid) {
          this.logger.log("warn", "validation", "Music plan rejected", { diagnostics: revalidation.diagnostics });
          return {
            success: false,
            durationMs: Date.now() - start,
            diagnostics: revalidation.diagnostics,
            message: "Music generation validation failed — all validations must pass before approval",
          };
        }
      }

      const productionReady = this.scorer.isProductionReady(scores, {
        musicPlanId: profile.musicPlanId,
        profile,
        musicAnalysis,
        compositionPlan,
        arrangementPlan,
        moodPlan,
        syncPreparation,
        loopPlan,
        productionInstructions,
        scores,
        relationships: {
          musicPlans: [],
          products: [],
          brands: [],
          campaigns: [],
          videos: [],
          images: [],
          voicePlans: [],
          knowledgeRecords: [],
        },
        recommendations,
        validated: true,
        productionReady: false,
        brandConsistent: false,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      });
      const brandConsistent = this.scorer.isBrandConsistent(resolvedContext, moodPlan);

      const blueprint = this.foundation.getBlueprintManager().createBlueprint({
        blueprintId: `blueprint-${profile.musicPlanId}`,
        projectId: profile.projectId,
        name: `Music ${profile.genre} ${platform}`,
      });

      const draft: MusicGenerationRecord = {
        musicPlanId: profile.musicPlanId,
        profile,
        musicAnalysis,
        compositionPlan,
        arrangementPlan,
        moodPlan,
        syncPreparation,
        loopPlan,
        productionInstructions,
        blueprintId: blueprint.blueprintId,
        scores,
        relationships: {
          musicPlans: [profile.musicPlanId],
          products: [],
          brands: [],
          campaigns: [],
          videos: [],
          images: [],
          voicePlans: [],
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
        qualityScore: scores.compositionScore,
        confidenceScore: scores.aiConfidenceScore,
        verificationStatus:
          scores.aiConfidenceScore >= 75
            ? AudioGenerationVerificationStatus.Verified
            : AudioGenerationVerificationStatus.Pending,
        source: AudioGenerationSource.ProductionPlan,
        sourceRef: draft.musicPlanId,
        versionHistory: [
          {
            version,
            timestamp: new Date().toISOString(),
            changeSummary: `Music plan v${version} — ${platform} ${musicAnalysis.genre}`,
            source: AudioGenerationSource.ProductionPlan,
          },
        ],
        relationshipLinks: [
          ...draft.relationships.products,
          ...draft.relationships.musicPlans,
          ...draft.relationships.videos,
        ],
        healthStatus: AudioGenerationHealthLevel.Good,
      });

      if (!generationValidation.valid) {
        return {
          success: false,
          durationMs: Date.now() - start,
          diagnostics: generationValidation.issues,
          message: "Audio generation foundation validation failed for music plan",
        };
      }

      this.records.upsert(draft);
      this.registerGenerationAssets(draft);

      this.logger.log("info", "blueprint-generation", "Music plan generated", {
        musicPlanId: draft.musicPlanId,
        platform,
        productionReady,
        durationMs: Date.now() - start,
      });
      this.logger.log("info", "music-analysis", "Music analyzed", {
        musicPlanId: draft.musicPlanId,
        genre: musicAnalysis.genre,
        mood: musicAnalysis.mood,
      });
      this.logger.log("info", "composition-planning", "Composition planned", {
        musicPlanId: draft.musicPlanId,
        sections: ["intro", "verse", "chorus", "bridge", "outro"],
      });
      this.logger.log("info", "arrangement-planning", "Arrangement planned", {
        musicPlanId: draft.musicPlanId,
        instruments: arrangementPlan.activeInstruments,
      });
      this.logger.log("info", "mood-planning", "Mood planned", {
        musicPlanId: draft.musicPlanId,
        primaryMood: moodPlan.primaryMood,
      });

      if (recommendations.length > 0) {
        this.logger.log("info", "recommendation", "Music recommendations", {
          musicPlanId: draft.musicPlanId,
          recommendations,
        });
      }

      return { success: true, record: draft, durationMs: Date.now() - start, diagnostics: [] };
    } finally {
      this.foundation.setLifecycleReady();
    }
  }

  search(query: MusicSearchQuery): MusicGenerationRecord[] {
    let results = this.records.getAll();

    if (query.musicPlanId) results = results.filter((r) => r.musicPlanId === query.musicPlanId);
    if (query.productId) results = results.filter((r) => r.relationships.products.includes(query.productId!));
    if (query.brandId) results = results.filter((r) => r.profile.brandId === query.brandId);
    if (query.genre) results = results.filter((r) => r.profile.genre === query.genre);
    if (query.mood) results = results.filter((r) => r.profile.mood === query.mood);
    if (query.platform) results = results.filter((r) => r.profile.platform === query.platform);
    if (query.syncTarget) results = results.filter((r) => r.syncPreparation.syncTarget === query.syncTarget);
    if (query.keywords) {
      const kw = query.keywords.toLowerCase();
      results = results.filter(
        (r) =>
          r.musicAnalysis.keywords.some((k) => k.includes(kw)) ||
          r.moodPlan.brandMoodAlignment.toLowerCase().includes(kw)
      );
    }
    if (query.text) {
      const textLower = query.text.toLowerCase();
      results = results.filter(
        (r) =>
          r.musicPlanId.toLowerCase().includes(textLower) ||
          r.profile.genre.toLowerCase().includes(textLower)
      );
    }

    return results.slice(0, query.limit ?? 50);
  }

  private async resolveContext(input: MusicGenerationInput) {
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

    if (input.musicPrompt || input.videoId || input.imageId || input.brandGuidelines) {
      return this.analyzer.extractContextFromInput(input);
    }

    return null;
  }

  private registerGenerationAssets(record: MusicGenerationRecord): void {
    this.foundation.getAssetRegistry().registerAsset({
      assetId: record.musicPlanId,
      assetType: AudioGenerationAssetType.Music,
      assetName: `Music Plan ${record.profile.genre} v${record.profile.version}`,
      projectId: record.profile.projectId,
      ...createDefaultGenerationAssetQuality(AudioGenerationSource.ProductionPlan),
      qualityScore: record.scores.compositionScore,
      confidenceScore: record.scores.aiConfidenceScore,
      relationshipLinks: [...record.relationships.musicPlans, ...record.relationships.products],
      relatedProducts: record.relationships.products,
      relatedBrands: record.relationships.brands,
      relatedCampaigns: record.relationships.campaigns,
      relatedKnowledge: record.relationships.knowledgeRecords,
    });

    if (record.relationships.videos.length > 0) {
      for (const videoId of record.relationships.videos) {
        this.foundation.getAssetRegistry().registerAsset({
          assetId: `music-link-${record.musicPlanId}-${videoId}`,
          assetType: AudioGenerationAssetType.AudioTrack,
          assetName: `Music-Video Link ${record.profile.platform}`,
          projectId: record.profile.projectId,
          trackId: record.musicPlanId,
          ...createDefaultGenerationAssetQuality(AudioGenerationSource.ProductionPlan),
          qualityScore: record.scores.productionReadinessScore,
          confidenceScore: record.scores.aiConfidenceScore,
          relationshipLinks: [record.musicPlanId, videoId],
          relatedProducts: record.relationships.products,
        });
      }
    }

    this.foundation.getAssetRegistry().registerAsset({
      assetId: `composition-${record.musicPlanId}`,
      assetType: AudioGenerationAssetType.Template,
      assetName: `Composition Blueprint ${record.profile.genre} v${record.profile.version}`,
      projectId: record.profile.projectId,
      ...createDefaultGenerationAssetQuality(AudioGenerationSource.ProductionPlan),
      qualityScore: record.scores.harmonyScore,
      confidenceScore: record.scores.aiConfidenceScore,
      relationshipLinks: [record.musicPlanId],
      relatedProducts: record.relationships.products,
    });
  }

  private applySafeRepairs(
    composition: { intro: string; chorus: string; chordProgression: string[]; melodyStructure: string[] },
    arrangement: { activeInstruments: string[] },
    moodPlan: { emotionalArc: string[] },
    syncPlan: { hitPoints: string[] },
    diagnostics: string[]
  ): { repaired: boolean; repairs: string[] } {
    const repairs: string[] = [];

    if (diagnostics.some((d) => d.includes("Composition structure"))) {
      if (!composition.intro) composition.intro = "8-bar intro";
      if (!composition.chorus) composition.chorus = "16-bar chorus";
      repairs.push("Default composition sections applied");
    }
    if (diagnostics.some((d) => d.includes("Chord progression"))) {
      if (composition.chordProgression.length < 2) {
        composition.chordProgression.push("I - V - vi - IV", "vi - IV - I - V");
        repairs.push("Default chord progression applied");
      }
    }
    if (diagnostics.some((d) => d.includes("Arrangement"))) {
      if (arrangement.activeInstruments.length < 2) {
        arrangement.activeInstruments.push("piano", "percussion");
        repairs.push("Default arrangement instruments applied");
      }
    }
    if (diagnostics.some((d) => d.includes("Mood planning"))) {
      if (moodPlan.emotionalArc.length < 3) {
        moodPlan.emotionalArc.push("Intro", "Build", "Resolve");
        repairs.push("Default emotional arc applied");
      }
    }
    if (diagnostics.some((d) => d.includes("Sync preparation"))) {
      if (syncPlan.hitPoints.length < 2) {
        syncPlan.hitPoints.push("Bar 1: entry", "Bar 9: section change");
        repairs.push("Default sync hit points applied");
      }
    }

    return { repaired: repairs.length > 0, repairs };
  }

  private reject(start: number, message: string, diagnostics: string[]): MusicGenerationResult {
    this.logger.log("warn", "validation", message, { diagnostics });
    return { success: false, durationMs: Date.now() - start, diagnostics, message };
  }
}
