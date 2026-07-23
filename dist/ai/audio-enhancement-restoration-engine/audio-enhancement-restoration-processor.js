import { AudioGenerationAssetType, AudioGenerationHealthLevel, AudioGenerationSource, AudioGenerationVerificationStatus, } from "../audio-generation-foundation/types.js";
import { createDefaultGenerationAssetQuality } from "../audio-generation-foundation/audio-generation-asset-registry.js";
import { EnhancementTechnique, RestorationTechnique, } from "./types.js";
export class AudioEnhancementRestorationProcessor {
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
    async generateEnhancementPlan(input) {
        const start = Date.now();
        this.foundation.setLifecycleGenerating();
        try {
            const context = await this.resolveContext(input);
            if (!context && !input.audioPrompt && !input.audioAssetId && !input.audioRef) {
                return this.reject(start, "Unable to resolve audio context — provide productId or audio prompt", [
                    "Product intelligence pipeline or audio prompt required",
                ]);
            }
            const resolvedContext = context ?? this.analyzer.extractContextFromInput(input);
            const platform = this.analyzer.resolvePlatform(input, resolvedContext);
            const existing = input.productId
                ? this.records.getByProduct(input.productId).find((r) => r.profile.platform === platform)
                : undefined;
            const version = existing ? existing.profile.version + 1 : 1;
            const audioQualityAnalysis = this.analyzer.analyzeAudioQuality(input, resolvedContext);
            const profile = this.analyzer.buildProfile(input, platform, version, resolvedContext, audioQualityAnalysis);
            const enhancementPlan = this.analyzer.buildEnhancementPlan(audioQualityAnalysis, platform);
            const restorationPlan = this.analyzer.buildRestorationPlan(audioQualityAnalysis);
            const voiceImprovementPlan = this.analyzer.buildVoiceImprovementPlan(audioQualityAnalysis);
            const musicImprovementPlan = this.analyzer.buildMusicImprovementPlan(audioQualityAnalysis);
            const syncPlan = this.analyzer.buildSyncPlan(input, audioQualityAnalysis);
            const outputPreparation = this.analyzer.buildOutputPreparation(platform, audioQualityAnalysis);
            const productionInstructions = this.analyzer.buildProductionInstructions(profile, audioQualityAnalysis, enhancementPlan, restorationPlan);
            const recommendations = this.analyzer.buildRecommendations(audioQualityAnalysis, resolvedContext, profile.enhancementType);
            const scores = this.scorer.computeScores(audioQualityAnalysis, enhancementPlan, restorationPlan, voiceImprovementPlan, musicImprovementPlan, syncPlan, productionInstructions, resolvedContext);
            const validation = this.scorer.isEnhancementPlanValid(scores, {
                audioQualityAnalysis,
                enhancementPlan,
                restorationPlan,
                syncPlan,
                voiceImprovementPlan,
            });
            if (!validation.valid) {
                const repaired = this.applySafeRepairs(enhancementPlan, restorationPlan, syncPlan, voiceImprovementPlan, validation.diagnostics);
                if (repaired.repaired) {
                    this.logger.log("info", "validation", "Safe repairs applied", { repairs: repaired.repairs });
                }
                const revalidation = this.scorer.isEnhancementPlanValid(scores, {
                    audioQualityAnalysis,
                    enhancementPlan,
                    restorationPlan,
                    syncPlan,
                    voiceImprovementPlan,
                });
                if (!revalidation.valid) {
                    this.logger.log("warn", "validation", "Enhancement plan rejected", { diagnostics: revalidation.diagnostics });
                    return {
                        success: false,
                        durationMs: Date.now() - start,
                        diagnostics: revalidation.diagnostics,
                        message: "Audio enhancement validation failed — all validations must pass before approval",
                    };
                }
            }
            const productionReady = this.scorer.isProductionReady(scores, {
                enhancementPlanId: profile.enhancementPlanId,
                profile,
                audioQualityAnalysis,
                enhancementPlan,
                restorationPlan,
                voiceImprovementPlan,
                musicImprovementPlan,
                syncPlan,
                outputPreparation,
                productionInstructions,
                scores,
                relationships: {
                    enhancementPlans: [],
                    voicePlans: [],
                    musicPlans: [],
                    ambientPlans: [],
                    soundPlans: [],
                    products: [],
                    brands: [],
                    campaigns: [],
                    videos: [],
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
                blueprintId: `blueprint-${profile.enhancementPlanId}`,
                projectId: profile.projectId,
                name: `Enhancement ${profile.enhancementType} ${platform}`,
            });
            const draft = {
                enhancementPlanId: profile.enhancementPlanId,
                profile,
                audioQualityAnalysis,
                enhancementPlan,
                restorationPlan,
                voiceImprovementPlan,
                musicImprovementPlan,
                syncPlan,
                outputPreparation,
                productionInstructions,
                blueprintId: blueprint.blueprintId,
                scores,
                relationships: {
                    enhancementPlans: [profile.enhancementPlanId],
                    voicePlans: [],
                    musicPlans: [],
                    ambientPlans: [],
                    soundPlans: [],
                    products: [],
                    brands: [],
                    campaigns: [],
                    videos: [],
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
                qualityScore: scores.audioClarityScore,
                confidenceScore: scores.aiConfidenceScore,
                verificationStatus: scores.aiConfidenceScore >= 75
                    ? AudioGenerationVerificationStatus.Verified
                    : AudioGenerationVerificationStatus.Pending,
                source: AudioGenerationSource.System,
                sourceRef: draft.enhancementPlanId,
                versionHistory: [
                    {
                        version,
                        timestamp: new Date().toISOString(),
                        changeSummary: `Enhancement plan v${version} — ${platform} ${profile.enhancementType}`,
                        source: AudioGenerationSource.System,
                    },
                ],
                relationshipLinks: [
                    ...draft.relationships.products,
                    ...draft.relationships.enhancementPlans,
                    ...draft.relationships.videos,
                ],
                healthStatus: AudioGenerationHealthLevel.Good,
            });
            if (!generationValidation.valid) {
                return {
                    success: false,
                    durationMs: Date.now() - start,
                    diagnostics: generationValidation.issues,
                    message: "Audio generation foundation validation failed for enhancement plan",
                };
            }
            this.records.upsert(draft);
            this.registerGenerationAssets(draft);
            this.logger.log("info", "blueprint-generation", "Enhancement plan generated", {
                enhancementPlanId: draft.enhancementPlanId,
                platform,
                productionReady,
                durationMs: Date.now() - start,
            });
            this.logger.log("info", "audio-analysis", "Audio quality analyzed", {
                enhancementPlanId: draft.enhancementPlanId,
                category: audioQualityAnalysis.audioCategory,
                defects: audioQualityAnalysis.defects,
            });
            this.logger.log("info", "enhancement-planning", "Enhancement techniques planned", {
                enhancementPlanId: draft.enhancementPlanId,
                techniques: enhancementPlan.techniques,
            });
            this.logger.log("info", "restoration-planning", "Restoration planned", {
                enhancementPlanId: draft.enhancementPlanId,
                restorationScore: scores.restorationScore,
            });
            if (recommendations.length > 0) {
                this.logger.log("info", "recommendation", "Enhancement recommendations", {
                    enhancementPlanId: draft.enhancementPlanId,
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
        if (query.enhancementPlanId)
            results = results.filter((r) => r.enhancementPlanId === query.enhancementPlanId);
        if (query.productId)
            results = results.filter((r) => r.relationships.products.includes(query.productId));
        if (query.brandId)
            results = results.filter((r) => r.profile.brandId === query.brandId);
        if (query.enhancementType)
            results = results.filter((r) => r.profile.enhancementType === query.enhancementType);
        if (query.audioCategory)
            results = results.filter((r) => r.audioQualityAnalysis.audioCategory === query.audioCategory);
        if (query.platform)
            results = results.filter((r) => r.profile.platform === query.platform);
        if (query.restoration) {
            const r = query.restoration.toLowerCase();
            results = results.filter((rec) => rec.restorationPlan.techniques.some((t) => t.toLowerCase().includes(r)));
        }
        if (query.keywords) {
            const kw = query.keywords.toLowerCase();
            results = results.filter((r) => r.audioQualityAnalysis.keywords.some((k) => k.includes(kw)) ||
                r.enhancementPlanId.toLowerCase().includes(kw));
        }
        if (query.text) {
            const textLower = query.text.toLowerCase();
            results = results.filter((r) => r.enhancementPlanId.toLowerCase().includes(textLower) ||
                r.profile.enhancementType.toLowerCase().includes(textLower));
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
        if (input.audioPrompt || input.audioAssetId || input.audioRef || input.brandGuidelines) {
            return this.analyzer.extractContextFromInput(input);
        }
        return null;
    }
    registerGenerationAssets(record) {
        this.foundation.getAssetRegistry().registerAsset({
            assetId: record.enhancementPlanId,
            assetType: AudioGenerationAssetType.AudioTrack,
            assetName: `Enhancement Plan ${record.profile.enhancementType} v${record.profile.version}`,
            projectId: record.profile.projectId,
            ...createDefaultGenerationAssetQuality(AudioGenerationSource.System),
            qualityScore: record.scores.audioClarityScore,
            confidenceScore: record.scores.aiConfidenceScore,
            relationshipLinks: [...record.relationships.enhancementPlans, ...record.relationships.products],
            relatedProducts: record.relationships.products,
            relatedBrands: record.relationships.brands,
            relatedCampaigns: record.relationships.campaigns,
            relatedKnowledge: record.relationships.knowledgeRecords,
        });
        this.foundation.getAssetRegistry().registerAsset({
            assetId: `restoration-${record.enhancementPlanId}`,
            assetType: AudioGenerationAssetType.Template,
            assetName: `Restoration Blueprint ${record.profile.enhancementType}`,
            projectId: record.profile.projectId,
            ...createDefaultGenerationAssetQuality(AudioGenerationSource.System),
            qualityScore: record.scores.restorationScore,
            confidenceScore: record.scores.aiConfidenceScore,
            relationshipLinks: [record.enhancementPlanId],
            relatedProducts: record.relationships.products,
        });
    }
    applySafeRepairs(enhancement, restoration, sync, voice, diagnostics) {
        const repairs = [];
        if (diagnostics.some((d) => d.includes("Enhancement planning"))) {
            if (enhancement.techniques.length < 1) {
                enhancement.techniques.push(EnhancementTechnique.NoiseReduction);
                enhancement.layerDetails[EnhancementTechnique.NoiseReduction] = "default noise reduction";
                enhancement.processingChain.push("Apply noise-reduction");
                repairs.push("Default enhancement technique applied");
            }
        }
        if (diagnostics.some((d) => d.includes("Restoration planning"))) {
            if (restoration.techniques.length < 1) {
                restoration.techniques.push(RestorationTechnique.HissRemoval);
                restoration.defectTargets["background-noise"] = "default hiss removal";
                repairs.push("Default restoration technique applied");
            }
        }
        if (diagnostics.some((d) => d.includes("Synchronization"))) {
            if (!sync.timelineAlignment) {
                sync.timelineAlignment = "Default timeline alignment";
                repairs.push("Default sync alignment applied");
            }
            if (sync.multiTrackAlignment.length < 2) {
                sync.multiTrackAlignment.push("Default track alignment");
                repairs.push("Default multi-track alignment applied");
            }
        }
        if (diagnostics.some((d) => d.includes("Voice improvement"))) {
            if (voice.speechClarity.includes("N/A")) {
                voice.speechClarity = "Default speech clarity EQ boost";
                repairs.push("Default voice clarity applied");
            }
        }
        return { repaired: repairs.length > 0, repairs };
    }
    reject(start, message, diagnostics) {
        this.logger.log("warn", "validation", message, { diagnostics });
        return { success: false, durationMs: Date.now() - start, diagnostics, message };
    }
}
//# sourceMappingURL=audio-enhancement-restoration-processor.js.map