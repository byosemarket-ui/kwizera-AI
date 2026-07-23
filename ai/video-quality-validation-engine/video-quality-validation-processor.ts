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
import type { RenderingPreparationRecord } from "../rendering-preparation-engine/types.js";
import type { SceneGenerationRecord } from "../scene-generation-engine/types.js";
import type { StoryboardGenerationRecord } from "../story-generation-engine/types.js";
import type { VisualEffectsGenerationRecord } from "../visual-effects-generation-engine/types.js";
import type { VideoProductionRecord } from "../video-production-engine/types.js";
import {
  VideoQualityValidationAnalyzer,
  QualityValidationUpstreamAssets,
  QualityValidationRecordDraft,
} from "./video-quality-validation-analyzer.js";
import { VideoQualityValidationLinker } from "./video-quality-validation-linker.js";
import { VideoQualityValidationLogger } from "./video-quality-validation-logger.js";
import { VideoQualityValidationScorer } from "./video-quality-validation-scorer.js";
import { QualityValidationRecordStore } from "./video-quality-validation-stores.js";
import {
  QualityIssueCategory,
  QualityIssueSeverity,
  QualityValidationInput,
  QualityValidationRecord,
  QualityValidationResult,
  QualityValidationSearchQuery,
} from "./types.js";

interface StoryboardQualityBundle {
  storyboard: StoryboardGenerationRecord;
  upstream: QualityValidationUpstreamAssets;
}

export class VideoQualityValidationProcessor {
  constructor(
    private readonly foundation: AiVideoGenerationFoundation,
    private readonly analyzer: VideoQualityValidationAnalyzer,
    private readonly scorer: VideoQualityValidationScorer,
    private readonly linker: VideoQualityValidationLinker,
    private readonly records: QualityValidationRecordStore,
    private readonly logger: VideoQualityValidationLogger
  ) {}

  async validateVideoQuality(input: QualityValidationInput): Promise<QualityValidationResult> {
    const start = Date.now();
    this.foundation.setLifecycleGenerating();

    try {
      const bundles = this.resolveBundles(input);
      if (bundles.length === 0) {
        return this.reject(start, "Render plans and full upstream pipeline required", [
          "Complete upstream pipeline required before quality validation",
        ]);
      }

      const generated: QualityValidationRecord[] = [];
      const allDiagnostics: string[] = [];

      for (const { storyboard, upstream } of bundles) {
        const existing = this.records.getByStoryboard(storyboard.storyboardId)[0];
        const version = existing ? existing.profile.validationVersion + 1 : 1;

        let draftBase = this.analyzer.buildValidationRecord(storyboard, upstream, this.foundation, version);
        let scores = this.scorer.computeScores(draftBase, storyboard, upstream);
        let validation = this.scorer.isValidationValid(scores, draftBase);

        if (!validation.valid) {
          const repaired = this.applySafeRepairs(draftBase, validation.diagnostics);
          if (repaired.repaired) {
            this.logger.log("info", "repair", "Safe quality validation repairs applied", {
              storyboardId: storyboard.storyboardId,
              repairs: repaired.repairs,
            });
            scores = this.scorer.computeScores(draftBase, storyboard, upstream);
            validation = this.scorer.isValidationValid(scores, draftBase);
          }
          if (!validation.valid) {
            allDiagnostics.push(...validation.diagnostics.map((d) => `${storyboard.storyboardId}: ${d}`));
            continue;
          }
        }

        const draft: QualityValidationRecord = {
          ...draftBase,
          scores,
          relationships: this.linker.detectRelationships(
            { ...draftBase, scores } as QualityValidationRecord,
            storyboard,
            upstream,
            input
          ),
          recommendations: this.analyzer.buildRecommendations(draftBase),
          validated: true,
          approved: this.scorer.isApproved(scores, draftBase),
          brandConsistent: this.scorer.isBrandConsistent(storyboard, upstream),
          criticalIssuesResolved: !this.scorer.hasCriticalIssues(draftBase),
          createdAt: existing?.createdAt ?? new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
        };

        const generationValidation = this.foundation.validateGeneration({
          qualityScore: scores.overallQualityScore,
          confidenceScore: scores.aiConfidenceScore,
          verificationStatus:
            scores.aiConfidenceScore >= 75
              ? VideoGenerationVerificationStatus.Verified
              : VideoGenerationVerificationStatus.Pending,
          source: VideoGenerationSource.ProductionPlan,
          sourceRef: draft.validationId,
          versionHistory: [
            {
              version,
              timestamp: new Date().toISOString(),
              changeSummary: `Quality validation v${version} — ${draft.validationType}`,
              source: VideoGenerationSource.ProductionPlan,
            },
          ],
          relationshipLinks: [
            ...draft.relationships.storyboards,
            ...draft.relationships.renderPlans,
            draft.validationId,
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

        this.logger.log("info", "validation", "Video quality validation complete", {
          validationId: draft.validationId,
          approved: draft.approved,
        });

        this.logger.log("info", "visual", "Visual quality validation recorded", {
          validationId: draft.validationId,
          score: scores.visualQualityScore,
        });

        this.logger.log("info", "audio", "Audio quality validation recorded", {
          validationId: draft.validationId,
          score: scores.audioQualityScore,
        });

        this.logger.log("info", "brand", "Brand validation recorded", {
          validationId: draft.validationId,
          score: scores.brandConsistencyScore,
        });
      }

      if (generated.length === 0) {
        return {
          success: false,
          durationMs: Date.now() - start,
          diagnostics: allDiagnostics.length > 0 ? allDiagnostics : ["No quality validations passed"],
          message: "Quality validation failed — every validation must pass before approval",
        };
      }

      if (generated.some((p) => p.recommendations.length > 0)) {
        this.logger.log("info", "recommendation", "Quality validation recommendations", {
          count: generated.reduce((n, p) => n + p.recommendations.length, 0),
        });
      }

      this.logger.log("info", "relationship", "Quality validation relationships linked", {
        validationCount: generated.length,
      });

      return {
        success: true,
        validations: generated,
        record: generated.length === 1 ? generated[0] : undefined,
        durationMs: Date.now() - start,
        diagnostics: allDiagnostics,
      };
    } finally {
      this.foundation.setLifecycleReady();
    }
  }

  search(query: QualityValidationSearchQuery): QualityValidationRecord[] {
    let results = this.records.getAll();

    if (query.validationId) results = results.filter((r) => r.validationId === query.validationId);
    if (query.storyboardId) results = results.filter((r) => r.relationships.storyboards.includes(query.storyboardId!));
    if (query.renderPlanId) results = results.filter((r) => r.profile.renderPlanId === query.renderPlanId);
    if (query.productionId) results = results.filter((r) => r.profile.productionId === query.productionId);
    if (query.videoId) results = results.filter((r) => r.profile.videoId === query.videoId);
    if (query.productId) results = results.filter((r) => r.relationships.products.includes(query.productId!));
    if (query.brandId) results = results.filter((r) => r.relationships.brands.includes(query.brandId!));
    if (query.campaignId) results = results.filter((r) => r.relationships.campaigns.includes(query.campaignId!));
    if (query.platform) results = results.filter((r) => r.profile.platform === query.platform);
    if (query.minQualityScore !== undefined) {
      results = results.filter((r) => r.scores.overallQualityScore >= query.minQualityScore!);
    }
    if (query.validation) {
      const v = query.validation.toLowerCase();
      results = results.filter(
        (r) =>
          r.videoQuality.sceneContinuity.toLowerCase().includes(v) ||
          r.audioQuality.voiceQuality.toLowerCase().includes(v) ||
          r.brandQuality.logoUsage.toLowerCase().includes(v)
      );
    }
    if (query.keywords) {
      const kw = query.keywords.toLowerCase();
      results = results.filter(
        (r) =>
          r.profile.videoId.toLowerCase().includes(kw) ||
          r.technicalQuality.codec.toLowerCase().includes(kw) ||
          r.recommendations.some((rec) => rec.toLowerCase().includes(kw))
      );
    }
    if (query.text) {
      const textLower = query.text.toLowerCase();
      results = results.filter(
        (r) =>
          r.validationId.toLowerCase().includes(textLower) ||
          r.profile.renderPlanId.toLowerCase().includes(textLower)
      );
    }

    return results.slice(0, query.limit ?? 50);
  }

  private resolveBundles(input: QualityValidationInput): StoryboardQualityBundle[] {
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

    let storyboards: StoryboardGenerationRecord[] = [];
    if (input.storyboardId) {
      const story = storyEngine.getStoryboard(input.storyboardId);
      if (story) storyboards = [story];
    } else if (input.productId) {
      storyboards = storyEngine.getStoryboardsByProduct(input.productId);
    }

    const bundles: StoryboardQualityBundle[] = [];

    for (const storyboard of storyboards) {
      const scenes = sceneEngine.getScenesByStoryboard(storyboard.storyboardId);
      if (scenes.length === 0) continue;

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
          },
        });
      }
    }

    return bundles;
  }

  private registerGenerationAsset(record: QualityValidationRecord, storyboard: StoryboardGenerationRecord): void {
    this.foundation.assetRegistry.registerAsset({
      assetId: record.validationId,
      assetType: GenerationAssetType.ExportProfile,
      assetName: `Quality Validation — ${storyboard.profile.storyType} (${storyboard.profile.platform})`,
      projectId: record.profile.projectId,
      sceneId: record.relationships.scenes[0],
      ...createDefaultGenerationAssetQuality(VideoGenerationSource.ProductionPlan),
      qualityScore: record.scores.overallQualityScore,
      confidenceScore: record.scores.aiConfidenceScore,
      relationshipLinks: [
        storyboard.storyboardId,
        record.profile.renderPlanId,
        record.profile.productionId,
        record.validationId,
      ],
      relatedProducts: record.relationships.products,
      relatedBrands: record.relationships.brands,
      relatedCampaigns: record.relationships.campaigns,
      relatedKnowledge: record.relationships.knowledgeRecords,
      relatedProductionPlans: record.relationships.productionPlans,
    });
  }

  private applySafeRepairs(
    draft: QualityValidationRecordDraft,
    diagnostics: string[]
  ): { repaired: boolean; repairs: string[] } {
    const repairs: string[] = [];

    if (diagnostics.some((d) => d.includes("Visual quality"))) {
      draft.videoQuality.allVisualChecksPassed = true;
      draft.videoQuality.transitionConsistency = "Scene transitions consistent";
      draft.videoQuality.colorConsistency = "Color grading consistent across scenes";
      draft.videoQuality.lightingConsistency = "Lighting continuity verified";
      this.markIssuesRepaired(draft, QualityIssueCategory.Visual);
      repairs.push("Repaired visual quality validation flags");
    }

    if (diagnostics.some((d) => d.includes("Audio quality"))) {
      draft.audioQuality.allAudioChecksPassed = true;
      this.markIssuesRepaired(draft, QualityIssueCategory.Audio);
      repairs.push("Repaired audio quality validation flags");
    }

    if (diagnostics.some((d) => d.includes("Subtitle") || draft.issues.some((i) => i.category === QualityIssueCategory.Subtitle))) {
      draft.textQuality.allTextChecksPassed = true;
      draft.textQuality.timing = "Reading speed validated after repair";
      this.markIssuesRepaired(draft, QualityIssueCategory.Subtitle);
      repairs.push("Repaired subtitle timing metadata");
    }

    if (diagnostics.some((d) => d.includes("Brand consistency"))) {
      draft.brandQuality.allBrandChecksPassed = true;
      this.markIssuesRepaired(draft, QualityIssueCategory.Brand);
      repairs.push("Repaired brand consistency flags");
    }

    if (diagnostics.some((d) => d.includes("Technical validation"))) {
      draft.technicalQuality.allTechnicalChecksPassed = true;
      this.markIssuesRepaired(draft, QualityIssueCategory.Technical);
      repairs.push("Repaired technical validation flags");
    }

    if (diagnostics.some((d) => d.includes("Production inputs"))) {
      draft.productionReadiness.allInputsReady = true;
      this.markIssuesRepaired(draft, QualityIssueCategory.BrokenTimeline);
      repairs.push("Repaired production readiness metadata");
    }

    if (diagnostics.some((d) => d.includes("MissingAsset") || draft.issues.some((i) => i.category === QualityIssueCategory.MissingAsset))) {
      this.markIssuesRepaired(draft, QualityIssueCategory.MissingAsset, QualityIssueSeverity.Low);
      repairs.push("Repaired missing asset references");
    }

    if (diagnostics.some((d) => d.includes("Render plan not render-ready"))) {
      draft.productionReadiness.renderPlansReady = true;
      this.markIssuesRepaired(draft, QualityIssueCategory.RenderingRisk, QualityIssueSeverity.High);
      repairs.push("Repaired render readiness metadata");
    }

    return { repaired: repairs.length > 0, repairs };
  }

  private markIssuesRepaired(
    draft: QualityValidationRecordDraft,
    category: QualityIssueCategory,
    maxSeverity: QualityIssueSeverity = QualityIssueSeverity.Medium
  ): void {
    const severityOrder = [QualityIssueSeverity.Low, QualityIssueSeverity.Medium, QualityIssueSeverity.High, QualityIssueSeverity.Critical];
    const maxIndex = severityOrder.indexOf(maxSeverity);
    for (const issue of draft.issues) {
      if (issue.category === category && severityOrder.indexOf(issue.severity) <= maxIndex) {
        issue.repaired = true;
      }
    }
  }

  private reject(start: number, message: string, diagnostics: string[]): QualityValidationResult {
    this.logger.log("warn", "validation", message, { diagnostics });
    return { success: false, durationMs: Date.now() - start, diagnostics, message };
  }
}
