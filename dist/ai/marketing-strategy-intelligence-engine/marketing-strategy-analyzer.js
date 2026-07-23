import { AudiencePlatform } from "../audience-intelligence-engine/types.js";
import { MarketingObjective, StrategyMarketingPlatform, StrategyType, } from "./types.js";
const OBJECTIVE_STRATEGIES = {
    [MarketingObjective.BrandAwareness]: [
        StrategyType.Storytelling,
        StrategyType.Lifestyle,
        StrategyType.Emotional,
    ],
    [MarketingObjective.ProductPromotion]: [
        StrategyType.Promotional,
        StrategyType.Demonstration,
        StrategyType.ValueBased,
    ],
    [MarketingObjective.ProductLaunch]: [
        StrategyType.Storytelling,
        StrategyType.SocialProof,
        StrategyType.Demonstration,
    ],
    [MarketingObjective.SalesGrowth]: [
        StrategyType.Promotional,
        StrategyType.ProblemSolution,
        StrategyType.ValueBased,
    ],
    [MarketingObjective.CustomerEngagement]: [
        StrategyType.Emotional,
        StrategyType.Lifestyle,
        StrategyType.Educational,
    ],
    [MarketingObjective.CustomerRetention]: [
        StrategyType.SocialProof,
        StrategyType.Emotional,
        StrategyType.ValueBased,
    ],
    [MarketingObjective.LeadGeneration]: [
        StrategyType.Educational,
        StrategyType.ProblemSolution,
        StrategyType.Promotional,
    ],
    [MarketingObjective.EventPromotion]: [
        StrategyType.Promotional,
        StrategyType.Lifestyle,
        StrategyType.SocialProof,
    ],
    [MarketingObjective.BusinessPromotion]: [
        StrategyType.Storytelling,
        StrategyType.ValueBased,
        StrategyType.SocialProof,
    ],
    [MarketingObjective.ServicePromotion]: [
        StrategyType.Demonstration,
        StrategyType.ProblemSolution,
        StrategyType.Educational,
    ],
};
const INDUSTRY_STRATEGY_BOOST = {
    technology: [StrategyType.Demonstration, StrategyType.Educational],
    fashion: [StrategyType.Luxury, StrategyType.Lifestyle],
    beauty: [StrategyType.Lifestyle, StrategyType.Emotional],
    food: [StrategyType.Lifestyle, StrategyType.Storytelling],
    automotive: [StrategyType.Demonstration, StrategyType.Luxury],
};
const PLATFORM_BY_INDUSTRY = {
    technology: [StrategyMarketingPlatform.YouTube, StrategyMarketingPlatform.Website, StrategyMarketingPlatform.Facebook],
    fashion: [StrategyMarketingPlatform.Instagram, StrategyMarketingPlatform.TikTok, StrategyMarketingPlatform.Website],
    beauty: [StrategyMarketingPlatform.Instagram, StrategyMarketingPlatform.TikTok, StrategyMarketingPlatform.YouTube],
    food: [StrategyMarketingPlatform.Instagram, StrategyMarketingPlatform.Facebook, StrategyMarketingPlatform.TikTok],
    automotive: [StrategyMarketingPlatform.YouTube, StrategyMarketingPlatform.Website, StrategyMarketingPlatform.Facebook],
};
const AUDIENCE_PLATFORM_MAP = {
    [AudiencePlatform.TikTok]: StrategyMarketingPlatform.TikTok,
    [AudiencePlatform.Instagram]: StrategyMarketingPlatform.Instagram,
    [AudiencePlatform.Facebook]: StrategyMarketingPlatform.Facebook,
    [AudiencePlatform.YouTube]: StrategyMarketingPlatform.YouTube,
    [AudiencePlatform.WhatsApp]: StrategyMarketingPlatform.WhatsApp,
    [AudiencePlatform.Website]: StrategyMarketingPlatform.Website,
    [AudiencePlatform.Future]: StrategyMarketingPlatform.Future,
};
const STRATEGY_RATIONALE = {
    [StrategyType.Emotional]: "Connects with customer feelings and aspirations to build brand affinity",
    [StrategyType.Educational]: "Informs audience about product value and usage to build trust",
    [StrategyType.Promotional]: "Drives immediate action through offers and compelling calls-to-action",
    [StrategyType.Storytelling]: "Builds narrative around brand journey and customer transformation",
    [StrategyType.Demonstration]: "Shows product in action to prove capability and reduce purchase friction",
    [StrategyType.Luxury]: "Positions product as premium with refined aesthetics and exclusivity cues",
    [StrategyType.Lifestyle]: "Integrates product into aspirational daily life contexts",
    [StrategyType.SocialProof]: "Leverages testimonials, reviews, and user success to build credibility",
    [StrategyType.ValueBased]: "Highlights ROI, benefits, and cost-effectiveness for rational buyers",
    [StrategyType.ProblemSolution]: "Addresses specific pain points with clear product solutions",
};
export class MarketingStrategyAnalyzer {
    analyzeBusinessGoals(input, understanding, analysis) {
        const objective = input.marketingObjective;
        const brand = input.brandName ?? understanding.identity.brand;
        const product = understanding.identity.productName;
        const salesObjectives = this.buildSalesObjectives(objective, analysis);
        const marketingObjectives = this.buildMarketingObjectives(objective, product);
        const brandObjectives = this.buildBrandObjectives(objective, brand);
        const customerObjectives = this.buildCustomerObjectives(understanding);
        const growthObjectives = this.buildGrowthObjectives(objective, analysis);
        const communicationObjectives = this.buildCommunicationObjectives(objective, understanding);
        const overrides = input.businessGoals ?? {};
        return {
            salesObjectives: overrides.salesObjectives ?? salesObjectives,
            marketingObjectives: overrides.marketingObjectives ?? marketingObjectives,
            brandObjectives: overrides.brandObjectives ?? brandObjectives,
            customerObjectives: overrides.customerObjectives ?? customerObjectives,
            growthObjectives: overrides.growthObjectives ?? growthObjectives,
            communicationObjectives: overrides.communicationObjectives ?? communicationObjectives,
        };
    }
    buildAudienceAlignment(understanding, analysis, audienceIntelligence, preferredPlatforms) {
        if (audienceIntelligence?.validated) {
            return this.buildAudienceAlignmentFromIntelligence(audienceIntelligence, preferredPlatforms);
        }
        const industry = analysis.classification.industry;
        const platforms = preferredPlatforms ??
            PLATFORM_BY_INDUSTRY[industry] ??
            [StrategyMarketingPlatform.Website, StrategyMarketingPlatform.Instagram, StrategyMarketingPlatform.Email];
        const communicationStyle = this.inferCommunicationStyle(analysis.classification.businessType, industry);
        const needsCoverage = understanding.customer.customerNeeds.length;
        const interestsFromBenefits = understanding.customer.customerBenefits.slice(0, 4);
        const motivations = understanding.uniqueValue.customerMotivations;
        const alignmentScore = Math.min(100, 50 +
            needsCoverage * 8 +
            interestsFromBenefits.length * 5 +
            (motivations.length >= 2 ? 15 : 5));
        return {
            targetAudience: understanding.customer.targetCustomer,
            customerNeeds: understanding.customer.customerNeeds,
            customerInterests: interestsFromBenefits,
            buyingMotivation: motivations,
            preferredPlatforms: platforms,
            preferredCommunicationStyle: communicationStyle,
            alignmentScore,
        };
    }
    buildAudienceAlignmentFromIntelligence(audience, preferredPlatforms) {
        const mappedPlatforms = preferredPlatforms ??
            audience.profile.preferredPlatforms.map((p) => AUDIENCE_PLATFORM_MAP[p] ?? StrategyMarketingPlatform.Website);
        const alignmentScore = Math.min(100, Math.round((audience.scores.audienceRelevanceScore + audience.scores.communicationReadinessScore) / 2));
        return {
            targetAudience: audience.profile.audienceName,
            customerNeeds: audience.psychological.customerNeeds,
            customerInterests: audience.psychological.customerInterests,
            buyingMotivation: [
                audience.psychological.buyingIntent,
                ...audience.psychological.customerMotivation,
            ],
            preferredPlatforms: mappedPlatforms,
            preferredCommunicationStyle: audience.profile.preferredCommunicationStyle,
            alignmentScore,
        };
    }
    prepareCampaignDirection(objective, strategies, audience, understanding, campaignId) {
        const primary = strategies.find((s) => s.priority === "primary")?.strategyType ?? strategies[0]?.strategyType;
        const product = understanding.identity.productName;
        const campaignLabel = campaignId ? `campaign ${campaignId}` : `${objective.replace(/-/g, " ")} campaign`;
        const campaignFocus = `Drive ${objective.replace(/-/g, " ")} for ${product} targeting ${audience.targetAudience}`;
        const channelStrategy = `Prioritize ${audience.preferredPlatforms.slice(0, 3).join(", ")} with ${primary?.replace(/-/g, " ") ?? "primary"} strategy execution`;
        const messagingTheme = `${audience.preferredCommunicationStyle} messaging emphasizing ${audience.customerNeeds.slice(0, 2).join(" and ")}`;
        const timingGuidance = `Align ${campaignLabel} launch with ${audience.buyingMotivation[0] ?? "target buyer intent"} on primary channels`;
        const campaignReady = Boolean(primary) &&
            audience.preferredPlatforms.length >= 2 &&
            audience.customerNeeds.length >= 2 &&
            strategies.length >= 2;
        return {
            campaignFocus,
            channelStrategy,
            messagingTheme,
            timingGuidance,
            campaignReady,
        };
    }
    selectStrategies(objective, understanding, analysis) {
        const base = [...OBJECTIVE_STRATEGIES[objective]];
        const industryBoost = INDUSTRY_STRATEGY_BOOST[analysis.classification.industry] ?? [];
        const pricePremium = analysis.profile.price >= 150;
        const candidates = [...new Set([...base, ...industryBoost])];
        if (pricePremium && !candidates.includes(StrategyType.Luxury)) {
            candidates.push(StrategyType.Luxury);
        }
        const prioritized = candidates.slice(0, 5);
        const recommendations = [];
        for (let i = 0; i < prioritized.length; i++) {
            const strategyType = prioritized[i];
            const priority = i === 0 ? "primary" : i <= 2 ? "secondary" : "supporting";
            recommendations.push({
                strategyType,
                priority,
                rationale: this.buildRationale(strategyType, understanding, objective),
                expectedOutcome: this.buildExpectedOutcome(strategyType, objective),
            });
        }
        return recommendations;
    }
    prepareCreativeDirection(strategies, understanding, audience) {
        const primary = strategies.find((s) => s.priority === "primary")?.strategyType ?? strategies[0]?.strategyType;
        const product = understanding.identity.productName;
        const brand = understanding.identity.brand;
        const audienceLabel = audience.targetAudience;
        const storyboardDirection = primary
            ? `Develop a ${primary.replace(/-/g, " ")} storyboard featuring ${product} solving ${understanding.customer.customerPainPoints[0] ?? "key customer needs"} for ${audienceLabel}`
            : `Create narrative storyboard showcasing ${brand} product journey`;
        const scriptPlanningDirection = `Plan scripts emphasizing ${understanding.uniqueValue.keyBenefits.slice(0, 2).join(" and ")} with ${audience.preferredCommunicationStyle} tone on ${audience.preferredPlatforms[0] ?? "primary platform"}`;
        const visualPlanningDirection = `Design visuals aligned with ${primary ?? "brand"} strategy — highlight ${understanding.uniqueValue.uniqueSellingPoints[0] ?? "core features"} in ${understanding.context.whereUsed} contexts`;
        const audioPlanningDirection = `Select audio mood matching ${primary ?? "emotional"} strategy — ${analysisToneForStrategy(primary)} for ${audienceLabel}`;
        const productionPlanningDirection = `Schedule production for ${audience.preferredPlatforms.join(", ")} with focus on ${strategies.map((s) => s.strategyType).slice(0, 3).join(", ")} execution`;
        const readyBase = strategies.length >= 2 && audience.alignmentScore >= 60;
        return {
            storyboardDirection,
            scriptPlanningDirection,
            visualPlanningDirection,
            audioPlanningDirection,
            productionPlanningDirection,
            storyboardReady: readyBase && Boolean(primary),
            scriptPlanningReady: readyBase && understanding.purpose.primaryPurpose.length >= 15,
            visualPlanningReady: readyBase && understanding.uniqueValue.uniqueSellingPoints.length >= 1,
            audioPlanningReady: readyBase,
            productionPlanningReady: readyBase && audience.preferredPlatforms.length >= 2,
        };
    }
    buildSalesObjectives(objective, analysis) {
        const base = [`Increase ${analysis.profile.subcategory} sales`];
        if (objective === MarketingObjective.SalesGrowth) {
            base.push("Expand revenue by 15-25% in target period");
        }
        if (objective === MarketingObjective.ProductLaunch) {
            base.push("Achieve launch-week conversion targets");
        }
        if (objective === MarketingObjective.LeadGeneration) {
            base.push("Generate qualified sales leads");
        }
        return base;
    }
    buildMarketingObjectives(objective, product) {
        return [
            `Execute ${objective.replace(/-/g, " ")} campaign for ${product}`,
            "Maintain consistent messaging across channels",
            "Optimize campaign performance through audience insights",
        ];
    }
    buildBrandObjectives(objective, brand) {
        const objectives = [`Strengthen ${brand} brand positioning`];
        if (objective === MarketingObjective.BrandAwareness ||
            objective === MarketingObjective.BusinessPromotion) {
            objectives.push("Increase brand recall and recognition");
        }
        return objectives;
    }
    buildCustomerObjectives(understanding) {
        return [
            `Address needs of ${understanding.customer.targetCustomer}`,
            `Resolve ${understanding.customer.customerPainPoints[0] ?? "customer pain points"}`,
            "Deliver clear value communication",
        ];
    }
    buildGrowthObjectives(objective, analysis) {
        const objectives = [`Expand ${analysis.classification.industry} market presence`];
        if (objective === MarketingObjective.CustomerRetention) {
            objectives.push("Improve customer lifetime value");
        }
        if (objective === MarketingObjective.CustomerEngagement) {
            objectives.push("Increase engagement rate across touchpoints");
        }
        return objectives;
    }
    buildCommunicationObjectives(objective, understanding) {
        return [
            `Communicate ${understanding.identity.valueProposition}`,
            `Align messaging with ${objective.replace(/-/g, " ")} goals`,
            "Ensure brand-consistent creative direction",
        ];
    }
    inferCommunicationStyle(businessType, industry) {
        if (businessType === "b2b" || industry === "technology")
            return "professional and informative";
        if (industry === "fashion" || industry === "beauty")
            return "aspirational and visual-first";
        if (industry === "food")
            return "warm and sensory";
        return "clear and benefit-focused";
    }
    buildRationale(strategyType, understanding, objective) {
        const base = STRATEGY_RATIONALE[strategyType];
        return `${base} — supports ${objective.replace(/-/g, " ")} for ${understanding.customer.targetCustomer}`;
    }
    buildExpectedOutcome(strategyType, objective) {
        const outcomes = {
            [StrategyType.Emotional]: "Increased emotional connection and brand affinity",
            [StrategyType.Educational]: "Higher informed purchase intent",
            [StrategyType.Promotional]: "Improved conversion and short-term sales",
            [StrategyType.Storytelling]: "Stronger brand narrative and memorability",
            [StrategyType.Demonstration]: "Reduced purchase hesitation through proof",
            [StrategyType.Luxury]: "Premium perception and aspirational positioning",
            [StrategyType.Lifestyle]: "Lifestyle association and shareability",
            [StrategyType.SocialProof]: "Enhanced trust and credibility",
            [StrategyType.ValueBased]: "Clear ROI justification for buyers",
            [StrategyType.ProblemSolution]: "Direct pain-point resolution messaging",
        };
        return `${outcomes[strategyType] ?? "Improved campaign effectiveness"} aligned with ${objective.replace(/-/g, " ")}`;
    }
}
function analysisToneForStrategy(strategy) {
    switch (strategy) {
        case StrategyType.Luxury:
            return "refined, minimal, premium sound design";
        case StrategyType.Educational:
            return "clear narration with supportive background";
        case StrategyType.Emotional:
            return "warm, uplifting musical score";
        case StrategyType.Promotional:
            return "energetic, action-driving audio";
        default:
            return "brand-consistent audio identity";
    }
}
//# sourceMappingURL=marketing-strategy-analyzer.js.map