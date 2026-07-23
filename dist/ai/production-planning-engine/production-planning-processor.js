import { ProductIntelligenceHealthLevel, ProductIntelligenceSource, ProductIntelligenceVerificationStatus, } from "../product-intelligence-foundation/types.js";
export class ProductionPlanningProcessor {
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
    async createProductionPlan(input) {
        const start = Date.now();
        const storyboardEngine = this.foundation.getStoryboardIntelligenceEngine();
        const scriptEngine = this.foundation.getScriptPlanningEngine();
        const visualEngine = this.foundation.getVisualPlanningEngine();
        const audioEngine = this.foundation.getAudioPlanningEngine();
        const creativeEngine = this.foundation.getCreativeDirectionEngine();
        const strategyEngine = this.foundation.getMarketingStrategyIntelligenceEngine();
        const understandingEngine = this.foundation.getProductUnderstandingEngine();
        const understanding = understandingEngine.getUnderstanding(input.productId);
        if (!understanding?.validated) {
            return this.reject(start, "Complete product understanding required before production planning", [
                "Product must be understood and validated",
            ]);
        }
        let storyboard = input.storyboardId
            ? storyboardEngine.getStoryboard(input.storyboardId)
            : storyboardEngine.getStoryboardsByProduct(input.productId)[0];
        if (!storyboard?.validated || !storyboard.productionReady) {
            const storyboardResult = await storyboardEngine.createStoryboard({
                productId: input.productId,
                storyboardId: input.storyboardId,
                projectId: input.projectId,
            });
            if (!storyboardResult.success || !storyboardResult.record) {
                return this.reject(start, storyboardResult.message ?? "Production-ready storyboard required before production planning", storyboardResult.diagnostics.length > 0
                    ? storyboardResult.diagnostics
                    : ["Storyboard must be validated and production-ready"]);
            }
            storyboard = storyboardResult.record;
        }
        let scriptPlan = input.scriptPlanId
            ? scriptEngine.getScriptPlan(input.scriptPlanId)
            : scriptEngine.getScriptPlansByProduct(input.productId).find((r) => r.storyboardId === storyboard.storyboardId);
        if (!scriptPlan?.validated || !scriptPlan.productionReady) {
            const scriptResult = await scriptEngine.createScriptPlan({
                productId: input.productId,
                storyboardId: storyboard.storyboardId,
                scriptPlanId: input.scriptPlanId,
                projectId: input.projectId,
            });
            if (!scriptResult.success || !scriptResult.record) {
                return this.reject(start, scriptResult.message ?? "Production-ready script plan required before production planning", scriptResult.diagnostics.length > 0
                    ? scriptResult.diagnostics
                    : ["Script plan must be validated and production-ready"]);
            }
            scriptPlan = scriptResult.record;
        }
        let visualPlan = input.visualPlanId
            ? visualEngine.getVisualPlan(input.visualPlanId)
            : visualEngine
                .getVisualPlansByProduct(input.productId)
                .find((r) => r.storyboardId === storyboard.storyboardId && r.scriptPlanId === scriptPlan.scriptPlanId);
        if (!visualPlan?.validated || !visualPlan.productionReady) {
            const visualResult = await visualEngine.createVisualPlan({
                productId: input.productId,
                storyboardId: storyboard.storyboardId,
                scriptPlanId: scriptPlan.scriptPlanId,
                visualPlanId: input.visualPlanId,
                projectId: input.projectId,
            });
            if (!visualResult.success || !visualResult.record) {
                return this.reject(start, visualResult.message ?? "Production-ready visual plan required before production planning", visualResult.diagnostics.length > 0
                    ? visualResult.diagnostics
                    : ["Visual plan must be validated and production-ready"]);
            }
            visualPlan = visualResult.record;
        }
        let audioPlan = input.audioPlanId
            ? audioEngine.getAudioPlan(input.audioPlanId)
            : audioEngine
                .getAudioPlansByProduct(input.productId)
                .find((r) => r.storyboardId === storyboard.storyboardId &&
                r.scriptPlanId === scriptPlan.scriptPlanId &&
                r.visualPlanId === visualPlan.visualPlanId);
        if (!audioPlan?.validated || !audioPlan.productionReady) {
            const audioResult = await audioEngine.createAudioPlan({
                productId: input.productId,
                storyboardId: storyboard.storyboardId,
                scriptPlanId: scriptPlan.scriptPlanId,
                visualPlanId: visualPlan.visualPlanId,
                audioPlanId: input.audioPlanId,
                projectId: input.projectId,
            });
            if (!audioResult.success || !audioResult.record) {
                return this.reject(start, audioResult.message ?? "Production-ready audio plan required before production planning", audioResult.diagnostics.length > 0
                    ? audioResult.diagnostics
                    : ["Audio plan must be validated and production-ready"]);
            }
            audioPlan = audioResult.record;
        }
        const creative = creativeEngine.getCreativeDirection(storyboard.creativeId);
        const strategy = strategyEngine.getStrategy(storyboard.strategyId);
        if (!creative?.validated || !strategy?.validated) {
            return this.reject(start, "Validated creative direction and marketing strategy required", [
                "Upstream creative and strategy records must be validated",
            ]);
        }
        const existing = input.productionPlanId
            ? this.records.get(input.productionPlanId)
            : this.records
                .getByProduct(input.productId)
                .find((r) => r.storyboardId === storyboard.storyboardId &&
                r.audioPlanId === audioPlan.audioPlanId);
        const version = existing ? existing.version + 1 : 1;
        const profile = this.analyzer.buildProfile(input, storyboard, scriptPlan, visualPlan, audioPlan, version);
        const workflow = this.analyzer.buildWorkflow(storyboard, scriptPlan, visualPlan, audioPlan);
        let assets = this.analyzer.buildAssetManagement(storyboard, scriptPlan, visualPlan, audioPlan, creative);
        let dependencies = this.analyzer.buildDependencyValidation(this.foundation, storyboard, scriptPlan, visualPlan, audioPlan, creative, strategy, understanding);
        const renderPreparation = this.analyzer.buildRenderPreparation(storyboard);
        const exportPreparation = this.analyzer.buildExportPreparation(storyboard);
        const recoveryPlan = this.analyzer.buildRecoveryPlan(profile.productionPlanId);
        const platformRules = this.analyzer.buildPlatformRules(storyboard);
        let sceneProductionPlans = this.analyzer.buildSceneProductionPlans(storyboard, scriptPlan, visualPlan, audioPlan);
        let alignment = this.analyzer.validateAlignment(sceneProductionPlans, storyboard, scriptPlan, visualPlan, audioPlan);
        if (!alignment.aligned) {
            sceneProductionPlans = this.analyzer.buildSceneProductionPlans(storyboard, scriptPlan, visualPlan, audioPlan);
            alignment = this.analyzer.validateAlignment(sceneProductionPlans, storyboard, scriptPlan, visualPlan, audioPlan);
        }
        const scores = this.scorer.computeScores(sceneProductionPlans, workflow, assets, dependencies, storyboard, scriptPlan, visualPlan, audioPlan);
        let validation = this.scorer.isProductionPlanValid(scores, dependencies, assets, sceneProductionPlans, storyboard, alignment.issues);
        if (!validation.valid) {
            const repaired = this.applyRepairs(assets, sceneProductionPlans);
            if (repaired.assets || repaired.scenes) {
                if (repaired.assets)
                    assets = repaired.assets;
                if (repaired.scenes)
                    sceneProductionPlans = repaired.scenes;
                dependencies = this.analyzer.buildDependencyValidation(this.foundation, storyboard, scriptPlan, visualPlan, audioPlan, creative, strategy, understanding);
                const repairedScores = this.scorer.computeScores(sceneProductionPlans, workflow, assets, dependencies, storyboard, scriptPlan, visualPlan, audioPlan);
                validation = this.scorer.isProductionPlanValid(repairedScores, dependencies, assets, sceneProductionPlans, storyboard, this.analyzer.validateAlignment(sceneProductionPlans, storyboard, scriptPlan, visualPlan, audioPlan).issues);
                if (validation.valid) {
                    Object.assign(scores, repairedScores);
                }
            }
        }
        if (!validation.valid) {
            this.logger.log("warn", "validation", "Production plan rejected", {
                productId: input.productId,
                diagnostics: validation.diagnostics,
            });
            return {
                success: false,
                durationMs: Date.now() - start,
                diagnostics: validation.diagnostics,
                message: "Production planning validation failed — every dependency must pass validation before production approval",
            };
        }
        const productionReady = this.scorer.isProductionReady(sceneProductionPlans, storyboard, scriptPlan, visualPlan, audioPlan, dependencies, scores);
        const draft = {
            productionPlanId: profile.productionPlanId,
            productId: input.productId,
            projectId: profile.projectId,
            storyboardId: storyboard.storyboardId,
            scriptPlanId: scriptPlan.scriptPlanId,
            visualPlanId: visualPlan.visualPlanId,
            audioPlanId: audioPlan.audioPlanId,
            creativeId: creative.creativeId,
            strategyId: strategy.strategyId,
            profile,
            workflow,
            assets,
            dependencies,
            renderPreparation,
            exportPreparation,
            recoveryPlan,
            platformRules,
            sceneProductionPlans,
            scores,
            relationships: {
                storyboards: [storyboard.storyboardId],
                scriptPlans: [scriptPlan.scriptPlanId],
                visualPlans: [visualPlan.visualPlanId],
                audioPlans: [audioPlan.audioPlanId],
                creativeDirections: [creative.creativeId],
                marketingStrategies: [strategy.strategyId],
                products: [input.productId],
                brands: [creative.profile.brand],
                knowledgeRecords: [],
                productionHistory: [],
            },
            validated: true,
            productionReady,
            createdAt: existing?.createdAt ?? new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            version,
        };
        draft.relationships = this.linker.detectRelationships(draft, storyboard, scriptPlan, visualPlan, audioPlan, creative, strategy, understanding);
        const intelligenceValidation = this.foundation.validateProductIntelligence({
            qualityScore: scores.productionReadinessScore,
            confidenceScore: scores.aiConfidenceScore,
            verificationStatus: scores.aiConfidenceScore >= 75
                ? ProductIntelligenceVerificationStatus.Verified
                : ProductIntelligenceVerificationStatus.Pending,
            source: ProductIntelligenceSource.System,
            sourceRef: storyboard.storyboardId,
            versionHistory: [
                {
                    version,
                    timestamp: new Date().toISOString(),
                    changeSummary: `Production plan v${version} — ${sceneProductionPlans.length} scene production plans`,
                    source: ProductIntelligenceSource.System,
                },
            ],
            relationshipLinks: [
                ...draft.relationships.knowledgeRecords,
                ...draft.relationships.storyboards,
                ...draft.relationships.scriptPlans,
                ...draft.relationships.visualPlans,
                ...draft.relationships.audioPlans,
            ],
            healthStatus: ProductIntelligenceHealthLevel.Good,
        });
        if (!intelligenceValidation.valid) {
            return {
                success: false,
                durationMs: Date.now() - start,
                diagnostics: intelligenceValidation.issues,
                message: "Product intelligence validation failed for production plan",
            };
        }
        this.records.upsert(draft);
        this.logger.log("info", "production-planning", "Production plan prepared", {
            productionPlanId: draft.productionPlanId,
            sceneCount: sceneProductionPlans.length,
            productionReady,
            durationMs: Date.now() - start,
        });
        this.logger.log("info", "workflow", "Production workflow planned", {
            productionPlanId: draft.productionPlanId,
            platform: profile.platform,
        });
        this.logger.log("info", "dependency", "Dependency validation complete", {
            productionPlanId: draft.productionPlanId,
            dependencyScore: scores.dependencyScore,
        });
        this.logger.log("info", "asset-validation", "Asset validation planned", {
            productionPlanId: draft.productionPlanId,
            assetCount: this.analyzer.getAllRequiredAssets(assets).length,
        });
        this.logger.log("info", "performance", "Production planning completed", {
            productionPlanId: draft.productionPlanId,
            durationMs: Date.now() - start,
        });
        return { success: true, record: draft, durationMs: Date.now() - start, diagnostics: [] };
    }
    search(query) {
        let results = this.records.getAll();
        if (query.productionPlanId)
            results = results.filter((r) => r.productionPlanId === query.productionPlanId);
        if (query.storyboardId)
            results = results.filter((r) => r.storyboardId === query.storyboardId);
        if (query.scriptPlanId)
            results = results.filter((r) => r.scriptPlanId === query.scriptPlanId);
        if (query.visualPlanId)
            results = results.filter((r) => r.visualPlanId === query.visualPlanId);
        if (query.audioPlanId)
            results = results.filter((r) => r.audioPlanId === query.audioPlanId);
        if (query.productId)
            results = results.filter((r) => r.productId === query.productId);
        if (query.projectId)
            results = results.filter((r) => r.projectId === query.projectId);
        if (query.platform)
            results = results.filter((r) => r.profile.platform === query.platform);
        if (query.campaignGoal)
            results = results.filter((r) => r.profile.campaignGoal === query.campaignGoal);
        if (query.workflow) {
            const wf = query.workflow.toLowerCase();
            results = results.filter((r) => r.workflow.preProduction.toLowerCase().includes(wf) ||
                r.workflow.renderingPreparation.toLowerCase().includes(wf));
        }
        if (query.asset) {
            const assetLower = query.asset.toLowerCase();
            const hasAsset = (r) => {
                const all = this.analyzer.getAllRequiredAssets(r.assets);
                return all.some((a) => a.assetType.toLowerCase().includes(assetLower) || a.assetId.toLowerCase().includes(assetLower));
            };
            results = results.filter(hasAsset);
        }
        if (query.brand) {
            const brandLower = query.brand.toLowerCase();
            results = results.filter((r) => r.profile.brand.toLowerCase().includes(brandLower) ||
                r.relationships.brands.some((b) => b.toLowerCase().includes(brandLower)));
        }
        if (query.text) {
            const textLower = query.text.toLowerCase();
            results = results.filter((r) => r.productionPlanId.toLowerCase().includes(textLower) ||
                r.profile.product.toLowerCase().includes(textLower));
        }
        return results.slice(0, query.limit ?? 50);
    }
    applyRepairs(assets, sceneProductionPlans) {
        const required = this.analyzer.getAllRequiredAssets(assets);
        const hasMissing = required.some((a) => a.status === "missing");
        const scenesNeedRepair = sceneProductionPlans.some((s) => !s.renderInstructions.startsWith("Plan render"));
        if (!hasMissing && !scenesNeedRepair)
            return {};
        const repairedAssets = hasMissing
            ? {
                ...assets,
                images: assets.images.map((a) => ({ ...a, status: "planned" })),
                logos: assets.logos.map((a) => ({ ...a, status: "planned" })),
                videos: assets.videos.map((a) => ({ ...a, status: "planned" })),
            }
            : undefined;
        const repairedScenes = scenesNeedRepair
            ? sceneProductionPlans.map((s) => ({
                ...s,
                renderInstructions: s.renderInstructions.startsWith("Plan render")
                    ? s.renderInstructions
                    : `Plan render scene ${s.sceneNumber}`,
            }))
            : undefined;
        return { assets: repairedAssets, scenes: repairedScenes };
    }
    reject(start, message, diagnostics) {
        this.logger.log("warn", "validation", message, { diagnostics });
        return { success: false, durationMs: Date.now() - start, diagnostics, message };
    }
}
//# sourceMappingURL=production-planning-processor.js.map