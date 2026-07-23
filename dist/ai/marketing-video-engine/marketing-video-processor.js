import { GenerationAssetType, VideoGenerationHealthLevel, VideoGenerationSource, VideoGenerationVerificationStatus, } from "../video-generation-foundation/types.js";
import { createDefaultGenerationAssetQuality } from "../video-generation-foundation/generation-asset-registry.js";
export class MarketingVideoProcessor {
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
    async generateMarketingVideoPlans(input) {
        const start = Date.now();
        this.foundation.setLifecycleGenerating();
        try {
            const bundles = this.resolveBundles(input);
            if (bundles.length === 0) {
                return this.reject(start, "Audio sync plans and full upstream pipeline required", [
                    "Complete upstream pipeline required before marketing video planning",
                ]);
            }
            const generated = [];
            const allDiagnostics = [];
            for (const { storyboard, upstream } of bundles) {
                if (!storyboard.validated || !storyboard.productionReady) {
                    allDiagnostics.push(`${storyboard.storyboardId}: Storyboard not production-ready`);
                    continue;
                }
                const sceneInvalid = upstream.scenes.find((s) => !s.validated || !s.productionReady);
                if (sceneInvalid) {
                    allDiagnostics.push(`${storyboard.storyboardId}: Scene ${sceneInvalid.sceneId} not ready`);
                    continue;
                }
                const audioInvalid = upstream.audioPlans.find((a) => !a.validated || !a.productionReady);
                if (audioInvalid) {
                    allDiagnostics.push(`${storyboard.storyboardId}: Audio plan ${audioInvalid.audioSynchronizationId} not ready`);
                    continue;
                }
                const existing = this.records.getByStoryboard(storyboard.storyboardId)[0];
                const version = existing ? existing.profile.marketingVersion + 1 : 1;
                const draftBase = this.analyzer.buildMarketingVideoPlan(storyboard, upstream.scenes, upstream.audioPlans, version);
                const scores = this.scorer.computeScores(draftBase, storyboard, upstream.scenes, upstream.audioPlans);
                let validation = this.scorer.isPlanValid(scores, draftBase);
                if (!validation.valid) {
                    const repaired = this.applySafeRepairs(draftBase, validation.diagnostics);
                    if (repaired.repaired) {
                        this.logger.log("info", "validation", "Safe marketing video repairs applied", {
                            storyboardId: storyboard.storyboardId,
                            repairs: repaired.repairs,
                        });
                    }
                    validation = this.scorer.isPlanValid(scores, draftBase);
                    if (!validation.valid) {
                        allDiagnostics.push(...validation.diagnostics.map((d) => `${storyboard.storyboardId}: ${d}`));
                        continue;
                    }
                }
                const draft = {
                    ...draftBase,
                    scores,
                    relationships: this.linker.detectRelationships({ ...draftBase, scores }, storyboard, upstream, input),
                    recommendations: this.analyzer.buildRecommendations(draftBase),
                    validated: true,
                    productionReady: this.scorer.isProductionReady(scores, draftBase),
                    marketingReady: this.scorer.isMarketingReady(scores, storyboard),
                    brandConsistent: this.scorer.isBrandConsistent(storyboard, upstream.scenes),
                    createdAt: existing?.createdAt ?? new Date().toISOString(),
                    lastUpdated: new Date().toISOString(),
                };
                const generationValidation = this.foundation.validateGeneration({
                    qualityScore: scores.marketingQualityScore,
                    confidenceScore: scores.aiConfidenceScore,
                    verificationStatus: scores.aiConfidenceScore >= 75
                        ? VideoGenerationVerificationStatus.Verified
                        : VideoGenerationVerificationStatus.Pending,
                    source: VideoGenerationSource.ProductionPlan,
                    sourceRef: draft.marketingVideoId,
                    versionHistory: [
                        {
                            version,
                            timestamp: new Date().toISOString(),
                            changeSummary: `Marketing video plan v${version} — ${draft.planType}`,
                            source: VideoGenerationSource.ProductionPlan,
                        },
                    ],
                    relationshipLinks: [
                        ...draft.relationships.storyboards,
                        ...draft.relationships.audioPlans,
                        draft.marketingVideoId,
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
                this.logger.log("info", "planning", "Marketing video plan generated", {
                    marketingVideoId: draft.marketingVideoId,
                    planType: draft.planType,
                });
                this.logger.log("info", "hook", "Hook optimization recorded", {
                    marketingVideoId: draft.marketingVideoId,
                });
                this.logger.log("info", "cta", "CTA planning recorded", {
                    marketingVideoId: draft.marketingVideoId,
                });
                this.logger.log("info", "engagement", "Engagement optimization recorded", {
                    marketingVideoId: draft.marketingVideoId,
                });
            }
            if (generated.length === 0) {
                return {
                    success: false,
                    durationMs: Date.now() - start,
                    diagnostics: allDiagnostics.length > 0 ? allDiagnostics : ["No marketing video plans passed validation"],
                    message: "Marketing video planning failed — every plan must pass validation before approval",
                };
            }
            if (generated.some((p) => p.recommendations.length > 0)) {
                this.logger.log("info", "recommendation", "Marketing recommendations", {
                    count: generated.reduce((n, p) => n + p.recommendations.length, 0),
                });
            }
            this.logger.log("info", "relationship", "Marketing relationships linked", {
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
        if (query.marketingVideoId)
            results = results.filter((r) => r.marketingVideoId === query.marketingVideoId);
        if (query.storyboardId)
            results = results.filter((r) => r.profile.storyboardId === query.storyboardId);
        if (query.campaignId)
            results = results.filter((r) => r.relationships.campaigns.includes(query.campaignId));
        if (query.productId)
            results = results.filter((r) => r.relationships.products.includes(query.productId));
        if (query.brandId)
            results = results.filter((r) => r.relationships.brands.includes(query.brandId));
        if (query.platform)
            results = results.filter((r) => r.profile.platform === query.platform);
        if (query.planType)
            results = results.filter((r) => r.planType === query.planType);
        if (query.audience) {
            const a = query.audience.toLowerCase();
            results = results.filter((r) => r.profile.targetAudience.toLowerCase().includes(a));
        }
        if (query.marketingGoal) {
            const g = query.marketingGoal.toLowerCase();
            results = results.filter((r) => r.marketingStrategy.marketingGoal.toLowerCase().includes(g));
        }
        if (query.keywords) {
            const kw = query.keywords.toLowerCase();
            results = results.filter((r) => r.marketingStrategy.valueProposition.toLowerCase().includes(kw) ||
                r.marketingStrategy.marketingGoal.toLowerCase().includes(kw) ||
                r.hookOptimization.attentionHook.toLowerCase().includes(kw) ||
                r.callToAction.ctaStyle.toLowerCase().includes(kw) ||
                r.conversionOptimization.conversionPath.toLowerCase().includes(kw) ||
                r.conversionOptimization.purchaseMotivation.toLowerCase().includes(kw));
        }
        if (query.text) {
            const textLower = query.text.toLowerCase();
            results = results.filter((r) => r.marketingVideoId.toLowerCase().includes(textLower) ||
                r.profile.storyboardId.toLowerCase().includes(textLower));
        }
        return results.slice(0, query.limit ?? 50);
    }
    resolveBundles(input) {
        const storyEngine = this.foundation.getStoryGenerationEngine();
        const sceneEngine = this.foundation.getSceneGenerationEngine();
        const cameraEngine = this.foundation.getCameraDirectorEngine();
        const motionEngine = this.foundation.getMotionGenerationEngine();
        const animationEngine = this.foundation.getAnimationGenerationEngine();
        const vfxEngine = this.foundation.getVisualEffectsGenerationEngine();
        const audioEngine = this.foundation.getAudioSynchronizationEngine();
        let storyboards = [];
        if (input.storyboardId) {
            const story = storyEngine.getStoryboard(input.storyboardId);
            if (story)
                storyboards = [story];
        }
        else if (input.productId) {
            storyboards = storyEngine.getStoryboardsByProduct(input.productId);
        }
        const bundles = [];
        for (const storyboard of storyboards) {
            const scenes = sceneEngine.getScenesByStoryboard(storyboard.storyboardId);
            if (scenes.length === 0)
                continue;
            const cameraPlans = [];
            const motionPlans = [];
            const animationPlans = [];
            const visualEffectPlans = [];
            const audioPlans = [];
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
                    upstream: { scenes, cameraPlans, motionPlans, animationPlans, visualEffectPlans, audioPlans },
                });
            }
        }
        return bundles;
    }
    registerGenerationAsset(record, storyboard) {
        this.foundation.assetRegistry.registerAsset({
            assetId: record.marketingVideoId,
            assetType: GenerationAssetType.Timeline,
            assetName: `Marketing Video Plan — ${storyboard.profile.storyType} (${storyboard.profile.platform})`,
            projectId: record.profile.projectId,
            sceneId: record.relationships.scenes[0],
            ...createDefaultGenerationAssetQuality(VideoGenerationSource.ProductionPlan),
            qualityScore: record.scores.marketingQualityScore,
            confidenceScore: record.scores.aiConfidenceScore,
            relationshipLinks: [
                storyboard.storyboardId,
                ...record.relationships.audioPlans.slice(0, 3),
                record.marketingVideoId,
            ],
            relatedProducts: record.relationships.products,
            relatedBrands: record.relationships.brands,
            relatedCampaigns: record.relationships.campaigns,
            relatedKnowledge: record.relationships.knowledgeRecords,
            relatedProductionPlans: record.relationships.marketingPlans,
        });
    }
    applySafeRepairs(draft, diagnostics) {
        const repairs = [];
        if (diagnostics.some((d) => d.includes("First 3 seconds"))) {
            draft.hookOptimization.first3SecondsStrategy = "Pattern interrupt — attention capture within 3 seconds";
            repairs.push("Set default first 3 seconds strategy");
        }
        if (diagnostics.some((d) => d.includes("CTA timing"))) {
            draft.callToAction.ctaTiming = "Final 5 seconds — primary CTA hold";
            repairs.push("Set default CTA timing");
        }
        if (diagnostics.some((d) => d.includes("A/B hook"))) {
            draft.abTestPreparation.hookVariants = ["Variant A: Direct hook", "Variant B: Question hook"];
            repairs.push("Added default hook variants");
        }
        return { repaired: repairs.length > 0, repairs };
    }
    reject(start, message, diagnostics) {
        this.logger.log("warn", "validation", message, { diagnostics });
        return { success: false, durationMs: Date.now() - start, diagnostics, message };
    }
}
//# sourceMappingURL=marketing-video-processor.js.map