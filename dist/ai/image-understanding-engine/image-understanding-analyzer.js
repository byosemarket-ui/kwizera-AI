import { ImageAnalysisType } from "../image-analysis-engine/types.js";
import { ImageSceneType, ImageUnderstandingMarketingGoal, ImageUnderstandingPlatform, } from "./types.js";
const SCENE_BY_TYPE = {
    [ImageAnalysisType.ProductImage]: ImageSceneType.ProductShowcase,
    [ImageAnalysisType.LifestyleImage]: ImageSceneType.Lifestyle,
    [ImageAnalysisType.MarketingImage]: ImageSceneType.Promotional,
    [ImageAnalysisType.Logo]: ImageSceneType.Studio,
    [ImageAnalysisType.Banner]: ImageSceneType.Commercial,
    [ImageAnalysisType.Poster]: ImageSceneType.Promotional,
    [ImageAnalysisType.Screenshot]: ImageSceneType.Indoor,
    [ImageAnalysisType.Background]: ImageSceneType.BackgroundContext,
};
export class ImageUnderstandingAnalyzer {
    buildFromAnalysis(analysis, marketingGoal = ImageUnderstandingMarketingGoal.Conversion, platform = ImageUnderstandingPlatform.MultiPlatform, industry = "general") {
        const { technical, visual: visualMetrics, content, classification } = analysis;
        const brandName = analysis.relationships.relatedBrands[0] ?? content.logos[0] ?? "unknown-brand";
        const productName = content.products[0] ?? analysis.relationships.relatedProducts[0] ?? "";
        const identity = {
            imageId: analysis.imageId,
            imageName: technical.imageName,
            imageType: classification.imageType,
            analysisId: analysis.analysisId,
            visualSummary: `${classification.imageType} image featuring ${content.foreground} with ${classification.creativeStyle} style`,
        };
        const purpose = {
            primaryPurpose: this.inferPrimaryPurpose(classification, productName, brandName),
            intendedUse: classification.useCase,
            creativeIntent: `Communicate ${classification.creativeStyle} ${classification.category} narrative`,
            whyThisImageExists: `Support ${marketingGoal} goals for ${brandName} on ${platform}`,
        };
        const context = {
            visualContext: `${classification.creativeStyle} composition with ${visualMetrics.dominantColors.join(", ")} palette`,
            productContext: productName ? `Features ${productName} in ${content.background} setting` : "No primary product context",
            brandContext: `${brandName} brand presence with ${content.logos.length > 0 ? "logo visible" : "implicit branding"}`,
            marketingContext: `Aligned with ${marketingGoal} marketing objective for ${classification.category}`,
            creativeContext: `${classification.subcategory} creative direction for ${platform} distribution`,
        };
        const scene = this.buildSceneUnderstanding(analysis);
        const visual = this.buildVisualUnderstanding(analysis);
        const product = this.buildProductUnderstanding(analysis, productName);
        const brand = this.buildBrandUnderstanding(analysis, brandName);
        const marketing = this.buildMarketingUnderstanding(analysis, marketingGoal, industry, productName);
        const recommendations = this.buildRecommendations(analysis, brand, product, marketing);
        const keywords = [
            ...analysis.keywords,
            classification.imageType,
            classification.creativeStyle,
            scene.sceneType,
            marketingGoal,
            platform,
            industry,
        ].filter(Boolean);
        return { identity, purpose, context, scene, visual, product, brand, marketing, recommendations, keywords };
    }
    inferPrimaryPurpose(classification, product, brand) {
        if (classification.imageType === ImageAnalysisType.ProductImage && product) {
            return `Showcase ${product} for ${classification.useCase}`;
        }
        if (classification.imageType === ImageAnalysisType.LifestyleImage) {
            return `Present ${brand} lifestyle narrative for ${classification.useCase}`;
        }
        if (classification.imageType === ImageAnalysisType.Banner || classification.imageType === ImageAnalysisType.Poster) {
            return `Drive promotional engagement for ${brand}`;
        }
        return `Support ${classification.useCase} visual communication for ${brand}`;
    }
    buildSceneUnderstanding(analysis) {
        const { content, classification } = analysis;
        const sceneType = SCENE_BY_TYPE[classification.imageType] ?? ImageSceneType.Commercial;
        const bg = content.background.toLowerCase();
        let environment = "controlled";
        if (bg.includes("outdoor") || bg.includes("urban") || bg.includes("street"))
            environment = "outdoor";
        else if (bg.includes("studio") || bg.includes("white"))
            environment = "studio";
        else if (bg.includes("indoor"))
            environment = "indoor";
        const preparedScenes = [sceneType];
        if (environment === "studio")
            preparedScenes.push(ImageSceneType.Studio);
        if (classification.imageType === ImageAnalysisType.LifestyleImage)
            preparedScenes.push(ImageSceneType.Lifestyle);
        if (classification.imageType === ImageAnalysisType.ProductImage)
            preparedScenes.push(ImageSceneType.ProductShowcase);
        return {
            sceneType,
            environment,
            setting: content.background,
            mood: analysis.visual.saturation >= 70 ? "vibrant" : "balanced",
            sceneDescription: `${sceneType.replace(/-/g, " ")} scene in ${content.background} with ${content.foreground} focus`,
            preparedScenes: [...new Set(preparedScenes)],
        };
    }
    buildVisualUnderstanding(analysis) {
        const { content, visual, classification } = analysis;
        const mainSubject = content.foreground || content.products[0] || this.technicalFallback(analysis);
        return {
            mainSubject,
            secondarySubjects: [...content.objects, ...content.products.slice(1), ...content.shapes].slice(0, 5),
            foreground: content.foreground,
            background: content.background,
            composition: `${classification.creativeStyle} layout with ${visual.sharpness >= 75 ? "sharp" : "soft"} focus`,
            perspective: analysis.technical.orientation === "landscape" ? "wide-angle" : "standard",
            visualFocus: mainSubject,
            visualHierarchy: content.logos.length > 0 ? "brand-first" : "product-first",
        };
    }
    buildProductUnderstanding(analysis, productName) {
        const hasProduct = Boolean(productName) || analysis.content.products.length > 0;
        const visibility = hasProduct
            ? Math.min(100, 60 + analysis.visual.sharpness * 0.3 + (analysis.content.products.length > 0 ? 10 : 0))
            : 20;
        return {
            productVisibility: Math.round(visibility),
            productPosition: hasProduct ? "center-primary" : "not-applicable",
            productImportance: hasProduct ? "primary-subject" : "secondary",
            productContext: productName ? `${productName} presented in ${analysis.content.background}` : "no product focus",
            productPresentation: hasProduct ? `${analysis.classification.subcategory} presentation` : "absent",
            productReadiness: hasProduct && visibility >= 65 && analysis.scores.technicalQualityScore >= 60,
        };
    }
    buildBrandUnderstanding(analysis, brandName) {
        const logoPresence = analysis.content.logos.length > 0 || analysis.classification.imageType === ImageAnalysisType.Logo;
        const visibility = logoPresence
            ? Math.min(100, 70 + analysis.visual.contrast * 0.2)
            : brandName !== "unknown-brand"
                ? 55
                : 30;
        return {
            logoPresence,
            brandIdentity: brandName,
            brandVisibility: Math.round(visibility),
            brandConsistency: Math.min(100, analysis.scores.visualQualityScore + (logoPresence ? 10 : 0)),
            brandCommunication: logoPresence
                ? `${brandName} identity clearly communicated`
                : `Implicit ${brandName} brand context through visual style`,
        };
    }
    buildMarketingUnderstanding(analysis, goal, industry, productName) {
        const audience = industry === "technology"
            ? "creative professionals and marketing teams"
            : industry === "fashion"
                ? "style-conscious consumers"
                : industry === "beauty"
                    ? "beauty enthusiasts"
                    : "general audience";
        return {
            promotionalPurpose: `Drive ${goal} through ${analysis.classification.imageType.replace(/-/g, " ")}`,
            audienceRelevance: `Relevant to ${audience} seeking ${analysis.classification.useCase.replace(/-/g, " ")}`,
            marketingOpportunity: productName
                ? `Highlight ${productName} benefits in ${analysis.classification.category} campaigns`
                : `Strengthen brand narrative in ${analysis.classification.category}`,
            storytellingOpportunity: `Tell a ${analysis.classification.creativeStyle} story around ${analysis.content.foreground}`,
            ctaOpportunity: analysis.classification.imageType === ImageAnalysisType.Banner ||
                analysis.classification.imageType === ImageAnalysisType.Poster
                ? "Strong CTA placement in lower-third or overlay"
                : "Subtle CTA integration via product focus",
        };
    }
    buildRecommendations(analysis, brand, product, marketing) {
        const recs = [];
        if (!brand.logoPresence && brand.brandIdentity !== "unknown-brand") {
            recs.push({
                category: "branding",
                suggestion: "Consider adding brand logo for stronger identity recognition",
                priority: "medium",
                reason: "Logo not detected in image content preparation",
            });
        }
        if (product.productVisibility < 70 && product.productReadiness) {
            recs.push({
                category: "product",
                suggestion: "Increase product prominence in composition",
                priority: "high",
                reason: "Product visibility below optimal threshold",
            });
        }
        if (analysis.visual.sharpness < 70) {
            recs.push({
                category: "enhancement",
                suggestion: "Apply sharpening in enhancement planning phase",
                priority: "medium",
                reason: `Sharpness at ${analysis.visual.sharpness}`,
            });
        }
        if (marketing.ctaOpportunity.includes("Strong")) {
            recs.push({
                category: "marketing",
                suggestion: marketing.ctaOpportunity,
                priority: "high",
                reason: "Banner/poster format supports direct conversion CTA",
            });
        }
        recs.push({
            category: "creative",
            suggestion: `Leverage ${analysis.classification.creativeStyle} style for storyboard planning`,
            priority: "low",
            reason: "Creative readiness for downstream production",
        });
        return recs;
    }
    technicalFallback(analysis) {
        return analysis.technical.imageName;
    }
}
//# sourceMappingURL=image-understanding-analyzer.js.map