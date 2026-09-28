/**
 * Phase 18C — learned creative patterns at runtime.
 * Patterns come only from ACTIVE, evaluated Training Center dataset versions (the provider is registered by the
 * server; inactive, rejected or rolled-back knowledge is never offered). Selection is task-aware and varied:
 * one pattern per family, weighted by confidence, context compatibility and how recently it was used, with a
 * deterministic per-project seed so re-planning the same project is stable while different projects vary.
 * Patterns are guidance: they only steer choices the renderer supports and never override product-safety or
 * user edits. Pattern text is untrusted data and is never used as an instruction.
 */
import { createHash } from "node:crypto";

export type PatternFamily =
  | "HOOK" | "REVEAL" | "SHOWCASE" | "BENEFIT" | "OFFER" | "CTA" | "PACING" | "CAMERA" | "TRANSITION"
  | "TYPOGRAPHY_TIMING" | "AUDIO_SYNC" | "STORYTELLING"
  // Phase 18D — audio, image/typography and cross-modal families.
  | "MUSIC_TEMPO" | "MUSIC_STRUCTURE" | "LAYOUT" | "TYPOGRAPHY_LAYOUT" | "COLOR_CONTRAST" | "CREATIVE_PROFILE";

export const PATTERN_FAMILY_LIST: PatternFamily[] = [
  "HOOK", "REVEAL", "SHOWCASE", "BENEFIT", "OFFER", "CTA", "PACING", "CAMERA", "TRANSITION", "TYPOGRAPHY_TIMING", "AUDIO_SYNC", "STORYTELLING",
  "MUSIC_TEMPO", "MUSIC_STRUCTURE", "LAYOUT", "TYPOGRAPHY_LAYOUT", "COLOR_CONTRAST", "CREATIVE_PROFILE",
];

export interface CreativePattern {
  family: PatternFamily;
  name: string;
  description: string;
  /** Machine-usable parameters (e.g. transition, durationSec, movement, meanShotSec). */
  parameters: Record<string, string | number | boolean | null>;
  compatibleContexts: string[];
  variationOptions: string[];
  scenes: number[];
  confidence: number;
  evidence: string[];
}

export interface ActiveCreativePattern extends CreativePattern {
  patternId: string;
  provenance: { datasetId: string; datasetKey: string; version: number; recordId: string; sources: Array<{ sourceId: string; title: string; locations: string[] }> };
  usageCount: number;
}

export type PatternTask = "PRODUCT_SLIDESHOW" | "CINEMATIC_VIDEO" | "AUDIO_PLAN" | "TYPOGRAPHY_PLAN";

export interface CreativePatternQuery {
  task: PatternTask;
  projectId: string | null;
  context: string[];
  /** Phase 18D — also read patterns taught to these tasks (e.g. typography reads layout learned by design teaching). */
  alsoTasks?: PatternTask[];
  /** Phase 18D — only these families (task-aware retrieval; nothing else is returned). */
  families?: PatternFamily[];
}

/** Which tasks and families each runtime consumer reads. */
export const RUNTIME_PATTERN_QUERIES = {
  videoPlan: (cinematic: boolean): Omit<CreativePatternQuery, "projectId" | "context"> => ({
    task: cinematic ? "CINEMATIC_VIDEO" : "PRODUCT_SLIDESHOW",
    alsoTasks: ["TYPOGRAPHY_PLAN", "AUDIO_PLAN"],
    families: ["HOOK", "REVEAL", "SHOWCASE", "CTA", "PACING", "CAMERA", "TRANSITION", "TYPOGRAPHY_TIMING", "AUDIO_SYNC", "STORYTELLING", "LAYOUT", "TYPOGRAPHY_LAYOUT", "COLOR_CONTRAST", "CREATIVE_PROFILE", "MUSIC_TEMPO"],
  }),
  beatSync: (): Omit<CreativePatternQuery, "projectId" | "context"> => ({
    task: "AUDIO_PLAN", alsoTasks: ["PRODUCT_SLIDESHOW", "CINEMATIC_VIDEO"], families: ["AUDIO_SYNC", "MUSIC_TEMPO", "MUSIC_STRUCTURE"],
  }),
  typography: (): Omit<CreativePatternQuery, "projectId" | "context"> => ({
    task: "TYPOGRAPHY_PLAN", alsoTasks: ["PRODUCT_SLIDESHOW", "CINEMATIC_VIDEO"], families: ["LAYOUT", "TYPOGRAPHY_LAYOUT", "COLOR_CONTRAST"],
  }),
};

export interface CreativePatternProvider {
  active(query: CreativePatternQuery): ActiveCreativePattern[];
  recordUsage(patternIds: string[], projectId: string | null): void;
}

let provider: CreativePatternProvider | null = null;

export function registerCreativePatternProvider(p: CreativePatternProvider | null): void {
  provider = p;
}

export function activeCreativePatterns(query: CreativePatternQuery): ActiveCreativePattern[] {
  try {
    return provider?.active(query) ?? [];
  } catch {
    return [];
  }
}

export function recordCreativePatternUsage(patternIds: string[], projectId: string | null): void {
  try {
    if (patternIds.length) provider?.recordUsage(patternIds, projectId);
  } catch {
    /* usage history is best-effort */
  }
}

export interface PatternSelection {
  family: PatternFamily;
  selected: ActiveCreativePattern;
  alternatives: Array<{ patternId: string; name: string; score: number }>;
  score: number;
  reason: string;
}

const unit = (seed: string) => parseInt(createHash("sha256").update(seed).digest("hex").slice(0, 8), 16) / 0xffffffff;

/**
 * One pattern per family. Score = confidence × context match × freshness (1 / (1 + uses)) × seeded jitter, so a
 * frequently used pattern yields to a comparable alternative instead of the same one being applied every time.
 */
export function selectCreativePatterns(patterns: ActiveCreativePattern[], opts: { seed: string; context: string[]; recentlyUsed?: string[]; pinned?: string[] }): PatternSelection[] {
  const byFamily = new Map<PatternFamily, ActiveCreativePattern[]>();
  for (const p of patterns) byFamily.set(p.family, [...(byFamily.get(p.family) ?? []), p]);
  const ctx = new Set(opts.context.map((c) => c.toLowerCase()));
  const recent = new Set(opts.recentlyUsed ?? []);
  const out: PatternSelection[] = [];
  for (const [family, list] of byFamily) {
    const scored = list.map((p) => {
      const contexts = p.compatibleContexts.map((c) => c.toLowerCase());
      const match = contexts.length ? contexts.filter((c) => ctx.has(c)).length / contexts.length : 0.5;
      const freshness = 1 / (1 + p.usageCount + (recent.has(p.patternId) ? 2 : 0));
      const jitter = 0.85 + 0.3 * unit(`${opts.seed}:${p.patternId}`);
      return { p, score: Number((p.confidence * (0.6 + 0.4 * match) * (0.5 + 0.5 * freshness) * jitter).toFixed(4)), match, freshness };
    }).sort((a, b) => b.score - a.score);
    const pinned = scored.find((s) => opts.pinned?.includes(s.p.patternId));
    const top = pinned ?? scored[0]!;
    out.push({
      family, selected: top.p, score: top.score,
      alternatives: scored.filter((s) => s !== top).slice(0, 3).map((s) => ({ patternId: s.p.patternId, name: s.p.name, score: s.score })),
      reason: pinned
        ? `Kept from the earlier plan of this version so re-rendering stays stable (${list.length} active ${family.toLowerCase().replace("_", " ")} pattern(s)).`
        : `${list.length} active ${family.toLowerCase().replace("_", " ")} pattern(s); chosen for confidence ${top.p.confidence.toFixed(2)}, context match ${Math.round(top.match * 100)}%, used ${top.p.usageCount} time(s) before.`,
    });
  }
  return out.sort((a, b) => a.family.localeCompare(b.family));
}

export interface TimelineClipLike {
  sceneId: string;
  order: number;
  purpose: string;
  durationMs: number;
  motion: string;
  transitionIn: "cut" | "fade";
  transitionOut: "cut" | "fade";
  userEdited?: boolean;
}

export interface LearnedDirectionDecision {
  patternId: string;
  family: PatternFamily;
  name: string;
  applied: boolean;
  target: string;
  change: string | null;
  reason: string;
  provenance: ActiveCreativePattern["provenance"];
}

const SUPPORTED_TRANSITION: Record<string, "cut" | "fade" | null> = {
  CUT: "cut", DISSOLVE: "fade", FADE_THROUGH_BLACK: "fade", FADE_THROUGH_WHITE: "fade", WIPE: null, GRADUAL_UNCLASSIFIED: null,
};
const ZOOM_FAMILY = new Set(["slow-zoom", "zoom-out", "hold"]);
const CAMERA_TO_MOTION: Record<string, string | null> = { PUSH_IN: "slow-zoom", PULL_OUT: "zoom-out", STATIC: "hold" };

const purposeRole = (purpose: string): string => {
  const p = purpose.toUpperCase();
  if (/HOOK|INTRO|OPEN/.test(p)) return "HOOK";
  if (/REVEAL|HERO/.test(p)) return "REVEAL";
  if (/CTA|CALL|OUTRO|CLOS|END/.test(p)) return "CTA";
  return "SHOWCASE";
};

/**
 * Applies selected patterns to a timeline where the renderer supports the learned choice. Transitions map to the
 * renderer's cut/fade; camera patterns switch only between zoom-family motions (the motion director's crop-safe
 * zoom limits stay in force); user-edited clips are never touched. Every decision records its provenance.
 */
export function applyLearnedPatternsToTimeline<T extends TimelineClipLike>(clips: T[], selections: PatternSelection[]): { clips: T[]; decisions: LearnedDirectionDecision[] } {
  const next = clips.map((c) => ({ ...c }));
  const decisions: LearnedDirectionDecision[] = [];
  const decide = (s: PatternSelection, applied: boolean, target: string, change: string | null, reason: string) =>
    decisions.push({ patternId: s.selected.patternId, family: s.family, name: s.selected.name, applied, target, change, reason, provenance: s.selected.provenance });
  for (const s of selections) {
    const p = s.selected.parameters;
    if (s.family === "TRANSITION") {
      const learned = String(p.transition ?? "");
      const mapped = SUPPORTED_TRANSITION[learned] ?? null;
      if (!mapped) { decide(s, false, "transitions", null, `The renderer supports cut and fade only; a learned ${learned.toLowerCase().replace(/_/g, " ")} is not applied.`); continue; }
      const position = String(p.position ?? "BETWEEN_SCENES");
      const idx = next.map((c, i) => ({ c, i })).filter(({ c, i }) => i < next.length - 1 && !c.userEdited && !next[i + 1]!.userEdited)
        .filter(({ i }) => position === "INTO_REVEAL" ? purposeRole(next[i + 1]!.purpose) === "REVEAL" || i === 0
          : position === "INTO_CTA" ? i === next.length - 2 : true)
        .map(({ i }) => i);
      if (!idx.length) { decide(s, false, "transitions", null, "No unedited boundary matches the learned position."); continue; }
      const changed: string[] = [];
      for (const i of idx) {
        if (next[i]!.transitionOut === mapped && next[i + 1]!.transitionIn === mapped) continue;
        next[i]!.transitionOut = mapped;
        next[i + 1]!.transitionIn = mapped;
        changed.push(`${next[i]!.sceneId}→${next[i + 1]!.sceneId}`);
      }
      decide(s, changed.length > 0, `boundaries ${idx.map((i) => `${next[i]!.sceneId}→${next[i + 1]!.sceneId}`).join(", ")}`,
        changed.length ? `${mapped} at ${changed.join(", ")}` : null,
        changed.length ? `Learned ${learned.toLowerCase().replace(/_/g, " ")} (${position.toLowerCase().replace(/_/g, " ")}) rendered as ${mapped}.` : `Already ${mapped}; nothing to change.`);
      continue;
    }
    if (s.family === "CAMERA" || s.family === "REVEAL" || s.family === "HOOK") {
      const movement = String(p.movement ?? p.camera ?? "");
      const motion = CAMERA_TO_MOTION[movement] ?? null;
      const role = String(p.role ?? (s.family === "CAMERA" ? "SHOWCASE" : s.family));
      if (!motion) { if (movement) decide(s, false, `${role.toLowerCase()} scenes`, null, `Learned ${movement.toLowerCase().replace(/_/g, " ")} is not applied: pans/tilts need crop-safe framing verification the motion director owns.`); continue; }
      const targets = next.filter((c) => !c.userEdited && purposeRole(c.purpose) === role && ZOOM_FAMILY.has(c.motion));
      if (!targets.length) { decide(s, false, `${role.toLowerCase()} scenes`, null, "No unedited scene with that role uses a zoom-family motion."); continue; }
      const changed = targets.filter((c) => c.motion !== motion);
      for (const c of changed) c.motion = motion;
      decide(s, changed.length > 0, targets.map((c) => c.sceneId).join(", "), changed.length ? `motion ${motion} on ${changed.map((c) => c.sceneId).join(", ")}` : null,
        changed.length ? `Learned ${movement.toLowerCase().replace(/_/g, " ")} for ${role.toLowerCase()} scenes.` : `Already ${motion}.`);
      continue;
    }
    if (s.family === "LAYOUT" || s.family === "TYPOGRAPHY_LAYOUT") { decide(s, false, "typography plan", null, "Applied by the typography planner (text-safe side and call-to-action placement), not by the timeline."); continue; }
    if (s.family === "AUDIO_SYNC" || s.family === "MUSIC_TEMPO" || s.family === "MUSIC_STRUCTURE") { decide(s, false, "beat sync / audio plan", null, "Applied by beat-sync timing and the audio plan, not by scene motion or transitions."); continue; }
    decide(s, false, "creative director", null, "Supplied to the Creative Director as reference guidance; no deterministic timeline parameter for this family.");
  }
  return { clips: next, decisions };
}

export interface LearnedRuntimeUse<T> {
  value: T;
  patternId: string;
  name: string;
  reason: string;
  provenance: ActiveCreativePattern["provenance"];
}

/**
 * Beat-sync alignment learned from AUDIO_SYNC patterns: DOWNBEAT when at least half the measured cuts landed on a
 * downbeat, BEAT when most landed on a beat, FREE when the edit ignored the beat (the project's mode is then kept).
 */
export function learnedBeatAlignment(selections: PatternSelection[]): LearnedRuntimeUse<"DOWNBEAT" | "BEAT" | "FREE"> | null {
  const s = selections.find((x) => x.family === "AUDIO_SYNC");
  if (!s) return null;
  const p = s.selected.parameters;
  const cuts = Math.max(1, s.selected.scenes.length || Number(p.cuts ?? 1));
  const downRatio = typeof p.downbeatRatio === "number" ? p.downbeatRatio : Number(p.onDownbeat ?? 0) / cuts;
  const onRatio = Number(p.onBeatRatio ?? 0);
  const value = typeof p.alignTo === "string" && ["DOWNBEAT", "BEAT", "FREE"].includes(p.alignTo) ? p.alignTo as "DOWNBEAT" | "BEAT" | "FREE"
    : downRatio >= 0.5 ? "DOWNBEAT" : onRatio >= 0.6 ? "BEAT" : "FREE";
  return {
    value, patternId: s.selected.patternId, name: s.selected.name, provenance: s.selected.provenance,
    reason: `Learned from "${s.selected.name}": ${Math.round(onRatio * 100)}% of measured cuts on a beat, ${Math.round(downRatio * 100)}% on a downbeat.`,
  };
}

export type TextSide = "left" | "right" | "top" | "bottom";

/**
 * Typography placement learned from LAYOUT (text-safe side next to the product) and TYPOGRAPHY_LAYOUT (where text
 * bands sit). Per-scene measured product position always wins; the product-overlap check stays in force.
 */
export function learnedTypographyLayout(selections: PatternSelection[]): LearnedRuntimeUse<{ textSides: TextSide[]; ctaPlacement: "bottom" | "top" | null }> | null {
  const layout = selections.find((x) => x.family === "LAYOUT");
  const typo = selections.find((x) => x.family === "TYPOGRAPHY_LAYOUT");
  const sides: TextSide[] = [];
  const side = (v: unknown): TextSide | null => (v === "left" || v === "right" || v === "top" || v === "bottom" ? v : null);
  const fromLayout = side(layout?.selected.parameters.textSafeSide);
  if (fromLayout) sides.push(fromLayout);
  const fromTypo = side(typo?.selected.parameters.textSide) ?? side(typo?.selected.parameters.headlinePosition);
  if (fromTypo && !sides.includes(fromTypo)) sides.push(fromTypo);
  const ctaBand = typo?.selected.parameters.ctaBand;
  const ctaPlacement = ctaBand === "bottom" || ctaBand === "top" ? ctaBand : null;
  const primary = layout ?? typo;
  if (!primary || (!sides.length && !ctaPlacement)) return null;
  return {
    value: { textSides: sides, ctaPlacement }, patternId: primary.selected.patternId, name: primary.selected.name, provenance: primary.selected.provenance,
    reason: `Learned layout: text ${sides.length ? `on the ${sides.join("/")} side` : "placement unchanged"}${ctaPlacement ? `, call to action at the ${ctaPlacement}` : ""} (${[layout, typo].filter(Boolean).map((x) => `"${x!.selected.name}"`).join(", ")}).`,
  };
}

/**
 * Music guidance learned from MUSIC_TEMPO/MUSIC_STRUCTURE for selecting or generating music. It is reference data
 * for the audio plan; it never replaces measured BPM/beats of the chosen track.
 */
export function learnedMusicGuidance(selections: PatternSelection[]): LearnedRuntimeUse<{ bpmRange: [number, number] | null; energyLevel: string | null; structure: string | null; introSec: number | null }> | null {
  const tempo = selections.find((x) => x.family === "MUSIC_TEMPO");
  const structure = selections.find((x) => x.family === "MUSIC_STRUCTURE");
  const primary = tempo ?? structure;
  if (!primary) return null;
  const bpm = typeof tempo?.selected.parameters.bpm === "number" ? tempo.selected.parameters.bpm : null;
  return {
    value: {
      bpmRange: bpm ? [Math.round(bpm * 0.94), Math.round(bpm * 1.06)] : null,
      energyLevel: typeof tempo?.selected.parameters.energyLevel === "string" ? tempo.selected.parameters.energyLevel : null,
      structure: typeof structure?.selected.parameters.sequence === "string" ? structure.selected.parameters.sequence : null,
      introSec: typeof structure?.selected.parameters.introSec === "number" ? structure.selected.parameters.introSec : null,
    },
    patternId: primary.selected.patternId, name: primary.selected.name, provenance: primary.selected.provenance,
    reason: `Learned music profile from ${[tempo, structure].filter(Boolean).map((x) => `"${x!.selected.name}"`).join(" and ")}.`,
  };
}

/** Compact, fenced reference data for LLM planners (untrusted; never instructions). */
export function formatPatternsForPrompt(selections: PatternSelection[]): Array<Record<string, unknown>> {
  return selections.slice(0, 8).map((s) => ({
    family: s.family,
    pattern: s.selected.name.slice(0, 120),
    parameters: s.selected.parameters,
    confidence: s.selected.confidence,
    alternatives: s.alternatives.map((a) => a.name.slice(0, 80)),
    source: `${s.selected.provenance.datasetKey} v${s.selected.provenance.version}`,
  }));
}
