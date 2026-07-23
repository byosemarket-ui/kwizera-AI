import {
  AudioKnowledge,
  CameraKnowledge,
  CameraShotType,
  EditingKnowledge,
  EditingStyle,
  MarketingKnowledge,
  SceneKnowledge,
  VideoAnalysisInput,
  VideoStructureKnowledge,
  VideoType,
  VisualProductionKnowledge,
} from "./types.js";

const DEFAULT_SCENES: SceneKnowledge[] = [
  {
    sceneOrder: 1,
    sceneDuration: 5,
    scenePurpose: "hook",
    productVisibility: 40,
    focusArea: "brand-logo",
    background: "dark-gradient",
    composition: "centered",
    motion: "slow-zoom",
    cameraMovement: CameraShotType.Zoom,
    transition: "fade-in",
    textPlacement: "lower-third",
    ctaPlacement: "none",
  },
  {
    sceneOrder: 2,
    sceneDuration: 12,
    scenePurpose: "product-showcase",
    productVisibility: 95,
    focusArea: "product-hero",
    background: "studio",
    composition: "rule-of-thirds",
    motion: "orbit",
    cameraMovement: CameraShotType.Orbit,
    transition: "cross-dissolve",
    textPlacement: "side-panel",
    ctaPlacement: "none",
  },
  {
    sceneOrder: 3,
    sceneDuration: 8,
    scenePurpose: "value-proposition",
    productVisibility: 70,
    focusArea: "feature-highlights",
    background: "lifestyle",
    composition: "split-screen",
    motion: "tracking",
    cameraMovement: CameraShotType.Tracking,
    transition: "wipe",
    textPlacement: "center",
    ctaPlacement: "bottom-center",
  },
  {
    sceneOrder: 4,
    sceneDuration: 5,
    scenePurpose: "cta-close",
    productVisibility: 60,
    focusArea: "brand-cta",
    background: "brand-color",
    composition: "centered",
    motion: "static",
    cameraMovement: CameraShotType.Static,
    transition: "fade-out",
    textPlacement: "center",
    ctaPlacement: "center",
  },
];

export class VideoAnalyzer {
  analyze(input: VideoAnalysisInput): {
    structure: VideoStructureKnowledge;
    camera: CameraKnowledge;
    editing: EditingKnowledge;
    audio: AudioKnowledge;
    marketing: MarketingKnowledge;
    visual: VisualProductionKnowledge;
    videoType: VideoType;
  } {
    const scenes = this.buildScenes(input);
    const totalDuration = input.duration ?? scenes.reduce((s, sc) => s + sc.sceneDuration, 0);

    const structure: VideoStructureKnowledge = {
      sceneSequence: scenes,
      storyFlow: input.structure?.storyFlow ?? "hook → product → value → cta",
      intro: input.structure?.intro ?? "logo-reveal-with-motion",
      outro: input.structure?.outro ?? "brand-lockup-with-cta",
      totalDuration,
      aspectRatio: input.aspectRatio ?? "16:9",
      resolution: input.resolution ?? "1920x1080",
    };

    const camera: CameraKnowledge = {
      primaryShots: input.camera?.primaryShots ?? [
        CameraShotType.Zoom,
        CameraShotType.Orbit,
        CameraShotType.Tracking,
        CameraShotType.ProductShowcase,
      ],
      cameraAngles: input.camera?.cameraAngles ?? ["eye-level", "slight-low", "overhead"],
      cameraMotion: input.camera?.cameraMotion ?? "dynamic-product-orbit",
      productShowcase: input.camera?.productShowcase ?? true,
    };

    const editing: EditingKnowledge = {
      editingRhythm: input.editing?.editingRhythm ?? "medium-paced-commercial",
      transitionTiming: input.editing?.transitionTiming ?? "beat-synced",
      sceneFlow: input.editing?.sceneFlow ?? "progressive-build",
      motionConsistency: input.editing?.motionConsistency ?? 82,
      visualContinuity: input.editing?.visualContinuity ?? 85,
      editingStyle: input.editing?.editingStyle ?? EditingStyle.Commercial,
      transitionTechniques: input.editing?.transitionTechniques ?? ["cross-dissolve", "fade", "wipe"],
    };

    const audio: AudioKnowledge = {
      backgroundMusic: input.audio?.backgroundMusic ?? "upbeat-corporate",
      voiceOver: input.audio?.voiceOver ?? "professional-narrator",
      narration: input.audio?.narration ?? "product-benefits-focused",
      audioBalance: input.audio?.audioBalance ?? 80,
      soundEffects: input.audio?.soundEffects ?? ["whoosh", "subtle-impact"],
      beatSynchronization: input.audio?.beatSynchronization ?? 78,
      audioTransitions: input.audio?.audioTransitions ?? "crossfade",
      audioQuality: input.audio?.audioQuality ?? 85,
    };

    const marketing: MarketingKnowledge = {
      hookTiming: input.marketing?.hookTiming ?? 3,
      productIntroduction: input.marketing?.productIntroduction ?? 8,
      valueProposition: input.marketing?.valueProposition ?? input.product ?? "creative AI studio",
      customerAttention: input.marketing?.customerAttention ?? 85,
      emotionalFlow: input.marketing?.emotionalFlow ?? "curiosity → desire → action",
      callToActionPlacement: input.marketing?.callToActionPlacement ?? "final-scene-center",
      closingStrategy: input.marketing?.closingStrategy ?? "brand-lockup-with-cta",
      marketingGoal: input.marketing?.marketingGoal ?? input.marketingGoal ?? "conversion",
    };

    const visual: VisualProductionKnowledge = {
      productPresentation: input.visual?.productPresentation ?? "hero-orbit-showcase",
      lighting: input.visual?.lighting ?? "three-point-studio",
      colorGrading: input.visual?.colorGrading ?? "warm-commercial",
      motionGraphics: input.visual?.motionGraphics ?? "kinetic-typography",
      visualEffects: input.visual?.visualEffects ?? "subtle-glow",
      textAnimation: input.visual?.textAnimation ?? "slide-up-fade",
      subtitleTiming: input.visual?.subtitleTiming ?? "sync-to-narration",
      logoAnimation: input.visual?.logoAnimation ?? "scale-reveal",
      brandingConsistency: input.visual?.brandingConsistency ?? 80,
    };

    return {
      structure,
      camera,
      editing,
      audio,
      marketing,
      visual,
      videoType: input.videoType ?? VideoType.Promotional,
    };
  }

  private buildScenes(input: VideoAnalysisInput): SceneKnowledge[] {
    if (input.scenes?.length) {
      return input.scenes.map((s, i) => ({
        sceneOrder: s.sceneOrder ?? i + 1,
        sceneDuration: s.sceneDuration ?? 5,
        scenePurpose: s.scenePurpose ?? "general",
        productVisibility: s.productVisibility ?? 70,
        focusArea: s.focusArea ?? "product",
        background: s.background ?? "studio",
        composition: s.composition ?? "centered",
        motion: s.motion ?? "static",
        cameraMovement: s.cameraMovement ?? CameraShotType.Medium,
        transition: s.transition ?? "cut",
        textPlacement: s.textPlacement ?? "lower-third",
        ctaPlacement: s.ctaPlacement ?? "none",
      }));
    }
    if (input.structure?.sceneSequence?.length) {
      return input.structure.sceneSequence;
    }
    return DEFAULT_SCENES;
  }
}
