/**
 * STEP 7 structured product understanding.
 * Combines user facts, image observations, and labeled inferences.
 * Does not invent prices, discounts, guarantees, or certifications.
 */
import type { CreativeProject } from "../creative-workspace/creative-workspace-manager.js";
import type { ImageIntelligenceProfile } from "../image-intelligence/types.js";
import type { ProductIntelligenceProfile } from "./types.js";
import {
  PRODUCT_INTELLIGENCE_VERSION,
  type CreativeAngle,
  type CustomerIntelligence,
  type MarketingDirection,
  type ProvenanceStatement,
  type StructuredValueProposition,
} from "./types.js";

const VERIFICATION = /verification|requires confirmation|not determined|unknown/i;

export function enrichProductIntelligence(
  project: CreativeProject,
  profile: ProductIntelligenceProfile,
  imageProfiles: ImageIntelligenceProfile[],
  previousProfileId?: string,
): ProductIntelligenceProfile {
  const userFacts = collectUserFacts(project);
  const imageObservations = collectImageObservations(imageProfiles);
  const inferences = collectInferences(project, profile, imageProfiles, userFacts);
  const marketingDirections = selectMarketingDirections(project, profile, imageProfiles, userFacts);
  const customer = buildCustomerIntelligence(project, profile, marketingDirections);
  const valueProposition = buildValueProposition(project, profile, userFacts, inferences, marketingDirections);
  const creativeAngles = rankCreativeAngles(project, profile, imageProfiles, marketingDirections, userFacts);
  const recommendations = [
    ...marketingDirections.filter((item) => item.recommended).map((item) => ({
      field: "marketing-direction",
      value: item.id,
      kind: "marketing-recommendation" as const,
      confidence: item.confidence,
      source: item.evidence.join("; "),
    })),
    ...profile.photoRecommendations.map((item) => ({
      field: "photo-recommendation",
      value: `${item.view}: ${item.reason}`,
      kind: "marketing-recommendation" as const,
      confidence: item.priority === "high" ? 80 : item.priority === "medium" ? 60 : 40,
    })),
  ];

  const visionUnavailable = imageProfiles.some(
    (item) => item.aiVisionStatus === "IMAGE_ANALYSIS_UNAVAILABLE" || item.aiVisionStatus === "not-configured",
  );
  const hasPartial = !userFacts.length || !imageObservations.length || profile.missingInformation.some((item) => item.severity === "critical");
  const analysisState = hasPartial ? "partial" : "ready";

  return {
    ...profile,
    productId: profile.productId || project.id,
    analysisState,
    analysisVersion: PRODUCT_INTELLIGENCE_VERSION,
    aiInferenceStatus: visionUnavailable ? "IMAGE_ANALYSIS_UNAVAILABLE" : "deterministic-only",
    userFacts,
    imageObservations,
    inferences,
    recommendations,
    valueProposition,
    customerIntelligence: customer,
    marketingDirections,
    creativeAngles,
    productProvenance: {
      analysisType: "product-intelligence",
      analysisVersion: PRODUCT_INTELLIGENCE_VERSION,
      provider: "kwizera-product-intelligence",
      timestamp: profile.updatedAt,
      previousProfileId,
      imageProfileIds: imageProfiles.map((item) => item.id),
    },
  };
}

function collectUserFacts(project: CreativeProject): ProvenanceStatement[] {
  const info = project.productInformation;
  const facts: ProvenanceStatement[] = [];
  const push = (field: string, value: string | undefined | null, confidence = 98) => {
    const text = typeof value === "string" ? value.trim() : value != null ? String(value) : "";
    if (!text) return;
    facts.push({ field, value: text, kind: "user-provided", confidence, source: "product-information" });
  };
  push("name", info.name);
  push("category", info.category);
  push("description", info.description || info.shortDescription);
  push("brand", info.brand || project.brandInformation.name);
  if (typeof info.price === "number" && Number.isFinite(info.price)) {
    push("price", `${info.price}${info.currency ? ` ${info.currency}` : ""}`, 99);
  }
  for (const material of info.materials ?? []) push("material", material, 96);
  for (const color of info.colors ?? []) push("color", color, 96);
  for (const feature of info.features ?? []) push("feature", feature, 97);
  for (const benefit of info.benefits ?? []) push("benefit", benefit, 97);
  push("audience", project.targetAudience.trim() || undefined, 95);
  push("campaign-objective", project.campaignInformation.objective?.trim() || undefined, 94);
  push("call-to-action", project.campaignInformation.callToAction?.trim() || undefined, 94);
  return facts;
}

function collectImageObservations(imageProfiles: ImageIntelligenceProfile[]): ProvenanceStatement[] {
  const statements: ProvenanceStatement[] = [];
  for (const profile of imageProfiles) {
    for (const observation of profile.observations ?? []) {
      if (observation.kind !== "observed-from-image") continue;
      statements.push({
        field: observation.field,
        value: observation.value,
        kind: "observed-from-image",
        confidence: observation.confidence,
        source: profile.fileName,
        assetId: profile.imageId,
      });
    }
    for (const color of profile.colors ?? []) {
      if (color.kind && color.kind !== "observed-from-image") continue;
      statements.push({
        field: "visible-color",
        value: color.name,
        kind: "observed-from-image",
        confidence: color.confidence,
        source: profile.fileName,
        assetId: profile.imageId,
      });
    }
    if (profile.visualMetrics?.lightingObserved) {
      statements.push({
        field: "lighting",
        value: profile.visualMetrics.lightingObserved,
        kind: "observed-from-image",
        confidence: profile.visualMetrics.pixelAnalysisAvailable ? 78 : 50,
        source: profile.fileName,
        assetId: profile.imageId,
      });
    }
    if (profile.visualMetrics?.backgroundObserved) {
      statements.push({
        field: "background",
        value: profile.visualMetrics.backgroundObserved,
        kind: "observed-from-image",
        confidence: profile.visualMetrics.pixelAnalysisAvailable ? 72 : 48,
        source: profile.fileName,
        assetId: profile.imageId,
      });
    }
  }
  return uniqueStatements(statements);
}

function collectInferences(
  project: CreativeProject,
  profile: ProductIntelligenceProfile,
  imageProfiles: ImageIntelligenceProfile[],
  userFacts: ProvenanceStatement[],
): ProvenanceStatement[] {
  const userFields = new Set(userFacts.map((item) => `${item.field}:${item.value.toLowerCase()}`));
  const statements: ProvenanceStatement[] = [];
  const push = (field: string, value: string, confidence: number, source: string) => {
    if (!value || VERIFICATION.test(value)) return;
    if (userFields.has(`${field}:${value.toLowerCase()}`)) return;
    statements.push({ field, value, kind: "inferred", confidence, source });
  };

  push("category", profile.category, userFacts.some((item) => item.field === "category") ? 88 : 62, "product-classification");
  push("product-type", profile.productType, 64, "product-classification");
  for (const material of profile.materials.filter((item) => !VERIFICATION.test(item))) {
    if (!(project.productInformation.materials ?? []).includes(material)) {
      push("material", material, 58, "description-heuristic");
    }
  }
  for (const colour of profile.colours.filter((item) => !VERIFICATION.test(item))) {
    if (!(project.productInformation.colors ?? []).includes(colour)) {
      push("color", colour, 55, "filename-or-description-heuristic");
    }
  }
  for (const shape of profile.shapes.filter((item) => !VERIFICATION.test(item))) {
    push("shape", shape, 52, "description-heuristic");
  }
  for (const fn of profile.functions.filter((item) => !VERIFICATION.test(item))) {
    push("use", fn, 54, "function-heuristic");
  }
  if (!project.targetAudience.trim()) {
    push("audience", inferredAudience(profile), 42, "category-heuristic");
  }
  const vision = imageProfiles.find((item) => item.aiVisionStatus);
  if (vision?.aiVisionStatus === "IMAGE_ANALYSIS_UNAVAILABLE") {
    push("vision-limit", "Advanced visual product identity is unavailable without a vision provider", 100, "provider-status");
  }
  return uniqueStatements(statements);
}

function selectMarketingDirections(
  project: CreativeProject,
  profile: ProductIntelligenceProfile,
  imageProfiles: ImageIntelligenceProfile[],
  userFacts: ProvenanceStatement[],
): MarketingDirection[] {
  const evidenceText = [
    project.productInformation.name,
    project.productInformation.category,
    project.productInformation.description,
    profile.identifiedAs,
    profile.productType,
    profile.materials.join(" "),
    profile.features.join(" "),
    profile.functions.join(" "),
    project.targetAudience,
    project.campaignInformation.objective,
  ].join(" ").toLowerCase();
  const hasLifestyleView = imageProfiles.some((item) => /lifestyle/i.test(item.viewRole));
  const hasPrice = userFacts.some((item) => item.field === "price");
  const hasPromo = /promo|discount|offer|sale/i.test(project.campaignInformation.notes ?? "")
    || Boolean(project.productInformation.discount);
  const candidates: Array<{ id: MarketingDirection["id"]; evidence: string[]; confidence: number }> = [
    {
      id: "premium",
      evidence: matchEvidence(evidenceText, [/leather|steel|premium|luxury|gold/i], profile.materials.filter((item) => /leather|steel/i.test(item))),
      confidence: 0,
    },
    {
      id: "practical",
      evidence: matchEvidence(evidenceText, [/portable|insulated|everyday|durable|utility/i], profile.functions),
      confidence: 0,
    },
    {
      id: "lifestyle",
      evidence: [
        ...(hasLifestyleView ? ["lifestyle product view is available"] : []),
        ...(/urban|everyday|lifestyle|active/i.test(evidenceText) ? ["audience or description suggests lifestyle use"] : []),
      ],
      confidence: 0,
    },
    {
      id: "fashion",
      evidence: matchEvidence(evidenceText, [/apparel|fashion|shoe|clothing|wear/i], profile.category === "Apparel" ? ["classified as apparel"] : []),
      confidence: 0,
    },
    {
      id: "performance",
      evidence: matchEvidence(evidenceText, [/performance|insulated|waterproof|sport|active/i], profile.features),
      confidence: 0,
    },
    {
      id: "convenience",
      evidence: matchEvidence(evidenceText, [/portable|easy|convenient|everyday|on-the-go/i], profile.functions),
      confidence: 0,
    },
    {
      id: "gift",
      evidence: matchEvidence(evidenceText, [/gift|present/i], []),
      confidence: 0,
    },
    {
      id: "business",
      evidence: matchEvidence(
        evidenceText,
        [/professional|business|office|linkedin/i],
        project.platform === "linkedin" ? ["platform is LinkedIn"] : [],
      ),
      confidence: 0,
    },
    {
      id: "promotional",
      evidence: [
        ...(hasPromo ? ["user provided promotional information"] : []),
        ...(hasPrice && project.campaignInformation.callToAction ? ["user provided price and call to action"] : []),
      ],
      confidence: 0,
    },
  ];

  return candidates.map((item) => {
    const confidence = Math.min(90, item.evidence.length * 28);
    return {
      id: item.id,
      recommended: item.evidence.length > 0 && confidence >= 28,
      evidence: item.evidence,
      confidence,
    };
  }).filter((item) => item.recommended || item.evidence.length > 0);
}

function buildCustomerIntelligence(
  project: CreativeProject,
  profile: ProductIntelligenceProfile,
  directions: MarketingDirection[],
): CustomerIntelligence {
  const userAudience = project.targetAudience.trim();
  const recommended = directions.filter((item) => item.recommended).map((item) => item.id);
  const useCase = profile.functions.filter((item) => !VERIFICATION.test(item))[0]
    || (profile.productType !== "consumer product" ? profile.productType : "product use requires confirmation");
  return {
    customerType: userAudience || inferredAudience(profile),
    useCase,
    needs: unique([
      ...recommended.map((id) => needForDirection(id)),
      profile.features[0] ? `credible ${profile.features[0]} proof` : "",
    ].filter(Boolean)),
    buyingMotivations: unique([
      ...recommended.map((id) => motivationForDirection(id)),
      profile.sellingPoints[0]?.point,
    ].filter(Boolean)),
    possibleObjections: [
      !project.productInformation.price && project.productInformation.price !== 0 ? "price is not provided" : "",
      profile.viewCount < 2 ? "limited visual proof from a single view" : "",
      "unverified claims should not be used as product facts",
    ].filter(Boolean),
    relevantBenefits: unique([
      ...(project.productInformation.benefits ?? []),
      ...profile.functions.filter((item) => !VERIFICATION.test(item)).slice(0, 3),
    ]),
    label: userAudience ? "user-provided" : "inferred",
  };
}

function buildValueProposition(
  project: CreativeProject,
  profile: ProductIntelligenceProfile,
  userFacts: ProvenanceStatement[],
  inferences: ProvenanceStatement[],
  directions: MarketingDirection[],
): StructuredValueProposition {
  const userDescription = userFacts.find((item) => item.field === "description")?.value;
  const primaryDirection = directions.filter((item) => item.recommended).sort((a, b) => b.confidence - a.confidence)[0];
  const differentiators = unique([
    ...profile.sellingPoints.filter((item) => item.source === "user-provided").map((item) => item.point),
    ...profile.sellingPoints.filter((item) => item.source !== "user-provided").map((item) => `${item.point} (inferred)`),
  ]).slice(0, 6);
  const provenance = userDescription && primaryDirection ? "mixed" : userDescription ? "user-provided" : "inferred";
  return {
    productSummary: userDescription
      ? `${project.productInformation.name}: ${userDescription}`
      : profile.identifiedAs,
    customerProblem: inferences.find((item) => item.field === "use")?.value
      ? `Need a clearer, more useful ${profile.category.toLowerCase()} for everyday use.`
      : "Customer problem is not directly provided.",
    customerBenefit: (project.productInformation.benefits ?? [])[0]
      || profile.functions.filter((item) => !VERIFICATION.test(item))[0]
      || "Benefit requires user-provided product information.",
    differentiators: differentiators.length ? differentiators : ["No verified differentiator is available yet."],
    positioning: primaryDirection
      ? `Recommended ${primaryDirection.id} positioning from available evidence.`
      : "Positioning is not assigned without supporting evidence.",
    provenance,
  };
}

function rankCreativeAngles(
  project: CreativeProject,
  profile: ProductIntelligenceProfile,
  imageProfiles: ImageIntelligenceProfile[],
  directions: MarketingDirection[],
  userFacts: ProvenanceStatement[],
): CreativeAngle[] {
  const recommended = new Set(directions.filter((item) => item.recommended).map((item) => item.id));
  const hasDetail = imageProfiles.some((item) => /detail|close-up/i.test(item.viewRole));
  const hasLifestyle = imageProfiles.some((item) => /lifestyle/i.test(item.viewRole));
  const hasCta = userFacts.some((item) => item.field === "call-to-action" || item.field === "price");
  const angles: CreativeAngle[] = [
    {
      id: "product-hero",
      name: "Product hero",
      rationale: "Lead with the actual product image so the offer is immediately recognizable.",
      rank: 1,
      evidence: profile.imageIds.slice(0, 1).map((id) => `asset ${id}`),
    },
  ];
  if (hasDetail || imageProfiles.length > 0) {
    angles.push({
      id: "close-up-detail",
      name: "Close-up detail",
      rationale: "A close view can show visible materials, colour, or construction without inventing features.",
      rank: hasDetail ? 2 : 5,
      evidence: hasDetail ? ["detail or close-up view is available"] : ["product still can support a planned close-up"],
    });
  }
  if ((project.productInformation.features ?? []).length || profile.functions.length) {
    angles.push({
      id: "feature-demonstration",
      name: "Feature demonstration",
      rationale: "Show a real product attribute that the user or analysis already recorded.",
      rank: 3,
      evidence: [(project.productInformation.features ?? [])[0] || profile.functions[0] || "recorded product function"],
    });
  }
  if (hasLifestyle || recommended.has("lifestyle")) {
    angles.push({
      id: "lifestyle",
      name: "Lifestyle use",
      rationale: "Place the product in a use context only when lifestyle evidence or positioning exists.",
      rank: 4,
      evidence: hasLifestyle ? ["lifestyle view present"] : ["lifestyle marketing direction is recommended"],
    });
  }
  if (recommended.has("premium")) {
    angles.push({
      id: "premium-showcase",
      name: "Premium showcase",
      rationale: "Use restrained pacing and material emphasis because premium evidence exists.",
      rank: 3,
      evidence: directions.find((item) => item.id === "premium")?.evidence ?? [],
    });
  }
  if (/problem|solve|replace|upgrade/i.test(project.productInformation.description)) {
    angles.push({
      id: "problem-solution",
      name: "Problem → solution",
      rationale: "The product description names a need the product can address.",
      rank: 2,
      evidence: ["user-provided description"],
    });
  }
  if (hasCta) {
    angles.push({
      id: "offer-promotion",
      name: "Offer / promotion",
      rationale: "A call to action or price was provided by the user, so a closing offer beat is justified.",
      rank: 6,
      evidence: userFacts.filter((item) => item.field === "call-to-action" || item.field === "price").map((item) => item.value),
    });
  }
  if (project.campaignInformation.objective?.trim()) {
    angles.push({
      id: "storytelling",
      name: "Storytelling",
      rationale: "Campaign objective can shape a short narrative without inventing product claims.",
      rank: 5,
      evidence: [project.campaignInformation.objective],
    });
  }
  return angles
    .filter((item) => item.evidence.length > 0)
    .sort((a, b) => a.rank - b.rank)
    .map((item, index) => ({ ...item, rank: index + 1 }));
}

function inferredAudience(profile: ProductIntelligenceProfile): string {
  if (/apparel|fashion/i.test(profile.category)) return "style-conscious shoppers (inferred)";
  if (/beverage|bottle/i.test(profile.category + profile.productType)) return "people who carry drinks daily (inferred)";
  if (/beauty/i.test(profile.category)) return "personal-care shoppers (inferred)";
  return "likely buyers of this product category (inferred)";
}

function needForDirection(id: MarketingDirection["id"]): string {
  const map: Record<MarketingDirection["id"], string> = {
    premium: "credible quality cues",
    practical: "clear everyday usefulness",
    lifestyle: "see the product in real use",
    fashion: "style and finish that match taste",
    performance: "proof the product does what it claims",
    convenience: "fast, simple benefit",
    gift: "gift-ready presentation",
    business: "professional relevance",
    promotional: "a concrete next step",
  };
  return map[id];
}

function motivationForDirection(id: MarketingDirection["id"]): string {
  const map: Record<MarketingDirection["id"], string> = {
    premium: "perceived quality and finish",
    practical: "reliability in daily use",
    lifestyle: "identity and belonging",
    fashion: "appearance and trend fit",
    performance: "better results",
    convenience: "save time or effort",
    gift: "easy to give",
    business: "professional outcome",
    promotional: "timely offer",
  };
  return map[id];
}

function matchEvidence(text: string, patterns: RegExp[], extra: string[]): string[] {
  const hits = patterns.filter((pattern) => pattern.test(text)).map((pattern) => `matched ${String(pattern).slice(1, 24)}`);
  return [...hits, ...extra.filter((item) => item && !VERIFICATION.test(item))].slice(0, 4);
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function uniqueStatements(values: ProvenanceStatement[]): ProvenanceStatement[] {
  const seen = new Set<string>();
  return values.filter((item) => {
    const key = `${item.kind}:${item.field}:${item.value.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
