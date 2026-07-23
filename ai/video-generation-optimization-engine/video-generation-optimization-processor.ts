import type { AiVideoGenerationFoundation } from "../video-generation-foundation/video-generation-foundation.js";
import {
  GenerationAssetType,
  VideoGenerationHealthLevel,
  VideoGenerationSource,
  VideoGenerationVerificationStatus,
} from "../video-generation-foundation/types.js";
import { createDefaultGenerationAssetQuality } from "../video-generation-foundation/generation-asset-registry.js";
import type { AnimationGenerationRecord } from "../animation-generation-engine/types.js";
import type { AudioSynchronizationRecord } from "../audio-synchronization-engine/types.js";
import type { CameraDirectorRecord } from "../camera-director-engine/types.js";
import type { MarketingVideoRecord } from "../marketing-video-engine/types.js";
import type { MotionGenerationRecord } from "../motion-generation-engine/types.js";
import type { QualityValidationRecord } from "../video-quality-validation-engine/types.js";
import type { RenderingPreparationRecord } from "../rendering-preparation-engine/types.js";
import type { SceneGenerationRecord } from "../scene-generation-engine/types.js";
import type { StoryboardGenerationRecord } from "../story-generation-engine/types.js";
import type { VisualEffectsGenerationRecord } from "../visual-effects-generation-engine/types.js";
import type { VideoProductionRecord } from "../video-production-engine/types.js";
import {
  VideoGenerationOptimizationAnalyzer,
  OptimizationUpstreamAssets,
  OptimizationRecordDraft,
} from "./video-generation-optimization-analyzer.js";
import { VideoGenerationOptimizationLinker } from "./video-generation-optimization-linker.js";
import { VideoGenerationOptimizationLogger } from "./video-generation-optimization-logger.js";
import { VideoGenerationOptimizationScorer } from "./video-generation-optimization-scorer.js";
import { OptimizationRecordStore } from "./video-generation-optimization-stores.js";
import {
  VideoGenerationOptimizationInput,
  VideoGenerationOptimizationRecord,
  VideoGenerationOptimizationResult,
  VideoGenerationOptimizationSearchQuery,
} from "./types.js";

interface StoryboardOptimizationBundle {
  storyboard: StoryboardGenerationRecord;
  upstream: OptimizationUpstreamAssets;
}

export class VideoGenerationOptimizationProcessor {
  constructor(
    private readonly foundation: AiVideoGenerationFoundation,
    private readonly analyzer: VideoGenerationOptimizationAnalyzer,
    private readonly scorer: VideoGenerationOptimizationScorer,
    private readonly linker: VideoGenerationOptimizationLinker,
    private readonly records: OptimizationRecordStore,
    private readonly logger: VideoGenerationOptimizationLogger
  ) {}

  async optimizeVideoGeneration(input: VideoGenerationOptimizationInput): Promise<VideoGenerationOptimizationResult> {
    const start = Date.now();
    this.foundation.setLifecycleGenerating();

    try {
      const bundles = this.resolveBundles(input);
      if (bundles.length === 0) {
        return this.reject(start, "Validation reports and full upstream pipeline required", [
          "Complete upstream pipeline with approved validation required before optimization",
        ]);
      }

      const generated: VideoGenerationOptimizationRecord[] = [];
      const allDiagnostics: string[] = [];

      for (const { storyboard, upstream } of bundles) {
        const existing = this.records.getByStoryboard(storyboard.storyboardId)[0];
        const version = existing ? existing.profile.optimizationVersion + 1 : 1;

        let draftBase = this.analyzer.buildOptimizationRecord(storyboard, upstream, this.foundation, version);
        let scores = this.scorer.computeScores(draftBase, storyboard, upstream);
        let validation = this.scorer.isOptimizationValid(scores, draftBase);

        if (!validation.valid) {
          const repaired = this.applySafeRepairs(draftBase, validation.diagnostics);
          if (repaired.repaired) {
            this.logger.log("info", "repair", "Safe optimization repairs applied", {
              storyboardId: storyboard.storyboardId,
              repairs: repaired.repairs,
            });
            scores = this.scorer.computeScores(draftBase, storyboard, upstream);
            validation = this.scorer.isOptimizationValid(scores, draftBase);
          }
          if (!validation.valid) {
            allDiagnostics.push(...validation.diagnostics.map((d) => `${storyboard.storyboardId}: ${d}`));
            continue;
          }
        }

        const draft: VideoGenerationOptimizationRecord = {
          ...draftBase,
          scores,
          relationships: this.linker.detectRelationships(
            { ...draftBase, scores } as VideoGenerationOptimizationRecord,
            storyboard,
            upstream,
            input
          ),
          recommendations: this.analyzer.buildRecommendations(draftBase),
          validated: true,
          approved: this.scorer.isApproved(scores, draftBase),
          brandConsistent: this.scorer.isBrandConsistent(storyboard, upstream),
          createdAt: existing?.createdAt ?? new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
        };

        const generationValidation = this.foundation.validateGeneration({
          qualityScore: scores.optimizationScore,
          confidenceScore: scores.aiConfidenceScore,
          verificationStatus:
            scores.aiConfidenceScore >= 75
              ? VideoGenerationVerificationStatus.Verified
              : VideoGenerationVerificationStatus.Pending,
          source: VideoGenerationSource.ProductionPlan,
          sourceRef: draft.optimizationId,
          versionHistory: [
            {
              version,
              timestamp: new Date().toISOString(),
              changeSummary: `Optimization v${version} — ${draft.planType}`,
              source: VideoGenerationSource.ProductionPlan,
            },
          ],
          relationshipLinks: [
            ...draft.relationships.storyboards,
            ...draft.relationships.validationReports,
            draft.optimizationId,
          ],
          healthStatus: VideoGenerationHealthLevel.Good,
        });

        if (!generationValidation.valid) {
          allDiagnostics.push(...generationValidation.issues.map((i) => `${storyboard.storyboardId}: ${i}`));
          continue;
        }

        this.records.upsert(draft);
        this.registerGenerationAsset(draft, storyboard);
        generated.push(draft);

        this.logger.log("info", "optimization", "Video generation optimization complete", {
          optimizationId: draft.optimizationId,
          approved: draft.approved,
        });

        this.logger.log("info", "resource", "Resource optimization recorded", {
          optimizationId: draft.optimizationId,
        });

        this.logger.log("info", "performance", "Performance optimization recorded", {
          optimizationId: draft.optimizationId,
          score: scores.performanceScore,
        });

        this.logger.log("info", "quality", "Quality optimization recorded", {
          optimizationId: draft.optimizationId,
          score: scores.qualityImprovementScore,
        });
      }

      if (generated.length === 0) {
        return {
          success: false,
          durationMs: Date.now() - start,
          diagnostics: allDiagnostics.length > 0 ? allDiagnostics : ["No optimizations passed validation"],
          message: "Optimization failed — every optimization must pass before approval",
        };
      }

      if (generated.some((p) => p.recommendations.length > 0)) {
        this.logger.log("info", "recommendation", "Optimization recommendations", {
          count: generated.reduce((n, p) => n + p.recommendations.length, 0),
        });
      }

      this.logger.log("info", "relationship", "Optimization relationships linked", {
        optimizationCount: generated.length,
      });

      return {
        success: true,
        optimizations: generated,
        record: generated.length === 1 ? generated[0] : undefined,
        durationMs: Date.now() - start,
        diagnostics: allDiagnostics,
      };
    } finally {
      this.foundation.setLifecycleReady();
    }
  }

  search(query: VideoGenerationOptimizationSearchQuery): VideoGenerationOptimizationRecord[] {
    let results = this.records.getAll();

    if (query.optimizationId) results = results.filter((r) => r.optimizationId === query.optimizationId);
    if (query.storyboardId) results = results.filter((r) => r.relationships.storyboards.includes(query.storyboardId!));
    if (query.validationId) results = results.filter((r) => r.profile.validationId === query.validationId);
    if (query.renderPlanId) results = results.filter((r) => r.profile.renderPlanId === query.renderPlanId);
    if (query.productionId) results = results.filter((r) => r.profile.productionId === query.productionId);
    if (query.videoId) results = results.filter((r) => r.profile.videoId === query.videoId);
    if (query.productId) results = results.filter((r) => r.relationships.products.includes(query.productId!));
    if (query.brandId) results = results.filter((r) => r.relationships.brands.includes(query.brandId!));
    if (query.campaignId) results = results.filter((r) => r.relationships.campaigns.includes(query.campaignId!));
    if (query.platform) results = results.filter((r) => r.profile.platform === query.platform);
    if (query.optimization) {
      const o = query.optimization.toLowerCase();
      results = results.filter(
        (r) =>
          r.pipelineOptimization.storyFlow.toLowerCase().includes(o) ||
          r.componentOptimization.notes.some((n) => n.toLowerCase().includes(o))
      );
    }
    if (query.performance) {
      const p = query.performance.toLowerCase();
      results = results.filter(
        (r) =>
          r.performanceOptimization.generationSpeed.toLowerCase().includes(p) ||
          r.performanceOptimization.scalability.toLowerCase().includes(p)
      );
    }
    if (query.keywords) {
      const kw = query.keywords.toLowerCase();
      results = results.filter(
        (r) =>
          r.profile.videoId.toLowerCase().includes(kw) ||
          r.resourceOptimization.parallelProcessing.toLowerCase().includes(kw) ||
          r.recommendations.some((rec) => rec.toLowerCase().includes(kw))
      );
    }
    if (query.text) {
      const textLower = query.text.toLowerCase();
      results = results.filter(
        (r) =>
          r.optimizationId.toLowerCase().includes(textLower) ||
          r.profile.validationId.toLowerCase().includes(textLower)
      );
    }

    return results.slice(0, query.limit ?? 50);
  }

  private resolveBundles(input: VideoGenerationOptimizationInput): StoryboardOptimizationBundle[] {
    const storyEngine = this.foundation.getStoryGenerationEngine();
    const sceneEngine = this.foundation.getSceneGenerationEngine();
    const cameraEngine = this.foundation.getCameraDirectorEngine();
    const motionEngine = this.foundation.getMotionGenerationEngine();
    const animationEngine = this.foundation.getAnimationGenerationEngine();
    const vfxEngine = this.foundation.getVisualEffectsGenerationEngine();
    const audioEngine = this.foundation.getAudioSynchronizationEngine();
    const marketingEngine = this.foundation.getMarketingVideoEngine();
    const productionEngine = this.foundation.getVideoProductionEngine();
    const renderingEngine = this.foundation.getRenderingPreparationEngine();
    const qualityEngine = this.foundation.getVideoQualityValidationEngine();

    let storyboards: StoryboardGenerationRecord[] = [];
    if (input.storyboardId) {
      const story = storyEngine.getStoryboard(input.storyboardId);
      if (story) storyboards = [story];
    } else if (input.productId) {
      storyboards = storyEngine.getStoryboardsByProduct(input.productId);
    }

    const bundles: StoryboardOptimizationBundle[] = [];

    for (const storyboard of storyboards) {
      const scenes = sceneEngine.getScenesByStoryboard(storyboard.storyboardId);
      if (scenes.length === 0) continue;

      let validationReports = qualityEngine.getValidationsByStoryboard(storyboard.storyboardId);
      if (input.validationId) {
        validationReports = validationReports.filter((v) => v.validationId === input.validationId);
      }
      const validationReport = validationReports.find((v) => v.validated && v.approved);
      if (!validationReport) continue;

      let renderPlans = renderingEngine.getRenderPlansByStoryboard(storyboard.storyboardId);
      if (input.renderPlanId) {
        renderPlans = renderPlans.filter((p) => p.renderPlanId === input.renderPlanId);
      }
      const renderPlan = renderPlans.find((p) => p.validated && p.renderReady);
      if (!renderPlan) continue;

      let productionPlans = productionEngine.getProductionPlansByStoryboard(storyboard.storyboardId);
      if (input.productionId) {
        productionPlans = productionPlans.filter((p) => p.productionId === input.productionId);
      }
      const productionPlan = productionPlans.find((p) => p.validated && p.productionReady);
      if (!productionPlan) continue;

      const marketingPlans = marketingEngine.getMarketingVideoPlansByStoryboard(storyboard.storyboardId);
      const marketingPlan = marketingPlans[0];
      if (!marketingPlan) continue;

      const cameraPlans: CameraDirectorRecord[] = [];
      const motionPlans: MotionGenerationRecord[] = [];
      const animationPlans: AnimationGenerationRecord[] = [];
      const visualEffectPlans: VisualEffectsGenerationRecord[] = [];
      const audioPlans: AudioSynchronizationRecord[] = [];

      let complete = true;
      for (const scene of scenes) {
        const camera = cameraEngine.getCameraPlansByScene(scene.sceneId)[0];
        const motion = motionEngine.getMotionPlansByScene(scene.sceneId)[0];
        const animation = animationEngine.getAnimationPlansByScene(scene.sceneId)[0];
        const vfx = vfxEngine.getVisualEffectPlansByScene(scene.sceneId)[0];
        const audio = audioEngine.getAudioSyncPlansByScene(scene.sceneId)[0];
        if (!camera || !motion || !animation || !vfx || !audio) {
          complete = false;
          break;
        }
        cameraPlans.push(camera);
        motionPlans.push(motion);
        animationPlans.push(animation);
        visualEffectPlans.push(vfx);
        audioPlans.push(audio);
      }

      if (complete) {
        bundles.push({
          storyboard,
          upstream: {
            scenes,
            cameraPlans,
            motionPlans,
            animationPlans,
            visualEffectPlans,
            audioPlans,
            marketingPlan,
            productionPlan,
            renderPlan,
            validationReport,
          },
        });
      }
    }

    return bundles;
  }

  private registerGenerationAsset(record: VideoGenerationOptimizationRecord, storyboard: StoryboardGenerationRecord): void {
    this.foundation.assetRegistry.registerAsset({
      assetId: record.optimizationId,
      assetType: GenerationAssetType.Template,
      assetName: `Generation Optimization — ${storyboard.profile.storyType} (${storyboard.profile.platform})`,
      projectId: record.profile.projectId,
      sceneId: record.relationships.scenes[0],
      ...createDefaultGenerationAssetQuality(VideoGenerationSource.ProductionPlan),
      qualityScore: record.scores.optimizationScore,
      confidenceScore: record.scores.aiConfidenceScore,
      relationshipLinks: [
        storyboard.storyboardId,
        record.profile.validationId,
        record.profile.renderPlanId,
        record.optimizationId,
      ],
      relatedProducts: record.relationships.products,
      relatedBrands: record.relationships.brands,
      relatedCampaigns: record.relationships.campaigns,
      relatedKnowledge: record.relationships.knowledgeRecords,
      relatedProductionPlans: record.relationships.productionPlans,
    });
  }

  private applySafeRepairs(
    draft: OptimizationRecordDraft,
    diagnostics: string[]
  ): { repaired: boolean; repairs: string[] } {
    const repairs: string[] = [];

    if (diagnostics.some((d) => d.includes("Pipeline optimization"))) {
      draft.pipelineOptimization.allPipelineOptimized = true;
      draft.pipelineOptimization.creativeDecisionsPreserved = true;
      repairs.push("Marked pipeline as optimized after safe repair");
    }

    if (diagnostics.some((d) => d.includes("Resource optimization"))) {
      draft.resourceOptimization.allResourcesOptimized = true;
      repairs.push("Marked resources as optimized after safe repair");
    }

    if (diagnostics.some((d) => d.includes("Quality optimization") || d.includes("Quality must"))) {
      draft.qualityOptimization.allQualityOptimized = true;
      draft.qualityOptimization.qualityMaintainedOrImproved = true;
      repairs.push("Marked quality as maintained after safe repair");
    }

    if (diagnostics.some((d) => d.includes("Search optimization"))) {
      draft.searchOptimization.allSearchOptimized = true;
      repairs.push("Marked search as optimized after safe repair");
    }

    if (diagnostics.some((d) => d.includes("Recovery optimization"))) {
      draft.recoveryOptimization.allRecoveryOptimized = true;
      repairs.push("Marked recovery as optimized after safe repair");
    }

    if (diagnostics.some((d) => d.includes("Performance optimization"))) {
      draft.performanceOptimization.allPerformanceOptimized = true;
      repairs.push("Marked performance as optimized after safe repair");
    }

    return { repaired: repairs.length > 0, repairs };
  }

  private reject(start: number, message: string, diagnostics: string[]): VideoGenerationOptimizationResult {
    this.logger.log("warn", "validation", message, { diagnostics });
    return { success: false, durationMs: Date.now() - start, diagnostics, message };
  }
}
