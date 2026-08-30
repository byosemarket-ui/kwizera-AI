import type {
  CampaignSettings,
  MarketingIntelligenceBlock,
  OutputSettings,
  ProvenanceClaim,
  ResolvedMarketingCopy,
  BriefRecommendation,
} from "./types.js";
import { durationLabel, objectiveCodeFromLabel, suggestedOutputFromPlatforms } from "./platform-presets.js";

function nonempty(value: unknown): boolean {
  if (Array.isArray(value)) return value.filter((item) => String(item ?? "").trim()).length > 0;
  return String(value ?? "").trim().length > 0;
}

function asText(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean).join(", ");
  return String(value ?? "").trim();
}

/**
 * Priority: USER DEFINED > CONFIRMED product data > ACCEPTED AI > INFERENCE.
 * Pending and rejected recommendations are never passed in as `accepted`.
 */
export function resolveWithPriority(options: {
  field: string;
  userValue?: string | string[];
  confirmed?: string | string[];
  accepted?: string | string[];
  inferred?: string | string[];
  lockedFields: string[];
}): string | string[] {
  const user = options.userValue;
  if (nonempty(user)) return user as string | string[];
  if (nonempty(options.confirmed)) return options.confirmed as string | string[];
  if (nonempty(options.accepted)) return options.accepted as string | string[];
  if (nonempty(options.inferred)) return options.inferred as string | string[];
  return Array.isArray(user) ? [] : "";
}

function acceptedValue(recs: BriefRecommendation[], field: string): string | string[] | undefined {
  const rec = recs.find((item) => item.field === field && (item.status === "ACCEPTED" || item.status === "EDITED"));
  if (!rec) return undefined;
  return rec.status === "EDITED" && rec.editedValue != null ? rec.editedValue : rec.value;
}

function userOrLocked(
  field: string,
  stored: string,
  lockedFields: string[],
): string {
  return lockedFields.includes(field) ? stored : "";
}

function inferredUnlessRejected(
  field: string,
  inferred: string,
  recs: BriefRecommendation[],
): string {
  const rejected = recs.find((item) => item.field === field && item.status === "REJECTED");
  if (!rejected) return inferred;
  const rejectedText = asText(rejected.editedValue ?? rejected.value);
  return rejectedText === inferred ? "" : inferred;
}

export function resolveOutput(
  campaign: CampaignSettings,
  output: OutputSettings,
  recs: BriefRecommendation[],
): OutputSettings {
  const suggested = suggestedOutputFromPlatforms(campaign.platforms);
  const aspect = asText(resolveWithPriority({
    field: "aspectRatio",
    userValue: userOrLocked("aspectRatio", output.aspectRatio, campaign.lockedFields),
    accepted: acceptedValue(recs, "aspectRatio"),
    inferred: inferredUnlessRejected("aspectRatio", suggested.aspectRatio, recs),
    lockedFields: campaign.lockedFields,
  }));
  const duration = asText(resolveWithPriority({
    field: "duration",
    userValue: userOrLocked("duration", output.duration, campaign.lockedFields),
    accepted: acceptedValue(recs, "duration"),
    inferred: inferredUnlessRejected("duration", suggested.duration, recs),
    lockedFields: campaign.lockedFields,
  }));
  const contentFormat = asText(resolveWithPriority({
    field: "contentFormat",
    userValue: userOrLocked("contentFormat", output.contentFormat, campaign.lockedFields),
    accepted: acceptedValue(recs, "contentFormat"),
    inferred: inferredUnlessRejected("contentFormat", suggested.contentFormat, recs),
    lockedFields: campaign.lockedFields,
  }));
  const validAspect = aspect === "9:16" || aspect === "1:1" || aspect === "16:9" ? aspect : "";
  return {
    aspectRatio: validAspect,
    duration,
    contentFormat,
    pacing: output.pacing || suggested.pacing,
    hookStyle: output.hookStyle || suggested.hookStyle,
  };
}

export function resolveMarketingCopy(
  campaign: CampaignSettings,
  recs: BriefRecommendation[],
  intelligence: MarketingIntelligenceBlock | null,
  userDefined: Record<string, unknown>,
): ResolvedMarketingCopy {
  const userMain = asText(userDefined.mainSellingPoint as string | undefined);
  const confirmedMain = intelligence?.mainSellingPoint.source === "CONFIRMED"
    ? intelligence.mainSellingPoint.text
    : undefined;
  const acceptedMain = asText(acceptedValue(recs, "mainSellingPoint"));
  const mainText = asText(resolveWithPriority({
    field: "mainSellingPoint",
    userValue: userMain,
    confirmed: confirmedMain,
    accepted: acceptedMain,
    inferred: intelligence?.mainSellingPoint.text,
    lockedFields: campaign.lockedFields,
  }));

  let mainSellingPoint: ProvenanceClaim;
  if (userMain && mainText === userMain) {
    mainSellingPoint = { text: mainText, source: "USER_DEFINED", confidence: 1, reason: "Edited by the user" };
  } else if (intelligence?.mainSellingPoint && mainText === intelligence.mainSellingPoint.text) {
    mainSellingPoint = intelligence.mainSellingPoint;
  } else if (acceptedMain && mainText === acceptedMain) {
    mainSellingPoint = { text: mainText, source: "INFERRED", confidence: 0.8, reason: "Accepted AI recommendation" };
  } else {
    mainSellingPoint = intelligence?.mainSellingPoint ?? { text: mainText, source: "INFERRED", confidence: 0.5 };
  }

  const message = asText(resolveWithPriority({
    field: "message",
    userValue: asText(userDefined.message as string | undefined),
    accepted: asText(acceptedValue(recs, "message")),
    inferred: [intelligence?.positioning.text, intelligence?.mainSellingPoint.text].filter(Boolean).join(" — "),
    lockedFields: campaign.lockedFields,
  }));

  const cta = asText(resolveWithPriority({
    field: "cta",
    userValue: campaign.cta,
    accepted: acceptedValue(recs, "cta"),
    inferred: intelligence?.suggestedCta.text,
    lockedFields: campaign.lockedFields,
  })) || "DISCOVER_PRODUCT";

  const positioning = asText(resolveWithPriority({
    field: "positioning",
    userValue: asText(userDefined.positioning as string | undefined),
    accepted: acceptedValue(recs, "positioning"),
    inferred: intelligence?.positioning.text,
    lockedFields: campaign.lockedFields,
  }));

  const angle = asText(resolveWithPriority({
    field: "marketingAngle",
    userValue: asText(userDefined.angle as string | undefined),
    accepted: acceptedValue(recs, "marketingAngle"),
    inferred: intelligence?.marketingAngle.text,
    lockedFields: campaign.lockedFields,
  }));

  const userSupporting = Array.isArray(userDefined.supportingPoints)
    ? (userDefined.supportingPoints as unknown[]).map((item) => asText(item as string)).filter(Boolean)
    : [];
  const supportingPoints: ProvenanceClaim[] = userSupporting.length
    ? userSupporting.map((text) => ({ text, source: "USER_DEFINED" as const, confidence: 1 }))
    : intelligence?.supportingPoints ?? [];

  return {
    positioning,
    angle,
    mainSellingPoint: { ...mainSellingPoint, text: mainText || mainSellingPoint.text },
    supportingPoints,
    message: message || positioning,
    cta,
  };
}

export function applyAcceptedRecommendation(
  campaign: CampaignSettings,
  output: OutputSettings,
  rec: BriefRecommendation,
): { campaign: CampaignSettings; output: OutputSettings } {
  const value = rec.status === "EDITED" && rec.editedValue != null ? rec.editedValue : rec.value;
  const nextCampaign = {
    ...campaign,
    lockedFields: Array.from(new Set([...campaign.lockedFields, rec.field])),
  };
  const nextOutput = { ...output };
  if (rec.field === "objective") {
    const text = asText(value);
    nextCampaign.objective = text;
    nextCampaign.objectiveCode = objectiveCodeFromLabel(text);
  } else if (rec.field === "platforms") {
    nextCampaign.platforms = Array.isArray(value) ? value.map(String) : [asText(value)].filter(Boolean);
  } else if (rec.field === "cta") {
    nextCampaign.cta = asText(value);
  } else if (rec.field === "tone") {
    nextCampaign.tone = asText(value);
  } else if (rec.field === "audienceType") {
    nextCampaign.audience = { ...nextCampaign.audience, general: asText(value) };
  } else if (rec.field === "aspectRatio") {
    const ratio = asText(value);
    if (ratio === "9:16" || ratio === "1:1" || ratio === "16:9") nextOutput.aspectRatio = ratio;
  } else if (rec.field === "contentFormat") {
    nextOutput.contentFormat = asText(value);
  } else if (rec.field === "duration") {
    nextOutput.duration = durationLabel(asText(value), null) || asText(value);
  }
  return { campaign: nextCampaign, output: nextOutput };
}

export function emptyAudience(): CampaignSettings["audience"] {
  return {
    general: "",
    location: "",
    ageRange: "",
    gender: "",
    customerType: "",
    interests: [],
  };
}

export function emptyCampaign(): CampaignSettings {
  return {
    objective: "",
    objectiveCode: "PRODUCT_AWARENESS",
    platforms: [],
    audience: emptyAudience(),
    cta: "",
    tone: "",
    language: "",
    lockedFields: [],
  };
}

export function emptyOutput(): OutputSettings {
  return {
    aspectRatio: "",
    duration: "",
    contentFormat: "",
    pacing: "",
    hookStyle: "",
  };
}
