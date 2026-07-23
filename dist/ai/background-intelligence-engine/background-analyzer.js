import { ImageSceneType } from "../image-understanding-engine/types.js";
import { DetectedObjectType } from "../object-detection-intelligence-engine/types.js";
import { BackgroundComplexity, BackgroundType, } from "./types.js";
export class BackgroundAnalyzer {
    buildFromIntelligence(analysis, understanding, detection, industry) {
        const backgroundLabel = analysis.content.background || understanding.visual.background || "unspecified-background";
        const backgroundType = this.classifyBackgroundType(backgroundLabel, understanding.scene.sceneType, analysis);
        const complexity = this.assessComplexity(detection, backgroundLabel);
        const bgAnalysis = {
            backgroundType,
            backgroundComplexity: complexity,
            backgroundColors: analysis.visual.dominantColors ?? [],
            backgroundBrightness: analysis.visual.brightness,
            backgroundContrast: analysis.visual.contrast,
            backgroundTexture: this.inferTexture(backgroundLabel, complexity),
            backgroundPattern: this.inferPattern(backgroundLabel),
            backgroundDepth: this.inferDepth(understanding.scene.sceneType, complexity),
            backgroundPerspective: understanding.visual.perspective,
            backgroundCleanliness: this.computeCleanliness(detection, complexity),
        };
        const classification = {
            backgroundType,
            classificationTags: this.buildClassificationTags(backgroundType, backgroundLabel, analysis),
            industryFit: industry ?? analysis.classification.category ?? "general",
            sceneAlignment: understanding.scene.environment,
        };
        const distraction = this.computeDistraction(detection, complexity);
        const quality = {
            visualQuality: Math.min(100, Math.round((analysis.visual.sharpness + analysis.visual.contrast) / 2)),
            productVisibility: detection.productDetection.productVisibility,
            backgroundDistraction: distraction,
            colorHarmony: this.computeColorHarmony(analysis.visual.dominantColors ?? []),
            brandCompatibility: understanding.brand.brandConsistency,
            marketingSuitability: understanding.scores.marketingReadinessScore,
        };
        const suitability = this.buildSuitability(bgAnalysis, quality, understanding, analysis);
        const replacementPlan = this.buildReplacementPlan(bgAnalysis, quality, backgroundType);
        const recommendations = this.buildRecommendations(bgAnalysis, quality, suitability, replacementPlan);
        const keywords = [
            ...analysis.keywords,
            ...understanding.keywords,
            backgroundLabel,
            backgroundType,
            ...classification.classificationTags,
        ].filter(Boolean);
        return {
            backgroundLabel,
            analysis: bgAnalysis,
            classification,
            quality,
            suitability,
            replacementPlan,
            recommendations,
            keywords,
        };
    }
    classifyBackgroundType(label, sceneType, analysis) {
        const lower = label.toLowerCase();
        if (lower.includes("studio") || lower.includes("white") || sceneType === ImageSceneType.Studio) {
            return BackgroundType.Studio;
        }
        if (analysis.technical.hasTransparency && !lower.includes("studio") && !lower.includes("white")) {
            return BackgroundType.Transparent;
        }
        if (lower.includes("gradient") || lower.includes("sunset"))
            return BackgroundType.Gradient;
        if (lower.includes("abstract") || lower.includes("pattern"))
            return BackgroundType.Abstract;
        if (lower.includes("office") || lower.includes("desk"))
            return BackgroundType.Office;
        if (lower.includes("nature") || lower.includes("forest") || lower.includes("garden")) {
            return BackgroundType.Nature;
        }
        if (lower.includes("urban") || lower.includes("street") || sceneType === ImageSceneType.Outdoor) {
            return BackgroundType.Outdoor;
        }
        if (sceneType === ImageSceneType.Lifestyle)
            return BackgroundType.Lifestyle;
        if (sceneType === ImageSceneType.Commercial)
            return BackgroundType.Commercial;
        if (sceneType === ImageSceneType.Indoor)
            return BackgroundType.Indoor;
        if (analysis.classification.imageType === "background")
            return BackgroundType.Custom;
        return BackgroundType.Custom;
    }
    assessComplexity(detection, backgroundLabel) {
        const bgObjects = detection.objects.filter((o) => o.objectType === DetectedObjectType.BackgroundObject || o.objectType === DetectedObjectType.DecorativeElement);
        const totalObjects = detection.objects.length;
        const lower = backgroundLabel.toLowerCase();
        if (lower.includes("white") || lower.includes("plain") || lower.includes("studio")) {
            return BackgroundComplexity.Minimal;
        }
        if (totalObjects <= 2)
            return BackgroundComplexity.Low;
        if (totalObjects <= 4)
            return BackgroundComplexity.Medium;
        if (bgObjects.length >= 2 || totalObjects > 5)
            return BackgroundComplexity.High;
        return BackgroundComplexity.Medium;
    }
    inferTexture(label, complexity) {
        const lower = label.toLowerCase();
        if (lower.includes("gradient"))
            return "smooth-gradient";
        if (lower.includes("urban") || lower.includes("street"))
            return "urban-textured";
        if (lower.includes("studio") || lower.includes("white"))
            return "smooth-matte";
        if (complexity === BackgroundComplexity.Minimal)
            return "flat";
        return complexity === BackgroundComplexity.High ? "detailed-textured" : "moderate-textured";
    }
    inferPattern(label) {
        const lower = label.toLowerCase();
        if (lower.includes("gradient"))
            return "gradient";
        if (lower.includes("abstract"))
            return "abstract";
        if (lower.includes("urban"))
            return "urban-elements";
        if (lower.includes("studio") || lower.includes("white"))
            return "solid";
        return "contextual";
    }
    inferDepth(sceneType, complexity) {
        if (sceneType === ImageSceneType.Studio || complexity === BackgroundComplexity.Minimal)
            return "shallow";
        if (sceneType === ImageSceneType.Outdoor || sceneType === ImageSceneType.Lifestyle)
            return "deep";
        return "moderate";
    }
    computeCleanliness(detection, complexity) {
        let score = 85;
        const distractions = detection.objects.filter((o) => o.objectType !== DetectedObjectType.Product &&
            o.objectType !== DetectedObjectType.Logo &&
            o.objectType !== DetectedObjectType.BackgroundObject);
        score -= distractions.length * 5;
        if (complexity === BackgroundComplexity.High || complexity === BackgroundComplexity.VeryHigh)
            score -= 10;
        if (complexity === BackgroundComplexity.Minimal)
            score += 10;
        return Math.max(20, Math.min(100, score));
    }
    computeDistraction(detection, complexity) {
        const nonEssential = detection.objects.filter((o) => o.objectType !== DetectedObjectType.Product &&
            o.objectType !== DetectedObjectType.BackgroundObject).length;
        let distraction = nonEssential * 8;
        if (complexity === BackgroundComplexity.High)
            distraction += 15;
        if (complexity === BackgroundComplexity.Minimal)
            distraction = Math.max(0, distraction - 20);
        return Math.min(100, distraction);
    }
    computeColorHarmony(colors) {
        if (colors.length === 0)
            return 60;
        if (colors.length <= 3)
            return 85;
        if (colors.length <= 5)
            return 72;
        return 58;
    }
    buildClassificationTags(type, label, analysis) {
        return [
            type,
            analysis.classification.creativeStyle,
            analysis.classification.category,
            label.split("-")[0] ?? label,
        ].filter(Boolean);
    }
    buildSuitability(bgAnalysis, quality, understanding, analysis) {
        const base = Math.round((quality.visualQuality + quality.productVisibility + (100 - quality.backgroundDistraction)) / 3);
        const studioBoost = bgAnalysis.backgroundType === BackgroundType.Studio ? 12 : 0;
        const lifestyleBoost = bgAnalysis.backgroundType === BackgroundType.Lifestyle ? 8 : 0;
        const gradientBoost = bgAnalysis.backgroundType === BackgroundType.Gradient ? 6 : 0;
        const clamp = (v) => Math.max(0, Math.min(100, v));
        return {
            productShowcase: clamp(base + studioBoost + (quality.productVisibility > 70 ? 10 : 0)),
            advertisement: clamp(base + understanding.scores.marketingReadinessScore * 0.15 + studioBoost),
            socialMedia: clamp(base + lifestyleBoost + gradientBoost),
            poster: clamp(base + studioBoost * 0.5 + quality.colorHarmony * 0.1),
            banner: clamp(base + gradientBoost + (analysis.classification.imageType === "banner" ? 15 : 0)),
            thumbnail: clamp(base - (bgAnalysis.backgroundComplexity === BackgroundComplexity.High ? 15 : 0) + studioBoost),
            videoProduction: clamp(base + lifestyleBoost - (quality.backgroundDistraction > 40 ? 10 : 0)),
        };
    }
    buildReplacementPlan(bgAnalysis, quality, type) {
        const needsReplacement = quality.backgroundDistraction > 35 || quality.productVisibility < 65;
        return {
            backgroundIsolationPlan: needsReplacement
                ? `Isolate subject from ${type} background using edge-aware segmentation planning`
                : `Maintain current ${type} background — isolation not required`,
            replacementStrategy: needsReplacement
                ? `Plan replacement with lower-complexity ${type === BackgroundType.Studio ? "studio" : "neutral"} background`
                : "No replacement needed — background supports product presentation",
            colorHarmonyStrategy: `Align replacement palette with dominant colors: ${bgAnalysis.backgroundColors.slice(0, 3).join(", ") || "brand palette"}`,
            lightingConsistency: `Match ${bgAnalysis.backgroundBrightness >= 70 ? "high-key" : "balanced"} lighting from source analysis`,
            perspectiveConsistency: `Preserve ${bgAnalysis.backgroundPerspective} perspective in replacement planning`,
            shadowConsistency: quality.backgroundDistraction > 30
                ? "Plan shadow softening for cleaner product separation"
                : "Shadow consistency acceptable — minimal adjustment planned",
        };
    }
    buildRecommendations(bgAnalysis, quality, suitability, plan) {
        const recs = [];
        if (quality.backgroundDistraction > 40) {
            recs.push({
                category: "quality",
                suggestion: "Reduce background visual noise for stronger product focus",
                priority: "high",
                reason: `Background distraction at ${quality.backgroundDistraction}%`,
            });
        }
        if (quality.productVisibility < 70) {
            recs.push({
                category: "suitability",
                suggestion: "Improve background contrast to elevate product visibility",
                priority: "high",
                reason: `Product visibility ${quality.productVisibility}% on current background`,
            });
        }
        if (suitability.socialMedia < 60) {
            recs.push({
                category: "marketing",
                suggestion: "Consider lifestyle or gradient background for social media formats",
                priority: "medium",
                reason: `Social media suitability at ${suitability.socialMedia}%`,
            });
        }
        if (plan.replacementStrategy.includes("replacement")) {
            recs.push({
                category: "replacement",
                suggestion: plan.replacementStrategy,
                priority: "medium",
                reason: "Background replacement planning prepared — no modification performed",
            });
        }
        if (quality.brandCompatibility < 60) {
            recs.push({
                category: "branding",
                suggestion: "Align background colors with brand palette for consistency",
                priority: "medium",
                reason: `Brand compatibility ${quality.brandCompatibility}%`,
            });
        }
        recs.push({
            category: "creative",
            suggestion: "Background intelligence ready for enhancement and video production planning",
            priority: "low",
            reason: `${bgAnalysis.backgroundType} background classified with ${bgAnalysis.backgroundComplexity} complexity`,
        });
        return recs;
    }
}
//# sourceMappingURL=background-analyzer.js.map