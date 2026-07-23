import { DetectedObjectType, ObjectPosition } from "../object-detection-intelligence-engine/types.js";
import { CompositionType, } from "./types.js";
export class CompositionAnalyzer {
    buildFromIntelligence(analysis, understanding, detection, background, industry) {
        const compositionType = this.inferCompositionType(understanding, detection, analysis);
        const productObj = detection.objects.find((o) => o.objectType === DetectedObjectType.Product);
        const isCenter = productObj?.position === ObjectPosition.Center || productObj?.position === ObjectPosition.FullFrame;
        const isRuleOfThirds = !isCenter && Boolean(productObj);
        const objectCount = detection.objects.length;
        const symmetry = this.computeSymmetry(isCenter, productObj?.position);
        const negativeSpace = this.computeNegativeSpace(detection, background);
        const compositionAnalysis = {
            compositionType,
            ruleOfThirds: isRuleOfThirds,
            centerComposition: isCenter,
            symmetry,
            asymmetry: Math.max(0, 100 - symmetry),
            balance: this.computeBalance(symmetry, negativeSpace, detection.productDetection.productVisibility),
            negativeSpace,
            positiveSpace: Math.max(0, 100 - negativeSpace),
            leadingLines: this.inferLeadingLines(understanding, compositionType),
            depth: understanding.visual.perspective.includes("wide") ? "deep" : background?.analysis.backgroundDepth ?? "moderate",
            perspective: understanding.visual.perspective,
            framing: this.inferFraming(analysis, understanding),
            cropping: this.inferCropping(analysis),
            spacing: objectCount <= 3 ? "generous" : objectCount <= 5 ? "balanced" : "dense",
        };
        const visualHierarchy = {
            mainSubjectVisibility: Math.min(100, detection.productDetection.productVisibility + 5),
            secondarySubjectVisibility: Math.min(100, understanding.visual.secondarySubjects.length * 18 + 30),
            productPriority: detection.productDetection.productVisibility,
            brandVisibility: detection.logoDetection.logoVisibility,
            ctaVisibility: detection.textDetection.textPresent ? 75 : 40,
            readingFlow: understanding.visual.visualHierarchy === "brand-first" ? "brand-to-product" : "product-to-brand",
        };
        const productPlacement = {
            productPosition: detection.productDetection.productPosition,
            productScale: productObj?.estimatedSize ?? "medium",
            productAlignment: isCenter ? "center-aligned" : "offset-aligned",
            productVisibility: detection.productDetection.productVisibility,
            productFocus: understanding.visual.visualFocus,
            productEmphasis: detection.productDetection.productImportance,
        };
        const suitability = this.buildSuitability(compositionAnalysis, visualHierarchy, productPlacement, understanding, analysis);
        const improvementPlan = this.buildImprovementPlan(compositionAnalysis, visualHierarchy, productPlacement);
        const recommendations = this.buildRecommendations(compositionAnalysis, visualHierarchy, productPlacement, suitability);
        const keywords = [
            ...analysis.keywords,
            ...understanding.keywords,
            compositionType,
            understanding.visual.visualHierarchy,
            industry ?? analysis.classification.category,
            analysis.classification.creativeStyle,
        ].filter(Boolean);
        return {
            compositionAnalysis,
            visualHierarchy,
            productPlacement,
            suitability,
            improvementPlan,
            recommendations,
            keywords,
        };
    }
    inferCompositionType(understanding, detection, analysis) {
        const productObj = detection.objects.find((o) => o.objectType === DetectedObjectType.Product);
        if (analysis.classification.creativeStyle === "editorial")
            return CompositionType.Asymmetry;
        if (productObj &&
            (productObj.position === ObjectPosition.Center || productObj.position === ObjectPosition.FullFrame)) {
            return CompositionType.Center;
        }
        if (detection.objects.length <= 2)
            return CompositionType.Minimal;
        if (understanding.visual.visualHierarchy === "brand-first")
            return CompositionType.Symmetry;
        if (productObj)
            return CompositionType.RuleOfThirds;
        if (detection.objects.length > 4)
            return CompositionType.Layered;
        return CompositionType.Dynamic;
    }
    computeSymmetry(isCenter, position) {
        if (isCenter || position === ObjectPosition.Center)
            return 88;
        if (position === ObjectPosition.TopLeft || position === ObjectPosition.TopRight)
            return 62;
        return 72;
    }
    computeNegativeSpace(detection, background) {
        let space = 50;
        if (detection.objects.length <= 3)
            space += 20;
        if (background?.analysis.backgroundComplexity === "minimal")
            space += 15;
        if (background?.quality.backgroundDistraction)
            space -= Math.min(20, background.quality.backgroundDistraction * 0.3);
        return Math.max(15, Math.min(95, Math.round(space)));
    }
    computeBalance(symmetry, negativeSpace, productVisibility) {
        return Math.round((symmetry + negativeSpace + productVisibility) / 3);
    }
    inferLeadingLines(understanding, type) {
        if (type === CompositionType.RuleOfThirds)
            return "diagonal-product-focus";
        if (understanding.scene.environment.includes("urban"))
            return "street-perspective-lines";
        return understanding.visual.composition.includes("sharp") ? "converging-focus" : "subtle-directional";
    }
    inferFraming(analysis, understanding) {
        if (analysis.technical.orientation === "portrait")
            return "vertical-tight-frame";
        if (analysis.classification.imageType === "banner")
            return "wide-horizontal-frame";
        return `${understanding.scene.sceneType}-frame`;
    }
    inferCropping(analysis) {
        const ratio = analysis.technical.aspectRatio;
        if (ratio.includes("16:9") || ratio.includes("1.78"))
            return "widescreen-safe-crop";
        if (ratio.includes("1:1") || ratio.includes("1.00"))
            return "square-crop-ready";
        return "standard-crop-flexible";
    }
    buildSuitability(comp, hierarchy, placement, understanding, analysis) {
        const base = Math.round((comp.balance + hierarchy.productPriority + placement.productVisibility) / 3);
        const clamp = (v) => Math.max(0, Math.min(100, v));
        const centerBoost = comp.centerComposition ? 10 : 0;
        const thirdsBoost = comp.ruleOfThirds ? 8 : 0;
        return {
            productShowcase: clamp(base + centerBoost + (placement.productVisibility > 75 ? 10 : 0)),
            advertisement: clamp(base + understanding.scores.marketingReadinessScore * 0.15 + centerBoost),
            socialMedia: clamp(base + thirdsBoost + (comp.negativeSpace > 50 ? 8 : 0)),
            poster: clamp(base + comp.symmetry * 0.1 + hierarchy.brandVisibility * 0.05),
            banner: clamp(base + (analysis.classification.imageType === "banner" ? 15 : 0) + thirdsBoost),
            thumbnail: clamp(base + centerBoost - (comp.spacing === "dense" ? 12 : 0)),
            videoProduction: clamp(base + (comp.depth === "deep" ? 8 : 0) - (hierarchy.ctaVisibility < 50 ? 5 : 0)),
        };
    }
    buildImprovementPlan(comp, hierarchy, placement) {
        const needsReposition = !comp.centerComposition && placement.productVisibility < 70;
        const needsBalance = comp.balance < 65;
        return {
            cropStrategy: comp.cropping === "widescreen-safe-crop"
                ? "Plan safe-zone crop preserving product and brand elements"
                : "Maintain current crop ratios — composition supports planned formats",
            repositionStrategy: needsReposition
                ? "Plan product reposition toward center or rule-of-thirds power point"
                : "Product position optimal — no reposition planning required",
            balanceStrategy: needsBalance
                ? "Plan negative space redistribution for visual balance"
                : `Balance at ${comp.balance}% — maintain current spatial arrangement`,
            focusStrategy: hierarchy.mainSubjectVisibility < 75
                ? "Plan focus enhancement on main subject without image modification"
                : "Main subject focus sufficient for creative production",
            framingStrategy: `Preserve ${comp.framing} with ${comp.perspective} perspective consistency`,
            visualHierarchyStrategy: hierarchy.readingFlow === "product-to-brand"
                ? "Plan hierarchy: product first, brand reinforcement second"
                : "Plan hierarchy: brand anchor first, product support second",
        };
    }
    buildRecommendations(comp, hierarchy, placement, suitability) {
        const recs = [];
        if (comp.balance < 65) {
            recs.push({
                category: "balance",
                suggestion: "Adjust spatial balance through planned repositioning or cropping",
                priority: "high",
                reason: `Visual balance at ${comp.balance}%`,
            });
        }
        if (hierarchy.mainSubjectVisibility < 70) {
            recs.push({
                category: "hierarchy",
                suggestion: "Elevate main subject visibility in composition hierarchy",
                priority: "high",
                reason: `Main subject visibility ${hierarchy.mainSubjectVisibility}%`,
            });
        }
        if (placement.productVisibility < 70) {
            recs.push({
                category: "placement",
                suggestion: "Increase product scale or reposition for stronger emphasis",
                priority: "medium",
                reason: `Product visibility ${placement.productVisibility}%`,
            });
        }
        if (suitability.socialMedia < 60) {
            recs.push({
                category: "marketing",
                suggestion: "Optimize composition for social media square and vertical formats",
                priority: "medium",
                reason: `Social media suitability ${suitability.socialMedia}%`,
            });
        }
        if (hierarchy.ctaVisibility < 55 && comp.negativeSpace < 40) {
            recs.push({
                category: "framing",
                suggestion: "Reserve negative space for CTA placement in planned crops",
                priority: "medium",
                reason: "Limited CTA visibility and negative space",
            });
        }
        recs.push({
            category: "creative",
            suggestion: "Composition intelligence ready for enhancement and video production planning",
            priority: "low",
            reason: `${comp.compositionType} composition with ${comp.balance}% balance`,
        });
        return recs;
    }
}
//# sourceMappingURL=composition-analyzer.js.map