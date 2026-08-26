/**
 * Product market & customer research helpers for Phase 3 Step 3.
 * Extends Knowledge Research Engine — does not replace Online Research domains
 * (those remain creative-production scoped). This module generates product-specific
 * queries and local category knowledge used with Knowledge Foundation catalogs.
 */

export type SourceQuality = "HIGH" | "MEDIUM" | "LOW";
export type KnowledgeKind = "researched-fact" | "market-insight" | "ai-inference" | "user-provided-fact";
export type Freshness = "CURRENT" | "RECENT" | "AGING" | "STALE" | "UNKNOWN";
export type EvidenceLevel = "high" | "medium" | "low" | "insufficient";

export interface ProductResearchContext {
  productName: string;
  category: string;
  brand: string;
  features: string[];
  audience: string;
  objective: string;
  platforms: string[];
  language: string;
  promotion: string;
  verifiedColors: string[];
}

export interface ResearchQuery {
  id: string;
  text: string;
  objective: string;
}

const STOP = new Set(["the", "and", "for", "with", "product"]);

export function generateResearchQueries(ctx: ProductResearchContext): ResearchQuery[] {
  const cat = (ctx.category || "product").trim().toLowerCase();
  if (!cat || cat === "unspecified") return [];
  const noun = cat.replace(/s$/, "");
  const seeds: Array<[string, string]> = [
    [`${cat} customer needs`, "Customer needs"],
    [`${cat} buying factors`, "Buying motivations"],
    [`${cat} common objections`, "Objections"],
    [`${cat} marketing angles`, "Marketing angles"],
    [`${cat} customer preferences`, "Customer preferences"],
    [`${cat} product benefits`, "Common product benefits"],
    [`${cat} industry terminology`, "Product terminology"],
    [`${noun} category knowledge`, "Product category knowledge"],
  ];
  if (ctx.audience) seeds.push([`${cat} ${ctx.audience} marketing`, "Target audience"]);
  if (ctx.objective) seeds.push([`${cat} ${ctx.objective} campaign`, "Campaign objective"]);
  if (ctx.platforms[0]) seeds.push([`${ctx.platforms[0]} ${cat} content`, "Platform intelligence"]);
  if (ctx.promotion && !/none|n\/a/i.test(ctx.promotion)) {
    seeds.push([`${cat} ${ctx.promotion} promotion messaging`, "Promotion"]);
  }
  for (const f of ctx.features.slice(0, 2)) {
    if (f.length > 2) seeds.push([`${cat} ${f}`, "Product features"]);
  }
  return dedupeQueries(
    seeds.map(([text, objective], i) => ({ id: `q-${i + 1}`, text, objective })),
  );
}

export function dedupeQueries(queries: ResearchQuery[]): ResearchQuery[] {
  const seen = new Set<string>();
  const out: ResearchQuery[] = [];
  for (const q of queries) {
    const key = q.text.toLowerCase().replace(/\s+/g, " ").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ ...q, text: key });
  }
  return out;
}

export function classifySourceQuality(input: {
  official?: boolean;
  documentation?: boolean;
  curatedKnowledgeBase?: boolean;
  anonymous?: boolean;
  trustScore?: number;
}): SourceQuality {
  if (input.anonymous) return "LOW";
  if (input.official || input.documentation) return "HIGH";
  if (input.curatedKnowledgeBase || (input.trustScore ?? 0) >= 80) return "HIGH";
  if ((input.trustScore ?? 0) >= 55) return "MEDIUM";
  return "LOW";
}

export function freshnessFromIso(iso: string | undefined, now = Date.now()): Freshness {
  if (!iso) return "UNKNOWN";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "UNKNOWN";
  const days = (now - t) / 86_400_000;
  if (days <= 30) return "CURRENT";
  if (days <= 180) return "RECENT";
  if (days <= 365) return "AGING";
  return "STALE";
}

export function knowledgeDedupeKey(claim: string): string {
  return claim
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOP.has(w))
    .join("-")
    .slice(0, 120);
}

/** Category-local educational knowledge — not live market statistics. */
export function localCategoryKnowledge(category: string): Array<{
  topic: string;
  claim: string;
  kind: KnowledgeKind;
  confidence: number;
  relevance: "product" | "market" | "customer";
}> {
  const c = category.toLowerCase();
  const pack: Array<{ topic: string; claim: string; kind: KnowledgeKind; confidence: number; relevance: "product" | "market" | "customer" }> = [
    {
      topic: "Customer buying factor",
      claim: "Buyers commonly weigh quality, price, and whether the product matches their use case before purchasing.",
      kind: "market-insight",
      confidence: 0.72,
      relevance: "customer",
    },
  ];
  if (/shoe|sneaker|footwear|boot/.test(c)) {
    pack.push(
      { topic: "Customer buying factor", claim: "Comfort is a common consideration when purchasing everyday footwear.", kind: "market-insight", confidence: 0.78, relevance: "customer" },
      { topic: "Objection", claim: "Sizing uncertainty is a common concern for footwear purchased remotely.", kind: "market-insight", confidence: 0.7, relevance: "customer" },
      { topic: "Terminology", claim: "Footwear marketing often refers to upper, sole, cushioning, and fit.", kind: "researched-fact", confidence: 0.8, relevance: "product" },
    );
  } else if (/bag|handbag|backpack|tote/.test(c)) {
    pack.push(
      { topic: "Customer need", claim: "Capacity, durability of straps, and organization are common bag purchase considerations.", kind: "market-insight", confidence: 0.74, relevance: "customer" },
      { topic: "Objection", claim: "Buyers may question material durability and zipper quality.", kind: "market-insight", confidence: 0.68, relevance: "customer" },
    );
  } else if (/phone|laptop|electronic|headphone/.test(c)) {
    pack.push(
      { topic: "Objection", claim: "Compatibility, warranty, and authenticity are common electronics buying concerns.", kind: "market-insight", confidence: 0.76, relevance: "customer" },
      { topic: "Decision factor", claim: "Performance and ease of use frequently influence electronics decisions.", kind: "market-insight", confidence: 0.7, relevance: "customer" },
    );
  } else if (/apparel|shirt|dress|jacket|clothing/.test(c)) {
    pack.push(
      { topic: "Customer need", claim: "Fit, fabric feel, and appearance are common clothing purchase considerations.", kind: "market-insight", confidence: 0.74, relevance: "customer" },
      { topic: "Objection", claim: "Sizing and color accuracy are common remote-purchase concerns for apparel.", kind: "market-insight", confidence: 0.7, relevance: "customer" },
    );
  }
  return pack;
}

export function band(n: number): "high" | "medium" | "low" {
  if (n >= 0.8) return "high";
  if (n >= 0.65) return "medium";
  return "low";
}
