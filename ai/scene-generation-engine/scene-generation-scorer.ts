import type { StoryboardGenerationRecord } from "../story-generation-engine/types.js";
import { SceneGenerationRecord, SceneGenerationScores, SceneStructure } from "./types.js";

export class SceneGenerationScorer {
  computeScores(
    record: Omit<
      SceneGenerationRecord,
      "scores" | "relationships" | "recommendations" | "validated" | "productionReady" | "marketingReady" | "brandConsistent" | "createdAt" | "lastUpdated"
    >,
    storyboard: StoryboardGenerationRecord
  ): SceneGenerationScores {
    const sceneQualityScore = this.computeSceneQuality(record.structure, record.shots.length);
    const compositionScore = this.computeCompositionScore(record.visualPlan, record.layout);
    const cinematicScore = this.computeCinematicScore(record.shots, record.cameraPlanning, record.motionPlanning);
    const brandConsistencyScore = this.computeBrandScore(record.visualPlan, storyboard);
    const productionReadinessScore = this.computeProductionReadiness(record);
    const aiConfidenceScore = Math.round(
      (sceneQualityScore + compositionScore + cinematicScore + brandConsistencyScore + productionReadinessScore) / 5
    );

    return {
      sceneQualityScore,
      compositionScore,
      cinematicScore,
      brandConsistencyScore,
      productionReadinessScore,
      aiConfidenceScore,
    };
  }

  isSceneValid(scores: SceneGenerationScores, record: Pick<SceneGenerationRecord, "structure" | "shots">): {
    valid: boolean;
    diagnostics: string[];
  } {
    const diagnostics: string[] = [];

    if (record.shots.length < 1) diagnostics.push("Scene must have at least one shot");
    if (!record.structure.scenePurpose) diagnostics.push("Scene purpose required");
    if (!record.structure.sceneDuration) diagnostics.push("Scene duration required");
    if (scores.sceneQualityScore < 55) {
      diagnostics.push(`Scene quality score ${scores.sceneQualityScore} below threshold (55)`);
    }
    if (scores.compositionScore < 50) {
      diagnostics.push(`Composition score ${scores.compositionScore} below threshold (50)`);
    }
    if (scores.cinematicScore < 50) {
      diagnostics.push(`Cinematic score ${scores.cinematicScore} below threshold (50)`);
    }
    if (scores.brandConsistencyScore < 50) {
      diagnostics.push(`Brand consistency score ${scores.brandConsistencyScore} below threshold (50)`);
    }
    if (scores.productionReadinessScore < 55) {
      diagnostics.push(`Production readiness score ${scores.productionReadinessScore} below threshold (55)`);
    }
    if (scores.aiConfidenceScore < 55) {
      diagnostics.push(`AI confidence score ${scores.aiConfidenceScore} below threshold (55)`);
    }

    return { valid: diagnostics.length === 0, diagnostics };
  }

  isProductionReady(scores: SceneGenerationScores, record: Pick<SceneGenerationRecord, "shots" | "visualPlan" | "audioPlanning">): boolean {
    return (
      record.shots.length >= 1 &&
      scores.productionReadinessScore >= 55 &&
      record.visualPlan.composition.length >= 10 &&
      record.audioPlanning.voiceTiming.length >= 5
    );
  }

  isMarketingReady(structure: SceneStructure): boolean {
    return structure.sceneObjectives.length >= 1 && structure.scenePurpose.length >= 3;
  }

  isBrandConsistent(scores: SceneGenerationScores): boolean {
    return scores.brandConsistencyScore >= 50;
  }

  private computeSceneQuality(structure: SceneStructure, shotCount: number): number {
    let score = 45;
    if (structure.sceneObjectives.length >= 1) score += 15;
    if (structure.sceneDuration) score += 10;
    if (shotCount >= 2) score += 15;
    if (structure.scenePriority === "critical" || structure.scenePriority === "high") score += 15;
    return Math.min(100, score);
  }

  private computeCompositionScore(
    visualPlan: SceneGenerationRecord["visualPlan"],
    layout: SceneGenerationRecord["layout"]
  ): number {
    let score = 40;
    if (visualPlan.composition && visualPlan.lighting) score += 15;
    if (visualPlan.background && visualPlan.colorStyle) score += 15;
    if (visualPlan.productPlacement && visualPlan.logoPlacement) score += 15;
    if (layout.depthLayers.length >= 3) score += 15;
    return Math.min(100, score);
  }

  private computeCinematicScore(
    shots: SceneGenerationRecord["shots"],
    cameraPlanning: SceneGenerationRecord["cameraPlanning"],
    motionPlanning: SceneGenerationRecord["motionPlanning"]
  ): number {
    let score = 40;
    if (shots.every((s) => s.cameraAngle && s.cameraMovement && s.focusPoint)) score += 20;
    if (cameraPlanning.coverageNotes.length >= 10) score += 20;
    if (motionPlanning.subjectMotion && motionPlanning.cameraMotion) score += 20;
    return Math.min(100, score);
  }

  private computeBrandScore(
    visualPlan: SceneGenerationRecord["visualPlan"],
    storyboard: StoryboardGenerationRecord
  ): number {
    let score = 45;
    if (visualPlan.logoPlacement && visualPlan.colorStyle) score += 20;
    if (visualPlan.typographyPlacement) score += 15;
    if (storyboard.brandConsistent) score += 20;
    return Math.min(100, score);
  }

  private computeProductionReadiness(
    record: Omit<
      SceneGenerationRecord,
      "scores" | "relationships" | "recommendations" | "validated" | "productionReady" | "marketingReady" | "brandConsistent" | "createdAt" | "lastUpdated"
    >
  ): number {
    let score = 45;
    if (record.shots.length >= 1) score += 15;
    if (record.audioPlanning.audioSynchronization) score += 10;
    if (record.transitionPlanning.sceneTransition) score += 10;
    if (record.platformOptimizations.length >= 7) score += 10;
    if (record.characterPlanning && record.objectPlanning) score += 10;
    return Math.min(100, score);
  }
}
