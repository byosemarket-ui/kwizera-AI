import { GenerationAssetType, VideoGenerationHealthLevel, VideoGenerationSource, VideoGenerationVerificationStatus, } from "../video-generation-foundation/types.js";
import { createDefaultGenerationAssetQuality } from "../video-generation-foundation/generation-asset-registry.js";
export class StoryGenerationProcessor {
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
    async generateStoryboard(input) {
        const start = Date.now();
        this.foundation.setLifecycleGenerating();
        try {
            const context = await this.resolveContext(input);
            if (!context) {
                return this.reject(start, "Unable to resolve generation context — provide productId or textPrompt", [
                    "Product intelligence pipeline or text prompt required",
                ]);
            }
            const platform = this.analyzer.resolvePlatform(input, context);
            const existing = input.storyboardIntelligenceId
                ? this.records.get(input.storyboardIntelligenceId)
                : input.productId
                    ? this.records.getByProduct(input.productId).find((r) => r.profile.platform === platform)
                    : undefined;
            const version = existing ? existing.profile.version + 1 : 1;
            const profile = this.analyzer.buildProfile(input, platform, version, context);
            const includeSocialProof = input.includeSocialProof ?? true;
            const storyStructure = this.analyzer.buildStoryStructure(context, input);
            const scenes = this.analyzer.buildScenes(profile, storyStructure, context, includeSocialProof);
            profile.totalScenes = scenes.length;
            profile.totalShots = scenes.reduce((s, sc) => s + sc.shots.length, 0);
            const visualPlanning = this.analyzer.buildVisualPlanning(context);
            const audioPlanning = this.analyzer.buildAudioPlanning(context, profile);
            const marketingPlanning = this.analyzer.buildMarketingPlanning(context, storyStructure);
            const viewerJourney = this.analyzer.buildViewerJourney(storyStructure);
            const cinematicPlanning = this.analyzer.buildCinematicPlanning(context, profile);
            const productionStructure = this.analyzer.buildProductionStructure(storyStructure);
            const platformVariations = input.generatePlatformVariations !== false
                ? this.analyzer.buildPlatformVariations(profile, scenes)
                : this.analyzer.buildPlatformVariations(profile, scenes).filter((v) => v.platform === platform);
            const recommendations = this.analyzer.buildRecommendations(scenes, context);
            const scores = this.scorer.computeScores(scenes, storyStructure, visualPlanning, audioPlanning, marketingPlanning, cinematicPlanning, platformVariations, context);
            const validation = this.scorer.isStoryboardValid(scores, scenes);
            if (!validation.valid) {
                const repaired = this.applySafeRepairs(scenes, storyStructure, validation.diagnostics);
                if (repaired.repaired) {
                    this.logger.log("info", "validation", "Safe repairs applied", { repairs: repaired.repairs });
                }
                const revalidation = this.scorer.isStoryboardValid(scores, scenes);
                if (!revalidation.valid) {
                    this.logger.log("warn", "validation", "Storyboard generation rejected", {
                        diagnostics: revalidation.diagnostics,
                    });
                    return {
                        success: false,
                        durationMs: Date.now() - start,
                        diagnostics: revalidation.diagnostics,
                        message: "Storyboard validation failed — all validations must pass before approval",
                    };
                }
            }
            const productionReady = this.scorer.isProductionReady(scores, scenes);
            const marketingReady = this.scorer.isMarketingReady(scores, storyStructure);
            const brandConsistent = this.scorer.isBrandConsistent(context, visualPlanning);
            const draft = {
                storyboardId: profile.storyboardId,
                profile,
                storyStructure,
                scenes,
                visualPlanning,
                audioPlanning,
                marketingPlanning,
                viewerJourney,
                cinematicPlanning,
                platformVariations,
                productionStructure,
                scores,
                relationships: {
                    products: [],
                    brands: [],
                    campaigns: [],
                    scripts: [],
                    images: [],
                    videos: [],
                    audio: [],
                    knowledgeRecords: [],
                    productionPlans: [],
                    storyboardIntelligenceIds: [],
                    creativeDirections: [],
                    marketingStrategies: [],
                },
                recommendations,
                validated: true,
                productionReady,
                marketingReady,
                brandConsistent,
                createdAt: existing?.createdAt ?? new Date().toISOString(),
                lastUpdated: new Date().toISOString(),
            };
            draft.relationships = this.linker.detectRelationships(draft, input, context.intelligence, context.creative, context.strategy, context.understanding);
            const generationValidation = this.foundation.validateGeneration({
                qualityScore: scores.storyQualityScore,
                confidenceScore: scores.aiConfidenceScore,
                verificationStatus: scores.aiConfidenceScore >= 75
                    ? VideoGenerationVerificationStatus.Verified
                    : VideoGenerationVerificationStatus.Pending,
                source: VideoGenerationSource.Storyboard,
                sourceRef: draft.storyboardId,
                versionHistory: [
                    {
                        version,
                        timestamp: new Date().toISOString(),
                        changeSummary: `Storyboard v${version} — ${scenes.length} scenes, ${profile.totalShots} shots`,
                        source: VideoGenerationSource.Storyboard,
                    },
                ],
                relationshipLinks: [
                    ...draft.relationships.products,
                    ...draft.relationships.storyboardIntelligenceIds,
                    ...draft.relationships.creativeDirections,
                ],
                healthStatus: VideoGenerationHealthLevel.Good,
            });
            if (!generationValidation.valid) {
                return {
                    success: false,
                    durationMs: Date.now() - start,
                    diagnostics: generationValidation.issues,
                    message: "Video generation foundation validation failed for storyboard",
                };
            }
            this.records.upsert(draft);
            this.registerGenerationAsset(draft);
            this.logger.log("info", "generation", "Storyboard generated", {
                storyboardId: draft.storyboardId,
                scenes: scenes.length,
                shots: profile.totalShots,
                productionReady,
                durationMs: Date.now() - start,
            });
            this.logger.log("info", "scene-planning", "Scene sequences planned", {
                storyboardId: draft.storyboardId,
                sceneCount: scenes.length,
            });
            this.logger.log("info", "shot-planning", "Shot sequences planned", {
                storyboardId: draft.storyboardId,
                shotCount: profile.totalShots,
            });
            if (recommendations.length > 0) {
                this.logger.log("info", "recommendation", "Generation recommendations", {
                    storyboardId: draft.storyboardId,
                    recommendations,
                });
            }
            return { success: true, record: draft, durationMs: Date.now() - start, diagnostics: [] };
        }
        finally {
            this.foundation.setLifecycleReady();
        }
    }
    search(query) {
        let results = this.records.getAll();
        if (query.storyboardId)
            results = results.filter((r) => r.storyboardId === query.storyboardId);
        if (query.productId)
            results = results.filter((r) => r.profile.productId === query.productId);
        if (query.campaignId)
            results = results.filter((r) => r.profile.campaignId === query.campaignId);
        if (query.brandId)
            results = results.filter((r) => r.profile.brandId === query.brandId);
        if (query.platform)
            results = results.filter((r) => r.profile.platform === query.platform);
        if (query.storyType)
            results = results.filter((r) => r.profile.storyType === query.storyType);
        if (query.keywords) {
            const kw = query.keywords.toLowerCase();
            results = results.filter((r) => r.storyStructure.openingHook.toLowerCase().includes(kw) ||
                r.storyStructure.callToAction.toLowerCase().includes(kw) ||
                r.scenes.some((s) => s.sceneObjective.toLowerCase().includes(kw)));
        }
        if (query.text) {
            const textLower = query.text.toLowerCase();
            results = results.filter((r) => r.storyboardId.toLowerCase().includes(textLower) ||
                r.storyStructure.openingHook.toLowerCase().includes(textLower));
        }
        return results.slice(0, query.limit ?? 50);
    }
    async resolveContext(input) {
        const bridge = this.foundation.integration;
        const productFoundation = bridge.getProductIntelligenceFoundation();
        if (input.productId && productFoundation) {
            const intelligenceEngine = productFoundation.getStoryboardIntelligenceEngine();
            let intelligence = input.storyboardIntelligenceId
                ? intelligenceEngine.getStoryboard(input.storyboardIntelligenceId)
                : intelligenceEngine.getStoryboardsByProduct(input.productId)[0];
            if (!intelligence?.validated) {
                const created = await intelligenceEngine.createStoryboard({
                    productId: input.productId,
                    projectId: input.projectId,
                    includeSocialProof: input.includeSocialProof,
                });
                if (created.success && created.record)
                    intelligence = created.record;
            }
            const creative = intelligence
                ? productFoundation.getCreativeDirectionEngine().getCreativeDirection(intelligence.creativeId)
                : null;
            const strategy = intelligence
                ? productFoundation.getMarketingStrategyIntelligenceEngine().getStrategy(intelligence.strategyId)
                : null;
            const understanding = productFoundation.getProductUnderstandingEngine().getUnderstanding(input.productId);
            if (intelligence?.validated) {
                return {
                    ...this.analyzer.extractContextFromIntelligence(intelligence, creative, strategy, understanding),
                    understanding,
                };
            }
        }
        if (input.textPrompt || input.creativeBrief || input.scriptText) {
            return this.analyzer.extractContextFromInput(input);
        }
        return null;
    }
    registerGenerationAsset(record) {
        this.foundation.assetRegistry.registerAsset({
            assetId: record.storyboardId,
            assetType: GenerationAssetType.Storyboard,
            assetName: `Storyboard ${record.profile.platform} v${record.profile.version}`,
            projectId: record.profile.projectId,
            ...createDefaultGenerationAssetQuality(VideoGenerationSource.Storyboard),
            qualityScore: record.scores.storyQualityScore,
            confidenceScore: record.scores.aiConfidenceScore,
            relationshipLinks: [
                ...record.relationships.products,
                ...record.relationships.storyboardIntelligenceIds,
            ],
            relatedProducts: record.relationships.products,
            relatedBrands: record.relationships.brands,
            relatedCampaigns: record.relationships.campaigns,
            relatedKnowledge: record.relationships.knowledgeRecords,
            relatedProductionPlans: record.relationships.productionPlans,
        });
    }
    applySafeRepairs(scenes, storyStructure, diagnostics) {
        const repairs = [];
        if (diagnostics.some((d) => d.includes("Opening hook"))) {
            if (!scenes.some((s) => s.scenePurpose === "opening-hook") && scenes.length > 0) {
                scenes[0].scenePurpose = "opening-hook";
                repairs.push("Reassigned first scene as opening hook");
            }
        }
        if (diagnostics.some((d) => d.includes("CTA"))) {
            if (!scenes.some((s) => s.scenePurpose === "call-to-action")) {
                const last = scenes[scenes.length - 1];
                if (last) {
                    last.scenePurpose = "call-to-action";
                    last.sceneObjective = storyStructure.callToAction;
                    repairs.push("Reassigned last scene as CTA");
                }
            }
        }
        for (const scene of scenes) {
            if (scene.shots.length === 0) {
                scene.shots = this.analyzer.buildShots(scene.sceneId, 1, scene.scenePurpose, scene.sceneMood, 5);
                repairs.push(`Added default shot to scene ${scene.sceneOrder}`);
            }
        }
        return { repaired: repairs.length > 0, repairs };
    }
    reject(start, message, diagnostics) {
        this.logger.log("warn", "validation", message, { diagnostics });
        return { success: false, durationMs: Date.now() - start, diagnostics, message };
    }
}
//# sourceMappingURL=story-generation-processor.js.map