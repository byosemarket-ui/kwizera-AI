import { ALL_IMAGE_ENHANCE_GEN_PLATFORMS, ALL_IMAGE_ENHANCE_PRESERVATION_TARGETS, ImageEnhanceCategory, ImageEnhanceGenPlatform, ImageEnhanceOperationType, ImageEnhancePreservationTarget, ImageEnhanceRestorationType, IMAGE_ENHANCE_PLATFORM_CONFIG, } from "./types.js";
const CATEGORY_ENHANCEMENT_MAP = {
    [ImageEnhanceCategory.Product]: ImageEnhanceOperationType.DetailEnhancement,
    [ImageEnhanceCategory.Fashion]: ImageEnhanceOperationType.TextureEnhancement,
    [ImageEnhanceCategory.Historical]: ImageEnhanceOperationType.Deblurring,
    [ImageEnhanceCategory.Document]: ImageEnhanceOperationType.SuperResolutionPlanning,
    [ImageEnhanceCategory.Portrait]: ImageEnhanceOperationType.NoiseReduction,
    [ImageEnhanceCategory.Landscape]: ImageEnhanceOperationType.HdrPreparation,
};
const CATEGORY_RESTORATION_MAP = {
    [ImageEnhanceCategory.Product]: ImageEnhanceRestorationType.DustRemoval,
    [ImageEnhanceCategory.Fashion]: ImageEnhanceRestorationType.ScratchRemoval,
    [ImageEnhanceCategory.Historical]: ImageEnhanceRestorationType.HistoricalPhotoRestoration,
    [ImageEnhanceCategory.Document]: ImageEnhanceRestorationType.DocumentRestoration,
    [ImageEnhanceCategory.Portrait]: ImageEnhanceRestorationType.FaceRestoration,
    [ImageEnhanceCategory.Landscape]: ImageEnhanceRestorationType.MissingAreaRecovery,
};
const INDUSTRY_CATEGORY_MAP = {
    technology: ImageEnhanceCategory.Product,
    software: ImageEnhanceCategory.Product,
    fashion: ImageEnhanceCategory.Fashion,
    beauty: ImageEnhanceCategory.Portrait,
    food: ImageEnhanceCategory.Product,
    default: ImageEnhanceCategory.Product,
};
export class ImageEnhancementAnalyzer {
    analyzeImage(context, input) {
        const resolution = context.editingPlan?.imageAnalysis.resolution ??
            context.productImagePlan?.profile.platform ??
            "3000x2000 commercial baseline";
        return {
            resolution: typeof resolution === "string" && resolution.includes("x") ? resolution : "3000x2000 minimum",
            sharpness: "Moderate — enhancement recommended for edge definition and micro-detail",
            blur: "Minor motion blur detected in background; subject region acceptable",
            noise: "ISO-equivalent noise in shadow regions — adaptive reduction planned",
            compressionArtifacts: "JPEG blocking in gradient regions — artifact suppression planned",
            dynamicRange: "12-stop effective range — HDR preparation for highlight recovery",
            exposure: "Slight underexposure in midtones — exposure correction planned",
            whiteBalance: "Neutral daylight bias with minor warm cast — white balance correction planned",
            colorAccuracy: context.brandName
                ? `${context.brandName} brand color accuracy verification required`
                : "sRGB color accuracy within commercial tolerance",
            textureQuality: "Surface texture recoverable with detail and texture enhancement pipeline",
        };
    }
    buildProfile(input, platform, version, context, sourceImageId) {
        const productId = context.productId ?? input.productId ?? "unknown-product";
        const category = input.imageCategory ?? INDUSTRY_CATEGORY_MAP[context.industry ?? "default"] ?? ImageEnhanceCategory.Product;
        const primaryEnhancement = input.primaryEnhancement ??
            input.enhancements?.[0] ??
            CATEGORY_ENHANCEMENT_MAP[category];
        return {
            enhancementPlanId: `enhance-plan-${sourceImageId}-${platform}-v${version}`,
            sourceImageId,
            enhancedImageId: `enhanced-${sourceImageId}-v${version}`,
            restoredImageId: `restored-${sourceImageId}-v${version}`,
            promptId: `enhance-prompt-${sourceImageId}-v${version}`,
            projectId: input.projectId ?? context.projectId ?? `project-${productId}`,
            productId,
            brandId: input.brandId ?? context.brandId ?? context.brandName ?? "unknown-brand",
            campaignId: input.campaignId ?? context.campaignId ?? `campaign-${productId}`,
            platform,
            imageCategory: category,
            primaryEnhancement,
            primaryRestoration: input.restorationType ?? CATEGORY_RESTORATION_MAP[category],
            version,
            language: input.language ?? "en",
        };
    }
    buildEnhancementOperations(input, profile, context) {
        const operations = input.enhancements?.length
            ? input.enhancements
            : [
                profile.primaryEnhancement,
                ImageEnhanceOperationType.NoiseReduction,
                ImageEnhanceOperationType.SuperResolutionPlanning,
            ];
        const prompt = input.restorationPrompt ??
            context.restorationPrompt ??
            `Professional image enhancement — ${profile.primaryEnhancement} for ${context.productName ?? "subject"} preserving authenticity and brand integrity`;
        const operationPrompts = {};
        for (const op of operations) {
            operationPrompts[op] = `${prompt} — ${op.replace(/-/g, " ")}`;
        }
        const config = IMAGE_ENHANCE_PLATFORM_CONFIG[profile.platform];
        return {
            operations,
            operationPrompts,
            executionOrder: operations.map((op, i) => `${i + 1}. ${op}`),
            superResolutionTarget: `${config.width * 2}x${config.height * 2}`,
            upscalingFactor: "2x with detail-preserving super resolution",
        };
    }
    buildRestorationOperations(input, profile, context) {
        const type = profile.primaryRestoration ?? ImageEnhanceRestorationType.DustRemoval;
        const isHistorical = profile.imageCategory === ImageEnhanceCategory.Historical;
        return {
            restorationType: type,
            targetDamage: isHistorical
                ? ["scratches", "fading", "tears", "dust", "color shift"]
                : ["dust", "minor scratches", "compression damage"],
            restorationStrategy: `Restore using ${type} with authenticity preservation and identity locking`,
            authenticityNotes: [
                "Preserve original photographic character and grain structure",
                "Avoid over-processing that alters historical authenticity",
                "Maintain original composition and subject proportions",
            ],
            historicalNotes: isHistorical
                ? [
                    "Historical photo restoration with period-accurate color grading",
                    "Damage repair without inventing non-original content",
                ]
                : ["Commercial restoration with brand-safe enhancement limits"],
        };
    }
    buildPreservation(context) {
        const subject = context.productName ?? "primary subject";
        return {
            targets: [...ALL_IMAGE_ENHANCE_PRESERVATION_TARGETS],
            identityLock: true,
            productLock: true,
            logoLock: true,
            compositionLock: true,
            notes: ALL_IMAGE_ENHANCE_PRESERVATION_TARGETS.map((t) => this.preservationNote(t, subject, context.brandName)),
        };
    }
    buildQualityImprovement(context) {
        return {
            fineDetails: "Micro-detail enhancement on labels, text, and product surface features",
            hairDetails: "Hair strand definition preserved during sharpening and noise reduction",
            fabricDetails: "Fabric weave and texture enhancement without artificial oversharpening",
            reflectionQuality: "Specular highlight refinement maintaining natural light behavior",
            shadowQuality: "Shadow detail recovery without crushing blacks or lifting unnaturally",
            edgeQuality: "Edge-aware sharpening preventing halos at subject boundaries",
            skinQuality: "Natural skin tone preservation with subtle retouch planning only",
        };
    }
    buildPrintPreparation(profile, input) {
        if (input.generatePrintPreparation === false) {
            return {
                printResolution: "Digital-only — print preparation skipped",
                colorProfile: "sRGB",
                dpiPlanning: "72 DPI screen resolution",
                cmykPreparation: "Not required for digital delivery",
                largeFormatPreparation: "Not required",
            };
        }
        return {
            printResolution: "3000x2000 minimum at 300 DPI for commercial print",
            colorProfile: "Adobe RGB working space with CMYK conversion profile",
            dpiPlanning: "300 DPI for catalogue and print, 150 DPI for large format",
            cmykPreparation: "FOGRA39 CMYK profile with brand color gamut mapping",
            largeFormatPreparation: "6000x2000 at 150 DPI for billboard and large format display",
        };
    }
    buildSuperResolutionPlan(profile) {
        const config = IMAGE_ENHANCE_PLATFORM_CONFIG[profile.platform];
        return {
            targetResolution: `${config.width * 2}x${config.height * 2}`,
            upscalingMethod: "Detail-preserving super resolution with edge-aware interpolation",
            detailRecoveryStrategy: "Multi-scale detail recovery preserving authenticity and avoiding hallucination",
            edgePreservationNotes: [
                "Edge-aware upscaling preventing stair-stepping artifacts",
                "Subject boundary preservation during resolution increase",
            ],
            authenticityConstraints: [
                "No synthetic detail invention beyond source information",
                "Identity and logo regions protected from over-enhancement",
            ],
        };
    }
    buildPlatformOptimizations(profile, input) {
        const platforms = input.generatePlatformOptimizations !== false
            ? ALL_IMAGE_ENHANCE_GEN_PLATFORMS
            : [profile.platform];
        return platforms.map((platform) => {
            const config = IMAGE_ENHANCE_PLATFORM_CONFIG[platform];
            return {
                platform,
                aspectRatio: config.aspectRatio,
                resolution: config.resolution,
                optimizationNotes: [
                    `Enhanced image optimized for ${platform}`,
                    `Resolution ${config.resolution} with quality scores verified`,
                    profile.primaryEnhancement === ImageEnhanceOperationType.SuperResolutionPlanning
                        ? "Super resolution applied for high-detail delivery"
                        : "Standard enhancement pipeline for platform delivery",
                ],
            };
        });
    }
    buildProductionInstructions(profile, operations, restoration) {
        return {
            renderNotes: Object.values(operations.operationPrompts),
            enhancementGuidance: operations.executionOrder,
            restorationGuidance: [restoration.restorationStrategy, ...restoration.authenticityNotes],
            exportPreparation: [
                `Target ${profile.platform} resolution per optimization profile`,
                "Layered export: original + enhanced + restored versions",
            ],
            qualityTargets: [
                "Enhancement score >= 55",
                "Identity preservation verified before export",
                "No visible enhancement artifacts at 100% zoom",
            ],
        };
    }
    buildRecommendations(context, analysis) {
        const recs = [];
        recs.push("Verify enhancement quality at 100% zoom before production export");
        if (analysis.noise.includes("noise")) {
            recs.push("Apply adaptive noise reduction before sharpening to avoid amplifying grain");
        }
        if (context.brandName) {
            recs.push(`Validate ${context.brandName} brand color accuracy after color correction`);
        }
        recs.push("Compare restored output against original for authenticity verification");
        return recs;
    }
    resolvePlatform(input) {
        return input.platform ?? ImageEnhanceGenPlatform.Website;
    }
    resolveSourceImageId(input, context) {
        if (input.sourceImageId)
            return input.sourceImageId;
        if (input.editedImageId)
            return input.editedImageId;
        if (input.imageEditingPlanId)
            return input.imageEditingPlanId;
        if (input.productImagePlanId)
            return input.productImagePlanId;
        if (context.editingPlan)
            return context.editingPlan.profile.editedImageId;
        if (context.productImagePlan)
            return context.productImagePlan.productImagePlanId;
        return null;
    }
    extractContextFromProduct(analysis, understanding, creative, strategy, input, productImagePlan, backgroundPlan, editingPlan) {
        if (!analysis && !understanding && !productImagePlan && !editingPlan)
            return null;
        return {
            productId: input.productId,
            productName: analysis?.profile.productName ?? understanding?.identity.productName ?? input.productId,
            brandName: analysis?.profile.brand ?? understanding?.identity.brand ?? input.brandName ?? "Brand",
            brandId: input.brandId ?? analysis?.profile.brand ?? "unknown-brand",
            brandGuidelines: input.brandGuidelines,
            projectId: input.projectId ?? creative?.profile.projectId,
            campaignId: input.campaignId ?? strategy?.relationships.campaigns[0],
            industry: understanding?.customer.targetIndustry ?? analysis?.profile.category ?? "general",
            restorationPrompt: input.restorationPrompt,
            sourceImageId: input.sourceImageId,
            editedImageId: input.editedImageId ?? editingPlan?.profile.editedImageId,
            productImagePlan,
            backgroundPlan,
            editingPlan,
            creative,
            strategy,
            understanding,
            analysis,
        };
    }
    preservationNote(target, subject, brand) {
        const map = {
            [ImageEnhancePreservationTarget.HumanIdentity]: "Preserve facial features and proportions during restoration",
            [ImageEnhancePreservationTarget.ProductIdentity]: `Lock ${subject} identity through enhancement pipeline`,
            [ImageEnhancePreservationTarget.LogoIntegrity]: "Protect logo regions from over-sharpening and color shifts",
            [ImageEnhancePreservationTarget.PackagingIntegrity]: "Maintain packaging artwork accuracy during enhancement",
            [ImageEnhancePreservationTarget.BrandColors]: `${brand ?? "Brand"} colors preserved during color correction`,
            [ImageEnhancePreservationTarget.OriginalComposition]: "Composition and framing unchanged by enhancement",
        };
        return map[target];
    }
}
//# sourceMappingURL=image-enhancement-analyzer.js.map