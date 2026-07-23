import type { VideoAnalysisIntelligenceRecord } from "../video-analysis-engine/types.js";
import { VideoAnalysisType } from "../video-analysis-engine/types.js";
import type { VideoUnderstandingRecord } from "../video-understanding-engine/types.js";
import { VideoSceneRole } from "../video-understanding-engine/types.js";
import {
  DetectedScene,
  DetectedShot,
  DetectedTransition,
  SceneClassification,
  SceneDetectionRecommendation,
  ScenePriority,
  SceneRelationship,
  ShotType,
  TransitionType,
} from "./types.js";

const ROLE_TO_CLASSIFICATION: Partial<Record<VideoSceneRole, SceneClassification>> = {
  [VideoSceneRole.Opening]: SceneClassification.Intro,
  [VideoSceneRole.Hook]: SceneClassification.Hook,
  [VideoSceneRole.ProductDemonstration]: SceneClassification.ProductDemo,
  [VideoSceneRole.Promotional]: SceneClassification.BrandScene,
  [VideoSceneRole.Cta]: SceneClassification.Cta,
  [VideoSceneRole.Ending]: SceneClassification.Outro,
  [VideoSceneRole.MainContent]: SceneClassification.BRoll,
};

export class SceneDetectionAnalyzer {
  detect(
    analysis: VideoAnalysisIntelligenceRecord,
    understanding?: VideoUnderstandingRecord | null
  ): {
    scenes: DetectedScene[];
    shots: DetectedShot[];
    transitions: DetectedTransition[];
    sceneRelationships: SceneRelationship[];
    recommendations: SceneDetectionRecommendation[];
    keywords: string[];
  } {
    const scenes = this.detectScenes(analysis, understanding);
    const shots = this.detectShots(analysis, scenes);
    const transitions = this.detectTransitions(scenes, shots, analysis);
    const sceneRelationships = this.buildSceneRelationships(scenes, analysis, understanding);
    const recommendations = this.buildRecommendations(scenes, shots, transitions, analysis);
    const keywords = [
      ...analysis.keywords,
      ...scenes.map((s) => s.classification),
      ...shots.map((s) => s.shotType),
      analysis.classification.videoType,
    ].filter(Boolean);

    return { scenes, shots, transitions, sceneRelationships, recommendations, keywords };
  }

  private detectScenes(
    analysis: VideoAnalysisIntelligenceRecord,
    understanding?: VideoUnderstandingRecord | null
  ): DetectedScene[] {
    const sceneSegments = analysis.timeline.segments.filter((s) => s.type === "scene");
    const durationMs = analysis.technical.durationMs;

    if (sceneSegments.length > 0) {
      return sceneSegments.map((seg, i) => {
        const understandingScene = understanding?.scenes.find((s) => s.sceneId === seg.segmentId);
        const classification = understandingScene
          ? ROLE_TO_CLASSIFICATION[understandingScene.role] ?? this.classifyByOrder(i, sceneSegments.length, analysis)
          : this.classifyByOrder(i, sceneSegments.length, analysis);

        return {
          sceneId: seg.segmentId,
          startMs: seg.startMs,
          endMs: seg.endMs,
          durationMs: seg.endMs - seg.startMs,
          order: i + 1,
          classification,
          priority: this.assignPriority(classification, i, sceneSegments.length),
          purpose: understandingScene?.description ?? this.inferPurpose(classification, analysis),
          sceneType: classification,
        };
      });
    }

    const sceneCount = Math.max(analysis.timeline.sceneCount, 3);
    const sceneDuration = durationMs > 0 ? Math.floor(durationMs / sceneCount) : 0;
    const scenes: DetectedScene[] = [];

    for (let i = 0; i < sceneCount; i++) {
      const classification = this.classifyByOrder(i, sceneCount, analysis);
      scenes.push({
        sceneId: `scene-${i + 1}`,
        startMs: i * sceneDuration,
        endMs: i === sceneCount - 1 ? durationMs : (i + 1) * sceneDuration,
        durationMs: i === sceneCount - 1 ? durationMs - i * sceneDuration : sceneDuration,
        order: i + 1,
        classification,
        priority: this.assignPriority(classification, i, sceneCount),
        purpose: this.inferPurpose(classification, analysis),
        sceneType: classification,
      });
    }
    return scenes;
  }

  private classifyByOrder(
    index: number,
    total: number,
    analysis: VideoAnalysisIntelligenceRecord
  ): SceneClassification {
    if (index === 0) return SceneClassification.Intro;
    if (index === 1) return SceneClassification.Hook;
    if (index === total - 1) return SceneClassification.Outro;
    if (index === total - 2) return SceneClassification.Cta;

    const type = analysis.classification.videoType;
    if (type === VideoAnalysisType.ProductShowcase && index === Math.floor(total / 2)) {
      return SceneClassification.ProductDemo;
    }
    if (type === VideoAnalysisType.Interview) return SceneClassification.Testimonial;
    if (type === VideoAnalysisType.Commercial || type === VideoAnalysisType.Advertisement) {
      if (index >= total - 3) return SceneClassification.BrandScene;
    }
    if (type === VideoAnalysisType.Tutorial) return SceneClassification.ProductDemo;
    return SceneClassification.BRoll;
  }

  private assignPriority(
    classification: SceneClassification,
    index: number,
    total: number
  ): ScenePriority {
    if (
      classification === SceneClassification.Hook ||
      classification === SceneClassification.Cta ||
      classification === SceneClassification.ProductDemo
    ) {
      return ScenePriority.Critical;
    }
    if (classification === SceneClassification.Intro || classification === SceneClassification.Outro) {
      return ScenePriority.High;
    }
    if (index === 0 || index === total - 1) return ScenePriority.High;
    return ScenePriority.Medium;
  }

  private inferPurpose(
    classification: SceneClassification,
    analysis: VideoAnalysisIntelligenceRecord
  ): string {
    const product = analysis.relationships.relatedProducts[0] ?? "content";
    const map: Record<SceneClassification, string> = {
      [SceneClassification.Intro]: "Establish visual context and brand tone",
      [SceneClassification.Hook]: "Capture viewer attention immediately",
      [SceneClassification.ProductDemo]: `Demonstrate ${product} features and benefits`,
      [SceneClassification.BrandScene]: "Reinforce brand identity and messaging",
      [SceneClassification.Testimonial]: "Present social proof and credibility",
      [SceneClassification.Cta]: "Drive viewer action and conversion",
      [SceneClassification.Outro]: "Close narrative with brand resolution",
      [SceneClassification.BRoll]: "Support narrative with supplementary visuals",
      [SceneClassification.Other]: "General narrative support",
    };
    return map[classification];
  }

  private detectShots(analysis: VideoAnalysisIntelligenceRecord, scenes: DetectedScene[]): DetectedShot[] {
    const shotSegments = analysis.timeline.segments.filter((s) => s.type === "shot");
    const shots: DetectedShot[] = [];

    if (shotSegments.length > 0) {
      shotSegments.forEach((seg, i) => {
        const parentScene = scenes.find((s) => seg.startMs >= s.startMs && seg.endMs <= s.endMs) ?? scenes[0];
        shots.push({
          shotId: seg.segmentId,
          sceneId: parentScene?.sceneId ?? "scene-1",
          startMs: seg.startMs,
          endMs: seg.endMs,
          durationMs: seg.endMs - seg.startMs,
          shotType: this.inferShotType(i, shotSegments.length, analysis),
          cameraChange: i > 0,
          previousShotId: i > 0 ? shotSegments[i - 1]!.segmentId : undefined,
          nextShotId: i < shotSegments.length - 1 ? shotSegments[i + 1]!.segmentId : undefined,
          relationship: i === 0 ? "opening-shot" : "continuation",
        });
      });
      return shots;
    }

    const shotCount = Math.max(analysis.timeline.shotCount, scenes.length);
    const durationMs = analysis.technical.durationMs;
    const shotDuration = durationMs > 0 ? Math.floor(durationMs / shotCount) : 0;

    for (let i = 0; i < shotCount; i++) {
      const startMs = i * shotDuration;
      const endMs = i === shotCount - 1 ? durationMs : (i + 1) * shotDuration;
      const parentScene =
        scenes.find((s) => startMs >= s.startMs && endMs <= s.endMs) ??
        scenes[Math.min(i, scenes.length - 1)]!;

      shots.push({
        shotId: `shot-${i + 1}`,
        sceneId: parentScene.sceneId,
        startMs,
        endMs,
        durationMs: endMs - startMs,
        shotType: this.inferShotType(i, shotCount, analysis),
        cameraChange: i > 0,
        previousShotId: i > 0 ? `shot-${i}` : undefined,
        nextShotId: i < shotCount - 1 ? `shot-${i + 2}` : undefined,
        relationship: i === 0 ? "opening-shot" : "continuation",
      });
    }
    return shots;
  }

  private inferShotType(index: number, total: number, analysis: VideoAnalysisIntelligenceRecord): ShotType {
    if (index === 0) return ShotType.Establishing;
    if (index === total - 1) return ShotType.Medium;
    if (analysis.classification.videoType === VideoAnalysisType.ProductShowcase && index === Math.floor(total / 2)) {
      return ShotType.CloseUp;
    }
    if (index % 3 === 0) return ShotType.Wide;
    if (index % 3 === 1) return ShotType.Medium;
    return ShotType.CloseUp;
  }

  private detectTransitions(
    scenes: DetectedScene[],
    shots: DetectedShot[],
    analysis: VideoAnalysisIntelligenceRecord
  ): DetectedTransition[] {
    const transitions: DetectedTransition[] = [];
    const candidates = analysis.frame.sceneChangeCandidates;

    for (let i = 0; i < scenes.length - 1; i++) {
      const from = scenes[i]!;
      const to = scenes[i + 1]!;
      const type = this.inferTransitionType(i, scenes.length, analysis);

      transitions.push({
        transitionId: `transition-scene-${from.sceneId}-${to.sceneId}`,
        type,
        startMs: from.endMs,
        endMs: to.startMs,
        durationMs: Math.max(0, to.startMs - from.endMs) || (type === TransitionType.Cut ? 0 : 500),
        fromSceneId: from.sceneId,
        toSceneId: to.sceneId,
        label: `${type} between ${from.classification} and ${to.classification}`,
      });
    }

    for (let i = 0; i < Math.min(shots.length - 1, candidates); i++) {
      const from = shots[i]!;
      const to = shots[i + 1]!;
      if (from.sceneId === to.sceneId) {
        transitions.push({
          transitionId: `transition-shot-${from.shotId}-${to.shotId}`,
          type: TransitionType.Cut,
          startMs: from.endMs,
          endMs: to.startMs,
          durationMs: 0,
          fromSceneId: from.sceneId,
          toSceneId: to.sceneId,
          fromShotId: from.shotId,
          toShotId: to.shotId,
          label: `Cut within scene ${from.sceneId}`,
        });
      }
    }

    return transitions;
  }

  private inferTransitionType(
    index: number,
    total: number,
    analysis: VideoAnalysisIntelligenceRecord
  ): TransitionType {
    if (index === 0) return TransitionType.Fade;
    if (index === total - 2) return TransitionType.Dissolve;
    if (analysis.visual.motionDensity > 70) return TransitionType.Cut;
    if (analysis.classification.videoType === VideoAnalysisType.SocialMedia) return TransitionType.ZoomTransition;
    if (index % 4 === 0) return TransitionType.Wipe;
    return TransitionType.Cut;
  }

  private buildSceneRelationships(
    scenes: DetectedScene[],
    analysis: VideoAnalysisIntelligenceRecord,
    understanding?: VideoUnderstandingRecord | null
  ): SceneRelationship[] {
    return scenes.map((scene, i) => {
      const relatedSceneIds: string[] = [];
      if (scenes[i - 1]) relatedSceneIds.push(scenes[i - 1]!.sceneId);
      if (scenes[i + 1]) relatedSceneIds.push(scenes[i + 1]!.sceneId);

      for (const other of scenes) {
        if (other.sceneId === scene.sceneId) continue;
        if (other.classification === scene.classification) {
          relatedSceneIds.push(other.sceneId);
        }
      }

      return {
        sceneId: scene.sceneId,
        previousSceneId: scenes[i - 1]?.sceneId,
        nextSceneId: scenes[i + 1]?.sceneId,
        relatedSceneIds: [...new Set(relatedSceneIds)],
        relatedProducts: analysis.relationships.relatedProducts,
        relatedBrands: analysis.relationships.relatedBrands,
        relatedCampaigns: analysis.relationships.relatedCampaigns,
        relatedStoryboards: understanding?.relationships.relatedStoryboards ?? [],
        relatedScripts: understanding?.relationships.relatedScripts ?? [],
        timelineId: `timeline-${analysis.videoId}`,
      };
    });
  }

  private buildRecommendations(
    scenes: DetectedScene[],
    shots: DetectedShot[],
    transitions: DetectedTransition[],
    analysis: VideoAnalysisIntelligenceRecord
  ): SceneDetectionRecommendation[] {
    const recs: SceneDetectionRecommendation[] = [];

    if (scenes.length < 3) {
      recs.push({
        category: "scene",
        suggestion: "Consider adding more scene variety for richer editing structure",
        priority: "medium",
        reason: `Only ${scenes.length} scene(s) detected`,
      });
    }
    if (shots.length < scenes.length) {
      recs.push({
        category: "shot",
        suggestion: "Increase shot diversity within scenes for dynamic pacing",
        priority: "medium",
        reason: `${shots.length} shots across ${scenes.length} scenes`,
      });
    }
    if (transitions.every((t) => t.type === TransitionType.Cut)) {
      recs.push({
        category: "transition",
        suggestion: "Add fade or dissolve transitions for smoother scene changes",
        priority: "low",
        reason: "All transitions detected as hard cuts",
      });
    }
    if (analysis.frame.missingFrames > 0) {
      recs.push({
        category: "timeline",
        suggestion: "Re-encode source to fix frame gaps affecting timeline accuracy",
        priority: "high",
        reason: `${analysis.frame.missingFrames} missing frame(s) in analysis`,
      });
    }
    if (!scenes.some((s) => s.classification === SceneClassification.Cta)) {
      recs.push({
        category: "classification",
        suggestion: "Add dedicated CTA scene for marketing conversion",
        priority: "medium",
        reason: "No CTA scene classified",
      });
    }

    return recs;
  }
}
