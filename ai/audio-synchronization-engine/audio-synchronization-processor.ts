import type { AiVideoGenerationFoundation } from "../video-generation-foundation/video-generation-foundation.js";
import {
  GenerationAssetType,
  VideoGenerationHealthLevel,
  VideoGenerationSource,
  VideoGenerationVerificationStatus,
} from "../video-generation-foundation/types.js";
import { createDefaultGenerationAssetQuality } from "../video-generation-foundation/generation-asset-registry.js";
import type { AnimationGenerationRecord } from "../animation-generation-engine/types.js";
import type { CameraDirectorRecord } from "../camera-director-engine/types.js";
import type { MotionGenerationRecord } from "../motion-generation-engine/types.js";
import type { SceneGenerationRecord } from "../scene-generation-engine/types.js";
import type { VisualEffectsGenerationRecord } from "../visual-effects-generation-engine/types.js";
import {
  AudioSynchronizationAnalyzer,
  AudioSynchronizationRecordDraft,
} from "./audio-synchronization-analyzer.js";
import { AudioSynchronizationLinker } from "./audio-synchronization-linker.js";
import { AudioSynchronizationLogger } from "./audio-synchronization-logger.js";
import { AudioSynchronizationScorer } from "./audio-synchronization-scorer.js";
import { AudioSynchronizationRecordStore } from "./audio-synchronization-stores.js";
import {
  AudioSynchronizationInput,
  AudioSynchronizationRecord,
  AudioSynchronizationResult,
  AudioSynchronizationSearchQuery,
} from "./types.js";

interface SceneUpstreamBundle {
  scene: SceneGenerationRecord;
  cameraPlan: CameraDirectorRecord;
  motionPlan: MotionGenerationRecord;
  animationPlan: AnimationGenerationRecord;
  vfxPlan: VisualEffectsGenerationRecord;
}

export class AudioSynchronizationProcessor {
  constructor(
    private readonly foundation: AiVideoGenerationFoundation,
    private readonly analyzer: AudioSynchronizationAnalyzer,
    private readonly scorer: AudioSynchronizationScorer,
    private readonly linker: AudioSynchronizationLinker,
    private readonly records: AudioSynchronizationRecordStore,
    private readonly logger: AudioSynchronizationLogger
  ) {}

  async generateAudioSyncPlans(input: AudioSynchronizationInput): Promise<AudioSynchronizationResult> {
    const start = Date.now();
    this.foundation.setLifecycleGenerating();

    try {
      const bundles = this.resolveBundles(input);
      if (bundles.length === 0) {
        return this.reject(start, "Visual effect plans, animation plans, motion plans, camera plans, and scenes required", [
          "Complete upstream pipeline required before audio synchronization",
        ]);
      }

      const invalid = bundles.find(
        (b) =>
          !b.scene.validated ||
          !b.scene.productionReady ||
          !b.cameraPlan.validated ||
          !b.cameraPlan.productionReady ||
          !b.motionPlan.validated ||
          !b.motionPlan.productionReady ||
          !b.animationPlan.validated ||
          !b.animationPlan.productionReady ||
          !b.vfxPlan.validated ||
          !b.vfxPlan.productionReady
      );
      if (invalid) {
        return this.reject(start, "All upstream assets must be validated and production-ready", [
          `Scene ${invalid.scene.sceneId} upstream chain not ready`,
        ]);
      }

      const generated: AudioSynchronizationRecord[] = [];
      const allDiagnostics: string[] = [];

      for (const { scene, cameraPlan, motionPlan, animationPlan, vfxPlan } of bundles) {
        const existing = this.records.getByScene(scene.sceneId)[0];
        const version = existing ? existing.profile.audioVersion + 1 : 1;

        const draftBase = this.analyzer.buildAudioSyncPlan(
          scene,
          cameraPlan,
          motionPlan,
          animationPlan,
          vfxPlan,
          version,
          {
            voiceFileIds: input.voiceFileIds,
            musicIds: input.musicIds,
            soundEffectIds: input.soundEffectIds,
            scriptId: input.scriptId,
          }
        );
        const scores = this.scorer.computeScores(draftBase, scene, motionPlan, cameraPlan, animationPlan, vfxPlan);
        let validation = this.scorer.isPlanValid(scores, draftBase);

        if (!validation.valid) {
          const repaired = this.applySafeRepairs(draftBase, validation.diagnostics);
          if (repaired.repaired) {
            this.logger.log("info", "validation", "Safe audio synchronization repairs applied", {
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

        const draft: AudioSynchronizationRecord = {
          ...draftBase,
          scores,
          relationships: this.linker.detectRelationships(
            { ...draftBase, scores } as AudioSynchronizationRecord,
            scene,
            motionPlan,
            cameraPlan,
            animationPlan,
            vfxPlan,
            input
          ),
          recommendations: this.analyzer.buildRecommendations(draftBase),
          validated: true,
          productionReady: this.scorer.isProductionReady(scores, draftBase),
          brandConsistent: this.scorer.isBrandConsistent(scene),
          audioContinuityMaintained: this.scorer.isAudioContinuityMaintained(draftBase),
          createdAt: existing?.createdAt ?? new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
        };

        const generationValidation = this.foundation.validateGeneration({
          qualityScore: scores.audioSynchronizationScore,
          confidenceScore: scores.aiConfidenceScore,
          verificationStatus:
            scores.aiConfidenceScore >= 75
              ? VideoGenerationVerificationStatus.Verified
              : VideoGenerationVerificationStatus.Pending,
          source: VideoGenerationSource.ProductionPlan,
          sourceRef: draft.audioSynchronizationId,
          versionHistory: [
            {
              version,
              timestamp: new Date().toISOString(),
              changeSummary: `Audio sync plan v${version} — ${draft.planType}`,
              source: VideoGenerationSource.ProductionPlan,
            },
          ],
          relationshipLinks: [
            ...draft.relationships.scenes,
            ...draft.relationships.visualEffectPlans,
            draft.audioSynchronizationId,
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

        this.logger.log("info", "synchronization", "Audio synchronization plan generated", {
          audioSynchronizationId: draft.audioSynchronizationId,
          planType: draft.planType,
        });

        this.logger.log("info", "voice", "Voice alignment recorded", {
          audioSynchronizationId: draft.audioSynchronizationId,
        });

        this.logger.log("info", "music", "Music alignment recorded", {
          audioSynchronizationId: draft.audioSynchronizationId,
        });

        this.logger.log("info", "subtitle", "Subtitle alignment recorded", {
          audioSynchronizationId: draft.audioSynchronizationId,
        });

        this.logger.log("info", "decision", "Audio sync decisions recorded", {
          audioSynchronizationId: draft.audioSynchronizationId,
        });
      }

      if (generated.length === 0) {
        return {
          success: false,
          durationMs: Date.now() - start,
          diagnostics: allDiagnostics.length > 0 ? allDiagnostics : ["No audio sync plans passed validation"],
          message: "Audio synchronization failed — every plan must pass validation before approval",
        };
      }

      if (generated.some((p) => p.recommendations.length > 0)) {
        this.logger.log("info", "recommendation", "Audio sync recommendations", {
          count: generated.reduce((n, p) => n + p.recommendations.length, 0),
        });
      }

      this.logger.log("info", "relationship", "Audio sync relationships linked", {
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

  search(query: AudioSynchronizationSearchQuery): AudioSynchronizationRecord[] {
    let results = this.records.getAll();

    if (query.audioSynchronizationId) {
      results = results.filter((r) => r.audioSynchronizationId === query.audioSynchronizationId);
    }
    if (query.sceneId) results = results.filter((r) => r.profile.sceneId === query.sceneId);
    if (query.storyboardId) results = results.filter((r) => r.profile.storyboardId === query.storyboardId);
    if (query.planType) results = results.filter((r) => r.planType === query.planType);
    if (query.productId) results = results.filter((r) => r.relationships.products.includes(query.productId!));
    if (query.brandId) results = results.filter((r) => r.relationships.brands.includes(query.brandId!));
    if (query.campaignId) results = results.filter((r) => r.relationships.campaigns.includes(query.campaignId!));
    if (query.platform) results = results.filter((r) => r.profile.platform === query.platform);
    if (query.voice) {
      const v = query.voice.toLowerCase();
      results = results.filter((r) => r.voiceSynchronization.voiceTiming.toLowerCase().includes(v));
    }
    if (query.music) {
      const m = query.music.toLowerCase();
      results = results.filter((r) => r.musicSynchronization.musicTiming.toLowerCase().includes(m));
    }
    if (query.soundEffect) {
      const s = query.soundEffect.toLowerCase();
      results = results.filter((r) => r.soundEffectSynchronization.ambientSounds.toLowerCase().includes(s));
    }
    if (query.subtitle) {
      const s = query.subtitle.toLowerCase();
      results = results.filter((r) => r.subtitleSynchronization.subtitleTiming.toLowerCase().includes(s));
    }
    if (query.keywords) {
      const kw = query.keywords.toLowerCase();
      results = results.filter(
        (r) =>
          r.voiceSynchronization.voiceTiming.toLowerCase().includes(kw) ||
          r.musicSynchronization.musicPlacement.toLowerCase().includes(kw) ||
          r.subtitleSynchronization.subtitleTiming.toLowerCase().includes(kw)
      );
    }
    if (query.text) {
      const textLower = query.text.toLowerCase();
      results = results.filter(
        (r) =>
          r.audioSynchronizationId.toLowerCase().includes(textLower) ||
          r.profile.sceneId.toLowerCase().includes(textLower)
      );
    }

    return results.slice(0, query.limit ?? 50);
  }

  private resolveBundles(input: AudioSynchronizationInput): SceneUpstreamBundle[] {
    const sceneEngine = this.foundation.getSceneGenerationEngine();
    const cameraEngine = this.foundation.getCameraDirectorEngine();
    const motionEngine = this.foundation.getMotionGenerationEngine();
    const animationEngine = this.foundation.getAnimationGenerationEngine();
    const vfxEngine = this.foundation.getVisualEffectsGenerationEngine();

    let scenes: SceneGenerationRecord[] = [];
    if (input.sceneId) {
      const scene = sceneEngine.getScene(input.sceneId);
      if (scene) scenes = [scene];
    } else if (input.storyboardId) {
      scenes = sceneEngine.getScenesByStoryboard(input.storyboardId);
    }

    const bundles: SceneUpstreamBundle[] = [];
    for (const scene of scenes) {
      let cameraPlans = cameraEngine.getCameraPlansByScene(scene.sceneId);
      if (input.cameraPlanId) {
        cameraPlans = cameraPlans.filter((p) => p.cameraPlanId === input.cameraPlanId);
      }

      let motionPlans = motionEngine.getMotionPlansByScene(scene.sceneId);
      if (input.motionPlanId) {
        motionPlans = motionPlans.filter((p) => p.motionPlanId === input.motionPlanId);
      }

      let animationPlans = animationEngine.getAnimationPlansByScene(scene.sceneId);
      if (input.animationPlanId) {
        animationPlans = animationPlans.filter((p) => p.animationPlanId === input.animationPlanId);
      }

      let vfxPlans = vfxEngine.getVisualEffectPlansByScene(scene.sceneId);
      if (input.visualEffectPlanId) {
        vfxPlans = vfxPlans.filter((p) => p.visualEffectPlanId === input.visualEffectPlanId);
      }

      const cameraPlan = cameraPlans[0];
      const motionPlan = motionPlans[0];
      const animationPlan = animationPlans[0];
      const vfxPlan = vfxPlans[0];
      if (cameraPlan && motionPlan && animationPlan && vfxPlan) {
        bundles.push({ scene, cameraPlan, motionPlan, animationPlan, vfxPlan });
      }
    }
    return bundles;
  }

  private registerGenerationAsset(record: AudioSynchronizationRecord, scene: SceneGenerationRecord): void {
    this.foundation.assetRegistry.registerAsset({
      assetId: record.audioSynchronizationId,
      assetType: GenerationAssetType.Audio,
      assetName: `Audio Sync Plan — Scene ${scene.structure.sceneOrder}: ${scene.structure.scenePurpose}`,
      projectId: record.profile.projectId,
      sceneId: record.profile.sceneId,
      ...createDefaultGenerationAssetQuality(VideoGenerationSource.ProductionPlan),
      qualityScore: record.scores.audioSynchronizationScore,
      confidenceScore: record.scores.aiConfidenceScore,
      relationshipLinks: [
        scene.sceneId,
        record.profile.visualEffectPlanId,
        record.profile.animationPlanId,
        record.audioSynchronizationId,
      ],
      relatedProducts: record.relationships.products,
      relatedBrands: record.relationships.brands,
      relatedCampaigns: record.relationships.campaigns,
      relatedKnowledge: record.relationships.knowledgeRecords,
      relatedProductionPlans: record.relationships.visualEffectPlans,
    });
  }

  private applySafeRepairs(
    draft: AudioSynchronizationRecordDraft,
    diagnostics: string[]
  ): { repaired: boolean; repairs: string[] } {
    const repairs: string[] = [];

    if (diagnostics.some((d) => d.includes("Motion synchronization"))) {
      draft.sceneSynchronization.motionSync = ["T0s: repair sync — aligned to scene timing"];
      repairs.push("Added default motion sync");
    }

    if (diagnostics.some((d) => d.includes("Voice synchronization"))) {
      draft.sceneSynchronization.voiceSync = ["T0s: voice aligned to scene start"];
      repairs.push("Added default voice sync");
    }

    if (diagnostics.some((d) => d.includes("Lip sync blueprint"))) {
      draft.voiceSynchronization.lipSyncBlueprint = "Default lip sync — viseme mapping to voice timing";
      repairs.push("Added default lip sync blueprint");
    }

    return { repaired: repairs.length > 0, repairs };
  }

  private reject(start: number, message: string, diagnostics: string[]): AudioSynchronizationResult {
    this.logger.log("warn", "validation", message, { diagnostics });
    return { success: false, durationMs: Date.now() - start, diagnostics, message };
  }
}
