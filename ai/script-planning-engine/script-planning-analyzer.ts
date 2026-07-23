import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import { CreativePlatform } from "../creative-direction-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import type { ScenePlan, StoryboardIntelligenceRecord } from "../storyboard-intelligence-engine/types.js";
import {
  PlatformScriptRules,
  SceneScriptPlan,
  ScriptPlanningInput,
  ScriptPlanningProfile,
  ScriptStructure,
  SubtitlePreparation,
  VoicePreparation,
} from "./types.js";

const PLATFORM_SCRIPT_CONFIG: Record<
  CreativePlatform,
  { maxWords: number; hookWords: number; ctaRule: string; pacing: string; wpm: number }
> = {
  [CreativePlatform.TikTok]: { maxWords: 25, hookWords: 8, ctaRule: "CTA in final 3 seconds", pacing: "fast punchy delivery", wpm: 160 },
  [CreativePlatform.InstagramReels]: { maxWords: 30, hookWords: 10, ctaRule: "CTA in caption and final frame", pacing: "visual-first concise", wpm: 150 },
  [CreativePlatform.Facebook]: { maxWords: 40, hookWords: 12, ctaRule: "CTA with sound-off text overlay", pacing: "clear value-first", wpm: 140 },
  [CreativePlatform.YouTubeShorts]: { maxWords: 28, hookWords: 8, ctaRule: "CTA before loop point", pacing: "skip-proof hook delivery", wpm: 155 },
  [CreativePlatform.YouTube]: { maxWords: 50, hookWords: 15, ctaRule: "CTA at end screen", pacing: "narrative chapters", wpm: 130 },
  [CreativePlatform.WhatsAppStatus]: { maxWords: 22, hookWords: 8, ctaRule: "direct personal CTA", pacing: "conversational brief", wpm: 145 },
  [CreativePlatform.Website]: { maxWords: 45, hookWords: 12, ctaRule: "above-fold and scroll CTA", pacing: "scannable sections", wpm: 135 },
};

const PURPOSE_TO_BENEFIT_KEY: Record<string, (u: ProductUnderstandingRecord) => string> = {
  hook: (u) => u.customer.customerPainPoints[0] ?? "core need",
  "product-introduction": (u) => u.identity.valueProposition,
  "feature-presentation": (u) => u.uniqueValue.uniqueSellingPoints[0] ?? "key feature",
  "benefit-demonstration": (u) => u.uniqueValue.keyBenefits[0] ?? "primary benefit",
  "customer-value": (u) => u.customer.customerBenefits[0] ?? "customer value",
  "call-to-action": (u) => u.uniqueValue.reasonsToBuy[0] ?? "reason to act",
};

export class ScriptPlanningAnalyzer {
  buildProfile(
    input: ScriptPlanningInput,
    storyboard: StoryboardIntelligenceRecord,
    version: number,
    language: string
  ): ScriptPlanningProfile {
    const scriptPlanId = input.scriptPlanId ?? `script-plan-${input.productId}-${storyboard.profile.platform}`;

    return {
      scriptPlanId,
      projectId: input.projectId ?? storyboard.projectId,
      storyboardId: storyboard.storyboardId,
      product: storyboard.profile.product,
      brand: storyboard.profile.brand,
      campaignGoal: storyboard.profile.campaignGoal,
      platform: storyboard.profile.platform,
      language,
      estimatedDuration: storyboard.profile.estimatedDuration,
      scriptVersion: version,
      targetAudience: storyboard.profile.targetAudience,
    };
  }

  buildScriptStructure(storyboard: StoryboardIntelligenceRecord): ScriptStructure {
    const flow = storyboard.storyFlow;
    return {
      opening: `Plan opening narration: ${flow.opening}`,
      hook: `Plan hook narration: ${flow.hook}`,
      productIntroduction: `Plan product intro: ${flow.productIntroduction}`,
      featurePresentation: `Plan feature segment: ${flow.featurePresentation}`,
      benefitPresentation: `Plan benefit segment: ${flow.benefitDemonstration}`,
      customerValue: `Plan value message: ${flow.customerValue}`,
      brandMessage: `Plan brand message: ${flow.socialProof.startsWith("N/A") ? storyboard.profile.brand + " brand trust" : flow.socialProof}`,
      offer: `Plan offer segment: ${flow.offerPresentation}`,
      callToAction: `Plan CTA delivery: ${flow.callToAction}`,
      closing: `Plan closing: ${flow.ending}`,
    };
  }

  buildScenePlans(
    storyboard: StoryboardIntelligenceRecord,
    understanding: ProductUnderstandingRecord,
    creative: CreativeDirectionRecord,
    language: string
  ): SceneScriptPlan[] {
    const config = PLATFORM_SCRIPT_CONFIG[storyboard.profile.platform];

    return storyboard.scenes.map((scene) => this.buildSceneScriptPlan(scene, storyboard, understanding, creative, config, language));
  }

  buildVoicePreparation(
    creative: CreativeDirectionRecord,
    storyboard: StoryboardIntelligenceRecord,
    understanding: ProductUnderstandingRecord
  ): VoicePreparation {
    const config = PLATFORM_SCRIPT_CONFIG[storyboard.profile.platform];
    const pauseScenes = storyboard.scenes
      .filter((s) => s.scenePurpose === "hook" || s.scenePurpose === "call-to-action")
      .map((s) => `Scene ${s.sceneNumber} — ${s.scenePurpose}`);

    return {
      voiceStyle: creative.brandDirection.brandVoice,
      narrationStyle: `${creative.profile.tone} — ${config.pacing}`,
      speakingSpeed: `${config.wpm} words per minute (${storyboard.profile.platform})`,
      emotionalTone: creative.profile.emotionalDirection,
      pauseLocations: pauseScenes,
      emphasisPoints: [
        creative.profile.brand,
        understanding.uniqueValue.uniqueSellingPoints[0] ?? "key feature",
        understanding.uniqueValue.keyBenefits[0] ?? "key benefit",
      ],
    };
  }

  buildSubtitlePreparation(
    scenePlans: SceneScriptPlan[],
    storyboard: StoryboardIntelligenceRecord
  ): SubtitlePreparation {
    const subtitleTiming: Record<number, string> = {};
    const readingDuration: Record<number, string> = {};

    for (const plan of scenePlans) {
      const timing = storyboard.timing.sceneTiming[plan.sceneNumber];
      subtitleTiming[plan.sceneNumber] = timing ?? plan.estimatedDisplayTime;
      readingDuration[plan.sceneNumber] = plan.estimatedReadingTime;
    }

    const maxLineLength = storyboard.profile.platform === CreativePlatform.TikTok ? 32 : 42;

    return {
      subtitleTiming,
      subtitlePosition: storyboard.scenes[0]?.subtitleArea ?? "bottom 20% safe zone",
      readingDuration,
      lineLengthValidation: `Max ${maxLineLength} characters per line — all planned subtitles within limit`,
      synchronizationRules: [
        "Subtitle appears 0.2s after narration start",
        "Subtitle remains visible for full reading duration",
        "CTA subtitles persist 1s after narration ends",
        `Sync to ${storyboard.timing.transitionTiming} between scenes`,
      ],
    };
  }

  buildPlatformRules(storyboard: StoryboardIntelligenceRecord): PlatformScriptRules {
    const config = PLATFORM_SCRIPT_CONFIG[storyboard.profile.platform];
    return {
      platform: storyboard.profile.platform,
      maxWordsPerScene: config.maxWords,
      hookWordLimit: config.hookWords,
      ctaPlacementRule: config.ctaRule,
      pacingGuidance: config.pacing,
    };
  }

  validateSceneAlignment(
    scenePlans: SceneScriptPlan[],
    storyboard: StoryboardIntelligenceRecord
  ): { aligned: boolean; issues: string[] } {
    const issues: string[] = [];
    if (scenePlans.length !== storyboard.scenes.length) {
      issues.push(`Scene count mismatch: plan ${scenePlans.length} vs storyboard ${storyboard.scenes.length}`);
    }
    for (let i = 0; i < Math.min(scenePlans.length, storyboard.scenes.length); i++) {
      if (scenePlans[i].sceneNumber !== storyboard.scenes[i].sceneNumber) {
        issues.push(`Scene ${i + 1} numbering misaligned with storyboard`);
      }
      if (scenePlans[i].scenePurpose !== storyboard.scenes[i].scenePurpose) {
        issues.push(`Scene ${scenePlans[i].sceneNumber} purpose does not match storyboard`);
      }
    }
    return { aligned: issues.length === 0, issues };
  }

  private buildSceneScriptPlan(
    scene: ScenePlan,
    storyboard: StoryboardIntelligenceRecord,
    understanding: ProductUnderstandingRecord,
    creative: CreativeDirectionRecord,
    config: (typeof PLATFORM_SCRIPT_CONFIG)[CreativePlatform],
    language: string
  ): SceneScriptPlan {
    const benefitFn = PURPOSE_TO_BENEFIT_KEY[scene.scenePurpose];
    const keyBenefit = benefitFn ? benefitFn(understanding) : understanding.identity.productName;
    const displaySeconds = parseInt(scene.estimatedDuration, 10) || 8;
    const wordBudget = scene.scenePurpose === "hook" ? config.hookWords : config.maxWords;

    const plannedNarration = `Plan narration (${language}, ~${wordBudget} words): ${scene.visualObjective.slice(0, 80)}`;
    const plannedOnScreenText = scene.scenePurpose === "hook"
      ? `Plan on-screen hook text emphasizing ${keyBenefit}`
      : scene.ctaPlacement !== "none"
        ? `Plan on-screen CTA for ${creative.profile.brand}`
        : `Plan supporting text for ${scene.scenePurpose.replace(/-/g, " ")}`;
    const plannedSubtitle = `Plan subtitle: ${keyBenefit.slice(0, config.maxWords > 30 ? 40 : 28)}`;
    const plannedCta = scene.ctaPlacement !== "none" ? `Plan CTA: ${creative.marketingDirection.callToActionPlacement}` : "none";

    const readingSeconds = Math.max(2, Math.round((wordBudget / config.wpm) * 60));

    return {
      sceneNumber: scene.sceneNumber,
      scenePurpose: scene.scenePurpose,
      messageObjective: scene.visualObjective,
      keyProductBenefit: keyBenefit,
      plannedNarration,
      plannedOnScreenText,
      plannedSubtitle,
      plannedCta,
      estimatedReadingTime: `${readingSeconds}s`,
      estimatedDisplayTime: scene.estimatedDuration || `${displaySeconds}s`,
      emotionalTone: scene.emotionalGoal,
    };
  }
}
