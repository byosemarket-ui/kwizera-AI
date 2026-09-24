/**
 * Phase 7 — decides which image operations a scene source actually needs.
 * Default is the lowest-cost path: original photo → I2V.
 */

import { createHash } from "node:crypto";
import type { ImagePrepDecision, ImagePrepReasonCode } from "./types.js";

const ENVIRONMENT_INTENT = /\b(background|backdrop|studio|environment|setting|scene|room|surface|table|pedestal|podium|plinth|marble|wood(en)?|beach|outdoor|indoor|street|city|nature|forest|garden|sky|sunset|sunrise|night|interior|kitchen|shelf|floor|wall|gradient|luxury|lighting|lights?|shadows?|reflections?|atmosphere|smoke|fog|mist|water|splash|flowers?|petals?|snow|desert|mountains?|display|showroom|stage)\b/i;

const ENHANCE_INTENT = /\b(sharpen|sharper|upscale|upscaled|high[- ]?res(olution)?|hd|4k|crisp(er)?|clearer|better quality|improve (the )?quality|enhance (the )?(photo|image|quality))\b/i;

const CHANGE_VERB = /\b(change|make|turn|recolou?r|repaint|paint|replace|swap|alter|modify|redesign|remove|add|convert)\b/i;

const PROTECTED_TARGET = /\b(logo|logos|colou?rs?|material|shape|design|soles?|laces?|pattern|texture|stitch(ing)?|brand(ing)?|label|print(ed)?|straps?|buckles?|heel)\b/i;

const PRODUCT_NOUN = /\b(product|shoes?|boots?|sneakers?|bags?|bottles?|watch(es)?|dress(es)?|shirts?|item)\b/i;

const PRODUCT_ATTRIBUTE_VALUE = /\b(red|blue|green|black|white|gold|golden|silver|pink|purple|yellow|orange|brown|beige|leather|suede|metal|metallic|plastic|canvas|velvet|bigger|smaller|taller|shorter)\b/i;

/** Clauses that target the backdrop are always allowed, even with a colour word. */
const BACKDROP_TARGET = /\b(background|backdrop|environment|surface|lighting|light|scene|wall|floor|table|sky|room)\b/i;

export function isProductChangingClause(clause: string): boolean {
  const text = clause.trim();
  if (!text || !CHANGE_VERB.test(text) || BACKDROP_TARGET.test(text)) return false;
  if (PROTECTED_TARGET.test(text)) return true;
  return PRODUCT_NOUN.test(text) && PRODUCT_ATTRIBUTE_VALUE.test(text);
}

/** Removes instructions that would alter protected product identity. */
export function sanitizeCreativeRequest(raw: string | null | undefined): { text: string; rejected: number } {
  const source = String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, 600);
  if (!source) return { text: "", rejected: 0 };
  const clauses = source.split(/(?<=[.;!?])\s+|\n+/).map((c) => c.trim()).filter(Boolean);
  let rejected = 0;
  const kept: string[] = [];
  for (const clause of clauses) {
    if (isProductChangingClause(clause)) {
      rejected += 1;
      continue;
    }
    kept.push(clause);
  }
  return { text: kept.join(" ").trim(), rejected };
}

export interface ImagePrepDecisionInput {
  generativeVideo: boolean;
  creativeRequest?: string | null;
  sourceWidth?: number | null;
  sourceHeight?: number | null;
  /** Short side below this triggers enhancement (I2V renders at 720p). */
  minShortSidePx?: number;
  editorAcceptsMask: boolean;
}

export function decideImagePreparation(input: ImagePrepDecisionInput): ImagePrepDecision {
  const none: ImagePrepDecision = {
    segmentationRequired: false,
    imageEditingRequired: false,
    enhancementRequired: false,
    upscaleFactor: null,
    reasonCodes: [],
    editRequest: "",
    rejectedInstructionCount: 0,
  };
  if (!input.generativeVideo) {
    return { ...none, reasonCodes: ["NOT_GENERATIVE_MODE"] };
  }

  const reasons: ImagePrepReasonCode[] = [];
  const sanitized = sanitizeCreativeRequest(input.creativeRequest);
  if (sanitized.rejected > 0) reasons.push("PRODUCT_CHANGE_INSTRUCTION_REJECTED");

  const imageEditingRequired = Boolean(sanitized.text) && ENVIRONMENT_INTENT.test(sanitized.text);
  if (imageEditingRequired) reasons.push("ENVIRONMENT_EDIT_REQUESTED");

  const segmentationRequired = imageEditingRequired && input.editorAcceptsMask;
  if (segmentationRequired) reasons.push("MASK_GUIDED_EDITOR");

  const minShort = Math.max(256, input.minShortSidePx ?? 720);
  const w = Number(input.sourceWidth) || 0;
  const h = Number(input.sourceHeight) || 0;
  const shortSide = w > 0 && h > 0 ? Math.min(w, h) : 0;
  const lowResolution = shortSide > 0 && shortSide < minShort;
  const explicitEnhance = Boolean(sanitized.text) && ENHANCE_INTENT.test(sanitized.text);
  if (lowResolution) reasons.push("LOW_SOURCE_RESOLUTION");
  if (explicitEnhance) reasons.push("QUALITY_ENHANCEMENT_REQUESTED");

  // Explicit requests on an already large photo do not justify a paid upscale.
  const enhancementRequired = lowResolution || (explicitEnhance && shortSide > 0 && shortSide < 1_440);
  const upscaleFactor: 2 | 4 | null = enhancementRequired
    ? (shortSide > 0 && shortSide * 2 < minShort ? 4 : 2)
    : null;

  if (!sanitized.text && !lowResolution) reasons.push("NO_CREATIVE_REQUEST");

  return {
    segmentationRequired,
    imageEditingRequired,
    enhancementRequired,
    upscaleFactor,
    reasonCodes: reasons,
    editRequest: sanitized.text,
    rejectedInstructionCount: sanitized.rejected,
  };
}

export function needsImagePreparation(decision: ImagePrepDecision): boolean {
  return decision.imageEditingRequired || decision.enhancementRequired;
}

/** Stable key so repeated renders reuse accepted derived images. */
export function imagePrepFingerprint(decision: ImagePrepDecision, editorAcceptsMask: boolean): string {
  return createHash("sha256")
    .update(JSON.stringify({
      s: decision.segmentationRequired,
      e: decision.imageEditingRequired,
      u: decision.enhancementRequired,
      f: decision.upscaleFactor,
      r: decision.editRequest,
      m: editorAcceptsMask,
    }))
    .digest("hex")
    .slice(0, 12);
}
