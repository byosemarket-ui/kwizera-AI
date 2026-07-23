import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import { EmotionType, VoiceType } from "../text-to-speech-generation-engine/types.js";
import { AccentType } from "../speech-to-speech-generation-engine/types.js";
import {
  AuthorizationStatus,
  AuthorizationValidation,
  ProductionCloningInstructions,
  VcLanguage,
  VcOutputUseCase,
  VcPlatform,
  VoiceAnalysis,
  VoiceCloningGenerationInput,
  VoiceCloningPlan,
  VoiceConsentRecord,
  VoiceConsistencyPlan,
  VoiceLibraryType,
  VoiceProfile,
} from "./types.js";

export interface CloningContext {
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
  sampleHint?: string;
  creative?: CreativeDirectionRecord | null;
  strategy?: MarketingStrategyRecord | null;
  understanding?: ProductUnderstandingRecord | null;
}

const INDUSTRY_VOICE_MAP: Record<string, VoiceType> = {
  technology: VoiceType.Professional,
  health: VoiceType.Neutral,
  education: VoiceType.Narrator,
  fashion: VoiceType.Female,
  finance: VoiceType.Professional,
  default: VoiceType.Narrator,
};

const LIBRARY_VOICE_MAP: Record<VoiceLibraryType, VoiceType> = {
  [VoiceLibraryType.Professional]: VoiceType.Professional,
  [VoiceLibraryType.Narrator]: VoiceType.Narrator,
  [VoiceLibraryType.Character]: VoiceType.Character,
  [VoiceLibraryType.Corporate]: VoiceType.Professional,
  [VoiceLibraryType.Educational]: VoiceType.Narrator,
  [VoiceLibraryType.Commercial]: VoiceType.Professional,
  [VoiceLibraryType.CustomAuthorized]: VoiceType.Neutral,
};

const ACCENT_LANGUAGE_MAP: Partial<Record<VcLanguage, AccentType>> = {
  [VcLanguage.English]: AccentType.American,
  [VcLanguage.French]: AccentType.French,
  [VcLanguage.Kinyarwanda]: AccentType.African,
  [VcLanguage.Swahili]: AccentType.African,
};

const DEMO_AUTHORIZED_CONSENTS: Record<string, VoiceConsentRecord> = {
  "demo-consent-tech-en": {
    consentId: "demo-consent-tech-en",
    speakerId: "demo-speaker-tech-en",
    granted: true,
    usagePermission: "commercial-cloning",
    projectAuthorization: true,
    licensingStatus: "active",
    expiresAt: "2027-12-31T23:59:59.000Z",
  },
  "demo-consent-health-fr": {
    consentId: "demo-consent-health-fr",
    speakerId: "demo-speaker-health-fr",
    granted: true,
    usagePermission: "educational-cloning",
    projectAuthorization: true,
    licensingStatus: "active",
    expiresAt: "2027-12-31T23:59:59.000Z",
  },
  "demo-consent-finance-sw": {
    consentId: "demo-consent-finance-sw",
    speakerId: "demo-speaker-finance-sw",
    granted: true,
    usagePermission: "commercial-cloning",
    projectAuthorization: true,
    licensingStatus: "active",
    expiresAt: "2027-12-31T23:59:59.000Z",
  },
  "demo-consent-rw": {
    consentId: "demo-consent-rw",
    speakerId: "demo-speaker-rw",
    granted: true,
    usagePermission: "corporate-cloning",
    projectAuthorization: true,
    licensingStatus: "active",
    expiresAt: "2027-12-31T23:59:59.000Z",
  },
};

export class VoiceCloningGenerationAnalyzer {
  resolveConsent(input: VoiceCloningGenerationInput): VoiceConsentRecord | null {
    if (input.voiceConsent) return input.voiceConsent;
    if (input.consentId && DEMO_AUTHORIZED_CONSENTS[input.consentId]) {
      return DEMO_AUTHORIZED_CONSENTS[input.consentId];
    }
    if (input.consentId) {
      return {
        consentId: input.consentId,
        speakerId: input.speakerId ?? `speaker-${input.consentId}`,
        granted: false,
        usagePermission: "",
        projectAuthorization: false,
        licensingStatus: "unauthorized",
      };
    }
    return null;
  }

  validateAuthorization(consent: VoiceConsentRecord | null): AuthorizationValidation {
    const notes: string[] = [];

    if (!consent) {
      return {
        voiceConsentValid: false,
        usagePermissionValid: false,
        projectAuthorizationValid: false,
        licensingValid: false,
        expirationValid: false,
        overallAuthorized: false,
        authorizationStatus: AuthorizationStatus.Unauthorized,
        validationNotes: ["Voice consent record required — cloning rejected without authorization"],
      };
    }

    const voiceConsentValid = consent.granted === true;
    if (!voiceConsentValid) notes.push("Voice consent not granted");

    const usagePermissionValid = consent.usagePermission.length >= 3;
    if (!usagePermissionValid) notes.push("Usage permission missing or insufficient");

    const projectAuthorizationValid = consent.projectAuthorization === true;
    if (!projectAuthorizationValid) notes.push("Project authorization not granted");

    const licensingValid = ["active", "authorized", "licensed"].includes(consent.licensingStatus.toLowerCase());
    if (!licensingValid) notes.push(`Licensing status invalid: ${consent.licensingStatus}`);

    let expirationValid = true;
    if (consent.expiresAt) {
      expirationValid = new Date(consent.expiresAt) > new Date();
      if (!expirationValid) notes.push("Consent has expired");
    }

    const overallAuthorized =
      voiceConsentValid && usagePermissionValid && projectAuthorizationValid && licensingValid && expirationValid;

    let authorizationStatus = AuthorizationStatus.Authorized;
    if (!overallAuthorized) {
      if (consent.expiresAt && !expirationValid) authorizationStatus = AuthorizationStatus.Expired;
      else if (!consent.granted) authorizationStatus = AuthorizationStatus.Revoked;
      else authorizationStatus = AuthorizationStatus.Unauthorized;
    }

    return {
      voiceConsentValid,
      usagePermissionValid,
      projectAuthorizationValid,
      licensingValid,
      expirationValid,
      overallAuthorized,
      authorizationStatus,
      validationNotes: notes.length > 0 ? notes : ["All authorization checks passed"],
    };
  }

  analyzeVoice(input: VoiceCloningGenerationInput, context: CloningContext): VoiceAnalysis {
    const language = input.language ?? this.detectLanguage(input, context);
    const durationMs = input.durationMs ?? input.voiceMetadata?.sampleDurationMs ?? 60000;
    const hint = input.sampleHint ?? context.sampleHint ?? "";

    return {
      language,
      pitch: input.voiceType === VoiceType.Female ? "Mid-high (180-280 Hz)" : "Mid-low (85-180 Hz)",
      timbre: `Warm ${input.voiceLibraryType ?? VoiceLibraryType.Professional} timbre with clear articulation`,
      tone: context.brandGuidelines ?? `Professional ${context.brandName ?? "brand"} tone`,
      speakingRate: this.estimateSpeakingRate(durationMs, hint),
      rhythm: "Syllable-timed with natural stress patterns",
      pronunciation: `Clear ${language} pronunciation with accent ${input.sourceAccent ?? ACCENT_LANGUAGE_MAP[language] ?? AccentType.Neutral}`,
      accent: input.sourceAccent ?? ACCENT_LANGUAGE_MAP[language] ?? AccentType.Neutral,
      detectedEmotion: input.sourceEmotion ?? EmotionType.Professional,
      voiceQualityScore: input.voiceMetadata?.recordingQuality === "studio" ? 92 : 85,
      backgroundNoiseLevel: "Low — authorized sample assumed studio-quality",
      durationMs,
      keywords: this.extractKeywords(hint, context),
      properNames: this.extractProperNames(hint, context),
      technicalTerms: this.extractTechnicalTerms(hint, context),
    };
  }

  buildProfile(
    input: VoiceCloningGenerationInput,
    platform: VcPlatform,
    version: number,
    context: CloningContext,
    voiceAnalysis: VoiceAnalysis,
    consent: VoiceConsentRecord,
    authValidation: AuthorizationValidation
  ): VoiceProfile {
    const productId = context.productId ?? input.productId ?? "standalone";
    const sampleId = input.voiceSampleId ?? `voice-sample-${productId}-v${version}`;
    const speakerId = input.speakerId ?? consent.speakerId;
    const cloningPlanId = `vc-plan-${productId}-${voiceAnalysis.language}-${platform}-v${version}`;

    return {
      voiceProfileId: `voice-profile-${speakerId}-${voiceAnalysis.language}-v${version}`,
      projectId: input.projectId ?? context.projectId ?? `project-${productId}`,
      speakerId,
      brandId: input.brandId ?? context.brandId ?? context.brandName ?? "unknown-brand",
      campaignId: input.campaignId ?? context.campaignId,
      language: voiceAnalysis.language,
      voiceVersion: version,
      authorizationStatus: authValidation.authorizationStatus,
      voiceLibraryType: input.voiceLibraryType ?? VoiceLibraryType.Professional,
      voiceType: input.voiceType ?? LIBRARY_VOICE_MAP[input.voiceLibraryType ?? VoiceLibraryType.Professional],
      sampleId,
      consentId: consent.consentId,
      platform,
      outputUseCase: input.outputUseCase ?? VcOutputUseCase.VideoNarration,
    };
  }

  buildCloningPlan(
    input: VoiceCloningGenerationInput,
    context: CloningContext,
    voiceAnalysis: VoiceAnalysis,
    profile: VoiceProfile
  ): VoiceCloningPlan {
    const brand = context.brandName ?? "brand";
    const voiceType = profile.voiceType;

    const pronunciationMapping: Record<string, string> = {};
    for (const name of voiceAnalysis.properNames) {
      pronunciationMapping[name] = `${name} [preserve speaker pronunciation — ${voiceAnalysis.language}]`;
    }
    for (const term of voiceAnalysis.technicalTerms) {
      pronunciationMapping[term] = `${term} [technical vocabulary — ${voiceAnalysis.language}]`;
    }

    return {
      voiceIdentityMapping: {
        speakerId: profile.speakerId,
        pitch: voiceAnalysis.pitch,
        timbre: voiceAnalysis.timbre,
        voiceType,
      },
      voiceStyleMapping: {
        library: profile.voiceLibraryType,
        tone: voiceAnalysis.tone,
        rhythm: voiceAnalysis.rhythm,
      },
      accentMapping: `Preserve ${voiceAnalysis.accent} accent characteristics in cloned voice`,
      pronunciationMapping,
      emotionMapping: {
        source: voiceAnalysis.detectedEmotion,
        target: input.sourceEmotion ?? voiceAnalysis.detectedEmotion,
      },
      prosodyMapping: `Map source prosody — intonation and stress patterns preserved for ${voiceAnalysis.language}`,
      speakingRateMapping: `Target ${voiceAnalysis.speakingRate} with platform-adjusted pacing`,
      pausePlanning: [
        "Comma pause: 200ms",
        "Period pause: 400ms",
        "Breath pause at clause boundaries: 250ms",
      ],
      brandVoiceAlignment: `Clone aligned with ${brand} identity — ${voiceType} ${profile.voiceLibraryType} execution`,
    };
  }

  buildConsistencyPlan(voiceAnalysis: VoiceAnalysis, cloningPlan: VoiceCloningPlan): VoiceConsistencyPlan {
    return {
      voiceIdentity: `Preserve speaker identity — ${cloningPlan.voiceIdentityMapping.timbre}`,
      voiceStyle: `Maintain ${cloningPlan.voiceStyleMapping.library} style consistency`,
      accent: cloningPlan.accentMapping,
      pronunciation: `Consistent pronunciation across ${Object.keys(cloningPlan.pronunciationMapping).length} mapped terms`,
      emotion: `Preserve ${voiceAnalysis.detectedEmotion} emotional signature`,
      naturalRhythm: voiceAnalysis.rhythm,
      speakingPace: voiceAnalysis.speakingRate,
      voiceStability: "High stability target — minimal drift across segments",
      consistencyScore: 88,
    };
  }

  buildProductionInstructions(
    profile: VoiceProfile,
    consistencyPlan: VoiceConsistencyPlan,
    cloningPlan: VoiceCloningPlan
  ): ProductionCloningInstructions {
    return {
      renderNotes: [
        `Voice cloning blueprint v${profile.voiceVersion} — ${profile.language} ${profile.platform}`,
        `Library type: ${profile.voiceLibraryType}`,
        "Blueprint only — no audio synthesis in this engine",
      ],
      identityGuidance: [
        consistencyPlan.voiceIdentity,
        `Identity mapping: ${JSON.stringify(cloningPlan.voiceIdentityMapping)}`,
      ],
      stabilityGuidance: [
        consistencyPlan.voiceStability,
        `Consistency score target: ${consistencyPlan.consistencyScore}`,
      ],
      exportPreparation: [
        `Prepare for ${profile.outputUseCase} use case`,
        `Platform: ${profile.platform}`,
      ],
      qualityTargets: [
        "Voice similarity ≥ 85%",
        "Voice stability ≥ 80%",
        "Authorization compliance required",
      ],
    };
  }

  buildRecommendations(
    voiceAnalysis: VoiceAnalysis,
    consistencyPlan: VoiceConsistencyPlan,
    authValidation: AuthorizationValidation,
    context: CloningContext
  ): string[] {
    const recs: string[] = [];
    if (voiceAnalysis.voiceQualityScore < 80) {
      recs.push("Consider higher-quality voice samples for improved cloning fidelity");
    }
    if (consistencyPlan.consistencyScore < 85) {
      recs.push("Review voice consistency plan for stability improvements");
    }
    if (context.brandGuidelines) {
      recs.push(`Apply brand guidelines: ${context.brandGuidelines.slice(0, 80)}`);
    }
    if (authValidation.overallAuthorized) {
      recs.push("Authorization verified — cloning blueprint approved for planning");
    }
    if (voiceAnalysis.properNames.length > 0) {
      recs.push(`Preserve ${voiceAnalysis.properNames.length} proper name pronunciation(s)`);
    }
    return recs.length > 0 ? recs : ["Voice cloning blueprint ready for production planning"];
  }

  resolvePlatform(input: VoiceCloningGenerationInput, context: CloningContext): VcPlatform {
    if (input.platform) return input.platform;
    if (context.creative?.profile.platform) {
      const p = context.creative.profile.platform.toLowerCase();
      if (p.includes("youtube")) return VcPlatform.YouTube;
      if (p.includes("tiktok")) return VcPlatform.TikTok;
      if (p.includes("instagram")) return VcPlatform.Instagram;
      if (p.includes("facebook")) return VcPlatform.Facebook;
      if (p.includes("mobile")) return VcPlatform.MobileApp;
      if (p.includes("tv") || p.includes("television")) return VcPlatform.Television;
    }
    return VcPlatform.Website;
  }

  extractContextFromInput(input: VoiceCloningGenerationInput): CloningContext {
    return {
      brandName: input.brandName ?? "KWIZERA",
      brandId: input.brandId,
      brandGuidelines: input.brandGuidelines,
      projectId: input.projectId,
      campaignId: input.campaignId,
      sampleHint: input.sampleHint,
    };
  }

  extractContextFromProduct(
    productId: string,
    productName: string,
    brandName: string,
    understanding?: ProductUnderstandingRecord | null,
    creative?: CreativeDirectionRecord | null,
    strategy?: MarketingStrategyRecord | null,
    input?: VoiceCloningGenerationInput
  ): CloningContext {
    return {
      productId,
      productName,
      brandName,
      brandId: input?.brandId ?? brandName,
      brandGuidelines: input?.brandGuidelines ?? creative?.profile.tone,
      projectId: input?.projectId ?? `project-${productId}`,
      campaignId: input?.campaignId ?? strategy?.relationships?.campaigns?.[0],
      targetAudience: understanding?.customer?.targetCustomer,
      keyBenefit: understanding?.uniqueValue?.keyBenefits?.[0],
      industry: understanding?.customer?.targetIndustry,
      sampleHint: input?.sampleHint,
      creative,
      strategy,
      understanding,
    };
  }

  private detectLanguage(input: VoiceCloningGenerationInput, context: CloningContext): VcLanguage {
    if (input.language) return input.language;
    const hint = (input.sampleHint ?? context.sampleHint ?? "").toLowerCase();
    if (/bienvenue|santé|français/.test(hint)) return VcLanguage.French;
    if (/karibu|huduma|swahili/.test(hint)) return VcLanguage.Swahili;
    if (/murakoze|kinyarwanda|rwanda/.test(hint)) return VcLanguage.Kinyarwanda;
    return VcLanguage.English;
  }

  private estimateSpeakingRate(durationMs: number, text: string): string {
    const words = text.split(/\s+/).filter(Boolean).length || 50;
    const wpm = Math.round((words / durationMs) * 60000);
    return `${Math.min(180, Math.max(120, wpm || 150))} wpm`;
  }

  private extractKeywords(text: string, context: CloningContext): string[] {
    const words = text.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
    const base = [...new Set(words)].slice(0, 8);
    if (context.brandName) base.push(context.brandName.toLowerCase());
    if (context.productName) base.push(context.productName.toLowerCase());
    return [...new Set(base)];
  }

  private extractProperNames(text: string, context: CloningContext): string[] {
    const names: string[] = [];
    const matches = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g) ?? [];
    names.push(...matches);
    if (context.brandName) names.push(context.brandName);
    if (context.productName) names.push(context.productName);
    return [...new Set(names)];
  }

  private extractTechnicalTerms(text: string, context: CloningContext): string[] {
    const terms: string[] = [];
    if (/AI|API|SaaS|SDK/i.test(text)) terms.push("AI", "API");
    if (context.industry === "technology") terms.push("software", "platform");
    return [...new Set(terms)];
  }
}
