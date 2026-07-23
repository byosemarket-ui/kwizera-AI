import {
  CinematicSoundPlan,
  EnvironmentalSoundPlan,
  FoleyPlan,
  SoundAnalysis,
  SoundEffectPlan,
  SoundEffectsGenerationRecord,
  SoundEffectsScores,
  SyncPreparationPlan,
  TimelinePlan,
  ProductionSfxInstructions,
} from "./types.js";
import type { SfxContext } from "./sound-effects-generation-analyzer.js";

export class SoundEffectsGenerationScorer {
  computeScores(
    analysis: SoundAnalysis,
    soundEffectPlan: SoundEffectPlan,
    foleyPlan: FoleyPlan,
    environmentalPlan: EnvironmentalSoundPlan,
    cinematicPlan: CinematicSoundPlan,
    timelinePlan: TimelinePlan,
    syncPlan: SyncPreparationPlan,
    productionInstructions: ProductionSfxInstructions,
    context: SfxContext
  ): SoundEffectsScores {
    const realismScore = this.computeRealismScore(analysis, soundEffectPlan, foleyPlan);
    const synchronizationScore = this.computeSynchronizationScore(timelinePlan, syncPlan);
    const layerQualityScore = this.computeLayerQualityScore(soundEffectPlan, environmentalPlan, cinematicPlan);
    const brandConsistencyScore = this.computeBrandConsistency(context, productionInstructions);
    const productionReadinessScore = this.computeProductionReadiness(
      analysis,
      timelinePlan,
      syncPlan,
      productionInstructions
    );

    const aiConfidenceScore = Math.round(
      (realismScore +
        synchronizationScore +
        layerQualityScore +
        brandConsistencyScore +
        productionReadinessScore) /
        5
    );

    return {
      realismScore,
      synchronizationScore,
      layerQualityScore,
      brandConsistencyScore,
      productionReadinessScore,
      aiConfidenceScore,
    };
  }

  isSoundPlanValid(
    scores: SoundEffectsScores,
    record: Pick<
      SoundEffectsGenerationRecord,
      "soundAnalysis" | "soundEffectPlan" | "foleyPlan" | "environmentalPlan" | "timelinePlan" | "syncPreparation"
    >
  ): { valid: boolean; diagnostics: string[] } {
    const diagnostics: string[] = [];

    if (scores.realismScore < 55) diagnostics.push(`Realism score ${scores.realismScore} below threshold (55)`);
    if (scores.synchronizationScore < 55) diagnostics.push(`Synchronization score ${scores.synchronizationScore} below threshold (55)`);
    if (scores.layerQualityScore < 55) diagnostics.push(`Layer quality score ${scores.layerQualityScore} below threshold (55)`);
    if (scores.brandConsistencyScore < 50) diagnostics.push(`Brand consistency score ${scores.brandConsistencyScore} below threshold (50)`);
    if (scores.productionReadinessScore < 55) diagnostics.push(`Production readiness score ${scores.productionReadinessScore} below threshold (55)`);
    if (scores.aiConfidenceScore < 55) diagnostics.push(`AI confidence score ${scores.aiConfidenceScore} below threshold (55)`);

    if (!record.soundAnalysis.scene || !record.soundAnalysis.action) {
      diagnostics.push("Sound analysis incomplete — scene/action required");
    }
    if (this.totalSoundLayers(record.soundEffectPlan) < 2) {
      diagnostics.push("Sound effect planning incomplete — minimum 2 sound layers");
    }
    if (record.foleyPlan.foleyTypes.length < 1) {
      diagnostics.push("Foley planning incomplete");
    }
    if (record.environmentalPlan.ambientLayers.length < 1) {
      diagnostics.push("Environmental planning incomplete");
    }
    if (record.timelinePlan.cuePoints.length < 3) {
      diagnostics.push("Timeline planning incomplete — minimum 3 cue points");
    }
    if (record.syncPreparation.hitPoints.length < 1) {
      diagnostics.push("Sync preparation hit points incomplete");
    }

    return { valid: diagnostics.length === 0, diagnostics };
  }

  isProductionReady(scores: SoundEffectsScores, record: SoundEffectsGenerationRecord): boolean {
    return (
      scores.productionReadinessScore >= 55 &&
      scores.realismScore >= 55 &&
      scores.synchronizationScore >= 55 &&
      record.productionInstructions.renderNotes.length >= 1 &&
      record.timelinePlan.cuePoints.length >= 3
    );
  }

  isBrandConsistent(context: SfxContext, instructions: ProductionSfxInstructions): boolean {
    if (!context.brandName) return instructions.renderNotes.length >= 1;
    return instructions.renderNotes.some((n) => n.toLowerCase().includes(context.brandName!.toLowerCase())) ||
      Boolean(context.brandGuidelines);
  }

  private totalSoundLayers(plan: SoundEffectPlan): number {
    return (
      plan.foleySounds.length +
      plan.objectSounds.length +
      plan.humanSounds.length +
      plan.natureSounds.length +
      plan.transitionSounds.length +
      plan.interfaceSounds.length
    );
  }

  private computeRealismScore(analysis: SoundAnalysis, plan: SoundEffectPlan, foley: FoleyPlan): number {
    let score = 45;
    if (analysis.objects.length >= 1) score += 15;
    if (analysis.environment.length >= 5) score += 10;
    if (foley.foleyTypes.length >= 1) score += 15;
    if (this.totalSoundLayers(plan) >= 3) score += 15;
    return Math.min(100, score);
  }

  private computeSynchronizationScore(timeline: TimelinePlan, sync: SyncPreparationPlan): number {
    let score = 45;
    if (timeline.cuePoints.length >= 3) score += 20;
    if (sync.hitPoints.length >= 1) score += 15;
    if (timeline.fadeIn && timeline.fadeOut) score += 10;
    if (sync.syncNotes.length >= 2) score += 10;
    return Math.min(100, score);
  }

  private computeLayerQualityScore(
    plan: SoundEffectPlan,
    env: EnvironmentalSoundPlan,
    cinematic: CinematicSoundPlan
  ): number {
    let score = 45;
    if (env.ambientLayers.length >= 1) score += 15;
    if (env.spatialNotes.length >= 1) score += 10;
    if (cinematic.cinematicTypes.length >= 1) score += 15;
    if (this.totalSoundLayers(plan) >= 2) score += 15;
    return Math.min(100, score);
  }

  private computeBrandConsistency(context: SfxContext, instructions: ProductionSfxInstructions): number {
    let score = 45;
    if (context.brandGuidelines) score += 20;
    if (context.brandName) score += 15;
    if (instructions.qualityTargets.length >= 2) score += 20;
    return Math.min(100, score);
  }

  private computeProductionReadiness(
    analysis: SoundAnalysis,
    timeline: TimelinePlan,
    sync: SyncPreparationPlan,
    instructions: ProductionSfxInstructions
  ): number {
    let score = 45;
    if (analysis.durationSec > 0) score += 10;
    if (timeline.layerPositions.length >= 2) score += 15;
    if (sync.hitPoints.length >= 1) score += 15;
    if (instructions.renderNotes.length >= 2) score += 15;
    return Math.min(100, score);
  }
}
