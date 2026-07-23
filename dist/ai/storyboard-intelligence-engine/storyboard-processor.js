import { ProductIntelligenceHealthLevel, ProductIntelligenceSource, ProductIntelligenceVerificationStatus, } from "../product-intelligence-foundation/types.js";
export class StoryboardProcessor {
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
    async createStoryboard(input) {
        const start = Date.now();
        const creativeEngine = this.foundation.getCreativeDirectionEngine();
        const strategyEngine = this.foundation.getMarketingStrategyIntelligenceEngine();
        const understandingEngine = this.foundation.getProductUnderstandingEngine();
        const understanding = understandingEngine.getUnderstanding(input.productId);
        if (!understanding?.validated) {
            return this.reject(start, "Complete product understanding required before storyboard", [
                "Product must be understood and validated",
            ]);
        }
        let creative = input.creativeId
            ? creativeEngine.getCreativeDirection(input.creativeId)
            : creativeEngine.getCreativeDirectionsByProduct(input.productId)[0];
        if (!creative?.validated) {
            const creativeResult = await creativeEngine.planCreativeDirection({
                productId: input.productId,
                creativeId: input.creativeId,
                projectId: input.projectId,
            });
            if (!creativeResult.success || !creativeResult.record) {
                return this.reject(start, creativeResult.message ?? "Complete creative direction required before storyboard", creativeResult.diagnostics.length > 0
                    ? creativeResult.diagnostics
                    : ["Creative direction must be prepared and validated"]);
            }
            creative = creativeResult.record;
        }
        const strategy = strategyEngine.getStrategy(creative.strategyId);
        if (!strategy?.validated) {
            return this.reject(start, "Validated marketing strategy required before storyboard", [
                "Marketing strategy must be linked and validated",
            ]);
        }
        const existing = input.storyboardId
            ? this.records.get(input.storyboardId)
            : this.records.getByProduct(input.productId).find((r) => r.creativeId === creative.creativeId);
        const version = existing ? existing.version + 1 : 1;
        const profile = this.analyzer.buildProfile(input, creative, version);
        const includeSocialProof = input.includeSocialProof ?? false;
        const storyFlow = this.analyzer.buildStoryFlow(creative, understanding, strategy, includeSocialProof);
        const scenes = this.analyzer.buildScenes(profile, storyFlow, creative, understanding, includeSocialProof);
        profile.totalScenes = scenes.length;
        const platformRules = this.analyzer.buildPlatformRules(creative);
        const timing = this.analyzer.buildTiming(scenes, profile);
        let continuity = this.analyzer.checkContinuity(scenes, creative, understanding);
        if (continuity.issues.length > 0) {
            continuity = this.applyContinuityRepairs(scenes, continuity, understanding.identity.productName);
            const rechecked = this.analyzer.checkContinuity(scenes, creative, understanding);
            continuity = {
                ...rechecked,
                recommendations: [...new Set([...continuity.recommendations, ...rechecked.recommendations])],
            };
        }
        const scores = this.scorer.computeScores(scenes, storyFlow, timing, continuity, creative, strategy);
        const validation = this.scorer.isStoryboardValid(scores, scenes, continuity);
        if (!validation.valid) {
            this.logger.log("warn", "validation", "Storyboard rejected", {
                productId: input.productId,
                diagnostics: validation.diagnostics,
            });
            return {
                success: false,
                durationMs: Date.now() - start,
                diagnostics: validation.diagnostics,
                message: "Storyboard validation failed — scenes must be logically connected",
            };
        }
        const productionReady = this.scorer.isProductionReady(scenes, continuity, scores);
        const draft = {
            storyboardId: profile.storyboardId,
            productId: input.productId,
            projectId: profile.projectId,
            creativeId: creative.creativeId,
            strategyId: strategy.strategyId,
            profile,
            scenes,
            storyFlow,
            platformRules,
            timing,
            continuity,
            scores,
            relationships: {
                creativeDirections: [creative.creativeId],
                products: [input.productId],
                brands: [creative.profile.brand],
                marketingStrategies: [strategy.strategyId],
                scripts: [],
                visualPlans: [],
                audioPlans: [],
                productionPlans: [],
                knowledgeRecords: [],
            },
            validated: true,
            productionReady,
            createdAt: existing?.createdAt ?? new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            version,
        };
        draft.relationships = this.linker.detectRelationships(draft, this.records.getAll(), creative, strategy, understanding);
        const intelligenceValidation = this.foundation.validateProductIntelligence({
            qualityScore: scores.storyboardQualityScore,
            confidenceScore: scores.aiConfidenceScore,
            verificationStatus: scores.aiConfidenceScore >= 75
                ? ProductIntelligenceVerificationStatus.Verified
                : ProductIntelligenceVerificationStatus.Pending,
            source: ProductIntelligenceSource.KnowledgeEngine,
            sourceRef: creative.creativeId,
            versionHistory: [
                {
                    version,
                    timestamp: new Date().toISOString(),
                    changeSummary: `Storyboard v${version} — ${scenes.length} scenes`,
                    source: ProductIntelligenceSource.KnowledgeEngine,
                },
            ],
            relationshipLinks: [
                ...draft.relationships.knowledgeRecords,
                ...draft.relationships.products,
                ...draft.relationships.creativeDirections,
            ],
            healthStatus: ProductIntelligenceHealthLevel.Good,
        });
        if (!intelligenceValidation.valid) {
            return {
                success: false,
                durationMs: Date.now() - start,
                diagnostics: intelligenceValidation.issues,
                message: "Product intelligence validation failed for storyboard",
            };
        }
        this.records.upsert(draft);
        this.logger.log("info", "storyboard-creation", "Storyboard prepared", {
            storyboardId: draft.storyboardId,
            scenes: scenes.length,
            productionReady,
            durationMs: Date.now() - start,
        });
        this.logger.log("info", "scene-planning", "Scenes planned", {
            storyboardId: draft.storyboardId,
            sceneCount: scenes.length,
            platform: profile.platform,
        });
        if (continuity.recommendations.length > 0) {
            this.logger.log("info", "recommendation", "Continuity recommendations", {
                storyboardId: draft.storyboardId,
                recommendations: continuity.recommendations,
            });
        }
        this.logger.log("info", "relationship", "Storyboard relationships updated", {
            storyboardId: draft.storyboardId,
            relationshipCount: draft.relationships.scripts.length + draft.relationships.visualPlans.length,
        });
        return { success: true, record: draft, durationMs: Date.now() - start, diagnostics: [] };
    }
    search(query) {
        let results = this.records.getAll();
        if (query.storyboardId)
            results = results.filter((r) => r.storyboardId === query.storyboardId);
        if (query.productId)
            results = results.filter((r) => r.productId === query.productId);
        if (query.platform)
            results = results.filter((r) => r.profile.platform === query.platform);
        if (query.campaignGoal)
            results = results.filter((r) => r.profile.campaignGoal === query.campaignGoal);
        if (query.creativeStyle)
            results = results.filter((r) => r.profile.creativeStyle === query.creativeStyle);
        if (query.brand) {
            const brandLower = query.brand.toLowerCase();
            results = results.filter((r) => r.profile.brand.toLowerCase().includes(brandLower) ||
                r.relationships.brands.some((b) => b.toLowerCase().includes(brandLower)));
        }
        if (query.audience) {
            const audienceLower = query.audience.toLowerCase();
            results = results.filter((r) => r.profile.targetAudience.toLowerCase().includes(audienceLower));
        }
        if (query.scenePurpose) {
            const purposeLower = query.scenePurpose.toLowerCase();
            results = results.filter((r) => r.scenes.some((s) => s.scenePurpose.toLowerCase().includes(purposeLower)));
        }
        if (query.text) {
            const textLower = query.text.toLowerCase();
            results = results.filter((r) => r.storyboardId.toLowerCase().includes(textLower) ||
                r.storyFlow.hook.toLowerCase().includes(textLower));
        }
        return results.slice(0, query.limit ?? 50);
    }
    applyContinuityRepairs(scenes, continuity, product) {
        const repaired = {
            ...continuity,
            issues: [...continuity.issues],
            recommendations: [...continuity.recommendations],
        };
        const productPurposes = [
            "feature-presentation",
            "benefit-demonstration",
            "customer-value",
            "offer-presentation",
        ];
        for (const scene of scenes) {
            if (productPurposes.includes(scene.scenePurpose)) {
                scene.productFocus = `${product} as hero element`;
            }
        }
        return repaired;
    }
    reject(start, message, diagnostics) {
        this.logger.log("warn", "validation", message, { diagnostics });
        return { success: false, durationMs: Date.now() - start, diagnostics, message };
    }
}
//# sourceMappingURL=storyboard-processor.js.map