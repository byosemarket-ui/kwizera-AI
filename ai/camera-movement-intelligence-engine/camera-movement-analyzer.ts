import type { VideoAnalysisIntelligenceRecord } from "../video-analysis-engine/types.js";
import { VideoAnalysisType, VideoOrientation } from "../video-analysis-engine/types.js";
import type { SceneDetectionRecord } from "../scene-detection-intelligence-engine/types.js";
import { ShotType, SceneClassification } from "../scene-detection-intelligence-engine/types.js";
import type { TimelineIntelligenceRecord } from "../timeline-intelligence-engine/types.js";
import type { VideoUnderstandingRecord } from "../video-understanding-engine/types.js";
import {
  CameraAngle,
  CameraMovementPlan,
  CameraMovementType,
  CameraRecommendation,
  CameraStabilityLevel,
  CameraTransitionAnalysis,
  CinematicPurpose,
  ShotCameraAnalysis,
  ShotFraming,
} from "./types.js";

const SHOT_TO_FRAMING: Partial<Record<ShotType, ShotFraming>> = {
  [ShotType.Wide]: ShotFraming.WideShot,
  [ShotType.Establishing]: ShotFraming.ExtremeWideShot,
  [ShotType.Medium]: ShotFraming.MediumShot,
  [ShotType.CloseUp]: ShotFraming.CloseUp,
  [ShotType.ExtremeCloseUp]: ShotFraming.ExtremeCloseUp,
  [ShotType.Insert]: ShotFraming.MediumCloseUp,
};

export class CameraMovementAnalyzer {
  analyze(
    analysis: VideoAnalysisIntelligenceRecord,
    sceneDetection: SceneDetectionRecord,
    timeline: TimelineIntelligenceRecord | null | undefined,
    understanding: VideoUnderstandingRecord | null | undefined
  ): {
    shotAnalyses: ShotCameraAnalysis[];
    transitions: CameraTransitionAnalysis[];
    movementPlan: CameraMovementPlan;
    recommendations: CameraRecommendation[];
    keywords: string[];
    detectedMovements: CameraMovementType[];
    cinematicPurposes: CinematicPurpose[];
  } {
    const motionDensity = analysis.frame.motionDensity;
    const visualStability = analysis.visual.visualStability;

    const shotAnalyses = sceneDetection.shots.map((shot, i) =>
      this.analyzeShot(shot, sceneDetection, analysis, motionDensity, visualStability, i)
    );

    const transitions = this.analyzeTransitions(shotAnalyses, sceneDetection);
    const detectedMovements = [...new Set(shotAnalyses.map((s) => s.movement))];
    const cinematicPurposes = [...new Set(shotAnalyses.map((s) => s.cinematicPurpose))];
    const movementPlan = this.buildMovementPlan(
      shotAnalyses,
      analysis,
      understanding,
      timeline,
      visualStability
    );
    const recommendations = this.buildRecommendations(shotAnalyses, analysis, visualStability);
    const keywords = [
      ...analysis.keywords,
      ...detectedMovements,
      ...shotAnalyses.map((s) => s.angle),
      ...shotAnalyses.map((s) => s.framing),
    ].filter(Boolean);

    return { shotAnalyses, transitions, movementPlan, recommendations, keywords, detectedMovements, cinematicPurposes };
  }

  private analyzeShot(
    shot: SceneDetectionRecord["shots"][0],
    sceneDetection: SceneDetectionRecord,
    analysis: VideoAnalysisIntelligenceRecord,
    motionDensity: number,
    visualStability: number,
    index: number
  ): ShotCameraAnalysis {
    const scene = sceneDetection.scenes.find((s) => s.sceneId === shot.sceneId);
    const movement = this.inferMovement(shot, motionDensity, index, analysis);
    const angle = this.inferAngle(shot.shotType, analysis.technical.orientation, index);
    const framing = this.inferFraming(shot.shotType, scene?.classification);
    const stability = this.inferStability(visualStability, motionDensity);
    const motionSmoothness = Math.min(100, visualStability + (stability === CameraStabilityLevel.Stable ? 15 : 0));
    const stabilizationQuality = Math.min(100, Math.round(visualStability * 0.9 + analysis.frame.frameConsistencyScore * 0.1));
    const cinematicPurpose = this.inferPurpose(scene?.classification, framing, movement);

    return {
      shotId: shot.shotId,
      sceneId: shot.sceneId,
      startMs: shot.startMs,
      endMs: shot.endMs,
      movement,
      angle,
      framing,
      stability,
      motionSmoothness,
      stabilizationQuality,
      cinematicPurpose,
      confidence: Math.min(100, 70 + Math.round(stabilizationQuality * 0.2)),
    };
  }

  private inferMovement(
    shot: SceneDetectionRecord["shots"][0],
    motionDensity: number,
    index: number,
    analysis: VideoAnalysisIntelligenceRecord
  ): CameraMovementType {
    if (motionDensity < 25 && !shot.cameraChange) return CameraMovementType.Static;
    if (analysis.classification.videoType === VideoAnalysisType.SocialMedia && motionDensity > 60) {
      return CameraMovementType.Gimbal;
    }
    if (
      analysis.technical.metadata?.drone === "true" ||
      analysis.technical.videoName.toLowerCase().includes("drone")
    ) {
      return CameraMovementType.Drone;
    }
    if (motionDensity > 70) {
      if (index % 4 === 0) return CameraMovementType.TrackingShot;
      if (index % 4 === 1) return CameraMovementType.FollowShot;
      return CameraMovementType.Handheld;
    }
    if (shot.shotType === ShotType.CloseUp || shot.shotType === ShotType.ExtremeCloseUp) {
      return index % 2 === 0 ? CameraMovementType.PushIn : CameraMovementType.DollyIn;
    }
    if (shot.shotType === ShotType.Wide || shot.shotType === ShotType.Establishing) {
      return index % 3 === 0 ? CameraMovementType.Pan : CameraMovementType.Crane;
    }
    if (index % 5 === 0) return CameraMovementType.Orbit;
    if (index % 5 === 1) return CameraMovementType.TruckLeft;
    if (index % 5 === 2) return CameraMovementType.TruckRight;
    if (index % 5 === 3) return CameraMovementType.Tilt;
    if (motionDensity > 45) return CameraMovementType.ZoomIn;
    return CameraMovementType.Static;
  }

  private inferAngle(shotType: ShotType, orientation: VideoOrientation, index: number): CameraAngle {
    if (orientation === VideoOrientation.Portrait && index === 0) return CameraAngle.EyeLevel;
    if (shotType === ShotType.Establishing) return CameraAngle.HighAngle;
    if (shotType === ShotType.CloseUp) return CameraAngle.EyeLevel;
    if (shotType === ShotType.ExtremeCloseUp) return CameraAngle.LowAngle;
    if (index % 7 === 0) return CameraAngle.BirdsEye;
    if (index % 7 === 1) return CameraAngle.Overhead;
    if (index % 7 === 2) return CameraAngle.DutchAngle;
    if (index % 7 === 3) return CameraAngle.SideView;
    if (index % 7 === 4) return CameraAngle.FrontView;
    if (index % 7 === 5) return CameraAngle.RearView;
    return CameraAngle.EyeLevel;
  }

  private inferFraming(shotType: ShotType, classification?: SceneClassification): ShotFraming {
    if (classification === SceneClassification.ProductDemo) return ShotFraming.HeroShot;
    if (classification === SceneClassification.Hook) return ShotFraming.MediumCloseUp;
    if (classification === SceneClassification.Cta) return ShotFraming.CloseUp;
    return SHOT_TO_FRAMING[shotType] ?? ShotFraming.MediumShot;
  }

  private inferStability(visualStability: number, motionDensity: number): CameraStabilityLevel {
    if (visualStability >= 75 && motionDensity <= 65) return CameraStabilityLevel.Stable;
    if (visualStability >= 55) return CameraStabilityLevel.SlightShake;
    return CameraStabilityLevel.HeavyShake;
  }

  private inferPurpose(
    classification: SceneClassification | undefined,
    framing: ShotFraming,
    movement: CameraMovementType
  ): CinematicPurpose {
    if (classification === SceneClassification.ProductDemo || framing === ShotFraming.HeroShot) {
      return CinematicPurpose.ProductShowcase;
    }
    if (classification === SceneClassification.Cta) return CinematicPurpose.CtaFocus;
    if (classification === SceneClassification.Hook) return CinematicPurpose.AudienceAttention;
    if (classification === SceneClassification.BrandScene) return CinematicPurpose.MarketingFocus;
    if (movement === CameraMovementType.PushIn || movement === CameraMovementType.DollyIn) {
      return CinematicPurpose.EmotionalImpact;
    }
    return CinematicPurpose.Storytelling;
  }

  private analyzeTransitions(
    shots: ShotCameraAnalysis[],
    sceneDetection: SceneDetectionRecord
  ): CameraTransitionAnalysis[] {
    const transitions: CameraTransitionAnalysis[] = [];
    for (let i = 0; i < shots.length - 1; i++) {
      const from = shots[i]!;
      const to = shots[i + 1]!;
      const continuity =
        from.movement === to.movement ? 90 : from.stability === to.stability ? 75 : 60;
      transitions.push({
        transitionId: `cam-trans-${from.shotId}-${to.shotId}`,
        fromShotId: from.shotId,
        toShotId: to.shotId,
        movementChange: `${from.movement} → ${to.movement}`,
        continuityScore: continuity,
      });
    }
    void sceneDetection;
    return transitions;
  }

  private buildMovementPlan(
    shots: ShotCameraAnalysis[],
    analysis: VideoAnalysisIntelligenceRecord,
    understanding: VideoUnderstandingRecord | null | undefined,
    timeline: TimelineIntelligenceRecord | null | undefined,
    visualStability: number
  ): CameraMovementPlan {
    const dominant = this.getDominantMovement(shots);
    const style =
      understanding?.context.creativeContext ??
      `${analysis.classification.creativeStyle} cinematic`;
    const avgContinuity =
      shots.length > 1
        ? Math.round(
            shots.slice(0, -1).reduce((s, shot, i) => {
              const next = shots[i + 1]!;
              return s + (shot.movement === next.movement ? 90 : 70);
            }, 0) / (shots.length - 1)
          )
        : 85;

    return {
      recommendedPath: `Progressive ${dominant} with establishing wide to close-up rhythm`,
      recommendedMovement: dominant,
      cinematicStyle: style,
      motionContinuity: avgContinuity,
      sceneTransitionNotes: timeline
        ? [`Sync camera moves with timeline ${timeline.timelineId}`, "Match transition sync to audio track"]
        : ["Align camera transitions with scene boundaries"],
      cameraSynchronization: `Lock to timeline at ${visualStability >= 75 ? "frame-accurate" : "scene-level"} precision`,
    };
  }

  private getDominantMovement(shots: ShotCameraAnalysis[]): CameraMovementType {
    const counts = new Map<CameraMovementType, number>();
    for (const s of shots) counts.set(s.movement, (counts.get(s.movement) ?? 0) + 1);
    let best = CameraMovementType.Static;
    let max = 0;
    for (const [m, c] of counts) {
      if (c > max) {
        max = c;
        best = m;
      }
    }
    return best;
  }

  private buildRecommendations(
    shots: ShotCameraAnalysis[],
    analysis: VideoAnalysisIntelligenceRecord,
    visualStability: number
  ): CameraRecommendation[] {
    const recs: CameraRecommendation[] = [];
    const unstable = shots.filter((s) => s.stability !== CameraStabilityLevel.Stable);

    if (unstable.length > shots.length * 0.4) {
      recs.push({
        category: "stability",
        suggestion: "Apply stabilization in post or use gimbal for handheld segments",
        priority: "high",
        reason: `${unstable.length}/${shots.length} shots with shake detected`,
      });
    }
    if (visualStability < 75) {
      recs.push({
        category: "movement",
        suggestion: "Reduce handheld segments; prefer dolly or gimbal for product shots",
        priority: "medium",
        reason: `Visual stability ${visualStability}/100`,
      });
    }
    if (!shots.some((s) => s.framing === ShotFraming.HeroShot) && analysis.relationships.relatedProducts.length > 0) {
      recs.push({
        category: "framing",
        suggestion: "Add hero shot with push-in movement for product showcase",
        priority: "high",
        reason: "Product video without dedicated hero framing",
      });
    }
    if (!shots.some((s) => s.movement === CameraMovementType.Static)) {
      recs.push({
        category: "movement",
        suggestion: "Include static establishing shots for visual breathing room",
        priority: "low",
        reason: "No static camera segments detected",
      });
    }
    recs.push({
      category: "cinematic",
      suggestion: "Maintain 180-degree rule across scene transitions",
      priority: "low",
      reason: "Cinematic continuity best practice",
    });
    return recs;
  }
}
