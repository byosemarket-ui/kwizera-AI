import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import { CreativePlatform } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import { StrategyType } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import {
  ContinuityCheck,
  PlatformStoryboardRules,
  ScenePlan,
  StoryboardIntelligenceInput,
  StoryboardProfile,
  StoryFlow,
  TimingIntelligence,
} from "./types.js";

const PLATFORM_SCENE_CONFIG: Record<
  CreativePlatform,
  { sceneCount: number; totalSeconds: number; sceneDuration: string }
> = {
  [CreativePlatform.TikTok]: { sceneCount: 6, totalSeconds: 45, sceneDuration: "5-8s" },
  [CreativePlatform.InstagramReels]: { sceneCount: 7, totalSeconds: 60, sceneDuration: "6-10s" },
  [CreativePlatform.Facebook]: { sceneCount: 8, totalSeconds: 90, sceneDuration: "8-12s" },
  [CreativePlatform.YouTubeShorts]: { sceneCount: 6, totalSeconds: 50, sceneDuration: "5-9s" },
  [CreativePlatform.YouTube]: { sceneCount: 10, totalSeconds: 120, sceneDuration: "10-15s" },
  [CreativePlatform.WhatsAppStatus]: { sceneCount: 5, totalSeconds: 45, sceneDuration: "7-10s" },
  [CreativePlatform.Website]: { sceneCount: 8, totalSeconds: 90, sceneDuration: "8-12s" },
};

interface SceneBlueprint {
  purpose: string;
  flowKey: keyof StoryFlow;
  productFocusLevel: "none" | "intro" | "hero" | "feature" | "cta";
  emotionalBeat: string;
  includeCta: boolean;
}

const BASE_SCENE_SEQUENCE: SceneBlueprint[] = [
  { purpose: "opening", flowKey: "opening", productFocusLevel: "none", emotionalBeat: "attention", includeCta: false },
  { purpose: "hook", flowKey: "hook", productFocusLevel: "none", emotionalBeat: "curiosity", includeCta: false },
  { purpose: "product-introduction", flowKey: "productIntroduction", productFocusLevel: "intro", emotionalBeat: "interest", includeCta: false },
  { purpose: "feature-presentation", flowKey: "featurePresentation", productFocusLevel: "feature", emotionalBeat: "desire", includeCta: false },
  { purpose: "benefit-demonstration", flowKey: "benefitDemonstration", productFocusLevel: "hero", emotionalBeat: "confidence", includeCta: false },
  { purpose: "customer-value", flowKey: "customerValue", productFocusLevel: "hero", emotionalBeat: "trust", includeCta: false },
  { purpose: "social-proof", flowKey: "socialProof", productFocusLevel: "feature", emotionalBeat: "validation", includeCta: false },
  { purpose: "offer-presentation", flowKey: "offerPresentation", productFocusLevel: "hero", emotionalBeat: "urgency", includeCta: false },
  { purpose: "call-to-action", flowKey: "callToAction", productFocusLevel: "cta", emotionalBeat: "action", includeCta: true },
  { purpose: "ending", flowKey: "ending", productFocusLevel: "intro", emotionalBeat: "resolution", includeCta: false },
];

export class StoryboardAnalyzer {
  buildProfile(
    input: StoryboardIntelligenceInput,
    creative: CreativeDirectionRecord,
    version: number
  ): StoryboardProfile {
    const config = PLATFORM_SCENE_CONFIG[creative.profile.platform];
    const storyboardId = input.storyboardId ?? `storyboard-${input.productId}-${creative.profile.platform}`;

    return {
      storyboardId,
      projectId: input.projectId ?? creative.projectId,
      product: creative.profile.product,
      brand: creative.profile.brand,
      campaignGoal: creative.profile.campaignGoal,
      targetAudience: creative.profile.targetAudience,
      platform: creative.profile.platform,
      storyboardVersion: version,
      totalScenes: config.sceneCount,
      estimatedDuration: `${config.totalSeconds} seconds`,
      creativeStyle: creative.profile.creativeStyle,
    };
  }

  buildStoryFlow(
    creative: CreativeDirectionRecord,
    understanding: ProductUnderstandingRecord,
    strategy: MarketingStrategyRecord,
    includeSocialProof: boolean
  ): StoryFlow {
    const product = understanding.identity.productName;
    const brand = understanding.identity.brand;
    const benefit = understanding.uniqueValue.keyBenefits[0] ?? "core benefit";
    const feature = understanding.uniqueValue.uniqueSellingPoints[0] ?? "key feature";
    const pain = understanding.customer.customerPainPoints[0] ?? "customer challenge";
    const hasSocialProof = includeSocialProof ||
      strategy.selectedStrategies.some((s) => s.strategyType === StrategyType.SocialProof);

    return {
      opening: `Establish ${creative.profile.mood} atmosphere for ${brand}`,
      hook: creative.marketingDirection.hookDirection,
      productIntroduction: `Introduce ${product} as solution to ${pain}`,
      featurePresentation: `Highlight ${feature} — ${creative.marketingDirection.productPresentation}`,
      benefitDemonstration: `Demonstrate ${benefit} for ${creative.profile.targetAudience}`,
      customerValue: `Connect value: ${understanding.identity.valueProposition}`,
      socialProof: hasSocialProof
        ? `Present trust signals and customer validation for ${brand}`
        : "N/A — social proof not required for this campaign",
      offerPresentation: strategy.campaignDirection.messagingTheme,
      callToAction: creative.marketingDirection.callToActionPlacement,
      ending: creative.marketingDirection.closingStrategy,
    };
  }

  buildScenes(
    profile: StoryboardProfile,
    storyFlow: StoryFlow,
    creative: CreativeDirectionRecord,
    understanding: ProductUnderstandingRecord,
    includeSocialProof: boolean
  ): ScenePlan[] {
    const config = PLATFORM_SCENE_CONFIG[profile.platform];
    let blueprints = [...BASE_SCENE_SEQUENCE];

    if (!includeSocialProof && !storyFlow.socialProof.startsWith("Present")) {
      blueprints = blueprints.filter((b) => b.purpose !== "social-proof");
    }

    const selected = this.selectScenesForPlatform(blueprints, config.sceneCount);
    const secondsPerScene = Math.round(config.totalSeconds / selected.length);

    return selected.map((bp, index) => {
      const sceneNum = index + 1;
      const isFirst = sceneNum === 1;
      const isLast = sceneNum === selected.length;
      const flowText = storyFlow[bp.flowKey];

      return {
        sceneNumber: sceneNum,
        scenePurpose: bp.purpose,
        estimatedDuration: `${secondsPerScene}s`,
        visualObjective: flowText,
        productFocus: this.productFocusText(bp.productFocusLevel, understanding.identity.productName),
        cameraDirection: this.cameraForBeat(bp.emotionalBeat, creative),
        backgroundStyle: creative.visualDirection.backgroundStyle,
        lightingDirection: creative.visualDirection.lightingStyle,
        composition: creative.visualDirection.compositionStyle,
        motionDirection: creative.cinematicDirection.motionStyle,
        transitionIn: isFirst ? "fade-in from black" : creative.cinematicDirection.transitionStyle,
        transitionOut: isLast ? "fade-to-brand-lockup" : creative.cinematicDirection.transitionStyle,
        textPlacement: bp.includeCta ? "lower-third CTA overlay" : sceneNum <= 2 ? "minimal top-safe text" : "subtitle lower-third",
        subtitleArea: "bottom 20% safe zone",
        ctaPlacement: bp.includeCta ? creative.marketingDirection.callToActionPlacement : "none",
        emotionalGoal: `${bp.emotionalBeat} — ${creative.profile.emotionalDirection}`,
      };
    });
  }

  buildPlatformRules(creative: CreativeDirectionRecord): PlatformStoryboardRules {
    const config = PLATFORM_SCENE_CONFIG[creative.profile.platform];
    const platformDir = creative.platformDirections.find((p) => p.platform === creative.profile.platform);

    return {
      platform: creative.profile.platform,
      recommendedSceneCount: config.sceneCount,
      maxDuration: platformDir?.durationGuidance ?? `${config.totalSeconds} seconds`,
      pacingRules: platformDir?.platformOptimizations ?? ["platform-native pacing"],
      sceneDurationGuidance: config.sceneDuration,
    };
  }

  buildTiming(scenes: ScenePlan[], profile: StoryboardProfile): TimingIntelligence {
    const config = PLATFORM_SCENE_CONFIG[profile.platform];
    const sceneTiming: Record<number, string> = {};
    let cumulative = 0;

    for (const scene of scenes) {
      const seconds = parseInt(scene.estimatedDuration, 10) || 8;
      sceneTiming[scene.sceneNumber] = `${cumulative}s - ${cumulative + seconds}s`;
      cumulative += seconds;
    }

    const hookScene = scenes.find((s) => s.scenePurpose === "hook");
    const ctaScene = scenes.find((s) => s.scenePurpose === "call-to-action");
    const endingScene = scenes.find((s) => s.scenePurpose === "ending");

    return {
      sceneTiming,
      transitionTiming: "0.5-1.5s between scenes",
      hookTiming: hookScene ? sceneTiming[hookScene.sceneNumber] ?? "0-5s" : "0-3s",
      ctaTiming: ctaScene ? sceneTiming[ctaScene.sceneNumber] ?? "final 10s" : "final 5s",
      endingTiming: endingScene ? sceneTiming[endingScene.sceneNumber] ?? "final scene" : "final 5s",
      totalEstimatedSeconds: config.totalSeconds,
    };
  }

  checkContinuity(
    scenes: ScenePlan[],
    creative: CreativeDirectionRecord,
    understanding: ProductUnderstandingRecord
  ): ContinuityCheck {
    const issues: string[] = [];
    const recommendations: string[] = [];
    const product = understanding.identity.productName;
    const brand = creative.profile.brand;

    const sceneConsistent = scenes.every((s, i) => s.sceneNumber === i + 1);
    if (!sceneConsistent) issues.push("Scene numbering sequence broken");

    const brandConsistent = scenes.every(
      (s) =>
        s.backgroundStyle === scenes[0].backgroundStyle ||
        s.scenePurpose === "ending"
    );
    if (!brandConsistent) {
      issues.push("Background style inconsistency across scenes");
      recommendations.push(`Maintain ${creative.visualDirection.backgroundStyle} across all scenes`);
    }

    const creativeConsistent = scenes.every((s) => s.emotionalGoal.length >= 15);

    const productScenes = scenes.filter((s) =>
      [
        "product-introduction",
        "feature-presentation",
        "benefit-demonstration",
        "customer-value",
        "offer-presentation",
        "call-to-action",
      ].includes(s.scenePurpose)
    );
    const productConsistent =
      productScenes.length >= 3 && productScenes.every((s) => s.productFocus.includes(product));
    if (!productConsistent) {
      issues.push("Product focus insufficient across storyboard");
      recommendations.push(`Feature ${product} in at least 3 hero scenes`);
    }

    const purposes = scenes.map((s) => s.scenePurpose);
    const hasHook = purposes.includes("hook");
    const hasCta = purposes.includes("call-to-action");
    const hasEnding = purposes.includes("ending");
    const storyConsistent = hasHook && hasCta && hasEnding && purposes.indexOf("hook") < purposes.indexOf("call-to-action");
    if (!storyConsistent) {
      issues.push("Story flow sequence invalid — hook must precede CTA");
      recommendations.push("Reorder scenes: opening → hook → product → benefits → CTA → ending");
    }

    const allBrandColors = creative.brandDirection.brandColors.join(", ");
    if (scenes.length > 0 && !scenes[0].visualObjective.includes(brand) && !scenes[0].visualObjective.includes(product)) {
      recommendations.push(`Scene 1 should reference ${brand} or ${product} for brand anchoring`);
    }
    void allBrandColors;

    return {
      sceneConsistency: sceneConsistent,
      brandConsistency: brandConsistent,
      creativeConsistency: creativeConsistent || recommendations.length === 0,
      productConsistency: productConsistent,
      storyConsistency: storyConsistent,
      issues,
      recommendations,
    };
  }

  private selectScenesForPlatform(blueprints: SceneBlueprint[], targetCount: number): SceneBlueprint[] {
    const required = ["opening", "hook", "product-introduction", "benefit-demonstration", "call-to-action", "ending"];
    const selected: SceneBlueprint[] = [];

    for (const purpose of required) {
      const bp = blueprints.find((b) => b.purpose === purpose);
      if (bp) selected.push(bp);
    }

    const optional = blueprints.filter((b) => !required.includes(b.purpose));
    for (const bp of optional) {
      if (selected.length >= targetCount) break;
      if (!selected.some((s) => s.purpose === bp.purpose)) selected.push(bp);
    }

    return selected
      .sort((a, b) => BASE_SCENE_SEQUENCE.indexOf(a) - BASE_SCENE_SEQUENCE.indexOf(b))
      .slice(0, targetCount);
  }

  private productFocusText(level: SceneBlueprint["productFocusLevel"], product: string): string {
    switch (level) {
      case "none":
        return "environment and audience context — no product";
      case "intro":
        return `introduce ${product}`;
      case "hero":
        return `${product} as hero element`;
      case "feature":
        return `${product} feature close-up`;
      case "cta":
        return `${product} with CTA overlay`;
      default:
        return product;
    }
  }

  private cameraForBeat(beat: string, creative: CreativeDirectionRecord): string {
    const base = creative.cinematicDirection.cameraStyle;
    const movement = creative.cinematicDirection.cameraMovement;
    if (beat === "attention" || beat === "curiosity") return `dynamic close-up — ${movement}`;
    if (beat === "action") return `direct address — ${base}`;
    return `${base} — ${creative.cinematicDirection.framingStyle}`;
  }
}
