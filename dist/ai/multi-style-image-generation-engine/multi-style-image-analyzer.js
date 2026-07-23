import { ALL_MULTI_STYLE_GEN_PLATFORMS, ALL_MULTI_STYLE_IDENTITY_TARGETS, ALL_MULTI_STYLE_VARIATION_TYPES, INDUSTRY_STYLE_MAP, MULTI_STYLE_PLATFORM_CONFIG, MultiStyleGenPlatform, MultiStyleIdentityTarget, MultiStyleImageCategory, VARIATION_STYLE_MAP, } from "./types.js";
export class MultiStyleImageAnalyzer {
    buildProfile(input, platform, version, context, sourceImageId) {
        const productId = context.productId ?? input.productId ?? "unknown-product";
        const brandId = input.brandId ?? context.brandId ?? context.brandName ?? "unknown-brand";
        const styleCategory = input.styleCategory ?? INDUSTRY_STYLE_MAP[context.industry ?? "default"] ?? MultiStyleImageCategory.Commercial;
        return {
            stylePlanId: `style-plan-${sourceImageId}-${platform}-v${version}`,
            projectId: input.projectId ?? context.projectId ?? `project-${productId}`,
            productId,
            brandId,
            campaignId: input.campaignId ?? context.campaignId ?? `campaign-${productId}`,
            platform,
            styleCategory,
            promptId: `style-prompt-${sourceImageId}-v${version}`,
            sourceImageId,
            generatedStyleImageId: `gen-style-${sourceImageId}-v${version}`,
            version,
            language: input.language ?? "en",
        };
    }
    buildStyleTransformation(input, profile, context) {
        const style = profile.styleCategory;
        const prompt = input.prompt ??
            context.prompt ??
            `Multi-style image generation in ${style} preserving ${context.productName ?? "subject"} identity and brand`;
        return {
            styleMapping: `Map source content to ${style} aesthetic while preserving subject structure — ${prompt.slice(0, 60)}`,
            texturePlanning: `Adapt surface textures to ${style} rendering characteristics without losing product detail`,
            colorAdaptation: context.brandName
                ? `${context.brandName} brand palette harmonized with ${style} color treatment`
                : `Color palette adapted to ${style} conventions with brand-safe tones`,
            lightingAdaptation: `Lighting remapped for ${style} — key/fill/ambient matched to style conventions`,
            compositionAdaptation: "Composition preserved with style-appropriate framing and negative space",
            detailAdaptation: "Fine details retained at identity-critical regions during style transfer",
            materialAdaptation: `Material properties translated to ${style} surface representation`,
        };
    }
    buildStyleVariations(profile, input) {
        const base = profile.stylePlanId;
        const variations = input.generateVariations !== false
            ? ALL_MULTI_STYLE_VARIATION_TYPES.map((variationType) => ({
                variationId: `${base}-${variationType}`,
                variationType,
                styleCategory: VARIATION_STYLE_MAP[variationType],
                label: variationType.replace(/-/g, " "),
                description: `${VARIATION_STYLE_MAP[variationType]} variation for ${profile.platform}`,
            }))
            : [];
        return { variations };
    }
    buildIdentityPreservation(context) {
        const subject = context.productName ?? "primary subject";
        return {
            targets: [...ALL_MULTI_STYLE_IDENTITY_TARGETS],
            identityLock: true,
            productLock: true,
            logoLock: true,
            brandColorLock: true,
            notes: ALL_MULTI_STYLE_IDENTITY_TARGETS.map((t) => this.preservationNote(t, subject, context.brandName)),
        };
    }
    buildPlatformOptimizations(profile, input) {
        const platforms = input.generatePlatformOptimizations !== false
            ? ALL_MULTI_STYLE_GEN_PLATFORMS
            : [profile.platform];
        return platforms.map((platform) => {
            const config = MULTI_STYLE_PLATFORM_CONFIG[platform];
            return {
                platform,
                aspectRatio: config.aspectRatio,
                resolution: config.resolution,
                styleNotes: [
                    `${profile.styleCategory} style optimized for ${platform}`,
                    `Resolution ${config.resolution} with identity preservation verified`,
                ],
            };
        });
    }
    buildProductionInstructions(profile, transformation, preservation) {
        return {
            renderNotes: [transformation.styleMapping, transformation.colorAdaptation],
            styleGuidance: [
                transformation.texturePlanning,
                transformation.lightingAdaptation,
                transformation.materialAdaptation,
            ],
            preservationGuidance: preservation.notes.slice(0, 3),
            exportPreparation: [
                `Target ${profile.platform} resolution per style optimization profile`,
                "Layered export: source + style layers + preservation masks",
            ],
            qualityTargets: [
                "Style quality score >= 55",
                "Identity preservation verified before export",
                "Brand consistency maintained across style transfer",
            ],
        };
    }
    buildRecommendations(context, profile) {
        const recs = [];
        recs.push(`Verify ${profile.styleCategory} style accuracy against reference before production export`);
        if (context.brandGuidelines) {
            recs.push("Cross-reference style output against brand guidelines for color and identity");
        }
        recs.push("Compare all style variations for identity preservation consistency");
        recs.push("Validate platform-specific style optimization at target resolution");
        return recs;
    }
    resolvePlatform(input) {
        return input.platform ?? MultiStyleGenPlatform.Website;
    }
    resolveSourceImageId(input, context) {
        if (input.sourceImageId)
            return input.sourceImageId;
        if (input.productImageId)
            return input.productImageId;
        if (input.productImagePlanId)
            return input.productImagePlanId;
        if (context.productImagePlan)
            return context.productImagePlan.productImagePlanId;
        return null;
    }
    extractContextFromProduct(analysis, understanding, creative, strategy, input, productImagePlan, brandingPlan) {
        if (!analysis && !understanding && !productImagePlan && !input.brandGuidelines)
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
            prompt: input.prompt,
            sourceImageId: input.sourceImageId,
            productImagePlan,
            brandingPlan,
            creative,
            strategy,
            understanding,
            analysis,
        };
    }
    preservationNote(target, subject, brand) {
        const map = {
            [MultiStyleIdentityTarget.HumanIdentity]: "Preserve facial features and proportions across all style transfers",
            [MultiStyleIdentityTarget.ProductIdentity]: `Lock ${subject} shape and identifying features during style mapping`,
            [MultiStyleIdentityTarget.LogoIntegrity]: "Protect logo regions from style distortion or color shift",
            [MultiStyleIdentityTarget.PackagingIntegrity]: "Maintain packaging artwork accuracy through style adaptation",
            [MultiStyleIdentityTarget.BrandColors]: `${brand ?? "Brand"} colors preserved during color adaptation`,
            [MultiStyleIdentityTarget.Typography]: "Brand typography unchanged by stylization effects",
            [MultiStyleIdentityTarget.VisualIdentity]: "Overall visual identity consistent across style variations",
        };
        return map[target];
    }
}
//# sourceMappingURL=multi-style-image-analyzer.js.map