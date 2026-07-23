import { ALL_PRODUCT_CONSISTENCY_RULES, ALL_PRODUCT_MARKETING_VARIATIONS, ALL_PRODUCT_PHOTOGRAPHY_MODES, ALL_PRODUCT_PRESENTATION_VIEWS, ALL_PRODUCT_IMAGE_GEN_PLATFORMS, PLATFORM_CONFIG, ProductImageBackgroundType, ProductImageGenPlatform, ProductMarketingVariation, ProductPhotographyMode, ProductPresentationView, } from "./types.js";
const CATEGORY_PHOTOGRAPHY_MAP = {
    software: ProductPhotographyMode.CommercialPhotography,
    technology: ProductPhotographyMode.CommercialPhotography,
    fashion: ProductPhotographyMode.LifestylePhotography,
    beauty: ProductPhotographyMode.LuxuryPhotography,
    default: ProductPhotographyMode.StudioPhotography,
};
const CATEGORY_BACKGROUND_MAP = {
    software: ProductImageBackgroundType.OfficeEnvironment,
    technology: ProductImageBackgroundType.StudioSetup,
    fashion: ProductImageBackgroundType.PremiumEnvironment,
    beauty: ProductImageBackgroundType.WhiteBackground,
    default: ProductImageBackgroundType.StudioSetup,
};
export class ProductImageGenerationAnalyzer {
    buildProfile(input, platform, version, context) {
        return {
            productImagePlanId: `product-image-plan-${context.productId}-${platform}-v${version}`,
            productId: context.productId,
            projectId: input.projectId ?? context.projectId ?? `project-${context.productId}`,
            brandId: input.brandId ?? context.brandId ?? context.brandName,
            campaignId: input.campaignId ?? context.campaignId ?? `campaign-${context.productId}`,
            platform,
            productCategory: input.productCategory ?? context.productCategory,
            version,
            language: input.language ?? "en",
        };
    }
    buildPresentationPlan(context) {
        const product = context.productName;
        const views = ALL_PRODUCT_PRESENTATION_VIEWS.map((view, index) => this.buildViewDefinition(view, product, context, index + 1));
        return {
            views,
            showcaseLayout: `Multi-view product showcase grid for ${product} — hero dominant with supporting angle views`,
            heroPlacement: `Hero image: ${product} centered with brand-consistent negative space for marketing copy`,
            catalogueStructure: [
                "Hero + front view primary spread",
                "Side views (left/right) secondary grid",
                "Detail close-up and lifestyle supporting panel",
                "360° planning reference strip",
            ],
        };
    }
    buildPhotographyPlan(input, context) {
        const primary = input.photographyMode ??
            CATEGORY_PHOTOGRAPHY_MAP[context.industry ?? "default"] ??
            ProductPhotographyMode.StudioPhotography;
        return {
            primaryMode: primary,
            modes: ALL_PRODUCT_PHOTOGRAPHY_MODES,
            studioSetup: `Three-point studio setup for ${context.productName} — key softbox 45°, fill 30%, hair light for edge separation`,
            commercialStyle: `Commercial product photography with clean ${context.productCategory} presentation and accurate color reproduction`,
            luxuryTreatment: context.industry === "beauty" || context.industry === "fashion"
                ? `Premium luxury lighting with controlled highlights and refined shadow falloff for ${context.brandName}`
                : `Elevated commercial treatment with premium finish for ${context.brandName}`,
            notes: [
                `Primary mode: ${primary}`,
                `Product category: ${context.productCategory}`,
                context.keyFeature ? `Highlight feature: ${context.keyFeature}` : "Standard product feature presentation",
            ],
        };
    }
    buildBackgroundPlan(input, context) {
        const bgType = input.backgroundType ??
            CATEGORY_BACKGROUND_MAP[context.industry ?? "default"] ??
            ProductImageBackgroundType.StudioSetup;
        const descriptions = {
            [ProductImageBackgroundType.WhiteBackground]: {
                primaryBackground: ProductImageBackgroundType.WhiteBackground,
                backgroundDescription: "Pure white (#FFFFFF) e-commerce background for marketplace compliance",
                environmentNotes: "Amazon/eBay compliant white backdrop with even illumination",
                replacementStrategy: "Seamless white sweep with shadow anchor beneath product",
                colorHarmony: "Neutral white supporting accurate product color for online shoppers",
            },
            [ProductImageBackgroundType.TransparentBackground]: {
                primaryBackground: ProductImageBackgroundType.TransparentBackground,
                backgroundDescription: "Alpha-transparent background for compositing and catalogue use",
                environmentNotes: "Clean alpha extraction with feathered edges",
                replacementStrategy: "Subject isolation with transparent PNG export preparation",
                colorHarmony: "No background interference — product colors preserved exactly",
            },
            [ProductImageBackgroundType.StudioSetup]: {
                primaryBackground: ProductImageBackgroundType.StudioSetup,
                backgroundDescription: "Professional studio gradient backdrop for commercial product photography",
                environmentNotes: "Controlled studio environment with neutral gradient",
                replacementStrategy: "Studio sweep with subtle gradient for dimensional depth",
                colorHarmony: `Studio tones complementing ${context.brandName} brand palette`,
            },
            [ProductImageBackgroundType.HomeEnvironment]: {
                primaryBackground: ProductImageBackgroundType.HomeEnvironment,
                backgroundDescription: "Authentic home lifestyle environment for consumer products",
                environmentNotes: "Warm residential setting with contextual props",
                replacementStrategy: "Natural home scene compositing with product as focal point",
                colorHarmony: "Warm domestic tones supporting lifestyle narrative",
            },
            [ProductImageBackgroundType.OfficeEnvironment]: {
                primaryBackground: ProductImageBackgroundType.OfficeEnvironment,
                backgroundDescription: "Modern office environment for B2B and software products",
                environmentNotes: "Clean professional workspace context",
                replacementStrategy: "Office desk or workspace scene with product integration",
                colorHarmony: "Corporate neutral tones aligned with professional branding",
            },
            [ProductImageBackgroundType.OutdoorEnvironment]: {
                primaryBackground: ProductImageBackgroundType.OutdoorEnvironment,
                backgroundDescription: "Natural outdoor setting for lifestyle and fashion products",
                environmentNotes: "Environmental context with natural daylight",
                replacementStrategy: "Outdoor scene with depth and environmental storytelling",
                colorHarmony: "Natural earth and sky tones for authentic presentation",
            },
            [ProductImageBackgroundType.PremiumEnvironment]: {
                primaryBackground: ProductImageBackgroundType.PremiumEnvironment,
                backgroundDescription: "Premium luxury environment for high-end product presentation",
                environmentNotes: "Elevated setting with refined materials and lighting",
                replacementStrategy: "Luxury scene with marble, velvet, or architectural elements",
                colorHarmony: `Premium palette aligned with ${context.brandName} luxury positioning`,
            },
        };
        return descriptions[bgType];
    }
    buildLightingPlan(context) {
        const product = context.productName;
        return {
            studioLighting: `Three-point studio lighting for ${product} — key softbox at 45°, fill at 30% intensity, hair light for separation`,
            naturalLighting: "Balanced natural daylight simulation (5500K) with soft ambient fill",
            softboxLighting: "Large diffused softbox key light for even product surface illumination without harsh hotspots",
            rimLighting: "Subtle rim light at 120° rear angle separating product from background",
            productHighlight: `Controlled specular highlights on ${product} primary surfaces to emphasize form and material quality`,
            reflectionControl: "Polarizing filter and angle adjustment to manage reflective surfaces and packaging glare",
            shadowPlanning: "Soft contact shadow beneath product for grounding — opacity 15-25% for e-commerce compliance",
        };
    }
    buildConsistencyPlan(context) {
        const product = context.productName;
        const brand = context.brandName;
        return {
            rules: [...ALL_PRODUCT_CONSISTENCY_RULES],
            shapeLock: true,
            colorLock: true,
            sizeReference: `Maintain exact ${product} proportions and dimensional accuracy across all views`,
            textureNotes: `Preserve material texture fidelity — ${context.analysis?.profile.materials.join(", ") ?? "product surface detail"}`,
            logoPlacement: `${brand} logo placement per brand guidelines — consistent position across hero and catalogue views`,
            packagingNotes: context.analysis?.profile.packaging
                ? `Packaging consistency: ${context.analysis.profile.packaging} — label and box art preserved exactly`
                : `Standard ${context.productCategory} packaging presentation with brand-consistent labeling`,
        };
    }
    buildMarketingVariations(profile, input) {
        const variations = input.generateMarketingVariations !== false ? ALL_PRODUCT_MARKETING_VARIATIONS : ALL_PRODUCT_MARKETING_VARIATIONS.slice(0, 4);
        const platformMap = {
            [ProductMarketingVariation.SocialMedia]: ProductImageGenPlatform.Instagram,
            [ProductMarketingVariation.Ecommerce]: ProductImageGenPlatform.Ecommerce,
            [ProductMarketingVariation.Website]: ProductImageGenPlatform.Website,
            [ProductMarketingVariation.Catalogue]: ProductImageGenPlatform.Print,
            [ProductMarketingVariation.Billboard]: ProductImageGenPlatform.Billboard,
            [ProductMarketingVariation.Print]: ProductImageGenPlatform.Print,
        };
        return variations.map((variation) => {
            const platform = platformMap[variation];
            const config = PLATFORM_CONFIG[platform];
            return {
                variation,
                platform,
                aspectRatio: config.aspectRatio,
                resolution: config.resolution,
                adaptationNotes: [
                    `${variation} version optimized for ${platform}`,
                    `Resolution: ${config.resolution} (${config.aspectRatio})`,
                    `Product consistency maintained across ${variation} adaptation`,
                ],
            };
        });
    }
    buildPlatformOptimizations(profile, input) {
        const platforms = input.generatePlatformOptimizations !== false
            ? ALL_PRODUCT_IMAGE_GEN_PLATFORMS
            : [profile.platform];
        return platforms.map((platform) => {
            const config = PLATFORM_CONFIG[platform];
            return {
                platform,
                aspectRatio: config.aspectRatio,
                resolution: config.resolution,
                marketplaceNotes: this.getMarketplaceNotes(platform),
                optimizationNotes: [
                    `Product image plan optimized for ${platform}`,
                    `E-commerce resolution: ${config.resolution}`,
                    "Product shape, color, and logo consistency verified per view",
                ],
            };
        });
    }
    buildProductionInstructions(profile, presentationPlan, photographyPlan, lightingPlan) {
        return {
            renderNotes: [
                `Execute ${profile.productCategory} product image plan for ${profile.platform}`,
                presentationPlan.heroPlacement,
                photographyPlan.studioSetup,
            ],
            photographyGuidance: [
                ...photographyPlan.notes,
                lightingPlan.productHighlight,
                lightingPlan.reflectionControl,
            ],
            exportPreparation: [
                `Target ${profile.platform} resolution per optimization profile`,
                "Non-destructive multi-view layer stack for catalogue updates",
                "Marketplace compliance verification before export",
            ],
            qualityTargets: [
                "All 10 presentation views planned and validated",
                "Product consistency score >= 55 across all views",
                "Brand logo placement verified on hero and front views",
            ],
        };
    }
    buildRecommendations(context, consistencyPlan) {
        const recs = [];
        recs.push(`Verify ${context.productName} color accuracy against brand swatches before marketplace export`);
        if (consistencyPlan.packagingNotes.includes("Standard")) {
            recs.push("Confirm packaging artwork reference before catalogue view generation");
        }
        recs.push("Review e-commerce white background compliance for marketplace listings");
        if (context.industry === "beauty" || context.industry === "fashion") {
            recs.push("Luxury lighting treatment recommended for premium channel variants");
        }
        return recs;
    }
    resolvePlatform(input, context) {
        if (input.platform)
            return input.platform;
        if (context.creative?.profile.platform === "instagram-reels")
            return ProductImageGenPlatform.Instagram;
        if (context.creative?.profile.platform === "tiktok")
            return ProductImageGenPlatform.TikTok;
        return ProductImageGenPlatform.Ecommerce;
    }
    extractContextFromProduct(analysis, understanding, creative, strategy, input) {
        if (!analysis && !understanding)
            return null;
        const productId = input.productId;
        return {
            productId,
            productName: analysis?.profile.productName ?? understanding?.identity.productName ?? productId,
            brandName: analysis?.profile.brand ?? understanding?.identity.brand ?? input.brandName ?? "Brand",
            brandId: input.brandId ?? analysis?.profile.brand ?? understanding?.identity.brand ?? "unknown-brand",
            brandGuidelines: input.brandGuidelines,
            projectId: input.projectId ?? creative?.profile.projectId,
            campaignId: input.campaignId ?? strategy?.relationships.campaigns[0],
            productCategory: input.productCategory ?? analysis?.profile.category ?? understanding?.identity.category ?? "general",
            industry: understanding?.customer.targetIndustry ?? analysis?.profile.category ?? "general",
            keyFeature: analysis?.profile.features[0] ?? understanding?.uniqueValue.uniqueSellingPoints[0],
            keyBenefit: understanding?.uniqueValue.keyBenefits[0],
            targetAudience: understanding?.customer.targetCustomer ?? creative?.profile.targetAudience,
            creative,
            strategy,
            understanding,
            analysis,
        };
    }
    buildViewDefinition(view, product, context, priority) {
        const viewConfig = {
            [ProductPresentationView.HeroImage]: {
                angle: "Three-quarter hero angle",
                framing: "Product dominant with marketing negative space",
                desc: `Hero shot of ${product} — primary marketplace and website image`,
            },
            [ProductPresentationView.FrontView]: {
                angle: "Straight-on frontal",
                framing: "Full product front face, centered",
                desc: `Front view of ${product} showing primary features and branding`,
            },
            [ProductPresentationView.BackView]: {
                angle: "Straight-on rear",
                framing: "Full product back face, centered",
                desc: `Back view of ${product} showing rear details and specifications`,
            },
            [ProductPresentationView.LeftView]: {
                angle: "Left profile 90°",
                framing: "Full side profile",
                desc: `Left side view of ${product} showing depth and side features`,
            },
            [ProductPresentationView.RightView]: {
                angle: "Right profile 90°",
                framing: "Full side profile",
                desc: `Right side view of ${product} showing alternate side details`,
            },
            [ProductPresentationView.TopView]: {
                angle: "Overhead bird's eye",
                framing: "Top-down flat lay or overhead",
                desc: `Top view of ${product} showing upper surface and layout`,
            },
            [ProductPresentationView.BottomView]: {
                angle: "Underside angle",
                framing: "Bottom surface detail",
                desc: `Bottom view of ${product} showing base, ports, or sole details`,
            },
            [ProductPresentationView.ThreeSixtyPlanning]: {
                angle: "360° rotation sequence",
                framing: "24-frame rotation planning strip",
                desc: `360° spin planning for ${product} — 24 frames at 15° intervals for interactive viewers`,
            },
            [ProductPresentationView.DetailCloseUp]: {
                angle: "Macro detail",
                framing: "Tight crop on key feature",
                desc: `Detail close-up of ${context.keyFeature ?? "primary product feature"} on ${product}`,
            },
            [ProductPresentationView.LifestylePresentation]: {
                angle: "Contextual lifestyle angle",
                framing: "Product in use environment",
                desc: `Lifestyle presentation of ${product} for ${context.targetAudience ?? "target audience"}`,
            },
        };
        const cfg = viewConfig[view];
        return {
            view,
            description: cfg.desc,
            cameraAngle: cfg.angle,
            framing: cfg.framing,
            priority,
        };
    }
    getMarketplaceNotes(platform) {
        const map = {
            [ProductImageGenPlatform.Ecommerce]: ["Pure white background recommended", "Minimum 1000x1000px", "Product fills 85% of frame"],
            [ProductImageGenPlatform.Instagram]: ["1:1 square format", "Bold product center framing"],
            [ProductImageGenPlatform.Website]: ["Hero banner 16:9", "Copy space on left third"],
            [ProductImageGenPlatform.Facebook]: ["1.91:1 feed format", "Minimal text in image"],
            [ProductImageGenPlatform.TikTok]: ["9:16 vertical", "Product in center 60%"],
            [ProductImageGenPlatform.LinkedIn]: ["Professional product presentation", "1.91:1 format"],
            [ProductImageGenPlatform.Print]: ["300 DPI minimum", "CMYK color profile preparation"],
            [ProductImageGenPlatform.Billboard]: ["High contrast at distance", "Simplified product silhouette"],
        };
        return map[platform];
    }
}
//# sourceMappingURL=product-image-generation-analyzer.js.map