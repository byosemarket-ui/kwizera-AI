import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import {
  AmbientAudioGenerationInput,
  AmbientPlatform,
  AmbientProfile,
  AmbientSoundPlan,
  AmbientSyncTarget,
  AmbientTimelinePlan,
  EnvironmentAnalysis,
  EnvironmentCategory,
  IndoorAmbiencePlan,
  IndoorAmbienceType,
  NatureAmbienceType,
  PLATFORM_AMBIENT_CONFIG,
  ProductionAmbientInstructions,
  SpatialAudioPlan,
  UrbanAmbiencePlan,
  UrbanAmbienceType,
  WeatherAmbiencePlan,
  WeatherType,
  AmbientSyncPlan,
} from "./types.js";

export interface AmbientContext {
  productId?: string;
  productName?: string;
  brandName?: string;
  brandId?: string;
  brandGuidelines?: string;
  projectId?: string;
  campaignId?: string;
  targetAudience?: string;
  industry?: string;
  environmentPrompt?: string;
  geographicContext?: string;
  creative?: CreativeDirectionRecord | null;
  strategy?: MarketingStrategyRecord | null;
  understanding?: ProductUnderstandingRecord | null;
}

const INDUSTRY_CATEGORY_MAP: Record<string, EnvironmentCategory> = {
  technology: EnvironmentCategory.Indoor,
  health: EnvironmentCategory.Indoor,
  education: EnvironmentCategory.Indoor,
  fashion: EnvironmentCategory.Urban,
  finance: EnvironmentCategory.Indoor,
  entertainment: EnvironmentCategory.Mixed,
  default: EnvironmentCategory.Mixed,
};

export class AmbientAudioGenerationAnalyzer {
  analyzeEnvironment(input: AmbientAudioGenerationInput, context: AmbientContext): EnvironmentAnalysis {
    const category = input.environmentCategory ?? this.detectCategory(context);
    const prompt = (input.environmentPrompt ?? context.environmentPrompt ?? "").toLowerCase();
    const indoorOutdoor = input.indoorOutdoor ?? this.detectIndoorOutdoor(prompt, category);

    return {
      environmentType: category,
      location: input.geographicContext ?? context.geographicContext ?? context.productName ?? "general location",
      timeOfDay: input.timeOfDay ?? this.detectTimeOfDay(prompt),
      weather: input.weatherHint ?? this.detectWeather(prompt),
      season: this.detectSeason(prompt),
      crowdDensity: indoorOutdoor === "outdoor" && prompt.includes("market") ? "high" : "low-medium",
      indoorOutdoor,
      distance: "mid-field ambient bed",
      acousticSpace: indoorOutdoor === "indoor" ? "medium room reverb" : "open air spacious",
      intendedMood: this.detectMood(context, category),
      durationSec: input.durationSec ?? this.resolveDuration(input.platform),
      keywords: this.extractKeywords(prompt, context),
    };
  }

  buildProfile(
    input: AmbientAudioGenerationInput,
    platform: AmbientPlatform,
    version: number,
    context: AmbientContext,
    analysis: EnvironmentAnalysis
  ): AmbientProfile {
    const productId = context.productId ?? input.productId ?? "standalone";
    const category = input.environmentCategory ?? (analysis.environmentType as EnvironmentCategory);
    const ambientPlanId = `ambient-plan-${productId}-${category}-${platform}-v${version}`;

    return {
      ambientPlanId,
      projectId: input.projectId ?? context.projectId ?? `project-${productId}`,
      brandId: input.brandId ?? context.brandId ?? context.brandName ?? "unknown-brand",
      campaignId: input.campaignId ?? context.campaignId,
      platform,
      environmentCategory: category,
      version,
    };
  }

  buildAmbientSoundPlan(analysis: EnvironmentAnalysis, category: EnvironmentCategory): AmbientSoundPlan {
    const types: NatureAmbienceType[] = [];
    if (category === EnvironmentCategory.Nature || category === EnvironmentCategory.Mixed) {
      types.push(NatureAmbienceType.Forest, NatureAmbienceType.Birds);
      if (analysis.weather.includes("rain")) types.push(NatureAmbienceType.Rain);
      if (analysis.indoorOutdoor === "outdoor") types.push(NatureAmbienceType.Wind);
    }
    if (types.length === 0) types.push(NatureAmbienceType.Wind);

    const layers: Record<string, string> = {};
    for (const t of types) {
      layers[t] = `${t} ambient layer — ${analysis.intendedMood} mood`;
    }

    return {
      natureAmbience: types,
      layers,
      primaryNature: types[0],
      secondaryLayers: types.slice(1).map((t) => layers[t]),
    };
  }

  buildUrbanAmbiencePlan(analysis: EnvironmentAnalysis, category: EnvironmentCategory): UrbanAmbiencePlan {
    const types: UrbanAmbienceType[] =
      category === EnvironmentCategory.Urban || category === EnvironmentCategory.Mixed
        ? [UrbanAmbienceType.City, UrbanAmbienceType.Traffic]
        : [];

    if (analysis.keywords.some((k) => k.includes("market"))) types.push(UrbanAmbienceType.Market);

    const layerDetails: Record<string, string> = {};
    for (const t of types) {
      layerDetails[t] = `${t} urban bed — ${analysis.crowdDensity} density`;
    }

    return {
      urbanTypes: types,
      primaryUrban: types[0] ?? "none",
      layerDetails,
      densityNotes: [`Crowd density: ${analysis.crowdDensity}`, `Acoustic space: ${analysis.acousticSpace}`],
    };
  }

  buildIndoorAmbiencePlan(analysis: EnvironmentAnalysis, category: EnvironmentCategory): IndoorAmbiencePlan {
    const types: IndoorAmbienceType[] =
      category === EnvironmentCategory.Indoor || category === EnvironmentCategory.Mixed
        ? [IndoorAmbienceType.Office]
        : [];

    if (analysis.location.toLowerCase().includes("health") || analysis.intendedMood === "calm") {
      types[0] = IndoorAmbienceType.Hospital;
    }
    if (analysis.keywords.some((k) => k.includes("restaurant"))) types.push(IndoorAmbienceType.Restaurant);

    const layerDetails: Record<string, string> = {};
    for (const t of types) {
      layerDetails[t] = `${t} room tone — ${analysis.acousticSpace}`;
    }

    return {
      indoorTypes: types,
      primaryIndoor: types[0] ?? "none",
      roomTone: `Steady ${analysis.acousticSpace} room tone`,
      activityLevel: analysis.crowdDensity === "high" ? "active" : "quiet",
      layerDetails,
    };
  }

  buildWeatherAmbiencePlan(analysis: EnvironmentAnalysis): WeatherAmbiencePlan {
    const types: WeatherType[] = [];
    const weather = analysis.weather.toLowerCase();

    if (weather.includes("rain")) types.push(WeatherType.LightRain);
    if (weather.includes("storm")) types.push(WeatherType.Storm, WeatherType.Thunder);
    if (weather.includes("wind")) types.push(WeatherType.Wind);
    if (weather.includes("snow")) types.push(WeatherType.Snow);
    if (analysis.timeOfDay === "night") types.push(WeatherType.Night);
    if (analysis.timeOfDay === "sunrise") types.push(WeatherType.Sunrise);
    if (analysis.timeOfDay === "sunset") types.push(WeatherType.Sunset);
    if (types.length === 0) types.push(WeatherType.Dawn);

    const weatherLayers: Record<string, string> = {};
    for (const t of types) {
      weatherLayers[t] = `${t} layer aligned to ${analysis.timeOfDay}`;
    }

    return {
      weatherTypes: types,
      primaryWeather: types[0],
      intensity: weather.includes("heavy") ? "high" : "moderate",
      weatherLayers,
      timeOfDayAlignment: `Weather bed matched to ${analysis.timeOfDay} / ${analysis.season}`,
    };
  }

  buildSpatialAudioPlan(analysis: EnvironmentAnalysis): SpatialAudioPlan {
    return {
      leftRightPositioning: "Wide stereo field with natural panning",
      frontBackPositioning: analysis.indoorOutdoor === "indoor" ? "Close frontal presence" : "Deep front-to-back depth",
      distance: analysis.distance,
      depth: `Layered depth — foreground detail, mid ${analysis.environmentType}, far ambience`,
      movement: analysis.indoorOutdoor === "outdoor" ? "Subtle environmental movement" : "Static room presence",
      surroundPreparation: "5.1 surround bed — L/R/C/Ls/Rs channel mapping prepared",
      binauralPreparation: "HRTF-ready binaural spatialization for headphone delivery",
    };
  }

  buildTimelinePlan(analysis: EnvironmentAnalysis, ambientPlan: AmbientSoundPlan, platform: AmbientPlatform): AmbientTimelinePlan {
    const duration = analysis.durationSec;
    const config = PLATFORM_AMBIENT_CONFIG[platform];

    return {
      cuePoints: [
        { timeSec: 0, label: "Entry", layer: "fade-in" },
        { timeSec: Math.round(duration * 0.25), label: "Establish", layer: ambientPlan.primaryNature },
        { timeSec: Math.round(duration * 0.5), label: "Sustain", layer: "full bed" },
        { timeSec: Math.round(duration * 0.75), label: "Variation", layer: "secondary layers" },
        { timeSec: duration, label: "Exit", layer: config.loopRecommended ? "loop point" : "fade-out" },
      ],
      layerOrder: ["weather bed", "nature/urban bed", "indoor room tone", "spatial accents"],
      fadeIn: "3s ambient fade-in",
      fadeOut: config.loopRecommended ? "seamless loop crossfade" : "4s fade-out",
      crossfade: "500ms crossfade between loop segments",
      loopPlanning: config.loopRecommended ? "Seamless loop at 60s boundary" : "No loop — linear arc",
      dynamicIntensity: [
        `Base intensity: ${analysis.crowdDensity}`,
        "Gradual swell at midpoint",
        "Gentle release before outro",
      ],
    };
  }

  buildSyncPreparation(input: AmbientAudioGenerationInput, analysis: EnvironmentAnalysis, platform: AmbientPlatform): AmbientSyncPlan {
    const syncTarget = input.syncTarget ?? this.detectSyncTarget(platform);
    const config = PLATFORM_AMBIENT_CONFIG[platform];

    return {
      syncTarget,
      hitPoints: [
        `0s: ambient entry — ${analysis.intendedMood}`,
        `${Math.round(analysis.durationSec * 0.5)}s: midpoint sustain`,
        `${analysis.durationSec}s: ${config.loopRecommended ? "loop boundary" : "outro"}`,
      ],
      syncNotes: [
        `Sync ambient bed to ${syncTarget}`,
        `Duration: ${analysis.durationSec}s`,
        `Mood: ${analysis.intendedMood}`,
      ],
      platformNotes: [config.formatNotes],
    };
  }

  buildProductionInstructions(
    profile: AmbientProfile,
    analysis: EnvironmentAnalysis,
    spatial: SpatialAudioPlan
  ): ProductionAmbientInstructions {
    return {
      renderNotes: [
        `Ambient blueprint v${profile.version} — ${profile.environmentCategory} ${profile.platform}`,
        "Blueprint only — no audio synthesis in this engine",
      ],
      immersionGuidance: [
        `Target mood: ${analysis.intendedMood}`,
        `Acoustic space: ${analysis.acousticSpace}`,
        `Indoor/outdoor: ${analysis.indoorOutdoor}`,
      ],
      spatialGuidance: [
        spatial.surroundPreparation,
        spatial.binauralPreparation,
        spatial.depth,
      ],
      exportPreparation: [
        `Duration: ${analysis.durationSec}s`,
        PLATFORM_AMBIENT_CONFIG[profile.platform].formatNotes,
      ],
      qualityTargets: ["Environmental realism ≥ 80%", "Immersion ≥ 75%", "Spatial clarity ≥ 75%"],
    };
  }

  buildRecommendations(analysis: EnvironmentAnalysis, context: AmbientContext, category: EnvironmentCategory): string[] {
    const recs: string[] = [];
    if (analysis.durationSec > 120 && PLATFORM_AMBIENT_CONFIG[AmbientPlatform.Website].loopRecommended) {
      recs.push("Enable seamless looping for extended ambient duration");
    }
    if (context.brandGuidelines) {
      recs.push(`Apply brand ambient guidelines: ${context.brandGuidelines.slice(0, 80)}`);
    }
    if (category === EnvironmentCategory.Nature) {
      recs.push("Layer birds and wind for natural immersion depth");
    }
    if (analysis.indoorOutdoor === "indoor") {
      recs.push("Maintain consistent room tone without distracting transients");
    }
    return recs.length > 0 ? recs : ["Ambient audio blueprint ready for production planning"];
  }

  resolvePlatform(input: AmbientAudioGenerationInput, context: AmbientContext): AmbientPlatform {
    if (input.platform) return input.platform;
    if (context.creative?.profile.platform) {
      const p = context.creative.profile.platform.toLowerCase();
      if (p.includes("youtube")) return AmbientPlatform.YouTube;
      if (p.includes("tiktok")) return AmbientPlatform.TikTok;
      if (p.includes("instagram")) return AmbientPlatform.Instagram;
      if (p.includes("facebook")) return AmbientPlatform.Facebook;
      if (p.includes("mobile")) return AmbientPlatform.Mobile;
      if (p.includes("tv") || p.includes("television")) return AmbientPlatform.Television;
    }
    return AmbientPlatform.Website;
  }

  extractContextFromInput(input: AmbientAudioGenerationInput): AmbientContext {
    return {
      brandName: input.brandName ?? "KWIZERA",
      brandId: input.brandId,
      brandGuidelines: input.brandGuidelines,
      projectId: input.projectId,
      campaignId: input.campaignId,
      environmentPrompt: input.environmentPrompt,
      geographicContext: input.geographicContext,
    };
  }

  extractContextFromProduct(
    productId: string,
    productName: string,
    brandName: string,
    understanding?: ProductUnderstandingRecord | null,
    creative?: CreativeDirectionRecord | null,
    strategy?: MarketingStrategyRecord | null,
    input?: AmbientAudioGenerationInput
  ): AmbientContext {
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
      environmentPrompt: input?.environmentPrompt,
      geographicContext: input?.geographicContext,
      creative,
      strategy,
      understanding,
    };
  }

  private detectCategory(context: AmbientContext): EnvironmentCategory {
    const prompt = (context.environmentPrompt ?? "").toLowerCase();
    if (prompt.includes("forest") || prompt.includes("nature") || prompt.includes("ocean")) return EnvironmentCategory.Nature;
    if (prompt.includes("city") || prompt.includes("traffic") || prompt.includes("urban")) return EnvironmentCategory.Urban;
    if (prompt.includes("office") || prompt.includes("indoor") || prompt.includes("hospital")) return EnvironmentCategory.Indoor;
    if (prompt.includes("rain") || prompt.includes("storm") || prompt.includes("weather")) return EnvironmentCategory.Weather;
    const industry = context.industry?.toLowerCase() ?? "default";
    return INDUSTRY_CATEGORY_MAP[industry] ?? EnvironmentCategory.Mixed;
  }

  private detectIndoorOutdoor(prompt: string, category: EnvironmentCategory): "indoor" | "outdoor" | "mixed" {
    if (prompt.includes("outdoor") || category === EnvironmentCategory.Nature || category === EnvironmentCategory.Urban) return "outdoor";
    if (prompt.includes("indoor") || category === EnvironmentCategory.Indoor) return "indoor";
    return "mixed";
  }

  private detectTimeOfDay(prompt: string): string {
    if (prompt.includes("night")) return "night";
    if (prompt.includes("sunrise") || prompt.includes("dawn")) return "sunrise";
    if (prompt.includes("sunset")) return "sunset";
    if (prompt.includes("morning")) return "morning";
    return "day";
  }

  private detectWeather(prompt: string): string {
    if (prompt.includes("storm")) return "storm";
    if (prompt.includes("heavy rain")) return "heavy rain";
    if (prompt.includes("rain")) return "light rain";
    if (prompt.includes("wind")) return "windy";
    if (prompt.includes("snow")) return "snow";
    return "clear";
  }

  private detectSeason(prompt: string): string {
    if (prompt.includes("winter") || prompt.includes("snow")) return "winter";
    if (prompt.includes("summer")) return "summer";
    if (prompt.includes("autumn") || prompt.includes("fall")) return "autumn";
    return "spring";
  }

  private detectMood(context: AmbientContext, category: EnvironmentCategory): string {
    if (context.industry === "health") return "calm";
    if (category === EnvironmentCategory.Nature) return "peaceful";
    if (category === EnvironmentCategory.Urban) return "energetic";
    return "neutral-immersive";
  }

  private resolveDuration(platform?: AmbientPlatform): number {
    if (platform && PLATFORM_AMBIENT_CONFIG[platform]) {
      return Math.min(PLATFORM_AMBIENT_CONFIG[platform].maxDurationSec, 120);
    }
    return 60;
  }

  private detectSyncTarget(platform: AmbientPlatform): AmbientSyncTarget {
    const map: Partial<Record<AmbientPlatform, AmbientSyncTarget>> = {
      [AmbientPlatform.YouTube]: AmbientSyncTarget.Video,
      [AmbientPlatform.TikTok]: AmbientSyncTarget.Advertisement,
      [AmbientPlatform.Television]: AmbientSyncTarget.Film,
      [AmbientPlatform.Mobile]: AmbientSyncTarget.Game,
    };
    return map[platform] ?? AmbientSyncTarget.Presentation;
  }

  private extractKeywords(prompt: string, context: AmbientContext): string[] {
    const words = `${prompt} ${context.productName ?? ""} ${context.brandName ?? ""}`.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
    const base = [...new Set(words)].slice(0, 8);
    if (context.brandName) base.push(context.brandName.toLowerCase());
    return [...new Set(base)];
  }
}
