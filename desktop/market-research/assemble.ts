import {
  PROFESSIONAL_CUSTOMER_PSYCHOLOGY_TOPICS,
  PROFESSIONAL_MARKETING_TOPICS,
  PROFESSIONAL_SALES_PSYCHOLOGY_TOPICS,
  findMbpTopics,
} from "../../ai/video-knowledge-engine/professional-marketing-branding-psychology-catalog";
import { PROFESSIONAL_MARKETING_BRANDING_PSYCHOLOGY_VERSION } from "../../ai/video-knowledge-engine/professional-marketing-branding-psychology-types";
import { findSmTopics, getAllSmTopics } from "../../ai/video-knowledge-engine/professional-social-media-catalog";
import { PROFESSIONAL_SOCIAL_MEDIA_VERSION } from "../../ai/video-knowledge-engine/professional-social-media-types";
import type { ProductIntelligencePackage } from "../deep-intelligence/types";
import type { MarketingProductionBrief } from "../marketing-input/types";
import {
  classifySourceQuality,
  freshnessFromIso,
  generateResearchQueries,
  knowledgeDedupeKey,
  localCategoryKnowledge,
  type ProductResearchContext,
} from "../../ai/knowledge-research-engine/product-market-research";
import type {
  InsightRow,
  KnowledgeItem,
  MarketingAngle,
  ResearchPackage,
  ResearchSource,
} from "./types";

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function buildResearchContext(
  intel: ProductIntelligencePackage,
  brief: MarketingProductionBrief | null,
): ProductResearchContext {
  const fields = brief?.fields;
  return {
    productName: intel.productName,
    category: intel.verifiedFacts.find((f) => f.field === "Category")?.value || "",
    brand: intel.verifiedFacts.find((f) => f.field === "Brand")?.value || "",
    features: intel.features.map((f) => f.field).slice(0, 6),
    audience: [fields?.audienceType, fields?.customerSegment, fields?.interests?.join(" ")].filter(Boolean).join(" "),
    objective: fields?.objective || "",
    platforms: [...(fields?.platforms ?? []), fields?.customPlatform ?? ""].filter(Boolean),
    language: fields?.language || fields?.languageOther || "English",
    promotion: [fields?.promotionType, fields?.promotionDetails].filter(Boolean).join(" "),
    verifiedColors: intel.verifiedFacts.find((f) => f.field === "Colors")?.value.split(", ") ?? [],
  };
}

export function assembleResearchPackage(input: {
  researchId: string;
  versionNumber: number;
  versionLabel: string;
  internetAvailable: boolean;
  usedLocalKnowledge: boolean;
  intel: ProductIntelligencePackage;
  brief: MarketingProductionBrief | null;
  history: ResearchPackage["history"];
}): ResearchPackage {
  const ctx = buildResearchContext(input.intel, input.brief);
  const queries = generateResearchQueries(ctx);
  const retrievedAt = new Date().toISOString();
  const catalogAge = `MBP ${PROFESSIONAL_MARKETING_BRANDING_PSYCHOLOGY_VERSION} · Social ${PROFESSIONAL_SOCIAL_MEDIA_VERSION}`;
  const localAge = catalogAge;

  const mbpPool = [
    ...PROFESSIONAL_CUSTOMER_PSYCHOLOGY_TOPICS,
    ...PROFESSIONAL_SALES_PSYCHOLOGY_TOPICS,
    ...PROFESSIONAL_MARKETING_TOPICS,
  ];
  const queryText = queries.map((q) => q.text).join(" ");
  const mbpHits = findMbpTopics(`${ctx.category} ${ctx.audience} customer buying ${queryText}`, mbpPool).slice(0, 10);
  const platformQuery = ctx.platforms.join(" ") || "social media fundamentals";
  const smHits = findSmTopics(platformQuery, getAllSmTopics()).slice(0, 8);

  const sources: ResearchSource[] = [];
  const knowledge: KnowledgeItem[] = [];
  const seen = new Set<string>();

  function addSource(partial: Omit<ResearchSource, "id" | "action" | "retrievedAt">): ResearchSource {
    const src: ResearchSource = { ...partial, id: uid("src"), action: "pending", retrievedAt };
    sources.push(src);
    return src;
  }

  function addKnowledge(item: Omit<KnowledgeItem, "id" | "createdAt">): void {
    const key = knowledgeDedupeKey(item.claim);
    if (!key || seen.has(key)) return;
    seen.add(key);
    knowledge.push({ ...item, id: uid("kn"), createdAt: retrievedAt });
  }

  const kbQuality = classifySourceQuality({ curatedKnowledgeBase: true, trustScore: 90 });
  const kbSource = addSource({
    url: "local://knowledge-foundation/marketing-branding-psychology",
    title: "Professional Marketing, Branding & Customer Psychology (local Knowledge Base)",
    sourceType: "curated-knowledge-base",
    domain: "local-knowledge",
    publishedAt: null,
    quality: kbQuality,
    query: "local knowledge memory",
    extracted: `${mbpHits.length} matched customer/marketing topics`,
    relevance: 0.88,
    confidence: 0.9,
  });

  for (const topic of mbpHits) {
    addKnowledge({
      topic: topic.name,
      claim: topic.professionalDefinition || topic.description,
      kind: "researched-fact",
      sourceId: kbSource.id,
      sourceQuality: "HIGH",
      confidence: Math.min(0.95, topic.confidenceScore / 100),
      lastVerified: null,
      freshness: freshnessFromIso(undefined),
      objective: "Customer/marketing knowledge",
      productRelevance: /product/i.test(topic.keywords.join(" ")),
      marketRelevance: true,
      customerRelevance: /customer|buy|decision/i.test(`${topic.name} ${topic.keywords.join(" ")}`),
      tags: topic.keywords.slice(0, 5),
    });
  }

  const smSource = addSource({
    url: "local://knowledge-foundation/social-media",
    title: "Professional Social Media Knowledge (local Knowledge Base)",
    sourceType: "curated-knowledge-base",
    domain: "local-knowledge",
    publishedAt: null,
    quality: "HIGH",
    query: platformQuery,
    extracted: `${smHits.length} platform topics`,
    relevance: smHits.length ? 0.85 : 0.4,
    confidence: 0.86,
  });

  for (const topic of smHits) {
    addKnowledge({
      topic: topic.name,
      claim: topic.description,
      kind: "researched-fact",
      sourceId: smSource.id,
      sourceQuality: "HIGH",
      confidence: 0.82,
      lastVerified: null,
      freshness: freshnessFromIso(undefined),
      objective: "Platform intelligence",
      productRelevance: false,
      marketRelevance: true,
      customerRelevance: true,
      tags: topic.keywords.slice(0, 4),
    });
  }

  const catPack = localCategoryKnowledge(ctx.category);
  const catSource = addSource({
    url: "local://knowledge-research-engine/product-market-category-pack",
    title: `Category educational pack — ${ctx.category || "general"}`,
    sourceType: "local-category-knowledge",
    domain: "local-knowledge",
    publishedAt: null,
    quality: "MEDIUM",
    query: queries[0]?.text ?? ctx.category,
    extracted: `${catPack.length} category insights (not live statistics)`,
    relevance: catPack.length ? 0.8 : 0.3,
    confidence: 0.7,
  });

  for (const row of catPack) {
    addKnowledge({
      topic: row.topic,
      claim: row.claim,
      kind: row.kind,
      sourceId: catSource.id,
      sourceQuality: "MEDIUM",
      confidence: row.confidence,
      lastVerified: null,
      freshness: "UNKNOWN",
      objective: row.topic,
      productRelevance: row.relevance === "product",
      marketRelevance: row.relevance === "market",
      customerRelevance: row.relevance === "customer",
      tags: [ctx.category],
    });
  }

  for (const fact of input.intel.verifiedFacts.slice(0, 8)) {
    addKnowledge({
      topic: fact.field,
      claim: `${fact.field}: ${fact.value}`,
      kind: "user-provided-fact",
      sourceId: kbSource.id,
      sourceQuality: "HIGH",
      confidence: 1,
      lastVerified: retrievedAt,
      freshness: "CURRENT",
      objective: "Verified product profile",
      productRelevance: true,
      marketRelevance: false,
      customerRelevance: false,
      tags: ["verified"],
    });
  }

  if (!mbpHits.length && !smHits.length && !catPack.length) {
    /* noLocalKnowledge handled below */
  }

  const toInsight = (k: KnowledgeItem, extra?: Partial<InsightRow>): InsightRow => ({
    id: uid("ins"),
    label: k.topic,
    detail: k.claim,
    kind: k.kind,
    confidence: k.confidence,
    evidenceLevel: k.confidence >= 0.8 ? "high" : k.confidence >= 0.65 ? "medium" : "low",
    sourceOrReason: sources.find((s) => s.id === k.sourceId)?.title ?? "Local knowledge",
    reviewed: false,
    ...extra,
  });

  const customerInsights = knowledge.filter((k) => k.customerRelevance && k.kind !== "user-provided-fact").slice(0, 12).map((k) => toInsight(k));
  const marketInsights = knowledge.filter((k) => k.marketRelevance && k.kind !== "user-provided-fact").slice(0, 9).map((k) => toInsight(k));

  const painPoints: InsightRow[] = knowledge
    .filter((k) => /objection|concern|uncertainty|sizing|price|durability|comfort|quality|authentic|warranty|compat/i.test(`${k.topic} ${k.claim}`))
    .slice(0, 8)
    .map((k) => toInsight(k, { label: k.topic }));

  const desires: InsightRow[] = knowledge
    .filter((k) => /need|comfort|quality|appearance|durability|performance|ease|convenience/i.test(`${k.topic} ${k.claim}`))
    .slice(0, 8)
    .map((k) => toInsight(k));

  const motivations: InsightRow[] = [
    ...knowledge.filter((k) => /buy|motivat|decision|need/i.test(k.topic)).slice(0, 4).map((k) => toInsight(k)),
  ];
  if (input.brief?.fields.buyingIntent) {
    motivations.unshift({
      id: uid("ins"),
      label: "User-provided buying intent",
      detail: input.brief.fields.buyingIntent,
      kind: "user-provided-fact",
      confidence: 1,
      evidenceLevel: "high",
      sourceOrReason: "Marketing Brief",
      reviewed: false,
    });
  }

  const objections: InsightRow[] = painPoints.slice(0, 6);

  const competitiveInsights: InsightRow[] = [
    {
      id: uid("ins"),
      label: "Competitive positioning",
      detail: "Common public claims in this category often emphasize quality, price, and convenience. This is strategic context — not a statement about your product and not copied competitor copy.",
      kind: "market-insight",
      confidence: 0.58,
      evidenceLevel: "low",
      sourceOrReason: "Category pattern from local knowledge — INSUFFICIENT EVIDENCE for named competitors",
      reviewed: false,
    },
  ];

  const insufficientMarketData = marketInsights.filter((m) => m.kind === "researched-fact").length === 0;
  if (insufficientMarketData) {
    marketInsights.unshift({
      id: uid("ins"),
      label: "Market data",
      detail: "INSUFFICIENT VERIFIED MARKET DATA — no live market statistics were collected. Do not invent percentages or demand figures.",
      kind: "ai-inference",
      confidence: 0.4,
      evidenceLevel: "insufficient",
      sourceOrReason: input.internetAvailable ? "Online probe did not return verified statistics" : "Offline local knowledge only",
      reviewed: false,
    });
  }

  const userAudience = ctx.audience || "Not specified";
  const comfort = knowledge.find((k) => /comfort/i.test(k.claim));
  const audienceRefinement = comfort
    ? `USER TARGET: ${userAudience}. RESEARCH: Comfort and related practical factors appear as common purchase considerations in local category knowledge. Recommended insight (does not change the brief): “Emphasize comfort and durability alongside visual style” only if those attributes are verified for this product.`
    : `USER TARGET: ${userAudience}. No automatic audience change. Use research as optional refinement only.`;

  const verifiedBenefit = input.intel.benefits.find((b) => b.kind === "verified");
  const visualBenefit = input.intel.benefits.find((b) => b.kind === "ai-observation");
  const inferredBenefit = input.intel.benefits.find((b) => b.kind === "ai-inference");

  const marketingAngles: MarketingAngle[] = [];
  if (verifiedBenefit) {
    marketingAngles.push({
      id: uid("ang"),
      name: "Verified benefit",
      customerProblem: input.brief?.fields.customerNeeds || "Customer is evaluating whether the offer matches their need",
      productBenefit: verifiedBenefit.value,
      supportingEvidence: "User-confirmed Product Profile",
      audience: userAudience,
      suggestedMessage: verifiedBenefit.value,
      confidence: 0.9,
      sourceIds: [kbSource.id],
      verificationFlag: null,
    });
  }
  if (visualBenefit) {
    marketingAngles.push({
      id: uid("ang"),
      name: "Visual signal",
      customerProblem: "Customer wants to see what the product looks like in use",
      productBenefit: visualBenefit.value,
      supportingEvidence: visualBenefit.reason,
      audience: userAudience,
      suggestedMessage: visualBenefit.value,
      confidence: visualBenefit.confidence,
      sourceIds: [catSource.id],
      verificationFlag: null,
    });
  }
  if (inferredBenefit) {
    marketingAngles.push({
      id: uid("ang"),
      name: "Unverified product signal",
      customerProblem: "Need inferred from appearance only",
      productBenefit: inferredBenefit.value,
      supportingEvidence: inferredBenefit.reason,
      audience: userAudience,
      suggestedMessage: `Appears designed for everyday use — verify before stating as a product claim. (${inferredBenefit.value})`,
      confidence: inferredBenefit.confidence,
      sourceIds: [catSource.id],
      verificationFlag: "Do not state inferred attributes as factual product claims",
    });
  }
  if (comfort && !inferredBenefit) {
    marketingAngles.push({
      id: uid("ang"),
      name: "Comfort + Style",
      customerProblem: "Comfortable everyday use",
      productBenefit: "Category research lists comfort as a common consideration — not a verified feature of this SKU unless the profile says so",
      supportingEvidence: comfort.claim,
      audience: userAudience,
      suggestedMessage: "Everyday comfort without giving up style — only if comfort is verified for this product.",
      confidence: 0.62,
      sourceIds: [catSource.id],
      verificationFlag: "Flag for verification if comfort is not a user-confirmed fact",
    });
  }

  const platformNotes: InsightRow[] = smHits.slice(0, 5).map((t) => ({
    id: uid("ins"),
    label: t.name,
    detail: t.description,
    kind: "researched-fact" as const,
    confidence: 0.8,
    evidenceLevel: "medium" as const,
    sourceOrReason: `Local social media knowledge · ${t.topicId}`,
    reviewed: false,
  }));
  if (!platformNotes.length && ctx.platforms.length) {
    platformNotes.push({
      id: uid("ins"),
      label: ctx.platforms.join(", "),
      detail: "INSUFFICIENT EVIDENCE for live platform algorithm rules. User-selected platform is recorded; no hardcoded unsupported rules were applied.",
      kind: "ai-inference",
      confidence: 0.4,
      evidenceLevel: "insufficient",
      sourceOrReason: "Marketing Brief platform field",
      reviewed: false,
    });
  }

  const researchMode = input.internetAvailable && input.usedLocalKnowledge
    ? "hybrid"
    : input.internetAvailable
      ? "online"
      : "offline";

  const noLocalKnowledge = knowledge.filter((k) => k.kind !== "user-provided-fact").length === 0;

  return {
    version: 1,
    researchId: input.researchId,
    versionLabel: input.versionLabel,
    versionNumber: input.versionNumber,
    engineId: "knowledge-research-engine+product-market-research+local-knowledge",
    projectId: input.intel.projectId,
    productId: input.intel.productId,
    projectName: input.intel.projectName,
    productName: input.intel.productName,
    internetAvailable: input.internetAvailable,
    researchMode,
    workingLanguage: ctx.language || "English",
    queries,
    sources,
    knowledge,
    productKnowledge: knowledge.filter((k) => k.productRelevance || k.kind === "user-provided-fact"),
    customerInsights,
    marketInsights,
    competitiveInsights,
    painPoints,
    desires,
    motivations,
    objections,
    audienceRefinement,
    marketingAngles,
    platformNotes,
    localKnowledgeAge: input.usedLocalKnowledge ? localAge : null,
    insufficientMarketData,
    noLocalKnowledge,
    history: input.history,
    status: "complete",
    createdAt: retrievedAt,
    updatedAt: retrievedAt,
  };
}

export { generateResearchQueries };
