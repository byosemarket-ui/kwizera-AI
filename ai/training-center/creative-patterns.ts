/**
 * Phase 18C — reusable creative patterns derived from measured video observations. Each pattern carries its family,
 * machine-usable parameters, compatible contexts, variation options, the scenes it came from, confidence and the
 * measurements behind it. Families that need readable text or speech (benefit, offer) are reported unavailable
 * instead of being inferred.
 */
import type { CreativePattern } from "../creative-planning/learned-creative-patterns.js";
import type { VideoLearningObservation } from "./video-observations.js";

const r2 = (n: number) => Number(n.toFixed(2));
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
      parameters: { onBeatRatio: r2(on / synced.length), onDownbeat: down, bpm: meta.bpm ?? null, energyRiseAtReveal: Boolean(riseAtReveal) },
      compatibleContexts: [...ctx, "music"], variationOptions: ["cut on every beat", "cut on downbeats only", "hold across the drop"],
      scenes: synced.map((o) => o.sceneIndex), confidence: 0.75, evidence: synced.slice(0, 6).map((o) => ev(o, o.synchronization!.evidence)),
    });
  }

  // Storytelling structure
  patterns.push({
    family: "STORYTELLING", name: obs.map((o) => o.storytelling.role).join(" → "),
    description: `Scene roles in order: ${obs.map((o) => `${o.storytelling.role.toLowerCase()} (${o.storytelling.basis.toLowerCase()})`).join(", ")}.`,
    parameters: { sequence: obs.map((o) => o.storytelling.role).join(">"), measuredRoles: obs.filter((o) => o.storytelling.basis !== "POSITION").length },
    compatibleContexts: ctx, variationOptions: ["hook → reveal → showcase → CTA", "reveal first", "problem → product → CTA"],
    scenes: obs.map((o) => o.sceneIndex), confidence: r2(obs.reduce((a, o) => a + o.storytelling.confidence, 0) / obs.length),
    evidence: obs.slice(0, 6).map((o) => ev(o, o.storytelling.note)),
  });

  unavailable.push("Benefit and offer patterns — need readable on-screen text or speech; not inferred.");
  return { patterns, unavailable };
}
