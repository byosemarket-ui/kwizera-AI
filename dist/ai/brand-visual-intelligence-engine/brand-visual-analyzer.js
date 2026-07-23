import { BrandVisualStyle, } from "./types.js";
export class BrandVisualAnalyzer {
    buildFromIntelligence(analysis, understanding, detection, lightingColor, brandName, industry, styleOverride) {
        const name = brandName ?? understanding.brand.brandIdentity ?? analysis.content.logos[0] ?? "unknown-brand";
        const brandId = `brand-${name.toLowerCase().replace(/\s+/g, "-")}`;
        const colors = analysis.visual.dominantColors ?? [];
        const visualStyle = styleOverride ?? this.inferVisualStyle(analysis, industry);
        const typography = this.buildTypography(visualStyle, analysis.classification.creativeStyle);
        const profile = {
            brandId,
            brandName: name,
            brandCategory: analysis.classification.category,
            industry: industry ?? analysis.classification.category,
            logo: detection.logoDetection.brandAssociation || analysis.content.logos[0] || name,
            primaryColors: colors.slice(0, 2),
            secondaryColors: colors.slice(2, 5),
            typography,
            iconStyle: this.inferIconStyle(visualStyle),
            graphicStyle: analysis.classification.creativeStyle,
            visualTheme: understanding.visual.composition,
            brandVersion: "1.0",
        };
        const logoAnalysis = {
            logoVisibility: detection.logoDetection.logoVisibility,
            logoPosition: detection.logoDetection.logoPosition,
            logoSize: detection.logoDetection.logoSize,
            logoContrast: Math.min(100, Math.round(analysis.visual.contrast * 0.8 + detection.logoDetection.logoVisibility * 0.2)),
            logoSafeArea: detection.logoDetection.logoPresent ? "top-left-safe-zone-prepared" : "logo-placement-zone-reserved",
            logoPriority: understanding.visual.visualHierarchy === "brand-first" ? "primary" : "secondary",
            logoConsistency: understanding.brand.brandConsistency,
        };
        const colorAnalysis = {
            primaryBrandColors: profile.primaryColors,
            secondaryColors: profile.secondaryColors,
            accentColors: colors.length > 1 ? [colors[1]] : [],
            backgroundColors: [analysis.content.background].filter(Boolean),
            textColors: analysis.content.text.length > 0 ? ["#ffffff", "#000000"] : ["#333333"],
            ctaColors: colors.filter((c) => c.includes("e9") || c.includes("ff")).slice(0, 1).length > 0
                ? colors.filter((c) => c.includes("e9") || c.includes("ff")).slice(0, 1)
                : [colors[0] ?? "#e94560"],
            colorHarmony: lightingColor?.color.colorHarmony ?? Math.min(100, understanding.brand.brandConsistency + 10),
        };
        const consistency = {
            logoConsistency: logoAnalysis.logoConsistency,
            colorConsistency: lightingColor?.scores.brandColorScore ?? colorAnalysis.colorHarmony,
            typographyConsistency: Math.min(100, 70 + (typography.primaryFont.includes("sans") ? 15 : 0)),
            layoutConsistency: understanding.brand.brandConsistency,
            visualIdentity: Math.round((understanding.brand.brandConsistency + logoAnalysis.logoConsistency + colorAnalysis.colorHarmony) / 3),
            marketingConsistency: understanding.scores.marketingReadinessScore,
        };
        const planning = this.buildPlanning(profile, logoAnalysis, colorAnalysis, typography, visualStyle);
        const recommendations = this.buildRecommendations(logoAnalysis, colorAnalysis, consistency, typography);
        const keywords = [
            ...analysis.keywords,
            name,
            visualStyle,
            profile.graphicStyle,
            industry ?? profile.industry,
            ...profile.primaryColors,
        ].filter(Boolean);
        return {
            profile,
            logoAnalysis,
            colorAnalysis,
            typography,
            visualStyle,
            consistency,
            planning,
            recommendations,
            keywords,
        };
    }
    inferVisualStyle(analysis, industry) {
        const cat = (industry ?? analysis.classification.category).toLowerCase();
        const style = analysis.classification.creativeStyle.toLowerCase();
        if (cat.includes("fashion") || style === "editorial")
            return BrandVisualStyle.Fashion;
        if (cat.includes("beauty") || cat.includes("marketing"))
            return BrandVisualStyle.Beauty;
        if (cat.includes("food"))
            return BrandVisualStyle.Food;
        if (cat.includes("health"))
            return BrandVisualStyle.Healthcare;
        if (cat.includes("education"))
            return BrandVisualStyle.Education;
        if (cat.includes("real"))
            return BrandVisualStyle.RealEstate;
        if (style === "commercial" && cat.includes("commerce"))
            return BrandVisualStyle.Technology;
        if (style === "commercial")
            return BrandVisualStyle.Corporate;
        if (analysis.visual.saturation < 40)
            return BrandVisualStyle.Minimal;
        if (analysis.classification.imageType === "product-image")
            return BrandVisualStyle.Modern;
        return BrandVisualStyle.Modern;
    }
    buildTypography(style, creativeStyle) {
        const modern = style === BrandVisualStyle.Modern || style === BrandVisualStyle.Technology;
        return {
            primaryFont: modern ? "brand-sans-primary" : "brand-serif-primary",
            secondaryFont: modern ? "brand-sans-secondary" : "brand-serif-secondary",
            fontHierarchy: creativeStyle === "commercial" ? "heading-product-cta" : "heading-body-cta",
            headingStyle: style === BrandVisualStyle.Luxury ? "elegant-serif-bold" : "clean-sans-bold",
            bodyStyle: "neutral-sans-regular",
            ctaStyle: "bold-sans-uppercase",
        };
    }
    inferIconStyle(style) {
        const map = {
            [BrandVisualStyle.Technology]: "geometric-minimal",
            [BrandVisualStyle.Fashion]: "elegant-line",
            [BrandVisualStyle.Beauty]: "soft-rounded",
            [BrandVisualStyle.Minimal]: "flat-minimal",
            [BrandVisualStyle.Luxury]: "refined-gold-accent",
        };
        return map[style] ?? "standard-brand";
    }
    buildPlanning(profile, logo, color, typography, style) {
        return {
            logoPlacementPlan: logo.logoVisibility >= 70
                ? `Maintain ${logo.logoPosition} logo placement with ${logo.logoSafeArea}`
                : "Plan logo reposition for improved brand visibility",
            colorApplicationPlan: `Apply primary ${profile.primaryColors.join(", ")} with ${color.colorHarmony}% harmony target`,
            typographyPlan: `Use ${typography.primaryFont} for headings, ${typography.secondaryFont} for body`,
            visualStylePlan: `${style} visual style with ${profile.graphicStyle} graphic treatment`,
            brandGuidelineNotes: `Brand ${profile.brandName} v${profile.brandVersion} — ${profile.visualTheme}`,
            consistencyProtectionPlan: "Lock brand colors, logo safe area and typography hierarchy across all assets",
        };
    }
    buildRecommendations(logo, color, consistency, typography) {
        const recs = [];
        if (!logo.logoVisibility || logo.logoVisibility < 65) {
            recs.push({
                category: "logo",
                suggestion: "Increase logo visibility and contrast for brand recognition",
                priority: "high",
                reason: `Logo visibility ${logo.logoVisibility}%`,
            });
        }
        if (consistency.colorConsistency < 65) {
            recs.push({
                category: "color",
                suggestion: "Align image colors closer to brand palette guidelines",
                priority: "medium",
                reason: `Color consistency ${consistency.colorConsistency}%`,
            });
        }
        if (consistency.typographyConsistency < 65) {
            recs.push({
                category: "typography",
                suggestion: `Standardize typography using ${typography.primaryFont} hierarchy`,
                priority: "medium",
                reason: `Typography consistency ${consistency.typographyConsistency}%`,
            });
        }
        if (consistency.visualIdentity < 70) {
            recs.push({
                category: "consistency",
                suggestion: "Strengthen overall visual identity alignment across elements",
                priority: "high",
                reason: `Visual identity ${consistency.visualIdentity}%`,
            });
        }
        recs.push({
            category: "creative",
            suggestion: "Brand visual intelligence ready for poster, image and video production planning",
            priority: "low",
            reason: `Brand consistency ${consistency.logoConsistency}% logo, ${consistency.colorConsistency}% color`,
        });
        return recs;
    }
}
//# sourceMappingURL=brand-visual-analyzer.js.map