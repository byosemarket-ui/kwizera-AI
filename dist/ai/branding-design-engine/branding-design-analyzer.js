import { ALL_BRAND_DESIGN_CONSISTENCY_ELEMENTS, ALL_BRAND_DESIGN_GEN_PLATFORMS, ALL_BRAND_DESIGN_LOGO_VARIANTS, ALL_BRAND_DESIGN_MATERIALS, ALL_BRAND_DESIGN_PRINT_FORMATS, ALL_BRAND_DESIGN_SOCIAL_FORMATS, BRAND_DESIGN_PLATFORM_CONFIG, BrandDesignGenPlatform, BrandDesignMaterialType, BrandDesignPrintFormat, BrandDesignSocialFormat, BrandDesignType, PRINT_FORMAT_CONFIG, SOCIAL_FORMAT_CONFIG, } from "./types.js";
const INDUSTRY_DESIGN_MAP = {
    technology: BrandDesignType.PresentationGraphic,
    software: BrandDesignType.PresentationGraphic,
    fashion: BrandDesignType.SocialMediaGraphic,
    food: BrandDesignType.PackagingLayout,
    default: BrandDesignType.PosterLayout,
};
export class BrandingDesignAnalyzer {
    buildProfile(input, platform, version, context) {
        const productId = context.productId ?? input.productId ?? "unknown-product";
        const brandId = input.brandId ?? context.brandId ?? context.brandName ?? "unknown-brand";
        const designType = input.designType ?? INDUSTRY_DESIGN_MAP[context.industry ?? "default"] ?? BrandDesignType.BrandingPlan;
        return {
            brandDesignId: `brand-design-${brandId}-${productId}-${platform}-v${version}`,
            projectId: input.projectId ?? context.projectId ?? `project-${productId}`,
            brandId,
            campaignId: input.campaignId ?? context.campaignId ?? `campaign-${productId}`,
            productId,
            platform,
            designType,
            promptId: `brand-prompt-${brandId}-v${version}`,
            version,
            language: input.language ?? "en",
        };
    }
    buildDesignPlanning(input, profile, context) {
        const brand = context.brandName ?? profile.brandId;
        const prompt = input.designPrompt ??
            context.designPrompt ??
            `Professional ${profile.designType} for ${brand} with complete brand consistency`;
        return {
            layoutStructure: `Branding-focused ${profile.designType} layout with header, hero, content, and footer zones`,
            visualHierarchy: `Primary: ${context.productName ?? "brand mark"} → Secondary: headline → Tertiary: supporting copy`,
            gridSystem: "12-column responsive grid with 8px baseline rhythm",
            composition: "Rule-of-thirds focal placement with balanced visual weight",
            alignment: "Left-aligned typography with centered hero elements for marketing impact",
            whiteSpacePlanning: "Generous margins (minimum 24px) with breathing room around brand elements",
            typographyPlanning: [
                `Primary typeface: ${brand} brand headline font — bold, high contrast`,
                "Secondary typeface: clean sans-serif for body copy",
                "Hierarchy: H1 48pt, H2 32pt, body 14pt with 1.5 line height",
                prompt.slice(0, 80),
            ],
            iconPlanning: [
                "Brand icon set aligned with visual identity guidelines",
                "Consistent stroke weight and corner radius across icons",
                ...(input.iconIds?.map((id) => `Icon asset: ${id}`) ?? []),
            ],
            illustrationPlanning: [
                "Brand-aligned illustration style — flat vector with brand color palette",
                "Product imagery integrated per visual hierarchy",
            ],
        };
    }
    buildLogoPlanning(input, profile, context) {
        const brand = context.brandName ?? profile.brandId;
        return {
            variants: [...ALL_BRAND_DESIGN_LOGO_VARIANTS],
            primaryLogoNotes: `Primary ${brand} logo — full wordmark with icon lockup`,
            secondaryLogoNotes: `Secondary ${brand} logo — compact horizontal variant`,
            iconVersionNotes: `Icon-only ${brand} mark for favicons and app icons`,
            monochromeNotes: "Single-color logo for single-ink print applications",
            lightBackgroundNotes: "Full-color logo optimized for light backgrounds (white, cream)",
            darkBackgroundNotes: "Reversed/inverted logo for dark backgrounds",
            usageGuidelines: [
                "Minimum clear space: 1x logo height on all sides",
                "Never stretch, rotate, or alter logo proportions",
                "Use approved color variants only per background contrast",
            ],
        };
    }
    buildMarketingMaterials(input, profile, context) {
        const materials = input.generateMarketingMaterials !== false ? [...ALL_BRAND_DESIGN_MATERIALS] : [BrandDesignMaterialType.Poster];
        const materialNotes = {};
        for (const material of materials) {
            materialNotes[material] = `${material} layout for ${context.brandName ?? profile.brandId} — ${profile.designType}`;
        }
        return {
            materials,
            materialNotes,
            campaignAdaptations: [
                `Campaign ${profile.campaignId} visual theme applied across all materials`,
                context.marketingObjective
                    ? `Marketing objective: ${context.marketingObjective} — CTA and copy aligned`
                    : "Standard conversion-focused marketing layout",
            ],
        };
    }
    buildSocialMediaDesign(input, profile) {
        const formats = input.generateSocialMediaDesign !== false ? [...ALL_BRAND_DESIGN_SOCIAL_FORMATS] : [BrandDesignSocialFormat.InstagramPost];
        const formatSpecs = {};
        for (const format of formats) {
            formatSpecs[format] = SOCIAL_FORMAT_CONFIG[format];
        }
        return {
            formats,
            formatSpecs,
            platformNotes: formats.map((f) => `${f} optimized for ${profile.platform} brand delivery`),
        };
    }
    buildPrintDesign(input, profile) {
        const formats = input.generatePrintDesign !== false ? [...ALL_BRAND_DESIGN_PRINT_FORMATS] : [BrandDesignPrintFormat.A4];
        const formatSpecs = {};
        for (const format of formats) {
            formatSpecs[format] = PRINT_FORMAT_CONFIG[format];
        }
        return {
            formats,
            formatSpecs,
            printNotes: [
                "300 DPI minimum for all print formats",
                "CMYK color conversion with brand color gamut mapping",
                "Bleed and safe zone guidelines per format specification",
            ],
        };
    }
    buildBrandConsistency(input, context) {
        const brand = context.brandName ?? "Brand";
        return {
            elements: [...ALL_BRAND_DESIGN_CONSISTENCY_ELEMENTS],
            logoUsageRules: [
                "Logo placement per brand guidelines — top-left or centered hero",
                "Approved logo variants only — no unauthorized modifications",
            ],
            typographyRules: [
                `${brand} approved typeface hierarchy enforced across all layouts`,
                "Maximum 2 typeface families per design piece",
            ],
            colorPaletteRules: [
                `Brand palette: ${(input.colorPalette ?? context.colorPalette ?? ["#000000", "#FFFFFF", "#0066CC"]).join(", ")}`,
                "Accent colors limited to 20% of layout area",
            ],
            brandStyleRules: [
                "Consistent visual language across all design deliverables",
                "Photography and illustration style aligned with brand identity",
            ],
            brandVoiceNotes: [
                context.brandGuidelines
                    ? "Brand voice derived from provided brand guidelines"
                    : "Professional, confident, approachable brand voice in copy placement",
            ],
            visualIdentityNotes: [
                `${brand} visual identity system applied to layout, color, and typography`,
                "Grid, spacing, and component styles consistent with brand standards",
            ],
        };
    }
    buildColorManagement(input, context) {
        const palette = input.colorPalette ?? context.colorPalette ?? ["#0066CC", "#FFFFFF", "#333333", "#F5F5F5"];
        return {
            rgbPalette: palette,
            cmykPalette: palette.map((c) => `CMYK equivalent of ${c}`),
            pantoneReferences: palette.slice(0, 3).map((c, i) => `Pantone ref ${i + 1}: ${c}`),
            iccProfilePlanning: "Adobe RGB working space with FOGRA39 CMYK conversion for print",
            contrastValidation: "WCAG AA contrast ratio verified for text on all background combinations",
        };
    }
    buildPlatformOptimizations(profile, input) {
        const platforms = input.generatePlatformOptimizations !== false
            ? ALL_BRAND_DESIGN_GEN_PLATFORMS
            : [profile.platform];
        return platforms.map((platform) => {
            const config = BRAND_DESIGN_PLATFORM_CONFIG[platform];
            return {
                platform,
                aspectRatio: config.aspectRatio,
                resolution: config.resolution,
                notes: [
                    `Branding design optimized for ${platform}`,
                    `${profile.designType} layout adapted to ${config.resolution}`,
                    "Brand consistency verified per platform delivery spec",
                ],
            };
        });
    }
    buildProductionInstructions(profile, designPlanning, colorManagement) {
        return {
            renderNotes: [designPlanning.layoutStructure, designPlanning.visualHierarchy],
            layoutGuidance: [designPlanning.gridSystem, designPlanning.alignment, designPlanning.whiteSpacePlanning],
            exportPreparation: [
                `Target ${profile.platform} resolution per optimization profile`,
                `RGB export for digital, CMYK export for print — ${colorManagement.iccProfilePlanning}`,
            ],
            qualityTargets: [
                "Branding score >= 55",
                "Brand consistency verified before export",
                "Print readiness validated for all print formats",
            ],
        };
    }
    buildRecommendations(context, profile) {
        const recs = [];
        recs.push("Verify logo clear space and minimum size before final export");
        if (context.brandGuidelines) {
            recs.push("Cross-reference all design elements against provided brand guidelines");
        }
        recs.push(`Validate ${profile.designType} layout at target platform resolution`);
        recs.push("Run contrast validation on all text/background color combinations");
        return recs;
    }
    resolvePlatform(input) {
        return input.platform ?? BrandDesignGenPlatform.Website;
    }
    extractContextFromProduct(analysis, understanding, creative, strategy, input, productImagePlan, enhancementPlan) {
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
            marketingObjective: input.marketingObjective ?? strategy?.marketingObjective,
            designPrompt: input.designPrompt,
            colorPalette: input.colorPalette,
            productImagePlan,
            enhancementPlan,
            creative,
            strategy,
            understanding,
            analysis,
        };
    }
}
//# sourceMappingURL=branding-design-analyzer.js.map