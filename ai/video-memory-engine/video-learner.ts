import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { LearningCategory, LearningOutcome, LearningSource } from "../learning-memory-engine/types.js";
import { VideoMemoryLogger } from "./video-logger.js";
import { VideoLearningResult, VideoRecord } from "./types.js";

export class VideoLearner {
  constructor(
    private readonly foundation: AiMemoryFoundation,
    private readonly logger: VideoMemoryLogger
  ) {}

  async learnFromCompletedVideo(
    video: VideoRecord,
    patternsStored: number
  ): Promise<VideoLearningResult> {
    const strengths = this.identifyStrengths(video);
    const weaknesses = this.identifyWeaknesses(video);

    const learningEngine = this.foundation.getLearningMemoryEngine();
    const learnResult = await learningEngine.learnFromEvent({
      source: LearningSource.Video,
      category: LearningCategory.Video,
      title: `Video completed: ${video.videoName}`,
      description: this.buildLearningDescription(video, strengths, weaknesses),
      relatedProject: video.projectId,
      outcome: LearningOutcome.Success,
      qualityScore: video.scores.videoQualityScore,
      lessonLearned: video.lessonsLearned.join("; ") || undefined,
      patterns: video.patterns.map((p) => p.patternType),
      metadata: {
        videoId: video.videoId,
        marketingScore: video.scores.marketingScore,
        userSatisfaction: video.scores.userSatisfaction,
      },
    });

    this.logger.log("info", "learning", "Video learning recorded", {
      videoId: video.videoId,
      learningId: learnResult.learningId,
      patterns: patternsStored,
    });

    return {
      success: learnResult.success,
      videoId: video.videoId,
      patternsStored,
      learningId: learnResult.learningId,
      strengths,
      weaknesses,
    };
  }

  private identifyStrengths(video: VideoRecord): string[] {
    const strengths: string[] = [];
    if (video.scores.videoQualityScore >= 70) strengths.push("High video quality");
    if (video.scores.marketingScore >= 70) strengths.push("Strong marketing structure");
    if (video.scenes.length >= 3) strengths.push(`Effective ${video.scenes.length}-scene structure`);
    if (video.marketing.hook) strengths.push(`Compelling hook: ${video.marketing.hook.slice(0, 50)}`);
    if (video.patterns.length > 0) strengths.push(`${video.patterns.length} reusable pattern(s) detected`);
    if (video.scores.userSatisfaction >= 80) strengths.push("High user satisfaction");
    return strengths;
  }

  private identifyWeaknesses(video: VideoRecord): string[] {
    const weaknesses: string[] = [];
    if (video.scores.videoQualityScore < 50) weaknesses.push("Video quality below threshold");
    if (!video.marketing.callToAction) weaknesses.push("Missing call to action");
    if (video.scenes.length < 2) weaknesses.push("Insufficient scene structure");
    if (!video.audio.narration && !video.audio.backgroundMusic) weaknesses.push("No audio elements");
    if (video.scores.exportQuality < 50) weaknesses.push("No export completed");
    return weaknesses;
  }

  private buildLearningDescription(
    video: VideoRecord,
    strengths: string[],
    weaknesses: string[]
  ): string {
    return [
      `Completed promotional video "${video.videoName}" for project ${video.projectId}.`,
      `Brand: ${video.brand}, Category: ${video.category}, Duration: ${video.duration}s.`,
      strengths.length > 0 ? `Strengths: ${strengths.join("; ")}.` : "",
      weaknesses.length > 0 ? `Areas to improve: ${weaknesses.join("; ")}.` : "",
    ]
      .filter(Boolean)
      .join(" ");
  }
}
