import type { SceneGenerationRecord } from "../scene-generation-engine/types.js";
import type { StoryboardGenerationRecord } from "../story-generation-engine/types.js";
import {
  CAMERA_PLATFORM_TARGETS,
  CameraPlanProfile,
  CompositionPlanning,
  CompositionStrategy,
  ContinuityPlanning,
  DirectorCameraAngle,
  DirectorCameraMovement,
  DirectorShotPlan,
  DirectorShotType,
  FocusPlanning,
  PLATFORM_CAMERA_CONFIG,
  PlatformCameraOptimization,
  StoryboardGenerationPlatform,
  mapSceneAngleToDirector,
  mapSceneMovementToDirector,
  mapSceneShotToDirectorShot,
} from "./types.js";

export class CameraDirectorAnalyzer {
  buildCameraPlan(
    scene: SceneGenerationRecord,
    storyboard: StoryboardGenerationRecord | null,
    version: number
  ): Omit<
    CameraDirectorRecordDraft,
    "scores" | "relationships" | "recommendations" | "validated" | "productionReady" | "brandConsistent" | "cinematicallyConsistent" | "createdAt" | "lastUpdated"
  > {
    const profile = this.buildProfile(scene, version);
    const shotPlans = this.buildShotPlans(scene);
    const focusPlanning = this.buildFocusPlanning(scene);
    const compositionPlanning = this.buildCompositionPlanning(scene, storyboard);
    const continuity = this.buildContinuity(scene, storyboard);
    const platformOptimizations = this.buildPlatformOptimizations(scene.profile.platform);
    const marketingImpact = this.buildMarketingImpact(scene);

    return {
      cameraPlanId: profile.cameraPlanId,
      profile,
      shotPlans,
      focusPlanning,
      compositionPlanning,
      continuity,
      platformOptimizations,
      marketingImpact,
    };
  }

  buildProfile(scene: SceneGenerationRecord, version: number): CameraPlanProfile {
    return {
      cameraPlanId: `camera-plan-${scene.sceneId}-v${version}`,
      sceneId: scene.sceneId,
      storyboardId: scene.profile.storyboardId,
      projectId: scene.profile.projectId,
      brandId: scene.profile.brandId,
      platform: scene.profile.platform,
      cameraVersion: version,
    };
  }

  buildShotPlans(scene: SceneGenerationRecord): DirectorShotPlan[] {
    const purpose = scene.structure.scenePurpose;
    return scene.shots.map((shot, index) => {
      const directorShotType = mapSceneShotToDirectorShot(shot.shotType, purpose);
      const isFirst = index === 0;
      const isHero = purpose === "product-showcase" || directorShotType === DirectorShotType.Hero;

      return {
        shotId: shot.shotId,
        shotOrder: shot.shotOrder,
        shotType: isFirst && purpose === "opening-hook" ? DirectorShotType.Establishing : directorShotType,
        cameraAngle: mapSceneAngleToDirector(shot.cameraAngle),
        cameraMovement: this.enhanceMovement(mapSceneMovementToDirector(shot.cameraMovement), purpose, index),
        framing: shot.framing,
        duration: shot.shotDuration,
        marketingPurpose: isHero
          ? "Hero product reveal — maximum marketing impact"
          : purpose === "call-to-action"
            ? "Conversion-focused framing with CTA visibility"
            : `Support ${purpose} narrative beat`,
      };
    });
  }

  buildFocusPlanning(scene: SceneGenerationRecord): FocusPlanning {
    const isProduct = ["product-showcase", "benefits", "solution"].includes(scene.structure.scenePurpose);
    return {
      focusSubject: isProduct
        ? "Product hero — primary feature in sharp focus"
        : scene.shots[0]?.focusPoint ?? "Scene subject",
      focusTransition: scene.shots.length > 1 ? "Rack focus between subject and product detail" : "Static focus hold",
      depthOfField: isProduct ? "Shallow DOF — product sharp, background bokeh" : "Moderate DOF for environmental context",
      rackFocus: scene.shots.length >= 2 ? `Shot 1→${scene.shots.length}: subject to product detail` : "No rack focus required",
      subjectPriority: isProduct ? "Product first, character second" : "Character/subject primary",
    };
  }

  buildCompositionPlanning(
    scene: SceneGenerationRecord,
    storyboard: StoryboardGenerationRecord | null
  ): CompositionPlanning {
    const isProduct = ["product-showcase", "call-to-action", "benefits"].includes(scene.structure.scenePurpose);
    const primary = isProduct ? CompositionStrategy.ProductHighlight : CompositionStrategy.RuleOfThirds;

    return {
      primaryStrategy: primary,
      ruleOfThirds: "Subject placed on vertical third intersection — dynamic balance",
      leadingLines: "Environmental lines guide eye toward product/subject focal point",
      centerComposition: isProduct ? "Product centered for hero showcase moments" : "Center reserved for key action",
      symmetry: scene.structure.scenePurpose === "ending" ? "Symmetrical brand lockup composition" : "Asymmetric for visual interest",
      negativeSpace: "Upper third clear for platform-safe text overlays",
      productHighlight: scene.visualPlan.productPlacement,
      brandVisibility: storyboard?.visualPlanning.branding ?? scene.visualPlan.logoPlacement,
    };
  }

  buildContinuity(
    scene: SceneGenerationRecord,
    storyboard: StoryboardGenerationRecord | null
  ): ContinuityPlanning {
    const issues: string[] = [];
    const notes: string[] = [];

    const anglesConsistent = scene.shots.every((s) => s.cameraAngle);
    if (!anglesConsistent) issues.push("Missing camera angle on one or more shots");

    notes.push(`Scene ${scene.structure.sceneOrder} maintains ${scene.structure.sceneMood} visual thread`);
    if (storyboard?.cinematicPlanning) {
      notes.push(`Aligned with story arc: ${storyboard.cinematicPlanning.emotionalArc}`);
    }

    return {
      cameraConsistency: anglesConsistent && scene.cameraPlanning.coverageNotes.length > 0,
      sceneContinuity: scene.structure.sceneOrder > 0,
      motionContinuity: Boolean(scene.motionPlanning.cameraMotion),
      lightingContinuity: scene.visualPlan.lighting.length > 5,
      storyContinuity: scene.structure.sceneObjectives.length >= 1,
      notes,
      issues,
    };
  }

  buildPlatformOptimizations(primaryPlatform: StoryboardGenerationPlatform): PlatformCameraOptimization[] {
    return CAMERA_PLATFORM_TARGETS.map((platform) => {
      const config = PLATFORM_CAMERA_CONFIG[platform];
      const isPrimary = platform === primaryPlatform;
      return {
        platform,
        aspectRatio: config.aspectRatio,
        movementGuidance: isPrimary ? config.movementStyle : `Adapt ${config.movementStyle} from ${primaryPlatform}`,
        angleGuidance: config.anglePreference,
        framingNotes: isPrimary
          ? ["Primary platform framing optimized"]
          : [`Reframe for ${config.aspectRatio}`, config.anglePreference],
      };
    });
  }

  buildMarketingImpact(scene: SceneGenerationRecord): CameraDirectorRecordDraft["marketingImpact"] {
    const isCta = scene.structure.scenePurpose === "call-to-action";
    const isHero = scene.structure.scenePurpose === "product-showcase";
    return {
      heroMoment: isHero ? "Maximum product visibility — hero shot sequence" : "Supporting narrative camera work",
      productRevealAngle: isHero ? DirectorCameraAngle.LowAngle : DirectorCameraAngle.EyeLevel,
      brandVisibilityZone: scene.visualPlan.logoPlacement,
      conversionFraming: isCta
        ? "Tight framing on CTA with direct eye-line to camera"
        : "Product-forward framing building desire",
    };
  }

  buildRecommendations(draft: CameraDirectorRecordDraft): string[] {
    const recs: string[] = [];
    if (draft.shotPlans.length < 2) recs.push("Add B-roll coverage for editorial flexibility");
    if (draft.continuity.issues.length > 0) recs.push("Review continuity issues before motion planning");
    if (draft.compositionPlanning.primaryStrategy === CompositionStrategy.ProductHighlight) {
      recs.push("Verify product highlight framing against brand guidelines");
    }
    recs.push("Review platform camera optimizations before render preparation");
    return recs;
  }

  private enhanceMovement(
    base: DirectorCameraMovement,
    purpose: string,
    shotIndex: number
  ): DirectorCameraMovement {
    if (purpose === "opening-hook" && shotIndex === 0) return DirectorCameraMovement.PushIn;
    if (purpose === "product-showcase") return DirectorCameraMovement.Orbit;
    if (purpose === "call-to-action") return DirectorCameraMovement.PushIn;
    if (purpose === "ending") return DirectorCameraMovement.PullOut;
    return base;
  }
}

export interface CameraDirectorRecordDraft {
  cameraPlanId: string;
  profile: CameraPlanProfile;
  shotPlans: DirectorShotPlan[];
  focusPlanning: FocusPlanning;
  compositionPlanning: CompositionPlanning;
  continuity: ContinuityPlanning;
  platformOptimizations: PlatformCameraOptimization[];
  marketingImpact: {
    heroMoment: string;
    productRevealAngle: DirectorCameraAngle;
    brandVisibilityZone: string;
    conversionFraming: string;
  };
}
