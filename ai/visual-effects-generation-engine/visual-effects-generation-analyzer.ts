import type { AnimationGenerationRecord } from "../animation-generation-engine/types.js";
import type { CameraDirectorRecord } from "../camera-director-engine/types.js";
import { DirectorCameraMovement } from "../camera-director-engine/types.js";
import type { MotionGenerationRecord } from "../motion-generation-engine/types.js";
import type { SceneGenerationRecord } from "../scene-generation-engine/types.js";
import {
  AtmosphericEffectsPlan,
  CinematicEffectsPlan,
  ColorEffectsPlan,
  EffectSynchronization,
  EnvironmentEffectsPlan,
  LightingEffectsPlan,
  PlatformVisualEffectsOptimization,
  ProductEffectsPlan,
  TextGraphicEffectsPlan,
  TransitionEffectsPlan,
  VisualEffectPlanProfile,
  VisualEffectPlanType,
  VFX_PLATFORM_TARGETS,
  PLATFORM_VFX_CONFIG,
} from "./types.js";
import { StoryboardGenerationPlatform } from "../story-generation-engine/types.js";

export class VisualEffectsGenerationAnalyzer {
  buildVisualEffectPlan(
    scene: SceneGenerationRecord,
    cameraPlan: CameraDirectorRecord,
    motionPlan: MotionGenerationRecord,
    animationPlan: AnimationGenerationRecord,
    version: number
  ): VisualEffectsGenerationRecordDraft {
    const profile = this.buildProfile(scene, cameraPlan, motionPlan, animationPlan, version);
    const purpose = scene.structure.scenePurpose;
    const isProduct = ["product-showcase", "benefits", "solution"].includes(purpose);
    const isHero = isProduct || purpose === "opening-hook";

    return {
      visualEffectPlanId: profile.visualEffectPlanId,
      profile,
      planType: isHero ? VisualEffectPlanType.Combined : VisualEffectPlanType.Lighting,
      lightingEffects: this.buildLightingEffects(scene, cameraPlan, isHero),
      atmosphericEffects: this.buildAtmosphericEffects(scene, motionPlan, animationPlan),
      productEffects: this.buildProductEffects(scene, animationPlan, isProduct),
      environmentEffects: this.buildEnvironmentEffects(scene, motionPlan, animationPlan),
      transitionEffects: this.buildTransitionEffects(scene, animationPlan),
      textGraphicEffects: this.buildTextGraphicEffects(scene, animationPlan),
      colorEffects: this.buildColorEffects(scene),
      cinematicEffects: this.buildCinematicEffects(scene, cameraPlan),
      synchronization: this.buildSynchronization(scene, cameraPlan, motionPlan, animationPlan),
      platformOptimizations: this.buildPlatformOptimizations(scene.profile.platform),
    };
  }

  buildProfile(
    scene: SceneGenerationRecord,
    cameraPlan: CameraDirectorRecord,
    motionPlan: MotionGenerationRecord,
    animationPlan: AnimationGenerationRecord,
    version: number
  ): VisualEffectPlanProfile {
    return {
      visualEffectPlanId: `vfx-plan-${scene.sceneId}-v${version}`,
      sceneId: scene.sceneId,
      storyboardId: scene.profile.storyboardId,
      projectId: scene.profile.projectId,
      productId: scene.profile.productId,
      brandId: scene.profile.brandId,
      platform: scene.profile.platform,
      effectVersion: version,
      animationPlanId: animationPlan.animationPlanId,
      motionPlanId: motionPlan.motionPlanId,
      cameraPlanId: cameraPlan.cameraPlanId,
    };
  }

  buildLightingEffects(
    scene: SceneGenerationRecord,
    cameraPlan: CameraDirectorRecord,
    isHero: boolean
  ): LightingEffectsPlan {
    const lighting = scene.visualPlan.lighting;
    const primaryShot = cameraPlan.shotPlans[0];
    return {
      glow: isHero ? `Hero product glow — ${lighting}` : `Ambient glow matching ${lighting}`,
      lightRays: isHero ? "Volumetric light rays through key light — cinematic accent" : scene.visualPlan.background.includes("outdoor") ? "Subtle sun rays" : "Soft studio light rays",
      lensFlare: primaryShot?.cameraMovement !== DirectorCameraMovement.Static ? "Controlled lens flare on camera move" : "Minimal lens flare on highlights",
      bloom: isHero ? "Selective bloom on product highlights — premium feel" : "Subtle bloom on bright elements",
      reflection: `Surface reflections aligned to ${scene.objectPlanning.productPosition}`,
      refraction: isHero ? "Glass/material refraction on product surfaces" : "N/A",
      rimLight: `Rim light separating subject from ${scene.layout.background}`,
      volumetricLighting: `${lighting} — volumetric fill for depth`,
    };
  }

  buildAtmosphericEffects(
    scene: SceneGenerationRecord,
    motionPlan: MotionGenerationRecord,
    animationPlan: AnimationGenerationRecord
  ): AtmosphericEffectsPlan {
    const env = animationPlan.environmentAnimation;
    const em = motionPlan.environmentMotion;
    return {
      fog: scene.structure.sceneMood.includes("myster") ? "Atmospheric fog — mood enhancement" : "Light haze for depth",
      mist: scene.structure.sceneEnvironment.includes("outdoor") ? "Morning mist layer" : "Studio mist for soft diffusion",
      rain: env.rain !== "N/A" ? env.rain : "N/A",
      snow: env.snow !== "N/A" ? env.snow : "N/A",
      smoke: env.smoke !== "N/A" ? env.smoke : "Subtle smoke wisps for atmosphere",
      fire: env.fire !== "N/A" ? env.fire : "N/A",
      dust: env.dust !== "Minimal" ? env.dust : "Ambient dust particles in light",
      clouds: scene.structure.sceneEnvironment.includes("sky") ? "Dynamic cloud layer" : "N/A",
      particles: env.particles,
    };
  }

  buildProductEffects(
    scene: SceneGenerationRecord,
    animationPlan: AnimationGenerationRecord,
    isProduct: boolean
  ): ProductEffectsPlan {
    const pa = animationPlan.productAnimation;
    return {
      productGlow: isProduct ? "Brand-color product glow — hero emphasis" : "Subtle product presence glow",
      productHighlight: isProduct ? pa.highlight : "Minimal highlight on product edges",
      productOutline: isProduct ? "Premium outline stroke on product silhouette" : "N/A",
      shine: isProduct ? "Specular shine sweep across product surface" : "Subtle surface shine",
      reflection: pa.reveal.includes("reveal") ? "Floor/surface reflection under product" : "Soft reflection",
      floatingEffects: pa.floating !== "N/A" ? pa.floating : "N/A",
      premiumReveal: isProduct ? pa.reveal : "Standard product presence",
    };
  }

  buildEnvironmentEffects(
    scene: SceneGenerationRecord,
    motionPlan: MotionGenerationRecord,
    animationPlan: AnimationGenerationRecord
  ): EnvironmentEffectsPlan {
    const env = animationPlan.environmentAnimation;
    const em = motionPlan.environmentMotion;
    return {
      water: env.water !== "N/A" ? env.water : "N/A",
      fire: env.fire !== "N/A" ? env.fire : "N/A",
      wind: env.wind !== "N/A" ? env.wind : em.wind,
      lightning: scene.structure.sceneMood.includes("dramatic") ? "Dramatic lightning flash accent" : "N/A",
      sand: scene.structure.sceneEnvironment.includes("desert") ? "Sand particle drift" : "N/A",
      leaves: scene.structure.sceneEnvironment.includes("outdoor") ? "Ambient leaf motion" : "N/A",
      ambientMotion: em.activeEffects.join(", ") || scene.motionPlanning.environmentMotion,
    };
  }

  buildTransitionEffects(
    scene: SceneGenerationRecord,
    animationPlan: AnimationGenerationRecord
  ): TransitionEffectsPlan {
    const ta = animationPlan.transitionAnimation;
    const tp = scene.transitionPlanning;
    return {
      fade: ta.fade,
      flash: scene.structure.scenePurpose === "call-to-action" ? "CTA flash accent on appearance" : "N/A",
      morph: ta.morph,
      zoom: ta.zoom,
      blur: "Directional blur on transition beat",
      motionBlur: ta.motionBlur,
      dissolve: ta.dissolve,
      customEffects: tp.visualTransition,
    };
  }

  buildTextGraphicEffects(
    scene: SceneGenerationRecord,
    animationPlan: AnimationGenerationRecord
  ): TextGraphicEffectsPlan {
    const isCta = scene.structure.scenePurpose === "call-to-action";
    const la = animationPlan.logoAnimation;
    return {
      textGlow: isCta ? "CTA text glow — brand color" : "Subtle text glow on headlines",
      textShadow: "Soft drop shadow for readability",
      textReveal: animationPlan.textAnimation.reveal,
      animatedBorders: scene.visualPlan.graphicElements.includes("border") ? "Animated graphic borders" : "Minimal frame accents",
      graphicHighlights: scene.visualPlan.graphicElements,
      logoEffects: la.logoGlow,
    };
  }

  buildColorEffects(scene: SceneGenerationRecord): ColorEffectsPlan {
    const colorStyle = scene.visualPlan.colorStyle;
    return {
      colorGrading: `${colorStyle} — brand-aligned color grade`,
      cinematicLutPlanning: "Cinematic LUT — warm highlights, controlled shadows",
      hdrPreparation: "HDR headroom preserved for highlights and shadows",
      contrastEnhancement: scene.structure.scenePurpose === "opening-hook" ? "High contrast hook grade" : "Balanced contrast enhancement",
      saturationPlanning: `${colorStyle} saturation — brand palette fidelity`,
      toneMapping: "Filmic tone mapping for broadcast-safe output",
    };
  }

  buildCinematicEffects(scene: SceneGenerationRecord, cameraPlan: CameraDirectorRecord): CinematicEffectsPlan {
    const hasMovement = cameraPlan.shotPlans.some((s) => s.cameraMovement !== DirectorCameraMovement.Static);
    return {
      depthOfField: scene.visualPlan.composition.includes("shallow") ? "Shallow DOF — subject isolation" : "Moderate DOF for product clarity",
      filmGrain: scene.profile.platform === StoryboardGenerationPlatform.Television ? "Broadcast film grain — subtle" : "Minimal film grain for digital polish",
      vignette: scene.structure.scenePurpose === "ending" ? "Brand vignette on lockup" : "Subtle edge vignette",
      chromaticAberration: hasMovement ? "Minimal chromatic aberration on fast moves" : "N/A",
      anamorphicFlare: hasMovement ? "Anamorphic streak on bright highlights" : "N/A",
    };
  }

  buildSynchronization(
    scene: SceneGenerationRecord,
    cameraPlan: CameraDirectorRecord,
    motionPlan: MotionGenerationRecord,
    animationPlan: AnimationGenerationRecord
  ): EffectSynchronization {
    return {
      motionSync: motionPlan.cameraSynchronization.syncPoints,
      cameraSync: cameraPlan.shotPlans.map((s) => `Shot ${s.shotOrder}: ${s.cameraMovement}`),
      audioSync: [scene.audioPlanning.voiceTiming, scene.audioPlanning.audioSynchronization],
      sceneTimingSync: [`Scene duration ${scene.structure.sceneDuration}`, animationPlan.timeline.animationStart, animationPlan.timeline.animationEnd],
      animationSync: animationPlan.synchronization.motionSync,
      transitionSync: [scene.transitionPlanning.sceneTransition, scene.transitionPlanning.visualTransition],
    };
  }

  buildPlatformOptimizations(platform: StoryboardGenerationPlatform): PlatformVisualEffectsOptimization[] {
    return VFX_PLATFORM_TARGETS.map((p) => {
      const config = PLATFORM_VFX_CONFIG[p];
      return {
        platform: p,
        effectIntensity: config.effectIntensity,
        renderComplexity: config.renderComplexity,
        notes: p === platform ? ["Primary platform VFX profile"] : [`Adapt ${config.effectIntensity} effects for ${p}`],
      };
    });
  }

  buildRecommendations(draft: VisualEffectsGenerationRecordDraft): string[] {
    const recs: string[] = [];
    if (draft.planType === VisualEffectPlanType.Product || draft.productEffects.productGlow.includes("hero")) {
      recs.push("Verify product highlight effects against brand visual guidelines");
    }
    recs.push("Review effect synchronization with animation timeline before render preparation");
    return recs;
  }
}

export interface VisualEffectsGenerationRecordDraft {
  visualEffectPlanId: string;
  profile: VisualEffectPlanProfile;
  planType: VisualEffectPlanType;
  lightingEffects: LightingEffectsPlan;
  atmosphericEffects: AtmosphericEffectsPlan;
  productEffects: ProductEffectsPlan;
  environmentEffects: EnvironmentEffectsPlan;
  transitionEffects: TransitionEffectsPlan;
  textGraphicEffects: TextGraphicEffectsPlan;
  colorEffects: ColorEffectsPlan;
  cinematicEffects: CinematicEffectsPlan;
  synchronization: EffectSynchronization;
  platformOptimizations: PlatformVisualEffectsOptimization[];
}
