/**
 * Normalize + validate online/local vision JSON into VisionAnalysisResult.
 * Never invents product attributes — unknown/uncertain stay marked as such.
 */
import type { VisionAnalysisResult, VisionProductObservation } from "./vision-capabilities.js";

const VIEW_RE = /^(front|side|back|top|bottom|detail|lifestyle|unknown)$/i;
const BG_RE = /^(plain|studio|complex|lifestyle|cluttered|unknown)$/i;
const UNCERTAIN = /^(unknown|uncertain|n\/a|na|none|null|undefined)?$/i;

function clamp(value: unknown, fallback = 0.5): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

function asTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  return text.length ? text : undefined;
}

function isUncertain(value: string | undefined): boolean {
  return !value || UNCERTAIN.test(value);
}

function parseJsonLoose(text: string): Record<string, unknown> | null {
  const raw = text.trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* try fenced / embedded object */
  }
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    try {
      const parsed = JSON.parse(fenced[1].trim()) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      /* fall through */
    }
  }
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(raw.slice(start, end + 1)) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  return null;
}

function observation(
  field: string,
  value: unknown,
  confidence: unknown,
  uncertainDefault = true,
): VisionProductObservation | null {
  const text = asTrimmedString(value);
  if (!text) return null;
  const conf = clamp(confidence, uncertainDefault && isUncertain(text) ? 0.2 : 0.55);
  return {
    field,
    value: text,
    confidence: conf,
    uncertain: isUncertain(text) || conf < 0.45,
  };
}

/**
 * Build a VisionAnalysisResult from model output text.
 * Returns available:false when JSON cannot be parsed (caller should fallback).
 */
export function normalizeVisionModelOutput(opts: {
  provider: string;
  model: string | null;
  outputText: string | null | undefined;
  notes?: string[];
  source?: VisionAnalysisResult["source"];
}): VisionAnalysisResult {
  const notes = [...(opts.notes ?? [])];
  const parsed = typeof opts.outputText === "string" ? parseJsonLoose(opts.outputText) : null;
  if (!parsed) {
    return {
      provider: opts.provider,
      model: opts.model,
      available: false,
      source: opts.source,
      notes: [...notes, "Vision model returned malformed or empty JSON"],
    };
  }

  const viewRaw = asTrimmedString(parsed.view) ?? "unknown";
  const view = VIEW_RE.test(viewRaw) ? viewRaw.toLowerCase() : "unknown";
  const bgRaw = asTrimmedString(parsed.backgroundType) ?? "unknown";
  const backgroundType = BG_RE.test(bgRaw) ? bgRaw.toLowerCase() : "unknown";

  const dominantColors = Array.isArray(parsed.dominantColors)
    ? parsed.dominantColors
        .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
        .map((item) => ({
          name: String(item.name ?? "").trim(),
          confidence: clamp(item.confidence),
        }))
        .filter((item) => item.name && !isUncertain(item.name))
        .slice(0, 6)
    : undefined;

  const productObservations: VisionProductObservation[] = [];
  const pushObs = (field: string, value: unknown, confidence: unknown) => {
    const obs = observation(field, value, confidence);
    if (obs && !obs.uncertain) productObservations.push(obs);
    else if (obs) productObservations.push(obs);
  };

  pushObs("category", parsed.category ?? parsed.productCategory, parsed.categoryConfidence);
  pushObs("productType", parsed.productType ?? parsed.type, parsed.productTypeConfidence ?? parsed.categoryConfidence);
  pushObs("visibleName", parsed.visibleName ?? parsed.productName, parsed.visibleNameConfidence);
  pushObs("visualDescription", parsed.visualDescription ?? parsed.description, parsed.visualDescriptionConfidence ?? 0.6);
  pushObs("shape", parsed.shape, parsed.shapeConfidence);
  pushObs("primaryColor", parsed.primaryColor, parsed.primaryColorConfidence);
  pushObs("material", parsed.material, parsed.materialConfidence);
  pushObs("texture", parsed.texture, parsed.textureConfidence);
  pushObs("pattern", parsed.pattern, parsed.patternConfidence);
  pushObs("logo", parsed.logo, parsed.logoConfidence);
  pushObs("branding", parsed.brandingMarks ?? parsed.branding, parsed.brandingConfidence);
  pushObs("design", parsed.designDetails ?? parsed.design, parsed.designConfidence);
  pushObs("sole", parsed.sole, parsed.soleConfidence);
  pushObs("laces", parsed.laces, parsed.lacesConfidence);
  pushObs("packaging", parsed.packaging, parsed.packagingConfidence);
  pushObs("heroRecommendation", parsed.heroRecommendation ?? parsed.bestHeroImage, parsed.heroConfidence);
  pushObs("imageQuality", parsed.imageQuality, parsed.imageQualityConfidence);

  if (Array.isArray(parsed.secondaryColors)) {
    for (const color of parsed.secondaryColors.slice(0, 4)) {
      pushObs("secondaryColor", color, 0.55);
    }
  }
  if (Array.isArray(parsed.visibleComponents)) {
    for (const component of parsed.visibleComponents.slice(0, 8)) {
      pushObs("component", component, 0.5);
    }
  }
  if (Array.isArray(parsed.visibleText)) {
    for (const text of parsed.visibleText.slice(0, 8)) {
      pushObs("visibleText", text, 0.55);
    }
  }
  if (Array.isArray(parsed.marketingObservations)) {
    for (const note of parsed.marketingObservations.slice(0, 6)) {
      pushObs("marketingObservation", note, 0.45);
    }
  }

  const category = asTrimmedString(parsed.category) ?? asTrimmedString(parsed.productCategory);

  return {
    provider: opts.provider,
    model: opts.model,
    available: true,
    source: opts.source,
    views: [{ view, confidence: clamp(parsed.viewConfidence, view === "unknown" ? 0.3 : 0.65) }],
    dominantColors: dominantColors?.length ? dominantColors : undefined,
    backgroundType: {
      type: backgroundType,
      confidence: clamp(parsed.backgroundConfidence, backgroundType === "unknown" ? 0.3 : 0.6),
    },
    productCategory: category && !isUncertain(category)
      ? { category, confidence: clamp(parsed.categoryConfidence, 0.55) }
      : undefined,
    productObservations: productObservations.length ? productObservations : undefined,
    notes: notes.length ? notes : ["Vision analysis normalized"],
  };
}

/** Structured prompt for Admin-routed online vision (JSON only). */
export function buildVisionAnalysisPrompt(input: {
  userProductName?: string;
  userCategory?: string;
  fileName?: string;
}): string {
  return [
    "Analyze the product image. Reply with JSON only (no markdown).",
    "Do not invent attributes. Use \"unknown\" when uncertain.",
    "{",
    '  "view": "front|side|back|top|bottom|detail|lifestyle|unknown",',
    '  "viewConfidence": 0.0,',
    '  "backgroundType": "plain|studio|complex|lifestyle|cluttered|unknown",',
    '  "backgroundConfidence": 0.0,',
    '  "category": "string or unknown",',
    '  "categoryConfidence": 0.0,',
    '  "productType": "string or unknown",',
    '  "visibleName": "string or unknown",',
    '  "visualDescription": "brief factual description or unknown",',
    '  "shape": "string or unknown",',
    '  "primaryColor": "string or unknown",',
    '  "secondaryColors": ["..."],',
    '  "material": "string or unknown",',
    '  "texture": "string or unknown",',
    '  "pattern": "string or unknown",',
    '  "logo": "string or unknown",',
    '  "brandingMarks": "string or unknown",',
    '  "designDetails": "string or unknown",',
    '  "sole": "string or unknown",',
    '  "laces": "string or unknown",',
    '  "packaging": "string or unknown",',
    '  "visibleComponents": ["..."],',
    '  "visibleText": ["..."],',
    '  "heroRecommendation": "string or unknown",',
    '  "imageQuality": "good|acceptable|needs-review|poor|unknown",',
    '  "marketingObservations": ["factual visual notes only"],',
    '  "dominantColors": [{"name":"color","confidence":0.0}]',
    "}",
    input.userProductName ? `Customer product name (context only): ${input.userProductName}` : "",
    input.userCategory ? `Customer category (context only): ${input.userCategory}` : "",
    input.fileName ? `Asset file name: ${input.fileName}` : "",
  ].filter(Boolean).join("\n");
}
