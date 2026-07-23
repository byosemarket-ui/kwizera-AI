import { GenerationAssetType, VideoGenerationHealthLevel, VideoGenerationSource, VideoGenerationVerificationStatus, } from "../video-generation-foundation/types.js";
import { createDefaultGenerationAssetQuality } from "../video-generation-foundation/generation-asset-registry.js";
export class VisualEffectsGenerationProcessor {
    foundation;
    analyzer;
    scorer;
    linker;
    records;
    logger;
    constructor(foundation, analyzer, scorer, linker, records, logger) {
        this.foundation = foundation;
        this.analyzer = analyzer;
        this.scorer = scorer;
        this.linker = linker;
        this.records = records;
        this.logger = logger;
    }
    async generateVisualEffectPlans(input) {
        const start = Date.now();
        this.foundation.setLifecycleGenerating();
        try {
            const bundles = this.resolveBundles(input);
            if (bundles.length === 0) {
                return this.reject(start, "Animation plans, motion plans, camera plans, and scenes required", [
                    "Complete upstream pipeline required before visual effects planning",
                ]);
            }
            const invalid = bundles.find((b) => !b.scene.validated ||
                !b.scene.productionReady ||
                !b.cameraPlan.validated ||
                !b.cameraPlan.productionReady ||
                !b.motionPlan.validated ||
                !b.motionPlan.productionReady ||
                !b.animationPlan.validated ||
                !b.animationPlan.productionReady);
            if (invalid) {
                return this.reject(start, "All upstream assets must be validated and production-ready", [
                    `Scene ${invalid.scene.sceneId} upstream chain not ready`,
                ]);
            }
            const generated = [];
            const allDiagnostics = [];
            for (const { scene, cameraPlan, motionPlan, animationPlan } of bundles) {
                const existing = this.records.getByScene(scene.sceneId)[0];
                const version = existing ? existing.profile.effectVersion + 1 : 1;
                const draftBase = this.analyzer.buildVisualEffectPlan(scene, cameraPlan, motionPlan, animationPlan, version);
                const scores = this.scorer.computeScores(draftBase, scene, motionPlan, cameraPlan, animationPlan);
                let validation = this.scorer.isPlanValid(scores, draftBase);
                if (!validation.valid) {
                    const repaired = this.applySafeRepairs(draftBase, validation.diagnostics);
                    if (repaired.repaired) {
                        this.logger.log("info", "validation", "Safe visual effects repairs applied", {
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
                const draft = {
                    ...draftBase,
                    scores,
                    relationships: this.linker.detectRelationships({ ...draftBase, scores }, scene, motionPlan, cameraPlan, animationPlan, input),
                    recommendations: this.analyzer.buildRecommendations(draftBase),
                    validated: true,
                    productionReady: this.scorer.isProductionReady(scores, draftBase),
                    brandConsistent: this.scorer.isBrandConsistent(scene),
                    cinematicallyConsistent: this.scorer.isCinematicallyConsistent(scores, draftBase),
                    createdAt: existing?.createdAt ?? new Date().toISOString(),
                    lastUpdated: new Date().toISOString(),
                };
                const generationValidation = this.foundation.validateGeneration({
                    qualityScore: scores.visualEffectsScore,
                    confidenceScore: scores.aiConfidenceScore,
                    verificationStatus: scores.aiConfidenceScore >= 75
                        ? VideoGenerationVerificationStatus.Verified
                        : VideoGenerationVerificationStatus.Pending,
                    source: VideoGenerationSource.System,
                    sourceRef: draft.visualEffectPlanId,
                    versionHistory: [
                        {
                            version,
                            timestamp: new Date().toISOString(),
                            changeSummary: `Visual effect plan v${version} — ${draft.planType}`,
                            source: VideoGenerationSource.System,
                        },
                    ],
                    relationshipLinks: [
                        ...draft.relationships.scenes,
                        ...draft.relationships.animationPlans,
                        draft.visualEffectPlanId,
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
                this.logger.log("info", "planning", "Visual effect plan generated", {
                    visualEffectPlanId: draft.visualEffectPlanId,
                    planType: draft.planType,
                });
                this.logger.log("info", "synchronization", "Visual effects synchronized", {
                    visualEffectPlanId: draft.visualEffectPlanId,
                    motionSync: draft.synchronization.motionSync.length,
                });
                this.logger.log("info", "decision", "Visual effects decisions recorded", {
                    visualEffectPlanId: draft.visualEffectPlanId,
                });
            }
            if (generated.length === 0) {
                return {
                    success: false,
                    durationMs: Date.now() - start,
                    diagnostics: allDiagnostics.length > 0 ? allDiagnostics : ["No visual effect plans passed validation"],
                    message: "Visual effects planning failed — every plan must pass validation before approval",
                };
            }
            if (generated.some((p) => p.recommendations.length > 0)) {
                this.logger.log("info", "recommendation", "Visual effects recommendations", {
                    count: generated.reduce((n, p) => n + p.recommendations.length, 0),
                });
            }
            this.logger.log("info", "relationship", "Visual effects relationships linked", {
                planCount: generated.length,
            });
            return {
                success: true,
                plans: generated,
                record: generated.length === 1 ? generated[0] : undefined,
                durationMs: Date.now() - start,
                diagnostics: allDiagnostics,
            };
        }
        finally {
            this.foundation.setLifecycleReady();
        }
    }
    search(query) {
        let results = this.records.getAll();
        if (query.visualEffectPlanId)
            results = results.filter((r) => r.visualEffectPlanId === query.visualEffectPlanId);
        if (query.sceneId)
            results = results.filter((r) => r.profile.sceneId === query.sceneId);
        if (query.storyboardId)
            results = results.filter((r) => r.profile.storyboardId === query.storyboardId);
        if (query.planType)
            results = results.filter((r) => r.planType === query.planType);
        if (query.productId)
            results = results.filter((r) => r.relationships.products.includes(query.productId));
        if (query.brandId)
            results = results.filter((r) => r.relationships.brands.includes(query.brandId));
        if (query.campaignId)
            results = results.filter((r) => r.relationships.campaigns.includes(query.campaignId));
        if (query.platform)
            results = results.filter((r) => r.profile.platform === query.platform);
        if (query.keywords) {
            const kw = query.keywords.toLowerCase();
            results = results.filter((r) => r.productEffects.productGlow.toLowerCase().includes(kw) ||
                r.lightingEffects.glow.toLowerCase().includes(kw) ||
                r.atmosphericEffects.particles.toLowerCase().includes(kw));
        }
        if (query.text) {
            const textLower = query.text.toLowerCase();
            results = results.filter((r) => r.visualEffectPlanId.toLowerCase().includes(textLower) ||
                r.profile.sceneId.toLowerCase().includes(textLower));
        }
        return results.slice(0, query.limit ?? 50);
    }
    resolveBundles(input) {
        const sceneEngine = this.foundation.getSceneGenerationEngine();
        const cameraEngine = this.foundation.getCameraDirectorEngine();
        const motionEngine = this.foundation.getMotionGenerationEngine();
        const animationEngine = this.foundation.getAnimationGenerationEngine();
        let scenes = [];
        if (input.sceneId) {
            const scene = sceneEngine.getScene(input.sceneId);
            if (scene)
                scenes = [scene];
        }
        else if (input.storyboardId) {
            scenes = sceneEngine.getScenesByStoryboard(input.storyboardId);
        }
        const bundles = [];
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
            const cameraPlan = cameraPlans[0];
            const motionPlan = motionPlans[0];
            const animationPlan = animationPlans[0];
            if (cameraPlan && motionPlan && animationPlan) {
                bundles.push({ scene, cameraPlan, motionPlan, animationPlan });
            }
        }
        return bundles;
    }
    registerGenerationAsset(record, scene) {
        this.foundation.assetRegistry.registerAsset({
            assetId: record.visualEffectPlanId,
            assetType: GenerationAssetType.Effect,
            assetName: `Visual Effect Plan — Scene ${scene.structure.sceneOrder}: ${scene.structure.scenePurpose}`,
            projectId: record.profile.projectId,
            sceneId: record.profile.sceneId,
            ...createDefaultGenerationAssetQuality(VideoGenerationSource.System),
            qualityScore: record.scores.visualEffectsScore,
            confidenceScore: record.scores.aiConfidenceScore,
            relationshipLinks: [
                scene.sceneId,
                record.profile.animationPlanId,
                record.profile.motionPlanId,
                record.profile.cameraPlanId,
                record.visualEffectPlanId,
            ],
            relatedProducts: record.relationships.products,
            relatedBrands: record.relationships.brands,
            relatedCampaigns: record.relationships.campaigns,
            relatedKnowledge: record.relationships.knowledgeRecords,
            relatedProductionPlans: record.relationships.animationPlans,
        });
    }
    applySafeRepairs(draft, diagnostics) {
        const repairs = [];
        if (diagnostics.some((d) => d.includes("Motion synchronization"))) {
            draft.synchronization.motionSync = ["T0s: repair sync — aligned to scene timing"];
            repairs.push("Added default motion sync");
        }
        if (diagnostics.some((d) => d.includes("Animation synchronization"))) {
            draft.synchronization.animationSync = ["T0s: repair sync — aligned to animation timeline"];
            repairs.push("Added default animation sync");
        }
        return { repaired: repairs.length > 0, repairs };
    }
    reject(start, message, diagnostics) {
        this.logger.log("warn", "validation", message, { diagnostics });
        return { success: false, durationMs: Date.now() - start, diagnostics, message };
    }
}
//# sourceMappingURL=visual-effects-generation-processor.js.map