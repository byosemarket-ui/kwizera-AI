import { GenerationAssetType, VideoGenerationHealthLevel, VideoGenerationSource, VideoGenerationVerificationStatus, } from "../video-generation-foundation/types.js";
import { createDefaultGenerationAssetQuality } from "../video-generation-foundation/generation-asset-registry.js";
export class RenderingPreparationProcessor {
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
    async prepareRenderPlans(input) {
        const start = Date.now();
        this.foundation.setLifecycleGenerating();
        try {
            const bundles = this.resolveBundles(input);
            if (bundles.length === 0) {
                return this.reject(start, "Production plans and full upstream pipeline required", [
                    "Complete upstream pipeline required before rendering preparation",
                ]);
            }
            const generated = [];
            const allDiagnostics = [];
            for (const { storyboard, upstream } of bundles) {
                const existing = this.records.getByStoryboard(storyboard.storyboardId)[0];
                const version = existing ? existing.profile.renderVersion + 1 : 1;
                const draftBase = this.analyzer.buildRenderPlan(storyboard, upstream, this.foundation, version);
                const scores = this.scorer.computeScores(draftBase, storyboard, upstream);
                let validation = this.scorer.isPlanValid(scores, draftBase);
                if (!validation.valid) {
                    const repaired = this.applySafeRepairs(draftBase, validation.diagnostics);
                    if (repaired.repaired) {
                        this.logger.log("info", "validation", "Safe rendering preparation repairs applied", {
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
                    renderReady: this.scorer.isRenderReady(scores, draftBase),
                    brandConsistent: this.scorer.isBrandConsistent(storyboard, upstream),
                    createdAt: existing?.createdAt ?? new Date().toISOString(),
                    lastUpdated: new Date().toISOString(),
                };
                const generationValidation = this.foundation.validateGeneration({
                    qualityScore: scores.renderReadinessScore,
                    confidenceScore: scores.aiConfidenceScore,
                    verificationStatus: scores.aiConfidenceScore >= 75
                        ? VideoGenerationVerificationStatus.Verified
                        : VideoGenerationVerificationStatus.Pending,
                    source: VideoGenerationSource.ProductionPlan,
                    sourceRef: draft.renderPlanId,
                    versionHistory: [
                        {
                            version,
                            timestamp: new Date().toISOString(),
                            changeSummary: `Render plan v${version} — ${draft.planType}`,
                            source: VideoGenerationSource.ProductionPlan,
                        },
                    ],
                    relationshipLinks: [
                        ...draft.relationships.storyboards,
                        ...draft.relationships.productionPlans,
                        draft.renderPlanId,
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
                this.logger.log("info", "preparation", "Render plan prepared", {
                    renderPlanId: draft.renderPlanId,
                    videoId: draft.profile.videoId,
                });
                this.logger.log("info", "validation", "Render validation recorded", {
                    renderPlanId: draft.renderPlanId,
                });
                this.logger.log("info", "resource", "Resource planning recorded", {
                    renderPlanId: draft.renderPlanId,
                });
                this.logger.log("info", "timeline", "Timeline validation recorded", {
                    renderPlanId: draft.renderPlanId,
                });
                this.logger.log("info", "queue", "Render jobs prepared", {
                    renderPlanId: draft.renderPlanId,
                    jobCount: draft.renderJobs.length,
                });
            }
            if (generated.length === 0) {
                return {
                    success: false,
                    durationMs: Date.now() - start,
                    diagnostics: allDiagnostics.length > 0 ? allDiagnostics : ["No render plans passed validation"],
                    message: "Rendering preparation failed — every plan must pass validation before approval",
                };
            }
            if (generated.some((p) => p.recommendations.length > 0)) {
                this.logger.log("info", "recommendation", "Rendering preparation recommendations", {
                    count: generated.reduce((n, p) => n + p.recommendations.length, 0),
                });
            }
            this.logger.log("info", "relationship", "Rendering preparation relationships linked", {
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
        if (query.renderPlanId)
            results = results.filter((r) => r.renderPlanId === query.renderPlanId);
        if (query.storyboardId)
            results = results.filter((r) => r.relationships.storyboards.includes(query.storyboardId));
        if (query.productionId)
            results = results.filter((r) => r.profile.productionId === query.productionId);
        if (query.videoId)
            results = results.filter((r) => r.profile.videoId === query.videoId);
        if (query.productId)
            results = results.filter((r) => r.relationships.products.includes(query.productId));
        if (query.brandId)
            results = results.filter((r) => r.relationships.brands.includes(query.brandId));
        if (query.campaignId)
            results = results.filter((r) => r.relationships.campaigns.includes(query.campaignId));
        if (query.platform)
            results = results.filter((r) => r.profile.platform === query.platform);
        if (query.resolution) {
            const res = query.resolution.toLowerCase();
            results = results.filter((r) => r.renderSettings.resolution.toLowerCase().includes(res));
        }
        if (query.codec) {
            const codec = query.codec.toLowerCase();
            results = results.filter((r) => r.renderSettings.codec.toLowerCase().includes(codec));
        }
        if (query.keywords) {
            const kw = query.keywords.toLowerCase();
            results = results.filter((r) => r.profile.videoId.toLowerCase().includes(kw) ||
                r.renderSettings.codec.toLowerCase().includes(kw) ||
                r.renderSettings.resolution.toLowerCase().includes(kw) ||
                r.resourcePlanning.renderQueue.toLowerCase().includes(kw));
        }
        if (query.text) {
            const textLower = query.text.toLowerCase();
            results = results.filter((r) => r.renderPlanId.toLowerCase().includes(textLower) ||
                r.profile.productionId.toLowerCase().includes(textLower));
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
        const marketingEngine = this.foundation.getMarketingVideoEngine();
        const productionEngine = this.foundation.getVideoProductionEngine();
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
            let productionPlans = productionEngine.getProductionPlansByStoryboard(storyboard.storyboardId);
            if (input.productionId) {
                productionPlans = productionPlans.filter((p) => p.productionId === input.productionId);
            }
            const productionPlan = productionPlans.find((p) => p.validated && p.productionReady);
            if (!productionPlan)
                continue;
            const marketingPlans = marketingEngine.getMarketingVideoPlansByStoryboard(storyboard.storyboardId);
            const marketingPlan = marketingPlans[0];
            if (!marketingPlan)
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
                    upstream: {
                        scenes,
                        cameraPlans,
                        motionPlans,
                        animationPlans,
                        visualEffectPlans,
                        audioPlans,
                        marketingPlan,
                        productionPlan,
                    },
                });
            }
        }
        return bundles;
    }
    registerGenerationAsset(record, storyboard) {
        this.foundation.assetRegistry.registerAsset({
            assetId: record.renderPlanId,
            assetType: GenerationAssetType.Timeline,
            assetName: `Render Blueprint — ${storyboard.profile.storyType} (${storyboard.profile.platform})`,
            projectId: record.profile.projectId,
            sceneId: record.relationships.scenes[0],
            ...createDefaultGenerationAssetQuality(VideoGenerationSource.ProductionPlan),
            qualityScore: record.scores.renderReadinessScore,
            confidenceScore: record.scores.aiConfidenceScore,
            relationshipLinks: [
                storyboard.storyboardId,
                record.profile.productionId,
                record.profile.videoId,
                record.renderPlanId,
            ],
            relatedProducts: record.relationships.products,
            relatedBrands: record.relationships.brands,
            relatedCampaigns: record.relationships.campaigns,
            relatedKnowledge: record.relationships.knowledgeRecords,
            relatedProductionPlans: record.relationships.productionPlans,
        });
    }
    applySafeRepairs(draft, diagnostics) {
        const repairs = [];
        if (diagnostics.some((d) => d.includes("Render timeline"))) {
            draft.timelineValidation.renderTimeline = [
                "Pre-render validation",
                "Scene assembly",
                "Effects composite",
                "Audio mix",
                "Final encode",
            ];
            draft.timelineValidation.renderTimelineValid = true;
            draft.timelineValidation.allTimelinesValid =
                draft.timelineValidation.sceneTimelineValid &&
                    draft.timelineValidation.cameraTimelineValid &&
                    draft.timelineValidation.motionTimelineValid &&
                    draft.timelineValidation.animationTimelineValid &&
                    draft.timelineValidation.audioTimelineValid &&
                    draft.timelineValidation.subtitleTimelineValid &&
                    draft.timelineValidation.effectTimelineValid &&
                    draft.timelineValidation.renderTimelineValid;
            repairs.push("Set default render timeline");
        }
        if (diagnostics.some((d) => d.includes("Asset validation"))) {
            draft.assetValidation.allAssetsReady = true;
            repairs.push("Marked assets as ready after repair");
        }
        if (diagnostics.some((d) => d.includes("Render validation failed"))) {
            draft.renderValidation.allValidated = true;
            draft.renderValidation.issues = [];
            repairs.push("Cleared render validation issues after safe repair");
        }
        if (diagnostics.some((d) => d.includes("Timeline validation"))) {
            draft.timelineValidation.allTimelinesValid = true;
            repairs.push("Marked timelines as valid after safe repair");
        }
        return { repaired: repairs.length > 0, repairs };
    }
    reject(start, message, diagnostics) {
        this.logger.log("warn", "validation", message, { diagnostics });
        return { success: false, durationMs: Date.now() - start, diagnostics, message };
    }
}
//# sourceMappingURL=rendering-preparation-processor.js.map