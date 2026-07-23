import type { CameraMovementRecord } from "../camera-movement-intelligence-engine/types.js";
import type { MotionIntelligenceRecord } from "../motion-intelligence-engine/types.js";
import type { SceneDetectionRecord } from "../scene-detection-intelligence-engine/types.js";
import type { TimelineIntelligenceRecord } from "../timeline-intelligence-engine/types.js";
import type { VideoAnalysisIntelligenceRecord } from "../video-analysis-engine/types.js";
import { VideoAnalysisType, VideoOrientation } from "../video-analysis-engine/types.js";
import type { VideoUnderstandingRecord } from "../video-understanding-engine/types.js";
import { VideoStoryType } from "../video-understanding-engine/types.js";
import { VideoStyleTemplateLibrary } from "./video-style-template-library.js";
import {
  BrandStyleAnalysis,
  CinematicStyleClass,
  EditingStyleAnalysis,
  StyleCategory,
  StyleRecommendation,
  StyleTemplate,
  VideoStyleProfile,
  VisualStyleAnalysis,
} from "./types.js";

export class VideoStyleAnalyzer {
  private readonly templateLibrary = new VideoStyleTemplateLibrary();

  analyze(
    analysis: VideoAnalysisIntelligenceRecord,
    sceneDetection: SceneDetectionRecord,
    timeline: TimelineIntelligenceRecord | null | undefined,
    camera: CameraMovementRecord | null | undefined,
    motion: MotionIntelligenceRecord | null | undefined,
    understanding: VideoUnderstandingRecord | null | undefined,
    industry?: string
  ): {
    profile: VideoStyleProfile;
    visualStyle: VisualStyleAnalysis;
    editingStyle: EditingStyleAnalysis;
    cinematicStyles: CinematicStyleClass[];
    dominantCinematicStyle: CinematicStyleClass;
    brandStyle: BrandStyleAnalysis;
    templates: StyleTemplate[];
    recommendations: StyleRecommendation[];
    keywords: string[];
  } {
    const brand = analysis.relationships.relatedBrands[0] ?? "Unknown";
    const campaign = analysis.relationships.relatedCampaigns[0] ?? analysis.classification.useCase;
    const version = 1;

    const profile: VideoStyleProfile = {
      styleId: `style-${analysis.videoId}`,
      styleName: `${brand} ${analysis.classification.creativeStyle} Style`,
      styleCategory: this.inferStyleCategory(analysis.classification.videoType),
      industry: industry ?? this.inferIndustry(analysis.classification.videoType, analysis.classification.category),
      brand,
      campaign,
      styleVersion: version,
    };

    const visualStyle = this.analyzeVisualStyle(analysis, camera, motion, understanding);
    const editingStyle = this.analyzeEditingStyle(analysis, sceneDetection, timeline, motion);
    const cinematicStyles = this.classifyCinematicStyle(analysis, understanding);
    const dominantCinematicStyle = cinematicStyles[0] ?? CinematicStyleClass.Commercial;
    const brandStyle = this.analyzeBrandStyle(analysis, understanding, visualStyle);
    const platformHint = analysis.technical.metadata?.platform ?? "";
    const templates = this.templateLibrary.matchTemplates(
      analysis.classification.videoType,
      cinematicStyles,
      platformHint
    );
    const recommendations = this.buildRecommendations(
      visualStyle,
      editingStyle,
      brandStyle,
      camera,
      motion,
      templates
    );
    const keywords = [
      ...analysis.keywords,
      profile.styleName,
      dominantCinematicStyle,
      ...cinematicStyles,
      profile.styleCategory,
    ];

    return {
      profile,
      visualStyle,
      editingStyle,
      cinematicStyles,
      dominantCinematicStyle,
      brandStyle,
      templates,
      recommendations,
      keywords,
    };
  }

  private inferStyleCategory(videoType: VideoAnalysisType): StyleCategory {
    switch (videoType) {
      case VideoAnalysisType.Commercial:
        return StyleCategory.Commercial;
      case VideoAnalysisType.SocialMedia:
        return StyleCategory.Social;
      case VideoAnalysisType.Tutorial:
        return StyleCategory.Educational;
      default:
        return StyleCategory.Cinematic;
    }
  }

  private inferIndustry(videoType: VideoAnalysisType, category: string): string {
    if (category) return category;
    if (videoType === VideoAnalysisType.Commercial) return "technology";
    if (videoType === VideoAnalysisType.SocialMedia) return "social-media";
    if (videoType === VideoAnalysisType.Tutorial) return "education";
    return "general";
  }

  private analyzeVisualStyle(
    analysis: VideoAnalysisIntelligenceRecord,
    camera: CameraMovementRecord | null | undefined,
    motion: MotionIntelligenceRecord | null | undefined,
    understanding: VideoUnderstandingRecord | null | undefined
  ): VisualStyleAnalysis {
    const colors = analysis.visual.dominantColors;
    const saturation = analysis.visual.saturation;
    const contrast = analysis.visual.contrast;
    const motionDensity = analysis.frame.motionDensity;

    return {
      colorGradingStyle:
        saturation > 70
          ? "vibrant high-saturation grade"
          : contrast > 75
            ? "high-contrast cinematic grade"
            : "balanced natural grade",
      lightingStyle:
        analysis.visual.brightness > 70
          ? "bright high-key lighting"
          : analysis.visual.brightness < 40
            ? "moody low-key lighting"
            : "balanced three-point lighting",
      compositionStyle:
        analysis.technical.orientation === VideoOrientation.Portrait
          ? "vertical center-weighted composition"
          : "rule-of-thirds widescreen composition",
      cameraStyle: camera
        ? `${camera.dominantMovement} with ${camera.dominantAngle} framing`
        : motionDensity > 50
          ? "dynamic handheld-influenced"
          : "stable tripod-based",
      motionStyle: motion
        ? `${motion.dominantClassification} with ${motion.metrics.direction} direction`
        : motionDensity > 60
          ? "fast dynamic motion"
          : "controlled subtle motion",
      backgroundStyle:
        analysis.frame.visualComplexity > 60 ? "rich layered environments" : "clean minimal backgrounds",
      typographyStyle:
        analysis.classification.videoType === VideoAnalysisType.SocialMedia
          ? "bold sans-serif social overlays"
          : "clean professional sans-serif",
      graphicStyle:
        understanding?.context.marketingContext?.includes("launch")
          ? "promotional graphic accents"
          : "minimal brand-aligned graphics",
      visualIdentity: understanding?.context.brandContext ?? `${analysis.classification.creativeStyle} brand visual`,
    };
  }

  private analyzeEditingStyle(
    analysis: VideoAnalysisIntelligenceRecord,
    sceneDetection: SceneDetectionRecord,
    timeline: TimelineIntelligenceRecord | null | undefined,
    motion: MotionIntelligenceRecord | null | undefined
  ): EditingStyleAnalysis {
    const shotCount = sceneDetection.shots.length;
    const durationSec = analysis.technical.durationMs / 1000;
    const avgShotSec = shotCount > 0 ? durationSec / shotCount : durationSec;
    const pacing =
      avgShotSec < 2 ? "fast" : avgShotSec < 4 ? "medium" : avgShotSec < 8 ? "moderate" : "slow";

    return {
      editingRhythm: shotCount > 6 ? "staccato multi-beat rhythm" : "flowing narrative rhythm",
      pacing,
      transitionStyle:
        sceneDetection.transitions.length > 2
          ? `${sceneDetection.transitions[0]?.type ?? "cut"}-dominant transitions`
          : "clean cut transitions",
      cutStyle: pacing === "fast" ? "hard cuts on action" : "motivated scene cuts",
      effectStyle:
        analysis.visual.sharpness > 85 ? "subtle polish effects" : "standard correction effects",
      animationStyle:
        motion?.dominantClassification === "animated-motion"
          ? "motion graphics driven"
          : "minimal kinetic typography",
      captionStyle:
        analysis.classification.videoType === VideoAnalysisType.SocialMedia
          ? "bold burned-in captions"
          : "optional subtitle style",
      audioSyncStyle: timeline
        ? `timeline-synced at ${timeline.synchronization.overallSyncScore}/100`
        : "scene-boundary audio sync",
    };
  }

  private classifyCinematicStyle(
    analysis: VideoAnalysisIntelligenceRecord,
    understanding: VideoUnderstandingRecord | null | undefined
  ): CinematicStyleClass[] {
    const styles = new Set<CinematicStyleClass>();
    const type = analysis.classification.videoType;

    if (type === VideoAnalysisType.Commercial) {
      styles.add(CinematicStyleClass.Commercial);
      styles.add(CinematicStyleClass.Technology);
      styles.add(CinematicStyleClass.Modern);
    }
    if (type === VideoAnalysisType.SocialMedia) {
      styles.add(CinematicStyleClass.SocialMedia);
      styles.add(CinematicStyleClass.Entertainment);
      styles.add(CinematicStyleClass.Modern);
    }
    if (type === VideoAnalysisType.Tutorial) {
      styles.add(CinematicStyleClass.Education);
      styles.add(CinematicStyleClass.Corporate);
    }

    const sub = analysis.classification.subcategory?.toLowerCase() ?? "";
    if (sub.includes("luxury")) styles.add(CinematicStyleClass.Luxury);
    if (sub.includes("fashion")) styles.add(CinematicStyleClass.Fashion);
    if (sub.includes("food")) styles.add(CinematicStyleClass.Food);
    if (sub.includes("beauty")) styles.add(CinematicStyleClass.Beauty);
    if (sub.includes("health")) styles.add(CinematicStyleClass.Healthcare);
    if (sub.includes("real-estate")) styles.add(CinematicStyleClass.RealEstate);

    if (analysis.visual.saturation < 40 && analysis.visual.contrast < 50) {
      styles.add(CinematicStyleClass.Minimal);
    }
    if (understanding?.story.storyType === VideoStoryType.Documentary) {
      styles.add(CinematicStyleClass.Documentary);
    }

    if (styles.size === 0) styles.add(CinematicStyleClass.Commercial);
    return [...styles];
  }

  private analyzeBrandStyle(
    analysis: VideoAnalysisIntelligenceRecord,
    understanding: VideoUnderstandingRecord | null | undefined,
    visual: VisualStyleAnalysis
  ): BrandStyleAnalysis {
    const brandColors =
      analysis.visual.dominantColors.length > 0
        ? analysis.visual.dominantColors
        : ["#1a1a2e", "#e94560", "#ffffff"];
    const hasBrand = analysis.relationships.relatedBrands.length > 0;
    const hasProduct = analysis.relationships.relatedProducts.length > 0;

    return {
      brandColors,
      brandTypography: visual.typographyStyle,
      logoUsage: hasBrand ? "brand logo in intro/outro" : "no dedicated logo placement detected",
      visualConsistency: Math.min(
        100,
        Math.round(
          analysis.visual.visualStability * 0.4 +
            analysis.frame.frameConsistencyScore * 0.4 +
            (hasBrand ? 15 : 0)
        )
      ),
      ctaStyle: hasProduct ? "direct product CTA with brand colors" : "soft brand awareness CTA",
      marketingIdentity:
        understanding?.context.marketingContext ?? `${analysis.classification.useCase} marketing identity`,
    };
  }

  private buildRecommendations(
    visual: VisualStyleAnalysis,
    editing: EditingStyleAnalysis,
    brand: BrandStyleAnalysis,
    camera: CameraMovementRecord | null | undefined,
    motion: MotionIntelligenceRecord | null | undefined,
    templates: StyleTemplate[]
  ): StyleRecommendation[] {
    const recs: StyleRecommendation[] = [];
    const topTemplate = templates[0];

    if (brand.visualConsistency < 75) {
      recs.push({
        category: "color",
        suggestion: "Align color grading with brand palette for stronger visual consistency",
        priority: "high",
        reason: `Visual consistency ${brand.visualConsistency}/100`,
      });
    }
    if (editing.pacing === "fast" && !motion) {
      recs.push({
        category: "motion",
        suggestion: "Add motion intelligence pass to validate fast-cut rhythm",
        priority: "medium",
        reason: "Fast pacing without motion analysis linkage",
      });
    }
    if (!camera) {
      recs.push({
        category: "camera",
        suggestion: "Run camera movement analysis to refine camera style recommendations",
        priority: "medium",
        reason: "Camera plan not linked",
      });
    }
    if (topTemplate) {
      recs.push({
        category: "editing",
        suggestion: `Apply ${topTemplate.name} template for ${topTemplate.platform}`,
        priority: "high",
        reason: `Template match score ${topTemplate.matchScore}/100`,
      });
      recs.push({
        category: "color",
        suggestion: `Recommended color: ${topTemplate.recommendedVisual.colorGradingStyle ?? visual.colorGradingStyle}`,
        priority: "medium",
        reason: "Template-driven color recommendation",
      });
      recs.push({
        category: "transitions",
        suggestion: `Recommended transitions: ${topTemplate.recommendedEditing.transitionStyle ?? editing.transitionStyle}`,
        priority: "low",
        reason: "Template-driven transition recommendation",
      });
    }
    recs.push({
      category: "typography",
      suggestion: `Maintain ${visual.typographyStyle} across captions and overlays`,
      priority: "low",
      reason: "Typography consistency best practice",
    });
    recs.push({
      category: "effects",
      suggestion: `Use ${editing.effectStyle} aligned with brand marketing identity`,
      priority: "low",
      reason: "Brand-aligned effects guidance",
    });
    return recs;
  }
}
