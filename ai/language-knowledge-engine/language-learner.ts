import crypto from "node:crypto";
import { LanguageAnalysisRecord, LanguageKnowledgeLearningPattern } from "./types.js";
import { LanguagePatternStore } from "./language-stores.js";
import { LanguageKnowledgeLogger } from "./language-logger.js";

export class LanguageLearner {
  constructor(
    private readonly patterns: LanguagePatternStore,
    private readonly logger: LanguageKnowledgeLogger
  ) {}

  learnFromAnalysis(record: LanguageAnalysisRecord): LanguageKnowledgeLearningPattern[] {
    const learned: LanguageKnowledgeLearningPattern[] = [];

    if (record.scores.grammarScore >= 78) {
      learned.push(
        this.createPattern(
          record,
          "grammar",
          `${record.language}: grammar ${record.scores.grammarScore}, tone ${record.grammar.tone}`,
          record.scores.grammarScore
        )
      );
    }

    if (record.scores.marketingScore >= 75) {
      learned.push(
        this.createPattern(
          record,
          "marketing",
          `${record.language} marketing: ${record.writingStyle}, ${record.marketing.headlines.length} headlines`,
          record.scores.marketingScore
        )
      );
    }

    if (record.scores.subtitleQualityScore >= 80) {
      learned.push(
        this.createPattern(
          record,
          "subtitle",
          `Subtitles: ${record.subtitles.subtitleText.length} lines, sync ${record.subtitles.syncQuality}`,
          record.scores.subtitleQualityScore
        )
      );
    }

    if (record.scores.translationReadinessScore >= 78) {
      learned.push(
        this.createPattern(
          record,
          "localization",
          `Localization ready: ${record.localization.relatedLanguages.join(", ")}`,
          record.scores.translationReadinessScore
        )
      );
    }

    if (record.voice.voiceOverScripts.length >= 1) {
      learned.push(
        this.createPattern(
          record,
          "voice",
          `Voice: ${record.voice.narrationStyle}, ${record.voice.speakingTone}`,
          record.scores.readabilityScore
        )
      );
    }

    learned.push(
      this.createPattern(
        record,
        "style",
        `Preferred style: ${record.writingStyle} for ${record.audience}`,
        record.scores.aiConfidenceScore
      )
    );

    if (record.scriptType) {
      learned.push(
        this.createPattern(
          record,
          "script",
          `Script type ${record.scriptType}: ${record.content.slice(0, 50)}...`,
          record.scores.marketingScore
        )
      );
    }

    for (const pattern of learned) {
      this.patterns.add(pattern);
    }

    if (learned.length > 0) {
      this.logger.log("info", "learning", "Language patterns learned", {
        languageId: record.languageId,
        patterns: learned.length,
      });
    }

    return learned;
  }

  private createPattern(
    record: LanguageAnalysisRecord,
    patternType: LanguageKnowledgeLearningPattern["patternType"],
    description: string,
    confidence: number
  ): LanguageKnowledgeLearningPattern {
    return {
      patternId: `lkpat-${crypto.randomBytes(4).toString("hex")}`,
      patternType,
      description,
      sourceLanguageId: record.languageId,
      confidence: Math.min(100, confidence),
      detectedAt: new Date().toISOString(),
    };
  }
}
