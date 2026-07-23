import { GenerationAssetType, VideoGenerationHealthLevel, VideoGenerationSource, VideoGenerationVerificationStatus, } from "../video-generation-foundation/types.js";
import { createDefaultGenerationAssetQuality } from "../video-generation-foundation/generation-asset-registry.js";
export class AnimationGenerationProcessor {
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
    async generateAnimationPlans(input) {
        const start = Date.now();
        this.foundation.setLifecycleGenerating();
        try {
            const bundles = this.resolveBundles(input);
            if (bundles.length === 0) {
                return this.reject(start, "Motion plans, camera plans, and scenes required", [
                    "Complete upstream pipeline required before animation planning",
                ]);
            }
            const invalid = bundles.find((b) => !b.scene.validated ||
                !b.scene.productionReady ||
                !b.cameraPlan.validated ||
                !b.cameraPlan.productionReady ||
                !b.motionPlan.validated ||
                !b.motionPlan.productionReady);
            if (invalid) {
                return this.reject(start, "All upstream assets must be validated and production-ready", [
                    `Scene ${invalid.scene.sceneId} upstream chain not ready`,
                ]);
            }
            const generated = [];
            const allDiagnostics = [];
            for (const { scene, cameraPlan, motionPlan } of bundles) {
                const existing = this.records.getByScene(scene.sceneId)[0];
                const version = existing ? existing.profile.animationVersion + 1 : 1;
                const draftBase = this.analyzer.buildAnimationPlan(scene, cameraPlan, motionPlan, version);
                const scores = this.scorer.computeScores(draftBase, scene, motionPlan, cameraPlan);
                let validation = this.scorer.isPlanValid(scores, draftBase);
                if (!validation.valid) {
                    const repaired = this.applySafeRepairs(draftBase, validation.diagnostics);
                    if (repaired.repaired) {
                        this.logger.log("info", "validation", "Safe animation repairs applied", {
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
                    relationships: this.linker.detectRelationships({ ...draftBase, scores }, scene, motionPlan, cameraPlan, input),
                    recommendations: this.analyzer.buildRecommendations(draftBase),
                    validated: true,
                    productionReady: this.scorer.isProductionReady(scores, draftBase),
                    brandConsistent: this.scorer.isBrandConsistent(scene),
                    smooth: this.scorer.isSmooth(scores, draftBase),
                    createdAt: existing?.createdAt ?? new Date().toISOString(),
                    lastUpdated: new Date().toISOString(),
                };
                const generationValidation = this.foundation.validateGeneration({
                    qualityScore: scores.animationQualityScore,
                    confidenceScore: scores.aiConfidenceScore,
                    verificationStatus: scores.aiConfidenceScore >= 75
                        ? VideoGenerationVerificationStatus.Verified
                        : VideoGenerationVerificationStatus.Pending,
                    source: VideoGenerationSource.System,
                    sourceRef: draft.animationPlanId,
                    versionHistory: [
                        {
                            version,
                            timestamp: new Date().toISOString(),
                            changeSummary: `Animation plan v${version} — ${draft.planType}`,
                            source: VideoGenerationSource.System,
                        },
                    ],
                    relationshipLinks: [
                        ...draft.relationships.scenes,
                        ...draft.relationships.motionPlans,
                        draft.animationPlanId,
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
                this.logger.log("info", "planning", "Animation plan generated", {
                    animationPlanId: draft.animationPlanId,
                    planType: draft.planType,
                });
                this.logger.log("info", "synchronization", "Animation synchronized", {
                    animationPlanId: draft.animationPlanId,
                    motionSync: draft.synchronization.motionSync.length,
                });
                this.logger.log("info", "decision", "Animation decisions recorded", {
                    animationPlanId: draft.animationPlanId,
                });
            }
            if (generated.length === 0) {
                return {
                    success: false,
                    durationMs: Date.now() - start,
                    diagnostics: allDiagnostics.length > 0 ? allDiagnostics : ["No animation plans passed validation"],
                    message: "Animation planning failed — every plan must pass validation before approval",
                };
            }
            if (generated.some((p) => p.recommendations.length > 0)) {
                this.logger.log("info", "recommendation", "Animation recommendations", {
                    count: generated.reduce((n, p) => n + p.recommendations.length, 0),
                });
            }
            this.logger.log("info", "relationship", "Animation relationships linked", {
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
        if (query.animationPlanId)
            results = results.filter((r) => r.animationPlanId === query.animationPlanId);
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
            results = results.filter((r) => r.productAnimation.showcase.toLowerCase().includes(kw) ||
                r.characterAnimation.gesture.toLowerCase().includes(kw));
        }
        if (query.text) {
            const textLower = query.text.toLowerCase();
            results = results.filter((r) => r.animationPlanId.toLowerCase().includes(textLower) ||
                r.profile.sceneId.toLowerCase().includes(textLower));
        }
        return results.slice(0, query.limit ?? 50);
    }
    resolveBundles(input) {
        const sceneEngine = this.foundation.getSceneGenerationEngine();
        const cameraEngine = this.foundation.getCameraDirectorEngine();
        const motionEngine = this.foundation.getMotionGenerationEngine();
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
            const cameraPlan = cameraPlans[0];
            const motionPlan = motionPlans[0];
            if (cameraPlan && motionPlan) {
                bundles.push({ scene, cameraPlan, motionPlan });
            }
        }
        return bundles;
    }
    registerGenerationAsset(record, scene) {
        this.foundation.assetRegistry.registerAsset({
            assetId: record.animationPlanId,
            assetType: GenerationAssetType.Template,
            assetName: `Animation Plan — Scene ${scene.structure.sceneOrder}: ${scene.structure.scenePurpose}`,
            projectId: record.profile.projectId,
            sceneId: record.profile.sceneId,
            ...createDefaultGenerationAssetQuality(VideoGenerationSource.System),
            qualityScore: record.scores.animationQualityScore,
            confidenceScore: record.scores.aiConfidenceScore,
            relationshipLinks: [
                scene.sceneId,
                record.profile.motionPlanId,
                record.profile.cameraPlanId,
                record.animationPlanId,
            ],
            relatedProducts: record.relationships.products,
            relatedBrands: record.relationships.brands,
            relatedCampaigns: record.relationships.campaigns,
            relatedKnowledge: record.relationships.knowledgeRecords,
            relatedProductionPlans: record.relationships.motionPlans,
        });
    }
    applySafeRepairs(draft, diagnostics) {
        const repairs = [];
        if (diagnostics.some((d) => d.includes("Motion synchronization"))) {
            draft.synchronization.motionSync = ["T0s: repair sync — aligned to scene duration"];
            repairs.push("Added default motion sync");
        }
        if (diagnostics.some((d) => d.includes("Animation duration"))) {
            draft.timeline.animationDuration = draft.timeline.animationDuration || "8s";
            repairs.push("Set default animation duration");
        }
        return { repaired: repairs.length > 0, repairs };
    }
    reject(start, message, diagnostics) {
        this.logger.log("warn", "validation", message, { diagnostics });
        return { success: false, durationMs: Date.now() - start, diagnostics, message };
    }
}
//# sourceMappingURL=animation-generation-processor.js.map