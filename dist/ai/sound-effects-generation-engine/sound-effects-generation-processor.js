import { AudioGenerationAssetType, AudioGenerationHealthLevel, AudioGenerationSource, AudioGenerationVerificationStatus, } from "../audio-generation-foundation/types.js";
import { createDefaultGenerationAssetQuality } from "../audio-generation-foundation/audio-generation-asset-registry.js";
import { FoleyType, } from "./types.js";
export class SoundEffectsGenerationProcessor {
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
    async generateSoundEffectPlan(input) {
        const start = Date.now();
        this.foundation.setLifecycleGenerating();
        try {
            const context = await this.resolveContext(input);
            if (!context && !input.soundPrompt && !input.videoId && !input.animationId) {
                return this.reject(start, "Unable to resolve sound context — provide productId or sound prompt", [
                    "Product intelligence pipeline or sound prompt required",
                ]);
            }
            const resolvedContext = context ?? this.analyzer.extractContextFromInput(input);
            const platform = this.analyzer.resolvePlatform(input, resolvedContext);
            const productKey = resolvedContext.productId ?? "standalone";
            const existing = input.productId
                ? this.records.getByProduct(input.productId).find((r) => r.profile.platform === platform)
                : undefined;
            const version = existing ? existing.profile.version + 1 : 1;
            const soundAnalysis = this.analyzer.analyzeSound(input, resolvedContext);
            const profile = this.analyzer.buildProfile(input, platform, version, resolvedContext, soundAnalysis);
            const soundEffectPlan = this.analyzer.buildSoundEffectPlan(soundAnalysis, profile.soundCategory);
            const foleyPlan = this.analyzer.buildFoleyPlan(soundAnalysis, profile.soundCategory);
            const environmentalPlan = this.analyzer.buildEnvironmentalPlan(resolvedContext, soundAnalysis);
            const cinematicPlan = this.analyzer.buildCinematicPlan(soundAnalysis, profile.soundCategory);
            const timelinePlan = this.analyzer.buildTimelinePlan(soundAnalysis, soundEffectPlan);
            const syncPreparation = this.analyzer.buildSyncPreparation(input, soundAnalysis, platform);
            const productionInstructions = this.analyzer.buildProductionInstructions(profile, soundAnalysis, timelinePlan);
            const recommendations = this.analyzer.buildRecommendations(soundAnalysis, resolvedContext, profile.soundCategory);
            const scores = this.scorer.computeScores(soundAnalysis, soundEffectPlan, foleyPlan, environmentalPlan, cinematicPlan, timelinePlan, syncPreparation, productionInstructions, resolvedContext);
            const validation = this.scorer.isSoundPlanValid(scores, {
                soundAnalysis,
                soundEffectPlan,
                foleyPlan,
                environmentalPlan,
                timelinePlan,
                syncPreparation,
            });
            if (!validation.valid) {
                const repaired = this.applySafeRepairs(soundEffectPlan, foleyPlan, environmentalPlan, timelinePlan, syncPreparation, validation.diagnostics);
                if (repaired.repaired) {
                    this.logger.log("info", "validation", "Safe repairs applied", { repairs: repaired.repairs });
                }
                const revalidation = this.scorer.isSoundPlanValid(scores, {
                    soundAnalysis,
                    soundEffectPlan,
                    foleyPlan,
                    environmentalPlan,
                    timelinePlan,
                    syncPreparation,
                });
                if (!revalidation.valid) {
                    this.logger.log("warn", "validation", "Sound effect plan rejected", { diagnostics: revalidation.diagnostics });
                    return {
                        success: false,
                        durationMs: Date.now() - start,
                        diagnostics: revalidation.diagnostics,
                        message: "Sound effects validation failed — all validations must pass before approval",
                    };
                }
            }
            const productionReady = this.scorer.isProductionReady(scores, {
                soundPlanId: profile.soundPlanId,
                profile,
                soundAnalysis,
                soundEffectPlan,
                foleyPlan,
                environmentalPlan,
                cinematicPlan,
                timelinePlan,
                syncPreparation,
                productionInstructions,
                scores,
                relationships: {
                    soundPlans: [],
                    musicPlans: [],
                    voicePlans: [],
                    products: [],
                    brands: [],
                    campaigns: [],
                    videos: [],
                    images: [],
                    knowledgeRecords: [],
                },
                recommendations,
                validated: true,
                productionReady: false,
                brandConsistent: false,
                createdAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString(),
            });
            const brandConsistent = this.scorer.isBrandConsistent(resolvedContext, productionInstructions);
            const blueprint = this.foundation.getBlueprintManager().createBlueprint({
                blueprintId: `blueprint-${profile.soundPlanId}`,
                projectId: profile.projectId,
                name: `SFX ${profile.soundCategory} ${platform}`,
            });
            const draft = {
                soundPlanId: profile.soundPlanId,
                profile,
                soundAnalysis,
                soundEffectPlan,
                foleyPlan,
                environmentalPlan,
                cinematicPlan,
                timelinePlan,
                syncPreparation,
                productionInstructions,
                blueprintId: blueprint.blueprintId,
                scores,
                relationships: {
                    soundPlans: [profile.soundPlanId],
                    musicPlans: [],
                    voicePlans: [],
                    products: [],
                    brands: [],
                    campaigns: [],
                    videos: [],
                    images: [],
                    knowledgeRecords: [],
                },
                recommendations,
                validated: true,
                productionReady,
                brandConsistent,
                createdAt: existing?.createdAt ?? new Date().toISOString(),
                lastUpdated: new Date().toISOString(),
            };
            draft.relationships = this.linker.detectRelationships(draft, input, resolvedContext.creative, resolvedContext.strategy, resolvedContext.understanding);
            const generationValidation = this.foundation.validateGeneration({
                qualityScore: scores.realismScore,
                confidenceScore: scores.aiConfidenceScore,
                verificationStatus: scores.aiConfidenceScore >= 75
                    ? AudioGenerationVerificationStatus.Verified
                    : AudioGenerationVerificationStatus.Pending,
                source: AudioGenerationSource.Prompt,
                sourceRef: draft.soundPlanId,
                versionHistory: [
                    {
                        version,
                        timestamp: new Date().toISOString(),
                        changeSummary: `SFX plan v${version} — ${platform} ${profile.soundCategory}`,
                        source: AudioGenerationSource.Prompt,
                    },
                ],
                relationshipLinks: [
                    ...draft.relationships.products,
                    ...draft.relationships.soundPlans,
                    ...draft.relationships.videos,
                ],
                healthStatus: AudioGenerationHealthLevel.Good,
            });
            if (!generationValidation.valid) {
                return {
                    success: false,
                    durationMs: Date.now() - start,
                    diagnostics: generationValidation.issues,
                    message: "Audio generation foundation validation failed for sound effect plan",
                };
            }
            this.records.upsert(draft);
            this.registerGenerationAssets(draft);
            this.logger.log("info", "blueprint-generation", "Sound effect plan generated", {
                soundPlanId: draft.soundPlanId,
                platform,
                productionReady,
                durationMs: Date.now() - start,
            });
            this.logger.log("info", "sound-analysis", "Sound analyzed", {
                soundPlanId: draft.soundPlanId,
                scene: soundAnalysis.scene,
                category: profile.soundCategory,
            });
            this.logger.log("info", "foley-planning", "Foley planned", {
                soundPlanId: draft.soundPlanId,
                types: foleyPlan.foleyTypes,
            });
            this.logger.log("info", "sound-planning", "Sound layers planned", {
                soundPlanId: draft.soundPlanId,
                realismScore: scores.realismScore,
            });
            if (recommendations.length > 0) {
                this.logger.log("info", "recommendation", "SFX recommendations", {
                    soundPlanId: draft.soundPlanId,
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
        if (query.soundPlanId)
            results = results.filter((r) => r.soundPlanId === query.soundPlanId);
        if (query.productId)
            results = results.filter((r) => r.relationships.products.includes(query.productId));
        if (query.brandId)
            results = results.filter((r) => r.profile.brandId === query.brandId);
        if (query.soundCategory)
            results = results.filter((r) => r.profile.soundCategory === query.soundCategory);
        if (query.platform)
            results = results.filter((r) => r.profile.platform === query.platform);
        if (query.syncTarget)
            results = results.filter((r) => r.syncPreparation.syncTarget === query.syncTarget);
        if (query.scene) {
            const scene = query.scene.toLowerCase();
            results = results.filter((r) => r.soundAnalysis.scene.toLowerCase().includes(scene));
        }
        if (query.keywords) {
            const kw = query.keywords.toLowerCase();
            results = results.filter((r) => r.soundAnalysis.keywords.some((k) => k.includes(kw)) ||
                r.soundAnalysis.scene.toLowerCase().includes(kw));
        }
        if (query.text) {
            const textLower = query.text.toLowerCase();
            results = results.filter((r) => r.soundPlanId.toLowerCase().includes(textLower) ||
                r.profile.soundCategory.toLowerCase().includes(textLower));
        }
        return results.slice(0, query.limit ?? 50);
    }
    async resolveContext(input) {
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
                return this.analyzer.extractContextFromProduct(input.productId, analysis?.profile.productName ?? understanding?.identity.productName ?? input.productId, analysis?.profile.brand ?? understanding?.identity.brand ?? input.brandName ?? "Brand", understanding, creative, strategy, input);
            }
        }
        if (input.soundPrompt || input.videoId || input.imageId || input.animationId || input.brandGuidelines) {
            return this.analyzer.extractContextFromInput(input);
        }
        return null;
    }
    registerGenerationAssets(record) {
        this.foundation.getAssetRegistry().registerAsset({
            assetId: record.soundPlanId,
            assetType: AudioGenerationAssetType.SoundEffect,
            assetName: `SFX Plan ${record.profile.soundCategory} v${record.profile.version}`,
            projectId: record.profile.projectId,
            ...createDefaultGenerationAssetQuality(AudioGenerationSource.Prompt),
            qualityScore: record.scores.realismScore,
            confidenceScore: record.scores.aiConfidenceScore,
            relationshipLinks: [...record.relationships.soundPlans, ...record.relationships.products],
            relatedProducts: record.relationships.products,
            relatedBrands: record.relationships.brands,
            relatedCampaigns: record.relationships.campaigns,
            relatedKnowledge: record.relationships.knowledgeRecords,
        });
        this.foundation.getAssetRegistry().registerAsset({
            assetId: `foley-${record.soundPlanId}`,
            assetType: AudioGenerationAssetType.Template,
            assetName: `Foley Blueprint ${record.profile.soundCategory}`,
            projectId: record.profile.projectId,
            ...createDefaultGenerationAssetQuality(AudioGenerationSource.Prompt),
            qualityScore: record.scores.layerQualityScore,
            confidenceScore: record.scores.aiConfidenceScore,
            relationshipLinks: [record.soundPlanId],
            relatedProducts: record.relationships.products,
        });
        if (record.relationships.videos.length > 0) {
            for (const videoId of record.relationships.videos) {
                this.foundation.getAssetRegistry().registerAsset({
                    assetId: `sfx-video-link-${record.soundPlanId}-${videoId}`,
                    assetType: AudioGenerationAssetType.AudioTrack,
                    assetName: `SFX-Video Sync ${record.profile.platform}`,
                    projectId: record.profile.projectId,
                    trackId: record.soundPlanId,
                    ...createDefaultGenerationAssetQuality(AudioGenerationSource.Prompt),
                    qualityScore: record.scores.synchronizationScore,
                    confidenceScore: record.scores.aiConfidenceScore,
                    relationshipLinks: [record.soundPlanId, videoId],
                    relatedProducts: record.relationships.products,
                });
            }
        }
    }
    applySafeRepairs(soundPlan, foley, environmental, timeline, sync, diagnostics) {
        const repairs = [];
        if (diagnostics.some((d) => d.includes("sound layers"))) {
            if (soundPlan.foleySounds.length < 1)
                soundPlan.foleySounds.push("default foley");
            if (soundPlan.transitionSounds.length < 1)
                soundPlan.transitionSounds.push("whoosh");
            repairs.push("Default sound layers applied");
        }
        if (diagnostics.some((d) => d.includes("Foley"))) {
            if (foley.foleyTypes.length < 1)
                foley.foleyTypes.push(FoleyType.Footsteps);
            repairs.push("Default foley type applied");
        }
        if (diagnostics.some((d) => d.includes("Environmental"))) {
            if (environmental.ambientLayers.length < 1)
                environmental.ambientLayers.push("room tone bed");
            repairs.push("Default ambient layer applied");
        }
        if (diagnostics.some((d) => d.includes("Timeline"))) {
            if (timeline.cuePoints.length < 3) {
                timeline.cuePoints.push({ timeSec: 0, label: "Start", soundType: "fade-in" }, { timeSec: 5, label: "Action", soundType: "foley" }, { timeSec: 10, label: "End", soundType: "fade-out" });
                repairs.push("Default timeline cue points applied");
            }
        }
        if (diagnostics.some((d) => d.includes("Sync preparation"))) {
            if (sync.hitPoints.length < 1)
                sync.hitPoints.push("Primary hit at midpoint");
            repairs.push("Default sync hit point applied");
        }
        return { repaired: repairs.length > 0, repairs };
    }
    reject(start, message, diagnostics) {
        this.logger.log("warn", "validation", message, { diagnostics });
        return { success: false, durationMs: Date.now() - start, diagnostics, message };
    }
}
//# sourceMappingURL=sound-effects-generation-processor.js.map