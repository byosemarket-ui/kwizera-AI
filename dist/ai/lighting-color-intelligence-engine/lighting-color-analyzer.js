import { ColorTemperature, LightingDirection, LightingType, } from "./types.js";
export class LightingColorAnalyzer {
    buildFromIntelligence(analysis, understanding, composition, background, industry) {
        const visual = analysis.visual;
        const lightingType = this.inferLightingType(visual.brightness, analysis.content.background, background);
        const lightingDirection = this.inferLightingDirection(lightingType, visual.contrast);
        const overexposure = Math.max(0, visual.exposure - 85);
        const underexposure = Math.max(0, 55 - visual.exposure);
        const shadows = Math.min(100, Math.round(visual.contrast * 0.4 + (100 - visual.brightness) * 0.3));
        const highlights = Math.min(100, Math.round(visual.brightness * 0.6 + visual.exposure * 0.3));
        const reflections = this.inferReflections(analysis.content.background, visual.sharpness);
        const lighting = {
            lightingType,
            lightingDirection,
            lightingIntensity: Math.round((visual.brightness + visual.exposure) / 2),
            lightingUniformity: Math.min(100, Math.round(100 - visual.noiseLevel * 2 + (lightingType === LightingType.Studio ? 10 : 0))),
            exposure: visual.exposure,
            overexposure,
            underexposure,
            shadows,
            highlights,
            reflections,
        };
        const dominantColors = visual.dominantColors ?? [];
        const colorHarmony = this.computeColorHarmony(dominantColors);
        const brandColorMatching = Math.min(100, understanding.brand.brandConsistency + (dominantColors.length <= 4 ? 10 : 0));
        const color = {
            dominantColors,
            colorPalette: dominantColors.length > 0 ? dominantColors : ["#808080"],
            colorHarmony,
            colorContrast: visual.contrast,
            saturation: visual.saturation,
            vibrance: Math.min(100, Math.round(visual.saturation * 0.85 + visual.sharpness * 0.15)),
            hueDistribution: this.inferHueDistribution(dominantColors),
            whiteBalance: visual.whiteBalance,
            colorTemperature: this.inferColorTemperature(visual.brightness, visual.whiteBalance),
            brandColorMatching,
        };
        const lightingSuitability = this.buildLightingSuitability(lighting, understanding, analysis);
        const colorSuitability = this.buildColorSuitability(color, understanding, analysis);
        const lightingPlan = this.buildLightingPlan(lighting, color);
        const colorPlan = this.buildColorPlan(color, understanding);
        const recommendations = this.buildRecommendations(lighting, color, lightingSuitability, colorSuitability);
        const keywords = [
            ...analysis.keywords,
            ...understanding.keywords,
            lightingType,
            color.colorTemperature,
            ...dominantColors,
            industry ?? analysis.classification.category,
            analysis.classification.creativeStyle,
            composition?.compositionAnalysis.compositionType ?? "",
        ].filter(Boolean);
        return {
            lighting,
            color,
            lightingSuitability,
            colorSuitability,
            lightingPlan,
            colorPlan,
            recommendations,
            keywords,
        };
    }
    inferLightingType(brightness, background, bgRecord) {
        const lower = background.toLowerCase();
        if (lower.includes("studio") || bgRecord?.classification.backgroundType === "studio") {
            return brightness >= 70 ? LightingType.HighKey : LightingType.Studio;
        }
        if (lower.includes("sunset") || lower.includes("gradient"))
            return LightingType.Mixed;
        if (brightness < 45)
            return LightingType.LowKey;
        if (brightness >= 75)
            return LightingType.HighKey;
        if (lower.includes("urban") || lower.includes("outdoor"))
            return LightingType.Natural;
        return LightingType.Artificial;
    }
    inferLightingDirection(type, contrast) {
        if (type === LightingType.Backlit)
            return LightingDirection.Back;
        if (type === LightingType.SideLit)
            return LightingDirection.Side;
        if (type === LightingType.TopLit)
            return LightingDirection.Top;
        if (type === LightingType.Studio || type === LightingType.HighKey)
            return LightingDirection.Diffused;
        if (contrast >= 75)
            return LightingDirection.Side;
        return LightingDirection.Front;
    }
    inferReflections(background, sharpness) {
        let reflections = 20;
        if (background.toLowerCase().includes("studio") || background.toLowerCase().includes("white")) {
            reflections += 25;
        }
        if (sharpness >= 80)
            reflections += 15;
        return Math.min(100, reflections);
    }
    computeColorHarmony(colors) {
        if (colors.length === 0)
            return 60;
        if (colors.length <= 3)
            return 88;
        if (colors.length <= 5)
            return 74;
        return 58;
    }
    inferHueDistribution(colors) {
        if (colors.length === 0)
            return "neutral-balanced";
        if (colors.some((c) => c.includes("ff") || c.includes("e9")))
            return "warm-accent-dominant";
        if (colors.some((c) => c.includes("1a") || c.includes("2d")))
            return "cool-dark-dominant";
        return "mixed-balanced";
    }
    inferColorTemperature(brightness, whiteBalance) {
        if (whiteBalance >= 70 || brightness >= 72)
            return ColorTemperature.Warm;
        if (whiteBalance <= 45)
            return ColorTemperature.Cool;
        return ColorTemperature.Neutral;
    }
    buildLightingSuitability(lighting, understanding, analysis) {
        const base = Math.round((lighting.lightingIntensity + lighting.lightingUniformity + (100 - lighting.overexposure - lighting.underexposure)) / 3);
        const clamp = (v) => Math.max(0, Math.min(100, v));
        const studioBoost = lighting.lightingType === LightingType.Studio || lighting.lightingType === LightingType.HighKey ? 12 : 0;
        return {
            productPhotography: clamp(base + studioBoost + (lighting.shadows < 50 ? 8 : 0)),
            advertisement: clamp(base + understanding.scores.marketingReadinessScore * 0.12),
            poster: clamp(base + studioBoost * 0.5),
            socialMedia: clamp(base + (lighting.lightingType === LightingType.Natural ? 10 : 0)),
            thumbnail: clamp(base + studioBoost - (lighting.overexposure > 15 ? 10 : 0)),
            videoProduction: clamp(base - (lighting.lightingUniformity < 60 ? 12 : 0)),
        };
    }
    buildColorSuitability(color, understanding, analysis) {
        return {
            brandCompatibility: Math.min(100, color.brandColorMatching),
            marketingEffectiveness: Math.min(100, understanding.scores.marketingReadinessScore),
            emotionalImpact: Math.min(100, Math.round(color.vibrance * 0.6 + color.saturation * 0.4)),
            visualComfort: Math.min(100, Math.round(color.colorHarmony * 0.5 + (100 - Math.abs(color.saturation - 65)) * 0.5)),
            readability: Math.min(100, Math.round(color.colorContrast * 0.7 + color.colorHarmony * 0.3)),
            creativeConsistency: Math.min(100, understanding.brand.brandConsistency),
        };
    }
    buildLightingPlan(lighting, color) {
        return {
            exposureStrategy: lighting.overexposure > 10
                ? "Plan exposure reduction to recover highlight detail"
                : lighting.underexposure > 10
                    ? "Plan exposure lift for shadow detail recovery"
                    : "Exposure balanced — maintain current lighting levels in planning",
            shadowStrategy: lighting.shadows > 55
                ? "Plan shadow softening for product clarity"
                : "Shadow levels acceptable for production",
            highlightStrategy: lighting.highlights > 80
                ? "Plan highlight rolloff to prevent clipping"
                : "Highlight control sufficient for enhancement planning",
            reflectionStrategy: lighting.reflections > 40
                ? "Plan reflection management for glossy surfaces"
                : "Reflection levels manageable in production pipeline",
            whiteBalanceStrategy: `Plan white balance alignment toward ${color.colorTemperature} tone (current ${color.whiteBalance})`,
            lightingConsistencyStrategy: `Maintain ${lighting.lightingType} lighting consistency across related assets`,
        };
    }
    buildColorPlan(color, understanding) {
        return {
            colorHarmonyStrategy: color.colorHarmony < 70
                ? `Plan palette harmonization around ${color.dominantColors.slice(0, 2).join(" + ")}`
                : "Color harmony sufficient — preserve palette in grading preparation",
            colorBalanceStrategy: `Plan balance across ${color.hueDistribution} hue distribution`,
            contrastStrategy: color.colorContrast < 60
                ? "Plan contrast enhancement for visual separation"
                : "Contrast levels support marketing readability",
            saturationStrategy: color.saturation < 50
                ? "Plan selective saturation lift for product emphasis"
                : color.saturation > 80
                    ? "Plan saturation moderation for visual comfort"
                    : "Saturation within optimal range for grading prep",
            brandColorStrategy: `Align grading with ${understanding.brand.brandIdentity} brand palette (${color.brandColorMatching}% match)`,
            colorGradingPreparation: `Prepare ${color.colorTemperature} grade LUT targeting ${color.colorPalette.join(", ")}`,
        };
    }
    buildRecommendations(lighting, color, lightingSuit, colorSuit) {
        const recs = [];
        if (lighting.overexposure > 15) {
            recs.push({
                category: "lighting",
                suggestion: "Reduce overexposure in planned enhancement pass",
                priority: "high",
                reason: `Overexposure at ${lighting.overexposure}%`,
            });
        }
        if (lighting.underexposure > 15) {
            recs.push({
                category: "lighting",
                suggestion: "Plan exposure compensation for underexposed regions",
                priority: "high",
                reason: `Underexposure at ${lighting.underexposure}%`,
            });
        }
        if (color.brandColorMatching < 65) {
            recs.push({
                category: "brand",
                suggestion: "Align color palette closer to brand guidelines in grading prep",
                priority: "medium",
                reason: `Brand color match ${color.brandColorMatching}%`,
            });
        }
        if (color.colorHarmony < 65) {
            recs.push({
                category: "color",
                suggestion: "Harmonize dominant colors for stronger visual cohesion",
                priority: "medium",
                reason: `Color harmony ${color.colorHarmony}%`,
            });
        }
        if (lightingSuit.productPhotography < 65) {
            recs.push({
                category: "lighting",
                suggestion: "Improve studio lighting uniformity for product photography",
                priority: "medium",
                reason: `Product photography suitability ${lightingSuit.productPhotography}%`,
            });
        }
        if (colorSuit.readability < 60) {
            recs.push({
                category: "marketing",
                suggestion: "Increase color contrast for better marketing readability",
                priority: "medium",
                reason: `Readability ${colorSuit.readability}%`,
            });
        }
        recs.push({
            category: "creative",
            suggestion: "Lighting and color intelligence ready for enhancement and video production planning",
            priority: "low",
            reason: `${lighting.lightingType} lighting with ${color.colorTemperature} color temperature`,
        });
        return recs;
    }
}
//# sourceMappingURL=lighting-color-analyzer.js.map