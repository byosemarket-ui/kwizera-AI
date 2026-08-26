/** Consolidate Phase 2 + Phase 3 Steps 1–3 into one Master Product Intelligence package. */

import type { ProductIntelligencePackage, LayeredItem } from "../deep-intelligence/types";
import type { ResearchPackage, InsightRow, KnowledgeItem } from "../market-research/types";
import type { ProductProfile } from "../product-profile/types";
import type { MarketingProductionBrief } from "../marketing-input/types";
import { resolvedAudienceSummary, resolvedCta, resolvedPlatforms } from "../marketing-input/types";
import type { ProductionInputPackage } from "../product-validation/types";
import type { VisualProductAnalysisPackage } from "../visual-analysis/types";
import type {
  BenefitItem,
  ClaimSafetyEntry,
  ClassifiedItem,
  ContentOpportunity,
  CreativeDirection,
  DifferentiatorItem,
  FactClassification,
  FreshnessBand,
  InsightItem,
  MasterIntelligenceScore,
  MasterProductIntelligence,
  MissingInfoItem,
  RestrictionItem,
  SectionConfidence,
  SourceRegistryEntry,
  VerifiedFactsBlock,
  VisualIntelligenceSummary,
} from "./types";

export interface AssembleInputs {
  research: ResearchPackage | null;
  intel: ProductIntelligencePackage | null;
  visual: VisualProductAnalysisPackage | null;
  profile: ProductProfile | null;
  brief: MarketingProductionBrief | null;
  production: ProductionInputPackage | null;
  previous?: MasterProductIntelligence | null;
}

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

const CLASS_RANK: Record<FactClassification, number> = {
  "VERIFIED FACT": 1,
  "USER PROVIDED": 2,
  "RESEARCH SUPPORTED": 3,
  "VISUAL OBSERVATION": 4,
  "AI INFERENCE": 5,
  "AI RECOMMENDATION": 6,
  UNKNOWN: 7,
};

export function classificationRank(c: FactClassification): number {
  return CLASS_RANK[c];
}

export function mapLayerKind(kind: LayeredItem["kind"]): FactClassification {
  if (kind === "verified") return "VERIFIED FACT";
  if (kind === "ai-observation") return "VISUAL OBSERVATION";
  return "AI INFERENCE";
}

export function mapKnowledgeKind(kind: KnowledgeItem["kind"]): FactClassification {
  if (kind === "user-provided-fact") return "USER PROVIDED";
  if (kind === "researched-fact") return "RESEARCH SUPPORTED";
  if (kind === "market-insight") return "RESEARCH SUPPORTED";
  return "AI INFERENCE";
}

export function mapFreshness(value: string | null | undefined): FreshnessBand {
  if (value === "CURRENT" || value === "RECENT" || value === "AGING" || value === "STALE" || value === "UNKNOWN") {
    return value;
  }
  return "UNKNOWN";
}

/** Keep the higher-priority item; never let a lower source silently replace a higher one. */
export function preferHigherPriority(a: ClassifiedItem, b: ClassifiedItem): ClassifiedItem {
  if (classificationRank(a.classification) < classificationRank(b.classification)) return a;
  if (classificationRank(b.classification) < classificationRank(a.classification)) return b;
  return a.confidence >= b.confidence ? a : b;
}

function layeredToClassified(item: LayeredItem, source: string): ClassifiedItem {
  return {
    id: item.id || uid("ci"),
    label: item.field,
    value: item.value,
    classification: mapLayerKind(item.kind),
    source,
    evidence: item.reason || item.evidence.map((e) => e.detection).filter(Boolean).join("; ") || source,
    confidence: item.confidence,
  };
}

function insightFromRow(row: InsightRow, source: string, freshness?: FreshnessBand, date?: string | null): InsightItem {
  return {
    id: row.id || uid("in"),
    label: row.label,
    detail: row.detail,
    evidence: row.sourceOrReason,
    source,
    confidence: row.confidence,
    classification: row.kind === "user-provided-fact" ? "USER PROVIDED"
      : row.kind === "researched-fact" || row.kind === "market-insight" ? "RESEARCH SUPPORTED"
      : "AI INFERENCE",
    freshness,
    date,
  };
}

function avg(nums: number[], fallback = 0): number {
  if (!nums.length) return fallback;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100;
}

function pct(n: number): number {
  if (n <= 1) return Math.round(n * 100);
  return Math.round(n);
}

function factValue(intel: ProductIntelligencePackage | null, field: string): string {
  return intel?.verifiedFacts.find((f) => f.field.toLowerCase() === field.toLowerCase())?.value?.trim() || "";
}

export function buildVerifiedFacts(profile: ProductProfile | null, intel: ProductIntelligencePackage | null): VerifiedFactsBlock {
  const f = profile?.fields;
  const variants = (profile?.variants ?? []).map((v) => `${v.label}: ${v.values.join(", ")}`);
  return {
    productName: f?.name?.trim() || intel?.productName || factValue(intel, "Name") || "",
    brand: f?.brand?.trim() || factValue(intel, "Brand") || "",
    category: f?.category?.trim() || factValue(intel, "Category") || "",
    price: f?.price ?? null,
    currency: f?.currency?.trim() || "",
    description: f?.description?.trim() || f?.shortDescription?.trim() || "",
    materials: [...(f?.materials ?? [])],
    colors: [...(f?.colors ?? [])],
    sizes: [...(f?.sizes ?? [])],
    specifications: { ...(f?.specifications ?? {}) },
    warranty: f?.warranty?.trim() || "",
    sku: f?.sku?.trim() || "",
    barcode: f?.barcode?.trim() || "",
    variants,
  };
}

export function buildIdentity(
  profile: ProductProfile | null,
  intel: ProductIntelligencePackage | null,
  facts: VerifiedFactsBlock,
): MasterProductIntelligence["identity"] {
  const identityConf = intel?.scores.identity ?? (facts.productName && facts.category ? 0.85 : 0.4);
  return {
    name: facts.productName,
    brand: facts.brand,
    category: facts.category,
    subcategory: profile?.fields.subcategory.trim() || "",
    model: profile?.fields.model.trim() || "",
    variants: facts.variants,
    identityConfidence: pct(identityConf),
  };
}

export function buildVisualSummary(
  visual: VisualProductAnalysisPackage | null,
  intel: ProductIntelligencePackage | null,
): VisualIntelligenceSummary {
  const images = visual?.images ?? [];
  const first = images[0];
  const colors = visual?.aggregate.primaryColor
    ? [visual.aggregate.primaryColor, visual.aggregate.secondaryColor].filter(Boolean).join(", ")
    : intel?.visualObservations.find((o) => /color/i.test(o.field))?.value || "";
  const qualityGood = visual?.aggregate.qualityGoodCount ?? 0;
  const total = visual?.aggregate.imagesTotal || images.length;
  const backgrounds = [...new Set(images.map((i) => i.background.type).filter(Boolean))];
  const features = [...new Set(images.flatMap((i) => i.visualFeatures))];
  const evidence = images.slice(0, 6).map((i) => `${i.fileName} (${i.viewType})`);
  const conf = visual
    ? avg([visual.aggregate.productDetectionAvg, visual.consistency.confidence, visual.coveragePercent / 100], 0.5)
    : pct(intel?.scores.visualUnderstanding ?? 0) / 100;
  return {
    appearance: first?.productDetection.mainProduct || intel?.productName || "Not visually summarized",
    shape: intel?.characteristics.find((c) => /shape|silhouette|form/i.test(c.field))?.value || first?.composition || "",
    color: colors,
    design: intel?.characteristics.find((c) => /design|style/i.test(c.field))?.value || first?.composition || "",
    logo: visual?.aggregate.logoDetected
      ? `Possible logo/brand mark detected${first?.logo.possibleBrand ? ` (${first.logo.possibleBrand})` : ""}`
      : "No reliable logo detection",
    packaging: images.some((i) => /pack/i.test(i.viewType) || /pack/i.test(i.fileName))
      ? "Packaging-related view present in image set"
      : "No packaging view identified",
    visibleFeatures: features.slice(0, 12),
    presentation: first?.visibility.status || visual?.consistency.note || "",
    imageQuality: total
      ? `${qualityGood}/${total} images classified GOOD or better; ${visual?.aggregate.needsReviewCount ?? 0} need review`
      : "No visual analysis package",
    imageCoverage: visual
      ? `${visual.coveragePercent}% coverage (${visual.coverage.filter((c) => c.status === "available").length}/${visual.coverage.length} views)`
      : intel
        ? `${intel.coveragePercent}% coverage from Product Intelligence`
        : "Unknown",
    background: backgrounds.join(", ") || first?.background.type || "",
    confidence: pct(conf),
    evidenceRefs: evidence,
  };
}

function mergeClassified(items: ClassifiedItem[]): ClassifiedItem[] {
  const map = new Map<string, ClassifiedItem>();
  for (const item of items) {
    const key = `${item.label.trim().toLowerCase()}::${item.value.trim().toLowerCase()}`;
    const existing = map.get(key);
    map.set(key, existing ? preferHigherPriority(existing, item) : item);
  }
  return [...map.values()];
}

export function buildFeatures(
  profile: ProductProfile | null,
  intel: ProductIntelligencePackage | null,
  visual: VisualProductAnalysisPackage | null,
): ClassifiedItem[] {
  const fromProfile = (profile?.fields.features ?? []).filter(Boolean).map((value) => ({
    id: uid("feat"),
    label: "Feature",
    value,
    classification: "USER PROVIDED" as const,
    source: "Product Profile",
    evidence: "User-confirmed product information",
    confidence: 1,
  }));
  const fromIntel = (intel?.features ?? []).map((f) => layeredToClassified(f, "Deep Product Intelligence"));
  const fromVisual = (visual?.images ?? []).flatMap((img) =>
    img.visualFeatures.map((value) => ({
      id: uid("vfeat"),
      label: "Visible feature",
      value,
      classification: "VISUAL OBSERVATION" as const,
      source: "Visual Analysis",
      evidence: `${img.fileName} · ${img.viewType}`,
      confidence: img.productDetection.confidence,
    })),
  );
  return mergeClassified([...fromProfile, ...fromIntel, ...fromVisual]);
}

export function classifyDifferentiator(kind: LayeredItem["kind"] | "recommendation"): DifferentiatorItem["classification"] {
  if (kind === "verified") return "VERIFIED DIFFERENTIATOR";
  if (kind === "recommendation") return "MARKETING RECOMMENDATION";
  return "POSSIBLE DIFFERENTIATOR";
}

export function buildDifferentiators(
  profile: ProductProfile | null,
  intel: ProductIntelligencePackage | null,
  research: ResearchPackage | null,
): DifferentiatorItem[] {
  const fromProfile = (profile?.fields.highlights ?? []).filter(Boolean).map((value) => ({
    id: uid("diff"),
    value,
    classification: "VERIFIED DIFFERENTIATOR" as const,
    source: "Product Profile",
    evidence: "User-confirmed highlight",
    confidence: 1,
  }));
  const fromIntel = (intel?.differentiators ?? []).map((d) => ({
    id: d.id,
    value: d.value,
    classification: classifyDifferentiator(d.kind),
    source: "Deep Product Intelligence",
    evidence: d.reason || "Intelligence layer",
    confidence: d.confidence,
  }));
  const fromResearch = (research?.marketingAngles ?? []).map((a) => ({
    id: a.id,
    value: a.name,
    classification: "MARKETING RECOMMENDATION" as const,
    source: "Product Research",
    evidence: a.supportingEvidence,
    confidence: a.confidence,
  }));
  return [...fromProfile, ...fromIntel, ...fromResearch];
}

export function buildBenefits(
  profile: ProductProfile | null,
  intel: ProductIntelligencePackage | null,
): BenefitItem[] {
  const fromProfile = (profile?.fields.benefits ?? []).filter(Boolean).map((benefit) => ({
    id: uid("ben"),
    benefit,
    evidence: "User-provided product specification",
    source: "Product Profile",
    confidence: 1,
    classification: "VERIFIED FACT" as const,
  }));
  const fromIntel = (intel?.benefits ?? []).map((b) => ({
    id: b.id,
    benefit: b.value,
    evidence: b.reason || "Product Intelligence",
    source: b.kind === "verified" ? "Verified Product Data" : "Deep Product Intelligence",
    confidence: b.confidence,
    classification: mapLayerKind(b.kind),
  }));
  return [...fromProfile, ...fromIntel];
}

function insufficientMarketNote(): InsightItem {
  return {
    id: uid("mkt"),
    label: "MARKET DATA INSUFFICIENT",
    detail: "Reliable current market statistics were not available. No invented figures.",
    evidence: "Research engine reported insufficient verified market data",
    source: "Product Research",
    confidence: 0,
    classification: "UNKNOWN",
    freshness: "UNKNOWN",
    date: null,
  };
}

export function buildCustomerInsights(
  brief: MarketingProductionBrief | null,
  research: ResearchPackage | null,
): InsightItem[] {
  const items: InsightItem[] = [];
  if (brief) {
    const f = brief.fields;
    const audience = resolvedAudienceSummary(f);
    if (audience) {
      items.push({
        id: uid("aud"),
        label: "Target Audience",
        detail: audience,
        evidence: "Marketing Production Brief",
        source: "Marketing Brief",
        confidence: 1,
        classification: "USER PROVIDED",
      });
    }
    if (f.customerNeeds.trim()) {
      items.push({
        id: uid("need"),
        label: "Customer Needs",
        detail: f.customerNeeds.trim(),
        evidence: "Marketing Production Brief",
        source: "Marketing Brief",
        confidence: 1,
        classification: "USER PROVIDED",
      });
    }
  }
  const rows = [
    ...(research?.customerInsights ?? []).map((r) => insightFromRow(r, "Product Research", mapFreshness(research?.localKnowledgeAge), research?.updatedAt)),
    ...(research?.painPoints ?? []).map((r) => insightFromRow(r, "Customer Intelligence", mapFreshness(r.kind), research?.updatedAt)),
    ...(research?.desires ?? []).map((r) => insightFromRow(r, "Customer Intelligence")),
    ...(research?.motivations ?? []).map((r) => insightFromRow(r, "Customer Intelligence")),
    ...(research?.objections ?? []).map((r) => insightFromRow(r, "Customer Intelligence")),
  ];
  return [...items, ...rows];
}

export function buildMarketInsights(research: ResearchPackage | null): InsightItem[] {
  if (!research) return [insufficientMarketNote()];
  const rows = research.marketInsights.map((r) =>
    insightFromRow(r, "Market Intelligence", mapFreshness(r.kind === "market-insight" ? "UNKNOWN" : undefined), research.updatedAt),
  );
  if (research.insufficientMarketData || !rows.length) {
    return [insufficientMarketNote(), ...rows];
  }
  return rows;
}

export function buildCompetitive(research: ResearchPackage | null): InsightItem[] {
  return (research?.competitiveInsights ?? []).map((r) => insightFromRow(r, "Competitive Intelligence"));
}

export function buildProductKnowledge(research: ResearchPackage | null): ClassifiedItem[] {
  return (research?.productKnowledge ?? research?.knowledge ?? []).map((k) => ({
    id: k.id,
    label: k.topic,
    value: k.claim,
    classification: mapKnowledgeKind(k.kind),
    source: k.sourceId,
    evidence: k.objective || k.tags.join(", "),
    confidence: k.confidence,
    freshness: mapFreshness(k.freshness),
    date: k.lastVerified,
  }));
}

export function buildMarketingInsights(
  brief: MarketingProductionBrief | null,
  research: ResearchPackage | null,
): InsightItem[] {
  const recs: InsightItem[] = [];
  if (brief) {
    recs.push({
      id: uid("brief"),
      label: "Marketing Brief (authoritative)",
      detail: [
        brief.fields.objective && `Objective: ${brief.fields.objective}`,
        resolvedAudienceSummary(brief.fields) && `Audience: ${resolvedAudienceSummary(brief.fields)}`,
        resolvedCta(brief.fields) && `CTA: ${resolvedCta(brief.fields)}`,
        resolvedPlatforms(brief.fields).length && `Platforms: ${resolvedPlatforms(brief.fields).join(", ")}`,
      ].filter(Boolean).join(" · "),
      evidence: "User-confirmed Marketing Production Brief — not overwritten",
      source: "Marketing Brief",
      confidence: 1,
      classification: "USER PROVIDED",
    });
  }
  const angles = (research?.marketingAngles ?? []).map((a) => ({
    id: a.id,
    label: a.name,
    detail: a.suggestedMessage || a.productBenefit,
    evidence: a.supportingEvidence,
    source: "Product Research",
    confidence: a.confidence,
    classification: "AI RECOMMENDATION" as const,
  }));
  const platforms = (research?.platformNotes ?? []).map((r) => insightFromRow(r, "Platform Intelligence"));
  platforms.forEach((p) => {
    p.classification = "AI RECOMMENDATION";
  });
  return [...recs, ...angles, ...platforms];
}

export function buildCreativeDirection(
  brief: MarketingProductionBrief | null,
  visual: VisualIntelligenceSummary,
  facts: VerifiedFactsBlock,
): CreativeDirection {
  const f = brief?.fields;
  return {
    visualStyle: f?.style.trim() || f?.visualPreference.trim() || "Product-led, factual presentation",
    mood: f?.mood.trim() || "Professional",
    tone: f?.tone.trim() || "Professional",
    energy: f?.energy.trim() || "Measured",
    productPresentation: visual.presentation || "Keep the product clearly visible and centered when possible",
    visualEmphasis: [
      facts.colors.length ? `Confirmed colors: ${facts.colors.join(", ")}` : null,
      visual.color ? `Observed color: ${visual.color}` : null,
      visual.visibleFeatures[0] ? `Visible: ${visual.visibleFeatures.slice(0, 3).join(", ")}` : null,
    ].filter(Boolean).join(" · ") || "Emphasize confirmed product identity only",
    storyDirection: f?.objective.trim()
      ? `Support the campaign objective “${f.objective}” without inventing unverified claims.`
      : "Present the verified product honestly. Do not write a final story yet.",
    cameraOpportunities: [
      f?.cameraPreference.trim() || "",
      visual.imageCoverage.includes("missing") ? "Cover missing views if later captured" : "Use available product views",
      "Detail close-ups where visual evidence exists",
    ].filter(Boolean),
    detailOpportunities: visual.visibleFeatures.slice(0, 6),
    backgroundDirection: f?.backgroundPreference.trim() || visual.background || "Respect existing background characteristics",
    lightingDirection: f?.visualPreference.trim() || "Even product lighting; avoid hiding the product",
    brandFeeling: f?.brandFeeling.trim() || f?.brandVoice.trim() || f?.brandStyle.trim() || "",
    note: "CREATIVE BRIEF only — not a storyboard, script, scene list, or video instruction set.",
  };
}

export function buildContentOpportunities(input: {
  audience: string;
  features: ClassifiedItem[];
  benefits: BenefitItem[];
  customer: InsightItem[];
  brief: MarketingProductionBrief | null;
}): ContentOpportunity[] {
  const audience = input.audience || "Audience from Marketing Brief if provided";
  const need = input.customer.find((c) => /need|pain|desire/i.test(c.label))?.detail
    || input.brief?.fields.customerNeeds.trim()
    || "Category-typical consideration (not guaranteed for every customer)";
  const feature = input.features.find((f) => f.classification === "USER PROVIDED" || f.classification === "VERIFIED FACT")
    || input.features[0];
  const benefit = input.benefits.find((b) => b.classification === "VERIFIED FACT") || input.benefits[0];
  const objective = input.brief?.fields.objective.trim();
  const rows: Array<Omit<ContentOpportunity, "id">> = [
    {
      name: "Product showcase",
      targetAudience: audience,
      customerNeed: need,
      productFeature: feature?.value || factsSafeName(input),
      suggestedAngle: "Show the confirmed product clearly using available views",
      evidence: feature?.evidence || "Product Profile / Visual Analysis",
      confidence: feature?.confidence ?? 0.6,
    },
    {
      name: "Feature demonstration",
      targetAudience: audience,
      customerNeed: need,
      productFeature: feature?.value || "User-confirmed feature if present",
      suggestedAngle: feature
        ? `Demonstrate “${feature.value}” using only ${feature.classification.toLowerCase()} evidence`
        : "Skip until a verified feature exists",
      evidence: feature?.source || "None",
      confidence: feature ? feature.confidence : 0.2,
    },
    {
      name: "Detail-focused content",
      targetAudience: audience,
      customerNeed: "Closer look at construction or finish",
      productFeature: input.features.find((f) => f.classification === "VISUAL OBSERVATION")?.value || "Visible details",
      suggestedAngle: "Close-ups of visually observed details — do not convert them into specs",
      evidence: "Visual Analysis",
      confidence: 0.7,
    },
    {
      name: "Problem/solution",
      targetAudience: audience,
      customerNeed: need,
      productFeature: benefit?.benefit || "Verified benefit if any",
      suggestedAngle: benefit?.classification === "VERIFIED FACT"
        ? `Connect “${need}” to verified benefit “${benefit.benefit}”`
        : "Do not claim a solution unless the benefit is verified",
      evidence: benefit?.evidence || "Insufficient",
      confidence: benefit?.classification === "VERIFIED FACT" ? benefit.confidence : 0.35,
    },
    {
      name: "Lifestyle presentation",
      targetAudience: audience,
      customerNeed: input.brief?.fields.buyingIntent.trim() || need,
      productFeature: factsSafeName(input),
      suggestedAngle: "Lifestyle only if it does not invent usage claims",
      evidence: "Marketing Brief tone/mood if provided",
      confidence: input.brief ? 0.6 : 0.3,
    },
    {
      name: "Promotional content",
      targetAudience: audience,
      customerNeed: "Offer awareness",
      productFeature: input.brief?.fields.promotionType || "Promotion type from brief",
      suggestedAngle: input.brief?.fields.promotionDetails.trim()
        ? `Use only the stated promotion: ${input.brief.fields.promotionDetails.trim()}`
        : "No promotion details — do not invent discounts",
      evidence: input.brief?.fields.promotionDetails.trim() ? "Marketing Brief" : "Missing promotion details",
      confidence: input.brief?.fields.promotionDetails.trim() ? 0.9 : 0.2,
    },
    {
      name: "Educational content",
      targetAudience: audience,
      customerNeed: "Understand the product category",
      productFeature: feature?.value || "Category context",
      suggestedAngle: "Teach from verified facts and clearly labeled research",
      evidence: "Verified Product Facts + Research (labeled)",
      confidence: 0.65,
    },
  ];
  if (objective) {
    rows[0] = { ...rows[0]!, suggestedAngle: `${rows[0]!.suggestedAngle}. Campaign objective: ${objective}.` };
  }
  return rows.map((r) => ({ ...r, id: uid("opp") }));
}

function factsSafeName(input: { features: ClassifiedItem[] }): string {
  return input.features[0]?.value || "Confirmed product";
}

export function buildClaimSafety(input: {
  facts: VerifiedFactsBlock;
  benefits: BenefitItem[];
  features: ClassifiedItem[];
  differentiators: DifferentiatorItem[];
  intel: ProductIntelligencePackage | null;
}): ClaimSafetyEntry[] {
  const entries: ClaimSafetyEntry[] = [];
  const push = (
    claim: string,
    status: ClaimSafetyEntry["status"],
    reason: string,
    source: string,
    confidence: number,
  ) => {
    entries.push({
      id: uid("cl"),
      claim,
      status,
      reason,
      source,
      confidence,
      userDecision: status === "DO NOT USE" ? "avoid" : "pending",
    });
  };

  if (input.facts.materials.length) {
    push(
      `Made from ${input.facts.materials.join(", ")}`,
      "SAFE / VERIFIED",
      "Exists in the confirmed Product Profile",
      "Product Profile",
      1,
    );
  }
  if (input.facts.warranty) {
    push(`Warranty: ${input.facts.warranty}`, "SAFE / VERIFIED", "User-confirmed warranty", "Product Profile", 1);
  }
  if (input.facts.productName) {
    push(`This is ${input.facts.productName}`, "SAFE / VERIFIED", "Confirmed product name", "Product Profile", 1);
  }
  for (const b of input.benefits) {
    if (b.classification === "VERIFIED FACT" || b.classification === "USER PROVIDED") {
      push(b.benefit, "SAFE / VERIFIED", b.evidence, b.source, b.confidence);
    } else if (b.classification === "RESEARCH SUPPORTED") {
      push(b.benefit, "SUPPORTED BUT REVIEW", "Research-backed, not product-specific proof", b.source, b.confidence);
    } else if (b.classification === "VISUAL OBSERVATION") {
      push(b.benefit, "SUPPORTED BUT REVIEW", "Visual observation is not a specification", b.source, b.confidence);
    } else {
      push(b.benefit, "UNVERIFIED", "AI inference without independent verification", b.source, b.confidence);
    }
  }
  for (const f of input.features) {
    if (f.classification === "VISUAL OBSERVATION") {
      push(f.value, "SUPPORTED BUT REVIEW", "Do not turn visual observations into factual specifications automatically", f.source, f.confidence);
    }
  }
  for (const d of input.differentiators) {
    if (d.classification === "MARKETING RECOMMENDATION") {
      push(d.value, "UNVERIFIED", "Marketing recommendation — not a uniqueness claim", d.source, d.confidence);
    } else if (d.classification === "POSSIBLE DIFFERENTIATOR") {
      push(d.value, "SUPPORTED BUT REVIEW", "Possible differentiator — do not claim market uniqueness", d.source, d.confidence);
    }
  }
  for (const conflict of input.intel?.crossValidation.filter((c) => c.mark === "conflict") ?? []) {
    push(
      conflict.visualValue,
      "DO NOT USE",
      `Conflicts with user-confirmed “${conflict.userValue}”. User data is authoritative.`,
      "Cross-validation",
      conflict.confidence,
    );
  }
  const waterproof = [...input.benefits, ...input.features.map((f) => ({ benefit: f.value, classification: f.classification, evidence: f.evidence, source: f.source, confidence: f.confidence }))]
    .find((x) => /waterproof|water-?proof/i.test(x.benefit));
  if (!waterproof && !/waterproof/i.test(JSON.stringify(input.facts.specifications))) {
    push("Waterproof", "UNVERIFIED", "No reliable evidence exists in Product Profile, visual analysis, or research", "None", 0);
  }
  return entries;
}

export function buildRestrictions(input: {
  claims: ClaimSafetyEntry[];
  missing: MissingInfoItem[];
  brief: MarketingProductionBrief | null;
  intel: ProductIntelligencePackage | null;
  visual: VisualProductAnalysisPackage | null;
  production: ProductionInputPackage | null;
}): RestrictionItem[] {
  const items: RestrictionItem[] = [];
  for (const c of input.claims.filter((c) => c.status === "DO NOT USE" || c.status === "UNVERIFIED")) {
    items.push({
      id: uid("rst"),
      category: c.status === "DO NOT USE" ? "Unverified / conflicting claims" : "Unverified claims",
      detail: `Do not use: ${c.claim}. ${c.reason}`,
      severity: c.status === "DO NOT USE" ? "critical" : "warning",
    });
  }
  for (const m of input.missing.filter((m) => m.severity !== "OPTIONAL")) {
    items.push({
      id: uid("rst"),
      category: m.severity === "CRITICAL" ? "Missing product information" : "Missing images / recommended data",
      detail: m.detail,
      severity: m.severity === "CRITICAL" ? "critical" : "warning",
    });
  }
  const low = input.intel?.unknown ?? [];
  if (low.length) {
    items.push({
      id: uid("rst"),
      category: "Low-confidence information",
      detail: `${low.length} unknown/low-confidence intelligence items must stay labeled`,
      severity: "info",
    });
  }
  const g = input.brief?.fields.brandGuidelines.trim();
  if (g) {
    items.push({ id: uid("rst"), category: "Brand restrictions", detail: g, severity: "warning" });
  }
  const notes = input.brief?.fields.campaignNotes.trim();
  if (notes) {
    items.push({ id: uid("rst"), category: "User instructions", detail: notes, severity: "info" });
  }
  const platforms = input.brief ? resolvedPlatforms(input.brief.fields) : [];
  if (platforms.length) {
    items.push({
      id: uid("rst"),
      category: "Platform restrictions",
      detail: `Honor platform constraints for: ${platforms.join(", ")}`,
      severity: "info",
    });
  }
  if (input.brief && !input.brief.fields.promotionDetails.trim() && /promo|sale|discount/i.test(input.brief.fields.objective + input.brief.fields.promotionType)) {
    items.push({
      id: uid("rst"),
      category: "Promotion limitations",
      detail: "Promotion objective/type set without details — do not invent offers",
      severity: "warning",
    });
  }
  if (input.production?.readiness && input.production.readiness !== "READY") {
    items.push({
      id: uid("rst"),
      category: "Production readiness",
      detail: input.production.readinessReason || `Readiness: ${input.production.readiness}`,
      severity: input.production.readiness === "NOT_READY" ? "critical" : "warning",
    });
  }
  return items;
}

export function buildMissing(input: {
  facts: VerifiedFactsBlock;
  visual: VisualProductAnalysisPackage | null;
  brief: MarketingProductionBrief | null;
  intel: ProductIntelligencePackage | null;
}): MissingInfoItem[] {
  const items: MissingInfoItem[] = [];
  const sales = /sale|sales|direct|promo|launch/i.test(input.brief?.fields.objective || "");
  if (sales && input.facts.price == null) {
    items.push({
      id: uid("miss"),
      severity: "CRITICAL",
      detail: "No verified product price for a sales campaign.",
      blocksProduction: true,
    });
  }
  const coverage = input.visual?.coverage ?? input.intel?.coverage ?? [];
  for (const row of coverage) {
    if (row.status !== "missing") continue;
    if (row.need === "required") {
      items.push({
        id: uid("miss"),
        severity: "CRITICAL",
        detail: `Missing required view: ${row.view}`,
        blocksProduction: true,
      });
    } else if (row.need === "recommended") {
      items.push({
        id: uid("miss"),
        severity: "RECOMMENDED",
        detail: /pack/i.test(row.view) ? "No packaging image." : `No ${row.view} view.`,
        blocksProduction: false,
      });
    } else {
      items.push({
        id: uid("miss"),
        severity: "OPTIONAL",
        detail: /bottom/i.test(row.view) ? "No bottom view." : `No ${row.view} view.`,
        blocksProduction: false,
      });
    }
  }
  if (!input.facts.sku) {
    items.push({ id: uid("miss"), severity: "OPTIONAL", detail: "No SKU.", blocksProduction: false });
  }
  if (!input.facts.description) {
    items.push({ id: uid("miss"), severity: "RECOMMENDED", detail: "No product description.", blocksProduction: false });
  }
  return items;
}

export function buildSourceRegistry(research: ResearchPackage | null): SourceRegistryEntry[] {
  return (research?.sources ?? []).map((s) => ({
    id: s.id,
    title: s.title,
    url: s.url,
    domain: s.domain,
    sourceType: s.sourceType,
    date: s.publishedAt,
    retrievedDate: s.retrievedAt,
    quality: s.quality,
    relevantClaims: [s.extracted].filter(Boolean).slice(0, 3),
    confidence: s.confidence,
    freshness: mapFreshness(undefined),
  }));
}

export function computeSectionConfidence(input: {
  identity: number;
  visual: number;
  facts: VerifiedFactsBlock;
  features: ClassifiedItem[];
  customer: InsightItem[];
  market: InsightItem[];
  competitive: InsightItem[];
  marketing: InsightItem[];
  research: ResearchPackage | null;
  intel: ProductIntelligencePackage | null;
}): SectionConfidence {
  const factFill = [
    input.facts.productName, input.facts.brand, input.facts.category,
    input.facts.description, input.facts.materials.length ? "y" : "",
  ].filter(Boolean).length / 5;
  const customer = input.customer.length
    ? avg(input.customer.map((c) => (c.confidence <= 1 ? c.confidence : c.confidence / 100)))
    : 0.2;
  const marketInsufficient = input.market.some((m) => m.label === "MARKET DATA INSUFFICIENT") && input.market.length <= 1;
  const market = marketInsufficient ? 0.2 : avg(input.market.map((m) => (m.confidence <= 1 ? m.confidence : m.confidence / 100)), 0.35);
  const competitive = input.competitive.length
    ? avg(input.competitive.map((c) => (c.confidence <= 1 ? c.confidence : c.confidence / 100)))
    : 0.25;
  const marketing = input.marketing.length
    ? avg(input.marketing.map((m) => (m.confidence <= 1 ? m.confidence : m.confidence / 100)))
    : 0.3;
  const features = input.features.length
    ? avg(input.features.map((f) => (f.confidence <= 1 ? f.confidence : f.confidence / 100)))
    : 0.3;
  const visual = input.visual <= 1 ? input.visual : input.visual / 100;
  const identity = input.identity <= 1 ? input.identity : input.identity / 100;
  const productFacts = factFill;
  const creative = avg([identity, visual, marketing, 0.55]);
  const overall = avg([identity, visual, productFacts, features, customer, market, competitive, marketing, creative]);
  return {
    productIdentity: pct(identity),
    visualUnderstanding: pct(visual),
    productFacts: pct(productFacts),
    productFeatures: pct(features),
    customerIntelligence: pct(customer),
    marketIntelligence: pct(market),
    competitiveIntelligence: pct(competitive),
    marketingInsights: pct(marketing),
    creativeDirection: pct(creative),
    overall: pct(overall),
  };
}

export function computeMasterScore(conf: SectionConfidence, research: ResearchPackage | null): MasterIntelligenceScore {
  const researchScore = research
    ? pct(research.insufficientMarketData ? avg([0.7, research.knowledge.length ? 0.85 : 0.4]) : avg([0.88, research.sources.length ? 0.9 : 0.5]))
    : 20;
  const overall = Math.round(
    (conf.productIdentity * 0.18)
    + (conf.visualUnderstanding * 0.16)
    + (conf.productFacts * 0.18)
    + (conf.customerIntelligence * 0.16)
    + (conf.marketIntelligence * 0.14)
    + (researchScore * 0.18),
  );
  return {
    productIdentity: conf.productIdentity,
    visualUnderstanding: conf.visualUnderstanding,
    verifiedData: conf.productFacts,
    customerIntelligence: conf.customerIntelligence,
    marketIntelligence: conf.marketIntelligence,
    research: researchScore,
    overall,
    explanation: [
      `Identity ${conf.productIdentity}% from confirmed Product Profile (never invented).`,
      `Visual ${conf.visualUnderstanding}% from Step 1 analysis.`,
      `Verified data ${conf.productFacts}% from user-confirmed fields.`,
      `Customer ${conf.customerIntelligence}% mixes Marketing Brief with labeled research — not guaranteed for every customer.`,
      `Market ${conf.marketIntelligence}% — insufficient data stays labeled, statistics are never invented.`,
      `Research ${researchScore}% from the Knowledge/Research package.`,
      "Score is diagnostic only and does not replace user confirmation or claim safety.",
    ].join(" "),
  };
}

export function nextVersionLabel(previous: MasterProductIntelligence | null): { versionLabel: string; versionNumber: number } {
  if (!previous) return { versionLabel: "v1.0", versionNumber: 1 };
  const n = previous.versionNumber + 1;
  return { versionLabel: `v${n}.0`, versionNumber: n };
}

export function assembleMasterPackage(input: AssembleInputs): MasterProductIntelligence {
  const profile = input.profile ?? input.production?.productProfile ?? null;
  const brief = input.brief ?? input.production?.marketingBrief ?? null;
  const intel = input.intel;
  const visual = input.visual;
  const research = input.research;
  const facts = buildVerifiedFacts(profile, intel);
  const identity = buildIdentity(profile, intel, facts);
  const visualIntelligence = buildVisualSummary(visual, intel);
  const features = buildFeatures(profile, intel, visual);
  const characteristics = (intel?.characteristics ?? []).map((c) => layeredToClassified(c, "Deep Product Intelligence"));
  const variants = (intel?.variants ?? []).map((v) => ({
    id: uid("var"),
    label: v.label,
    value: `${v.declared}${v.visualSupport ? ` · visual: ${v.visualSupport}` : ""}`,
    classification: (v.status === "visually-supported" ? "VISUAL OBSERVATION" : "USER PROVIDED") as FactClassification,
    source: "Product Profile / Visual",
    evidence: v.status,
    confidence: v.status === "visually-supported" ? 0.8 : 1,
  }));
  const specifications = Object.entries(facts.specifications).map(([label, value]) => ({
    id: uid("spec"),
    label,
    value,
    classification: "USER PROVIDED" as const,
    source: "Product Profile",
    evidence: "User-confirmed specification",
    confidence: 1,
  }));
  const differentiators = buildDifferentiators(profile, intel, research);
  const benefits = buildBenefits(profile, intel);
  const customerIntelligence = buildCustomerInsights(brief, research);
  const marketIntelligence = buildMarketInsights(research);
  const competitiveIntelligence = buildCompetitive(research);
  const productKnowledge = buildProductKnowledge(research);
  const marketingInsights = buildMarketingInsights(brief, research);
  const creativeDirection = buildCreativeDirection(brief, visualIntelligence, facts);
  const contentOpportunities = buildContentOpportunities({
    audience: brief ? resolvedAudienceSummary(brief.fields) : "",
    features,
    benefits,
    customer: customerIntelligence,
    brief,
  });
  const ctaDirection = brief
    ? (resolvedCta(brief.fields) || "No CTA in Marketing Brief — do not invent one")
    : "No Marketing Brief CTA";
  const claimSafety = buildClaimSafety({ facts, benefits, features, differentiators, intel });
  const missingInformation = buildMissing({ facts, visual, brief, intel });
  const restrictions = buildRestrictions({
    claims: claimSafety,
    missing: missingInformation,
    brief,
    intel,
    visual,
    production: input.production,
  });
  const uncertainty = (intel?.unknown ?? []).map((u) => layeredToClassified(u, "Deep Product Intelligence"));
  const sources = buildSourceRegistry(research);
  const sectionConfidence = computeSectionConfidence({
    identity: identity.identityConfidence,
    visual: visualIntelligence.confidence,
    facts,
    features,
    customer: customerIntelligence,
    market: marketIntelligence,
    competitive: competitiveIntelligence,
    marketing: marketingInsights,
    research,
    intel,
  });
  const scores = computeMasterScore(sectionConfidence, research);
  const ver = nextVersionLabel(input.previous ?? null);
  const projectId = profile?.projectId || intel?.projectId || research?.projectId || "unknown";
  const productId = profile?.productId || intel?.productId || research?.productId || projectId;
  const now = new Date().toISOString();
  const history = [
    ...(input.previous?.history ?? []),
    ...(input.previous
      ? [{ versionLabel: input.previous.versionLabel, masterId: input.previous.masterId, createdAt: input.previous.updatedAt, status: input.previous.status }]
      : []),
  ];

  return {
    version: 1,
    masterId: uid("mint"),
    versionLabel: ver.versionLabel,
    versionNumber: ver.versionNumber,
    engineId: "kwizera.master-intelligence.v1",
    projectId,
    productId,
    projectName: profile?.projectName || intel?.projectName || research?.projectName || "",
    productName: facts.productName,
    refs: {
      projectId,
      productId,
      productImageSetId: profile?.productImageSet?.projectId ?? visual?.productImageSet?.projectId ?? null,
      productProfileId: profile?.productId ?? null,
      marketingBriefId: brief?.marketingBriefId ?? null,
      researchId: research?.researchId ?? null,
      deepIntelligenceId: intel?.intelligenceId ?? null,
      visualAnalysisId: visual?.analysisId ?? intel?.visualAnalysisId ?? null,
      productionPackageRef: input.production?.packageId ?? intel?.productionPackageRef ?? null,
    },
    identity,
    verifiedFacts: facts,
    visualIntelligence,
    features,
    characteristics,
    variants,
    specifications,
    differentiators,
    benefits,
    customerIntelligence,
    marketIntelligence,
    competitiveIntelligence,
    productKnowledge,
    marketingInsights,
    creativeDirection,
    contentOpportunities,
    ctaDirection,
    claimSafety,
    restrictions,
    missingInformation,
    uncertainty,
    sources,
    sectionConfidence,
    scores,
    phase3Complete: false,
    readyForContentProduction: false,
    userConfirmed: false,
    confirmedAt: null,
    history,
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };
}

export function buildAiMeMasterExplanation(pkg: MasterProductIntelligence): string {
  const verified = [
    pkg.verifiedFacts.productName && `The product is ${pkg.verifiedFacts.productName}`,
    pkg.verifiedFacts.brand && `brand ${pkg.verifiedFacts.brand}`,
    pkg.verifiedFacts.materials.length && `confirmed by the user as ${pkg.verifiedFacts.materials.join(", ")}`,
  ].filter(Boolean).join(", ");
  const visual = [
    pkg.visualIntelligence.color && `Visual analysis supports ${pkg.visualIntelligence.color}`,
    pkg.visualIntelligence.visibleFeatures[0] && `and shows ${pkg.visualIntelligence.visibleFeatures.slice(0, 2).join(", ")}`,
  ].filter(Boolean).join(" ");
  const research = pkg.marketIntelligence.find((m) => m.label !== "MARKET DATA INSUFFICIENT");
  const researchLine = research
    ? `Research indicates ${research.detail} — treated as category context, not a guaranteed fact about this specific product.`
    : "Reliable market statistics were not available.";
  const safe = pkg.claimSafety.filter((c) => c.status === "SAFE / VERIFIED").slice(0, 3).map((c) => c.claim);
  const avoid = pkg.claimSafety.filter((c) => c.status === "DO NOT USE" || c.status === "UNVERIFIED").slice(0, 3).map((c) => c.claim);
  return [
    `${verified}.`,
    visual ? `${visual}.` : "",
    researchLine,
    safe.length ? `Safe claims: ${safe.join("; ")}.` : "",
    avoid.length ? `Avoid or review: ${avoid.join("; ")}.` : "",
    `Missing information: ${pkg.missingInformation.length} items (${pkg.missingInformation.filter((m) => m.severity === "CRITICAL").length} critical).`,
    `Master Intelligence Confidence: ${pkg.sectionConfidence.overall}%. Score: ${pkg.scores.overall}%.`,
    pkg.userConfirmed ? "User confirmed this package." : "Not yet confirmed by the user.",
    "Recommendations do not overwrite the Marketing Brief. This is a creative brief, not a storyboard or video.",
  ].filter(Boolean).join(" ");
}
