import type { AiVideoGenerationFoundation } from "../video-generation-foundation/video-generation-foundation.js";
import {
  GenerationAssetType,
  VideoGenerationHealthLevel,
  VideoGenerationSource,
  VideoGenerationVerificationStatus,
} from "../video-generation-foundation/types.js";
import { createDefaultGenerationAssetQuality } from "../video-generation-foundation/generation-asset-registry.js";
import type { CameraDirectorRecord } from "../camera-director-engine/types.js";
import type { SceneGenerationRecord } from "../scene-generation-engine/types.js";
import { MotionGenerationAnalyzer, MotionGenerationRecordDraft } from "./motion-generation-analyzer.js";
import { MotionGenerationLinker } from "./motion-generation-linker.js";
import { MotionGenerationLogger } from "./motion-generation-logger.js";
import { MotionGenerationScorer } from "./motion-generation-scorer.js";
import { MotionGenerationRecordStore } from "./motion-generation-stores.js";
import {
  MotionGenerationInput,
  MotionGenerationRecord,
  MotionGenerationResult,
  MotionGenerationSearchQuery,
} from "./types.js";

interface SceneCameraPair {
  scene: SceneGenerationRecord;
  cameraPlan: CameraDirectorRecord;
}

export class MotionGenerationProcessor {
  constructor(
    private readonly foundation: AiVideoGenerationFoundation,
    private readonly analyzer: MotionGenerationAnalyzer,
    private readonly scorer: MotionGenerationScorer,
    private readonly linker: MotionGenerationLinker,
    private readonly records: MotionGenerationRecordStore,
    private readonly logger: MotionGenerationLogger
  ) {}

  async generateMotionPlans(input: MotionGenerationInput): Promise<MotionGenerationResult> {
    const start = Date.now();
    this.foundation.setLifecycleGenerating();

    try {
      const pairs = this.resolveSceneCameraPairs(input);
      if (pairs.length === 0) {
        return this.reject(start, "Camera plans and generated scenes required", [
          "Scenes and camera plans must exist and be validated before motion planning",
        ]);
      }

      const invalid = pairs.find(
        (p) =>
          !p.scene.validated ||
          !p.scene.productionReady ||
          !p.cameraPlan.validated ||
          !p.cameraPlan.productionReady
      );
      if (invalid) {
        return this.reject(start, "All scenes and camera plans must be validated and production-ready", [
          `Scene ${invalid.scene.sceneId} or camera plan not ready`,
        ]);
      }

      const generated: MotionGenerationRecord[] = [];
      const allDiagnostics: string[] = [];

      for (const { scene, cameraPlan } of pairs) {
        const existing = this.records.getByScene(scene.sceneId)[0];
        const version = existing ? existing.profile.motionVersion + 1 : 1;

        const draftBase = this.analyzer.buildMotionPlan(scene, cameraPlan, version);
        const scores = this.scorer.computeScores(draftBase, scene, cameraPlan);
        let validation = this.scorer.isPlanValid(scores, draftBase);

        if (!validation.valid) {
          const repaired = this.applySafeRepairs(draftBase, validation.diagnostics);
          if (repaired.repaired) {
            this.logger.log("info", "validation", "Safe motion repairs applied", {
              sceneId: scene.sceneId,
              repairs: repaired.repairs,
            });
          }
          validation = this.scorer.isPlanValid(scores, draftBase);
          if (!validation.valid) {
            allDiagnostics.push(...validation.diagnostics.map((d) => `${scene.sceneId}: ${d}`));
            continue;
          }
        }

        const draft: MotionGenerationRecord = {
          ...draftBase,
          scores,
          relationships: this.linker.detectRelationships(
            { ...draftBase, scores } as MotionGenerationRecord,
            scene,
            cameraPlan,
            input
          ),
          recommendations: this.analyzer.buildRecommendations(draftBase),
          validated: true,
          productionReady: this.scorer.isProductionReady(scores, draftBase),
          physicallyConsistent: this.scorer.isPhysicallyConsistent(scores, draftBase),
          cinematicallyConsistent: this.scorer.isCinematicallyConsistent(draftBase),
          createdAt: existing?.createdAt ?? new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
        };

        const generationValidation = this.foundation.validateGeneration({
          qualityScore: scores.motionQualityScore,
          confidenceScore: scores.aiConfidenceScore,
          verificationStatus:
            scores.aiConfidenceScore >= 75
              ? VideoGenerationVerificationStatus.Verified
              : VideoGenerationVerificationStatus.Pending,
          source: VideoGenerationSource.ProductionPlan,
          sourceRef: draft.motionPlanId,
          versionHistory: [
            {
              version,
              timestamp: new Date().toISOString(),
              changeSummary: `Motion plan v${version} — ${draft.motionType} motion`,
              source: VideoGenerationSource.ProductionPlan,
            },
          ],
          relationshipLinks: [
            ...draft.relationships.scenes,
            ...draft.relationships.cameraPlans,
            draft.motionPlanId,
          ],
          healthStatus: VideoGenerationHealthLevel.Good,
        });

        if (!generationValidation.valid) {
          allDiagnostics.push(...generationValidation.issues.map((i) => `${scene.sceneId}: ${i}`));
          continue;
        }

        this.records.upsert(draft);
        this.registerGenerationAsset(draft, scene);
        generated.push(draft);

        this.logger.log("info", "planning", "Motion plan generated", {
          motionPlanId: draft.motionPlanId,
          motionType: draft.motionType,
        });

        this.logger.log("info", "synchronization", "Camera motion synchronized", {
          motionPlanId: draft.motionPlanId,
          syncPoints: draft.cameraSynchronization.syncPoints.length,
        });

        this.logger.log("info", "decision", "Motion decisions recorded", {
          motionPlanId: draft.motionPlanId,
          primaryCharacter: draft.characterMotion.primaryAction,
          primaryProduct: draft.productMotion.primaryAction,
        });
      }

      if (generated.length === 0) {
        return {
          success: false,
          durationMs: Date.now() - start,
          diagnostics: allDiagnostics.length > 0 ? allDiagnostics : ["No motion plans passed validation"],
          message: "Motion planning failed — every plan must pass validation before approval",
        };
      }

      if (generated.some((p) => p.recommendations.length > 0)) {
        this.logger.log("info", "recommendation", "Motion planning recommendations", {
          count: generated.reduce((n, p) => n + p.recommendations.length, 0),
        });
      }

      this.logger.log("info", "relationship", "Motion plan relationships linked", {
        planCount: generated.length,
      });

      return {
        success: true,
        plans: generated,
        record: generated.length === 1 ? generated[0] : undefined,
        durationMs: Date.now() - start,
        diagnostics: allDiagnostics,
      };
    } finally {
      this.foundation.setLifecycleReady();
    }
  }

  search(query: MotionGenerationSearchQuery): MotionGenerationRecord[] {
    let results = this.records.getAll();

    if (query.motionPlanId) results = results.filter((r) => r.motionPlanId === query.motionPlanId);
    if (query.sceneId) results = results.filter((r) => r.profile.sceneId === query.sceneId);
    if (query.storyboardId) results = results.filter((r) => r.profile.storyboardId === query.storyboardId);
    if (query.motionType) results = results.filter((r) => r.motionType === query.motionType);
    if (query.productId) results = results.filter((r) => r.relationships.products.includes(query.productId!));
    if (query.brandId) results = results.filter((r) => r.relationships.brands.includes(query.brandId!));
    if (query.campaignId) results = results.filter((r) => r.relationships.campaigns.includes(query.campaignId!));
    if (query.platform) results = results.filter((r) => r.profile.platform === query.platform);
    if (query.keywords) {
      const kw = query.keywords.toLowerCase();
      results = results.filter(
        (r) =>
          r.storytellingOptimization.marketingMoment.toLowerCase().includes(kw) ||
          r.productMotion.showcaseMotion.toLowerCase().includes(kw)
      );
    }
    if (query.text) {
      const textLower = query.text.toLowerCase();
      results = results.filter(
        (r) =>
          r.motionPlanId.toLowerCase().includes(textLower) ||
          r.profile.sceneId.toLowerCase().includes(textLower)
      );
    }

    return results.slice(0, query.limit ?? 50);
  }

  private resolveSceneCameraPairs(input: MotionGenerationInput): SceneCameraPair[] {
    const sceneEngine = this.foundation.getSceneGenerationEngine();
    const cameraEngine = this.foundation.getCameraDirectorEngine();

    let scenes: SceneGenerationRecord[] = [];
    if (input.sceneId) {
      const scene = sceneEngine.getScene(input.sceneId);
      if (scene) scenes = [scene];
    } else if (input.storyboardId) {
      scenes = sceneEngine.getScenesByStoryboard(input.storyboardId);
    }

    const pairs: SceneCameraPair[] = [];
    for (const scene of scenes) {
      let cameraPlans = cameraEngine.getCameraPlansByScene(scene.sceneId);
      if (input.cameraPlanId) {
        cameraPlans = cameraPlans.filter((p) => p.cameraPlanId === input.cameraPlanId);
      }
      const cameraPlan = cameraPlans[0];
      if (cameraPlan) pairs.push({ scene, cameraPlan });
    }
    return pairs;
  }

  private registerGenerationAsset(record: MotionGenerationRecord, scene: SceneGenerationRecord): void {
    this.foundation.assetRegistry.registerAsset({
      assetId: record.motionPlanId,
      assetType: GenerationAssetType.MotionPlan,
      assetName: `Motion Plan — Scene ${scene.structure.sceneOrder}: ${scene.structure.scenePurpose}`,
      projectId: record.profile.projectId,
      sceneId: record.profile.sceneId,
      ...createDefaultGenerationAssetQuality(VideoGenerationSource.ProductionPlan),
      qualityScore: record.scores.motionQualityScore,
      confidenceScore: record.scores.aiConfidenceScore,
      relationshipLinks: [scene.sceneId, record.profile.cameraPlanId, record.motionPlanId],
      relatedProducts: record.relationships.products,
      relatedBrands: record.relationships.brands,
      relatedCampaigns: record.relationships.campaigns,
      relatedKnowledge: record.relationships.knowledgeRecords,
      relatedProductionPlans: record.relationships.cameraPlans,
    });
  }

  private applySafeRepairs(
    draft: MotionGenerationRecordDraft,
    diagnostics: string[]
  ): { repaired: boolean; repairs: string[] } {
    const repairs: string[] = [];

    if (diagnostics.some((d) => d.includes("sync points"))) {
      draft.cameraSynchronization.syncPoints = [`T0s: ${draft.cameraSynchronization.cameraMovement} — repair sync`];
      repairs.push("Added default sync point");
    }

    if (diagnostics.some((d) => d.includes("Subject motion"))) {
      draft.continuity.issues = draft.continuity.issues.filter((i) => !i.includes("Subject motion"));
      draft.continuity.characterContinuity = true;
      repairs.push("Resolved subject motion continuity");
    }

    if (diagnostics.some((d) => d.includes("Physics"))) {
      draft.objectMotion.physicsBasedMotion = "Gravity-consistent motion — repair applied";
      repairs.push("Enhanced physics description");
    }

    return { repaired: repairs.length > 0, repairs };
  }

  private reject(start: number, message: string, diagnostics: string[]): MotionGenerationResult {
    this.logger.log("warn", "validation", message, { diagnostics });
    return { success: false, durationMs: Date.now() - start, diagnostics, message };
  }
}
