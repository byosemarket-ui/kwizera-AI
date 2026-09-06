/**
 * STEP 2F — Deterministic AudioVisualCreativePlan builder.
 * Storyboard authority preserved; audio influences intensity/timing presentation only.
 * Never fabricates beats or BPM.
 */
import { createHash, randomUUID } from "node:crypto";
import type { AudioTimingIntelligence } from "../audio-intelligence/types.js";
import type { BeatSyncTimingPlan } from "../video-production/beat-sync-timing.js";
import type { VideoTimelineClip } from "../video-production/types.js";
import { normalizeCreativeMode, policyForMode, type CreativeModePolicy } from "./creative-modes.js";
import { buildVisualEnergyProfile, energyAtMs, energyBand } from "./energy-mapping.js";
import type {
  AudioVisualCreativePlan,
  AvConfidence,
  AvCreativeMode,
  AvDirectorOverrides,
  AvDirectorStatus,
  AvEmphasisEvent,
  AvSceneDecision,
  AvTextSafetyWindow,
  CtaTimingDecision,
  EndCardTimingDecision,
  HookTimingDecision,
  IntensityLevel,
  PacingQualityReport,
  ProductImportanceCategory,
  ProductRevealDecision,
  RevealStrategy,
  AvBalanceReport,
} from "./types.js";
import { AV_CREATIVE_DIRECTOR_VERSION } from "./types.js";

export interface BuildAvPlanInput {
  projectId: string;
  clips: VideoTimelineClip[];
  beatPlan: BeatSyncTimingPlan | null;
  audioIntel: AudioTimingIntelligence | null;
  creativeMode?: AvCreativeMode | string | null;
  overrides?: AvDirectorOverrides | null;
  storyboardVersion?: number | null;
  aspectRatio: string;
  productCategory?: string | null;
  marketingObjective?: string | null;
  /** Stable seed for any future stochastic needs — currently unused. */
  seed?: string;
}

function purposeRole(purpose: string): string {
  const p = purpose.toUpperCase();
  if (/END.?CARD|ENDCARD|CLOSING|BRAND/.test(p)) return "END_CARD";
  if (/CTA|CALL.?TO.?ACTION|ORDER|SHOP/.test(p)) return "CTA";
  if (/PRICE|DISCOUNT|OFFER|SALE|PROMO/.test(p)) return "PRICE";
  if (/HOOK|OPEN|ATTENTION/.test(p)) return "HOOK";
  if (/REVEAL|HERO|PRODUCT/.test(p)) return "PRODUCT_REVEAL";
  if (/FEATURE|SPEC/.test(p)) return "FEATURE";
  if (/BENEFIT/.test(p)) return "BENEFIT";
  if (/DETAIL|MACRO|CLOSE/.test(p)) return "DETAIL";
  if (/LIFESTYLE|CONTEXT/.test(p)) return "LIFESTYLE";
  if (/INTRO/.test(p)) return "INTRO";
  return "SCENE";
}

function productImportance(role: string, category: string | null | undefined): {
  category: ProductImportanceCategory;
  score: number;
} {
  if (role === "PRODUCT_REVEAL" || role === "HOOK") return { category: "HERO_PRODUCT", score: 0.95 };
  if (role === "DETAIL") return { category: "DETAIL", score: 0.7 };
  if (role === "FEATURE") return { category: "FEATURE", score: 0.75 };
  if (role === "LIFESTYLE") return { category: "LIFESTYLE", score: 0.55 };
  if (role === "CTA" || role === "END_CARD") return { category: "SUPPORTING", score: 0.4 };
  if (role === "PRICE") return { category: "FEATURE", score: 0.8 };
  const c = (category ?? "").toLowerCase();
  if (/luxury|watch|jewelry/.test(c) && role === "PRODUCT_REVEAL") {
    return { category: "HERO_PRODUCT", score: 1 };
  }
  return { category: "SECONDARY_PRODUCT", score: 0.6 };
}

function intensityFrom(energy: number, scale: number, reduce: boolean): IntensityLevel {
  const e = energy * scale * (reduce ? 0.55 : 1);
  if (e < 0.35) return "LOW";
  if (e < 0.65) return "MEDIUM";
  return "HIGH";
}

function textMinMs(role: string, scale: number): number {
  const base =
    role === "CTA" || role === "END_CARD" ? 2200
      : role === "FEATURE" || role === "BENEFIT" || role === "PRICE" ? 1800
        : role === "HOOK" ? 1400
          : 1200;
  return Math.round(base * scale);
}

function confidenceFromIntel(intel: AudioTimingIntelligence | null, beatPlan: BeatSyncTimingPlan | null): AvConfidence {
  if (!intel || intel.status !== "READY") return "LOW";
  if (intel.technical?.silent || !intel.beats?.length) return "LOW";
  const bpmConf = intel.bpmConfidence ?? 0;
  if (bpmConf >= 0.55 && beatPlan && beatPlan.mode !== "OFF") return "HIGH";
  if (bpmConf >= 0.3 || (intel.beats?.length ?? 0) > 4) return "MEDIUM";
  return "LOW";
}

function directorStatus(confidence: AvConfidence, fallback: string | null): AvDirectorStatus {
  if (fallback && confidence === "LOW") return "DIRECTOR_FALLBACK";
  if (confidence === "LOW") return "DIRECTOR_LOW_CONFIDENCE";
  return "DIRECTOR_READY";
}

function revealStrategy(
  bias: CreativeModePolicy["revealBias"],
  category: string | null | undefined,
  energy: number,
): RevealStrategy {
  const c = (category ?? "").toLowerCase();
  if (/luxury|watch|jewelry|perfume/.test(c)) return "cinematic";
  if (bias === "immediate") return "immediate";
  if (bias === "cinematic") return "cinematic";
  if (bias === "gradual") return "gradual";
  if (energy >= 0.6) return "beat";
  return "gradual";
}

function firstStrongBeatMs(intel: AudioTimingIntelligence | null): number | null {
  const b = intel?.strongBeats?.[0] ?? intel?.beats?.find((x) => x.strengthClass === "strong" || x.strengthClass === "accent");
  return b ? Math.round(b.time * 1000) : null;
}

function lastStrongBeatMs(intel: AudioTimingIntelligence | null, durationMs: number): number | null {
  const beats = intel?.strongBeats?.length ? intel.strongBeats : intel?.beats ?? [];
  if (!beats.length) return null;
  const last = beats[beats.length - 1]!;
  const ms = Math.round(last.time * 1000);
  return ms <= durationMs ? ms : null;
}

export function buildAvCreativePlanCacheKey(input: {
  projectId: string;
  audioAssetId: string | null;
  contentHash: string | null;
  analysisVersion: string | null;
  beatSyncVersion: string | null;
  beatMode: string | null;
  storyboardVersion: number | null;
  creativeMode: string;
  overrides: AvDirectorOverrides;
  aspectRatio: string;
  clipFingerprint: string;
}): string {
  return createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex")
    .slice(0, 32);
}

export function clipFingerprint(clips: VideoTimelineClip[]): string {
  return clips.map((c) => `${c.sceneId}:${c.durationMs}:${c.purpose}`).join("|");
}

export function buildAudioVisualCreativePlan(input: BuildAvPlanInput): AudioVisualCreativePlan {
  const started = Date.now();
  const overrides: AvDirectorOverrides = { ...(input.overrides ?? {}) };
  const mode = normalizeCreativeMode(overrides.forceMode ?? input.creativeMode ?? "BALANCED");
  const policy = policyForMode(mode);
  const energyProfile = overrides.disableEnergySync
    ? { version: "visual-energy-v1" as const, samples: [], meanEnergy: null, peakEnergy: null, source: "FALLBACK" as const }
    : buildVisualEnergyProfile(input.audioIntel);

  const confidence = confidenceFromIntel(input.audioIntel, input.beatPlan);
  let fallbackReason: string | null = null;
  if (!input.audioIntel || input.audioIntel.status !== "READY") {
    fallbackReason = "Audio analysis unavailable. Using storyboard timing fallback.";
  } else if (input.audioIntel.technical?.silent || !(input.audioIntel.beats?.length)) {
    fallbackReason = "No meaningful beats detected. Using conservative visual pacing.";
  } else if (confidence === "LOW") {
    fallbackReason = "Low-confidence rhythm. Conserving motion and protecting text readability.";
  }
  if (overrides.disableBeatSync) {
    fallbackReason = (fallbackReason ? `${fallbackReason} ` : "") + "Beat sync disabled by override.";
  }

  const useBeats = confidence !== "LOW" && !overrides.disableBeatSync && energyProfile.source === "AUDIO_TIMELINE";

  const scenes: AvSceneDecision[] = [];
  const textSafetyWindows: AvTextSafetyWindow[] = [];
  const motionDecisions = [];
  const cameraDecisions = [];
  const transitions = [];
  const emphasisEvents: AvEmphasisEvent[] = [];
  const productRevealEvents: ProductRevealDecision[] = [];
  const hookEvents: HookTimingDecision[] = [];
  const CTAEvents: CtaTimingDecision[] = [];

  let cursor = 0;
  for (let i = 0; i < input.clips.length; i++) {
    const clip = input.clips[i]!;
    const beatScene = input.beatPlan?.scenes.find((s) => s.sceneId === clip.sceneId || s.clipId === clip.id);
    const startMs = beatScene?.startMs ?? cursor;
    const durationMs = beatScene?.durationMs ?? clip.durationMs;
    const endMs = beatScene?.endMs ?? startMs + durationMs;
    cursor = endMs;

    const role = purposeRole(clip.purpose || "");
    const importance = productImportance(role, input.productCategory);
    const mid = startMs + durationMs / 2;
    const energy = energyAtMs(energyProfile, mid);
    const band = energyBand(energy);
    const reduceMotion = Boolean(overrides.reduceMotion) || confidence === "LOW";
    const motionIntensity = intensityFrom(energy, policy.motionScale, reduceMotion);
    const cameraIntensity = intensityFrom(energy, policy.cameraScale, reduceMotion);
    const needsText = ["FEATURE", "BENEFIT", "CTA", "PRICE", "END_CARD", "HOOK"].includes(role);
    const minText = textMinMs(role, policy.textDurationScale);
    const textSafety = needsText && durationMs >= minText * 0.9;

    let transitionType: "cut" | "fade" = "cut";
    if (overrides.reduceTransitions || confidence === "LOW" || policy.transitionFadeBias >= 0.6) {
      transitionType = "fade";
    } else if (energy < 0.35) {
      transitionType = "fade";
    } else if (policy.transitionFadeBias < 0.3 && energy >= 0.55) {
      transitionType = "cut";
    } else {
      transitionType = policy.transitionFadeBias >= 0.5 ? "fade" : "cut";
    }

    const beatRel = beatScene
      ? `${beatScene.alignmentType}/${beatScene.timingSource}`
      : "STORYBOARD";

    let reasoning = "Storyboard pacing retained";
    if (useBeats && beatScene && beatScene.alignmentType !== "NONE") {
      reasoning = importance.score >= 0.85
        ? "Strong beat + high product importance"
        : `Beat alignment (${beatScene.alignmentType}) with ${band} energy`;
    } else if (needsText && energy < 0.4) {
      reasoning = "Low-energy section reserved for readable benefit text";
    } else if (confidence === "LOW") {
      reasoning = "Conservative fallback — storyboard authority";
    }

    const visualEmphasis: AvSceneDecision["visualEmphasis"] =
      importance.score >= 0.9 && energy >= 0.55 ? "strong"
        : importance.score >= 0.7 || energy >= 0.65 ? "subtle"
          : "none";

    scenes.push({
      sceneId: clip.sceneId,
      clipId: clip.id,
      startTime: startMs,
      endTime: endMs,
      duration: durationMs,
      sceneRole: role,
      productImportance: importance.category,
      productImportanceScore: importance.score,
      beatRelationship: beatRel,
      energyLevel: Number(energy.toFixed(4)),
      energyBand: band,
      motionIntensity,
      cameraIntensity,
      transitionType,
      transitionDuration: transitionType === "fade" ? 280 : 0,
      visualEmphasis,
      textSafety,
      confidence: textSafety || !needsText ? (confidence === "LOW" ? "MEDIUM" : confidence) : "MEDIUM",
      reasoning,
    });

    if (needsText) {
      textSafetyWindows.push({
        sceneId: clip.sceneId,
        kind: role === "CTA" ? "cta" : role === "END_CARD" ? "end_card" : role === "PRICE" ? "price" : role === "BENEFIT" ? "benefit" : role === "FEATURE" ? "feature" : "headline",
        minDurationMs: minText,
        preferredDurationMs: Math.round(minText * 1.25),
        maxDurationMs: Math.max(durationMs, Math.round(minText * 2.2)),
        safeStartMs: startMs,
        safeEndMs: endMs,
        lockedAgainstBeatCuts: true,
      });
    }

    motionDecisions.push({
      sceneId: clip.sceneId,
      intensity: motionIntensity,
      preferredMotionFamily:
        motionIntensity === "LOW" ? "subtle"
          : motionIntensity === "HIGH" ? "energetic"
            : reduceMotion ? "stable" : "controlled",
      reasoning: `Mapped ${band} energy → ${motionIntensity} motion via ${mode}`,
    });

    cameraDecisions.push({
      sceneId: clip.sceneId,
      intensity: cameraIntensity,
      preferredMode:
        cameraIntensity === "LOW" ? "slow_push"
          : cameraIntensity === "HIGH" ? "strong_push"
            : "controlled",
      reasoning: `Camera intensity ${cameraIntensity} for ${role}`,
    });

    if (i > 0) {
      const prev = scenes[i - 1]!;
      transitions.push({
        fromSceneId: prev.sceneId,
        toSceneId: clip.sceneId,
        type: prev.transitionType,
        durationMs: prev.transitionDuration,
        beatAligned: Boolean(useBeats && beatScene && beatScene.alignmentType !== "NONE"),
        reasoning: prev.transitionType === "fade"
          ? "Soft transition for readability / calm pacing"
          : "Clean cut for energy continuity",
      });
    }

    if (role === "HOOK" && hookEvents.length === 0) {
      const beatMs = firstStrongBeatMs(input.audioIntel);
      const preferred = beatMs != null && beatMs < Math.max(2500, durationMs) && !overrides.lockProductReveal
        ? Math.max(0, Math.min(beatMs, startMs + 400))
        : startMs;
      hookEvents.push({
        preferredStartMs: preferred,
        alignedBeatMs: beatMs,
        strategy: revealStrategy(policy.revealBias, input.productCategory, energy),
        reasoning: beatMs != null && useBeats
          ? "Hook aligned to early strong beat"
          : "Hook follows storyboard open",
      });
      emphasisEvents.push({
        eventId: `hook-${clip.sceneId}`,
        type: "HOOK",
        timeMs: preferred,
        sceneId: clip.sceneId,
        strength: 0.9,
        reasoning: "Opening hook emphasis",
      });
    }

    if (role === "PRODUCT_REVEAL" || (role === "HOOK" && importance.category === "HERO_PRODUCT")) {
      const strategy = overrides.lockProductReveal
        ? "immediate"
        : revealStrategy(policy.revealBias, input.productCategory, energy);
      const beatMs = beatScene?.alignedBeatTime != null
        ? Math.round(beatScene.alignedBeatTime * 1000)
        : firstStrongBeatMs(input.audioIntel);
      const timeMs = strategy === "beat" && beatMs != null && !overrides.lockProductReveal
        ? Math.max(startMs, Math.min(beatMs, endMs - 400))
        : startMs;
      productRevealEvents.push({
        sceneId: clip.sceneId,
        strategy,
        timeMs,
        beatAligned: strategy === "beat" && beatMs != null,
        reasoning: strategy === "beat"
          ? "Product reveal aligned to strong beat"
          : strategy === "cinematic"
            ? "Cinematic reveal for premium pacing"
            : "Immediate product reveal",
      });
      emphasisEvents.push({
        eventId: `reveal-${clip.sceneId}`,
        type: "PRODUCT_REVEAL",
        timeMs,
        sceneId: clip.sceneId,
        strength: importance.score,
        reasoning: "Product reveal emphasis",
      });
    }

    if (role === "CTA") {
      const minReadable = Math.round(2200 * policy.ctaHoldScale);
      CTAEvents.push({
        sceneId: clip.sceneId,
        startMs,
        endMs: Math.max(endMs, startMs + minReadable),
        minReadableMs: minReadable,
        reasoning: "CTA readability locked against beat cuts",
      });
      emphasisEvents.push({
        eventId: `cta-${clip.sceneId}`,
        type: "CTA",
        timeMs: startMs,
        sceneId: clip.sceneId,
        strength: 0.95,
        reasoning: "CTA hold for readability",
      });
    }
  }

  const totalDuration = scenes.length
    ? scenes[scenes.length - 1]!.endTime
    : input.clips.reduce((s, c) => s + c.durationMs, 0);

  let endCardTiming: EndCardTimingDecision | null = null;
  const endScene = scenes.find((s) => s.sceneRole === "END_CARD") ?? scenes[scenes.length - 1] ?? null;
  if (endScene) {
    const lastBeat = lastStrongBeatMs(input.audioIntel, totalDuration);
    const aligned = Boolean(useBeats && lastBeat != null && Math.abs(lastBeat - endScene.startTime) < 1200);
    endCardTiming = {
      sceneId: endScene.sceneId,
      startMs: endScene.startTime,
      endMs: endScene.endTime,
      minReadableMs: Math.round(2500 * policy.ctaHoldScale),
      alignedToAudioEnding: aligned,
      reasoning: aligned
        ? "End card aligned to audio ending"
        : "End card follows storyboard closing duration",
    };
    emphasisEvents.push({
      eventId: `end-${endScene.sceneId}`,
      type: "END_CARD",
      timeMs: endScene.startTime,
      sceneId: endScene.sceneId,
      strength: 0.85,
      reasoning: endCardTiming.reasoning,
    });
  }

  // Selective strong-beat accents (not every beat → cut)
  if (useBeats && input.audioIntel?.strongBeats?.length) {
    const strong = input.audioIntel.strongBeats.slice(0, 12);
    for (const beat of strong) {
      const t = Math.round(beat.time * 1000);
      const scene = scenes.find((s) => t >= s.startTime && t < s.endTime);
      if (!scene) continue;
      if (scene.textSafety && scene.sceneRole !== "PRODUCT_REVEAL" && scene.sceneRole !== "HOOK") continue;
      if (beat.strength < 0.55 * policy.beatSensitivity + 0.2) continue;
      emphasisEvents.push({
        eventId: `strong-${t}`,
        type: "STRONG_BEAT",
        timeMs: t,
        sceneId: scene.sceneId,
        strength: beat.strength,
        reasoning: "Visual accent on strong beat (no forced cut)",
      });
    }
  }

  const pacing = evaluatePacing(scenes, emphasisEvents, textSafetyWindows);
  const balance = evaluateBalance(scenes, CTAEvents, endCardTiming, pacing, confidence);

  const cacheKey = buildAvCreativePlanCacheKey({
    projectId: input.projectId,
    audioAssetId: input.audioIntel?.audioAssetId ?? input.beatPlan?.audioAssetId ?? null,
    contentHash: input.audioIntel?.contentHash ?? input.beatPlan?.contentHash ?? null,
    analysisVersion: input.audioIntel?.analysisVersion ?? null,
    beatSyncVersion: input.beatPlan?.beatSyncVersion ?? null,
    beatMode: input.beatPlan?.mode ?? null,
    storyboardVersion: input.storyboardVersion ?? null,
    creativeMode: mode,
    overrides,
    aspectRatio: input.aspectRatio,
    clipFingerprint: clipFingerprint(input.clips),
  });

  return {
    planId: randomUUID(),
    projectId: input.projectId,
    version: AV_CREATIVE_DIRECTOR_VERSION,
    audioAssetId: input.audioIntel?.audioAssetId ?? input.beatPlan?.audioAssetId ?? null,
    audioTimelineVersion: input.audioIntel?.analysisVersion ?? null,
    beatTimingPlanVersion: input.beatPlan?.beatSyncVersion ?? null,
    storyboardVersion: input.storyboardVersion ?? null,
    targetDuration: totalDuration,
    aspectRatio: input.aspectRatio,
    creativeMode: mode,
    confidence,
    status: directorStatus(confidence, fallbackReason),
    scenes,
    transitions,
    motionDecisions,
    cameraDecisions,
    emphasisEvents,
    textSafetyWindows,
    productRevealEvents,
    hookEvents,
    CTAEvents,
    endCardTiming,
    energyProfile,
    pacing,
    balance,
    overrides,
    fallbackReason,
    cacheKey,
    generatedAt: new Date().toISOString(),
    generationMs: Date.now() - started,
  };
}

function evaluatePacing(
  scenes: AvSceneDecision[],
  events: AvEmphasisEvent[],
  textWindows: AvTextSafetyWindow[],
): PacingQualityReport {
  const durationSec = Math.max(1, (scenes[scenes.length - 1]?.endTime ?? 1000) / 1000);
  const cutDensity = scenes.length / durationSec;
  const beatHits = events.filter((e) => e.type === "STRONG_BEAT" || e.type === "BEAT_HIT").length;
  const beatAlignment = Math.min(1, beatHits / Math.max(1, scenes.length));
  const energyAlignment = scenes.length
    ? scenes.filter((s) =>
      (s.energyBand === "energetic" || s.energyBand === "peak")
        ? s.motionIntensity !== "LOW"
        : s.motionIntensity !== "HIGH",
    ).length / scenes.length
    : 0;
  const readabilityScore = textWindows.length
    ? textWindows.filter((w) => {
      const scene = scenes.find((s) => s.sceneId === w.sceneId);
      return scene && scene.duration >= w.minDurationMs * 0.9;
    }).length / textWindows.length
    : 1;
  const productEmphasisScore = scenes.length
    ? scenes.filter((s) => s.productImportanceScore >= 0.7).length / scenes.length
    : 0;
  const fadeCount = scenes.filter((s) => s.transitionType === "fade").length;
  const cutCount = scenes.filter((s) => s.transitionType === "cut").length;
  const transitionVariety = scenes.length > 1
    ? Math.min(1, (fadeCount > 0 && cutCount > 0 ? 1 : 0.5) + (fadeCount + cutCount) / (scenes.length * 2))
    : 1;
  const overallScore = Number((
    (1 - Math.min(1, Math.abs(cutDensity - 0.45) / 0.8)) * 0.15
    + beatAlignment * 0.15
    + energyAlignment * 0.2
    + readabilityScore * 0.25
    + productEmphasisScore * 0.15
    + transitionVariety * 0.1
  ).toFixed(4));
  return {
    cutDensity: Number(cutDensity.toFixed(4)),
    beatAlignment: Number(beatAlignment.toFixed(4)),
    energyAlignment: Number(energyAlignment.toFixed(4)),
    readabilityScore: Number(readabilityScore.toFixed(4)),
    productEmphasisScore: Number(productEmphasisScore.toFixed(4)),
    transitionVariety: Number(transitionVariety.toFixed(4)),
    overallScore,
  };
}

function evaluateBalance(
  scenes: AvSceneDecision[],
  ctas: CtaTimingDecision[],
  endCard: EndCardTimingDecision | null,
  pacing: PacingQualityReport,
  confidence: AvConfidence,
): AvBalanceReport {
  const notes: string[] = [];
  const audioScore = confidence === "HIGH" ? 0.85 : confidence === "MEDIUM" ? 0.65 : 0.4;
  const visualScore = pacing.energyAlignment * 0.5 + pacing.productEmphasisScore * 0.5;
  const marketingScore = (ctas.length ? 0.5 : 0.2) + (endCard ? 0.5 : 0.2);
  const uxScore = pacing.readabilityScore;
  if (pacing.cutDensity > 0.9) notes.push("Cut density high — modes may feel aggressive");
  if (pacing.readabilityScore < 0.85) notes.push("Some text windows are tight");
  if (!ctas.length) notes.push("No dedicated CTA scene detected");
  if (!endCard) notes.push("No end card timing decision");
  const overallScore = Number(((audioScore + visualScore + marketingScore + uxScore) / 4).toFixed(4));
  return {
    audioScore: Number(audioScore.toFixed(4)),
    visualScore: Number(visualScore.toFixed(4)),
    marketingScore: Number(marketingScore.toFixed(4)),
    uxScore: Number(uxScore.toFixed(4)),
    overallScore,
    notes,
  };
}
