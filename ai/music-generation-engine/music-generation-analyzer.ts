import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import {
  ArrangementPlan,
  CompositionPlan,
  LoopPlan,
  LoopType,
  MoodPlan,
  MusicAnalysis,
  MusicGenerationInput,
  MusicGenre,
  MusicMood,
  MusicPlatform,
  MusicProfile,
  PLATFORM_MUSIC_CONFIG,
  ProductionMusicInstructions,
  SyncPreparationPlan,
  SyncTarget,
} from "./types.js";

export interface MusicContext {
  productId?: string;
  productName?: string;
  brandName?: string;
  brandId?: string;
  brandGuidelines?: string;
  projectId?: string;
  campaignId?: string;
  targetAudience?: string;
  industry?: string;
  musicPrompt?: string;
  creative?: CreativeDirectionRecord | null;
  strategy?: MarketingStrategyRecord | null;
  understanding?: ProductUnderstandingRecord | null;
}

const INDUSTRY_GENRE_MAP: Record<string, MusicGenre> = {
  technology: MusicGenre.Corporate,
  health: MusicGenre.Ambient,
  education: MusicGenre.Cinematic,
  fashion: MusicGenre.Pop,
  finance: MusicGenre.Corporate,
  entertainment: MusicGenre.EDM,
  default: MusicGenre.Commercial,
};

const INDUSTRY_MOOD_MAP: Record<string, MusicMood> = {
  technology: MusicMood.Inspirational,
  health: MusicMood.Calm,
  education: MusicMood.Inspirational,
  fashion: MusicMood.Energetic,
  finance: MusicMood.Serious,
  entertainment: MusicMood.Happy,
  default: MusicMood.Inspirational,
};

const GENRE_ARRANGEMENT: Record<MusicGenre, string[]> = {
  [MusicGenre.Cinematic]: ["strings", "brass", "percussion", "choir"],
  [MusicGenre.Corporate]: ["piano", "synth", "bass", "percussion"],
  [MusicGenre.Commercial]: ["guitar", "synth", "bass", "percussion"],
  [MusicGenre.Pop]: ["guitar", "synth", "bass", "percussion"],
  [MusicGenre.Rock]: ["guitar", "bass", "drums", "percussion"],
  [MusicGenre.HipHop]: ["synth", "bass", "percussion", "electronicInstruments"],
  [MusicGenre.Jazz]: ["piano", "brass", "woodwinds", "bass"],
  [MusicGenre.Classical]: ["strings", "woodwinds", "brass", "percussion"],
  [MusicGenre.Gospel]: ["piano", "choir", "organ", "percussion"],
  [MusicGenre.Afrobeat]: ["guitar", "percussion", "brass", "bass"],
  [MusicGenre.EDM]: ["synth", "bass", "electronicInstruments", "percussion"],
  [MusicGenre.Ambient]: ["synth", "piano", "strings"],
  [MusicGenre.LoFi]: ["piano", "guitar", "synth", "percussion"],
  [MusicGenre.Orchestral]: ["strings", "brass", "woodwinds", "percussion", "choir"],
};

const GENRE_TEMPO: Record<MusicGenre, string> = {
  [MusicGenre.Cinematic]: "80-120 BPM",
  [MusicGenre.Corporate]: "100-120 BPM",
  [MusicGenre.Commercial]: "110-130 BPM",
  [MusicGenre.Pop]: "100-128 BPM",
  [MusicGenre.Rock]: "110-140 BPM",
  [MusicGenre.HipHop]: "80-100 BPM",
  [MusicGenre.Jazz]: "90-140 BPM",
  [MusicGenre.Classical]: "60-120 BPM",
  [MusicGenre.Gospel]: "90-110 BPM",
  [MusicGenre.Afrobeat]: "100-120 BPM",
  [MusicGenre.EDM]: "120-140 BPM",
  [MusicGenre.Ambient]: "60-80 BPM",
  [MusicGenre.LoFi]: "70-90 BPM",
  [MusicGenre.Orchestral]: "70-110 BPM",
};

export class MusicGenerationAnalyzer {
  analyzeMusic(input: MusicGenerationInput, context: MusicContext): MusicAnalysis {
    const genre = input.genre ?? this.detectGenre(context);
    const mood = input.mood ?? this.detectMood(context);
    const durationSec = input.durationSec ?? this.resolveDuration(input.platform, context);

    return {
      mood,
      genre,
      tempo: input.tempo ?? GENRE_TEMPO[genre],
      key: input.key ?? this.detectKey(mood),
      scale: mood === MusicMood.Dramatic || mood === MusicMood.Epic ? "minor" : "major",
      timeSignature: genre === MusicGenre.Jazz ? "4/4 swing" : "4/4",
      energy: this.detectEnergy(mood, genre),
      emotion: mood,
      durationSec,
      intendedAudience: context.targetAudience ?? "general audience",
      keywords: this.extractKeywords(input, context),
    };
  }

  buildProfile(
    input: MusicGenerationInput,
    platform: MusicPlatform,
    version: number,
    context: MusicContext,
    analysis: MusicAnalysis
  ): MusicProfile {
    const productId = context.productId ?? input.productId ?? "standalone";
    const musicPlanId = `music-plan-${productId}-${analysis.genre}-${platform}-v${version}`;

    return {
      musicPlanId,
      projectId: input.projectId ?? context.projectId ?? `project-${productId}`,
      brandId: input.brandId ?? context.brandId ?? context.brandName ?? "unknown-brand",
      campaignId: input.campaignId ?? context.campaignId,
      platform,
      genre: analysis.genre,
      mood: analysis.mood,
      version,
    };
  }

  buildCompositionPlan(analysis: MusicAnalysis, context: MusicContext): CompositionPlan {
    const brand = context.brandName ?? "brand";
    return {
      melodyStructure: [
        `Opening motif — ${analysis.mood} ${analysis.genre} theme`,
        `Verse melody — stepwise motion in ${analysis.key}`,
        `Chorus hook — memorable ascending phrase`,
      ],
      harmonyStructure: [
        `Diatonic harmony in ${analysis.key} ${analysis.scale}`,
        `Secondary dominant for chorus lift`,
        `Modal interchange for bridge tension`,
      ],
      rhythmStructure: [
        `Steady ${analysis.timeSignature} groove at ${analysis.tempo}`,
        `Syncopated hi-hat pattern for energy`,
        `Kick pattern aligned to ${analysis.energy} energy level`,
      ],
      chordProgression: this.buildChordProgression(analysis),
      intro: `8-bar atmospheric intro establishing ${analysis.mood} mood`,
      verse: `16-bar verse with restrained arrangement for ${brand} narrative`,
      chorus: `16-bar chorus with full arrangement and melodic hook`,
      bridge: `8-bar bridge with harmonic contrast and dynamic shift`,
      outro: `8-bar outro with fade or resolve for ${analysis.durationSec}s total`,
    };
  }

  buildArrangementPlan(analysis: MusicAnalysis): ArrangementPlan {
    const active = GENRE_ARRANGEMENT[analysis.genre] ?? ["piano", "synth", "bass", "percussion"];
    const inactive = (key: string) => (active.includes(key) ? "active" : "optional");

    return {
      piano: inactive("piano") === "active" ? `Piano — chord comp and melody doubling (${analysis.mood})` : "Not primary",
      guitar: inactive("guitar") === "active" ? `Guitar — rhythmic strumming / arpeggios` : "Not primary",
      strings: inactive("strings") === "active" ? `Strings — sustained pads and melodic lines` : "Not primary",
      brass: inactive("brass") === "active" ? `Brass — section hits and melodic accents` : "Not primary",
      woodwinds: inactive("woodwinds") === "active" ? `Woodwinds — color and countermelody` : "Not primary",
      percussion: inactive("percussion") === "active" ? `Percussion — ${analysis.tempo} groove` : "Light percussion",
      synth: inactive("synth") === "active" ? `Synth — pads, leads, and textures` : "Subtle texture",
      bass: inactive("bass") === "active" ? `Bass — root movement following chord progression` : "Optional sub-bass",
      choir: inactive("choir") === "active" ? `Choir — harmonic support in chorus sections` : "Not required",
      electronicInstruments: inactive("electronicInstruments") === "active" ? `Electronic — FX, risers, impacts` : "Minimal FX",
      activeInstruments: active,
    };
  }

  buildMoodPlan(input: MusicGenerationInput, analysis: MusicAnalysis, context: MusicContext): MoodPlan {
    const brand = context.brandName ?? "brand";
    return {
      primaryMood: analysis.mood,
      secondaryMood: this.secondaryMood(analysis.mood),
      emotionalArc: [
        `Intro: establish ${analysis.mood}`,
        `Verse: maintain emotional foundation`,
        `Chorus: peak ${analysis.energy} energy`,
        `Bridge: contrast then resolve`,
        `Outro: return to ${analysis.mood}`,
      ],
      intensityCurve: `Gradual build from intro through chorus, release in outro`,
      moodTransitions: [
        "Smooth crossfade between sections",
        "Dynamic swell into chorus",
        "Controlled release in bridge",
      ],
      brandMoodAlignment: `Align ${analysis.mood} mood with ${brand} identity — ${context.brandGuidelines ?? "professional tone"}`,
    };
  }

  buildSyncPreparation(input: MusicGenerationInput, analysis: MusicAnalysis, platform: MusicPlatform): SyncPreparationPlan {
    const syncTarget = input.syncTarget ?? this.detectSyncTarget(platform);
    const config = PLATFORM_MUSIC_CONFIG[platform];

    return {
      syncTarget,
      hitPoints: [
        "Bar 1: intro entry",
        "Bar 9: verse start",
        "Bar 25: chorus impact",
        "Bar 41: bridge transition",
        `Bar ${Math.floor(analysis.durationSec / 2)}: midpoint accent`,
      ],
      tempoSync: `Lock tempo at ${analysis.tempo} for ${syncTarget} synchronization`,
      fadeIn: "2s fade-in for smooth entry",
      fadeOut: analysis.durationSec > 60 ? "4s fade-out" : "2s fade-out",
      duckingNotes: syncTarget === SyncTarget.Video || syncTarget === SyncTarget.Advertisement
        ? ["Duck -6dB under voiceover regions", "Sidechain to narration track"]
        : ["No ducking required"],
      platformNotes: [config.formatNotes, `Loudness target: ${config.loudnessTarget}`],
    };
  }

  buildLoopPlan(input: MusicGenerationInput, analysis: MusicAnalysis): LoopPlan {
    const loopType = input.loopType ?? LoopType.Background;
    const loopDuration = loopType === LoopType.Intro ? 8 : loopType === LoopType.Ambient ? 16 : 32;

    return {
      loopType,
      seamless: loopType === LoopType.Seamless || loopType === LoopType.Ambient,
      loopDurationSec: loopDuration,
      crossfadeMs: loopType === LoopType.Seamless ? 500 : 0,
      loopPoints: [
        `Loop start: bar 1 (${analysis.key})`,
        `Loop end: bar ${loopDuration / 4}`,
        "Zero-crossing aligned loop boundary",
      ],
      notes: [
        `${loopType} loop for ${analysis.genre} ${analysis.mood} context`,
        analysis.genre === MusicGenre.Ambient || analysis.genre === MusicGenre.LoFi
          ? "Seamless ambient loop recommended"
          : "Consider intro/outro loops for transitions",
      ],
    };
  }

  buildProductionInstructions(
    profile: MusicProfile,
    analysis: MusicAnalysis,
    arrangement: ArrangementPlan
  ): ProductionMusicInstructions {
    return {
      renderNotes: [
        `Music blueprint v${profile.version} — ${profile.genre} ${profile.mood}`,
        `Platform: ${profile.platform}`,
        "Blueprint only — no audio composition in this engine",
      ],
      mixGuidance: [
        `Balance ${arrangement.activeInstruments.length} active instruments`,
        `Energy level: ${analysis.energy}`,
        PLATFORM_MUSIC_CONFIG[profile.platform].loudnessTarget,
      ],
      exportPreparation: [
        `Target duration: ${analysis.durationSec}s`,
        `Format notes: ${PLATFORM_MUSIC_CONFIG[profile.platform].formatNotes}`,
      ],
      qualityTargets: [
        "Composition coherence ≥ 85%",
        "Harmonic clarity ≥ 80%",
        "Rhythmic stability ≥ 80%",
      ],
      orchestrationNotes: arrangement.activeInstruments.map((i) => `${i}: planned`),
    };
  }

  buildRecommendations(analysis: MusicAnalysis, moodPlan: MoodPlan, context: MusicContext): string[] {
    const recs: string[] = [];
    if (analysis.durationSec > 120) {
      recs.push("Consider sectional variation for extended duration");
    }
    if (context.brandGuidelines) {
      recs.push(`Apply brand guidelines: ${context.brandGuidelines.slice(0, 80)}`);
    }
    recs.push(`Preserve ${moodPlan.primaryMood} mood throughout ${analysis.genre} arrangement`);
    if (analysis.genre === MusicGenre.Cinematic || analysis.genre === MusicGenre.Orchestral) {
      recs.push("Plan dynamic swells for visual sync points");
    }
    return recs;
  }

  resolvePlatform(input: MusicGenerationInput, context: MusicContext): MusicPlatform {
    if (input.platform) return input.platform;
    if (context.creative?.profile.platform) {
      const p = context.creative.profile.platform.toLowerCase();
      if (p.includes("youtube")) return MusicPlatform.YouTube;
      if (p.includes("tiktok")) return MusicPlatform.TikTok;
      if (p.includes("instagram")) return MusicPlatform.Instagram;
      if (p.includes("facebook")) return MusicPlatform.Facebook;
      if (p.includes("mobile")) return MusicPlatform.Mobile;
      if (p.includes("tv") || p.includes("television")) return MusicPlatform.Television;
    }
    return MusicPlatform.Website;
  }

  extractContextFromInput(input: MusicGenerationInput): MusicContext {
    return {
      brandName: input.brandName ?? "KWIZERA",
      brandId: input.brandId,
      brandGuidelines: input.brandGuidelines,
      projectId: input.projectId,
      campaignId: input.campaignId,
      musicPrompt: input.musicPrompt,
    };
  }

  extractContextFromProduct(
    productId: string,
    productName: string,
    brandName: string,
    understanding?: ProductUnderstandingRecord | null,
    creative?: CreativeDirectionRecord | null,
    strategy?: MarketingStrategyRecord | null,
    input?: MusicGenerationInput
  ): MusicContext {
    return {
      productId,
      productName,
      brandName,
      brandId: input?.brandId ?? brandName,
      brandGuidelines: input?.brandGuidelines ?? creative?.profile.tone,
      projectId: input?.projectId ?? `project-${productId}`,
      campaignId: input?.campaignId ?? strategy?.relationships?.campaigns?.[0],
      targetAudience: understanding?.customer?.targetCustomer,
      industry: understanding?.customer?.targetIndustry,
      musicPrompt: input?.musicPrompt,
      creative,
      strategy,
      understanding,
    };
  }

  private detectGenre(context: MusicContext): MusicGenre {
    const industry = context.industry?.toLowerCase() ?? "default";
    const prompt = (context.musicPrompt ?? "").toLowerCase();
    if (prompt.includes("cinematic") || prompt.includes("epic")) return MusicGenre.Cinematic;
    if (prompt.includes("afrobeat")) return MusicGenre.Afrobeat;
    if (prompt.includes("jazz")) return MusicGenre.Jazz;
    if (prompt.includes("lo-fi") || prompt.includes("lofi")) return MusicGenre.LoFi;
    return INDUSTRY_GENRE_MAP[industry] ?? INDUSTRY_GENRE_MAP.default;
  }

  private detectMood(context: MusicContext): MusicMood {
    const industry = context.industry?.toLowerCase() ?? "default";
    const prompt = (context.musicPrompt ?? "").toLowerCase();
    if (prompt.includes("calm") || prompt.includes("relax")) return MusicMood.Calm;
    if (prompt.includes("epic") || prompt.includes("dramatic")) return MusicMood.Epic;
    if (prompt.includes("happy") || prompt.includes("upbeat")) return MusicMood.Happy;
    return INDUSTRY_MOOD_MAP[industry] ?? INDUSTRY_MOOD_MAP.default;
  }

  private detectKey(mood: MusicMood): string {
    const keys: Record<MusicMood, string> = {
      [MusicMood.Happy]: "C major",
      [MusicMood.Calm]: "A minor",
      [MusicMood.Emotional]: "D minor",
      [MusicMood.Inspirational]: "G major",
      [MusicMood.Epic]: "D minor",
      [MusicMood.Romantic]: "F major",
      [MusicMood.Serious]: "E minor",
      [MusicMood.Dramatic]: "B minor",
      [MusicMood.Energetic]: "A major",
      [MusicMood.Relaxing]: "E major",
    };
    return keys[mood];
  }

  private detectEnergy(mood: MusicMood, genre: MusicGenre): string {
    if ([MusicMood.Energetic, MusicMood.Epic, MusicMood.Happy].includes(mood)) return "high";
    if ([MusicMood.Calm, MusicMood.Relaxing].includes(mood)) return "low";
    if (genre === MusicGenre.EDM || genre === MusicGenre.Rock) return "high";
    if (genre === MusicGenre.Ambient || genre === MusicGenre.LoFi) return "low";
    return "medium";
  }

  private resolveDuration(platform?: MusicPlatform, context?: MusicContext): number {
    if (platform && PLATFORM_MUSIC_CONFIG[platform]) {
      return Math.min(PLATFORM_MUSIC_CONFIG[platform].maxDurationSec, 180);
    }
    return 60;
  }

  private buildChordProgression(analysis: MusicAnalysis): string[] {
    if (analysis.scale === "minor") {
      return ["i - VI - III - VII", "i - iv - V - i", "VI - VII - i"];
    }
    return ["I - V - vi - IV", "I - IV - V - I", "vi - IV - I - V"];
  }

  private secondaryMood(mood: MusicMood): MusicMood | undefined {
    const pairs: Partial<Record<MusicMood, MusicMood>> = {
      [MusicMood.Inspirational]: MusicMood.Epic,
      [MusicMood.Calm]: MusicMood.Relaxing,
      [MusicMood.Dramatic]: MusicMood.Emotional,
      [MusicMood.Happy]: MusicMood.Energetic,
    };
    return pairs[mood];
  }

  private detectSyncTarget(platform: MusicPlatform): SyncTarget {
    const map: Partial<Record<MusicPlatform, SyncTarget>> = {
      [MusicPlatform.YouTube]: SyncTarget.Video,
      [MusicPlatform.TikTok]: SyncTarget.SocialMedia,
      [MusicPlatform.Instagram]: SyncTarget.SocialMedia,
      [MusicPlatform.Facebook]: SyncTarget.SocialMedia,
      [MusicPlatform.Television]: SyncTarget.Advertisement,
      [MusicPlatform.Radio]: SyncTarget.Podcast,
    };
    return map[platform] ?? SyncTarget.Presentation;
  }

  private extractKeywords(input: MusicGenerationInput, context: MusicContext): string[] {
    const text = `${input.musicPrompt ?? ""} ${context.productName ?? ""} ${context.brandName ?? ""}`.toLowerCase();
    const words = text.split(/\W+/).filter((w) => w.length > 3);
    const base = [...new Set(words)].slice(0, 8);
    if (context.brandName) base.push(context.brandName.toLowerCase());
    return [...new Set(base)];
  }
}
