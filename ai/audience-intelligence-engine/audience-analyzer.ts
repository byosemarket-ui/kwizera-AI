import type { ProductAnalysisIntelligenceRecord } from "../product-analysis-engine/types.js";
import { ProductBusinessType } from "../product-analysis-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import { ProductUnderstandingMarketingGoal } from "../product-understanding-engine/types.js";
import {
  AudienceCategory,
  AudienceDemographics,
  AudienceIntelligenceInput,
  AudienceMarketingPreparation,
  AudiencePlatform,
  AudienceProfile,
  AudienceSegmentation,
  PsychologicalUnderstanding,
} from "./types.js";

const INDUSTRY_PLATFORM_MAP: Record<string, AudiencePlatform[]> = {
  technology: [AudiencePlatform.YouTube, AudiencePlatform.Website, AudiencePlatform.Facebook],
  fashion: [AudiencePlatform.Instagram, AudiencePlatform.TikTok, AudiencePlatform.Website],
  beauty: [AudiencePlatform.Instagram, AudiencePlatform.TikTok, AudiencePlatform.YouTube],
  food: [AudiencePlatform.Instagram, AudiencePlatform.Facebook, AudiencePlatform.TikTok],
  hospitality: [AudiencePlatform.Instagram, AudiencePlatform.Facebook, AudiencePlatform.Website],
  automotive: [AudiencePlatform.YouTube, AudiencePlatform.Website, AudiencePlatform.Facebook],
  education: [AudiencePlatform.YouTube, AudiencePlatform.Website, AudiencePlatform.WhatsApp],
  health: [AudiencePlatform.Website, AudiencePlatform.Facebook, AudiencePlatform.YouTube],
  creative: [AudiencePlatform.Instagram, AudiencePlatform.YouTube, AudiencePlatform.TikTok],
  general: [AudiencePlatform.Website, AudiencePlatform.Instagram, AudiencePlatform.Facebook],
};

const BUSINESS_TYPE_CATEGORY: Record<string, AudienceCategory> = {
  [ProductBusinessType.B2B]: AudienceCategory.B2BProfessional,
  [ProductBusinessType.B2C]: AudienceCategory.B2CConsumer,
  [ProductBusinessType.D2C]: AudienceCategory.D2CDirect,
  [ProductBusinessType.Enterprise]: AudienceCategory.Enterprise,
  [ProductBusinessType.Marketplace]: AudienceCategory.Marketplace,
  [ProductBusinessType.Subscription]: AudienceCategory.Subscription,
};

const BUYING_INTENT_BY_GOAL: Record<ProductUnderstandingMarketingGoal, string> = {
  [ProductUnderstandingMarketingGoal.Conversion]: "high purchase intent — ready to evaluate and buy",
  [ProductUnderstandingMarketingGoal.Awareness]: "discovery intent — learning about options",
  [ProductUnderstandingMarketingGoal.Engagement]: "exploration intent — seeking interaction and content",
  [ProductUnderstandingMarketingGoal.Retention]: "loyalty intent — existing customer relationship",
  [ProductUnderstandingMarketingGoal.Launch]: "early adoption intent — interested in new offerings",
  [ProductUnderstandingMarketingGoal.Education]: "research intent — gathering information before decision",
};

export class AudienceAnalyzer {
  buildProfile(
    input: AudienceIntelligenceInput,
    understanding: ProductUnderstandingRecord,
    analysis: ProductAnalysisIntelligenceRecord
  ): AudienceProfile {
    const marketingGoal = input.marketingGoal ?? understanding.marketingGoal;
    const audienceId = input.audienceId ?? `audience-${input.productId}`;
    const audienceName =
      input.audienceName ??
      (understanding.customer.targetCustomer ||
        `Audience for ${understanding.identity.productName}`);

    const industry = analysis.classification.industry;
    const platforms =
      input.preferredPlatforms ??
      INDUSTRY_PLATFORM_MAP[industry] ??
      INDUSTRY_PLATFORM_MAP.general;

    return {
      audienceId,
      audienceName,
      audienceCategory:
        BUSINESS_TYPE_CATEGORY[analysis.classification.businessType] ?? AudienceCategory.General,
      industry,
      productCategory: analysis.profile.category,
      preferredLanguage: input.preferredLanguage ?? input.demographics?.language,
      preferredCommunicationStyle: this.inferCommunicationStyle(
        analysis.classification.businessType,
        industry
      ),
      preferredPlatforms: platforms,
      marketingGoal,
    };
  }

  buildDemographics(
    input: AudienceIntelligenceInput,
    analysis: ProductAnalysisIntelligenceRecord
  ): AudienceDemographics {
    const demographics: AudienceDemographics = {
      businessType: analysis.classification.businessType,
      customerType: analysis.classification.targetCustomer,
    };

    if (input.demographics?.ageGroup) {
      demographics.ageGroup = input.demographics.ageGroup;
    }
    if (input.demographics?.region) {
      demographics.region = input.demographics.region;
    }
    if (input.preferredLanguage) {
      demographics.language = input.preferredLanguage;
    } else if (input.demographics?.language) {
      demographics.language = input.demographics.language;
    }

    return demographics;
  }

  buildPsychologicalUnderstanding(
    understanding: ProductUnderstandingRecord,
    marketingGoal: ProductUnderstandingMarketingGoal
  ): PsychologicalUnderstanding {
    const customerGoals = this.deriveCustomerGoals(understanding);
    const customerInterests = this.deriveCustomerInterests(understanding);

    return {
      customerNeeds: [...understanding.customer.customerNeeds],
      customerGoals,
      customerInterests,
      customerChallenges: [...understanding.customer.customerPainPoints],
      customerMotivation: [...understanding.uniqueValue.customerMotivations],
      buyingIntent: BUYING_INTENT_BY_GOAL[marketingGoal],
      decisionFactors: this.deriveDecisionFactors(understanding),
    };
  }

  buildSegmentation(
    understanding: ProductUnderstandingRecord,
    analysis: ProductAnalysisIntelligenceRecord,
    psychological: PsychologicalUnderstanding,
    profile: AudienceProfile
  ): AudienceSegmentation {
    const businessGoals = [
      `Serve ${analysis.classification.targetCustomer}`,
      `Address ${analysis.classification.useCase.replace(/-/g, " ")} needs`,
    ];

    const marketingObjectives = [
      `${profile.marketingGoal} for ${understanding.identity.productName}`,
      `Reach ${profile.audienceCategory.replace(/-/g, " ")} segment`,
    ];

    const communicationPreferences = [
      profile.preferredCommunicationStyle,
      `Primary platforms: ${profile.preferredPlatforms.join(", ")}`,
    ];
    if (profile.preferredLanguage) {
      communicationPreferences.push(`Language: ${profile.preferredLanguage}`);
    }

    return {
      productType: `${analysis.profile.category}/${analysis.profile.subcategory}`,
      industry: analysis.classification.industry,
      customerNeeds: psychological.customerNeeds,
      businessGoals,
      marketingObjectives,
      communicationPreferences,
    };
  }

  buildMarketingPreparation(
    profile: AudienceProfile,
    psychological: PsychologicalUnderstanding,
    segmentation: AudienceSegmentation
  ): AudienceMarketingPreparation {
    const grounded =
      psychological.customerNeeds.length >= 2 &&
      psychological.customerChallenges.length >= 1 &&
      profile.preferredPlatforms.length >= 1;

    return {
      marketingStrategyReady: grounded && psychological.decisionFactors.length >= 2,
      creativeDirectionReady: grounded && psychological.customerInterests.length >= 1,
      storyboardReady: grounded && segmentation.communicationPreferences.length >= 2,
      scriptPlanningReady: grounded && Boolean(profile.preferredCommunicationStyle),
      visualPlanningReady: grounded && profile.preferredPlatforms.length >= 2,
      productionPlanningReady:
        grounded &&
        profile.preferredPlatforms.length >= 2 &&
        segmentation.marketingObjectives.length >= 1,
    };
  }

  private inferCommunicationStyle(businessType: string, industry: string): string {
    if (businessType === ProductBusinessType.B2B || businessType === ProductBusinessType.Enterprise) {
      return "professional and evidence-based";
    }
    if (businessType === ProductBusinessType.D2C) {
      return "direct and benefit-focused";
    }
    if (industry === "fashion" || industry === "beauty") {
      return "visual-first and aspirational";
    }
    if (industry === "technology" || industry === "education") {
      return "informative and clear";
    }
    return "clear and customer-centric";
  }

  private deriveCustomerGoals(understanding: ProductUnderstandingRecord): string[] {
    const goals: string[] = [];
    if (understanding.purpose.primaryPurpose) {
      goals.push(`Achieve outcomes through ${understanding.purpose.mainFunction}`);
    }
    for (const expectation of understanding.customer.customerExpectations.slice(0, 2)) {
      goals.push(expectation);
    }
    return goals.filter(Boolean);
  }

  private deriveCustomerInterests(understanding: ProductUnderstandingRecord): string[] {
    const interests = [
      ...understanding.customer.customerBenefits.slice(0, 3),
      ...understanding.uniqueValue.uniqueSellingPoints.slice(0, 2),
    ];
    return [...new Set(interests)].filter(Boolean);
  }

  private deriveDecisionFactors(understanding: ProductUnderstandingRecord): string[] {
    const factors = [
      ...understanding.customer.customerExpectations,
      ...understanding.uniqueValue.reasonsToBuy.slice(0, 3),
      ...understanding.uniqueValue.competitiveAdvantages.slice(0, 2),
    ];
    return [...new Set(factors)].filter(Boolean).slice(0, 6);
  }
}
