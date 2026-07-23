import { ALL_BACKGROUND_GEN_PLATFORMS, ALL_SUBJECT_PRESERVATION_TARGETS, BackgroundGenPlatform, BackgroundGenType, BackgroundMarketingPreset, BackgroundReplacementVariationType, PLATFORM_CONFIG, SubjectPreservationTarget, } from "./types.js";
const PRESET_BACKGROUND_MAP = {
    [BackgroundMarketingPreset.Ecommerce]: BackgroundGenType.WhiteBackground,
    [BackgroundMarketingPreset.LuxuryProducts]: BackgroundGenType.LuxuryInterior,
    [BackgroundMarketingPreset.Fashion]: BackgroundGenType.StudioBackground,
    [BackgroundMarketingPreset.Food]: BackgroundGenType.Restaurant,
    [BackgroundMarketingPreset.Electronics]: BackgroundGenType.OfficeBackground,
    [BackgroundMarketingPreset.RealEstate]: BackgroundGenType.HomeBackground,
    [BackgroundMarketingPreset.Automotive]: BackgroundGenType.City,
    [BackgroundMarketingPreset.Healthcare]: BackgroundGenType.WhiteBackground,
    [BackgroundMarketingPreset.Education]: BackgroundGenType.OfficeBackground,
};
const INDUSTRY_PRESET_MAP = {
    technology: BackgroundMarketingPreset.Electronics,
    software: BackgroundMarketingPreset.Electronics,
    fashion: BackgroundMarketingPreset.Fashion,
    beauty: BackgroundMarketingPreset.LuxuryProducts,
    food: BackgroundMarketingPreset.Food,
    default: BackgroundMarketingPreset.Ecommerce,
};
export class BackgroundGenerationAnalyzer {
    analyzeBackground(context, input) {
        const preset = input.marketingPreset ?? INDUSTRY_PRESET_MAP[context.industry ?? "default"] ?? BackgroundMarketingPreset.Ecommerce;
        const bgFromProduct = context.productImagePlan?.backgroundPlan.primaryBackground ?? "studio";
        return {
            backgroundType: input.targetBackground ?? PRESET_BACKGROUND_MAP[preset],
            sceneEnvironment: this.describeEnvironment(input.targetBackground ?? PRESET_BACKGROUND_MAP[preset]),
            perspective: "Eye-level with natural vanishing point aligned to subject placement",
            lightingDirection: context.productImagePlan?.lightingPlan.studioLighting?.slice(0, 60) ?? "Key light from upper-left at 45°",
            colorPalette: context.productImagePlan?.backgroundPlan.colorHarmony
                ? [context.productImagePlan.backgroundPlan.colorHarmony.slice(0, 30)]
                : ["#FFFFFF", "#F5F5F5", "#333333"],
            shadowDirection: "Shadow cast lower-right matching key light direction",
            reflectionAreas: ["Product base contact shadow", "Reflective packaging surfaces if present"],
            depthInformation: "Subject in foreground plane, environment recedes with atmospheric perspective",
            horizonLine: bgFromProduct.includes("outdoor") || preset === BackgroundMarketingPreset.Automotive
                ? "Horizon at lower third for landscape depth"
                : "No visible horizon — studio or interior environment",
        };
    }
    buildProfile(input, platform, version, context, sourceImageId) {
        const productId = context.productId ?? input.productId ?? "unknown-product";
        const preset = input.marketingPreset ?? INDUSTRY_PRESET_MAP[context.industry ?? "default"] ?? BackgroundMarketingPreset.Ecommerce;
        return {
            backgroundPlanId: `bg-plan-${sourceImageId}-${platform}-v${version}`,
            sourceImageId,
            generatedBackgroundId: `gen-bg-${sourceImageId}-v${version}`,
            promptId: `bg-prompt-${sourceImageId}-v${version}`,
            projectId: input.projectId ?? context.projectId ?? `project-${productId}`,
            productId,
            brandId: input.brandId ?? context.brandId ?? context.brandName ?? "unknown-brand",
            campaignId: input.campaignId ?? context.campaignId ?? `campaign-${productId}`,
            platform,
            targetBackground: input.targetBackground ?? PRESET_BACKGROUND_MAP[preset],
            marketingPreset: preset,
            version,
            language: input.language ?? "en",
        };
    }
    buildSubjectPreservation(context) {
        const subject = context.productName ?? "primary subject";
        return {
            targets: [...ALL_SUBJECT_PRESERVATION_TARGETS],
            protectedRegions: [subject, "logo region", "packaging edges", "transparent glass areas"],
            identityLock: true,
            productLock: true,
            logoLock: true,
            transparentPreservation: true,
            notes: ALL_SUBJECT_PRESERVATION_TARGETS.map((t) => this.preservationNote(t, subject)),
        };
    }
    buildGenerationPlan(input, profile, context) {
        const prompt = input.backgroundPrompt ??
            context.backgroundPrompt ??
            `Generate ${profile.targetBackground} for ${context.productName ?? "subject"} with realistic lighting and brand alignment`;
        return {
            targetBackground: profile.targetBackground,
            generationPrompt: prompt,
            environmentDescription: this.describeEnvironment(profile.targetBackground),
            replacementStrategy: `Replace existing background while preserving foreground subject via protected mask`,
            realismNotes: [
                "Match lighting direction to original subject illumination",
                "Maintain consistent shadow direction and intensity",
                "Preserve edge quality on hair and fine details",
                `Brand-aligned environment for ${context.brandName ?? "brand"}`,
            ],
        };
    }
    buildReplacementPlan(profile, input) {
        const base = profile.backgroundPlanId;
        const variations = input.generateReplacements !== false
            ? [
                {
                    variationId: `${base}-bg-var`,
                    variationType: BackgroundReplacementVariationType.BackgroundVariation,
                    label: "Background Variation",
                    backgroundType: profile.targetBackground,
                    description: `Primary ${profile.targetBackground} replacement`,
                },
                {
                    variationId: `${base}-brand-var`,
                    variationType: BackgroundReplacementVariationType.BrandVariation,
                    label: "Brand Variation",
                    backgroundType: BackgroundGenType.StudioBackground,
                    description: "Brand-aligned studio environment variant",
                },
                {
                    variationId: `${base}-seasonal-var`,
                    variationType: BackgroundReplacementVariationType.SeasonalVariation,
                    label: "Seasonal Variation",
                    backgroundType: BackgroundGenType.Nature,
                    description: "Seasonal environment adaptation",
                },
                {
                    variationId: `${base}-campaign-var`,
                    variationType: BackgroundReplacementVariationType.CampaignVariation,
                    label: "Campaign Variation",
                    backgroundType: profile.targetBackground,
                    description: `Campaign ${profile.campaignId} background treatment`,
                },
                {
                    variationId: `${base}-platform-var`,
                    variationType: BackgroundReplacementVariationType.PlatformVariation,
                    label: "Platform Variation",
                    backgroundType: profile.targetBackground,
                    description: `Optimized for ${profile.platform}`,
                },
            ]
            : [];
        return {
            variations,
            brandAdaptations: [`${profile.brandId} brand color integration in environment tones`],
            seasonalAdaptations: ["Spring: lighter palette", "Winter: cooler ambient tones"],
            campaignAdaptations: [`Campaign ${profile.campaignId} visual theme applied to background layer`],
        };
    }
    buildLightingMatching(analysis, context) {
        return {
            lightDirection: analysis.lightingDirection,
            lightIntensity: "Key light 100%, fill 40%, ambient 25% — matched to subject exposure",
            colorTemperature: profileColorTemp(context.industry),
            shadowConsistency: `${analysis.shadowDirection} — shadow opacity matched to new background surface`,
            reflectionMatching: "Specular highlights on product surfaces aligned with new environment light sources",
            ambientLight: "Environmental bounce light filling shadow regions for natural integration",
        };
    }
    buildDepthPlanning(analysis) {
        return {
            foreground: "Subject and immediate contact shadows — sharp focus, no background blur",
            midground: "Contextual props and transitional elements — slight softening",
            background: `${analysis.sceneEnvironment} — progressive blur for depth separation`,
            blurPlanning: "Gaussian blur ramp: 0px foreground, 8px midground, 24px background",
            depthOfField: "Simulated f/8 equivalent — subject sharp, environment progressively soft",
            focusSeparation: "Focus plane locked on subject; background defocus for visual hierarchy",
        };
    }
    buildQualityImprovement(context) {
        return {
            edgeQuality: "Feathered mask edges at 2px for natural subject-background transition",
            hairDetails: "Fine hair strand preservation with alpha matting refinement",
            transparentObjects: "Alpha channel preserved for glass, liquid, and packaging transparency",
            fineDetails: "Micro-detail retention on product texture and label typography",
            objectSeparation: `Clean separation of ${context.productName ?? "subject"} from replaced background`,
            backgroundCleanliness: "Noise-free background with even tonal distribution and no compression artifacts",
        };
    }
    buildPlatformOptimizations(profile, input) {
        const platforms = input.generatePlatformOptimizations !== false
            ? ALL_BACKGROUND_GEN_PLATFORMS
            : [profile.platform];
        return platforms.map((platform) => {
            const config = PLATFORM_CONFIG[platform];
            return {
                platform,
                aspectRatio: config.aspectRatio,
                resolution: config.resolution,
                presetNotes: this.getPresetNotes(profile.marketingPreset, platform),
                optimizationNotes: [
                    `Background optimized for ${platform}`,
                    `Resolution ${config.resolution} with subject preservation verified`,
                    profile.targetBackground === BackgroundGenType.WhiteBackground
                        ? "Pure white compliance for marketplace listings"
                        : "Environment-appropriate background treatment",
                ],
            };
        });
    }
    buildProductionInstructions(profile, generationPlan, lightingMatching) {
        return {
            renderNotes: [generationPlan.generationPrompt, generationPlan.replacementStrategy],
            maskGuidance: ["Foreground subject mask — protected, non-editable", "Background mask — fully replaceable"],
            lightingGuidance: [lightingMatching.lightDirection, lightingMatching.shadowConsistency],
            exportPreparation: [
                `Target ${profile.platform} resolution per optimization profile`,
                "Layered export: subject + background + shadow separately",
            ],
            qualityTargets: [
                "Subject preservation score >= 55",
                "No halo artifacts at subject edges",
                "Lighting direction consistent across replacement",
            ],
        };
    }
    buildRecommendations(context, analysis) {
        const recs = [];
        recs.push("Verify mask edge quality before final background replacement export");
        if (analysis.reflectionAreas.length > 1) {
            recs.push("Review reflection matching on reflective product surfaces");
        }
        if (context.brandName) {
            recs.push(`Ensure ${context.brandName} brand environment tones align with guidelines`);
        }
        recs.push("Validate Amazon-style white background compliance if targeting e-commerce");
        return recs;
    }
    resolvePlatform(input) {
        return input.platform ?? BackgroundGenPlatform.Website;
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
    extractContextFromProduct(analysis, understanding, creative, strategy, input, productImagePlan) {
        if (!analysis && !understanding && !productImagePlan)
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
            backgroundPrompt: input.backgroundPrompt,
            sourceImageId: input.sourceImageId,
            productImagePlan,
            creative,
            strategy,
            understanding,
            analysis,
        };
    }
    describeEnvironment(type) {
        const map = {
            [BackgroundGenType.WhiteBackground]: "Pure white seamless studio environment",
            [BackgroundGenType.TransparentBackground]: "Alpha-transparent compositing environment",
            [BackgroundGenType.StudioBackground]: "Professional photography studio with gradient backdrop",
            [BackgroundGenType.OfficeBackground]: "Modern corporate office interior",
            [BackgroundGenType.HomeBackground]: "Warm residential living space",
            [BackgroundGenType.RetailStore]: "Clean retail store display environment",
            [BackgroundGenType.Restaurant]: "Upscale restaurant or culinary setting",
            [BackgroundGenType.Nature]: "Natural outdoor landscape with organic elements",
            [BackgroundGenType.City]: "Urban cityscape with architectural depth",
            [BackgroundGenType.LuxuryInterior]: "Premium luxury interior with refined materials",
            [BackgroundGenType.AbstractBackground]: "Abstract gradient or geometric pattern backdrop",
            [BackgroundGenType.CustomPromptBackground]: "Custom environment per user prompt specification",
        };
        return map[type];
    }
    preservationNote(target, subject) {
        const map = {
            [SubjectPreservationTarget.HumanIdentity]: "Preserve facial features and body proportions if human subject present",
            [SubjectPreservationTarget.ProductIdentity]: `Lock ${subject} shape, form, and identifying features`,
            [SubjectPreservationTarget.Logo]: "Protect all logo and brand mark regions from background bleed",
            [SubjectPreservationTarget.Packaging]: "Maintain packaging artwork, labels, and box geometry exactly",
            [SubjectPreservationTarget.Shape]: "Preserve exact product silhouette during background replacement",
            [SubjectPreservationTarget.Texture]: "Retain surface texture detail through replacement pipeline",
            [SubjectPreservationTarget.Colors]: "Product colors unchanged by background color grading",
            [SubjectPreservationTarget.TransparentAreas]: "Alpha channel preserved for glass and liquid transparency",
        };
        return map[target];
    }
    getPresetNotes(preset, platform) {
        return [`${preset} preset applied`, `${platform} format requirements enforced`];
    }
}
function profileColorTemp(industry) {
    if (industry === "beauty" || industry === "fashion")
        return "5200K warm daylight with subtle golden bias";
    if (industry === "technology")
        return "5500K neutral daylight";
    return "5500K balanced daylight for commercial accuracy";
}
//# sourceMappingURL=background-generation-analyzer.js.map