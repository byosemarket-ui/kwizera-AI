/**
 * Phase 18C — reusable creative patterns derived from measured video observations. Each pattern carries its family,
 * machine-usable parameters, compatible contexts, variation options, the scenes it came from, confidence and the
 * measurements behind it. Families that need readable text or speech (benefit, offer) are reported unavailable
 * instead of being inferred.
 */
import type { CreativePattern } from "../creative-planning/learned-creative-patterns.js";
import type { ImageDeepAnalysis } from "./teaching-deep-media.js";
import type { AudioMeasurement } from "./training-types.js";
import type { VideoLearningObservation } from "./video-observations.js";

const r2 = (n: number) => Number(n.toFixed(2));
const pct = (n: number) => `${Math.round(n * 100)}%`;
const lower = (s: string) => s.toLowerCase().replace(/_/g, " ");

export function aspectContext(aspect: string | undefined): string[] {
  const out = ["product-video"];
  if (aspect && aspect !== "unknown") out.push(aspect);
  if (aspect === "9:16" || aspect === "4:5") out.push("vertical");
  if (aspect === "16:9") out.push("horizontal");
  return out;
}

export function extractCreativePatterns(obs: VideoLearningObservation[], meta: { durationSec: number; aspectRatio?: string; bpm?: number | null }): { patterns: CreativePattern[]; unavailable: string[] } {
  const patterns: CreativePattern[] = [];
  const unavailable: string[] = [];
  if (!obs.length) return { patterns, unavailable: ["Creative patterns — no scene observations were measured."] };
  const ctx = aspectContext(meta.aspectRatio);
  const shortForm = meta.durationSec <= 30 ? "short-form" : "long-form";
  ctx.push(shortForm);
  const ev = (o: VideoLearningObservation, text: string) => `Scene ${o.sceneIndex} (${o.timestamps.startSec.toFixed(1)}–${o.timestamps.endSec.toFixed(1)} s): ${text}`;
  const roleOf = (role: string) => obs.filter((o) => o.storytelling.role === role);

  // Pacing
  const durs = obs.map((o) => o.timestamps.durationSec);
  const mean = durs.reduce((a, b) => a + b, 0) / durs.length;
  patterns.push({
    family: "PACING", name: `${obs.length} scenes, mean ${mean.toFixed(1)} s`,
    description: `${obs.length} scenes over ${meta.durationSec.toFixed(1)} s; opening ${durs[0]!.toFixed(1)} s, closing ${durs[durs.length - 1]!.toFixed(1)} s.`,
    parameters: { sceneCount: obs.length, meanShotSec: r2(mean), hookSec: r2(durs[0]!), ctaSec: r2(durs[durs.length - 1]!), durationSec: r2(meta.durationSec) },
    compatibleContexts: ctx, variationOptions: ["tighter pacing (−20% per scene)", "longer closing scene", "equal scene lengths"],
    scenes: obs.map((o) => o.sceneIndex), confidence: 0.85, evidence: obs.slice(0, 6).map((o) => ev(o, `${o.timestamps.durationSec.toFixed(2)} s`)),
  });

  // Transitions (per measured kind, with position in the story)
  const withT = obs.filter((o) => o.transition && o.transition.type !== "START");
  const kinds = new Map<string, VideoLearningObservation[]>();
  for (const o of withT) kinds.set(o.transition!.type, [...(kinds.get(o.transition!.type) ?? []), o]);
  for (const [kind, list] of kinds) {
    const intoReveal = list.some((o) => o.storytelling.role === "REVEAL");
    const intoCta = list.some((o) => o.storytelling.role === "CTA");
    const position = list.length === withT.length ? "BETWEEN_SCENES" : intoReveal ? "INTO_REVEAL" : intoCta ? "INTO_CTA" : "BETWEEN_SCENES";
    const durations = list.map((o) => o.transition!.durationSec);
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    patterns.push({
      family: "TRANSITION", name: `${lower(kind)} ${position === "BETWEEN_SCENES" ? "between scenes" : position === "INTO_REVEAL" ? "into the reveal" : "into the call to action"}${kind !== "CUT" ? ` (${avg.toFixed(2)} s)` : ""}`,
      description: `${list.length} of ${withT.length} boundaries are ${lower(kind)}${kind !== "CUT" ? `, lasting ${avg.toFixed(2)} s on average` : ""}.`,
      parameters: { transition: kind, durationSec: r2(avg), position, share: r2(list.length / Math.max(1, withT.length)) },
      compatibleContexts: ctx, variationOptions: kind === "CUT" ? ["dissolve on the reveal", "fade through black before the CTA"] : ["hard cut", "shorter dissolve", "fade through black"],
      scenes: list.map((o) => o.sceneIndex), confidence: r2(Math.min(0.9, list.reduce((a, o) => a + o.transition!.confidence, 0) / list.length)),
      evidence: list.slice(0, 6).map((o) => ev(o, o.transition!.evidence)),
    });
  }

  // Camera
  const cams = new Map<string, VideoLearningObservation[]>();
  for (const o of obs) if (o.camera.movement !== "UNCLASSIFIED") cams.set(o.camera.movement, [...(cams.get(o.camera.movement) ?? []), o]);
  for (const [movement, list] of cams) {
    const roles = [...new Set(list.map((o) => o.storytelling.role))];
    const role = roles.length === 1 ? roles[0]! : "SHOWCASE";
    patterns.push({
      family: "CAMERA", name: `${lower(movement)} on ${roles.map((x) => x.toLowerCase()).join("/")} scene${list.length > 1 ? "s" : ""}`,
      description: `${list.length} scene(s) use ${lower(movement)} camera movement (${roles.map((x) => x.toLowerCase()).join(", ")}).`,
      parameters: { movement, role, zoomPerSec: r2(list.reduce((a, o) => a + o.camera.zoomPerSec, 0) / list.length), panPerSec: r2(list.reduce((a, o) => a + o.camera.panPerSec, 0) / list.length) },
      compatibleContexts: ctx, variationOptions: movement === "PUSH_IN" ? ["slow push-in", "static hold", "pull-out reveal"] : movement === "STATIC" ? ["subtle push-in", "static hold"] : ["static hold", "push-in"],
      scenes: list.map((o) => o.sceneIndex), confidence: r2(list.reduce((a, o) => a + o.camera.confidence, 0) / list.length),
      evidence: list.slice(0, 6).map((o) => ev(o, o.camera.evidence)),
    });
  }

  // Hook
  const hook = obs[0]!;
  patterns.push({
    family: "HOOK", name: `${hook.timestamps.durationSec.toFixed(1)} s ${lower(hook.camera.movement)} opening${hook.product.detected ? " with the subject visible" : ""}`,
    description: `The opening scene lasts ${hook.timestamps.durationSec.toFixed(1)} s with ${lower(hook.camera.movement)} camera${hook.product.detected ? `, subject at ${hook.product.location} (${Math.round((hook.product.scale ?? 0) * 100)}% of frame)` : ""}${hook.text.presence === "DETECTED" ? ", with a text-like region" : ""}.`,
    parameters: { hookSec: r2(hook.timestamps.durationSec), movement: hook.camera.movement, role: "HOOK", subjectVisible: hook.product.detected, textPresent: hook.text.presence === "DETECTED" },
    compatibleContexts: ctx, variationOptions: ["open on a close detail", "open on the full product", "open with motion"],
    scenes: [hook.sceneIndex], confidence: r2(Math.min(0.8, hook.storytelling.confidence)), evidence: [ev(hook, hook.storytelling.note), ev(hook, hook.camera.evidence)],
  });

  // Reveal
  const reveal = roleOf("REVEAL")[0];
  if (reveal) {
    patterns.push({
      family: "REVEAL", name: `Reveal at ${reveal.timestamps.startSec.toFixed(1)} s via ${reveal.transition ? lower(reveal.transition.type) : "cut"}${reveal.camera.movement === "PUSH_IN" ? " and push-in" : ""}`,
      description: `The product is revealed in scene ${reveal.sceneIndex} (${reveal.storytelling.note.replace(/\.$/, "")})${reveal.transition ? ` after a ${lower(reveal.transition.type)}` : ""}.`,
      parameters: { atSec: r2(reveal.timestamps.startSec), sceneIndex: reveal.sceneIndex, transition: reveal.transition?.type ?? null, movement: reveal.camera.movement, role: "REVEAL", subjectScale: reveal.product.scale },
      compatibleContexts: ctx, variationOptions: ["reveal with a dissolve", "reveal with a hard cut on the beat", "reveal with a push-in"],
      scenes: [reveal.sceneIndex], confidence: r2(reveal.storytelling.confidence), evidence: [ev(reveal, reveal.storytelling.note), ...reveal.evidence.slice(0, 2).map((e) => ev(reveal, e))],
    });
  }

  // Showcase
  const showcase = roleOf("SHOWCASE");
  if (showcase.length) {
    patterns.push({
      family: "SHOWCASE", name: `${showcase.length} showcase scene(s) with moving camera`,
      description: `Showcase scenes keep the subject on screen with ${[...new Set(showcase.map((o) => lower(o.camera.movement)))].join(", ")} camera.`,
      parameters: { scenes: showcase.length, movement: showcase[0]!.camera.movement, role: "SHOWCASE" },
      compatibleContexts: ctx, variationOptions: ["alternate detail and full shots", "slow push-ins", "static holds"],
      scenes: showcase.map((o) => o.sceneIndex), confidence: 0.55, evidence: showcase.slice(0, 4).map((o) => ev(o, o.storytelling.note)),
    });
  }

  // CTA
  const cta = roleOf("CTA")[0];
  if (cta) {
    patterns.push({
      family: "CTA", name: `Closing scene ${cta.timestamps.durationSec.toFixed(1)} s${cta.text.presence === "DETECTED" ? " with a text-like region" : ""}`,
      description: `The closing scene lasts ${cta.timestamps.durationSec.toFixed(1)} s (${Math.round((cta.timestamps.durationSec / Math.max(0.1, meta.durationSec)) * 100)}% of the video)${cta.text.presence === "DETECTED" ? `; a text-like region sits at ${cta.text.regions.map((r) => r.label).join(", ")}` : ""}. ${cta.storytelling.note}`,
      parameters: { ctaSec: r2(cta.timestamps.durationSec), share: r2(cta.timestamps.durationSec / Math.max(0.1, meta.durationSec)), basis: cta.storytelling.basis, textBand: cta.text.regions[0]?.label ?? null, role: "CTA" },
      compatibleContexts: ctx, variationOptions: ["longer closing hold", "fade through black before the CTA", "CTA over the product"],
      scenes: [cta.sceneIndex], confidence: r2(cta.storytelling.confidence), evidence: [ev(cta, cta.storytelling.note)],
    });
  }

  // Typography timing (presence/location only unless vision read it)
  const texted = obs.filter((o) => o.text.presence === "DETECTED");
  if (texted.length) {
    const offsets = texted.map((o) => Math.max(0, (o.text.seenAtSec[0] ?? o.timestamps.startSec) - o.timestamps.startSec));
    patterns.push({
      family: "TYPOGRAPHY_TIMING", name: `Text-like overlay in ${texted.length} of ${obs.length} scene(s)`,
      description: `Text-like regions appear in scene(s) ${texted.map((o) => o.sceneIndex).join(", ")} at ${[...new Set(texted.flatMap((o) => o.text.regions.map((r) => r.label)))].join(", ")}, first seen about ${(offsets.reduce((a, b) => a + b, 0) / offsets.length).toFixed(1)} s into the scene. Text content, fonts and exact typography are not read.`,
      parameters: { scenesWithText: texted.length, firstSeenOffsetSec: r2(offsets.reduce((a, b) => a + b, 0) / offsets.length), band: texted[0]!.text.regions[0]?.label ?? null },
      compatibleContexts: ctx, variationOptions: ["text only on hook and CTA", "text on every scene", "no text on the reveal"],
      scenes: texted.map((o) => o.sceneIndex), confidence: 0.5, evidence: texted.slice(0, 6).map((o) => ev(o, o.text.method)),
    });
  }

  // Audio sync
  const synced = obs.filter((o) => o.synchronization && o.synchronization.onBeat !== null);
  if (synced.length) {
    const on = synced.filter((o) => o.synchronization!.onBeat).length;
    const down = synced.filter((o) => o.synchronization!.onDownbeat).length;
    const riseAtReveal = reveal?.synchronization?.energyChange === "RISE";
    patterns.push({
      family: "AUDIO_SYNC", name: on / synced.length >= 0.6 ? `Cuts on the beat (${on}/${synced.length})` : `Cuts independent of the beat (${on}/${synced.length})`,
      description: `${on} of ${synced.length} boundaries land on a beat${meta.bpm ? ` at ${Math.round(meta.bpm)} BPM` : ""}, ${down} on a downbeat${riseAtReveal ? "; music energy rises at the reveal" : ""}.`,
      parameters: {
        onBeatRatio: r2(on / synced.length), onDownbeat: down, downbeatRatio: r2(down / synced.length), bpm: meta.bpm ?? null, energyRiseAtReveal: Boolean(riseAtReveal),
        alignTo: down / synced.length >= 0.5 ? "DOWNBEAT" : on / synced.length >= 0.6 ? "BEAT" : "FREE",
      },
      compatibleContexts: [...ctx, "music"], variationOptions: ["cut on every beat", "cut on downbeats only", "hold across the drop"],
      scenes: synced.map((o) => o.sceneIndex), confidence: 0.75, evidence: synced.slice(0, 6).map((o) => ev(o, o.synchronization!.evidence)),
    });
  }

  // Storytelling structure
  const closeUpAt = obs.findIndex((o, i) => o.storytelling.role === "CLOSE_UP" && obs[i - 1]?.storytelling.role === "REVEAL");
  const closeUpParams: Record<string, string> = closeUpAt > 0 ? { after: "PRODUCT_REVEAL", next: "CLOSE_UP", nextDuration: obs[closeUpAt]!.timestamps.durationSec < mean ? "SHORT" : "DEFAULT" } : {};
  patterns.push({
    family: "STORYTELLING", name: obs.map((o) => o.storytelling.role).join(" → "),
    description: `Scene roles in order: ${obs.map((o) => `${o.storytelling.role.toLowerCase()} (${o.storytelling.basis.toLowerCase()})`).join(", ")}.`,
    parameters: { sequence: obs.map((o) => o.storytelling.role).join(">"), measuredRoles: obs.filter((o) => o.storytelling.basis !== "POSITION").length, ...closeUpParams },
    compatibleContexts: ctx, variationOptions: ["hook → reveal → showcase → CTA", "reveal first", "problem → product → CTA"],
    scenes: obs.map((o) => o.sceneIndex), confidence: r2(obs.reduce((a, o) => a + o.storytelling.confidence, 0) / obs.length),
    evidence: obs.slice(0, 6).map((o) => ev(o, o.storytelling.note)),
  });

  unavailable.push("Benefit and offer patterns — need readable on-screen text or speech; not inferred.");
  return { patterns, unavailable };
}

// ---------- Phase 18D: audio ----------

/** Loudness band of the master (absolute), since Audio Intelligence energy is relative to the track's own peak. */
export function loudnessLevel(rmsDbfs: number | null): "HIGH" | "MEDIUM" | "LOW" | null {
  if (rmsDbfs === null || !Number.isFinite(rmsDbfs)) return null;
  return rmsDbfs >= -11 ? "HIGH" : rmsDbfs >= -18 ? "MEDIUM" : "LOW";
}

export function extractAudioPatterns(a: AudioMeasurement, meta: { subject: string; context?: string[] }): { patterns: CreativePattern[]; unavailable: string[] } {
  const patterns: CreativePattern[] = [];
  const unavailable: string[] = [];
  const ctx = [...(meta.context ?? []), "music"];
  if (a.silent) return { patterns, unavailable: ["Music patterns — the audio is silent."] };
  const at = (s: number, e?: number) => `${meta.subject} ${s.toFixed(1)}${e !== undefined ? `–${e.toFixed(1)}` : ""} s`;
  const level = loudnessLevel(a.rmsDbfs);
  const timeline = a.energyTimeline ?? [];
  const dynamics = timeline.length ? r2(timeline.reduce((x, w) => x + w.energy, 0) / timeline.length) : null;
  if (a.bpm && a.tempoStatus === "available") {
    const period = 60 / a.bpm;
    const beatsPerBar = a.downbeatCount > 1 && a.beatCount > a.downbeatCount ? Math.round(a.beatCount / a.downbeatCount) : null;
    patterns.push({
      family: "MUSIC_TEMPO", name: `${Math.round(a.bpm)} BPM${level ? `, ${level.toLowerCase()} loudness` : ""}`,
      description: `Music at ${Math.round(a.bpm)} BPM (beat every ${period.toFixed(2)} s${beatsPerBar ? `, about ${beatsPerBar} beats per bar` : ""}) with ${a.beatCount} beats and ${a.downbeatCount} downbeats over ${a.durationSec.toFixed(1)} s${level ? `; mastered at ${a.rmsDbfs!.toFixed(1)} dBFS RMS (${level.toLowerCase()} loudness)` : ""}.`,
      parameters: { bpm: r2(a.bpm), tempoConfidence: r2(a.tempoConfidence), beatPeriodSec: r2(period), beatsPerBar, energyLevel: level, dynamics, durationSec: r2(a.durationSec) },
      compatibleContexts: ctx, variationOptions: ["half-time feel", "same tempo, lower energy", "±6% tempo"],
      scenes: [], confidence: r2(Math.min(0.9, 0.5 + a.tempoConfidence * 0.4)),
      evidence: [`${meta.subject}: first beats at ${a.firstBeats.slice(0, 6).map((t) => t.toFixed(2)).join(", ")} s`, ...(a.downbeatTimes?.length ? [`${meta.subject}: downbeats at ${a.downbeatTimes.slice(0, 6).map((t) => t.toFixed(2)).join(", ")} s`] : []), ...(level ? [`Loudness level from RMS ${a.rmsDbfs!.toFixed(1)} dBFS`] : [])],
    });
  } else unavailable.push(`Tempo pattern — ${a.bpm ? "tempo confidence was too low" : "no reliable tempo was measured"}; BPM is not guessed.`);
  if (a.sections.length > 1) {
    const intro = a.sections.find((s) => /intro/i.test(s.label));
    const rises = (a.energyTransitions ?? []).filter((t) => t.type === "ENERGY_RISE" || t.type === "ENERGY_PEAK");
    const peak = timeline.length ? timeline.reduce((m, w) => (w.energy > m.energy ? w : m), timeline[0]!) : null;
    patterns.push({
      family: "MUSIC_STRUCTURE", name: a.sections.slice(0, 6).map((s) => s.label.toLowerCase()).join(" → "),
      description: `Structure ${a.sections.slice(0, 8).map((s) => `${s.label.toLowerCase()} ${s.start.toFixed(0)}–${s.end.toFixed(0)} s`).join(", ")}${intro ? `; intro lasts ${(intro.end - intro.start).toFixed(1)} s` : ""}${peak ? `; energy peaks around ${peak.start.toFixed(1)} s` : ""}${rises.length ? `; energy rises at ${rises.slice(0, 4).map((t) => `${t.time.toFixed(1)} s`).join(", ")}` : ""}.`,
      parameters: { sequence: a.sections.slice(0, 8).map((s) => s.label.toUpperCase()).join(">"), sections: a.sections.length, introSec: intro ? r2(intro.end - intro.start) : null, peakAtSec: peak ? r2(peak.start) : null, firstRiseSec: rises[0] ? r2(rises[0].time) : null, durationSec: r2(a.durationSec) },
      compatibleContexts: ctx, variationOptions: ["shorter intro", "reveal on the first energy rise", "end on the outro"],
      scenes: [], confidence: 0.65,
      evidence: a.sections.slice(0, 6).map((s) => `${at(s.start, s.end)}: ${s.label.toLowerCase()}`),
    });
  }
  unavailable.push("Speech, transcript and sound-effect patterns — no speech-to-text or sound-event runtime is configured.");
  return { patterns, unavailable };
}

// ---------- Phase 18D: image / design ----------

const sideOf = (x: number) => (x < 0.42 ? "left" : x > 0.58 ? "right" : "center");

export function extractImagePatterns(deep: ImageDeepAnalysis, meta: { context?: string[] } = {}): { patterns: CreativePattern[]; unavailable: string[] } {
  const patterns: CreativePattern[] = [];
  const unavailable: string[] = [];
  const aspect = deep.height > deep.width * 1.2 ? "vertical" : deep.width > deep.height * 1.2 ? "horizontal" : "square";
  const ctx = [...(meta.context ?? []), "design", aspect];
  const s = deep.subject;
  const dims = `${deep.width}×${deep.height}`;
  if (s.separable) {
    const placement = sideOf(s.centerX);
    const free = { left: s.margins.left, right: s.margins.right, top: s.margins.top, bottom: s.margins.bottom };
    const horizontal = free.left >= free.right ? "left" : "right";
    const vertical = free.top >= free.bottom ? "top" : "bottom";
    const textSafeSide = Math.max(free.left, free.right) >= 0.25 ? horizontal : Math.max(free.top, free.bottom) >= 0.2 ? vertical : null;
    patterns.push({
      family: "LAYOUT", name: `Product ${placement === "center" ? "centred" : `on the ${placement}`}${textSafeSide ? `, text-safe space on the ${textSafeSide}` : ""}`,
      description: `The product ${placement === "center" ? "is centred" : `sits on the ${placement}`} (${pct(s.coverage)} of the canvas) with ${textSafeSide ? `${pct(free[textSafeSide])} free on the ${textSafeSide}` : "little free space around it"}; ${pct(deep.whitespaceShare)} of the canvas is plain background.`,
      parameters: { subjectPlacement: placement, textSafeSide, subjectCoverage: r2(s.coverage), negativeSpace: r2(deep.whitespaceShare), marginLeft: r2(free.left), marginRight: r2(free.right), marginTop: r2(free.top), marginBottom: r2(free.bottom), touchesEdge: s.touchesEdge },
      compatibleContexts: ctx, variationOptions: ["mirror the layout", "centre the product", "more negative space"],
      scenes: [], confidence: 0.72,
      evidence: [`Subject box ${JSON.stringify(s.box)} on ${dims}`, `Background share ${pct(deep.whitespaceShare)}`],
    });
  }
  const bands = deep.textRegions ?? [];
  if (bands.length) {
    const top = bands.filter((b) => b.y1 <= 0.4);
    const bottom = bands.filter((b) => b.y0 >= 0.6);
    const cx = bands.reduce((a, b) => a + (b.x0 + b.x1) / 2, 0) / bands.length;
    const headline = [...bands].sort((a, b) => (b.y1 - b.y0) - (a.y1 - a.y0))[0]!;
    const headlinePosition = (headline.y0 + headline.y1) / 2 < 0.34 ? "top" : (headline.y0 + headline.y1) / 2 > 0.66 ? "bottom" : "middle";
    const textSide = sideOf(cx);
    const heights = bands.map((b) => b.y1 - b.y0);
    const hierarchy = heights.length > 1 ? r2(Math.max(...heights) / Math.max(0.001, Math.min(...heights))) : null;
    const vision = deep.vision?.textItems.length ? deep.vision : null;
    const ctaPos = vision?.textItems.find((i) => i.role === "cta")?.position;
    const ctaBand = ctaPos ? (/top|upper/.test(ctaPos) ? "top" : /bottom|lower/.test(ctaPos) ? "bottom" : null) : bottom.length && bands.length > 1 ? "bottom" : null;
    patterns.push({
      family: "TYPOGRAPHY_LAYOUT", name: `${bands.length} text band(s): largest at the ${headlinePosition}${textSide !== "center" ? `, text on the ${textSide}` : ""}${ctaBand ? `, closing line at the ${ctaBand}` : ""}`,
      description: `${bands.length} text-like band(s) ${top.length ? `${top.length} in the top third` : ""}${top.length && bottom.length ? ", " : ""}${bottom.length ? `${bottom.length} in the bottom third` : ""}; the largest band (headline candidate) sits at the ${headlinePosition}${hierarchy ? ` and is ${hierarchy}× the height of the smallest (size hierarchy)` : ""}. ${vision ? `Vision roles: ${vision.textItems.map((i) => `${i.role} ${i.relativeSize} at ${i.position}`).join(", ")}.` : "Text is located, not read; fonts are never identified."}`,
      parameters: { textBands: bands.length, headlinePosition, textSide, ctaBand, sizeHierarchy: hierarchy, topBands: top.length, bottomBands: bottom.length, readByVision: Boolean(vision) },
      compatibleContexts: ctx, variationOptions: ["headline at the top, CTA at the bottom", "single headline only", "text beside the product"],
      scenes: [], confidence: vision ? 0.66 : 0.5,
      evidence: bands.slice(0, 5).map((b) => `${b.label} at y ${b.y0.toFixed(2)}–${b.y1.toFixed(2)}, x ${b.x0.toFixed(2)}–${b.x1.toFixed(2)}`),
    });
  } else unavailable.push("Typography layout — no text-like regions were found in the image.");
  if (!deep.vision) unavailable.push("Typography hierarchy by role (headline/CTA reading) — Admin VISION_ANALYSIS is not executable; font names are never guessed.");
  if (deep.subjectBackgroundContrast) {
    const ratio = deep.subjectBackgroundContrast;
    const contrastClass = ratio >= 7 ? "HIGH" : ratio >= 4.5 ? "MEDIUM" : "LOW";
    patterns.push({
      family: "COLOR_CONTRAST", name: `${contrastClass.toLowerCase()} foreground/background contrast (${ratio}:1)`,
      description: `Foreground/background luminance contrast ${ratio}:1 (${contrastClass.toLowerCase()}); dominant colours ${deep.dominantColors.slice(0, 4).map((c) => `${c.hex} ${pct(c.share)}`).join(", ")}.`,
      parameters: { contrastRatio: ratio, contrastClass, dominant: deep.dominantColors.slice(0, 3).map((c) => c.hex).join(","), dynamicRange: r2(deep.dynamicRange) },
      compatibleContexts: ctx, variationOptions: ["same palette, lighter background", "higher contrast", "brand colour accent"],
      scenes: [], confidence: 0.7,
      evidence: [`WCAG-style luminance ratio between background and foreground pixels on ${dims}`],
    });
  }
  return { patterns, unavailable };
}

// ---------- Phase 19: creative rules stated in text ----------

const ROLE_WORDS: Array<[string, RegExp]> = [
  ["CLOSE_UP", /(?:\b|_)(close[-_ ]?ups?|detail shots?|macro shots?)\b/i],
  ["PRODUCT_REVEAL", /\b(product[_ ]reveal|reveal(?:ing)?(?: of the product)?)\b/i],
  ["HOOK", /\b(hook|opening (?:shot|scene)|intro)\b/i],
  ["OFFER", /\b(offer|price|discount|deal)\b/i],
  ["CTA", /\b(cta|call[- ]to[- ]action)\b/i],
  ["SHOWCASE", /\b(showcase|feature shots?|benefit shots?)\b/i],
];

function rolesIn(text: string): Array<{ role: string; at: number }> {
  const out: Array<{ role: string; at: number }> = [];
  for (const [role, re] of ROLE_WORDS) {
    const m = re.exec(text);
    if (m && !out.some((o) => Math.abs(o.at - m.index) < 3)) out.push({ role, at: m.index });
  }
  return out.sort((a, b) => a.at - b.at);
}

/**
 * Structured creative rules stated explicitly in teaching text: scene order ("the reveal should be followed by a
 * short close-up", "HOOK > PRODUCT_REVEAL > CLOSE_UP > CTA"), energy-driven pacing and product/text layout. Only
 * a fixed vocabulary is recognised and mapped to enums; the text itself is never used as an instruction.
 */
export function creativeRulesFromSentence(sentence: string, meta: { sourceTitle: string; location: string }): CreativePattern[] {
  const s = sentence.replace(/\s+/g, " ").trim().slice(0, 400);
  const out: CreativePattern[] = [];
  const evidence = [`Stated in ${meta.sourceTitle} (${meta.location}): "${s.slice(0, 200)}"`];
  const scope = /^\s*(?:for|in|on|with)\s+([^,]{3,60}),/i.exec(s)?.[1]?.trim().toLowerCase() ?? null;
  const when = scope ? ` (for ${scope})` : "";
  const base = { compatibleContexts: ["product-video", ...(scope ? scope.split(/\s+/).filter((w) => w.length > 3).slice(0, 3) : [])], scenes: [] as number[], confidence: 0.8, evidence };
  const parts = s.split(/\s*(?:>|→|->|\bthen\b)\s*/i).filter(Boolean);
  const seq = parts.length >= 3 ? parts.map((p) => rolesIn(p)).filter((r) => r.length === 1).map((r) => r[0]!.role) : [];
  if (seq.length >= 3 && seq.length === parts.length) {
    out.push({
      ...base, family: "STORYTELLING", name: seq.join(" → "),
      description: `Stated scene order: ${seq.map((r) => r.toLowerCase().replace(/_/g, " ")).join(", ")}${when}.`,
      parameters: { rule: "SEQUENCE", sequence: seq.join(">") },
      variationOptions: ["keep the order, vary shot lengths", "drop the offer when no price is verified"],
    });
  } else {
    const follow = /^(.*?)\b(?:is |are |should be |must be |needs to be |to be )?(?:immediately |directly |always )?followed by\b(.*)$/i.exec(s)
      ?? /^\s*after (?:the |a |an )?(.*?),?\s+(?:show|use|cut to|add|place|go to|have|comes?|put)\b(.*)$/i.exec(s);
    if (follow) {
      const before = rolesIn(follow[1]!);
      const afterRoles = rolesIn(follow[2]!);
      const after = before[before.length - 1]?.role;
      const next = afterRoles[0]?.role;
      if (after && next && after !== next) {
        const short = /\b(short|brief|quick)\b/i.test(follow[2]!.slice(0, Math.max(0, afterRoles[0]!.at) + 1));
        out.push({
          ...base, family: "STORYTELLING", name: `${after} → ${next}${short ? " (short)" : ""}`,
          description: `The ${after.toLowerCase().replace(/_/g, " ")} is followed by a ${short ? "short " : ""}${next.toLowerCase().replace(/_/g, " ")}${when}.`,
          parameters: { rule: "FOLLOWED_BY", after, next, nextDuration: short ? "SHORT" : "DEFAULT", sequence: `${after}>${next}` },
          variationOptions: ["longer close-up", "close-up with a slow push-in", "cut on the beat into the close-up"],
        });
      }
    }
  }
  const energy = /\b(higher|more|high|louder|stronger|lower|less|low|calmer|softer)\s+(?:music(?:al)?\s+|audio\s+|track\s+)?(energy|intensity|tempo)\b(.*)$/i.exec(s);
  if (energy) {
    const rest = energy[3]!;
    const fast = /\b(faster|quicker|shorter|tighter|more frequent)\s+(pacing|cuts?|scenes?|editing|shots?)\b/i.test(rest);
    const slow = /\b(slower|longer|calmer|fewer)\s+(pacing|cuts?|scenes?|editing|shots?)\b/i.test(rest);
    if (fast !== slow) {
      const high = /higher|more|high|louder|stronger/i.test(energy[1]!);
      const direction = high === fast ? "FASTER_WHEN_HIGH" : "SLOWER_WHEN_HIGH";
      out.push({
        ...base, family: "PACING", name: direction === "FASTER_WHEN_HIGH" ? "Higher music energy → faster pacing" : "Higher music energy → slower pacing",
        description: `${direction === "FASTER_WHEN_HIGH" ? "Scenes get shorter when the music energy is high" : "Scenes get longer when the music energy is high"}${when}.`,
        parameters: { rule: "ENERGY_PACING", direction, bodyScale: direction === "FASTER_WHEN_HIGH" ? 0.8 : 1.15 },
        compatibleContexts: ["product-video", "music"], variationOptions: ["apply only to the middle scenes", "apply after the reveal"],
      });
    }
  }
  const centred = /\b(cent(?:er|re)d?|middle)\b[^.]{0,40}\bproduct\b|\bproduct\b[^.]{0,40}\b(cent(?:er|re)d?|middle)\b/i.test(s);
  const textSide = /\b(?:text|copy|headline|typography)\b[^.]{0,60}?\b(right|left|top|bottom)\b/i.exec(s)?.[1]?.toLowerCase();
  if (centred && textSide) {
    out.push({
      ...base, family: "LAYOUT", name: `Product centred, text-safe space on the ${textSide}`,
      description: `The product stays centred and text goes on the ${textSide} side.`,
      parameters: { rule: "STATED", subjectPlacement: "center", textSafeSide: textSide },
      compatibleContexts: ["product-video", "design"], variationOptions: ["mirror the layout", "more negative space"],
    });
  }
  return out;
}

// ---------- Phase 18D: cross-modal ----------

export interface ModalPattern { modality: "VIDEO" | "AUDIO" | "IMAGE"; pattern: CreativePattern; sourceTitle: string }

/**
 * Combines patterns taught by different modalities into one production profile (visual + typography + motion +
 * audio + synchronisation). Each component keeps its own record; the profile references them by name.
 */
export function buildCreativeProfile(items: ModalPattern[], crossSync: { onBeatRatio: number; downbeatRatio: number; bpm: number } | null): CreativePattern | null {
  const modalities = new Set(items.map((i) => i.modality));
  if (crossSync) { modalities.add("VIDEO"); modalities.add("AUDIO"); }
  if (modalities.size < 2) return null;
  const pick = (family: string, modality?: ModalPattern["modality"]) => items.filter((i) => i.pattern.family === family && (!modality || i.modality === modality)).sort((a, b) => b.pattern.confidence - a.pattern.confidence)[0];
  const visual = pick("LAYOUT");
  const typography = pick("TYPOGRAPHY_LAYOUT") ?? pick("TYPOGRAPHY_TIMING");
  const motion = pick("CAMERA", "VIDEO");
  const transition = pick("TRANSITION", "VIDEO");
  const tempo = pick("MUSIC_TEMPO");
  const sync = pick("AUDIO_SYNC");
  const parts: Array<[string, ModalPattern | undefined]> = [["Visual", visual], ["Typography", typography], ["Motion", motion], ["Transition", transition], ["Audio", tempo], ["Synchronisation", sync]];
  const present = parts.filter(([, p]) => p);
  if (present.length < 2 && !crossSync) return null;
  const syncText = crossSync ? `${Math.round(crossSync.onBeatRatio * 100)}% of cuts on the beat (${Math.round(crossSync.downbeatRatio * 100)}% on downbeats) at ${Math.round(crossSync.bpm)} BPM` : null;
  const signature = present.map(([k, p]) => `${k}:${p!.pattern.name}`).join(";");
  return {
    family: "CREATIVE_PROFILE", name: present.map(([k, p]) => `${k.toLowerCase()} ${p!.pattern.name}`).slice(0, 3).join(" · ").slice(0, 120),
    description: `Production profile combining ${[...modalities].map((m) => m.toLowerCase()).join(", ")} teaching: ${present.map(([k, p]) => `${k}: ${p!.pattern.name} (${p!.sourceTitle})`).join("; ")}${syncText ? `; Sync: ${syncText}` : ""}.`,
    parameters: {
      signature: signature.slice(0, 80), visual: visual?.pattern.name ?? null, typography: typography?.pattern.name ?? null, motion: motion?.pattern.name ?? null,
      transition: transition?.pattern.name ?? null, audio: tempo?.pattern.name ?? null, sync: syncText, modalities: [...modalities].sort().join("+"),
    },
    compatibleContexts: [...new Set(items.flatMap((i) => i.pattern.compatibleContexts))].slice(0, 10),
    variationOptions: ["use components independently", "swap the motion component", "swap the audio component"],
    scenes: [], confidence: r2(Math.min(0.85, present.reduce((a, [, p]) => a + p!.pattern.confidence, 0) / Math.max(1, present.length))),
    evidence: present.map(([k, p]) => `${k} from ${p!.sourceTitle}: ${p!.pattern.evidence[0] ?? p!.pattern.description.slice(0, 120)}`).slice(0, 6),
  };
}
