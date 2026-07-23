import {
  ImageCompletenessScores,
  ImageContentPreparation,
  ImageTechnicalProfile,
  ImageVisualAnalysis,
} from "./types.js";

export class ImageAnalysisScorer {
  computeScores(
    technical: ImageTechnicalProfile,
    visual: ImageVisualAnalysis,
    content: ImageContentPreparation,
    missingFields: string[]
  ): ImageCompletenessScores {
    const totalFields = 18;
    const filledFields = totalFields - missingFields.length;
    const imageCompletenessScore = Math.round(
      Math.max(0, Math.min(100, (filledFields / totalFields) * 100))
    );

    let technicalQualityScore = 65;
    if (technical.width >= 1920 && technical.height >= 1080) technicalQualityScore += 15;
    else if (technical.width >= 1280) technicalQualityScore += 8;
    if (technical.bitDepth >= 8) technicalQualityScore += 5;
    if (technical.fileSizeBytes > 0 && technical.fileSizeBytes < 20_000_000) technicalQualityScore += 7;
    if (Object.keys(technical.metadata).length > 0) technicalQualityScore += 5;
    technicalQualityScore = Math.min(100, technicalQualityScore);

    let visualQualityScore = 60;
    if (visual.sharpness >= 70) visualQualityScore += 12;
    if (visual.brightness >= 40 && visual.brightness <= 80) visualQualityScore += 8;
    if (visual.contrast >= 50) visualQualityScore += 8;
    if (visual.dominantColors.length >= 2) visualQualityScore += 7;
    if (visual.noiseLevel <= 30) visualQualityScore += 5;
    visualQualityScore = Math.min(100, visualQualityScore);

    let analysisConfidenceScore = 55;
    if (content.background) analysisConfidenceScore += 10;
    if (content.products.length > 0 || content.logos.length > 0) analysisConfidenceScore += 10;
    if (visual.dominantColors.length >= 2) analysisConfidenceScore += 10;
    if (technical.resolution) analysisConfidenceScore += 8;
    if (missingFields.length <= 5) analysisConfidenceScore += 7;
    analysisConfidenceScore = Math.min(100, analysisConfidenceScore);

    return {
      imageCompletenessScore,
      technicalQualityScore,
      visualQualityScore,
      analysisConfidenceScore,
    };
  }

  isAnalysisValid(
    scores: ImageCompletenessScores,
    missingFields: string[],
    criticallyIncomplete: boolean
  ): { valid: boolean; diagnostics: string[] } {
    const diagnostics: string[] = [];

    if (criticallyIncomplete) {
      diagnostics.push("Critical image fields missing — analysis rejected");
    }
    if (scores.imageCompletenessScore < 45) {
      diagnostics.push(`Image completeness score ${scores.imageCompletenessScore} below minimum threshold (45)`);
    }
    if (scores.technicalQualityScore < 50) {
      diagnostics.push(`Technical quality score ${scores.technicalQualityScore} below minimum threshold (50)`);
    }
    if (scores.visualQualityScore < 50) {
      diagnostics.push(`Visual quality score ${scores.visualQualityScore} below minimum threshold (50)`);
    }
    if (scores.analysisConfidenceScore < 55) {
      diagnostics.push(`Analysis confidence ${scores.analysisConfidenceScore} below minimum threshold (55)`);
    }
    if (missingFields.includes("imageName") || missingFields.includes("filePath")) {
      diagnostics.push("Image name and file path are required for validated analysis");
    }

    return { valid: diagnostics.length === 0, diagnostics };
  }
}
