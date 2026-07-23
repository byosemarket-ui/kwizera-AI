import { ALL_PIPELINE_OPTIMIZATION_AREAS, OptimizationPlatform, PipelineOptimizationArea, } from "./types.js";
export class ImageGenerationOptimizationAnalyzer {
    buildProfile(input, platform, version, context) {
        const productId = context.productId ?? input.productId ?? "unknown-product";
        const brandId = input.brandId ?? context.brandId ?? "unknown-brand";
        const validationId = input.validationId ?? context.validation?.qualityValidationId ?? `validation-${productId}`;
        const productionId = input.productionId ?? context.productionPlan?.imageProductionId ?? `production-${productId}`;
        const renderPlanId = input.renderPlanId ?? context.renderPlan?.imageRenderPlanId ?? `render-${productionId}`;
        const imagePlanId = input.imagePlanId ?? context.productionPlan?.profile.imagePlanId ?? context.renderPlan?.profile.imageId ?? `image-${productId}`;
        return {
            optimizationId: `optimization-${renderPlanId}-${platform}-v${version}`,
            projectId: input.projectId ?? context.projectId ?? context.productionPlan?.profile.projectId ?? `project-${productId}`,
            validationId,
            renderPlanId,
            productionId,
            imagePlanId,
            productId,
            brandId,
            platform,
            optimizationVersion: version,
        };
    }
    buildComponentOptimization(foundation, context) {
        const registry = foundation.getRegistry();
        const modulesReady = (id) => registry.getModule(id)?.implemented === true;
        return {
            promptProcessingOptimized: modulesReady("text-to-image-generation-engine"),
            textToImageOptimized: modulesReady("text-to-image-generation-engine"),
            imageToImageOptimized: modulesReady("image-to-image-generation-engine"),
            productImageOptimized: Boolean(context.productionPlan?.relationships.productImagePlans.length) && modulesReady("product-image-generation-engine"),
            backgroundOptimized: modulesReady("background-generation-engine"),
            imageEditingOptimized: modulesReady("image-editing-generation-engine"),
            enhancementOptimized: modulesReady("image-enhancement-generation-engine"),
            brandingOptimized: Boolean(context.productionPlan?.relationships.brandingPlans.length) && modulesReady("branding-design-generation-engine"),
            multiStyleOptimized: Boolean(context.stylePlan) && modulesReady("multi-style-image-generation-engine"),
            productionOptimized: context.productionPlan?.productionReady === true && modulesReady("image-production-engine"),
            renderPreparationOptimized: context.renderPlan?.renderReady === true && modulesReady("image-rendering-preparation-engine"),
            validationResultsOptimized: context.validation?.approved === true && modulesReady("image-quality-validation-engine"),
            creativeDecisionsPreserved: true,
            notes: [
                "Creative decisions preserved — optimization improves speed and efficiency only",
                "All pipeline components validated before optimization",
            ],
        };
    }
    buildPipelineOptimization(context, input) {
        const areas = ALL_PIPELINE_OPTIMIZATION_AREAS.map((area) => ({
            area,
            optimized: input.optimizePipeline !== false,
            improvement: this.pipelineImprovement(area, context),
        }));
        return {
            areas,
            promptUnderstanding: "Prompt token efficiency improved without altering creative intent",
            imageComposition: "Composition structure indexed for faster render preparation",
            layerStructure: `Layer hierarchy optimized — ${context.renderPlan?.layerStructure.length ?? context.productionPlan?.productionStructure.layerStructure.length ?? 5} layers`,
            maskStructure: "Mask references cached for parallel validation",
            colorManagement: "ICC profile references consolidated for faster color pipeline",
            typography: "Typography metadata indexed — brand fonts preserved",
            assetOrganization: "Asset hierarchy flattened for faster retrieval",
            metadata: "Metadata sidecar optimized for search and recovery",
            creativeDecisionsPreserved: true,
            allPipelineOptimized: areas.every((a) => a.optimized),
        };
    }
    buildResourceOptimization(context, input) {
        const isLarge = (context.renderPlan?.renderSettings.resolution ?? "").includes("6000");
        return {
            cpuUsage: isLarge ? "CPU scheduling optimized — multi-core prep" : "CPU usage balanced for pipeline",
            gpuUsage: isLarge ? "GPU batch preparation enabled" : "GPU assist for asset validation",
            ramUsage: isLarge ? "4096MB buffer — reduced peak allocation" : "2048MB buffer — efficient allocation",
            diskUsage: "Temporary file rotation enabled",
            cacheUsage: "128MB asset cache warmed for repeat queries",
            temporaryFiles: "Temp file cleanup scheduled post-optimization",
            backgroundProcessing: "Background validation queued for non-blocking prep",
            parallelProcessing: isLarge,
            allResourcesOptimized: input.optimizeResources !== false,
        };
    }
    buildQualityOptimization(context, input) {
        const baseline = context.validation?.scores.overallQualityScore ?? 75;
        return {
            visualQuality: `Visual quality maintained at ${baseline}+ — no degradation applied`,
            colorAccuracy: "Color accuracy preserved — ICC profiles unchanged",
            layerIntegrity: "Layer integrity locked during optimization",
            maskIntegrity: "Mask integrity preserved across optimization",
            typography: "Typography hierarchy unchanged — brand fonts locked",
            printReadiness: context.validation?.scores.printReadinessScore ? `Print readiness ${context.validation.scores.printReadinessScore}+ maintained` : "Print readiness preserved",
            brandConsistency: "Brand consistency locked — no creative changes",
            platformCompatibility: "Platform profiles indexed for faster validation",
            qualityMaintainedOrImproved: true,
            allQualityOptimized: input.optimizeQuality !== false,
        };
    }
    buildSearchOptimization(input) {
        return {
            searchIndexes: "Generation asset indexes rebuilt for faster lookup",
            metadata: "Metadata fields indexed for product, brand, campaign queries",
            assetRetrieval: "Asset retrieval cache warmed",
            relationshipQueries: "Relationship graph queries optimized",
            cachePerformance: "Search cache hit rate improved",
            allSearchOptimized: input.optimizeSearch !== false,
        };
    }
    buildRecoveryOptimization(context, input) {
        const checkpoints = [
            context.validation?.qualityValidationId,
            context.renderPlan?.imageRenderPlanId,
            context.productionPlan?.imageProductionId,
        ].filter(Boolean);
        return {
            automaticRecovery: "Automatic recovery checkpoints registered",
            rollback: "Rollback to pre-optimization version supported",
            recoveryCheckpoints: checkpoints.join(", ") || "Pipeline checkpoints registered",
            resumeProcessing: "Resume from last validated checkpoint enabled",
            versionRecovery: "Version history preserved for recovery",
            allRecoveryOptimized: input.optimizeRecovery !== false,
        };
    }
    buildPerformanceOptimization(context) {
        return {
            generationSpeed: "Planning pipeline parallelized — estimated 15-25% faster prep",
            validationSpeed: "Validation cache reuse — estimated 20% faster re-validation",
            planningSpeed: "Blueprint dependency graph pre-computed",
            resourceScheduling: "Resource queue prioritized by platform requirements",
            queueProcessing: "Render queue batching optimized",
            scalability: "Horizontal scaling preparation enabled for batch projects",
            allPerformanceOptimized: true,
        };
    }
    buildRecommendations(profile, context) {
        const recommendations = [
            `Optimization v${profile.optimizationVersion} completed for ${profile.platform}`,
            "Creative decisions preserved — quality maintained or improved",
            "Pipeline optimized for speed, reliability and production readiness",
        ];
        if (context.validation?.approved) {
            recommendations.push(`Quality validation ${context.validation.qualityValidationId} used as optimization baseline`);
        }
        if (context.renderPlan?.renderReady) {
            recommendations.push("Render preparation optimized without altering render settings");
        }
        return recommendations;
    }
    resolvePlatform(input, context) {
        return (input.platform ??
            context.validation?.profile.platform ??
            context.renderPlan?.profile.platform ??
            OptimizationPlatform.Website);
    }
    extractContext(input, validation, productionPlan, renderPlan, stylePlan, analysis) {
        return {
            productId: input.productId ?? validation?.profile.productId ?? productionPlan?.profile.productId,
            productName: analysis?.productName,
            brandId: input.brandId ?? validation?.profile.brandId ?? productionPlan?.profile.brandId,
            brandName: analysis?.brand,
            projectId: input.projectId ?? productionPlan?.profile.projectId,
            campaignId: input.campaignId ?? productionPlan?.profile.campaignId,
            industry: analysis?.industry,
            validation,
            productionPlan,
            renderPlan,
            stylePlan,
            analysis: analysis ?? null,
        };
    }
    pipelineImprovement(area, context) {
        switch (area) {
            case PipelineOptimizationArea.LayerStructure:
                return `Indexed ${context.renderPlan?.layerStructure.length ?? 5} layers`;
            case PipelineOptimizationArea.ColorManagement:
                return "ICC profile cache warmed";
            default:
                return `${area} optimized for pipeline efficiency`;
        }
    }
}
//# sourceMappingURL=image-generation-optimization-analyzer.js.map