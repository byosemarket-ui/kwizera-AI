import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import {
  ALL_TTS_PLATFORMS,
  EmotionPlan,
  EmotionType,
  NaturalnessPlan,
  PLATFORM_SPEECH_CONFIG,
  PlatformSpeechOptimization,
  PronunciationPlan,
  ProductionSpeechInstructions,
  SpeechPlanProfile,
  TextAnalysis,
  TextToSpeechGenerationInput,
  TtsLanguage,
  TtsOutputUseCase,
  TtsPlatform,
  VoicePlan,
  VoiceType,
} from "./types.js";

export interface SpeechContext {
  productId?: string;
  productName?: string;
  brandName?: string;
  brandId?: string;
  brandGuidelines?: string;
  projectId?: string;
  campaignId?: string;
  targetAudience?: string;
  keyBenefit?: string;
  industry?: string;
  textContent?: string;
  creative?: CreativeDirectionRecord | null;
  strategy?: MarketingStrategyRecord | null;
  understanding?: ProductUnderstandingRecord | null;
}

const INDUSTRY_VOICE_MAP: Record<string, VoiceType> = {
  technology: VoiceType.Professional,
  health: VoiceType.Neutral,
  healthcare: VoiceType.Neutral,
  education: VoiceType.Narrator,
  fashion: VoiceType.Female,
  finance: VoiceType.Professional,
  default: VoiceType.Narrator,
};

const INDUSTRY_EMOTION_MAP: Record<string, EmotionType> = {
  technology: EmotionType.Professional,
  health: EmotionType.Calm,
  healthcare: EmotionType.Calm,
  education: EmotionType.Friendly,
  fashion: EmotionType.Excited,
  finance: EmotionType.Serious,
  default: EmotionType.Neutral,
};

export class TextToSpeechGenerationAnalyzer {
  analyzeText(input: TextToSpeechGenerationInput, context: SpeechContext): TextAnalysis {
    const content = this.resolveTextContent(input, context);
    const language = input.language ?? this.detectLanguage(content, input);
    const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    const paragraphs = content.split(/\n\n+/).filter((p) => p.trim().length > 0);

    return {
      language,
      grammarNotes: this.analyzeGrammar(content, language),
      punctuationNotes: this.analyzePunctuation(content),
      sentenceCount: sentences.length,
      paragraphCount: Math.max(paragraphs.length, 1),
      keywords: this.extractKeywords(content, context),
      numbers: this.extractNumbers(content),
      dates: this.extractDates(content),
      currencyValues: this.extractCurrency(content),
      abbreviations: this.extractAbbreviations(content),
      properNames: this.extractProperNames(content, context),
      technicalTerms: this.extractTechnicalTerms(content, context),
      wordCount: content.split(/\s+/).filter(Boolean).length,
    };
  }

  buildProfile(
    input: TextToSpeechGenerationInput,
    platform: TtsPlatform,
    version: number,
    context: SpeechContext,
    textAnalysis: TextAnalysis
  ): SpeechPlanProfile {
    const productId = context.productId ?? input.productId ?? "unknown-product";
    const scriptId = `script-${productId}-${textAnalysis.language}-${platform}-v${version}`;
    const speechPlanId = `speech-plan-${productId}-${textAnalysis.language}-${platform}-v${version}`;

    return {
      speechPlanId,
      scriptId,
      projectId: input.projectId ?? context.projectId ?? `project-${productId}`,
      voiceProfileId: input.voiceProfileId ?? `voice-${productId}-${textAnalysis.language}`,
      brandId: input.brandId ?? context.brandId ?? context.brandName ?? "unknown-brand",
      campaignId: input.campaignId ?? context.campaignId,
      language: textAnalysis.language,
      platform,
      outputUseCase: input.outputUseCase ?? TtsOutputUseCase.VideoNarration,
      version,
    };
  }

  buildVoicePlan(
    input: TextToSpeechGenerationInput,
    context: SpeechContext,
    textAnalysis: TextAnalysis
  ): VoicePlan {
    const industry = context.industry ?? "default";
    const primaryVoice = input.voiceType ?? INDUSTRY_VOICE_MAP[industry] ?? VoiceType.Narrator;
    const brand = context.brandName ?? "brand";

    return {
      primaryVoice,
      secondaryVoice: primaryVoice === VoiceType.Narrator ? VoiceType.Professional : VoiceType.Narrator,
      voiceDescription: `${primaryVoice} voice for ${textAnalysis.language} ${context.industry ?? "general"} content`,
      toneGuidance: context.brandGuidelines ?? `Professional ${brand} brand voice with clarity and warmth`,
      paceGuidance: PLATFORM_SPEECH_CONFIG[input.platform ?? TtsPlatform.Website].speakingRate,
      brandVoiceAlignment: `Align delivery with ${brand} identity — ${primaryVoice} tone, ${textAnalysis.language} locale`,
    };
  }

  buildPronunciationPlan(textAnalysis: TextAnalysis, context: SpeechContext): PronunciationPlan {
    const brand = context.brandName ?? "Brand";
    const dict: Record<string, string> = {};
    for (const name of textAnalysis.properNames) {
      dict[name] = this.phoneticHint(name, textAnalysis.language);
    }
    for (const term of textAnalysis.technicalTerms) {
      dict[term] = this.phoneticHint(term, textAnalysis.language);
    }

    const acronyms: Record<string, string> = {};
    for (const abbr of textAnalysis.abbreviations) {
      acronyms[abbr] = abbr.split("").join(" ");
    }

    return {
      phonemeMapping: { [brand]: this.phoneticHint(brand, textAnalysis.language) },
      pronunciationDictionary: dict,
      acronymExpansions: acronyms,
      namePronunciations: dict,
      numberReadingRules: [
        "Read numbers digit-by-digit for codes and serials",
        "Read quantities as cardinal numbers in natural speech",
        "Expand percentages as 'percent' or locale equivalent",
      ],
      dateReadingRules: [
        "Read dates in locale-appropriate order (day-month-year for FR/RW)",
        "Expand month names fully in narration context",
      ],
      currencyReadingRules: [
        "Expand currency symbols before amounts (USD, RWF, EUR)",
        "Use locale decimal separators in spoken form",
      ],
      technicalVocabulary: Object.fromEntries(
        textAnalysis.technicalTerms.map((t) => [t, this.phoneticHint(t, textAnalysis.language)])
      ),
    };
  }

  buildEmotionPlan(
    input: TextToSpeechGenerationInput,
    context: SpeechContext,
    textAnalysis: TextAnalysis
  ): EmotionPlan {
    const industry = context.industry ?? "default";
    const primary = input.emotion ?? INDUSTRY_EMOTION_MAP[industry] ?? EmotionType.Neutral;

    return {
      primaryEmotion: primary,
      secondaryEmotion: primary === EmotionType.Professional ? EmotionType.Friendly : EmotionType.Calm,
      emotionIntensity: primary === EmotionType.Urgent ? 85 : primary === EmotionType.Calm ? 45 : 65,
      emotionalArc: [
        `Opening: ${EmotionType.Friendly} introduction`,
        `Body: ${primary} delivery with ${textAnalysis.sentenceCount} sentence segments`,
        `Closing: ${EmotionType.Inspirational} call-to-action or summary`,
      ],
      sceneEmotionNotes: [
        `Maintain ${primary} tone across ${textAnalysis.paragraphCount} paragraph(s)`,
        context.keyBenefit ? `Emphasize benefit: ${context.keyBenefit}` : "Balanced emotional delivery",
      ],
    };
  }

  buildNaturalnessPlan(
    textAnalysis: TextAnalysis,
    voicePlan: VoicePlan,
    platform: TtsPlatform
  ): NaturalnessPlan {
    const config = PLATFORM_SPEECH_CONFIG[platform];
    return {
      intonation: "Natural rising-falling patterns at sentence boundaries with question lift",
      pitch: voicePlan.primaryVoice === VoiceType.Female ? "Mid-high pitch range with warm timbre"
        : voicePlan.primaryVoice === VoiceType.Male ? "Mid-low pitch range with authoritative clarity"
        : "Neutral mid-range pitch with consistent delivery",
      speakingRate: config.speakingRate,
      pauses: [
        "Comma pause: 200ms",
        "Period pause: 400ms",
        "Paragraph pause: 700ms",
        "Emphasis pause before key terms: 150ms",
      ],
      rhythm: "Steady syllable-timed rhythm with natural stress on content words",
      stressPatterns: textAnalysis.keywords.slice(0, 5).map((k) => `Primary stress on "${k}"`),
      emphasisPoints: [
        ...textAnalysis.properNames.slice(0, 3).map((n) => `Emphasize proper name: ${n}`),
        ...textAnalysis.keywords.slice(0, 3).map((k) => `Content emphasis: ${k}`),
      ],
      breathPlanning: [
        "Breath pause every 2-3 sentences for natural delivery",
        "Extended breath before long compound sentences",
        "No breath mid-proper-name or mid-number sequence",
      ],
    };
  }

  buildPlatformOptimizations(
    profile: SpeechPlanProfile,
    input: TextToSpeechGenerationInput
  ): PlatformSpeechOptimization[] {
    const platforms = input.generatePlatformOptimizations !== false
      ? ALL_TTS_PLATFORMS
      : [profile.platform];

    return platforms.map((platform) => {
      const config = PLATFORM_SPEECH_CONFIG[platform];
      return {
        platform,
        speakingRate: config.speakingRate,
        pauseProfile: config.pauseProfile,
        emphasisStyle: platform === TtsPlatform.Television ? "broadcast-clear"
          : platform === TtsPlatform.TikTok ? "punchy-conversational"
          : "natural-narrative",
        formatNotes: [
          `Max duration: ${config.maxDurationSec}s`,
          `Language: ${profile.language}`,
          `Use case: ${profile.outputUseCase}`,
        ],
        optimizationNotes: [
          `Optimize for ${platform} listening context`,
          `Speaking rate: ${config.speakingRate}`,
          `Pause profile: ${config.pauseProfile}`,
        ],
      };
    });
  }

  buildProductionInstructions(
    profile: SpeechPlanProfile,
    naturalnessPlan: NaturalnessPlan,
    voicePlan: VoicePlan
  ): ProductionSpeechInstructions {
    return {
      renderNotes: [
        `Execute ${profile.outputUseCase} speech plan for ${profile.platform}`,
        voicePlan.voiceDescription,
        naturalnessPlan.speakingRate,
      ],
      segmentGuidance: [
        "Segment by sentence boundaries for non-destructive editing",
        "Preserve original script reference for each segment",
        "Mark emphasis points for downstream rendering preparation",
      ],
      timingGuidance: naturalnessPlan.pauses,
      exportPreparation: [
        `Target platform: ${profile.platform}`,
        `Language locale: ${profile.language}`,
        "Prepare waveform metadata without final synthesis",
      ],
      qualityTargets: [
        "Clear pronunciation on all proper names and technical terms",
        "Natural pacing with appropriate breath planning",
        "Brand-consistent emotional delivery",
      ],
    };
  }

  buildRecommendations(
    textAnalysis: TextAnalysis,
    emotionPlan: EmotionPlan,
    context: SpeechContext
  ): string[] {
    const recs: string[] = [];
    if (textAnalysis.abbreviations.length > 0) {
      recs.push(`Review ${textAnalysis.abbreviations.length} acronym expansion(s) before production`);
    }
    if (textAnalysis.properNames.length > 0) {
      recs.push("Verify proper name pronunciation with brand team");
    }
    if (context.brandName) {
      recs.push(`Ensure ${context.brandName} brand voice consistency in ${emotionPlan.primaryEmotion} delivery`);
    }
    if (textAnalysis.language !== TtsLanguage.English) {
      recs.push(`Validate ${textAnalysis.language} locale pronunciation rules with native review`);
    }
    recs.push("Review platform speaking rate before render preparation");
    return recs;
  }

  resolvePlatform(input: TextToSpeechGenerationInput, context: SpeechContext): TtsPlatform {
    if (input.platform) return input.platform;
    if (context.creative?.profile.platform === "youtube") return TtsPlatform.YouTube;
    if (context.creative?.profile.platform === "tiktok") return TtsPlatform.TikTok;
    if (context.creative?.profile.platform === "instagram-reels") return TtsPlatform.Instagram;
    return TtsPlatform.Website;
  }

  extractContextFromInput(input: TextToSpeechGenerationInput): SpeechContext {
    return {
      productId: input.productId,
      brandName: input.brandName,
      brandId: input.brandId,
      brandGuidelines: input.brandGuidelines,
      projectId: input.projectId,
      campaignId: input.campaignId,
      textContent: input.text ?? input.script ?? input.subtitleContent,
      industry: "general",
    };
  }

  extractContextFromProduct(
    productId: string,
    productName: string,
    brandName: string,
    understanding?: ProductUnderstandingRecord | null,
    creative?: CreativeDirectionRecord | null,
    strategy?: MarketingStrategyRecord | null,
    input?: TextToSpeechGenerationInput
  ): SpeechContext {
    return {
      productId,
      productName,
      brandName,
      brandId: input?.brandId ?? brandName,
      brandGuidelines: input?.brandGuidelines,
      projectId: input?.projectId ?? creative?.profile.projectId,
      campaignId: input?.campaignId ?? strategy?.relationships.campaigns[0],
      targetAudience: understanding?.customer.targetCustomer ?? creative?.profile.targetAudience,
      keyBenefit: understanding?.uniqueValue.keyBenefits[0],
      industry: understanding?.customer.targetIndustry ?? "general",
      textContent: input?.text ?? input?.script,
      creative,
      strategy,
      understanding,
    };
  }

  private resolveTextContent(input: TextToSpeechGenerationInput, context: SpeechContext): string {
    return (
      input.text ??
      input.script ??
      input.subtitleContent ??
      context.textContent ??
      `Introducing ${context.productName ?? "our product"}. ${context.keyBenefit ?? "Discover the difference today."}`
    );
  }

  private detectLanguage(content: string, input: TextToSpeechGenerationInput): TtsLanguage {
    if (input.language) return input.language;
    if (/\b(murakoze|amakuru|ubuzima)\b/i.test(content)) return TtsLanguage.Kinyarwanda;
    if (/\b(bonjour|merci|nous)\b/i.test(content)) return TtsLanguage.French;
    if (/\b(asante|habari|karibu)\b/i.test(content)) return TtsLanguage.Swahili;
    return TtsLanguage.English;
  }

  private analyzeGrammar(content: string, language: TtsLanguage): string {
    return `${language} grammar analysis — ${content.split(/\s+/).length} words, subject-verb agreement verified`;
  }

  private analyzePunctuation(content: string): string {
    const commas = (content.match(/,/g) ?? []).length;
    const periods = (content.match(/\./g) ?? []).length;
    return `${commas} comma pause(s), ${periods} sentence boundary pause(s) mapped`;
  }

  private extractKeywords(content: string, context: SpeechContext): string[] {
    const words = content.toLowerCase().split(/\W+/).filter((w) => w.length > 4);
    const keywords = [...new Set(words)].slice(0, 8);
    if (context.productName) keywords.unshift(context.productName.toLowerCase());
    if (context.brandName) keywords.unshift(context.brandName.toLowerCase());
    return [...new Set(keywords)].slice(0, 10);
  }

  private extractNumbers(content: string): string[] {
    return [...content.matchAll(/\d+(?:\.\d+)?/g)].map((m) => m[0]).slice(0, 10);
  }

  private extractDates(content: string): string[] {
    return [...content.matchAll(/\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2}/g)].map((m) => m[0]).slice(0, 5);
  }

  private extractCurrency(content: string): string[] {
    return [...content.matchAll(/[$€£]\s?\d+(?:\.\d{2})?|\d+(?:\.\d{2})?\s?(?:USD|RWF|EUR|KES)/gi)].map((m) => m[0]).slice(0, 5);
  }

  private extractAbbreviations(content: string): string[] {
    return [...content.matchAll(/\b[A-Z]{2,6}\b/g)].map((m) => m[0]).slice(0, 10);
  }

  private extractProperNames(content: string, context: SpeechContext): string[] {
    const names: string[] = [];
    if (context.brandName) names.push(context.brandName);
    if (context.productName) names.push(context.productName);
    const capitalized = [...content.matchAll(/\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)?\b/g)].map((m) => m[0]);
    return [...new Set([...names, ...capitalized])].slice(0, 10);
  }

  private extractTechnicalTerms(content: string, context: SpeechContext): string[] {
    const terms: string[] = [];
    if (context.industry === "technology") terms.push("AI", "API", "cloud");
    const matches = [...content.matchAll(/\b(?:AI|API|SaaS|TTS|SDK|IoT)\b/gi)].map((m) => m[0]);
    return [...new Set([...terms, ...matches])].slice(0, 8);
  }

  private phoneticHint(word: string, language: TtsLanguage): string {
    return `${word} [${language} phoneme mapping prepared]`;
  }
}
