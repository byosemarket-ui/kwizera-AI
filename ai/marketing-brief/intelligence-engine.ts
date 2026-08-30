import type { CanonicalProduct } from "../product-record/types.js";
import { humanizeValue } from "../product-record/humanize.js";
import type { CreativeProject } from "../creative-workspace/creative-workspace-manager.js";
import type {
  BriefRecommendation,
  ClaimSource,
  MarketingIntelligenceBlock,
  ProvenanceClaim,
} from "./types.js";
import { objectiveCodeFromLabel, presetsForPlatforms, suggestedOutputFromPlatforms } from "./platform-presets.js";

const UNSUPPORTED_UNLESS_CONFIRMED = [
  /italian/i,
  /waterproof/i,
  /handmade|hand[- ]made/i,
  /medical|orthopedic|orthopaedic/i,
  /100%\s*premium/i,
  /genuine\s+italian/i,
  /certified/i,
  /guaranteed/i,
];

function claim(text: string, source: ClaimSource, confidence: number, reason?: string): ProvenanceClaim {
  return { text: text.trim(), source, confidence, reason };
}

function uniqueClaims(values: ProvenanceClaim[]): ProvenanceClaim[] {
  const seen = new Set<string>();
  const out: ProvenanceClaim[] = [];
  for (const item of values) {
    const key = item.text.toLowerCase();
    if (!item.text || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function confirmedCorpus(project: CreativeProject, product: CanonicalProduct): string {
  return [
    project.productInformation.name,
    project.productInformation.category,
    project.productInformation.description,
    project.productInformation.brand,
    product.identity.name,
    product.identity.brand,
    product.identity.category,
    product.marketingData.sellingPoints.join(" "),
    product.productFeatures.join(" "),
    product.visualAnalysis.materials.join(" "),
  ].join(" ");
}

function allowed(text: string, corpus: string): boolean {
  for (const pattern of UNSUPPORTED_UNLESS_CONFIRMED) {
    if (pattern.test(text) && !pattern.test(corpus)) return false;
  }
  return Boolean(text.trim());
}

function rec(
  field: string,
  label: string,
  value: string | string[],
  why: string,
  confidence: number,
  basis: string,
): BriefRecommendation {
  return {
    id: `rec_${field}_${Math.abs(hash(String(Array.isArray(value) ? value.join("|") : value))).toString(36)}`,
    field,
    label,
    value,
    why,
    source: "INFERRED",
    reasoningBasis: basis,
    confidence,
    status: "PENDING",
  };
}

function hash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) h = (h * 31 + value.charCodeAt(i)) | 0;
  return h;
}

function visualAppearance(product: CanonicalProduct): string[] {
  const colours = product.visualAnalysis.colours.map((item) => `${humanizeValue(item)} visual finish`);
  const materials = product.visualAnalysis.materials.map((item) => {
    const name = humanizeValue(item);
    if (/leather/i.test(name)) return `${name} appearance`;
    return `${name} look`;
  });
  const features = product.visualAnalysis.features.map(humanizeValue);
  return [...colours, ...materials, ...features].filter(Boolean);
}

function categoryAngle(category: string): { positioning: string; angle: string; tone: string } {
  const value = category.toLowerCase();
  if (/shoe|footwear|oxford|sneaker|boot/i.test(value)) {
    return {
      positioning: "Polished footwear for everyday formal and smart-casual styling",
      angle: "STYLE_AND_CONFIDENCE",
      tone: "PROFESSIONAL",
    };
  }
  if (/apparel|fashion|bag|dress|cloth/i.test(value)) {
    return {
      positioning: "Wearable style that presents the product clearly in everyday looks",
      angle: "STYLE_AND_CONFIDENCE",
      tone: "PROFESSIONAL",
    };
  }
  if (/bottle|home|kitchen|tool|electronic/i.test(value)) {
    return {
      positioning: "Practical product presentation focused on visible use and form",
      angle: "PRACTICAL_PROOF",
      tone: "FRIENDLY",
    };
  }
  return {
    positioning: `Clear product presentation for ${category || "this product"}`,
    angle: "PRODUCT_PROOF",
    tone: "PROFESSIONAL",
  };
}

function viewLabel(view: string): string {
  return view.replace(/_/g, " ").replace(/-/g, " ");
}

export function generateMarketingIntelligence(
  project: CreativeProject,
  product: CanonicalProduct,
): { intelligence: MarketingIntelligenceBlock; recommendations: BriefRecommendation[] } {
  const corpus = confirmedCorpus(project, product);
  const userCategory = project.productInformation.category.trim();
  const categoryText = userCategory || product.identity.category || "unspecified product";
  const category = claim(
    categoryText,
    userCategory ? "CONFIRMED" : product.identity.category && product.identity.category !== "unknown" ? "INFERRED" : "INFERRED",
    userCategory ? 1 : Math.max(0.45, product.intelligence?.confidence.category ?? 0.55),
    userCategory ? "User-provided product category" : "Interpreted from product identity and visual analysis",
  );

  const name = project.productInformation.name.trim() || product.identity.name;
  const confirmedName = claim(name, name ? "CONFIRMED" : "INFERRED", name ? 1 : 0.4, "Product name");

  const visual = visualAppearance(product)
    .filter((text) => allowed(text, corpus))
    .map((text) => claim(text, "INFERRED", 0.82, "Visual analysis of uploaded product images"));

  const confirmedPoints = product.marketingData.sellingPoints
    .map(humanizeValue)
    .filter((text) => allowed(text, corpus))
    .map((text) => claim(text, "CONFIRMED", 0.95, "User-provided or verified product data"));

  const featurePoints = product.productFeatures
    .map(humanizeValue)
    .filter((text) => allowed(text, corpus))
    .map((text) => claim(
      text,
      /user|provided/i.test(text) ? "CONFIRMED" : "INFERRED",
      0.78,
      "Product feature extracted from product intelligence",
    ));

  const details = Object.entries(product.assetMap)
    .filter(([, ids]) => (ids?.length ?? 0) > 0)
    .map(([view, ids]) => claim(
      `${viewLabel(view)} view available (${ids!.length} asset${ids!.length === 1 ? "" : "s"})`,
      "CONFIRMED",
      1,
      `Canonical product asset map · ${ids!.join(", ")}`,
    ));

  const angleMeta = categoryAngle(category.text);
  const mainFromConfirmed = confirmedPoints[0];
  const mainFromVisual = visual[0];
  const mainSellingPoint = mainFromConfirmed
    ?? (mainFromVisual
      ? claim(
        `${confirmedName.text ? `${confirmedName.text}: ` : ""}${mainFromVisual.text}`,
        "INFERRED",
        0.74,
        "Derived from visible product attributes — not an unverified material claim",
      )
      : claim(
        `Present ${confirmedName.text || "the product"} with a clear, honest product view`,
        "INFERRED",
        0.6,
        "Fallback from product identity when few selling points exist",
      ));

  const supportingPoints = uniqueClaims([
    ...confirmedPoints.slice(mainFromConfirmed ? 1 : 0),
    ...visual.slice(mainFromVisual && !mainFromConfirmed ? 1 : 0),
    ...featurePoints,
  ]).slice(0, 5);

  const userAudience = (project.targetAudience || product.marketingData.targetAudience || "").trim();
  const audienceHypotheses = userAudience
    ? [claim(userAudience, "USER_DEFINED", 1, "Audience provided on the project")]
    : [
      claim(
        `People shopping for ${category.text}`,
        "INFERRED",
        0.55,
        "General category hypothesis — not a specific demographic claim",
      ),
    ];

  const userObjective = project.campaignInformation.objective.trim();
  const suggestedObjective = claim(
    userObjective || "Product Awareness",
    userObjective ? "USER_DEFINED" : "INFERRED",
    userObjective ? 1 : 0.62,
    userObjective ? "Campaign objective selected on the project" : "Default awareness objective until the user chooses otherwise",
  );

  const userCta = (project.campaignInformation.callToAction ?? "").trim();
  const code = objectiveCodeFromLabel(suggestedObjective.text);
  const inferredCta = code === "SALES" || code === "PROMOTION" ? "ORDER_NOW" : "DISCOVER_PRODUCT";
  const suggestedCta = claim(
    userCta || inferredCta,
    userCta ? "USER_DEFINED" : "INFERRED",
    userCta ? 1 : 0.7,
    userCta ? "CTA provided by the user" : "Suggested from campaign objective — not auto-applied",
  );

  const platforms = Array.isArray(project.campaignInformation.platforms)
    ? project.campaignInformation.platforms.map(String).filter(Boolean)
    : project.platform ? [project.platform] : [];
  const suggestedPlatforms = platforms.length
    ? platforms
    : /shoe|fashion|apparel|bag/i.test(category.text) ? ["Instagram", "TikTok"] : ["Facebook", "Instagram"];
  const outputHint = suggestedOutputFromPlatforms(suggestedPlatforms);
  const platformStrategy = claim(
    platforms.length
      ? `${platforms.join(", ")} with explicit ${outputHint.aspectRatio} output (platform and format are separate)`
      : `Suggested ${suggestedPlatforms.join(" + ")} with ${outputHint.aspectRatio} as a default output — user must confirm`,
    platforms.length ? "USER_DEFINED" : "INFERRED",
    platforms.length ? 1 : 0.66,
    "Platform selection is independent of aspect ratio and content format",
  );

  const positioning = claim(
    angleMeta.positioning,
    "INFERRED",
    0.68,
    "Category-based positioning from available product evidence",
  );
  const marketingAngle = claim(angleMeta.angle, "INFERRED", 0.64, "Interpreted from category and visual style");
  const suggestedTone = claim(
    project.campaignInformation.tone || angleMeta.tone,
    project.campaignInformation.tone ? "USER_DEFINED" : "INFERRED",
    project.campaignInformation.tone ? 1 : 0.6,
    "Tone suggestion from category fit",
  );
  const suggestedContentApproach = claim(
    `${outputHint.contentFormat.replace(/_/g, " ").toLowerCase()} with ${outputHint.hookStyle.replace(/-/g, " ")}`,
    "INFERRED",
    0.7,
    "Production approach from platform presets, not a product claim",
  );

  const intelligence: MarketingIntelligenceBlock = {
    category,
    positioning,
    productStrengths: uniqueClaims([confirmedName, ...confirmedPoints, ...featurePoints]).slice(0, 6),
    visualStrengths: uniqueClaims(visual).slice(0, 6),
    detailsWorthShowing: details.slice(0, 8),
    mainSellingPoint,
    supportingPoints,
    marketingAngle,
    suggestedObjective,
    suggestedTone,
    suggestedContentApproach,
    suggestedCta,
    audienceHypotheses,
    platformStrategy,
  };

  const recommendations: BriefRecommendation[] = [];
  if (!userObjective) {
    recommendations.push(rec(
      "objective",
      "Campaign objective",
      "Product Awareness",
      "Awareness is the safest default until a sales or launch goal is confirmed.",
      0.62,
      "No user objective on the product record",
    ));
  }
  if (!platforms.length) {
    recommendations.push(rec(
      "platforms",
      "Platforms",
      suggestedPlatforms,
      "Category-aware social reach for product visuals. Platforms do not lock video size.",
      0.72,
      `Category “${category.text}”`,
    ));
  }
  recommendations.push(rec(
    "aspectRatio",
    "Output aspect ratio",
    outputHint.aspectRatio,
    `Selected or suggested platforms favor ${outputHint.aspectRatio}, but the ratio stays independently editable.`,
    0.74,
    presetsForPlatforms(suggestedPlatforms).map((item) => item.platform).join(", ") || "default short-form",
  ));
  recommendations.push(rec(
    "contentFormat",
    "Content format",
    "Short Product Video",
    "The campaign objective and visual product assets favor a short product video. Format is not the same as platform.",
    0.74,
    "Platform production presets + available original assets",
  ));
  if (!userCta) {
    recommendations.push(rec(
      "cta",
      "Call to action",
      inferredCta === "ORDER_NOW" ? "Order Now" : "Learn More",
      inferredCta === "ORDER_NOW"
        ? "Sales-oriented objectives usually need a direct CTA."
        : "Awareness campaigns work with a discovery CTA until the user sets a stronger action.",
      0.7,
      `Objective code ${code}`,
    ));
  }
  if (!userAudience) {
    recommendations.push(rec(
      "audienceType",
      "Target audience",
      `People shopping for ${category.text}`,
      "A general audience hypothesis only. Specific demographics are not invented.",
      0.55,
      "Category-based audience hypothesis",
    ));
  }
  if (!project.campaignInformation.tone) {
    recommendations.push(rec(
      "tone",
      "Tone",
      /premium|luxury/i.test(corpus) ? "Premium" : angleMeta.tone === "FRIENDLY" ? "Friendly" : "Professional",
      "Tone fit from category and confirmed product language.",
      0.6,
      "Category + confirmed product copy",
    ));
  }

  return { intelligence, recommendations };
}
