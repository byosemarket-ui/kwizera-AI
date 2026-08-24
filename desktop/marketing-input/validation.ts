import type {
  FieldValidation,
  MarketingCompleteness,
  MarketingConflict,
  MarketingInputFields,
} from "./types";
import { resolvedAudienceSummary, resolvedCta, resolvedLanguage, resolvedPlatforms } from "./types";

const SHORT_PLATFORMS = new Set(["TikTok", "Instagram", "WhatsApp"]);
const SALES_OBJECTIVES = /sales|promotion|launch|lead|traffic|order|buy/i;

export function validateMarketingFields(fields: MarketingInputFields): FieldValidation[] {
  const rows: FieldValidation[] = [];
  const push = (field: string, status: FieldValidation["status"], message: string) => {
    rows.push({ field, status, message });
  };

  if (!fields.objective.trim()) push("objective", "error", "Campaign objective is required.");
  else push("objective", "ok", "Campaign objective");

  if (!resolvedAudienceSummary(fields)) push("audience", "error", "Target audience is required.");
  else push("audience", "ok", "Target audience");

  if (!resolvedPlatforms(fields).length) push("platforms", "error", "Select at least one platform.");
  else push("platforms", "ok", "Platform");

  if (!fields.contentFormat.trim() || (fields.contentFormat === "Custom Format" && !fields.customFormat.trim())) {
    push("contentFormat", "error", "Content format is required.");
  } else push("contentFormat", "ok", "Content format");

  if (!resolvedLanguage(fields)) push("language", "error", "Language is required.");
  else push("language", "ok", "Language");

  if (fields.duration === "custom" && (fields.customDurationSeconds == null || fields.customDurationSeconds <= 0)) {
    push("duration", "error", "Custom duration needs a positive length in seconds.");
  } else push("duration", "ok", "Duration");

  const cta = resolvedCta(fields);
  if (SALES_OBJECTIVES.test(fields.objective) && !cta) {
    push("cta", "warning", "Sales-oriented campaigns usually need a CTA.");
  } else if (cta) push("cta", "ok", "CTA");
  else push("cta", "warning", "CTA is empty.");

  if (fields.promotionType && fields.promotionType !== "None" && !fields.promotionDetails.trim()) {
    push("promotion", "warning", "Promotion selected without promotion details.");
  } else if (fields.promotionType && fields.promotionType !== "None") {
    push("promotion", "ok", "Promotion");
  }

  if (fields.voiceLanguage && resolvedLanguage(fields)
    && fields.voiceLanguage !== resolvedLanguage(fields)
    && fields.language !== "Other") {
    push("voiceLanguage", "warning", "Voice language differs from campaign language.");
  }

  return rows;
}

export function detectConflicts(fields: MarketingInputFields): MarketingConflict[] {
  const conflicts: MarketingConflict[] = [];
  const platforms = resolvedPlatforms(fields);
  const shortHeavy = platforms.some((p) => SHORT_PLATFORMS.has(p) || /tiktok|instagram|whatsapp/i.test(p));
  if (shortHeavy && (fields.duration === "long" || (fields.duration === "custom" && (fields.customDurationSeconds ?? 0) > 60))) {
    conflicts.push({
      id: "platform-duration",
      code: "platform-duration",
      message: "Selected video duration may not match short-form platforms (TikTok / Instagram / WhatsApp).",
      severity: "warning",
      acknowledged: false,
    });
  }
  if (SALES_OBJECTIVES.test(fields.objective) && !resolvedCta(fields)) {
    conflicts.push({
      id: "missing-cta",
      code: "missing-cta",
      message: "Direct sales / promotion objectives usually need a clear CTA.",
      severity: "warning",
      acknowledged: false,
    });
  }
  if (fields.promotionType && fields.promotionType !== "None" && !fields.promotionDetails.trim()) {
    conflicts.push({
      id: "promotion-detail",
      code: "promotion-detail",
      message: "Promotion type is set but promotion details are empty. Never invent discount values.",
      severity: "warning",
      acknowledged: false,
    });
  }
  if (fields.voiceLanguage && resolvedLanguage(fields)
    && fields.voiceLanguage !== resolvedLanguage(fields)
    && fields.language !== "Other") {
    conflicts.push({
      id: "voice-language",
      code: "voice-language",
      message: "Voice language does not match campaign language.",
      severity: "warning",
      acknowledged: false,
    });
  }
  return conflicts;
}

export function computeMarketingCompleteness(fields: MarketingInputFields): MarketingCompleteness {
  const objective = fields.objective.trim() ? 100 : 0;
  const audienceChecks = [
    Boolean(fields.audienceType.trim() || fields.customerSegment.trim() || fields.audienceNotes.trim()),
    Boolean(fields.ageRange.trim() || fields.location.trim() || fields.interests.length),
    Boolean(fields.customerNeeds.trim() || fields.buyingIntent.trim()),
  ];
  const audience = Math.round((audienceChecks.filter(Boolean).length / audienceChecks.length) * 100);
  const platform = resolvedPlatforms(fields).length ? 100 : 0;
  const language = resolvedLanguage(fields) ? 100 : 0;
  const cta = resolvedCta(fields) ? 100 : 0;
  const promotion = !fields.promotionType || fields.promotionType === "None"
    ? 100
    : fields.promotionDetails.trim() ? 100 : 40;
  const overall = Math.round(
    objective * 0.22 + audience * 0.18 + platform * 0.18 + language * 0.18 + cta * 0.14 + promotion * 0.1,
  );

  const missingRecommended: string[] = [];
  if (!resolvedCta(fields)) missingRecommended.push("CTA");
  if (!fields.tone.trim()) missingRecommended.push("Tone");
  if (!fields.style.trim()) missingRecommended.push("Creative style");
  if (!fields.voiceLanguage.trim() && fields.narrationEnabled) missingRecommended.push("Voice language");
  if (fields.promotionType !== "None" && !fields.promotionDetails.trim()) missingRecommended.push("Promotion details");
  if (!fields.mood.trim()) missingRecommended.push("Mood");

  return { objective, audience, platform, language, cta, promotion, overall, missingRecommended };
}

export function buildLocalRecommendations(fields: MarketingInputFields, category: string): import("./types").AiRecommendation[] {
  const recs: import("./types").AiRecommendation[] = [];
  const cat = category.toLowerCase();

  if (!fields.platforms.length) {
    recs.push({
      field: "platforms",
      value: /shoe|apparel|fashion|bag/i.test(cat) ? ["Instagram", "TikTok"] : ["Facebook", "WhatsApp"],
      reason: "Category-aware short-form / social reach for product showcase.",
      confidence: 0.72,
      status: "pending",
    });
  }
  if (!fields.contentFormat) {
    recs.push({
      field: "contentFormat",
      value: "Short Product Video",
      reason: "Short product video fits most social platforms and later production stages.",
      confidence: 0.7,
      status: "pending",
    });
  }
  if (fields.duration === "automatic") {
    const preferShort = fields.platforms.some((p) => /tiktok|instagram/i.test(p));
    recs.push({
      field: "duration",
      value: preferShort ? "short" : "medium",
      reason: preferShort
        ? "Short duration aligns with TikTok/Instagram constraints."
        : "Medium duration suits multi-platform product introductions.",
      confidence: 0.68,
      status: "pending",
    });
  }
  if (!resolvedCta(fields)) {
    const sales = SALES_OBJECTIVES.test(fields.objective);
    recs.push({
      field: "cta",
      value: sales ? "Buy Now" : "Learn More",
      reason: sales ? "Sales objective benefits from a direct CTA." : "Soft CTA for awareness campaigns.",
      confidence: 0.74,
      status: "pending",
    });
  }
  if (!fields.tone || fields.tone === "Professional") {
    recs.push({
      field: "tone",
      value: /premium|luxury/i.test(cat) ? "Premium" : fields.objective.toLowerCase().includes("sales") ? "Direct Sales" : "Friendly",
      reason: "Tone suggestion based on category and objective — review before accepting.",
      confidence: 0.6,
      status: "pending",
    });
  }
  if (!fields.audienceType && !fields.audienceNotes) {
    recs.push({
      field: "audienceType",
      value: "Local online shoppers",
      reason: "Generic starter audience — refine with your real customers. AI does not invent demographics.",
      confidence: 0.55,
      status: "pending",
    });
  }
  return recs;
}
