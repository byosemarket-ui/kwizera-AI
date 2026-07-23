import type { AiProductIntelligenceFoundation } from "../product-intelligence-foundation/product-intelligence-foundation.js";
import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import { CreativePlatform } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import type { StoryboardIntelligenceRecord } from "../storyboard-intelligence-engine/types.js";
import type { ScriptPlanningRecord } from "../script-planning-engine/types.js";
import type { VisualPlanningRecord } from "../visual-planning-engine/types.js";
import type { AudioPlanningRecord } from "../audio-planning-engine/types.js";
import {
  AssetManagement,
  DependencyValidation,
  ExportPreparation,
  PlannedAsset,
  PlatformProductionRules,
  ProductionPlanningInput,
  ProductionPlanningProfile,
  ProductionWorkflow,
  RecoveryPlan,
  RenderPreparation,
  SceneProductionPlan,
} from "./types.js";

const PLATFORM_RENDER_CONFIG: Record<
  CreativePlatform,
  { resolution: string; aspectRatio: string; frameRate: string; maxDuration: string; bitrate: string; primaryFormat: string }
> = {
  [CreativePlatform.TikTok]: { resolution: "1080x1920", aspectRatio: "9:16", frameRate: "30fps", maxDuration: "60s", bitrate: "8Mbps", primaryFormat: "mp4" },
  [CreativePlatform.InstagramReels]: { resolution: "1080x1920", aspectRatio: "9:16", frameRate: "30fps", maxDuration: "90s", bitrate: "8Mbps", primaryFormat: "mp4" },
  [CreativePlatform.Facebook]: { resolution: "1080x1080", aspectRatio: "1:1", frameRate: "30fps", maxDuration: "120s", bitrate: "6Mbps", primaryFormat: "mp4" },
  [CreativePlatform.YouTubeShorts]: { resolution: "1080x1920", aspectRatio: "9:16", frameRate: "30fps", maxDuration: "60s", bitrate: "10Mbps", primaryFormat: "mp4" },
  [CreativePlatform.YouTube]: { resolution: "1920x1080", aspectRatio: "16:9", frameRate: "30fps", maxDuration: "600s", bitrate: "12Mbps", primaryFormat: "mp4" },
  [CreativePlatform.WhatsAppStatus]: { resolution: "1080x1920", aspectRatio: "9:16", frameRate: "30fps", maxDuration: "30s", bitrate: "5Mbps", primaryFormat: "mp4" },
  [CreativePlatform.Website]: { resolution: "1920x1080", aspectRatio: "16:9", frameRate: "30fps", maxDuration: "180s", bitrate: "10Mbps", primaryFormat: "webm" },
};

function plannedAsset(assetId: string, assetType: string, description: string, source: string, required = true): PlannedAsset {
  return { assetId, assetType, description, source, status: "planned", required };
}

export class ProductionPlanningAnalyzer {
  buildProfile(
    input: ProductionPlanningInput,
    storyboard: StoryboardIntelligenceRecord,
    scriptPlan: ScriptPlanningRecord,
    visualPlan: VisualPlanningRecord,
    audioPlan: AudioPlanningRecord,
    version: number
  ): ProductionPlanningProfile {
    const productionPlanId = input.productionPlanId ?? `production-plan-${input.productId}-${storyboard.profile.platform}`;

    return {
      productionPlanId,
      projectId: input.projectId ?? storyboard.projectId,
      storyboardId: storyboard.storyboardId,
      scriptPlanId: scriptPlan.scriptPlanId,
      visualPlanId: visualPlan.visualPlanId,
      audioPlanId: audioPlan.audioPlanId,
      product: storyboard.profile.product,
      brand: storyboard.profile.brand,
      campaignGoal: storyboard.profile.campaignGoal,
      platform: storyboard.profile.platform,
      productionVersion: version,
    };
  }

  buildWorkflow(
    storyboard: StoryboardIntelligenceRecord,
    scriptPlan: ScriptPlanningRecord,
    visualPlan: VisualPlanningRecord,
    audioPlan: AudioPlanningRecord
  ): ProductionWorkflow {
    return {
      preProduction: `Plan pre-production — validate ${storyboard.scenes.length} scenes across storyboard, script, visual and audio plans`,
      assetValidation: "Plan asset validation — verify all required asset slots before render queue",
      scenePreparation: `Plan scene preparation — ${storyboard.scenes.length} scenes staged for sequential production`,
      visualPreparation: `Plan visual preparation — ${visualPlan.scenePlans.length} visual instructions from visual plan ${visualPlan.visualPlanId}`,
      audioPreparation: `Plan audio preparation — voice, music and sfx from audio plan ${audioPlan.audioPlanId}`,
      renderingPreparation: `Plan rendering — ${storyboard.profile.estimatedDuration} total duration on ${storyboard.profile.platform}`,
      exportPreparation: `Plan export — platform-optimized deliverables for ${storyboard.profile.platform}`,
      deliveryPreparation: `Plan delivery — ${scriptPlan.profile.campaignGoal} campaign assets for ${storyboard.profile.brand}`,
    };
  }

  buildAssetManagement(
    storyboard: StoryboardIntelligenceRecord,
    scriptPlan: ScriptPlanningRecord,
    visualPlan: VisualPlanningRecord,
    audioPlan: AudioPlanningRecord,
    creative: CreativeDirectionRecord
  ): AssetManagement {
    const brand = creative.profile.brand;
    const sceneCount = storyboard.scenes.length;

    return {
      images: [plannedAsset(`img-product-${storyboard.productId}`, "image", `Product imagery for ${storyboard.profile.product}`, visualPlan.visualPlanId)],
      logos: [plannedAsset(`logo-${brand}`, "logo", `Brand logo — ${creative.brandDirection.logoPlacement}`, creative.creativeId)],
      fonts: [plannedAsset(`font-${brand}`, "font", `Typography — ${creative.visualDirection.typographyStyle}`, creative.creativeId)],
      icons: visualPlan.scenePlans.filter((s) => s.iconPlacement !== "none").map((s, i) =>
        plannedAsset(`icon-scene-${s.sceneNumber}`, "icon", s.iconPlacement, visualPlan.visualPlanId)
      ),
      videos: Array.from({ length: sceneCount }, (_, i) =>
        plannedAsset(`video-scene-${i + 1}`, "video", `Scene ${i + 1} video segment`, storyboard.storyboardId)
      ),
      audio: [plannedAsset(`audio-mix-${audioPlan.audioPlanId}`, "audio", "Mixed audio track", audioPlan.audioPlanId)],
      music: [plannedAsset(`music-${audioPlan.audioPlanId}`, "music", audioPlan.musicPlanning.backgroundMusic, audioPlan.audioPlanId)],
      voiceOver: scriptPlan.scenePlans.map((s) =>
        plannedAsset(`vo-scene-${s.sceneNumber}`, "voice-over", s.plannedNarration, scriptPlan.scriptPlanId)
      ),
      backgrounds: visualPlan.scenePlans.map((s) =>
        plannedAsset(`bg-scene-${s.sceneNumber}`, "background", s.backgroundStyle, visualPlan.visualPlanId)
      ),
      templates: [plannedAsset(`template-${storyboard.profile.platform}`, "template", `Platform template for ${storyboard.profile.platform}`, visualPlan.visualPlanId)],
      animations: visualPlan.scenePlans.map((s) =>
        plannedAsset(`anim-scene-${s.sceneNumber}`, "animation", s.motionDirection, visualPlan.visualPlanId)
      ),
      effects: visualPlan.scenePlans.map((s) =>
        plannedAsset(`fx-scene-${s.sceneNumber}`, "effect", s.visualEffectsPlan, visualPlan.visualPlanId)
      ),
      subtitles: scriptPlan.scenePlans.map((s) =>
        plannedAsset(`sub-scene-${s.sceneNumber}`, "subtitle", s.plannedSubtitle, scriptPlan.scriptPlanId)
      ),
      captions: scriptPlan.scenePlans.filter((s) => s.plannedOnScreenText.length > 5).map((s) =>
        plannedAsset(`caption-scene-${s.sceneNumber}`, "caption", s.plannedOnScreenText, scriptPlan.scriptPlanId)
      ),
    };
  }

  buildDependencyValidation(
    foundation: AiProductIntelligenceFoundation,
    storyboard: StoryboardIntelligenceRecord,
    scriptPlan: ScriptPlanningRecord,
    visualPlan: VisualPlanningRecord,
    audioPlan: AudioPlanningRecord,
    creative: CreativeDirectionRecord,
    strategy: MarketingStrategyRecord,
    understanding: ProductUnderstandingRecord
  ): DependencyValidation {
    const issues: string[] = [];
    const recommendations: string[] = [];

    const storyboardOk = storyboard.validated && storyboard.productionReady;
    const scriptOk = scriptPlan.validated && scriptPlan.productionReady;
    const visualOk = visualPlan.validated && visualPlan.productionReady;
    const audioOk = audioPlan.validated && audioPlan.productionReady;
    const creativeOk = creative.validated;
    const strategyOk = strategy.validated;
    const productIntelOk = understanding.validated;
    const brandKnowledgeOk = creative.relationships.knowledgeRecords.length > 0 || Boolean(creative.profile.brand);
    const languageKnowledgeOk = Boolean(scriptPlan.profile.language);
    const memoryOk = Boolean(foundation.getRegistry().getModule("product-analysis-engine")?.implemented);
    const knowledgeOk =
      storyboard.relationships.knowledgeRecords.length > 0 ||
      scriptPlan.relationships.knowledgeRecords.length > 0;

    if (!storyboardOk) issues.push("Storyboard not production-ready");
    if (!scriptOk) issues.push("Script plan not production-ready");
    if (!visualOk) issues.push("Visual plan not production-ready");
    if (!audioOk) issues.push("Audio plan not production-ready");
    if (!creativeOk) issues.push("Creative direction not validated");
    if (!strategyOk) issues.push("Marketing strategy not validated");
    if (!productIntelOk) issues.push("Product intelligence not validated");

    if (issues.length > 0) {
      recommendations.push("Complete and validate all upstream planning modules before production");
    }

    return {
      storyboard: storyboardOk,
      scriptPlan: scriptOk,
      visualPlan: visualOk,
      audioPlan: audioOk,
      creativeDirection: creativeOk,
      marketingStrategy: strategyOk,
      productIntelligence: productIntelOk,
      brandKnowledge: brandKnowledgeOk,
      languageKnowledge: languageKnowledgeOk,
      memory: memoryOk,
      knowledge: knowledgeOk,
      issues,
      recommendations,
    };
  }

  buildRenderPreparation(storyboard: StoryboardIntelligenceRecord): RenderPreparation {
    const config = PLATFORM_RENDER_CONFIG[storyboard.profile.platform];
    return {
      resolution: config.resolution,
      aspectRatio: config.aspectRatio,
      frameRate: config.frameRate,
      videoDuration: storyboard.profile.estimatedDuration,
      exportQuality: "high — platform-optimized",
      renderingPriority: storyboard.profile.platform === CreativePlatform.TikTok ? "high" : "normal",
      compressionStrategy: `H.264/H.265 at ${config.bitrate} for ${storyboard.profile.platform}`,
      outputFormat: config.primaryFormat,
    };
  }

  buildExportPreparation(storyboard: StoryboardIntelligenceRecord): ExportPreparation {
    const platform = storyboard.profile.platform;
    return {
      mp4: `Plan MP4 export — primary deliverable for ${platform} at ${PLATFORM_RENDER_CONFIG[platform].resolution}`,
      mov: "Plan MOV export — proRes proxy for editing pipeline",
      webm: platform === CreativePlatform.Website ? "Plan WEBM export — primary web deliverable" : "Plan WEBM export — optional web fallback",
      gif: platform === CreativePlatform.WhatsAppStatus ? "Plan GIF export — status preview variant" : "Plan GIF export — social preview snippet",
      imageSequence: "Plan image sequence export — frame-by-frame for compositing",
      additionalFormats: ["Plan HLS stream manifest", "Plan thumbnail JPEG set"],
    };
  }

  buildRecoveryPlan(productionPlanId: string): RecoveryPlan {
    return {
      checkpointStrategy: `Plan checkpoints after each scene render — ${productionPlanId}`,
      rollbackSteps: [
        "Restore last validated planning snapshot",
        "Re-validate upstream storyboard, script, visual and audio plans",
        "Resume from last successful scene checkpoint",
      ],
      retryPolicy: "Plan retry — 3 attempts per scene with exponential backoff",
      failureRecovery: "Plan failure recovery — isolate failed scene, preserve completed assets",
      dataPreservation: "Plan data preservation — versioned production state with traceable history",
    };
  }

  buildPlatformRules(storyboard: StoryboardIntelligenceRecord): PlatformProductionRules {
    const config = PLATFORM_RENDER_CONFIG[storyboard.profile.platform];
    return {
      platform: storyboard.profile.platform,
      primaryFormat: config.primaryFormat,
      maxDuration: config.maxDuration,
      recommendedBitrate: config.bitrate,
      deliveryGuidance: `Optimize for ${storyboard.profile.platform} — ${config.aspectRatio} at ${config.resolution}`,
    };
  }

  buildSceneProductionPlans(
    storyboard: StoryboardIntelligenceRecord,
    scriptPlan: ScriptPlanningRecord,
    visualPlan: VisualPlanningRecord,
    audioPlan: AudioPlanningRecord
  ): SceneProductionPlan[] {
    return storyboard.scenes.map((scene, index) => {
      const scriptScene = scriptPlan.scenePlans[index];
      const visualScene = visualPlan.scenePlans[index];
      const audioScene = audioPlan.sceneAudioPlans[index];

      return {
        sceneNumber: scene.sceneNumber,
        scenePurpose: scene.scenePurpose,
        renderInstructions: `Plan render scene ${scene.sceneNumber} — ${PLATFORM_RENDER_CONFIG[storyboard.profile.platform].resolution}, ${scene.estimatedDuration}`,
        assetDependencies: [
          `video-scene-${scene.sceneNumber}`,
          `bg-scene-${scene.sceneNumber}`,
          `vo-scene-${scene.sceneNumber}`,
          `sub-scene-${scene.sceneNumber}`,
        ],
        visualInstructions: visualScene?.composition ?? scene.composition,
        audioInstructions: audioScene?.plannedVoiceOver ?? scriptScene?.plannedNarration ?? "Plan audio mix",
        exportNotes: `Plan export segment ${scene.sceneNumber} — ${scene.transitionOut} transition`,
      };
    });
  }

  validateAlignment(
    sceneProductionPlans: SceneProductionPlan[],
    storyboard: StoryboardIntelligenceRecord,
    scriptPlan: ScriptPlanningRecord,
    visualPlan: VisualPlanningRecord,
    audioPlan: AudioPlanningRecord
  ): { aligned: boolean; issues: string[] } {
    const issues: string[] = [];

    if (sceneProductionPlans.length !== storyboard.scenes.length) {
      issues.push(`Scene count mismatch: production ${sceneProductionPlans.length} vs storyboard ${storyboard.scenes.length}`);
    }
    if (scriptPlan.storyboardId !== storyboard.storyboardId) issues.push("Script plan storyboard mismatch");
    if (visualPlan.storyboardId !== storyboard.storyboardId) issues.push("Visual plan storyboard mismatch");
    if (audioPlan.storyboardId !== storyboard.storyboardId) issues.push("Audio plan storyboard mismatch");
    if (visualPlan.scriptPlanId !== scriptPlan.scriptPlanId) issues.push("Visual/script plan mismatch");
    if (audioPlan.scriptPlanId !== scriptPlan.scriptPlanId) issues.push("Audio/script plan mismatch");
    if (audioPlan.visualPlanId !== visualPlan.visualPlanId) issues.push("Audio/visual plan mismatch");

    return { aligned: issues.length === 0, issues };
  }

  getAllRequiredAssets(assets: AssetManagement): PlannedAsset[] {
    return [
      ...assets.images,
      ...assets.logos,
      ...assets.fonts,
      ...assets.videos,
      ...assets.audio,
      ...assets.music,
      ...assets.voiceOver,
      ...assets.backgrounds,
      ...assets.templates,
      ...assets.subtitles,
    ].filter((a) => a.required);
  }
}
