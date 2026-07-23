import { EnhancementPlatform, } from "./types.js";
export class EnhancementPlanningAnalyzer {
    buildFromIntelligence(analysis, understanding, detection, background, composition, lightingColor, brandVisual, projectId, platform) {
        const targetPlatform = platform ?? EnhancementPlatform.Website;
        const product = detection?.productDetection.mainProduct ?? analysis.content.products[0] ?? "unspecified-product";
        const brand = brandVisual?.profile.brandName ?? understanding.brand.brandIdentity ?? analysis.content.logos[0] ?? "unknown-brand";
        const qualityAnalysis = this.buildQualityAnalysis(analysis, lightingColor);
        const enhancementPlan = this.buildEnhancementPlan(qualityAnalysis, background, lightingColor, detection);
        const restorationPlan = this.buildRestorationPlan(qualityAnalysis, analysis);
        const backgroundPlan = this.buildBackgroundPlan(background, detection);
        const platformOptimization = this.buildPlatformRules(qualityAnalysis, targetPlatform);
        const profile = {
            enhancementPlanId: `enhancement-plan-${analysis.imageId}`,
            projectId: projectId ?? "default-project",
            imageId: analysis.imageId,
            product,
            brand,
            platform: targetPlatform,
            enhancementVersion: "1.0",
        };
        const recommendations = this.buildRecommendations(qualityAnalysis, enhancementPlan, restorationPlan, backgroundPlan, targetPlatform);
        const keywords = [
            ...analysis.keywords,
            product,
            brand,
            targetPlatform,
            analysis.classification.creativeStyle,
            ...recommendations.map((r) => r.category),
        ].filter(Boolean);
        return {
            profile,
            qualityAnalysis,
            enhancementPlan,
            restorationPlan,
            backgroundPlan,
            platformOptimization,
            recommendations,
            keywords,
        };
    }
    buildQualityAnalysis(analysis, lightingColor) {
        const visual = analysis.visual;
        const width = analysis.technical.width;
        const resolutionQuality = width >= 2400 ? 95 : width >= 1920 ? 85 : width >= 1280 ? 72 : width >= 800 ? 58 : 40;
        const compressionArtifacts = analysis.technical.compressionType === "lossy"
            ? Math.min(60, 25 + Math.round(analysis.technical.fileSizeBytes / 50000))
            : 10;
        return {
            resolutionQuality,
            sharpness: visual.sharpness,
            noise: visual.noiseLevel,
            compressionArtifacts,
            exposure: visual.exposure,
            contrast: visual.contrast,
            whiteBalance: visual.whiteBalance,
            colorAccuracy: lightingColor?.color.brandColorMatching ?? Math.min(100, visual.saturation + 15),
            dynamicRange: visual.dynamicRange ?? Math.round((visual.contrast + visual.brightness) / 2),
            visualClarity: Math.round((visual.sharpness + (100 - visual.noiseLevel)) / 2),
        };
    }
    buildEnhancementPlan(quality, background, lightingColor, detection) {
        return {
            resolutionEnhancement: quality.resolutionQuality < 75
                ? "Plan upscale to target platform resolution without modifying source"
                : "Resolution sufficient — preserve original dimensions in planning",
            noiseReduction: quality.noise > 25
                ? `Plan noise reduction targeting ${quality.noise}% noise level`
                : "Noise within acceptable range — minimal reduction planned",
            sharpening: quality.sharpness < 75
                ? "Plan selective sharpening on product and logo regions"
                : "Sharpness adequate — light sharpening plan only",
            exposureCorrection: lightingColor?.lightingPlan.exposureStrategy ?? this.exposurePlan(quality.exposure),
            contrastImprovement: quality.contrast < 65
                ? "Plan contrast lift for product separation"
                : "Contrast balanced — maintain in enhancement plan",
            whiteBalanceCorrection: lightingColor?.lightingPlan.whiteBalanceStrategy ?? `Plan white balance toward ${quality.whiteBalance} baseline`,
            colorBalance: lightingColor?.colorPlan.colorBalanceStrategy ?? "Plan color balance preserving brand palette",
            backgroundEnhancement: background?.replacementPlan.replacementStrategy ?? "Plan background harmonization without editing",
            objectEnhancement: detection?.productDetection.mainProduct
                ? `Plan object clarity enhancement for ${detection.productDetection.mainProduct}`
                : "Plan foreground object clarity preservation",
            reflectionControl: lightingColor?.lightingPlan.reflectionStrategy ?? "Plan reflection management in glossy areas",
        };
    }
    exposurePlan(exposure) {
        if (exposure > 85)
            return "Plan exposure reduction to recover highlights";
        if (exposure < 55)
            return "Plan exposure lift for shadow detail";
        return "Exposure balanced — no correction planned";
    }
    buildRestorationPlan(quality, analysis) {
        const needsRestoration = quality.compressionArtifacts > 30 || quality.noise > 35 || quality.sharpness < 60;
        return {
            scratchRemoval: needsRestoration ? "Plan scratch and blemish detection pass" : "No scratch removal required",
            dustRemoval: quality.noise > 30 ? "Plan dust and speckle reduction" : "Dust levels acceptable",
            artifactReduction: quality.compressionArtifacts > 25
                ? `Plan JPEG/WebP artifact reduction (${quality.compressionArtifacts}% estimated)`
                : "Compression artifacts minimal",
            blurReduction: quality.sharpness < 65 ? "Plan deblur on primary subject regions" : "Blur within tolerance",
            qualityRecovery: needsRestoration
                ? "Plan multi-pass quality recovery while preserving original pixels"
                : "Quality recovery not required — source image suitable",
        };
    }
    buildBackgroundPlan(background, detection) {
        const distraction = background?.quality.backgroundDistraction ?? 20;
        return {
            backgroundCleanup: distraction > 35
                ? "Plan background element cleanup and distraction reduction"
                : "Background clean — maintenance planning only",
            backgroundBlur: distraction > 40
                ? "Plan selective background blur for product focus"
                : "Background blur not required in plan",
            backgroundSimplification: background?.replacementPlan.replacementStrategy ?? "Plan background simplification if needed",
            backgroundHarmonization: background?.replacementPlan.colorHarmonyStrategy ?? "Plan background color harmonization",
            backgroundIsolationPreparation: background?.replacementPlan.backgroundIsolationPlan ??
                detection?.productDetection.mainProduct
                ? "Plan subject isolation for background flexibility"
                : "Background isolation planning prepared",
        };
    }
    buildPlatformRules(quality, platform) {
        const base = `Preserve original — optimize for ${quality.resolutionQuality}% resolution quality`;
        return {
            tiktok: `${base}; vertical 9:16 safe crop plan; max 15s thumbnail clarity`,
            instagram: `${base}; square 1:1 and 4:5 feed crop plans; story safe zones`,
            facebook: `${base}; 1.91:1 link preview and square feed plans`,
            youtube: `${base}; 16:9 thumbnail sharpening plan; min 1280px width target`,
            whatsapp: `${base}; compressed delivery plan under 5MB; readability priority`,
            website: platform === EnhancementPlatform.Website ? `${base}; responsive srcset plan; hero quality priority` : base,
        };
    }
    buildRecommendations(quality, enhancement, restoration, background, platform) {
        const recs = [];
        if (quality.visualClarity < 70) {
            recs.push({
                category: "quality",
                suggestion: "Plan clarity improvement through sharpening and noise reduction",
                priority: "high",
                reason: `Visual clarity ${quality.visualClarity}%`,
            });
        }
        if (restoration.qualityRecovery.includes("multi-pass")) {
            recs.push({
                category: "restoration",
                suggestion: restoration.qualityRecovery,
                priority: "medium",
                reason: "Quality metrics indicate restoration planning needed",
            });
        }
        if (background.backgroundCleanup.includes("cleanup")) {
            recs.push({
                category: "background",
                suggestion: background.backgroundCleanup,
                priority: "medium",
                reason: "Background distraction detected in intelligence",
            });
        }
        if (enhancement.exposureCorrection.includes("reduction") || enhancement.exposureCorrection.includes("lift")) {
            recs.push({
                category: "lighting",
                suggestion: enhancement.exposureCorrection,
                priority: "medium",
                reason: `Exposure at ${quality.exposure}%`,
            });
        }
        if (quality.colorAccuracy < 65) {
            recs.push({
                category: "color",
                suggestion: enhancement.colorBalance,
                priority: "medium",
                reason: `Color accuracy ${quality.colorAccuracy}%`,
            });
        }
        recs.push({
            category: "platform",
            suggestion: `Platform optimization prepared for ${platform}`,
            priority: "low",
            reason: "Non-destructive enhancement plan ready",
        });
        recs.push({
            category: "creative",
            suggestion: "Enhancement plan ready — original image preserved, no processing performed",
            priority: "low",
            reason: `Readiness based on quality score ${Math.round((quality.visualClarity + quality.sharpness) / 2)}`,
        });
        return recs;
    }
}
//# sourceMappingURL=enhancement-planning-analyzer.js.map