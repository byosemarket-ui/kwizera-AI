import {
  KnowledgeSupportedLanguage,
  LanguageAnalysisInput,
  LanguageGrammarKnowledge,
  LanguageLocalizationKnowledge,
  LanguageMarketingGoal,
  LanguageMarketingKnowledge,
  LanguageScriptType,
  LanguageSubtitleKnowledge,
  LanguageVoiceKnowledge,
  LanguageWritingStyle,
} from "./types.js";

const LANGUAGE_DEFAULTS: Record<
  KnowledgeSupportedLanguage,
  { tone: string; readingSpeed: string; relatedLanguages: KnowledgeSupportedLanguage[] }
> = {
  [KnowledgeSupportedLanguage.Kinyarwanda]: {
    tone: "warm-respectful",
    readingSpeed: "moderate",
    relatedLanguages: [KnowledgeSupportedLanguage.Swahili, KnowledgeSupportedLanguage.French],
  },
  [KnowledgeSupportedLanguage.English]: {
    tone: "clear-professional",
    readingSpeed: "moderate-fast",
    relatedLanguages: [KnowledgeSupportedLanguage.French, KnowledgeSupportedLanguage.Swahili],
  },
  [KnowledgeSupportedLanguage.French]: {
    tone: "elegant-formal",
    readingSpeed: "moderate",
    relatedLanguages: [KnowledgeSupportedLanguage.English, KnowledgeSupportedLanguage.Kinyarwanda],
  },
  [KnowledgeSupportedLanguage.Swahili]: {
    tone: "friendly-inclusive",
    readingSpeed: "moderate",
    relatedLanguages: [KnowledgeSupportedLanguage.Kinyarwanda, KnowledgeSupportedLanguage.English],
  },
  [KnowledgeSupportedLanguage.Arabic]: {
    tone: "formal-expressive",
    readingSpeed: "moderate",
    relatedLanguages: [KnowledgeSupportedLanguage.French, KnowledgeSupportedLanguage.English],
  },
  [KnowledgeSupportedLanguage.Spanish]: {
    tone: "warm-energetic",
    readingSpeed: "moderate-fast",
    relatedLanguages: [KnowledgeSupportedLanguage.Portuguese, KnowledgeSupportedLanguage.English],
  },
  [KnowledgeSupportedLanguage.Portuguese]: {
    tone: "warm-professional",
    readingSpeed: "moderate",
    relatedLanguages: [KnowledgeSupportedLanguage.Spanish, KnowledgeSupportedLanguage.English],
  },
  [KnowledgeSupportedLanguage.German]: {
    tone: "precise-formal",
    readingSpeed: "moderate",
    relatedLanguages: [KnowledgeSupportedLanguage.English, KnowledgeSupportedLanguage.French],
  },
  [KnowledgeSupportedLanguage.Chinese]: {
    tone: "concise-formal",
    readingSpeed: "moderate",
    relatedLanguages: [KnowledgeSupportedLanguage.Japanese, KnowledgeSupportedLanguage.English],
  },
  [KnowledgeSupportedLanguage.Japanese]: {
    tone: "polite-refined",
    readingSpeed: "moderate",
    relatedLanguages: [KnowledgeSupportedLanguage.Chinese, KnowledgeSupportedLanguage.English],
  },
  [KnowledgeSupportedLanguage.Future]: {
    tone: "adaptive",
    readingSpeed: "variable",
    relatedLanguages: [KnowledgeSupportedLanguage.English],
  },
};

export class LanguageAnalyzer {
  analyze(input: LanguageAnalysisInput): {
    language: KnowledgeSupportedLanguage;
    detectedLanguage: KnowledgeSupportedLanguage;
    topic: string;
    industry: string;
    brandName: string;
    productName: string;
    audience: string;
    marketingGoal: LanguageMarketingGoal;
    writingStyle: LanguageWritingStyle;
    scriptType: LanguageScriptType;
    content: string;
    grammar: LanguageGrammarKnowledge;
    marketing: LanguageMarketingKnowledge;
    voice: LanguageVoiceKnowledge;
    subtitles: LanguageSubtitleKnowledge;
    localization: LanguageLocalizationKnowledge;
  } {
    const language = input.language;
    const defaults = LANGUAGE_DEFAULTS[language];
    const content = input.content ?? this.defaultContent(input);
    const brandName = input.brandName ?? "KWIZERA";
    const productName = input.productName ?? "KWIZERA Pro";

    const grammar: LanguageGrammarKnowledge = {
      grammarScore: input.grammar?.grammarScore ?? this.estimateGrammarScore(content),
      sentenceStructure: input.grammar?.sentenceStructure ?? "subject-verb-object",
      vocabularyLevel: input.grammar?.vocabularyLevel ?? "professional",
      tone: input.grammar?.tone ?? defaults.tone,
      issues: input.grammar?.issues ?? this.detectGrammarIssues(content),
    };

    const marketing: LanguageMarketingKnowledge = {
      headlines: input.marketing?.headlines ?? [content.slice(0, 80)],
      hooks: input.marketing?.hooks ?? [content.split(".")[0] ?? content.slice(0, 60)],
      callToActions: input.marketing?.callToActions ?? ["Get Started Today"],
      productDescriptions: input.marketing?.productDescriptions ?? [
        `${productName} — professional creative solution by ${brandName}`,
      ],
      promotionalScripts: input.marketing?.promotionalScripts ?? [content],
      socialCaptions: input.marketing?.socialCaptions ?? [content.slice(0, 150)],
      advertisements: input.marketing?.advertisements ?? [content],
      emailMarketing: input.marketing?.emailMarketing ?? [content],
      websiteContent: input.marketing?.websiteContent ?? [content],
    };

    const voice: LanguageVoiceKnowledge = {
      voiceOverScripts: input.voice?.voiceOverScripts ?? [content],
      narrationStyle: input.voice?.narrationStyle ?? "professional-narrator",
      speakingTone: input.voice?.speakingTone ?? defaults.tone,
      emotionalTone: input.voice?.emotionalTone ?? "confident-inspiring",
      readingSpeed: input.voice?.readingSpeed ?? defaults.readingSpeed,
      subtitleSynchronization: input.voice?.subtitleSynchronization ?? "sync-to-narration-beats",
    };

    const subtitles: LanguageSubtitleKnowledge = {
      subtitleText: input.subtitles?.subtitleText ?? this.splitForSubtitles(content),
      captionText: input.subtitles?.captionText ?? this.splitForSubtitles(content),
      timingMarkers: input.subtitles?.timingMarkers ?? ["0:00", "0:03", "0:06", "0:10"],
      syncQuality: input.subtitles?.syncQuality ?? 85,
      readabilityOnScreen: input.subtitles?.readabilityOnScreen ?? 88,
    };

    const localization: LanguageLocalizationKnowledge = {
      translationReadiness: input.localization?.translationReadiness ?? 80,
      localizationReadiness: input.localization?.localizationReadiness ?? 78,
      relatedLanguages:
        input.localization?.relatedLanguages ?? defaults.relatedLanguages,
      culturalNotes: input.localization?.culturalNotes ?? [
        `Adapt messaging for ${language} cultural context`,
      ],
    };

    return {
      language,
      detectedLanguage: input.detectedLanguage ?? this.detectLanguage(content, language),
      topic: input.topic ?? "marketing-promotion",
      industry: input.industry ?? "creative-technology",
      brandName,
      productName,
      audience: input.audience ?? "creative professionals",
      marketingGoal: input.marketingGoal ?? LanguageMarketingGoal.Conversion,
      writingStyle: input.writingStyle ?? LanguageWritingStyle.Marketing,
      scriptType: input.scriptType ?? LanguageScriptType.PromotionalScript,
      content,
      grammar,
      marketing,
      voice,
      subtitles,
      localization,
    };
  }

  detectLanguage(text: string, hint?: KnowledgeSupportedLanguage): KnowledgeSupportedLanguage {
    if (hint) return hint;
    const lower = text.toLowerCase();
    if (/\b(murakoze|amahoro|ubuzima)\b/.test(lower)) return KnowledgeSupportedLanguage.Kinyarwanda;
    if (/\b(bonjour|merci|créatif)\b/.test(lower)) return KnowledgeSupportedLanguage.French;
    if (/\b(asante|karibu|ubunifu)\b/.test(lower)) return KnowledgeSupportedLanguage.Swahili;
    if (/\b(hola|gracias|creativo)\b/.test(lower)) return KnowledgeSupportedLanguage.Spanish;
    return KnowledgeSupportedLanguage.English;
  }

  private defaultContent(input: LanguageAnalysisInput): string {
    const product = input.productName ?? "KWIZERA Pro";
    const brand = input.brandName ?? "KWIZERA";
    switch (input.scriptType) {
      case LanguageScriptType.Headline:
        return `Transform your creative workflow with ${product}`;
      case LanguageScriptType.Hook:
        return `What if you could create professional content in minutes?`;
      case LanguageScriptType.Cta:
        return `Start your free trial — create smarter with ${brand}`;
      case LanguageScriptType.Subtitle:
        return `Discover ${product}. Create faster. Stay on brand.`;
      default:
        return `${brand} ${product} empowers creative teams to produce professional marketing content faster.`;
    }
  }

  private estimateGrammarScore(content: string): number {
    let score = 70;
    if (content.length >= 20) score += 10;
    if (/[.!?]/.test(content)) score += 5;
    if (content.split(" ").length >= 5) score += 5;
    if (/^[A-Z]/.test(content.trim())) score += 5;
    if (/\s{2,}/.test(content)) score -= 10;
    if (!content.trim()) score = 30;
    return Math.min(100, Math.max(0, score));
  }

  private detectGrammarIssues(content: string): string[] {
    const issues: string[] = [];
    if (content.length < 10) issues.push("Content too short for reliable grammar analysis");
    if (!/[.!?]$/.test(content.trim()) && content.length > 30) {
      issues.push("Missing terminal punctuation");
    }
    if (/\s{2,}/.test(content)) issues.push("Extra whitespace detected");
    if (content === content.toUpperCase() && content.length > 15) {
      issues.push("All-caps may reduce readability");
    }
    return issues;
  }

  private splitForSubtitles(content: string): string[] {
    const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    if (sentences.length === 0) return [content.slice(0, 42)];
    return sentences.map((s) => s.trim().slice(0, 42));
  }
}
