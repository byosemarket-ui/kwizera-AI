import type {
  AiRecommendation,
  AuthoritativeBriefView,
  MarketingInputFields,
  ProvenanceClaimView,
} from "./types";

function formatIn(value: string): string {
  if (!value) return "";
  if (value === "SHORT_PRODUCT_VIDEO") return "Short Product Video";
  if (value === "PRODUCT_SHOWCASE") return "Product Showcase";
  if (value === "PRODUCT_INTRODUCTION") return "Product Introduction";
  return value.replace(/_/g, " ");
}

function formatOut(value: string): string {
  const v = value.trim();
  if (v === "Short Product Video") return "SHORT_PRODUCT_VIDEO";
  if (v === "Product Showcase") return "PRODUCT_SHOWCASE";
  if (v === "Product Introduction") return "PRODUCT_INTRODUCTION";
  return v;
}

function recStatusIn(status: string): AiRecommendation["status"] {
  if (status === "ACCEPTED") return "accepted";
  if (status === "REJECTED") return "rejected";
  if (status === "EDITED") return "edited";
  return "pending";
}

export function recommendationsFromBrief(brief: AuthoritativeBriefView): AiRecommendation[] {
  const recs = (brief as AuthoritativeBriefView & { recommendations?: Array<Record<string, unknown>> }).recommendations;
  if (!Array.isArray(recs)) return [];
  return recs.map((item) => ({
    id: String(item.id ?? item.field ?? ""),
    field: String(item.field ?? ""),
    label: String(item.label ?? item.field ?? ""),
    value: (item.value ?? "") as string | string[],
    reason: String(item.why ?? item.reason ?? ""),
    why: String(item.why ?? item.reason ?? ""),
    source: (item.source as AiRecommendation["source"]) ?? "INFERRED",
    reasoningBasis: String(item.reasoningBasis ?? ""),
    confidence: typeof item.confidence === "number" ? item.confidence : 0.5,
    status: recStatusIn(String(item.status ?? "PENDING")),
  }));
}

export function applyBriefToFields(fields: MarketingInputFields, brief: AuthoritativeBriefView): MarketingInputFields {
  const audience = (brief as AuthoritativeBriefView & { campaign: AuthoritativeBriefView["campaign"] & { audience?: { general?: string; location?: string; ageRange?: string; gender?: string; customerType?: string; interests?: string[] } } }).campaign;
  const aud = (audience as { audience?: { general?: string; location?: string; ageRange?: string; gender?: string; customerType?: string; interests?: string[] } }).audience;
  return {
    ...fields,
    objective: brief.campaign.objective || fields.objective,
    platforms: brief.campaign.platforms.length ? brief.campaign.platforms : fields.platforms,
    cta: brief.campaign.cta || fields.cta,
    tone: brief.campaign.tone || fields.tone,
    audienceType: aud?.general || fields.audienceType,
    location: aud?.location || fields.location,
    ageRange: aud?.ageRange || fields.ageRange,
    gender: aud?.gender || fields.gender,
    customerSegment: aud?.customerType || fields.customerSegment,
    interests: aud?.interests?.length ? aud.interests : fields.interests,
    aspectRatio: brief.output.aspectRatio || fields.aspectRatio,
    contentFormat: formatIn(brief.output.contentFormat) || fields.contentFormat,
    lockedFields: Array.from(new Set([...(fields.lockedFields ?? []), ...(brief.campaign.lockedFields ?? [])])),
  };
}

export function campaignPatchFromFields(fields: MarketingInputFields): Record<string, unknown> {
  return {
    campaign: {
      objective: fields.objective,
      platforms: fields.platforms.includes("Custom Platform") && fields.customPlatform.trim()
        ? fields.platforms.map((item) => item === "Custom Platform" ? fields.customPlatform.trim() : item)
        : fields.platforms,
      cta: fields.cta === "Custom CTA" ? fields.ctaCustom : fields.cta,
      tone: fields.tone,
      language: fields.language,
      audience: {
        general: fields.audienceType || fields.audienceNotes,
        location: fields.location,
        ageRange: fields.ageRange,
        gender: fields.gender,
        customerType: fields.customerSegment,
        interests: fields.interests,
      },
      lockedFields: fields.lockedFields ?? [],
    },
    output: {
      aspectRatio: fields.aspectRatio,
      duration: fields.duration === "custom" && fields.customDurationSeconds
        ? `${fields.customDurationSeconds}s`
        : fields.duration === "short" ? "15s"
          : fields.duration === "medium" ? "30s"
            : fields.duration === "long" ? "60s"
              : fields.duration === "automatic" ? ""
                : fields.duration,
      contentFormat: formatOut(fields.contentFormat === "Custom Format" ? fields.customFormat : fields.contentFormat),
    },
    userDefined: {
      style: fields.style,
      message: fields.campaignNotes,
    },
    lockFields: fields.lockedFields ?? [],
  };
}

export function claimText(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value && "text" in value) return String((value as ProvenanceClaimView).text ?? "");
  return "";
}
