/** Build Master Marketing Strategy from Phase 2 brief + Phase 3 Master Intelligence. */

import type { MasterProductIntelligence, BenefitItem, ClaimSafetyEntry, InsightItem } from "../master-intelligence/types";
import type { MarketingProductionBrief } from "../marketing-input/types";
import {
  resolvedAudienceSummary,
  resolvedCta,
  resolvedFormat,
  resolvedLanguage,
  resolvedPlatforms,
} from "../marketing-input/types";
import type {
  AudienceProfile,
  CampaignObjectiveBlock,
  ClaimBuckets,
  CompetitivePositioning,
  ContentDirection,
  CreativeStrategy,
  CtaStrategy,
  LabeledInsight,
  LanguageVoiceStrategy,
  MarketingAngle,
  MarketingRisk,
  MasterMarketingStrategy,
  MessageStrategy,
  PlatformPlan,
  PositioningStatement,
  PromotionStrategy,
  RankedBenefit,
  RankedMotivation,
  StrategyClassification,
  StrategyConfidence,
  UspCandidate,
  ValueProposition,
} from "./types";

export interface AssembleStrategyInput {
  master: MasterProductIntelligence | null;
  brief: MarketingProductionBrief | null;
  keepUserSettings?: boolean;
  previous?: MasterMarketingStrategy | null;
  primaryAngleId?: string | null;
}

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function unknown(label: string): LabeledInsight {
  return {
    id: uid("unk"),
    label,
    detail: "UNKNOWN / NOT PROVIDED",
    evidence: "Not in Marketing Brief or Master Intelligence",
    classification: "UNKNOWN / NOT PROVIDED",
    confidence: 0,
  };
}

function orUnknown(value: string | undefined | null): string {
  const v = value?.trim();
  return v ? v : "UNKNOWN / NOT PROVIDED";
}

function pct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n <= 1) return Math.round(n * 100);
  return Math.round(n);
}

function avg(nums: number[], fallback = 0): number {
  if (!nums.length) return fallback;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function conf01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return n > 1 ? n / 100 : n;
}

function mapClaimClass(c: string): StrategyClassification {
  if (c === "VERIFIED FACT" || c === "USER PROVIDED") return c === "USER PROVIDED" ? "USER PROVIDED" : "VERIFIED";
  if (c === "RESEARCH SUPPORTED") return "RESEARCH SUPPORTED";
  if (c === "AI RECOMMENDATION" || c === "AI INFERENCE" || c === "VISUAL OBSERVATION") return "AI RECOMMENDATION";
  return "UNKNOWN / NOT PROVIDED";
}

function insightToLabeled(row: InsightItem, fallbackLabel: string): LabeledInsight {
  return {
    id: row.id || uid("ins"),
    label: row.label || fallbackLabel,
    detail: row.detail,
    evidence: row.evidence || row.source,
    classification: mapClaimClass(row.classification),
    confidence: conf01(row.confidence),
  };
}

const OBJECTIVE_HINTS: Record<string, string> = {
  "Direct Sales": "Lead with a verified benefit and a clear purchase CTA.",
  "Product Awareness": "Introduce the confirmed product identity; keep selling intensity moderate.",
  "Product Launch": "Emphasize newness only if the brief marks a launch or new arrival.",
  Promotion: "Use only configured promotion details — never invent offers.",
  "Brand Awareness": "Lead with brand feeling from the brief; avoid hard-sell claims.",
  Engagement: "Favor curiosity and demonstration over purchase pressure.",
  Traffic: "CTA should send people to a destination already in the brief.",
  "Lead Generation": "Ask for contact using the user CTA; do not invent lead magnets.",
  "New Arrival": "Use new-arrival framing only if promotion or objective says so.",
  "Seasonal Campaign": "Keep seasonal framing tied to user notes; do not invent seasons.",
};

export function recommendObjective(
  userObjective: string,
  promotionType: string,
): { recommendation: string | null; reason: string | null } {
  const obj = userObjective.trim();
  const promo = promotionType.trim();
  if (!obj) return { recommendation: "Product Awareness", reason: "No objective in the Marketing Brief — awareness is a safe default until the user chooses." };
  if (promo && promo !== "None" && obj === "Product Awareness") {
    return { recommendation: "Promotion", reason: "A promotion is configured; a Promotion objective may align better. User stays in control." };
  }
  if (obj === "Direct Sales" && (!promo || promo === "None")) {
    return { recommendation: null, reason: null };
  }
  return { recommendation: null, reason: null };
}

export function buildObjective(brief: MarketingProductionBrief | null, keepUser: boolean): CampaignObjectiveBlock {
  const userObjective = brief?.fields.objective.trim() || "";
  const rec = recommendObjective(userObjective, brief?.fields.promotionType || "None");
  const recDecision: CampaignObjectiveBlock["recDecision"] = keepUser || !rec.recommendation ? "kept-user" : "pending";
  return {
    userObjective: userObjective || "UNKNOWN / NOT PROVIDED",
    aiRecommendation: rec.recommendation,
    aiReason: rec.reason,
    recDecision,
    activeObjective: userObjective || "UNKNOWN / NOT PROVIDED",
  };
}

export function buildAudience(
  brief: MarketingProductionBrief | null,
  master: MasterProductIntelligence | null,
): AudienceProfile {
  const f = brief?.fields;
  const primary = orUnknown(resolvedAudienceSummary(f ?? emptyish()) || f?.audienceType);
  const secondary = orUnknown(f?.audienceNotes && f.audienceType ? f.audienceNotes : "");
  const pain = (master?.customerIntelligence ?? []).filter((i) => /pain|problem|objection|concern/i.test(i.label));
  const desire = (master?.customerIntelligence ?? []).filter((i) => /desire|want|need/i.test(i.label));
  const objections = (master?.customerIntelligence ?? []).filter((i) => /objection|concern/i.test(i.label));
  return {
    primaryAudience: primary,
    secondaryAudience: secondary === "UNKNOWN / NOT PROVIDED" && f?.customerSegment?.trim() && f.customerSegment !== f.audienceType
      ? f.customerSegment.trim()
      : secondary,
    ageRange: orUnknown(f?.ageRange),
    location: orUnknown(f?.location),
    interests: f?.interests?.length ? [...f.interests] : [],
    needs: orUnknown(f?.customerNeeds),
    painPoints: pain.length ? pain.map((p) => insightToLabeled(p, "Pain Point")) : [unknown("Pain Point")],
    desires: desire.length ? desire.map((d) => insightToLabeled(d, "Desire")) : [],
    buyingMotivation: orUnknown(f?.buyingIntent),
    buyingConcerns: objections.length ? objections.map((o) => insightToLabeled(o, "Buying Concern")) : [unknown("Buying Concern")],
    decisionFactors: (master?.customerIntelligence ?? [])
      .filter((i) => /decision|factor|expect/i.test(i.label))
      .map((i) => insightToLabeled(i, "Decision Factor")),
  };
}

function emptyish(): Parameters<typeof resolvedAudienceSummary>[0] {
  return {
    audienceType: "", customerSegment: "", ageRange: "", location: "", interests: [], audienceNotes: "",
    objective: "", gender: "", customerNeeds: "", buyingIntent: "", platforms: [], customPlatform: "",
    contentFormat: "", customFormat: "", duration: "automatic", customDurationSeconds: null,
    language: "", languageOther: "", voiceLanguage: "", voiceGender: "", voiceStyle: "", tone: "",
    narrationEnabled: false, customVoiceNotes: "", cta: "", ctaCustom: "", promotionType: "None",
    promotionDetails: "", style: "", mood: "", energy: "", visualPreference: "", backgroundPreference: "",
    brandFeeling: "", cameraPreference: "", musicPreference: "", campaignNotes: "", brandName: "",
    brandStyle: "", brandColors: "", brandVoice: "", brandGuidelines: "",
  };
}

export function buildCustomerProblem(
  audience: AudienceProfile,
  master: MasterProductIntelligence | null,
): LabeledInsight {
  const fromBrief = audience.needs !== "UNKNOWN / NOT PROVIDED" ? audience.needs : "";
  const fromIntel = audience.painPoints.find((p) => p.detail !== "UNKNOWN / NOT PROVIDED");
  const verifiedBenefit = master?.benefits.find((b) => b.classification === "VERIFIED FACT" || b.classification === "USER PROVIDED");
  if (fromBrief) {
    return {
      id: uid("prob"),
      label: "Customer Problem",
      detail: fromBrief,
      evidence: "Marketing Production Brief — customer needs",
      classification: "USER PROVIDED",
      confidence: 1,
    };
  }
  if (fromIntel) {
    return {
      id: uid("prob"),
      label: "Customer Problem",
      detail: fromIntel.detail,
      evidence: fromIntel.evidence,
      classification: fromIntel.classification === "USER PROVIDED" ? "USER PROVIDED" : fromIntel.classification,
      confidence: fromIntel.confidence,
    };
  }
  if (verifiedBenefit) {
    return {
      id: uid("prob"),
      label: "Customer Problem",
      detail: `Customers seeking ${verifiedBenefit.benefit.toLowerCase()} (inferred from a verified benefit — not a confirmed problem)`,
      evidence: verifiedBenefit.evidence,
      classification: "AI RECOMMENDATION",
      confidence: 0.45,
    };
  }
  return unknown("Customer Problem");
}

const DESIRE_BANK = ["Comfort", "Quality", "Performance", "Design", "Convenience", "Durability", "Affordability", "Lifestyle"];

export function buildDesires(
  audience: AudienceProfile,
  master: MasterProductIntelligence | null,
): LabeledInsight[] {
  const fromAudience = audience.desires.filter((d) => d.detail !== "UNKNOWN / NOT PROVIDED");
  if (fromAudience.length) return fromAudience;
  const fromResearch = (master?.customerIntelligence ?? [])
    .filter((i) => /desire|want|prefer/i.test(i.label + i.detail))
    .map((i) => insightToLabeled(i, "Desire"));
  if (fromResearch.length) return fromResearch;
  const category = master?.identity.category || "";
  if (!category) return [unknown("Customer Desire")];
  return [{
    id: uid("des"),
    label: "Possible desire",
    detail: DESIRE_BANK[0]!,
    evidence: `Category “${category}” — not guaranteed customer behavior`,
    classification: "AI RECOMMENDATION",
    confidence: 0.4,
  }];
}

export function rankMotivations(
  brief: MarketingProductionBrief | null,
  master: MasterProductIntelligence | null,
  problem: LabeledInsight,
): RankedMotivation[] {
  const rows: Array<Omit<RankedMotivation, "rank" | "id">> = [];
  const intent = brief?.fields.buyingIntent.trim();
  if (intent) {
    rows.push({
      motivation: intent,
      confidence: 1,
      band: "High",
      evidence: "User-selected buying intent in Marketing Brief",
      classification: "USER PROVIDED",
    });
  }
  const verified = master?.benefits.filter((b) => b.classification === "VERIFIED FACT" || b.classification === "USER PROVIDED") ?? [];
  for (const b of verified.slice(0, 3)) {
    rows.push({
      motivation: /price|afford/i.test(b.benefit) ? "Price" : /design|style/i.test(b.benefit) ? "Design" : /comfort/i.test(b.benefit) ? "Convenience" : "Quality",
      confidence: b.confidence,
      band: conf01(b.confidence) >= 0.8 ? "High" : conf01(b.confidence) >= 0.55 ? "Medium" : "Low",
      evidence: b.evidence,
      classification: "VERIFIED",
    });
  }
  if (problem.classification === "USER PROVIDED" || problem.classification === "VERIFIED") {
    rows.push({
      motivation: "Problem solving",
      confidence: problem.confidence,
      band: conf01(problem.confidence) >= 0.8 ? "High" : "Medium",
      evidence: problem.evidence,
      classification: problem.classification,
    });
  }
  if (brief?.fields.brandName.trim() || master?.verifiedFacts.brand) {
    rows.push({
      motivation: "Brand",
      confidence: 0.7,
      band: "Medium",
      evidence: "Brand present in profile/brief",
      classification: "USER PROVIDED",
    });
  }
  const seen = new Set<string>();
  const unique = rows.filter((r) => {
    const k = r.motivation.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  unique.sort((a, b) => b.confidence - a.confidence);
  if (!unique.length) {
    return [{
      id: uid("mot"),
      rank: 1,
      motivation: "Need",
      confidence: 0,
      band: "Low",
      evidence: "UNKNOWN / NOT PROVIDED",
      classification: "UNKNOWN / NOT PROVIDED",
    }];
  }
  return unique.map((r, i) => ({ ...r, id: uid("mot"), rank: i + 1 }));
}

export function buildPositioning(
  audience: AudienceProfile,
  problem: LabeledInsight,
  master: MasterProductIntelligence | null,
  benefits: RankedBenefit[],
): PositioningStatement {
  const product = master?.verifiedFacts.productName || master?.identity.name || "this product";
  const primary = benefits.find((b) => b.role === "PRIMARY");
  const reason = primary?.evidence || master?.verifiedFacts.materials.join(", ") || master?.verifiedFacts.description || "confirmed product characteristics";
  const classification: StrategyClassification = primary?.classification === "VERIFIED" || primary?.classification === "USER PROVIDED"
    ? primary.classification
    : problem.classification === "UNKNOWN / NOT PROVIDED"
      ? "AI RECOMMENDATION"
      : problem.classification;
  const need = problem.detail !== "UNKNOWN / NOT PROVIDED" ? problem.detail : audience.needs;
  return {
    forAudience: audience.primaryAudience,
    whoNeed: need,
    thisProduct: product,
    provides: primary?.benefit || orUnknown(master?.verifiedFacts.description),
    because: reason,
    supportedBy: reason,
    classification,
    confidence: avg([
      audience.primaryAudience === "UNKNOWN / NOT PROVIDED" ? 0.3 : 0.9,
      conf01(primary?.confidence ?? 0.4),
      problem.classification === "UNKNOWN / NOT PROVIDED" ? 0.3 : conf01(problem.confidence),
    ]),
  };
}

export function buildValueProposition(positioning: PositioningStatement, audience: AudienceProfile): ValueProposition {
  const statement = positioning.provides !== "UNKNOWN / NOT PROVIDED"
    ? `${positioning.thisProduct} helps ${positioning.forAudience} with ${positioning.provides}.`
    : `Why the customer should care is not yet supported by a verified benefit.`;
  return {
    statement,
    whyCare: positioning.whoNeed !== "UNKNOWN / NOT PROVIDED"
      ? `It addresses: ${positioning.whoNeed}`
      : "Customer need is UNKNOWN / NOT PROVIDED — do not over-claim.",
    productBenefit: positioning.provides,
    customerNeed: audience.needs,
    evidence: positioning.supportedBy,
    classification: positioning.classification,
    confidence: positioning.confidence,
  };
}

const SUPERIORITY = /\b(only|best|#1|number one|unmatched|nothing else)\b/i;

export function buildUspCandidates(
  master: MasterProductIntelligence | null,
  positioning: PositioningStatement,
): UspCandidate[] {
  const candidates: UspCandidate[] = [];
  const diffs = master?.differentiators ?? [];
  for (const d of diffs.slice(0, 4)) {
    const superiority = SUPERIORITY.test(d.value);
    candidates.push({
      id: d.id || uid("usp"),
      statement: superiority ? `${d.value} (do not use as a uniqueness claim)` : d.value,
      supportingEvidence: d.evidence,
      marketRelevance: "Category context from Product Intelligence — not proven uniqueness",
      customerRelevance: positioning.whoNeed,
      confidence: conf01(d.confidence),
      classification: d.classification === "VERIFIED DIFFERENTIATOR" ? "VERIFIED" : d.classification === "MARKETING RECOMMENDATION" ? "AI RECOMMENDATION" : "RESEARCH SUPPORTED",
      superiorityClaim: superiority,
    });
  }
  const verified = master?.benefits.filter((b) => b.classification === "VERIFIED FACT" || b.classification === "USER PROVIDED") ?? [];
  for (const b of verified.slice(0, 2)) {
    candidates.push({
      id: b.id,
      statement: b.benefit,
      supportingEvidence: b.evidence,
      marketRelevance: "Product-specific verified benefit",
      customerRelevance: positioning.whoNeed,
      confidence: conf01(b.confidence),
      classification: "VERIFIED",
      superiorityClaim: SUPERIORITY.test(b.benefit),
    });
  }
  if (!candidates.length) {
    candidates.push({
      id: uid("usp"),
      statement: `${positioning.thisProduct} as described in the Product Profile`,
      supportingEvidence: "No verified differentiator — candidate only",
      marketRelevance: "UNKNOWN / NOT PROVIDED",
      customerRelevance: positioning.whoNeed,
      confidence: 0.3,
      classification: "AI RECOMMENDATION",
      superiorityClaim: false,
    });
  }
  return candidates;
}

export function buildAngles(input: {
  audience: AudienceProfile;
  problem: LabeledInsight;
  benefits: RankedBenefit[];
  master: MasterProductIntelligence | null;
  brief: MarketingProductionBrief | null;
  platforms: string[];
}): MarketingAngle[] {
  const audience = input.audience.primaryAudience;
  const platform = input.platforms[0] || "UNKNOWN / NOT PROVIDED";
  const feature = input.master?.features.find((f) => f.classification === "USER PROVIDED" || f.classification === "VERIFIED FACT")
    || input.master?.features[0];
  const benefit = input.benefits[0];
  const promo = input.brief?.fields.promotionType;
  const names: Array<{ name: string; message: string; classification: StrategyClassification; confidence: number }> = [
    {
      name: "Problem → Solution",
      message: input.problem.detail !== "UNKNOWN / NOT PROVIDED"
        ? `Address “${input.problem.detail}” with ${benefit?.benefit || "the confirmed product"}.`
        : "Do not invent a problem to force this angle.",
      classification: input.problem.classification === "UNKNOWN / NOT PROVIDED" ? "AI RECOMMENDATION" : input.problem.classification,
      confidence: input.problem.classification === "UNKNOWN / NOT PROVIDED" ? 0.3 : conf01(input.problem.confidence),
    },
    {
      name: "Product Feature → Benefit",
      message: feature && benefit
        ? `${feature.value} supports ${benefit.benefit}.`
        : "Need a confirmed feature and benefit.",
      classification: benefit?.classification === "VERIFIED" ? "VERIFIED" : "AI RECOMMENDATION",
      confidence: avg([conf01(feature?.confidence ?? 0.4), conf01(benefit?.confidence ?? 0.4)]),
    },
    {
      name: "Lifestyle",
      message: "Show everyday use without inventing lifestyle claims.",
      classification: "AI RECOMMENDATION",
      confidence: 0.55,
    },
    {
      name: "Quality",
      message: benefit?.classification === "VERIFIED" ? `Lead with verified ${benefit.benefit}.` : "Quality angle only if a verified quality-related benefit exists.",
      classification: benefit?.classification === "VERIFIED" ? "VERIFIED" : "AI RECOMMENDATION",
      confidence: benefit?.classification === "VERIFIED" ? conf01(benefit.confidence) : 0.35,
    },
    {
      name: "Design",
      message: input.master?.visualIntelligence.color
        ? `Emphasize confirmed appearance (${input.master.visualIntelligence.color}).`
        : "Design angle using confirmed visual characteristics only.",
      classification: input.master?.visualIntelligence.color ? "VERIFIED" : "AI RECOMMENDATION",
      confidence: input.master ? 0.7 : 0.4,
    },
    {
      name: "Demonstration",
      message: "Show the product clearly from available views.",
      classification: "AI RECOMMENDATION",
      confidence: 0.65,
    },
    {
      name: "Educational",
      message: "Teach from verified facts and labeled research.",
      classification: "AI RECOMMENDATION",
      confidence: 0.6,
    },
    {
      name: "Promotion",
      message: promo && promo !== "None"
        ? `Use only the configured promotion: ${promo}.`
        : "No promotion configured — do not use a promotional angle as fact.",
      classification: promo && promo !== "None" ? "USER PROVIDED" : "AI RECOMMENDATION",
      confidence: promo && promo !== "None" ? 0.9 : 0.2,
    },
  ];
  return names
    .map((n, i) => ({
      id: uid("ang"),
      name: n.name,
      customerProblem: input.problem.detail,
      productFeature: feature?.value || "UNKNOWN / NOT PROVIDED",
      productBenefit: benefit?.benefit || "UNKNOWN / NOT PROVIDED",
      message: n.message,
      audience,
      evidence: feature?.evidence || benefit?.evidence || input.problem.evidence,
      confidence: n.confidence,
      recommendedPlatform: platform,
      classification: n.classification,
      rank: i + 1,
    }))
    .sort((a, b) => b.confidence - a.confidence)
    .map((a, i) => ({ ...a, rank: i + 1 }));
}

export function selectPrimaryAngle(
  angles: MarketingAngle[],
  objective: string,
  previousId?: string | null,
): string | null {
  if (previousId && angles.some((a) => a.id === previousId)) return previousId;
  const obj = objective.toLowerCase();
  const prefer = (name: string) => angles.find((a) => a.name === name && a.confidence >= 0.45);
  if (/promo|sale|discount/i.test(obj)) return prefer("Promotion")?.id || angles[0]?.id || null;
  if (/aware|brand/i.test(obj)) return prefer("Lifestyle")?.id || prefer("Educational")?.id || angles[0]?.id || null;
  if (/launch|arrival|new/i.test(obj)) return prefer("Product Feature → Benefit")?.id || angles[0]?.id || null;
  if (/sales|lead|traffic/i.test(obj)) return prefer("Problem → Solution")?.id || prefer("Product Feature → Benefit")?.id || angles[0]?.id || null;
  return angles[0]?.id || null;
}

export function buildMessage(
  primary: MarketingAngle | undefined,
  value: ValueProposition,
  cta: string,
  claims: ClaimBuckets,
): MessageStrategy {
  const proof = claims.approved.slice(0, 4).map((c) => c.claim);
  return {
    mainMessage: primary?.message || value.statement,
    supportingMessages: [
      value.whyCare,
      primary?.productBenefit && primary.productBenefit !== "UNKNOWN / NOT PROVIDED" ? `Benefit: ${primary.productBenefit}` : "",
    ].filter(Boolean),
    proofPoints: proof.length ? proof : ["No approved claims yet — do not invent proof."],
    emotionalMessage: primary?.name === "Lifestyle" ? "Belonging and everyday ease — without invented lifestyle facts." : "Keep emotion secondary to verified product truth.",
    functionalMessage: primary?.productFeature !== "UNKNOWN / NOT PROVIDED"
      ? `The product includes: ${primary?.productFeature}`
      : value.productBenefit,
    ctaMessage: cta && cta !== "UNKNOWN / NOT PROVIDED" ? cta : "CTA not configured",
    note: "Message framework only — not a final script.",
  };
}

export function prioritizeBenefits(master: MasterProductIntelligence | null): RankedBenefit[] {
  const list = master?.benefits ?? [];
  const scored = list.map((b) => ({
    b,
    score: (b.classification === "VERIFIED FACT" || b.classification === "USER PROVIDED" ? 2 : 0) + conf01(b.confidence),
  })).sort((a, c) => c.score - a.score);
  return scored.map((s, i) => ({
    id: s.b.id,
    role: i === 0 ? "PRIMARY" : i === 1 ? "SECONDARY" : "SUPPORTING",
    benefit: s.b.benefit,
    evidence: s.b.evidence,
    classification: mapBenefitClass(s.b),
    confidence: conf01(s.b.confidence),
  }));
}

function mapBenefitClass(b: BenefitItem): StrategyClassification {
  if (b.classification === "VERIFIED FACT") return "VERIFIED";
  if (b.classification === "USER PROVIDED") return "USER PROVIDED";
  if (b.classification === "RESEARCH SUPPORTED") return "RESEARCH SUPPORTED";
  if (b.classification === "UNKNOWN") return "UNKNOWN / NOT PROVIDED";
  return "AI RECOMMENDATION";
}

export function buildPlatformPlans(
  brief: MarketingProductionBrief | null,
  primary: MarketingAngle | undefined,
  creative: CreativeStrategy,
): PlatformPlan[] {
  const platforms = brief ? resolvedPlatforms(brief.fields) : [];
  const format = brief ? resolvedFormat(brief.fields) : "";
  const duration = brief?.fields.duration || "automatic";
  if (!platforms.length) {
    return [{
      platform: "UNKNOWN / NOT PROVIDED",
      contentDirection: "Strategy only — no platform selected.",
      messagingIntensity: "Unknown",
      ctaEmphasis: "Unknown",
      audienceConsideration: "Unknown",
      formatConsideration: format || "UNKNOWN / NOT PROVIDED",
      durationConsideration: duration,
      visualEmphasis: creative.visualEmphasis,
    }];
  }
  return platforms.map((platform) => {
    const shortForm = /tiktok|reels|shorts|whatsapp/i.test(platform);
    return {
      platform,
      contentDirection: primary?.name || "Product Showcase",
      messagingIntensity: /sales|promo/i.test(primary?.name || "") ? "High" : shortForm ? "Fast and clear" : "Measured",
      ctaEmphasis: shortForm ? "Early, spoken + on-screen if the brief allows" : "Close with the user CTA",
      audienceConsideration: `Honor the selected audience on ${platform}`,
      formatConsideration: format || (shortForm ? "Short vertical" : "Platform-native"),
      durationConsideration: duration === "custom" && brief?.fields.customDurationSeconds
        ? `${brief.fields.customDurationSeconds}s`
        : duration,
      visualEmphasis: creative.visualEmphasis,
    };
  });
}

export function buildLanguageVoice(brief: MarketingProductionBrief | null): LanguageVoiceStrategy {
  const language = brief ? resolvedLanguage(brief.fields) : "UNKNOWN / NOT PROVIDED";
  const tone = brief?.fields.tone.trim() || "UNKNOWN / NOT PROVIDED";
  const voice = [
    brief?.fields.voiceLanguage,
    brief?.fields.voiceGender,
    brief?.fields.voiceStyle,
  ].filter((x) => x && x.trim()).join(" · ") || "UNKNOWN / NOT PROVIDED";
  const kinya = /kinyarwanda/i.test(language);
  const english = /english/i.test(language);
  const sales = /direct sales|energetic/i.test(tone) ? "Higher" : /minimal|professional/i.test(tone) ? "Lower" : "Moderate";
  return {
    language,
    voice,
    tone,
    communicationStyle: kinya ? "Natural, clear, persuasive." : english ? "Professional, concise, modern." : "Match the user-selected language.",
    vocabularyLevel: kinya ? "Everyday spoken Kinyarwanda" : "Accessible professional",
    emotionalTone: brief?.fields.mood.trim() || tone,
    salesIntensity: sales,
    professionalism: /premium|professional/i.test(tone) ? "High" : "Balanced",
    note: "Do not translate a final script in this step.",
  };
}

export function evaluateCta(
  brief: MarketingProductionBrief | null,
  objective: string,
  keepUser: boolean,
): CtaStrategy {
  const userCta = brief ? (resolvedCta(brief.fields) || "") : "";
  const obj = objective.toLowerCase();
  let rec: string | null = null;
  let note = "CTA taken from the Marketing Brief.";
  let aligned = true;
  if (!userCta) {
    aligned = false;
    note = "No CTA configured.";
    rec = /aware|brand|engage/i.test(obj) ? "Learn More" : "Shop Now";
  } else if (/aware|brand/i.test(obj) && /buy|order|shop/i.test(userCta)) {
    aligned = false;
    note = "A purchase CTA may be stronger than needed for an awareness objective.";
    rec = "Learn More";
  } else if (/sales|promo/i.test(obj) && /learn more/i.test(userCta)) {
    aligned = false;
    note = "A softer CTA may under-serve a sales objective.";
    rec = "Buy Now";
  }
  return {
    userCta: userCta || "UNKNOWN / NOT PROVIDED",
    aligned,
    alignmentNote: note,
    aiRecommendation: rec,
    recDecision: keepUser || !rec ? "kept-user" : "pending",
    activeCta: userCta || "UNKNOWN / NOT PROVIDED",
  };
}

export function buildPromotion(brief: MarketingProductionBrief | null, keepUser: boolean): PromotionStrategy {
  const type = brief?.fields.promotionType?.trim() || "None";
  const details = brief?.fields.promotionDetails.trim() || "";
  const configured = Boolean(type && type !== "None");
  return {
    configured,
    type: configured ? type : "None",
    details: configured ? details : "",
    status: configured ? "CONFIGURED" : "NO PROMOTION CONFIGURED",
    aiRecommendation: configured ? null : "A promotion may be added later in the Marketing Brief if the campaign needs an offer. Do not invent one.",
    recDecision: keepUser ? "kept-user" : "pending",
  };
}

export function buildCompetitive(master: MasterProductIntelligence | null): CompetitivePositioning {
  const rows = master?.competitiveIntelligence ?? [];
  if (!rows.length) {
    return {
      commonMessages: [],
      commonClaims: [],
      commonValueProps: [],
      differentiationOpportunities: [unknown("Differentiation")],
      note: "No competitive intelligence available. Do not invent competitor claims. Do not copy competitor wording.",
    };
  }
  return {
    commonMessages: rows.filter((r) => /message|position|angle/i.test(r.label)).map((r) => r.detail).slice(0, 6),
    commonClaims: rows.filter((r) => /claim|benefit/i.test(r.label)).map((r) => r.detail).slice(0, 6),
    commonValueProps: rows.filter((r) => /value|proposition|position/i.test(r.label)).map((r) => r.detail).slice(0, 6),
    differentiationOpportunities: (master?.differentiators ?? []).slice(0, 5).map((d) => ({
      id: d.id,
      label: "Differentiation opportunity",
      detail: d.value,
      evidence: d.evidence,
      classification: d.classification === "VERIFIED DIFFERENTIATOR" ? "VERIFIED" : "AI RECOMMENDATION",
      confidence: conf01(d.confidence),
    })),
    note: "Strategic understanding only — do not copy competitor advertising language.",
  };
}

export function buildContentDirection(
  primary: MarketingAngle | undefined,
  objective: string,
  opportunities: MasterProductIntelligence["contentOpportunities"] | undefined,
): ContentDirection {
  const fromOpp = (opportunities ?? []).map((o) => o.name);
  const primaryName = primary?.name === "Problem → Solution" ? "Problem/Solution"
    : primary?.name === "Product Feature → Benefit" ? "Feature Demonstration"
    : primary?.name === "Demonstration" ? "Product Showcase"
    : primary?.name === "Promotion" ? "Promotional"
    : primary?.name === "Educational" ? "Educational"
    : primary?.name === "Lifestyle" ? "Lifestyle"
    : "Product Showcase";
  const alts = [...new Set(["Product Showcase", "Feature Demonstration", "Lifestyle", "Educational", "Promotional", ...fromOpp])]
    .filter((n) => n !== primaryName)
    .slice(0, 5);
  return {
    primary: primaryName,
    alternatives: alts,
    note: /launch/i.test(objective) ? "Product Introduction is also appropriate for a launch objective." : "Do not generate scenes in this step.",
  };
}

export function buildCreative(
  brief: MarketingProductionBrief | null,
  master: MasterProductIntelligence | null,
): CreativeStrategy {
  const f = brief?.fields;
  const c = master?.creativeDirection;
  return {
    visualMood: f?.mood.trim() || c?.mood || "UNKNOWN / NOT PROVIDED",
    emotionalMood: f?.brandFeeling.trim() || c?.brandFeeling || f?.mood.trim() || "UNKNOWN / NOT PROVIDED",
    energy: f?.energy.trim() || c?.energy || "UNKNOWN / NOT PROVIDED",
    productPresentation: c?.productPresentation || "Keep the product clearly visible",
    visualEmphasis: c?.visualEmphasis || f?.visualPreference.trim() || "Confirmed product identity",
    brandFeeling: f?.brandFeeling.trim() || c?.brandFeeling || "UNKNOWN / NOT PROVIDED",
    storytellingStyle: "Strategic direction only — scene plan belongs to Step 2.",
    cameraStyleDirection: f?.cameraPreference.trim() || c?.cameraOpportunities[0] || "UNKNOWN / NOT PROVIDED",
    audioStyleDirection: [f?.musicPreference, f?.voiceStyle].filter((x) => x && x.trim()).join(" · ") || "UNKNOWN / NOT PROVIDED",
    note: "Preliminary creative strategy — not a storyboard.",
  };
}

export function bucketClaims(entries: ClaimSafetyEntry[] | undefined): ClaimBuckets {
  const list = entries ?? [];
  return {
    approved: list.filter((c) => c.status === "SAFE / VERIFIED" && c.userDecision !== "avoid"),
    requiringReview: list.filter((c) => c.status === "SUPPORTED BUT REVIEW"),
    unverified: list.filter((c) => c.status === "UNVERIFIED"),
    prohibited: list.filter((c) => c.status === "DO NOT USE" || c.userDecision === "avoid"),
  };
}

export function detectRisks(input: {
  audience: AudienceProfile;
  problem: LabeledInsight;
  cta: CtaStrategy;
  promotion: PromotionStrategy;
  claims: ClaimBuckets;
  master: MasterProductIntelligence | null;
  platforms: PlatformPlan[];
  objective: string;
}): MarketingRisk[] {
  const risks: MarketingRisk[] = [];
  if (input.claims.prohibited.length || input.claims.unverified.length) {
    risks.push({
      id: uid("risk"),
      title: "Unsupported product claim",
      detail: `${input.claims.prohibited.length} prohibited and ${input.claims.unverified.length} unverified claims must not be used.`,
      level: input.claims.prohibited.length ? "HIGH" : "MEDIUM",
    });
  }
  if (input.problem.classification === "UNKNOWN / NOT PROVIDED") {
    risks.push({
      id: uid("risk"),
      title: "Missing evidence",
      detail: "No supported customer problem. Do not invent one in later scripts.",
      level: "MEDIUM",
    });
  }
  if (!input.cta.aligned || input.cta.userCta === "UNKNOWN / NOT PROVIDED") {
    risks.push({
      id: uid("risk"),
      title: "Weak CTA",
      detail: input.cta.alignmentNote,
      level: input.cta.userCta === "UNKNOWN / NOT PROVIDED" ? "MEDIUM" : "LOW",
    });
  }
  if (input.audience.primaryAudience === "UNKNOWN / NOT PROVIDED") {
    risks.push({
      id: uid("risk"),
      title: "Audience mismatch",
      detail: "Primary audience was not provided.",
      level: "MEDIUM",
    });
  }
  if (input.platforms.some((p) => p.platform === "UNKNOWN / NOT PROVIDED")) {
    risks.push({
      id: uid("risk"),
      title: "Platform mismatch",
      detail: "No platform selected in the Marketing Brief.",
      level: "MEDIUM",
    });
  }
  if (/\bpromotion\b|\bdiscount\b|seasonal/i.test(input.objective) && !input.promotion.configured) {
    risks.push({
      id: uid("risk"),
      title: "Promotion inconsistency",
      detail: "Objective suggests a promotion, but NO PROMOTION CONFIGURED.",
      level: "MEDIUM",
    });
  }
  const lowFeat = (input.master?.features ?? []).filter((f) => conf01(f.confidence) < 0.5);
  if (lowFeat.length) {
    risks.push({
      id: uid("risk"),
      title: "Low-confidence product feature",
      detail: `${lowFeat.length} feature(s) are low confidence — do not treat as specs.`,
      level: "LOW",
    });
  }
  const stale = (input.master?.sources ?? []).filter((s) => s.freshness === "STALE" || s.freshness === "AGING");
  if (stale.length) {
    risks.push({
      id: uid("risk"),
      title: "Outdated market research",
      detail: `${stale.length} source(s) are aging or stale.`,
      level: "LOW",
    });
  }
  return risks;
}

export function computeConfidence(input: {
  audience: AudienceProfile;
  positioning: PositioningStatement;
  angles: MarketingAngle[];
  master: MasterProductIntelligence | null;
  objective: string;
  claims: ClaimBuckets;
}): StrategyConfidence {
  const audience = input.audience.primaryAudience === "UNKNOWN / NOT PROVIDED" ? 0.35 : input.audience.ageRange === "UNKNOWN / NOT PROVIDED" ? 0.8 : 0.92;
  const productPositioning = input.positioning.confidence;
  const marketingAngle = input.angles[0] ? conf01(input.angles[0].confidence) : 0.3;
  const marketContext = input.master
    ? conf01(input.master.sectionConfidence.marketIntelligence) || conf01(input.master.scores.marketIntelligence / 100)
    : 0.25;
  const campaignClarity = input.objective && input.objective !== "UNKNOWN / NOT PROVIDED" ? 0.9 : 0.4;
  const evidenceQuality = input.claims.approved.length
    ? Math.min(1, 0.55 + input.claims.approved.length * 0.08)
    : 0.35;
  const overall = avg([audience, productPositioning, marketingAngle, marketContext, campaignClarity, evidenceQuality]);
  return {
    audience: pct(audience),
    productPositioning: pct(productPositioning),
    marketingAngle: pct(marketingAngle),
    marketContext: pct(marketContext),
    campaignClarity: pct(campaignClarity),
    evidenceQuality: pct(evidenceQuality),
    overall: pct(overall),
    explanation: [
      `Audience ${pct(audience)}% from the Marketing Brief (unknown fields stay labeled).`,
      `Positioning ${pct(productPositioning)}% from verified benefits and stated needs.`,
      `Angle ${pct(marketingAngle)}% from ranked marketing angles.`,
      `Market context ${pct(marketContext)}% from Master Intelligence.`,
      "Confidence is diagnostic and does not replace user confirmation.",
    ].join(" "),
  };
}

/** v1.0 then v1.1, v1.2… Preserve confirmed packages; never reuse a version number. */
export function bumpStrategyVersion(previous: MasterMarketingStrategy | null): { versionLabel: string; versionNumber: number } {
  if (!previous) return { versionLabel: "v1.0", versionNumber: 1 };
  const next = previous.versionNumber + 1;
  return { versionLabel: `v1.${next - 1}`, versionNumber: next };
}

export function assembleMarketingStrategy(input: AssembleStrategyInput): MasterMarketingStrategy {
  const master = input.master;
  const brief = input.brief;
  const keep = Boolean(input.keepUserSettings);
  const objective = buildObjective(brief, keep);
  const audience = buildAudience(brief, master);
  const customerProblem = buildCustomerProblem(audience, master);
  const customerDesire = buildDesires(audience, master);
  const benefits = prioritizeBenefits(master);
  const buyingMotivations = rankMotivations(brief, master, customerProblem);
  const positioning = buildPositioning(audience, customerProblem, master, benefits);
  const valueProposition = buildValueProposition(positioning, audience);
  const uspCandidates = buildUspCandidates(master, positioning);
  const claims = bucketClaims(master?.claimSafety);
  const cta = evaluateCta(brief, objective.activeObjective, keep);
  const promotion = buildPromotion(brief, keep);
  const creative = buildCreative(brief, master);
  const platformsList = brief ? resolvedPlatforms(brief.fields) : [];
  const angles = buildAngles({
    audience,
    problem: customerProblem,
    benefits,
    master,
    brief,
    platforms: platformsList,
  });
  const primaryAngleId = selectPrimaryAngle(angles, objective.activeObjective, input.primaryAngleId);
  const primary = angles.find((a) => a.id === primaryAngleId);
  const platforms = buildPlatformPlans(brief, primary, creative);
  const languageVoice = buildLanguageVoice(brief);
  const competitive = buildCompetitive(master);
  const contentDirection = buildContentDirection(primary, objective.activeObjective, master?.contentOpportunities);
  const message = buildMessage(primary, valueProposition, cta.activeCta, claims);
  const risks = detectRisks({
    audience,
    problem: customerProblem,
    cta,
    promotion,
    claims,
    master,
    platforms,
    objective: objective.activeObjective,
  });
  const confidence = computeConfidence({
    audience,
    positioning,
    angles,
    master,
    objective: objective.activeObjective,
    claims,
  });
  const ver = bumpStrategyVersion(input.previous ?? null);
  const projectId = master?.projectId || brief?.projectId || "unknown";
  const productId = master?.productId || brief?.productId || projectId;
  const now = new Date().toISOString();
  const history = [
    ...(input.previous?.history ?? []),
    ...(input.previous
      ? [{ versionLabel: input.previous.versionLabel, strategyId: input.previous.strategyId, createdAt: input.previous.updatedAt, status: input.previous.status }]
      : []),
  ];
  return {
    version: 1,
    strategyId: uid("mstrat"),
    versionLabel: ver.versionLabel,
    versionNumber: ver.versionNumber,
    engineId: "kwizera.marketing-strategy.v1",
    projectId,
    productId,
    projectName: master?.projectName || brief?.projectName || "",
    productName: master?.productName || master?.verifiedFacts.productName || "",
    refs: {
      projectId,
      productId,
      masterIntelligenceId: master?.masterId ?? null,
      marketingBriefId: brief?.marketingBriefId ?? null,
      researchPackageId: master?.refs.researchId ?? null,
    },
    objective,
    audience,
    customerProblem,
    customerDesire,
    buyingMotivations,
    positioning,
    valueProposition,
    uspCandidates,
    angles,
    primaryAngleId,
    message,
    benefits,
    platforms,
    languageVoice,
    cta,
    promotion,
    competitive,
    contentDirection,
    creative,
    claims,
    restrictions: master?.restrictions ?? [],
    risks,
    confidence,
    keepUserSettings: keep,
    userConfirmed: false,
    confirmedAt: null,
    readyForCreativePlanning: false,
    history,
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };
}

export function buildAiMeStrategyExplanation(pkg: MasterMarketingStrategy): string {
  const primary = pkg.angles.find((a) => a.id === pkg.primaryAngleId);
  const avoid = pkg.claims.prohibited.slice(0, 3).map((c) => c.claim);
  return [
    `The primary strategy is ${pkg.objective.activeObjective} (user objective: ${pkg.objective.userObjective}${pkg.objective.aiRecommendation ? `; AI recommendation ${pkg.objective.aiRecommendation} is ${pkg.objective.recDecision}` : ""}).`,
    `The selected audience is ${pkg.audience.primaryAudience}.`,
    pkg.customerProblem.detail !== "UNKNOWN / NOT PROVIDED"
      ? `The problem we may address is “${pkg.customerProblem.detail}” (${pkg.customerProblem.classification}).`
      : "No supported customer problem was provided.",
    primary ? `The primary angle is ${primary.name}: ${primary.message}` : "",
    `Value proposition: ${pkg.valueProposition.statement}`,
    `CTA: ${pkg.cta.activeCta}. ${pkg.cta.alignmentNote}`,
    `Promotion: ${pkg.promotion.status}.`,
    avoid.length ? `Avoid claims: ${avoid.join("; ")}.` : "No prohibited claims listed.",
    `Strategy confidence ${pkg.confidence.overall}%. ${pkg.userConfirmed ? "User confirmed." : "Not yet confirmed."}`,
    "Recommendations do not overwrite the Marketing Brief. This is marketing strategy, not a script or scene plan.",
  ].filter(Boolean).join(" ");
}

export { OBJECTIVE_HINTS };
