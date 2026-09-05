/**
 * Deterministic CreativeQualityReport — no hidden model chain-of-thought.
 * Complements ai-quality-review with planning-time checks.
 */

export interface CreativeQualityReport {
  score: number;
  band: "HIGH" | "MEDIUM" | "LOW";
  checks: {
    productVisibility: boolean;
    pacing: boolean;
    sceneVariety: boolean;
    beatAlignment: boolean;
    textReadability: boolean;
    motionIntensity: boolean;
    transitionOveruse: boolean;
    ctaVisibility: boolean;
    endCardReadability: boolean;
  };
  notes: string[];
  explanations: string[];
}

export function buildCreativeQualityReport(input: {
  scenePurposes: string[];
  durationsSec: number[];
  transitions: string[];
  hasCta: boolean;
  hasEndCard: boolean;
  motionHints?: string[];
  beatAlignedCuts?: number;
  totalBeats?: number;
  textOnScreenScenes?: number;
}): CreativeQualityReport {
  const notes: string[] = [];
  const explanations: string[] = [];
  const purposes = input.scenePurposes.map((p) => p.toUpperCase());
  const transitions = input.transitions.map((t) => t.toLowerCase());

  const productVisibility = purposes.some((p) => /HOOK|REVEAL|FEATURE|DETAIL/.test(p));
  if (!productVisibility) notes.push("No clear product-focused scene purpose.");

  const avg = input.durationsSec.length
    ? input.durationsSec.reduce((a, b) => a + b, 0) / input.durationsSec.length
    : 0;
  const pacing = avg >= 1.5 && avg <= 6;
  if (!pacing) notes.push("Average scene duration outside readable 1.5–6s band.");

  const unique = new Set(purposes);
  const sceneVariety = unique.size >= Math.min(2, purposes.length);
  if (!sceneVariety) notes.push("Low scene purpose variety.");

  const beatAlignment = (input.totalBeats ?? 0) === 0
    || ((input.beatAlignedCuts ?? 0) / Math.max(1, input.totalBeats ?? 1)) <= 0.6;
  if (!beatAlignment) {
    notes.push("Too many beat-aligned cuts — not every beat should cut.");
    explanations.push("Beat synchronization was reduced to preserve pacing.");
  }

  const textReadability = (input.textOnScreenScenes ?? 0) === 0
    || input.durationsSec.some((d, i) => (input.textOnScreenScenes ?? 0) > 0 && d >= 2);
  if (!textReadability) notes.push("Text scenes may be too short for readability.");

  const aggressive = (input.motionHints ?? []).filter((m) => /ZOOM|WHIP|SPIN/i.test(m)).length;
  const motionIntensity = aggressive <= 1;
  if (!motionIntensity) notes.push("Motion intensity may be too aggressive for product clarity.");

  const fancy = transitions.filter((t) => t !== "cut" && t !== "fade").length;
  const fadeHeavy = transitions.filter((t) => t === "fade").length > Math.ceil(transitions.length / 2);
  const transitionOveruse = fancy === 0 && !fadeHeavy;
  if (fancy > 0) {
    notes.push("Unsupported transitions detected — Engine1 supports cut/fade only.");
  } else if (fadeHeavy) {
    notes.push("Fade overuse — prefer cut for mid-timeline.");
  }

  const ctaVisibility = !input.hasCta || purposes.some((p) => /CTA|OFFER/.test(p));
  if (!ctaVisibility) notes.push("CTA requested but no CTA/OFFER scene.");

  const endCardReadability = !input.hasEndCard || purposes.some((p) => /CTA|OFFER|END/.test(p));
  if (!endCardReadability) notes.push("End card expected but closing scene missing.");

  const checks = {
    productVisibility,
    pacing,
    sceneVariety,
    beatAlignment,
    textReadability,
    motionIntensity,
    transitionOveruse,
    ctaVisibility,
    endCardReadability,
  };
  const passed = Object.values(checks).filter(Boolean).length;
  const score = passed / Object.keys(checks).length;
  const band: CreativeQualityReport["band"] = score >= 0.85 ? "HIGH" : score >= 0.6 ? "MEDIUM" : "LOW";

  if (productVisibility) {
    explanations.push("Product-focused scene purposes present for visibility.");
  }
  if (transitions.every((t) => t === "cut" || t === "fade")) {
    explanations.push("Transitions mapped to supported Engine1 presets (cut/fade).");
  }

  return { score, band, checks, notes, explanations };
}
