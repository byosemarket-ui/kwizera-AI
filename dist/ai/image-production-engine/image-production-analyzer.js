import { ALL_IMAGE_PRODUCTION_ASSET_TYPES, ALL_IMAGE_PRODUCTION_DEPENDENCIES, ALL_IMAGE_PRODUCTION_EXPORT_FORMATS, ALL_IMAGE_PRODUCTION_PLATFORMS, ALL_IMAGE_PRODUCTION_WORKFLOW_STAGES, DEPENDENCY_MODULE_MAP, IMAGE_PRODUCTION_PLATFORM_CONFIG, ImageProductionAssetType, ImageProductionColorSpace, ImageProductionDependency, ImageProductionExportFormat, ImageProductionPlatform, WORKFLOW_MODULE_MAP, } from "./types.js";
export class ImageProductionAnalyzer {
    buildProfile(input, platform, version, context) {
        const productId = context.productId ?? input.productId ?? "unknown-product";
        const brandId = input.brandId ?? context.brandId ?? context.brandName ?? "unknown-brand";
        const imagePlanId = input.imagePlanId ??
            input.stylePlanId ??
            context.stylePlan?.stylePlanId ??
            context.productImagePlan?.productImagePlanId ??
            `image-plan-${productId}`;
        return {
            imageProductionId: `production-${imagePlanId}-${platform}-v${version}`,
            projectId: input.projectId ?? context.projectId ?? `project-${productId}`,
            imagePlanId,
            productId,
            brandId,
            campaignId: input.campaignId ?? context.campaignId ?? `campaign-${productId}`,
            platform,
            productionVersion: version,
            language: input.language ?? "en",
        };
    }
    buildWorkflowValidation(foundation) {
        const registry = foundation.getRegistry();
        return ALL_IMAGE_PRODUCTION_WORKFLOW_STAGES.map((stage) => {
            const moduleId = WORKFLOW_MODULE_MAP[stage];
            const module = registry.getModule(moduleId);
            const validated = module?.implemented === true && module.status === "active";
            return {
                stage,
                validated,
                moduleId,
                status: module?.status ?? "missing",
                notes: validated
                    ? [`${stage} workflow validated — module ${moduleId} active`]
                    : [`${stage} workflow pending — module ${moduleId} not ready`],
            };
        });
    }
    buildAssetValidation(context, input) {
        const entries = [];
        for (const assetType of ALL_IMAGE_PRODUCTION_ASSET_TYPES) {
            const assetId = this.resolveAssetId(assetType, context, input);
            const validated = assetId.length > 0 && !assetId.startsWith("pending-");
            entries.push({
                assetType,
                assetId: assetId || `pending-${assetType}`,
                validated,
                source: this.resolveAssetSource(assetType, context),
                notes: validated
                    ? [`${assetType} asset verified: ${assetId}`]
                    : [`${assetType} asset planned for production`],
            });
        }
        return entries;
    }
    buildDependencyValidation(foundation) {
        const integration = foundation.integration;
        const registry = foundation.getRegistry();
        const status = integration.getStatus();
        return ALL_IMAGE_PRODUCTION_DEPENDENCIES.map((dependency) => {
            let available = false;
            let moduleId;
            const notes = [];
            switch (dependency) {
                case ImageProductionDependency.MemoryEngine:
                    available = status.memoryEngine;
                    notes.push(available ? "Memory Engine connected" : "Memory Engine unavailable");
                    break;
                case ImageProductionDependency.KnowledgeEngine:
                    available = status.knowledgeEngine;
                    notes.push(available ? "Knowledge Engine connected" : "Knowledge Engine unavailable");
                    break;
                case ImageProductionDependency.ProductIntelligenceEngine:
                    available = status.productIntelligenceEngine;
                    notes.push(available ? "Product Intelligence Engine connected" : "Product Intelligence unavailable");
                    break;
                case ImageProductionDependency.ImageIntelligenceEngine:
                    available = status.imageIntelligenceEngine;
                    notes.push(available ? "Image Intelligence Engine connected" : "Image Intelligence unavailable");
                    break;
                case ImageProductionDependency.VideoIntelligenceEngine:
                    available = status.videoIntelligenceEngine;
                    notes.push(available ? "Video Intelligence Engine connected" : "Video Intelligence unavailable");
                    break;
                case ImageProductionDependency.ImageGenerationFoundation:
                    available = foundation.isStartupComplete();
                    notes.push(available ? "Image Generation Foundation operational" : "Foundation not ready");
                    break;
                default: {
                    moduleId = DEPENDENCY_MODULE_MAP[dependency];
                    if (moduleId) {
                        const module = registry.getModule(moduleId);
                        available = module?.implemented === true;
                        notes.push(available ? `${moduleId} registered and implemented` : `${moduleId} not implemented`);
                    }
                    break;
                }
            }
            return { dependency, available, moduleId, notes };
        });
    }
    buildProductionStructure(profile, context) {
        const brandColors = context.brandName ? [`${context.brandName}-primary`, `${context.brandName}-secondary`] : ["brand-primary", "brand-secondary"];
        const layers = [
            { layerId: "layer-background", name: "Background", order: 1, type: "background", visible: true, locked: false },
            { layerId: "layer-product", name: "Product", order: 2, type: "product", visible: true, locked: true },
            { layerId: "layer-branding", name: "Branding", order: 3, type: "brand", visible: true, locked: true },
            { layerId: "layer-effects", name: "Effects", order: 4, type: "effects", visible: true, locked: false },
            { layerId: "layer-text", name: "Text", order: 5, type: "text", visible: true, locked: false },
        ];
        const masks = [
            { maskId: "mask-product", layerId: "layer-product", type: "product-mask", validated: true },
            { maskId: "mask-branding", layerId: "layer-branding", type: "brand-mask", validated: true },
        ];
        return {
            layerStructure: layers,
            maskStructure: masks,
            objectHierarchy: ["scene", "product", "branding", "effects", "text"],
            assetHierarchy: ["source", "generated", "brand-assets", "templates", "metadata"],
            colorManagement: {
                primaryColorSpace: ImageProductionColorSpace.Rgb,
                iccProfile: "sRGB IEC61966-2.1",
                brandColors,
            },
            metadataStructure: {
                productId: profile.productId,
                brandId: profile.brandId,
                campaignId: profile.campaignId,
                platform: profile.platform,
                productionVersion: String(profile.productionVersion),
            },
            versionStructure: {
                currentVersion: profile.productionVersion,
                historyRef: `production-history-${profile.imageProductionId}`,
            },
        };
    }
    buildRenderPreparation(profile) {
        const config = IMAGE_PRODUCTION_PLATFORM_CONFIG[profile.platform];
        const isPrint = profile.platform === ImageProductionPlatform.Print ||
            profile.platform === ImageProductionPlatform.Packaging;
        return {
            resolution: config.resolution,
            dpi: config.dpi,
            aspectRatio: config.aspectRatio,
            colorSpace: isPrint ? ImageProductionColorSpace.Cmyk : ImageProductionColorSpace.Rgb,
            rgbProfile: "sRGB IEC61966-2.1",
            cmykProfile: "ISO Coated v2 (ECI)",
            iccProfiles: isPrint
                ? ["ISO Coated v2 (ECI)", "sRGB IEC61966-2.1"]
                : ["sRGB IEC61966-2.1"],
            compressionStrategy: isPrint ? "lossless-preferred" : "quality-optimized",
            outputQuality: isPrint ? 100 : 92,
            instructions: [
                `Render at ${config.resolution} (${config.aspectRatio}) for ${profile.platform}`,
                `Apply ${config.dpi} DPI for ${profile.platform} delivery`,
                "Preserve product and brand layer integrity during render preparation",
                "Do not execute render — blueprint only",
            ],
        };
    }
    buildExportPreparation(input) {
        const exports = ALL_IMAGE_PRODUCTION_EXPORT_FORMATS.map((format) => ({
            format,
            enabled: input.prepareExports !== false,
            quality: format === ImageProductionExportFormat.Pdf || format === ImageProductionExportFormat.Tiff ? 100 : 92,
            colorSpace: format === ImageProductionExportFormat.Pdf && input.platform === ImageProductionPlatform.Print
                ? ImageProductionColorSpace.Cmyk
                : ImageProductionColorSpace.Rgb,
            notes: [`Export blueprint for ${format.toUpperCase()} — no file rendered`],
        }));
        return {
            exports,
            extensibleFormats: ["avif", "heic", "psd", "eps"],
        };
    }
    buildDeliveryInstructions(profile) {
        const config = IMAGE_PRODUCTION_PLATFORM_CONFIG[profile.platform];
        return {
            platform: profile.platform,
            deliveryTargets: [profile.platform, "asset-registry", "production-archive"],
            packagingNotes: [
                `Package for ${profile.platform} at ${config.resolution}`,
                "Include metadata sidecar and color profile references",
            ],
            distributionNotes: [
                "Delivery instructions prepared — no files distributed",
                `Target platform: ${profile.platform}`,
            ],
        };
    }
    buildRecoveryPlan(profile, context) {
        return {
            recoveryId: `recovery-${profile.imageProductionId}`,
            checkpoints: [
                profile.imagePlanId,
                context.productImagePlan?.productImagePlanId ?? profile.productId,
                context.stylePlan?.stylePlanId ?? profile.imageProductionId,
            ].filter(Boolean),
            rollbackSteps: [
                "Restore previous production version from history",
                "Revalidate workflow and asset dependencies",
                "Rebuild layer structure from approved plans",
            ],
            assetRecoveryRefs: [
                context.productImagePlan?.productImagePlanId ?? "",
                context.brandingPlan?.brandDesignId ?? "",
                context.stylePlan?.stylePlanId ?? "",
            ].filter((ref) => ref.length > 0),
        };
    }
    buildPlatformRules(input) {
        if (input.preparePlatformRules === false) {
            return ALL_IMAGE_PRODUCTION_PLATFORMS.slice(0, 1).map((platform) => this.buildPlatformRule(platform));
        }
        return ALL_IMAGE_PRODUCTION_PLATFORMS.map((platform) => this.buildPlatformRule(platform));
    }
    buildRecommendations(context, profile) {
        const recommendations = [
            `Production blueprint v${profile.productionVersion} prepared for ${profile.platform}`,
            "All workflow stages validated before render preparation",
            "Layer and mask structure locked for brand consistency",
        ];
        if (context.stylePlan) {
            recommendations.push(`Style plan ${context.stylePlan.stylePlanId} integrated into production workflow`);
        }
        if (context.brandingPlan) {
            recommendations.push(`Branding plan ${context.brandingPlan.brandDesignId} linked to production layers`);
        }
        if (context.industry) {
            recommendations.push(`Industry-specific production rules applied for ${context.industry}`);
        }
        return recommendations;
    }
    resolvePlatform(input, context) {
        return (input.platform ??
            context.stylePlan?.profile.platform ??
            ImageProductionPlatform.Website);
    }
    resolveImagePlanId(input, context) {
        if (input.imagePlanId)
            return input.imagePlanId;
        if (input.stylePlanId)
            return input.stylePlanId;
        if (context.stylePlan)
            return context.stylePlan.stylePlanId;
        if (context.productImagePlan)
            return context.productImagePlan.productImagePlanId;
        if (input.productImagePlanId)
            return input.productImagePlanId;
        return null;
    }
    extractContextFromProduct(analysis, understanding, creative, strategy, input, productImagePlan, brandingPlan, stylePlan) {
        return {
            productId: input.productId ?? analysis?.productId ?? productImagePlan?.profile.productId,
            productName: analysis?.productName,
            brandName: analysis?.brand ?? brandingPlan?.profile.brandId ?? input.brandId,
            brandId: input.brandId ?? brandingPlan?.profile.brandId ?? analysis?.brand,
            projectId: input.projectId ?? creative?.profile.projectId,
            campaignId: input.campaignId ?? strategy?.relationships.campaigns[0],
            industry: analysis?.industry,
            imagePlanId: this.resolveImagePlanId(input, { stylePlan, productImagePlan }) ?? undefined,
            productImagePlan,
            brandingPlan,
            stylePlan,
            analysis: analysis ?? null,
            understanding: understanding ?? null,
            creative: creative ?? null,
            strategy: strategy ?? null,
        };
    }
    buildPlatformRule(platform) {
        const config = IMAGE_PRODUCTION_PLATFORM_CONFIG[platform];
        const exportFormats = platform === ImageProductionPlatform.Print || platform === ImageProductionPlatform.Packaging
            ? [ImageProductionExportFormat.Tiff, ImageProductionExportFormat.Pdf, ImageProductionExportFormat.Png]
            : [ImageProductionExportFormat.Webp, ImageProductionExportFormat.Jpg, ImageProductionExportFormat.Png];
        return {
            platform,
            resolution: config.resolution,
            aspectRatio: config.aspectRatio,
            exportFormats,
            rules: [
                `${platform}: ${config.resolution} at ${config.dpi} DPI`,
                `Aspect ratio ${config.aspectRatio}`,
                "Brand layer integrity required",
            ],
        };
    }
    resolveAssetId(assetType, context, input) {
        switch (assetType) {
            case ImageProductionAssetType.SourceImage:
                return context.stylePlan?.profile.sourceImageId ?? context.productImagePlan?.productImagePlanId ?? "";
            case ImageProductionAssetType.GeneratedImage:
                return context.stylePlan?.profile.generatedStyleImageId ?? "";
            case ImageProductionAssetType.Logo:
                return context.brandingPlan ? `logo-${context.brandingPlan.brandDesignId}` : "";
            case ImageProductionAssetType.Font:
                return context.brandingPlan ? `font-${context.brandingPlan.profile.brandId}` : "";
            case ImageProductionAssetType.Icon:
                return context.brandingPlan ? `icon-${context.brandingPlan.brandDesignId}` : "";
            case ImageProductionAssetType.Template:
                return input.templateIds?.[0] ?? "";
            case ImageProductionAssetType.Layer:
                return "layer-product";
            case ImageProductionAssetType.Mask:
                return "mask-product";
            case ImageProductionAssetType.Texture:
                return context.stylePlan ? `texture-${context.stylePlan.stylePlanId}` : "";
            case ImageProductionAssetType.BrandAsset:
                return context.brandingPlan?.brandDesignId ?? "";
            case ImageProductionAssetType.ColorProfile:
                return "sRGB IEC61966-2.1";
            case ImageProductionAssetType.Metadata:
                return context.imagePlanId ? `metadata-${context.imagePlanId}` : "";
            default:
                return "";
        }
    }
    resolveAssetSource(assetType, context) {
        if (assetType === ImageProductionAssetType.SourceImage && context.productImagePlan) {
            return "product-image-generation-engine";
        }
        if (assetType === ImageProductionAssetType.GeneratedImage && context.stylePlan) {
            return "multi-style-image-generation-engine";
        }
        if ((assetType === ImageProductionAssetType.Logo ||
            assetType === ImageProductionAssetType.BrandAsset ||
            assetType === ImageProductionAssetType.Font) &&
            context.brandingPlan) {
            return "branding-design-generation-engine";
        }
        return "image-production-engine";
    }
}
//# sourceMappingURL=image-production-analyzer.js.map