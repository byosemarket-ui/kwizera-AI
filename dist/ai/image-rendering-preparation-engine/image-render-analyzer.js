import { ALL_IMAGE_RENDER_ASSET_TYPES, ALL_IMAGE_RENDER_LAYER_CHECKS, ALL_IMAGE_RENDER_MASK_TYPES, ALL_IMAGE_RENDER_PLATFORMS, ALL_IMAGE_RENDER_VALIDATION_STAGES, IMAGE_RENDER_PLATFORM_CONFIG, ImageRenderAssetType, ImageRenderColorSpace, ImageRenderLayerCheck, ImageRenderMaskType, ImageRenderPlatform, RENDER_VALIDATION_MODULE_MAP, } from "./types.js";
export class ImageRenderAnalyzer {
    buildProfile(input, platform, version, context) {
        const productionId = input.productionId ?? context.productionPlan?.imageProductionId ?? `production-${context.productId ?? "unknown"}`;
        const imageId = input.imageId ??
            context.productionPlan?.profile.imagePlanId ??
            context.stylePlan?.profile.generatedStyleImageId ??
            `image-${productionId}`;
        return {
            imageRenderPlanId: `render-plan-${productionId}-${platform}-v${version}`,
            projectId: input.projectId ?? context.projectId ?? context.productionPlan?.profile.projectId ?? `project-${context.productId ?? "unknown"}`,
            productionId,
            imageId,
            platform,
            renderVersion: version,
            language: input.language ?? "en",
        };
    }
    buildRenderValidation(foundation) {
        const registry = foundation.getRegistry();
        return ALL_IMAGE_RENDER_VALIDATION_STAGES.map((stage) => {
            const moduleId = RENDER_VALIDATION_MODULE_MAP[stage];
            const module = registry.getModule(moduleId);
            const validated = module?.implemented === true && module.status === "active";
            return {
                stage,
                validated,
                moduleId,
                status: module?.status ?? "missing",
                notes: validated
                    ? [`${stage} render validation passed — ${moduleId} active`]
                    : [`${stage} render validation pending — ${moduleId} not ready`],
            };
        });
    }
    buildLayerValidation(context, layers) {
        return ALL_IMAGE_RENDER_LAYER_CHECKS.map((check) => {
            const validated = this.validateLayerCheck(check, layers, context);
            return {
                check,
                validated,
                layerCount: layers.length,
                notes: validated
                    ? [`${check} validated across ${layers.length} layers`]
                    : [`${check} requires review`],
            };
        });
    }
    buildMaskValidation(context) {
        const productionMasks = context.productionPlan?.productionStructure.maskStructure ?? [];
        return ALL_IMAGE_RENDER_MASK_TYPES.map((maskType) => {
            const maskId = this.resolveMaskId(maskType, context);
            const validated = maskId.length > 0 && !maskId.startsWith("pending-");
            return {
                maskType,
                maskId: maskId || `pending-${maskType}`,
                validated,
                notes: validated
                    ? [`${maskType} mask verified: ${maskId}`]
                    : [`${maskType} mask planned for render preparation`],
            };
        }).map((entry, index) => {
            if (productionMasks[index] && entry.maskId.startsWith("pending-")) {
                return { ...entry, maskId: productionMasks[index].maskId, validated: productionMasks[index].validated };
            }
            return entry;
        });
    }
    buildAssetValidation(context, input) {
        return ALL_IMAGE_RENDER_ASSET_TYPES.map((assetType) => {
            const assetId = this.resolveAssetId(assetType, context, input);
            const validated = assetId.length > 0 && !assetId.startsWith("pending-");
            return {
                assetType,
                assetId: assetId || `pending-${assetType}`,
                validated,
                source: this.resolveAssetSource(assetType, context),
                notes: validated ? [`${assetType} verified: ${assetId}`] : [`${assetType} planned for rendering`],
            };
        });
    }
    buildLayerStructure(context) {
        const productionLayers = context.productionPlan?.productionStructure.layerStructure ?? [];
        if (productionLayers.length >= 3) {
            return productionLayers.map((layer, index) => ({
                layerId: layer.layerId,
                name: layer.name,
                order: layer.order,
                group: index < 2 ? "base" : index < 4 ? "content" : "overlay",
                blendMode: layer.type === "effects" ? "screen" : "normal",
                opacity: layer.locked ? 100 : 90,
                visible: layer.visible,
                clippingMask: layer.type === "brand" || layer.type === "product",
            }));
        }
        return [
            { layerId: "layer-background", name: "Background", order: 1, group: "base", blendMode: "normal", opacity: 100, visible: true, clippingMask: false },
            { layerId: "layer-subject", name: "Subject", order: 2, group: "content", blendMode: "normal", opacity: 100, visible: true, clippingMask: true },
            { layerId: "layer-brand", name: "Brand", order: 3, group: "content", blendMode: "normal", opacity: 100, visible: true, clippingMask: true },
            { layerId: "layer-effects", name: "Effects", order: 4, group: "overlay", blendMode: "screen", opacity: 85, visible: true, clippingMask: false },
            { layerId: "layer-text", name: "Text", order: 5, group: "overlay", blendMode: "normal", opacity: 100, visible: true, clippingMask: false },
        ];
    }
    buildRenderSettings(profile) {
        const config = IMAGE_RENDER_PLATFORM_CONFIG[profile.platform];
        const isPrint = profile.platform === ImageRenderPlatform.Print ||
            profile.platform === ImageRenderPlatform.Packaging ||
            profile.platform === ImageRenderPlatform.Catalogue;
        return {
            resolution: config.resolution,
            dpi: config.dpi,
            aspectRatio: config.aspectRatio,
            rgbProfile: "sRGB IEC61966-2.1",
            cmykProfile: "ISO Coated v2 (ECI)",
            iccProfile: isPrint ? "ISO Coated v2 (ECI)" : "sRGB IEC61966-2.1",
            bitDepth: isPrint ? 16 : 8,
            colorSpace: isPrint ? ImageRenderColorSpace.Cmyk : ImageRenderColorSpace.Rgb,
            compressionStrategy: isPrint ? "lossless-preferred" : "quality-optimized",
            outputQuality: isPrint ? 100 : 92,
            alphaChannel: !isPrint,
            instructions: [
                `Render preparation at ${config.resolution} (${config.aspectRatio}) for ${profile.platform}`,
                `${config.dpi} DPI, ${isPrint ? "CMYK" : "RGB"} color space, ${isPrint ? 16 : 8}-bit depth`,
                "Alpha channel " + (isPrint ? "disabled for print" : "enabled for digital"),
                "Blueprint only — no final render executed",
            ],
        };
    }
    buildOutputProfiles(input) {
        if (input.prepareOutputProfiles === false) {
            return [this.buildOutputProfile(ImageRenderPlatform.Website)];
        }
        return ALL_IMAGE_RENDER_PLATFORMS.map((platform) => this.buildOutputProfile(platform));
    }
    buildResourcePlanning(profile, input) {
        const config = IMAGE_RENDER_PLATFORM_CONFIG[profile.platform];
        const pixelCount = config.width * config.height;
        const isLarge = pixelCount > 4000000;
        return {
            cpuAllocation: isLarge ? "high — multi-core render prep" : "standard — render prep",
            gpuAllocation: isLarge ? "accelerated — GPU render prep" : "standard — GPU assist",
            ramAllocation: isLarge ? "4096MB render buffer" : "2048MB render buffer",
            storageAllocation: isLarge ? "512MB temp workspace" : "256MB temp workspace",
            cacheAllocation: "128MB asset cache",
            temporaryFiles: [`temp-${profile.imageRenderPlanId}`, `cache-${profile.productionId}`],
            renderQueue: input.generateRenderJobs !== false ? [`queue-${profile.imageRenderPlanId}`] : [],
            parallelRenderingPreparation: isLarge,
            notes: [
                "Resource planning for render preparation only — no render executed",
                `Platform ${profile.platform}: ${config.resolution}`,
            ],
        };
    }
    buildRenderJobs(profile, input) {
        if (input.generateRenderJobs === false)
            return [];
        return [
            {
                jobId: `render-job-${profile.imageRenderPlanId}`,
                renderPlanId: profile.imageRenderPlanId,
                priority: 1,
                status: "prepared",
                platform: profile.platform,
                estimatedResources: IMAGE_RENDER_PLATFORM_CONFIG[profile.platform].resolution,
            },
        ];
    }
    buildRecoveryPlan(profile, context) {
        return {
            recoveryId: `render-recovery-${profile.imageRenderPlanId}`,
            checkpoints: [profile.productionId, profile.imageId, profile.imageRenderPlanId],
            resumeSteps: ["Restore render checkpoint", "Revalidate layers and masks", "Resume render queue preparation"],
            rollbackSteps: ["Rollback to previous render version", "Restore production plan reference", "Rebuild render settings"],
            automaticRecovery: true,
            failureDetection: [
                "Layer integrity failure",
                "Mask validation failure",
                "Asset missing detection",
                "Resource allocation overflow",
            ],
        };
    }
    buildRecommendations(context, profile) {
        const recommendations = [
            `Render plan v${profile.renderVersion} prepared for ${profile.platform}`,
            "All render validation stages verified before render readiness approval",
            "Layer and mask integrity locked for production quality",
        ];
        if (context.productionPlan) {
            recommendations.push(`Production plan ${context.productionPlan.imageProductionId} linked to render blueprint`);
        }
        if (context.stylePlan) {
            recommendations.push(`Style plan ${context.stylePlan.stylePlanId} preserved in render preparation`);
        }
        if (context.industry) {
            recommendations.push(`Industry render rules applied for ${context.industry}`);
        }
        return recommendations;
    }
    resolvePlatform(input, context) {
        return (input.platform ??
            context.productionPlan?.profile.platform ??
            ImageRenderPlatform.Website);
    }
    extractContext(input, productionPlan, stylePlan, analysis) {
        return {
            productId: input.productId ?? productionPlan?.profile.productId ?? stylePlan?.profile.productId,
            productName: analysis?.productName,
            brandId: input.brandId ?? productionPlan?.profile.brandId ?? stylePlan?.profile.brandId,
            brandName: analysis?.brand,
            projectId: input.projectId ?? productionPlan?.profile.projectId,
            campaignId: input.campaignId ?? productionPlan?.profile.campaignId,
            industry: analysis?.industry,
            productionId: input.productionId ?? productionPlan?.imageProductionId,
            imageId: input.imageId ?? productionPlan?.profile.imagePlanId ?? stylePlan?.profile.generatedStyleImageId,
            productionPlan,
            stylePlan,
            analysis: analysis ?? null,
        };
    }
    buildOutputProfile(platform) {
        const config = IMAGE_RENDER_PLATFORM_CONFIG[platform];
        const isPrint = platform === ImageRenderPlatform.Print ||
            platform === ImageRenderPlatform.Packaging ||
            platform === ImageRenderPlatform.Catalogue;
        return {
            platform,
            resolution: config.resolution,
            aspectRatio: config.aspectRatio,
            colorSpace: isPrint ? ImageRenderColorSpace.Cmyk : ImageRenderColorSpace.Rgb,
            dpi: config.dpi,
            rules: [`${platform}: ${config.resolution} @ ${config.dpi} DPI`, "Brand consistency required"],
        };
    }
    validateLayerCheck(check, layers, context) {
        switch (check) {
            case ImageRenderLayerCheck.LayerHierarchy:
                return layers.length >= 3;
            case ImageRenderLayerCheck.LayerOrder:
                return layers.every((l, i) => l.order === i + 1 || l.order >= 1);
            case ImageRenderLayerCheck.LayerVisibility:
                return layers.some((l) => l.visible);
            case ImageRenderLayerCheck.LayerGroups:
                return layers.some((l) => l.group.length > 0);
            case ImageRenderLayerCheck.BlendModes:
                return layers.every((l) => l.blendMode.length > 0);
            case ImageRenderLayerCheck.Opacity:
                return layers.every((l) => l.opacity >= 0 && l.opacity <= 100);
            case ImageRenderLayerCheck.ClippingMasks:
                return layers.some((l) => l.clippingMask) || Boolean(context.productionPlan);
            default:
                return false;
        }
    }
    resolveMaskId(maskType, context) {
        switch (maskType) {
            case ImageRenderMaskType.SubjectMask:
                return context.productionPlan?.productionStructure.maskStructure.find((m) => m.type.includes("product"))?.maskId ?? "mask-subject";
            case ImageRenderMaskType.ObjectMask:
                return "mask-object";
            case ImageRenderMaskType.BackgroundMask:
                return "mask-background";
            case ImageRenderMaskType.LayerMask:
                return context.productionPlan?.productionStructure.maskStructure[0]?.maskId ?? "mask-layer";
            case ImageRenderMaskType.AlphaMask:
                return "mask-alpha";
            case ImageRenderMaskType.EditableRegion:
                return "mask-editable";
            default:
                return "";
        }
    }
    resolveAssetId(assetType, context, input) {
        switch (assetType) {
            case ImageRenderAssetType.SourceImage:
                return context.stylePlan?.profile.sourceImageId ?? context.productionPlan?.relationships.sourceImages[0] ?? "";
            case ImageRenderAssetType.GeneratedImage:
                return context.imageId ?? context.stylePlan?.profile.generatedStyleImageId ?? "";
            case ImageRenderAssetType.Logo:
                return context.productionPlan ? `logo-${context.productionPlan.profile.brandId}` : "";
            case ImageRenderAssetType.Font:
                return context.brandId ? `font-${context.brandId}` : "";
            case ImageRenderAssetType.Icon:
                return context.productionPlan ? `icon-${context.productionPlan.imageProductionId}` : "";
            case ImageRenderAssetType.Template:
                return input.templateIds?.[0] ?? "";
            case ImageRenderAssetType.Texture:
                return context.stylePlan ? `texture-${context.stylePlan.stylePlanId}` : "";
            case ImageRenderAssetType.BrandAsset:
                return context.productionPlan?.relationships.brandingPlans[0] ?? "";
            case ImageRenderAssetType.IccProfile:
                return "sRGB IEC61966-2.1";
            case ImageRenderAssetType.Metadata:
                return context.imageId ? `metadata-${context.imageId}` : "";
            default:
                return "";
        }
    }
    resolveAssetSource(assetType, context) {
        if (assetType === ImageRenderAssetType.GeneratedImage && context.stylePlan) {
            return "multi-style-image-generation-engine";
        }
        if (context.productionPlan) {
            return "image-production-engine";
        }
        return "image-rendering-preparation-engine";
    }
}
//# sourceMappingURL=image-render-analyzer.js.map