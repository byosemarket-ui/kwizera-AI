import {
  VideoAudioAnalysis,
  VideoFrameAnalysis,
  VideoProductionReadiness,
  VideoQualityScores,
  VideoTechnicalProfile,
  VideoTimelineAnalysis,
  VideoVisualAnalysis,
} from "./types.js";

export class VideoAnalysisScorer {
  computeScores(
    technical: VideoTechnicalProfile,
    frame: VideoFrameAnalysis,
    timeline: VideoTimelineAnalysis,
    audio: VideoAudioAnalysis,
    visual: VideoVisualAnalysis,
    missingFields: string[]
  ): { scores: VideoQualityScores; productionReadiness: VideoProductionReadiness } {
    const totalFields = 22;
    const filledFields = totalFields - missingFields.length;
    const videoCompletenessScore = Math.round(
      Math.max(0, Math.min(100, (filledFields / totalFields) * 100))
    );

    let technicalQualityScore = 60;
    if (technical.width >= 1920 && technical.height >= 1080) technicalQualityScore += 15;
    else if (technical.width >= 1280) technicalQualityScore += 8;
    if (technical.fps >= 24) technicalQualityScore += 8;
    if (technical.bitrateKbps >= 5000) technicalQualityScore += 7;
    if (technical.durationMs > 0 && technical.durationMs < 600_000) technicalQualityScore += 5;
    if (Object.keys(technical.metadata).length > 0) technicalQualityScore += 5;
    technicalQualityScore = Math.min(100, technicalQualityScore);

    let frameQualityScore = 65;
    if (frame.frameConsistencyScore >= 80) frameQualityScore += 12;
    if (frame.missingFrames === 0) frameQualityScore += 8;
    if (frame.corruptedFrames === 0) frameQualityScore += 7;
    if (frame.keyFrames > 0) frameQualityScore += 5;
    if (frame.motionDensity >= 30 && frame.motionDensity <= 80) frameQualityScore += 5;
    frameQualityScore = Math.min(100, frameQualityScore);

    const audioQualityScore = Math.min(100, audio.overallAudioQualityScore || 70);

    let visualQualityScore = 60;
    if (visual.sharpness >= 70) visualQualityScore += 12;
    if (visual.brightness >= 40 && visual.brightness <= 80) visualQualityScore += 8;
    if (visual.contrast >= 50) visualQualityScore += 8;
    if (visual.visualStability >= 70) visualQualityScore += 7;
    if (visual.dominantColors.length >= 2) visualQualityScore += 5;
    visualQualityScore = Math.min(100, visualQualityScore);

    const productionReadiness: VideoProductionReadiness = {
      editingReadiness: Math.min(
        100,
        Math.round(frameQualityScore * 0.4 + technicalQualityScore * 0.35 + (timeline.sceneCount > 0 ? 25 : 10))
      ),
      aiGenerationReadiness: Math.min(
        100,
        Math.round(visualQualityScore * 0.45 + frameQualityScore * 0.35 + 20)
      ),
      marketingReadiness: Math.min(
        100,
        Math.round(visualQualityScore * 0.4 + audioQualityScore * 0.3 + 30)
      ),
      productionReadiness: Math.min(
        100,
        Math.round(
          (technicalQualityScore + frameQualityScore + audioQualityScore + visualQualityScore) / 4
        )
      ),
      renderingReadiness: Math.min(
        100,
        Math.round(technicalQualityScore * 0.55 + frameQualityScore * 0.25 + 20)
      ),
      exportReadiness: Math.min(100, Math.round(technicalQualityScore * 0.65 + 20)),
    };

    const productionReadinessScore = Math.round(
      (productionReadiness.editingReadiness +
        productionReadiness.productionReadiness +
        productionReadiness.exportReadiness) /
        3
    );

    let aiConfidenceScore = 55;
    if (technical.resolution) aiConfidenceScore += 10;
    if (frame.keyFrames > 0) aiConfidenceScore += 8;
    if (audio.tracks.length > 0) aiConfidenceScore += 8;
    if (visual.dominantColors.length >= 2) aiConfidenceScore += 7;
    if (timeline.sceneCount > 0) aiConfidenceScore += 7;
    if (missingFields.length <= 6) aiConfidenceScore += 5;
    aiConfidenceScore = Math.min(100, aiConfidenceScore);

    return {
      scores: {
        videoCompletenessScore,
        technicalQualityScore,
        frameQualityScore,
        audioQualityScore,
        visualQualityScore,
        productionReadinessScore,
        aiConfidenceScore,
      },
      productionReadiness,
    };
  }

  isAnalysisValid(
    scores: VideoQualityScores,
    missingFields: string[],
    criticallyIncomplete: boolean
  ): { valid: boolean; diagnostics: string[] } {
    const diagnostics: string[] = [];

    if (criticallyIncomplete) {
      diagnostics.push("Critical video fields missing — analysis rejected");
    }
    if (scores.videoCompletenessScore < 45) {
      diagnostics.push(
        `Video completeness score ${scores.videoCompletenessScore} below minimum threshold (45)`
      );
    }
    if (scores.technicalQualityScore < 50) {
      diagnostics.push(
        `Technical quality score ${scores.technicalQualityScore} below minimum threshold (50)`
      );
    }
    if (scores.frameQualityScore < 50) {
      diagnostics.push(`Frame quality score ${scores.frameQualityScore} below minimum threshold (50)`);
    }
    if (scores.aiConfidenceScore < 55) {
      diagnostics.push(`AI confidence ${scores.aiConfidenceScore} below minimum threshold (55)`);
    }
    if (missingFields.includes("videoName") || missingFields.includes("filePath")) {
      diagnostics.push("Video name and file path are required for validated analysis");
    }

    return { valid: diagnostics.length === 0, diagnostics };
  }

  buildRecommendations(
    scores: VideoQualityScores,
    frame: VideoFrameAnalysis,
    audio: VideoAudioAnalysis
  ): import("./types.js").VideoAnalysisRecommendation[] {
    const recs: import("./types.js").VideoAnalysisRecommendation[] = [];
    if (scores.technicalQualityScore < 75) {
      recs.push({
        category: "technical",
        suggestion: "Increase resolution or bitrate for production-grade output",
        priority: "medium",
        reason: `Technical score ${scores.technicalQualityScore}/100`,
      });
    }
    if (frame.missingFrames > 0) {
      recs.push({
        category: "frame",
        suggestion: "Re-encode source to fix missing frames",
        priority: "high",
        reason: `${frame.missingFrames} missing frame(s) detected`,
      });
    }
    if (audio.overallAudioQualityScore < 70) {
      recs.push({
        category: "audio",
        suggestion: "Improve audio mix and loudness normalization",
        priority: "medium",
        reason: `Audio quality ${audio.overallAudioQualityScore}/100`,
      });
    }
    if (scores.productionReadinessScore < 75) {
      recs.push({
        category: "production",
        suggestion: "Complete timeline segmentation before production handoff",
        priority: "medium",
        reason: `Production readiness ${scores.productionReadinessScore}/100`,
      });
    }
    return recs;
  }
}
