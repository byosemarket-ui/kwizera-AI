import { ProductUnderstandingMarketingGoal, } from "./types.js";
const INDUSTRY_CONTEXT = {
    technology: {
        whereUsed: "office, studio, remote workspaces",
        howUsed: "daily creative and marketing workflows",
        whenUsed: "during content production and campaign planning",
    },
    fashion: {
        whereUsed: "urban environments, travel, daily commute",
        howUsed: "worn as everyday outerwear",
        whenUsed: "seasonal transitions and outdoor activities",
    },
    beauty: {
        whereUsed: "home skincare routines, bathroom vanity",
        howUsed: "applied morning and evening skincare regimen",
        whenUsed: "daily self-care and pre-event preparation",
    },
};
export class ProductUnderstandingAnalyzer {
    buildFromAnalysis(analysis, marketingGoal = ProductUnderstandingMarketingGoal.Conversion) {
        const { profile, classification, marketingPreparation: analysisMarketing } = analysis;
        const identity = {
            productId: analysis.productId,
            productName: profile.productName,
            brand: profile.brand,
            category: profile.category,
            subcategory: profile.subcategory,
            valueProposition: `${profile.productName} delivers ${profile.features[0] ?? "quality"} for ${classification.targetCustomer}`,
        };
        const purpose = {
            primaryPurpose: this.inferPrimaryPurpose(profile.description, classification.useCase),
            mainFunction: profile.features[0] ?? "core product function",
            secondaryFunctions: profile.features.slice(1, 4),
            whyItExists: `To solve ${classification.useCase.replace(/-/g, " ")} challenges for ${classification.targetCustomer}`,
        };
        const customer = {
            targetCustomer: classification.targetCustomer,
            targetIndustry: classification.industry,
            customerNeeds: this.inferCustomerNeeds(profile, classification),
            customerPainPoints: this.inferPainPoints(classification.industry, profile),
            customerBenefits: this.inferBenefits(profile),
            customerExpectations: this.inferExpectations(classification.businessType),
            customerSegments: [classification.targetCustomer, `${classification.industry}-buyers`],
        };
        const valueAnalysis = this.analyzeValue(profile, analysis.scores.dataQualityScore, classification);
        const uniqueValue = {
            uniqueSellingPoints: profile.features.slice(0, 3),
            competitiveAdvantages: [
                `${profile.brand} brand trust`,
                profile.features.length >= 2 ? "multi-feature advantage" : "focused specialization",
                profile.price > 0 ? `value at ${profile.currency} ${profile.price}` : "accessible pricing",
            ],
            premiumFeatures: profile.features.filter((f) => f.includes("premium") || f.includes("AI") || f.includes("pro")),
            keyBenefits: this.inferBenefits(profile),
            customerMotivations: this.inferMotivations(classification, marketingGoal),
            reasonsToBuy: [
                `Solves ${customer.customerPainPoints[0] ?? "customer needs"}`,
                `Trusted by ${classification.targetCustomer}`,
                `${profile.brand} quality and reliability`,
            ],
        };
        const industryDefaults = INDUSTRY_CONTEXT[classification.industry] ?? {};
        const context = {
            whereUsed: industryDefaults.whereUsed ?? `${classification.useCase} environments`,
            howUsed: industryDefaults.howUsed ?? `through ${classification.useCase}`,
            whenUsed: industryDefaults.whenUsed ?? "as needed by target customers",
            whoUsesIt: classification.targetCustomer,
            whyCustomersChoose: `${profile.brand} reputation, ${profile.features[0] ?? "quality"}, and ${classification.useCase} fit`,
            typicalPurchasingSituations: this.inferPurchasingSituations(classification.businessType, marketingGoal),
        };
        const marketingPreparation = this.buildMarketingPreparation(analysisMarketing, customer, valueAnalysis);
        return { identity, purpose, customer, valueAnalysis, uniqueValue, context, marketingPreparation };
    }
    inferPrimaryPurpose(description, useCase) {
        if (description.length >= 30)
            return description.slice(0, 120);
        return `Enable ${useCase.replace(/-/g, " ")} for target customers`;
    }
    inferCustomerNeeds(profile, classification) {
        return [
            `quality ${profile.subcategory}`,
            `reliable ${classification.useCase.replace(/-/g, " ")}`,
            `${profile.brand} brand alignment`,
            profile.price > 100 ? "professional-grade performance" : "affordable quality",
        ];
    }
    inferPainPoints(industry, profile) {
        const map = {
            technology: ["slow workflows", "inconsistent brand output", "fragmented tools"],
            fashion: ["lack of style durability", "poor weather protection", "generic branding"],
            beauty: ["dull skin", "aging signs", "inconsistent skincare results"],
        };
        return map[industry] ?? [`limited ${profile.subcategory} options`, "quality concerns"];
    }
    inferBenefits(profile) {
        return profile.features.map((f) => `Benefit: ${f.replace(/-/g, " ")}`);
    }
    inferExpectations(businessType) {
        return [
            "reliable product quality",
            businessType === "b2b" ? "enterprise support" : "easy purchase experience",
            "clear value for money",
        ];
    }
    analyzeValue(profile, dataQuality, classification) {
        const base = Math.min(100, Math.max(50, dataQuality));
        return {
            functionalValue: Math.min(100, base + profile.features.length * 3),
            emotionalValue: classification.industry === "fashion" || classification.industry === "beauty" ? base + 10 : base,
            practicalValue: Math.min(100, base + (profile.specifications ? 5 : 0)),
            commercialValue: profile.price > 0 ? Math.min(100, base + 8) : base - 10,
            brandValue: Math.min(100, base + (profile.brand !== "Unknown Brand" ? 12 : 0)),
            marketValue: Math.min(100, base + (classification.businessType === "b2b" ? 10 : 5)),
        };
    }
    inferMotivations(classification, goal) {
        const base = [`achieve ${classification.useCase.replace(/-/g, " ")} goals`];
        if (goal === ProductUnderstandingMarketingGoal.Conversion)
            base.push("make confident purchase decision");
        if (goal === ProductUnderstandingMarketingGoal.Awareness)
            base.push("discover trusted brands");
        return base;
    }
    inferPurchasingSituations(businessType, goal) {
        const situations = ["online research and comparison", "brand website purchase"];
        if (businessType === "b2b")
            situations.push("team evaluation and procurement");
        if (goal === ProductUnderstandingMarketingGoal.Launch)
            situations.push("product launch campaigns");
        return situations;
    }
    buildMarketingPreparation(analysisMarketing, customer, value) {
        const prepared = [];
        const gaps = [];
        if (customer.customerNeeds.length >= 2)
            prepared.push("audience-needs");
        else
            gaps.push("audience-needs");
        if (value.commercialValue >= 60)
            prepared.push("commercial-value");
        else
            gaps.push("commercial-value");
        const audienceReady = customer.customerSegments.length > 0 && customer.customerPainPoints.length > 0;
        const strategyReady = analysisMarketing.marketingStrategyReady && value.marketValue >= 60;
        const creativeReady = analysisMarketing.creativeDirectionReady && value.brandValue >= 60;
        return {
            audienceIntelligenceReady: audienceReady,
            marketingStrategyReady: strategyReady,
            creativeDirectionReady: creativeReady,
            storyboardReady: analysisMarketing.storyboardReady,
            scriptPlanningReady: analysisMarketing.scriptPlanningReady,
            visualPlanningReady: analysisMarketing.visualPlanningReady,
            productionPlanningReady: strategyReady && creativeReady,
            preparedModules: prepared,
            gaps,
        };
    }
}
//# sourceMappingURL=product-understanding-analyzer.js.map