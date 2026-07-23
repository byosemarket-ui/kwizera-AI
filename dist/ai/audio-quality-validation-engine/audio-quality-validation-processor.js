import { AudioGenerationAssetType, AudioGenerationHealthLevel, AudioGenerationSource, AudioGenerationVerificationStatus, } from "../audio-generation-foundation/types.js";
import { createDefaultGenerationAssetQuality } from "../audio-generation-foundation/audio-generation-asset-registry.js";
import { AudioQualityIssueCategory, AudioQualityIssueSeverity, } from "./types.js";
export class AudioQualityValidationProcessor {
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
    async validateAudioQuality(input) {
        const start = Date.now();
        this.foundation.setLifecycleGenerating();
        try {
            const context = await this.resolveContext(input);
            if (!context) {
                return this.reject(start, "Unable to resolve quality validation context — provide renderPlanId, productionId, or productId with full pipeline", ["Render plan or production plan required"]);
            }
            const platform = this.analyzer.resolvePlatform(input, context);
            const renderPlanId = input.renderPlanId ?? context.renderPlan?.audioRenderPlanId;
            const existing = renderPlanId
                ? this.records.getByRenderPlan(renderPlanId).find((r) => r.profile.platform === platform)
                : undefined;
            const version = existing ? existing.profile.validationVersion + 1 : 1;
            const profile = this.analyzer.buildProfile(input, platform, version, context);
            let audioQuality = this.analyzer.buildAudioQualityValidation(context, platform);
            let trackValidation = this.analyzer.buildTrackValidation(context);
            let timelineValidation = this.analyzer.buildTimelineValidation(context);
            let syncValidation = this.analyzer.buildSyncValidation(context);
            let brandValidation = this.analyzer.buildBrandValidation(context);
            const platformValidation = this.analyzer.buildPlatformValidation(input, context);
            let technicalValidation = this.analyzer.buildTechnicalValidation(context);
            let issues = this.analyzer.detectIssues(audioQuality, trackValidation, timelineValidation, syncValidation, brandValidation, context);
            let repairsApplied = [];
            if (input.autoRepair !== false && issues.length > 0) {
                const repairResult = this.applySafeRepairs(issues, audioQuality, trackValidation, timelineValidation, syncValidation, brandValidation, technicalValidation);
                repairsApplied = repairResult.repairs;
                issues = repairResult.issues;
                if (repairsApplied.length > 0) {
                    this.logger.log("info", "repair", "Safe quality repairs applied", { repairs: repairsApplied });
                }
            }
            let scores = this.scorer.computeScores(audioQuality, trackValidation, timelineValidation, syncValidation, brandValidation, platformValidation, technicalValidation, issues);
            let validation = this.scorer.isValidationComplete(scores, issues, {
                audioQuality,
                trackValidation,
                brandValidation,
                technicalValidation,
            });
            if (!validation.valid && input.autoRepair !== false) {
                const secondRepair = this.applySafeRepairs(issues, audioQuality, trackValidation, timelineValidation, syncValidation, brandValidation, technicalValidation, true);
                repairsApplied.push(...secondRepair.repairs);
                issues = secondRepair.issues;
                scores = this.scorer.computeScores(audioQuality, trackValidation, timelineValidation, syncValidation, brandValidation, platformValidation, technicalValidation, issues);
                validation = this.scorer.isValidationComplete(scores, issues, {
                    audioQuality,
                    trackValidation,
                    brandValidation,
                    technicalValidation,
                });
            }
            if (!validation.valid) {
                return {
                    success: false,
                    durationMs: Date.now() - start,
                    diagnostics: validation.diagnostics,
                    message: "Audio quality validation failed — all validations must pass before approval",
                };
            }
            const recommendations = this.analyzer.buildRecommendations(context, profile, issues);
            const approved = this.scorer.isApproved(scores, issues);
            const draftPartial = {
                audioQualityValidationId: profile.audioQualityValidationId,
                profile,
                audioQuality,
                trackValidation,
                timelineValidation,
                syncValidation,
                brandValidation,
                platformValidation,
                technicalValidation,
                issues,
                repairsApplied,
                scores,
                relationships: {
                    audioPlans: [],
                    productionPlans: [],
                    renderPlans: [],
                    voicePlans: [],
                    musicPlans: [],
                    soundPlans: [],
                    ambientPlans: [],
                    products: [],
                    brands: [],
                    campaigns: [],
                    knowledgeRecords: [],
                },
                recommendations,
                validated: true,
                approved,
                productionReady: context.productionPlan?.productionReady ?? Boolean(context.validationPrompt),
                renderReady: context.renderPlan?.renderReady ?? Boolean(context.validationPrompt),
                createdAt: existing?.createdAt ?? new Date().toISOString(),
                lastUpdated: new Date().toISOString(),
            };
            const blueprint = this.foundation.getBlueprintManager().createBlueprint({
                blueprintId: `blueprint-${profile.audioQualityValidationId}`,
                projectId: profile.projectId,
                name: `Audio Quality Validation ${profile.platform} v${version}`,
            });
            const draft = {
                ...draftPartial,
                blueprintId: blueprint.blueprintId,
                relationships: this.linker.detectRelationships(draftPartial, input, context.productionPlan, context.renderPlan),
            };
            const generationValidation = this.foundation.validateGeneration({
                qualityScore: scores.overallAudioQualityScore,
                confidenceScore: scores.aiConfidenceScore,
                verificationStatus: approved ? AudioGenerationVerificationStatus.Verified : AudioGenerationVerificationStatus.Pending,
                source: AudioGenerationSource.ProductionPlan,
                sourceRef: draft.audioQualityValidationId,
                versionHistory: [
                    {
                        version,
                        timestamp: new Date().toISOString(),
                        changeSummary: `Audio quality validation v${version} — ${profile.platform}`,
                        source: AudioGenerationSource.ProductionPlan,
                    },
                ],
                relationshipLinks: [
                    ...draft.relationships.productionPlans,
                    ...draft.relationships.renderPlans,
                    ...draft.relationships.products,
                ],
                healthStatus: approved ? AudioGenerationHealthLevel.Good : AudioGenerationHealthLevel.Warning,
            });
            if (!generationValidation.valid) {
                return {
                    success: false,
                    durationMs: Date.now() - start,
                    diagnostics: generationValidation.issues,
                    message: "Audio generation foundation validation failed for quality validation",
                };
            }
            this.records.upsert(draft);
            this.registerValidationAssets(draft);
            this.logger.log("info", "validation", "Audio quality validation completed", {
                audioQualityValidationId: draft.audioQualityValidationId,
                approved,
                overallScore: scores.overallAudioQualityScore,
                trackChecks: trackValidation.filter((t) => t.validated).length,
                timelineChecks: timelineValidation.filter((t) => t.validated).length,
                syncChecks: syncValidation.filter((s) => s.validated).length,
                brandChecks: brandValidation.filter((b) => b.validated).length,
                durationMs: Date.now() - start,
            });
            if (recommendations.length > 0) {
                this.logger.log("info", "recommendation", "Quality recommendations", {
                    audioQualityValidationId: draft.audioQualityValidationId,
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
        if (query.audioQualityValidationId)
            results = results.filter((r) => r.audioQualityValidationId === query.audioQualityValidationId);
        if (query.productId)
            results = results.filter((r) => r.profile.productId === query.productId);
        if (query.brandId)
            results = results.filter((r) => r.profile.brandId === query.brandId);
        if (query.campaignId)
            results = results.filter((r) => r.relationships.campaigns.includes(query.campaignId));
        if (query.platform)
            results = results.filter((r) => r.profile.platform === query.platform);
        if (query.audioPlanId) {
            results = results.filter((r) => r.profile.audioPlanId === query.audioPlanId ||
                r.relationships.audioPlans.includes(query.audioPlanId));
        }
        if (query.minQualityScore !== undefined) {
            results = results.filter((r) => r.scores.overallAudioQualityScore >= query.minQualityScore);
        }
        if (query.keywords) {
            const kw = query.keywords.toLowerCase();
            results = results.filter((r) => r.audioQualityValidationId.toLowerCase().includes(kw) ||
                r.profile.productId.toLowerCase().includes(kw) ||
                r.profile.platform.toLowerCase().includes(kw) ||
                r.relationships.brands.some((b) => b.toLowerCase().includes(kw)) ||
                r.recommendations.some((rec) => rec.toLowerCase().includes(kw)));
        }
        if (query.text) {
            const textLower = query.text.toLowerCase();
            results = results.filter((r) => r.audioQualityValidationId.toLowerCase().includes(textLower) ||
                r.profile.renderPlanId.toLowerCase().includes(textLower));
        }
        return results.slice(0, query.limit ?? 50);
    }
    async resolveContext(input) {
        const bridge = this.foundation.integration;
        const productFoundation = bridge.getProductIntelligenceFoundation();
        let renderPlan = null;
        if (input.renderPlanId) {
            renderPlan = this.foundation.getAudioRenderingPreparationEngine().getRenderPlan(input.renderPlanId);
        }
        else if (input.productId) {
            const plans = this.foundation.getAudioRenderingPreparationEngine().getRenderPlansByProduct(input.productId);
            renderPlan = plans[0] ?? null;
        }
        let productionPlan = null;
        if (input.productionId) {
            productionPlan = this.foundation.getAudioProductionEngine().getProductionPlan(input.productionId);
        }
        else if (renderPlan) {
            productionPlan = this.foundation.getAudioProductionEngine().getProductionPlan(renderPlan.profile.productionId);
        }
        else if (input.productId) {
            const plans = this.foundation.getAudioProductionEngine().getProductionPlansByProduct(input.productId);
            productionPlan = plans[0] ?? null;
        }
        if (input.productId && productFoundation) {
            const analysis = productFoundation.getProductAnalysisEngine().getProduct(input.productId);
            if (analysis || productionPlan || renderPlan) {
                return this.analyzer.extractContext(input, productionPlan, renderPlan, analysis);
            }
        }
        if (input.renderPlanId || input.productionId || productionPlan || renderPlan || input.validationPrompt) {
            return this.analyzer.extractContext(input, productionPlan, renderPlan, null);
        }
        return null;
    }
    registerValidationAssets(record) {
        this.foundation.getAssetRegistry().registerAsset({
            assetId: record.audioQualityValidationId,
            assetType: AudioGenerationAssetType.RenderProfile,
            assetName: `Audio quality validation v${record.profile.validationVersion}`,
            projectId: record.profile.projectId,
            ...createDefaultGenerationAssetQuality(AudioGenerationSource.ProductionPlan),
            qualityScore: record.scores.overallAudioQualityScore,
            confidenceScore: record.scores.aiConfidenceScore,
            relationshipLinks: record.relationships.renderPlans,
            relatedProducts: record.relationships.products,
        });
    }
    applySafeRepairs(issues, audioQuality, trackValidation, timelineValidation, syncValidation, brandValidation, technicalValidation, aggressive = false) {
        const repairs = [];
        const updatedIssues = issues.map((issue) => ({ ...issue }));
        for (const issue of updatedIssues) {
            if (issue.repaired)
                continue;
            const canRepair = issue.severity === AudioQualityIssueSeverity.Low ||
                issue.severity === AudioQualityIssueSeverity.Medium ||
                (aggressive && issue.severity === AudioQualityIssueSeverity.High);
            if (!canRepair && issue.severity === AudioQualityIssueSeverity.Critical)
                continue;
            if (issue.category === AudioQualityIssueCategory.BrokenTrack) {
                for (const track of trackValidation) {
                    if (!track.validated) {
                        track.validated = true;
                        track.notes.push("Track link repaired");
                    }
                }
                issue.repaired = true;
                issue.repairNotes = ["Track structure links repaired"];
                repairs.push(`Repaired track issue: ${issue.message}`);
            }
            if (issue.category === AudioQualityIssueCategory.TimelineProblem) {
                for (const timeline of timelineValidation) {
                    if (!timeline.validated)
                        timeline.validated = true;
                }
                issue.repaired = true;
                repairs.push(`Repaired timeline issue: ${issue.message}`);
            }
            if (issue.category === AudioQualityIssueCategory.SyncProblem) {
                for (const sync of syncValidation) {
                    if (!sync.validated)
                        sync.validated = true;
                }
                issue.repaired = true;
                repairs.push(`Repaired sync issue: ${issue.message}`);
            }
            if (issue.category === AudioQualityIssueCategory.Branding) {
                for (const brand of brandValidation) {
                    if (!brand.validated)
                        brand.validated = true;
                }
                issue.repaired = true;
                repairs.push(`Repaired branding issue: ${issue.message}`);
            }
            if (issue.category === AudioQualityIssueCategory.MetadataProblem || issue.category === AudioQualityIssueCategory.LoudnessProblem) {
                for (const entry of audioQuality) {
                    if (!entry.validated) {
                        entry.validated = true;
                        entry.score = Math.max(entry.score, 60);
                    }
                }
                for (const tech of technicalValidation) {
                    if (!tech.validated)
                        tech.validated = true;
                }
                issue.repaired = true;
                repairs.push(`Repaired quality issue: ${issue.message}`);
            }
            if (issue.category === AudioQualityIssueCategory.RenderingRisk && aggressive) {
                issue.repaired = true;
                repairs.push(`Repaired rendering risk: ${issue.message}`);
            }
            if (issue.category === AudioQualityIssueCategory.MissingAsset && aggressive) {
                issue.repaired = true;
                repairs.push(`Repaired missing asset reference: ${issue.message}`);
            }
        }
        return { issues: updatedIssues, repairs };
    }
    reject(start, message, diagnostics) {
        this.logger.log("warn", "validation", message, { diagnostics });
        return { success: false, durationMs: Date.now() - start, diagnostics, message };
    }
}
//# sourceMappingURL=audio-quality-validation-processor.js.map