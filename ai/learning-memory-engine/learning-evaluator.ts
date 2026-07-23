import { LearningEventInput, LearningOutcome, LearningSource } from "./types.js";

const MIN_QUALITY_THRESHOLD = 50;
const MIN_FAILURE_LESSON_THRESHOLD = 35;

export interface EvaluationResult {
  approved: boolean;
  confidenceScore: number;
  learningValue: number;
  reason?: string;
  verified: boolean;
}

export class LearningEvaluator {
  evaluate(input: LearningEventInput): EvaluationResult {
    const quality = input.qualityScore ?? this.estimateQuality(input);
    const isFailure = input.outcome === LearningOutcome.Failure;
    const hasLesson = Boolean(input.lessonLearned?.trim());

    if (quality < MIN_QUALITY_THRESHOLD) {
      if (isFailure && hasLesson && quality >= MIN_FAILURE_LESSON_THRESHOLD) {
        return {
          approved: true,
          confidenceScore: Math.min(quality, 70),
          learningValue: 60,
          reason: "Failure lesson with sufficient value",
          verified: true,
        };
      }
      return {
        approved: false,
        confidenceScore: quality,
        learningValue: 0,
        reason: "Quality too low for learning",
        verified: false,
      };
    }

    const confidenceScore = Math.min(100, quality + (input.userFeedback ? 10 : 0));
    const learningValue = this.computeLearningValue(input, quality);

    return {
      approved: true,
      confidenceScore,
      learningValue,
      verified: confidenceScore >= 55,
    };
  }

  private estimateQuality(input: LearningEventInput): number {
    let score = 60;
    if (input.description.length > 50) score += 10;
    if (input.relatedProject) score += 10;
    if (input.outcome === LearningOutcome.Success) score += 15;
    if (input.outcome === LearningOutcome.Failure && input.lessonLearned) score += 10;
    if (input.userFeedback) score += 5;
    return Math.min(100, score);
  }

  private computeLearningValue(input: LearningEventInput, quality: number): number {
    let value = quality * 0.6;

    const highValueSources: LearningSource[] = [
      LearningSource.UserCorrection,
      LearningSource.UserFeedback,
      LearningSource.WorkflowHistory,
      LearningSource.DecisionHistory,
    ];

    if (highValueSources.includes(input.source)) value += 20;
    if (input.outcome === LearningOutcome.Success) value += 10;
    if (input.patterns?.length) value += input.patterns.length * 5;

    return Math.min(100, Math.round(value));
  }
}
