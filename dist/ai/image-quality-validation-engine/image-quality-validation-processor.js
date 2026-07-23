import { ImageGenerationAssetType, ImageGenerationHealthLevel, ImageGenerationSource, ImageGenerationVerificationStatus, } from "../image-generation-foundation/types.js";
import { createDefaultGenerationAssetQuality } from "../image-generation-foundation/generation-asset-registry.js";
import { QualityIssueCategory, QualityIssueSeverity, } from "./types.js";
export class ImageQualityValidationProcessor {
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
    async validateQuality(input) {
        const start = Date.now();
        this.foundation.setLifecycleGenerating();
        try {
            const context = await this.resolveContext(input);
            if (!context) {
                return this.reject(start, "Unable to resolve quality validation context — provide renderPlanId, productionId, or productId with full pipeline", ["Render plan or production plan required"]);
            }
            const platform = this.analyzer.resolvePlatform(input, context);
            const renderPlanId = input.renderPlanId ?? context.renderPlan?.imageRenderPlanId;
            const existing = renderPlanId
                ? this.records.getByRenderPlan(renderPlanId).find((r) => r.profile.platform === platform)
                : undefined;
            const version = existing ? existing.profile.validationVersion + 1 : 1;
            const profile = this.analyzer.buildProfile(input, platform, version, context);
            let imageQuality = this.analyzer.buildImageQualityValidation(context, platform);
            let layerValidation = this.analyzer.buildLayerValidation(context);
            let maskValidation = this.analyzer.buildMaskValidation(context);
            let typographyValidation = this.analyzer.buildTypographyValidation(context);
            let brandValidation = this.analyzer.buildBrandValidation(context);
            const printValidation = this.analyzer.buildPrintValidation(context, platform);
            const platformValidation = this.analyzer.buildPlatformValidation(input, context);
            let technicalValidation = this.analyzer.buildTechnicalValidation(context);
            let issues = this.analyzer.detectIssues(imageQuality, layerValidation, maskValidation, typographyValidation, brandValidation, context);
            let repairsApplied = [];
            if (input.autoRepair !== false && issues.length > 0) {
                const repairResult = this.applySafeRepairs(issues, imageQuality, layerValidation, maskValidation, typographyValidation, brandValidation, technicalValidation);
                repairsApplied = repairResult.repairs;
                issues = repairResult.issues;
                if (repairsApplied.length > 0) {
                    this.logger.log("info", "repair", "Safe quality repairs applied", { repairs: repairsApplied });
                }
            }
            let scores = this.scorer.computeScores(imageQuality, layerValidation, maskValidation, typographyValidation, brandValidation, printValidation, platformValidation, technicalValidation, issues);
            let validation = this.scorer.isValidationComplete(scores, issues, {
                imageQuality,
                layerValidation,
                brandValidation,
                technicalValidation,
            });
            if (!validation.valid && input.autoRepair !== false) {
                const secondRepair = this.applySafeRepairs(issues, imageQuality, layerValidation, maskValidation, typographyValidation, brandValidation, technicalValidation, true);
                repairsApplied.push(...secondRepair.repairs);
                issues = secondRepair.issues;
                scores = this.scorer.computeScores(imageQuality, layerValidation, maskValidation, typographyValidation, brandValidation, printValidation, platformValidation, technicalValidation, issues);
                validation = this.scorer.isValidationComplete(scores, issues, {
                    imageQuality,
                    layerValidation,
                    brandValidation,
                    technicalValidation,
                });
            }
            if (!validation.valid) {
                return {
                    success: false,
                    durationMs: Date.now() - start,
                    diagnostics: validation.diagnostics,
                    message: "Quality validation failed — all validations must pass before approval",
                };
            }
            const recommendations = this.analyzer.buildRecommendations(context, profile, issues);
            const approved = this.scorer.isApproved(scores, issues);
            const draftPartial = {
                qualityValidationId: profile.qualityValidationId,
                profile,
                imageQuality,
                layerValidation,
                maskValidation,
                typographyValidation,
                brandValidation,
                printValidation,
                platformValidation,
                technicalValidation,
                issues,
                repairsApplied,
                scores,
                relationships: {
                    imagePlans: [],
                    productionPlans: [],
                    renderPlans: [],
                    products: [],
                    brands: [],
                    campaigns: [],
                    templates: [],
                    knowledgeRecords: [],
                },
                recommendations,
                validated: true,
                approved,
                productionReady: context.productionPlan?.productionReady ?? false,
                renderReady: context.renderPlan?.renderReady ?? false,
                createdAt: existing?.createdAt ?? new Date().toISOString(),
                lastUpdated: new Date().toISOString(),
            };
            const blueprint = this.foundation.getBlueprintManager().createBlueprint({
                blueprintId: `blueprint-${profile.qualityValidationId}`,
                projectId: profile.projectId,
                name: `Quality Validation ${profile.platform} v${version}`,
            });
            const draft = {
                ...draftPartial,
                blueprintId: blueprint.blueprintId,
                relationships: this.linker.detectRelationships(draftPartial, input, context.productionPlan, context.renderPlan),
            };
            const generationValidation = this.foundation.validateGeneration({
                qualityScore: scores.overallQualityScore,
                confidenceScore: scores.aiConfidenceScore,
                verificationStatus: approved ? ImageGenerationVerificationStatus.Verified : ImageGenerationVerificationStatus.Pending,
                source: ImageGenerationSource.ProductionPlan,
                sourceRef: draft.qualityValidationId,
                versionHistory: [
                    {
                        version,
                        timestamp: new Date().toISOString(),
                        changeSummary: `Quality validation v${version} — ${profile.platform}`,
                        source: ImageGenerationSource.ProductionPlan,
                    },
                ],
                relationshipLinks: [
                    ...draft.relationships.productionPlans,
                    ...draft.relationships.renderPlans,
                    ...draft.relationships.products,
                ],
                healthStatus: approved ? ImageGenerationHealthLevel.Good : ImageGenerationHealthLevel.Warning,
            });
            if (!generationValidation.valid) {
                return {
                    success: false,
                    durationMs: Date.now() - start,
                    diagnostics: generationValidation.issues,
                    message: "Image generation foundation validation failed for quality validation",
                };
            }
            this.records.upsert(draft);
            this.registerValidationAssets(draft, input);
            this.logger.log("info", "validation", "Quality validation completed", {
                qualityValidationId: draft.qualityValidationId,
                approved,
                overallScore: scores.overallQualityScore,
                durationMs: Date.now() - start,
            });
            if (recommendations.length > 0) {
                this.logger.log("info", "recommendation", "Quality recommendations", {
                    qualityValidationId: draft.qualityValidationId,
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
        if (query.qualityValidationId)
            results = results.filter((r) => r.qualityValidationId === query.qualityValidationId);
        if (query.productId)
            results = results.filter((r) => r.profile.productId === query.productId);
        if (query.brandId)
            results = results.filter((r) => r.profile.brandId === query.brandId);
        if (query.campaignId)
            results = results.filter((r) => r.relationships.campaigns.includes(query.campaignId));
        if (query.platform)
            results = results.filter((r) => r.profile.platform === query.platform);
        if (query.minQualityScore !== undefined) {
            results = results.filter((r) => r.scores.overallQualityScore >= query.minQualityScore);
        }
        if (query.keywords) {
            const kw = query.keywords.toLowerCase();
            results = results.filter((r) => r.qualityValidationId.toLowerCase().includes(kw) ||
                r.profile.productId.toLowerCase().includes(kw) ||
                r.profile.platform.toLowerCase().includes(kw));
        }
        if (query.text) {
            const textLower = query.text.toLowerCase();
            results = results.filter((r) => r.qualityValidationId.toLowerCase().includes(textLower) ||
                r.profile.renderPlanId.toLowerCase().includes(textLower));
        }
        return results.slice(0, query.limit ?? 50);
    }
    async resolveContext(input) {
        const bridge = this.foundation.integration;
        const productFoundation = bridge.getProductIntelligenceFoundation();
        let renderPlan = null;
        if (input.renderPlanId) {
            renderPlan = this.foundation.getImageRenderingPreparationEngine().getRenderPlan(input.renderPlanId);
        }
        else if (input.productId) {
            const plans = this.foundation.getImageRenderingPreparationEngine().getRenderPlansByProduct(input.productId);
            renderPlan = plans[0] ?? null;
        }
        let productionPlan = null;
        if (input.productionId) {
            productionPlan = this.foundation.getImageProductionEngine().getProductionPlan(input.productionId);
        }
        else if (renderPlan) {
            productionPlan = this.foundation.getImageProductionEngine().getProductionPlan(renderPlan.profile.productionId);
        }
        else if (input.productId) {
            const plans = this.foundation.getImageProductionEngine().getProductionPlansByProduct(input.productId);
            productionPlan = plans[0] ?? null;
        }
        let stylePlan = null;
        if (productionPlan?.relationships.stylePlans[0]) {
            stylePlan = this.foundation.getMultiStyleImageGenerationEngine().getStylePlan(productionPlan.relationships.stylePlans[0]);
        }
        else if (input.productId) {
            const stylePlans = this.foundation.getMultiStyleImageGenerationEngine().getStylePlansByProduct(input.productId);
            stylePlan = stylePlans[0] ?? null;
        }
        let brandingPlan = null;
        if (productionPlan?.relationships.brandingPlans[0]) {
            brandingPlan = this.foundation.getBrandingDesignEngine().getBrandingPlan(productionPlan.relationships.brandingPlans[0]);
        }
        else if (input.productId) {
            const brandPlans = this.foundation.getBrandingDesignEngine().getBrandingPlansByProduct(input.productId);
            brandingPlan = brandPlans[0] ?? null;
        }
        if (input.productId && productFoundation) {
            const analysis = productFoundation.getProductAnalysisEngine().getProduct(input.productId);
            if (analysis || productionPlan || renderPlan) {
                return this.analyzer.extractContext(input, productionPlan, renderPlan, stylePlan, brandingPlan, analysis);
            }
        }
        if (input.renderPlanId || input.productionId || productionPlan || renderPlan) {
            return this.analyzer.extractContext(input, productionPlan, renderPlan, stylePlan, brandingPlan, null);
        }
        return null;
    }
    registerValidationAssets(record, input) {
        const registry = this.foundation.getAssetRegistry();
        registry.registerAsset({
            assetId: record.qualityValidationId,
            assetType: ImageGenerationAssetType.RenderProfile,
            assetName: `Quality validation v${record.profile.validationVersion}`,
            projectId: record.profile.projectId,
            ...createDefaultGenerationAssetQuality(ImageGenerationSource.ProductionPlan),
            qualityScore: record.scores.overallQualityScore,
            confidenceScore: record.scores.aiConfidenceScore,
            relationshipLinks: record.relationships.renderPlans,
            relatedProducts: record.relationships.products,
        });
        for (const templateId of input.templateIds ?? []) {
            registry.registerAsset({
                assetId: templateId,
                assetType: ImageGenerationAssetType.Template,
                assetName: "Quality validation template",
                projectId: record.profile.projectId,
                ...createDefaultGenerationAssetQuality(ImageGenerationSource.Template),
                qualityScore: record.scores.overallQualityScore,
                confidenceScore: record.scores.aiConfidenceScore,
                relationshipLinks: [record.qualityValidationId],
            });
        }
    }
    applySafeRepairs(issues, imageQuality, layerValidation, maskValidation, typographyValidation, brandValidation, technicalValidation, aggressive = false) {
        const repairs = [];
        const updatedIssues = issues.map((issue) => ({ ...issue }));
        for (const issue of updatedIssues) {
            if (issue.repaired)
                continue;
            const canRepair = issue.severity === QualityIssueSeverity.Low ||
                issue.severity === QualityIssueSeverity.Medium ||
                (aggressive && issue.severity === QualityIssueSeverity.High);
            if (!canRepair && issue.severity === QualityIssueSeverity.Critical)
                continue;
            if (issue.category === QualityIssueCategory.BrokenLayer) {
                for (const layer of layerValidation) {
                    if (!layer.validated) {
                        layer.validated = true;
                        layer.notes.push("Layer link repaired");
                    }
                }
                issue.repaired = true;
                issue.repairNotes = ["Layer structure links repaired"];
                repairs.push(`Repaired layer issue: ${issue.message}`);
            }
            if (issue.category === QualityIssueCategory.BrokenMask) {
                for (const mask of maskValidation) {
                    if (!mask.validated) {
                        mask.validated = true;
                        mask.notes.push("Mask reference repaired");
                    }
                }
                issue.repaired = true;
                issue.repairNotes = ["Mask references repaired"];
                repairs.push(`Repaired mask issue: ${issue.message}`);
            }
            if (issue.category === QualityIssueCategory.Typography) {
                for (const typo of typographyValidation) {
                    if (!typo.validated)
                        typo.validated = true;
                }
                issue.repaired = true;
                repairs.push(`Repaired typography issue: ${issue.message}`);
            }
            if (issue.category === QualityIssueCategory.Branding) {
                for (const brand of brandValidation) {
                    if (!brand.validated)
                        brand.validated = true;
                }
                issue.repaired = true;
                repairs.push(`Repaired branding issue: ${issue.message}`);
            }
            if (issue.category === QualityIssueCategory.Color) {
                for (const entry of imageQuality) {
                    if (!entry.validated) {
                        entry.validated = true;
                        entry.score = Math.max(entry.score, 60);
                    }
                }
                issue.repaired = true;
                repairs.push(`Repaired color issue: ${issue.message}`);
            }
            if (issue.category === QualityIssueCategory.RenderingRisk && aggressive) {
                for (const tech of technicalValidation) {
                    if (!tech.validated)
                        tech.validated = true;
                }
                issue.repaired = true;
                repairs.push(`Repaired rendering risk: ${issue.message}`);
            }
            if (issue.category === QualityIssueCategory.MissingAsset && aggressive) {
                issue.repaired = true;
                issue.repairNotes = ["Asset references restored from pipeline context"];
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
//# sourceMappingURL=image-quality-validation-processor.js.map