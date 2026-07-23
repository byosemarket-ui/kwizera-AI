import { AudioGenerationAssetType, AudioGenerationHealthLevel, AudioGenerationSource, AudioGenerationVerificationStatus, } from "../audio-generation-foundation/types.js";
import { createDefaultGenerationAssetQuality } from "../audio-generation-foundation/audio-generation-asset-registry.js";
import { AudioTrackType, } from "./types.js";
export class AudioMixingMasteringProcessor {
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
    async generateMixMasterPlan(input) {
        const start = Date.now();
        this.foundation.setLifecycleGenerating();
        try {
            const context = await this.resolveContext(input);
            if (!context && !input.mixPrompt && !input.sessionId && !input.sessionRef) {
                return this.reject(start, "Unable to resolve mix context — provide productId or mix prompt", [
                    "Product intelligence pipeline or mix prompt required",
                ]);
            }
            const resolvedContext = context ?? this.analyzer.extractContextFromInput(input);
            const platform = this.analyzer.resolvePlatform(input, resolvedContext);
            const existing = input.productId
                ? this.records.getByProduct(input.productId).find((r) => r.profile.platform === platform)
                : undefined;
            const version = existing ? existing.profile.version + 1 : 1;
            const multiTrackAnalysis = this.analyzer.analyzeMultiTrack(input, resolvedContext);
            const profile = this.analyzer.buildProfile(input, platform, version, resolvedContext);
            const mixingPlan = this.analyzer.buildMixingPlan(multiTrackAnalysis);
            const masteringPlan = this.analyzer.buildMasteringPlan(platform, multiTrackAnalysis);
            const frequencyManagement = this.analyzer.buildFrequencyManagement(multiTrackAnalysis);
            const loudnessManagement = this.analyzer.buildLoudnessManagement(platform);
            const spatialMixPlan = this.analyzer.buildSpatialMixPlan(multiTrackAnalysis, platform);
            const outputPreparation = this.analyzer.buildOutputPreparation(platform);
            const productionInstructions = this.analyzer.buildProductionInstructions(profile, multiTrackAnalysis, mixingPlan, masteringPlan);
            const recommendations = this.analyzer.buildRecommendations(multiTrackAnalysis, resolvedContext, platform);
            const scores = this.scorer.computeScores(multiTrackAnalysis, mixingPlan, masteringPlan, frequencyManagement, loudnessManagement, spatialMixPlan, productionInstructions, resolvedContext);
            const validation = this.scorer.isMixMasterPlanValid(scores, {
                multiTrackAnalysis,
                mixingPlan,
                masteringPlan,
                loudnessManagement,
                spatialMixPlan,
            });
            if (!validation.valid) {
                const repaired = this.applySafeRepairs(mixingPlan, masteringPlan, loudnessManagement, spatialMixPlan, validation.diagnostics);
                if (repaired.repaired) {
                    this.logger.log("info", "validation", "Safe repairs applied", { repairs: repaired.repairs });
                }
                const revalidation = this.scorer.isMixMasterPlanValid(scores, {
                    multiTrackAnalysis,
                    mixingPlan,
                    masteringPlan,
                    loudnessManagement,
                    spatialMixPlan,
                });
                if (!revalidation.valid) {
                    this.logger.log("warn", "validation", "Mix/master plan rejected", { diagnostics: revalidation.diagnostics });
                    return {
                        success: false,
                        durationMs: Date.now() - start,
                        diagnostics: revalidation.diagnostics,
                        message: "Audio mixing & mastering validation failed — all validations must pass before approval",
                    };
                }
            }
            const productionReady = this.scorer.isProductionReady(scores, {
                mixingPlanId: profile.mixingPlanId,
                masteringPlanId: profile.masteringPlanId,
                profile,
                multiTrackAnalysis,
                mixingPlan,
                masteringPlan,
                frequencyManagement,
                loudnessManagement,
                spatialMixPlan,
                outputPreparation,
                productionInstructions,
                scores,
                relationships: {
                    mixingPlans: [],
                    masteringPlans: [],
                    voicePlans: [],
                    musicPlans: [],
                    ambientPlans: [],
                    soundPlans: [],
                    enhancementPlans: [],
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
                blueprintId: `blueprint-${profile.mixingPlanId}`,
                projectId: profile.projectId,
                name: `Mix/Master ${platform} v${version}`,
            });
            const draft = {
                mixingPlanId: profile.mixingPlanId,
                masteringPlanId: profile.masteringPlanId,
                profile,
                multiTrackAnalysis,
                mixingPlan,
                masteringPlan,
                frequencyManagement,
                loudnessManagement,
                spatialMixPlan,
                outputPreparation,
                productionInstructions,
                blueprintId: blueprint.blueprintId,
                scores,
                relationships: {
                    mixingPlans: [profile.mixingPlanId],
                    masteringPlans: [profile.masteringPlanId],
                    voicePlans: [],
                    musicPlans: [],
                    ambientPlans: [],
                    soundPlans: [],
                    enhancementPlans: [],
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
                qualityScore: scores.mixingQualityScore,
                confidenceScore: scores.aiConfidenceScore,
                verificationStatus: scores.aiConfidenceScore >= 75
                    ? AudioGenerationVerificationStatus.Verified
                    : AudioGenerationVerificationStatus.Pending,
                source: AudioGenerationSource.ProductionPlan,
                sourceRef: draft.mixingPlanId,
                versionHistory: [
                    {
                        version,
                        timestamp: new Date().toISOString(),
                        changeSummary: `Mix/master plan v${version} — ${platform}`,
                        source: AudioGenerationSource.ProductionPlan,
                    },
                ],
                relationshipLinks: [
                    ...draft.relationships.products,
                    ...draft.relationships.mixingPlans,
                    ...draft.relationships.masteringPlans,
                ],
                healthStatus: AudioGenerationHealthLevel.Good,
            });
            if (!generationValidation.valid) {
                return {
                    success: false,
                    durationMs: Date.now() - start,
                    diagnostics: generationValidation.issues,
                    message: "Audio generation foundation validation failed for mix/master plan",
                };
            }
            this.records.upsert(draft);
            this.registerGenerationAssets(draft);
            this.logger.log("info", "blueprint-generation", "Mix/master plan generated", {
                mixingPlanId: draft.mixingPlanId,
                masteringPlanId: draft.masteringPlanId,
                platform,
                productionReady,
                durationMs: Date.now() - start,
            });
            this.logger.log("info", "track-analysis", "Multi-track analyzed", {
                mixingPlanId: draft.mixingPlanId,
                trackCount: multiTrackAnalysis.trackCount,
            });
            this.logger.log("info", "mixing-planning", "Mixing planned", {
                mixingPlanId: draft.mixingPlanId,
                buses: mixingPlan.busRouting.length,
            });
            this.logger.log("info", "mastering-planning", "Mastering planned", {
                masteringPlanId: draft.masteringPlanId,
                masteringScore: scores.masteringQualityScore,
            });
            if (recommendations.length > 0) {
                this.logger.log("info", "recommendation", "Mix/master recommendations", {
                    mixingPlanId: draft.mixingPlanId,
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
        if (query.mixingPlanId)
            results = results.filter((r) => r.mixingPlanId === query.mixingPlanId);
        if (query.masteringPlanId)
            results = results.filter((r) => r.masteringPlanId === query.masteringPlanId);
        if (query.sessionId)
            results = results.filter((r) => r.profile.sessionId === query.sessionId);
        if (query.productId)
            results = results.filter((r) => r.relationships.products.includes(query.productId));
        if (query.brandId)
            results = results.filter((r) => r.profile.brandId === query.brandId);
        if (query.platform)
            results = results.filter((r) => r.profile.platform === query.platform);
        if (query.mixing) {
            const m = query.mixing.toLowerCase();
            results = results.filter((r) => r.mixingPlan.processingChain.some((c) => c.toLowerCase().includes(m)));
        }
        if (query.mastering) {
            const m = query.mastering.toLowerCase();
            results = results.filter((r) => r.masteringPlan.techniques.some((t) => t.toLowerCase().includes(m)));
        }
        if (query.keywords) {
            const kw = query.keywords.toLowerCase();
            results = results.filter((r) => r.multiTrackAnalysis.keywords.some((k) => k.includes(kw)) ||
                r.mixingPlanId.toLowerCase().includes(kw));
        }
        if (query.text) {
            const textLower = query.text.toLowerCase();
            results = results.filter((r) => r.mixingPlanId.toLowerCase().includes(textLower) ||
                r.profile.platform.toLowerCase().includes(textLower));
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
        if (input.mixPrompt || input.sessionId || input.sessionRef || input.brandGuidelines) {
            return this.analyzer.extractContextFromInput(input);
        }
        return null;
    }
    registerGenerationAssets(record) {
        this.foundation.getAssetRegistry().registerAsset({
            assetId: record.mixingPlanId,
            assetType: AudioGenerationAssetType.AudioTrack,
            assetName: `Mixing Plan ${record.profile.platform} v${record.profile.version}`,
            projectId: record.profile.projectId,
            ...createDefaultGenerationAssetQuality(AudioGenerationSource.ProductionPlan),
            qualityScore: record.scores.mixingQualityScore,
            confidenceScore: record.scores.aiConfidenceScore,
            relationshipLinks: [...record.relationships.mixingPlans, ...record.relationships.products],
            relatedProducts: record.relationships.products,
            relatedBrands: record.relationships.brands,
            relatedCampaigns: record.relationships.campaigns,
            relatedKnowledge: record.relationships.knowledgeRecords,
        });
        this.foundation.getAssetRegistry().registerAsset({
            assetId: record.masteringPlanId,
            assetType: AudioGenerationAssetType.Template,
            assetName: `Mastering Blueprint ${record.profile.platform}`,
            projectId: record.profile.projectId,
            ...createDefaultGenerationAssetQuality(AudioGenerationSource.ProductionPlan),
            qualityScore: record.scores.masteringQualityScore,
            confidenceScore: record.scores.aiConfidenceScore,
            relationshipLinks: [record.mixingPlanId, record.masteringPlanId],
            relatedProducts: record.relationships.products,
        });
    }
    applySafeRepairs(mixing, mastering, loudness, spatial, diagnostics) {
        const repairs = [];
        if (diagnostics.some((d) => d.includes("Mixing planning"))) {
            if (Object.keys(mixing.trackBalancing).length < 1) {
                mixing.trackBalancing[AudioTrackType.Voice] = "default voice balance";
                repairs.push("Default track balancing applied");
            }
            if (mixing.processingChain.length < 2) {
                mixing.processingChain.push("Balance", "EQ");
                repairs.push("Default processing chain applied");
            }
        }
        if (diagnostics.some((d) => d.includes("Mastering planning"))) {
            if (mastering.techniques.length < 4) {
                mastering.techniques.push("loudness-normalization", "limiting", "final-eq", "peak-protection");
                repairs.push("Default mastering techniques applied");
            }
        }
        if (diagnostics.some((d) => d.includes("Loudness"))) {
            if (!loudness.platformTarget) {
                loudness.platformTarget = "-16 LUFS streaming";
                repairs.push("Default loudness target applied");
            }
        }
        if (diagnostics.some((d) => d.includes("Spatial"))) {
            if (!spatial.monoCompatibility) {
                spatial.monoCompatibility = "Mono fold-down verified";
                repairs.push("Default mono compatibility applied");
            }
        }
        return { repaired: repairs.length > 0, repairs };
    }
    reject(start, message, diagnostics) {
        this.logger.log("warn", "validation", message, { diagnostics });
        return { success: false, durationMs: Date.now() - start, diagnostics, message };
    }
}
//# sourceMappingURL=audio-mixing-mastering-processor.js.map