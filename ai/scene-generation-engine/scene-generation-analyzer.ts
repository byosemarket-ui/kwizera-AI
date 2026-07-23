import type { StoryboardGenerationRecord } from "../story-generation-engine/types.js";
import type { GeneratedScene, GeneratedShot } from "../story-generation-engine/types.js";
import {
  CameraAngle,
  CameraMovement,
  CharacterPlanning,
  ObjectPlanning,
  PLATFORM_SCENE_CONFIG,
  SCENE_PLATFORM_TARGETS,
  SceneAudioPlanning,
  SceneGenerationProfile,
  SceneGenerationRecord,
  ScenePlatformOptimization,
  SceneShot,
  SceneStructure,
  SceneType,
  StoryboardGenerationPlatform,
  TransitionPlanning,
  VisualGenerationPlan,
  mapPurposeToPriority,
  mapPurposeToSceneType,
} from "./types.js";

export class SceneGenerationAnalyzer {
  buildSceneRecord(
    storyboard: StoryboardGenerationRecord,
    sourceScene: GeneratedScene,
    version: number
  ): Omit<SceneGenerationRecord, "scores" | "relationships" | "recommendations" | "validated" | "productionReady" | "marketingReady" | "brandConsistent" | "createdAt" | "lastUpdated"> {
    const profile = this.buildProfile(storyboard, sourceScene, version);
    const structure = this.buildStructure(sourceScene);
    const shots = this.buildShots(sourceScene);
    const visualPlan = this.buildVisualPlan(storyboard, sourceScene);
    const characterPlanning = this.buildCharacterPlanning(sourceScene, storyboard);
    const objectPlanning = this.buildObjectPlanning(sourceScene, storyboard);
    const audioPlanning = this.buildAudioPlanning(storyboard, sourceScene);
    const transitionPlanning = this.buildTransitionPlanning(sourceScene, storyboard);
    const cameraPlanning = this.buildCameraPlanning(shots);
    const motionPlanning = this.buildMotionPlanning(sourceScene, shots);
    const layout = this.buildLayout(sourceScene, storyboard);
    const platformOptimizations = this.buildPlatformOptimizations(storyboard.profile.platform, sourceScene);

    return {
      sceneId: profile.sceneId,
      profile,
      structure,
      shots,
      visualPlan,
      characterPlanning,
      objectPlanning,
      audioPlanning,
      transitionPlanning,
      cameraPlanning,
      motionPlanning,
      layout,
      platformOptimizations,
    };
  }

  buildProfile(
    storyboard: StoryboardGenerationRecord,
    sourceScene: GeneratedScene,
    version: number
  ): SceneGenerationProfile {
    return {
      sceneId: sourceScene.sceneId,
      storyboardId: storyboard.storyboardId,
      projectId: storyboard.profile.projectId,
      campaignId: storyboard.profile.campaignId,
      productId: storyboard.profile.productId,
      brandId: storyboard.profile.brandId,
      platform: storyboard.profile.platform,
      sceneVersion: version,
    };
  }

  buildStructure(sourceScene: GeneratedScene): SceneStructure {
    return {
      sceneOrder: sourceScene.sceneOrder,
      sceneDuration: sourceScene.sceneDuration,
      scenePurpose: sourceScene.scenePurpose,
      scenePriority: mapPurposeToPriority(sourceScene.scenePurpose),
      sceneType: mapPurposeToSceneType(sourceScene.scenePurpose),
      sceneMood: sourceScene.sceneMood,
      sceneEnvironment: sourceScene.sceneEnvironment,
      sceneObjectives: [sourceScene.sceneObjective, ...sourceScene.sceneAssets.map((a) => `Asset: ${a}`)],
    };
  }

  buildShots(sourceScene: GeneratedScene): SceneShot[] {
    return sourceScene.shots.map((shot: GeneratedShot) => ({
      shotId: shot.shotId,
      shotOrder: shot.shotOrder,
      shotDuration: shot.duration,
      shotType: shot.shotType,
      cameraAngle: shot.cameraAngle,
      cameraMovement: shot.cameraMovement,
      framing: shot.framing,
      focusPoint: this.resolveFocusPoint(sourceScene.scenePurpose, shot.shotType),
      motionInstructions: shot.motionInstructions,
    }));
  }

  buildVisualPlan(storyboard: StoryboardGenerationRecord, sourceScene: GeneratedScene): VisualGenerationPlan {
    const isProductScene = ["product-showcase", "benefits", "call-to-action"].includes(sourceScene.scenePurpose);
    return {
      background: storyboard.visualPlanning.background,
      lighting: storyboard.visualPlanning.lighting,
      composition: storyboard.visualPlanning.composition,
      colorStyle: storyboard.visualPlanning.colorStyle,
      productPlacement: isProductScene
        ? "Hero product center-frame with rule-of-thirds alignment"
        : "Product visible in supporting position or background",
      logoPlacement: sourceScene.scenePurpose === "ending"
        ? "Brand lockup lower-right safe zone"
        : "Subtle watermark upper-left",
      typographyPlacement: sourceScene.scenePurpose === "call-to-action"
        ? "CTA text lower-third with brand typography"
        : "Subtitle lower-third safe zone",
      graphicElements: storyboard.visualPlanning.graphics,
    };
  }

  buildCharacterPlanning(sourceScene: GeneratedScene, storyboard: StoryboardGenerationRecord): CharacterPlanning {
    const hasCharacter = !["product-showcase", "ending"].includes(sourceScene.scenePurpose);
    return {
      characterPosition: hasCharacter ? "Mid-frame facing camera at eye level" : "No primary character — product hero",
      characterActions: hasCharacter
        ? `Demonstrate ${sourceScene.sceneObjective.slice(0, 50)}`
        : "Product-focused presentation",
      facialExpression: sourceScene.sceneMood.includes("trust")
        ? "Confident, approachable smile"
        : sourceScene.sceneMood.includes("urgent")
          ? "Determined, action-oriented"
          : "Engaged, natural expression",
      bodyLanguage: sourceScene.sceneMood.includes("showcase")
        ? "Open posture presenting product"
        : "Relaxed, authentic posture",
      eyeContact: hasCharacter ? "Direct camera eye contact for connection" : "N/A — product focus",
      interactionPlanning: `Interact with ${storyboard.profile.productId} — ${sourceScene.scenePurpose}`,
    };
  }

  buildObjectPlanning(sourceScene: GeneratedScene, storyboard: StoryboardGenerationRecord): ObjectPlanning {
    const isProductFocus = ["product-showcase", "benefits", "solution"].includes(sourceScene.scenePurpose);
    return {
      productPosition: isProductFocus ? "Center hero placement, 40% frame coverage" : "Supporting placement",
      objectPosition: "Environment props arranged for depth and context",
      objectInteraction: isProductFocus
        ? "Hands-on product demonstration with tactile interaction"
        : "Ambient environmental objects for context",
      environmentObjects: sourceScene.sceneAssets.filter((a) => !a.includes("product")),
      motionObjects: isProductFocus ? ["product-hero", "feature-highlight"] : ["ambient-motion"],
    };
  }

  buildAudioPlanning(storyboard: StoryboardGenerationRecord, sourceScene: GeneratedScene): SceneAudioPlanning {
    const seconds = parseInt(sourceScene.sceneDuration, 10) || 8;
    return {
      voiceTiming: `Voice-over ${0}s-${seconds}s synchronized to ${sourceScene.scenePurpose}`,
      musicTiming: storyboard.audioPlanning.musicPlacement,
      soundEffects: storyboard.audioPlanning.soundEffects,
      audioSynchronization: `Beat-aligned at scene ${sourceScene.sceneOrder} — ${storyboard.audioPlanning.audioSynchronization}`,
      silenceTiming: sourceScene.scenePurpose === "call-to-action"
        ? storyboard.audioPlanning.silencePlanning
        : "No deliberate silence",
    };
  }

  buildTransitionPlanning(sourceScene: GeneratedScene, storyboard: StoryboardGenerationRecord): TransitionPlanning {
    const isFirst = sourceScene.sceneOrder === 1;
    const isLast = sourceScene.scenePurpose === "ending";
    return {
      sceneTransition: isFirst
        ? "Fade-in from black"
        : isLast
          ? "Fade-to-brand-lockup"
          : storyboard.cinematicPlanning.transitionStrategy,
      shotTransition: "Match-cut on motion vector between shots",
      motionTransition: storyboard.cinematicPlanning.pacing,
      audioTransition: "Cross-fade audio with 0.3s overlap",
      visualTransition: storyboard.cinematicPlanning.transitionStrategy,
    };
  }

  buildCameraPlanning(shots: SceneShot[]): SceneGenerationRecord["cameraPlanning"] {
    const primary = shots[0];
    return {
      primaryAngle: primary?.cameraAngle ?? CameraAngle.EyeLevel,
      primaryMovement: primary?.cameraMovement ?? CameraMovement.Static,
      coverageNotes: `${shots.length} shot coverage — wide establishing to detail inserts`,
    };
  }

  buildMotionPlanning(sourceScene: GeneratedScene, shots: SceneShot[]): SceneGenerationRecord["motionPlanning"] {
    return {
      subjectMotion: `${sourceScene.sceneMood} subject movement aligned to ${sourceScene.scenePurpose}`,
      cameraMotion: shots.map((s) => s.cameraMovement).join(", "),
      environmentMotion: "Subtle ambient motion in background layer",
    };
  }

  buildLayout(sourceScene: GeneratedScene, storyboard: StoryboardGenerationRecord): SceneGenerationRecord["layout"] {
    return {
      foreground: sourceScene.scenePurpose === "call-to-action" ? "CTA graphic overlay" : "Subject or product hero",
      midground: "Primary action zone — product or character",
      background: storyboard.visualPlanning.background,
      depthLayers: ["foreground", "midground", "background", "atmospheric"],
    };
  }

  buildPlatformOptimizations(
    primaryPlatform: StoryboardGenerationPlatform,
    sourceScene: GeneratedScene
  ): ScenePlatformOptimization[] {
    return SCENE_PLATFORM_TARGETS.map((platform) => {
      const config = PLATFORM_SCENE_CONFIG[platform];
      const isPrimary = platform === primaryPlatform;
      return {
        platform,
        aspectRatio: config.aspectRatio,
        durationGuidance: config.durationGuidance,
        pacingNotes: isPrimary
          ? [`Primary platform — scene ${sourceScene.sceneDuration} optimized`]
          : [`Adapted from ${primaryPlatform}`, config.durationGuidance],
        safeZoneNotes:
          platform === StoryboardGenerationPlatform.Television
            ? ["Broadcast safe margins", "Legal disclaimer zone reserved"]
            : ["Platform-native safe zones for text and CTA"],
      };
    });
  }

  buildRecommendations(record: Omit<SceneGenerationRecord, "scores" | "relationships" | "recommendations" | "validated" | "productionReady" | "marketingReady" | "brandConsistent" | "createdAt" | "lastUpdated">): string[] {
    const recs: string[] = [];
    if (record.shots.length < 2) recs.push("Consider adding B-roll shot for visual variety");
    if (record.structure.scenePriority === "critical") {
      recs.push("Critical scene — verify brand consistency before render preparation");
    }
    recs.push("Review platform optimizations before export planning");
    return recs;
  }

  private resolveFocusPoint(purpose: string, shotType: string): string {
    if (purpose === "product-showcase") return "Product hero — primary feature detail";
    if (purpose === "call-to-action") return "CTA element and brand logo";
    if (shotType === "close-up") return "Subject face or product detail";
    return "Scene subject center of interest";
  }
}
