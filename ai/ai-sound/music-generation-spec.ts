/**
 * STEP 2E — AI Sound Director.
 * Converts product/video context + optional style/reference into MusicGenerationSpec.
 * Does not generate audio; does not invent BPM/beats.
 */
import {
  MUSIC_GENERATION_SPEC_VERSION,
  type AudioStyleProfile,
  type MusicEnergyLevel,
  type MusicGenerationMode,
  type MusicGenerationSpec,
  type MusicMood,
  type MusicStructureSection,
  type MusicTempoPreference,
} from "./types.js";

export interface SoundDirectorContext {
  productName?: string | null;
  productCategory?: string | null;
  campaignObjective?: string | null;
  platform?: string | null;
  targetAudience?: string | null;
  brandName?: string | null;
  callToAction?: string | null;
  durationSeconds: number;
  mood?: MusicMood;
  energy?: MusicEnergyLevel;
  tempo?: MusicTempoPreference;
  mode?: MusicGenerationMode;
  styleProfile?: AudioStyleProfile | null;
  referenceHints?: {
    bpm?: number | null;
    meanEnergy?: number | null;
    beatDensity?: "sparse" | "normal" | "dense" | null;
  } | null;
  userNotes?: string | null;
}

function clampDuration(sec: number): number {
  if (!Number.isFinite(sec) || sec <= 0) return 15;
  return Math.min(120, Math.max(5, Math.round(sec)));
}

function structureForDuration(sec: number): MusicStructureSection[] {
  if (sec <= 18) {
    return [
      { label: "intro", weight: 0.15 },
      { label: "build", weight: 0.25 },
      { label: "climax", weight: 0.4 },
      { label: "outro", weight: 0.2 },
    ];
  }
  if (sec <= 35) {
    return [
      { label: "intro", weight: 0.12 },
      { label: "build", weight: 0.22 },
      { label: "main", weight: 0.28 },
      { label: "climax", weight: 0.25 },
      { label: "outro", weight: 0.13 },
    ];
  }
  return [
    { label: "intro", weight: 0.1 },
    { label: "build", weight: 0.2 },
    { label: "main", weight: 0.35 },
    { label: "climax", weight: 0.22 },
    { label: "outro", weight: 0.13 },
  ];
}

function categoryMood(category: string | null | undefined): Exclude<MusicMood, "AUTO"> {
  const c = (category ?? "").toLowerCase();
  if (/watch|jewelry|luxury|perfume|fashion|suit/.test(c)) return "PREMIUM";
  if (/shoe|sport|run|fitness|gym|bike/.test(c)) return "ENERGETIC";
  if (/bakery|cafe|food|restaurant|coffee|tea/.test(c)) return "WARM";
  if (/toy|kids|game|candy/.test(c)) return "PLAYFUL";
  if (/tech|phone|laptop|gadget|software/.test(c)) return "MODERN";
  if (/real.?estate|hotel|spa|wellness/.test(c)) return "CINEMATIC";
  return "MODERN";
}

function objectiveEnergy(objective: string | null | undefined): Exclude<MusicEnergyLevel, "AUTO"> {
  const o = (objective ?? "").toLowerCase();
  if (/sale|promo|discount|launch|viral|attention/.test(o)) return "HIGH";
  if (/brand|awareness|story|premium|trust/.test(o)) return "MEDIUM";
  return "MEDIUM";
}

function resolveMood(input: SoundDirectorContext): Exclude<MusicMood, "AUTO"> {
  if (input.mood && input.mood !== "AUTO") return input.mood;
  const fromStyle = input.styleProfile?.preferences.moods?.[0];
  if (fromStyle) {
    const u = fromStyle.toUpperCase();
    if (["ENERGETIC", "PREMIUM", "WARM", "MODERN", "CINEMATIC", "PLAYFUL", "CALM"].includes(u)) {
      return u as Exclude<MusicMood, "AUTO">;
    }
  }
  return categoryMood(input.productCategory);
}

function resolveEnergy(input: SoundDirectorContext): Exclude<MusicEnergyLevel, "AUTO"> {
  if (input.energy && input.energy !== "AUTO") return input.energy;
  const pref = input.styleProfile?.preferences.preferredEnergy;
  if (pref === "low" || pref === "medium" || pref === "high") {
    return pref.toUpperCase() as Exclude<MusicEnergyLevel, "AUTO">;
  }
  const ref = input.referenceHints?.meanEnergy;
  if (typeof ref === "number") {
    if (ref < 0.3) return "LOW";
    if (ref > 0.65) return "HIGH";
    return "MEDIUM";
  }
  return objectiveEnergy(input.campaignObjective);
}

function resolveTempo(
  input: SoundDirectorContext,
  energy: Exclude<MusicEnergyLevel, "AUTO">,
): [number, number] {
  const styleMin = input.styleProfile?.preferences.bpmMin;
  const styleMax = input.styleProfile?.preferences.bpmMax;
  if (typeof styleMin === "number" && typeof styleMax === "number" && styleMax >= styleMin) {
    return [Math.round(styleMin), Math.round(styleMax)];
  }
  const refBpm = input.referenceHints?.bpm;
  if (typeof refBpm === "number" && refBpm > 40 && refBpm < 200) {
    return [Math.round(refBpm - 5), Math.round(refBpm + 5)];
  }
  if (input.tempo === "SLOW") return [70, 90];
  if (input.tempo === "FAST") return [120, 140];
  if (input.tempo === "MEDIUM") return [100, 118];
  if (energy === "HIGH") return [115, 128];
  if (energy === "LOW") return [75, 95];
  return [100, 118];
}

function instrumentationFor(
  mood: Exclude<MusicMood, "AUTO">,
  category: string | null | undefined,
): string[] {
  const hints = [] as string[];
  if (mood === "PREMIUM" || mood === "CINEMATIC") hints.push("soft pads", "subtle percussion", "warm bass");
  else if (mood === "ENERGETIC") hints.push("punchy drums", "modern synth", "bass pulse");
  else if (mood === "WARM") hints.push("acoustic guitar", "light percussion", "soft keys");
  else if (mood === "PLAYFUL") hints.push("plucky synth", "light drums", "bright accents");
  else hints.push("modern drums", "synth bed", "clean bass");
  const c = (category ?? "").toLowerCase();
  if (/tech|phone|gadget/.test(c)) hints.push("digital textures");
  return hints;
}

function advertisingIntensity(
  energy: Exclude<MusicEnergyLevel, "AUTO">,
  objective: string | null | undefined,
): "low" | "medium" | "high" {
  const fromStyle = inputStyleIntensity(objective);
  if (energy === "HIGH" || /sale|promo|discount/.test((objective ?? "").toLowerCase())) return "high";
  if (energy === "LOW") return "low";
  return fromStyle ?? "medium";
}

function inputStyleIntensity(_objective: string | null | undefined): "low" | "medium" | "high" | null {
  return null;
}

export function buildMusicGenerationSpec(input: SoundDirectorContext): MusicGenerationSpec {
  const durationSeconds = clampDuration(input.durationSeconds);
  const mood = resolveMood(input);
  const energy = resolveEnergy(input);
  const tempoRange = resolveTempo(input, energy);
  const mode: MusicGenerationMode = input.mode
    ?? (input.styleProfile && input.referenceHints
      ? "COMBINED"
      : input.styleProfile
        ? "STYLE_PROFILE"
        : input.referenceHints
          ? "REFERENCE_CHARACTERISTICS"
          : "PRODUCT_CONTEXT");

  const intensity = input.styleProfile?.preferences.advertisingIntensity
    ?? advertisingIntensity(energy, input.campaignObjective);

  return {
    version: MUSIC_GENERATION_SPEC_VERSION,
    purpose: "commercial_product_video",
    mode,
    durationSeconds,
    genre: mood === "PREMIUM" || mood === "CINEMATIC"
      ? "cinematic-electronic"
      : mood === "WARM"
        ? "warm-acoustic-pop"
        : "modern-advertising-electronic",
    mood,
    energy,
    tempoRange,
    instrumentation: [
      ...instrumentationFor(mood, input.productCategory),
      ...(input.styleProfile?.preferences.instrumentationHints ?? []),
    ].slice(0, 8),
    rhythm: input.referenceHints?.beatDensity === "dense"
      ? "driving"
      : input.referenceHints?.beatDensity === "sparse"
        ? "spacious"
        : energy === "HIGH"
          ? "punchy"
          : "steady",
    structure: structureForDuration(durationSeconds),
    introStyle: input.styleProfile?.preferences.introPreference === "long" ? "gradual" : "short-attention",
    climaxStyle: input.styleProfile?.preferences.climaxPreference === "early" ? "early-accent" : "mid-to-late-accent",
    outroStyle: input.styleProfile?.preferences.outroPreference === "soft" ? "soft-resolve" : "strong-commercial-end",
    vocalMode: "none",
    instrumentalOnly: true,
    advertisingIntensity: intensity,
    platform: input.platform ?? undefined,
    productCategory: input.productCategory ?? undefined,
    styleProfileId: input.styleProfile?.profileId ?? null,
    referenceAudioAssetIds: input.styleProfile?.sourceAudioAssetIds?.length
      ? [...input.styleProfile.sourceAudioAssetIds]
      : [],
    userNotes: input.userNotes?.trim() || null,
    createdAt: new Date().toISOString(),
  };
}

export function generatedAudioTitle(spec: MusicGenerationSpec, when = new Date()): string {
  const date = when.toISOString().slice(0, 10);
  const mood = spec.mood.charAt(0) + spec.mood.slice(1).toLowerCase();
  return `AI Beat — ${mood} Product Ad — ${date}`;
}
