import type { ProductProfile, ProductVariant } from "../product-profile/types";
import type { VisualProductAnalysisPackage, ImageVisualResult } from "../visual-analysis/types";
import type { ServerProductIntel } from "../visual-analysis/analyze";
import type {
  ConfidenceBand,
  ConsistencyMark,
  CrossCheck,
  EvidenceRef,
  IdentityField,
  IntelligenceScores,
  IntelligenceVersionMeta,
  LayeredItem,
  ProductIntelligencePackage,
  VariantCheck,
} from "./types";

export function confidenceBand(n: number): ConfidenceBand {
  if (n >= 0.8) return "high";
  if (n >= 0.65) return "medium";
  return "low";
}

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function evidenceFrom(img: ImageVisualResult | undefined, detection: string, confidence: number, engineId: string): EvidenceRef[] {
  if (!img) {
    return [{
      assetId: null,
      fileName: null,
      location: null,
      detection,
      confidence,
      engineId,
      at: new Date().toISOString(),
    }];
  }
  return [{
    assetId: img.assetId,
    fileName: img.fileName,
    location: img.viewType,
    detection,
    confidence,
    engineId,
    at: img.analyzedAt,
  }];
}

function item(
  field: string,
  value: string,
  kind: LayeredItem["kind"],
  confidence: number,
  reason: string,
  evidence: EvidenceRef[],
): LayeredItem {
  return {
    id: uid("li"),
    field,
    value,
    kind,
    confidence,
    band: confidenceBand(confidence),
    reason,
    evidence,
    reviewStatus: "pending",
  };
}

function tokens(value: string): string[] {
  return value.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2);
}

export function valuesAgree(user: string, visual: string): boolean {
  const u = user.trim().toLowerCase();
  const v = visual.trim().toLowerCase();
  if (!u || !v || v === "—" || v === "not detected" || v === "unspecified") return true;
  if (u.includes(v) || v.includes(u)) return true;
  const ut = tokens(u);
  const vt = tokens(v);
  return ut.some((t) => vt.includes(t)) || vt.some((t) => ut.includes(t));
}

export function markAgreement(user: string, visual: string, visualPresent: boolean): ConsistencyMark {
  if (!visualPresent || !visual.trim() || visual === "—") return "not-visually-verified";
  return valuesAgree(user, visual) ? "consistent" : "conflict";
}

export function buildIdentity(
  profile: ProductProfile,
  visual: VisualProductAnalysisPackage,
  intel: ServerProductIntel | null,
): IdentityField[] {
  const cat = visual.categoryCheck;
  const brandVisual = visual.images.find((i) => i.logo.present && i.logo.possibleBrand)?.logo.possibleBrand
    ?? intel?.brand
    ?? "";
  const modelCue = visual.images.flatMap((i) => i.detectedText).find((t) => t.kind === "model")?.text ?? "";
  const typeVisual = intel?.productType || cat.visualEstimate || "";
  return [
    {
      field: "Product Type",
      userValue: profile.fields.category || "—",
      visualValue: typeVisual || "—",
      mark: markAgreement(profile.fields.category, typeVisual, Boolean(typeVisual)),
      confidence: cat.confidence,
    },
    {
      field: "Category",
      userValue: profile.fields.category || "—",
      visualValue: cat.visualEstimate || "—",
      mark: cat.conflict ? "conflict" : markAgreement(profile.fields.category, cat.visualEstimate, Boolean(cat.visualEstimate)),
      confidence: cat.confidence,
    },
    {
      field: "Subcategory",
      userValue: profile.fields.subcategory || "—",
      visualValue: intel?.category || "—",
      mark: profile.fields.subcategory ? markAgreement(profile.fields.subcategory, intel?.category ?? "", Boolean(intel?.category)) : "not-visually-verified",
      confidence: intel?.category ? 0.7 : 0.4,
    },
    {
      field: "Brand",
      userValue: profile.fields.brand || "—",
      visualValue: brandVisual || "Not detected",
      mark: markAgreement(profile.fields.brand, brandVisual, Boolean(brandVisual)),
      confidence: brandVisual ? 0.74 : 0.35,
    },
    {
      field: "Model",
      userValue: profile.fields.model || "—",
      visualValue: modelCue || "Not detected",
      mark: profile.fields.model ? markAgreement(profile.fields.model, modelCue, Boolean(modelCue)) : "not-visually-verified",
      confidence: modelCue ? 0.7 : 0.4,
    },
    {
      field: "Product Family",
      userValue: profile.fields.name || "—",
      visualValue: visual.productName,
      mark: "consistent",
      confidence: 0.9,
    },
    {
      field: "Product Variant",
      userValue: profile.variants.map((v) => `${v.label}: ${v.values.join("/")}`).join("; ") || "None declared",
      visualValue: visual.aggregate.primaryColor ? `Observed color ${visual.aggregate.primaryColor}` : "—",
      mark: "uncertain",
      confidence: 0.55,
    },
  ];
}

export function buildVerifiedFacts(profile: ProductProfile): LayeredItem[] {
  const f = profile.fields;
  const rows: Array<[string, string]> = [
    ["Product Name", f.name],
    ["Price", f.price != null ? `${f.price} ${f.currency}` : ""],
    ["Category", f.category],
    ["Brand", f.brand],
    ["Model", f.model],
    ["Colors", f.colors.join(", ")],
    ["Sizes", f.sizes.join(", ")],
    ["Materials", f.materials.join(", ")],
    ["SKU", f.sku],
  ];
  return rows
    .filter(([, v]) => v.trim())
    .map(([field, value]) => item(field, value, "verified", 1, "User-confirmed Product Profile", []));
}

export function buildObservations(visual: VisualProductAnalysisPackage): LayeredItem[] {
  const first = visual.images[0];
  const features = [...new Set(visual.images.flatMap((i) => i.visualFeatures))];
  const out: LayeredItem[] = [
    item(
      "Product detection",
      visual.images.some((i) => i.productDetection.detected) ? "Product detected in analyzed images" : "Product not detected",
      "ai-observation",
      visual.aggregate.productDetectionAvg,
      "Step 1 product detection",
      evidenceFrom(first, "product-detection", visual.aggregate.productDetectionAvg, visual.engineId),
    ),
    item(
      "Primary color",
      visual.aggregate.primaryColor ?? "Not detected",
      "ai-observation",
      visual.images.flatMap((i) => i.colors).find((c) => c.role === "primary")?.confidence ?? 0.4,
      "Step 1 color cues",
      evidenceFrom(visual.images.find((i) => i.colors.length), "color", 0.74, visual.engineId),
    ),
    item(
      "Logo",
      visual.aggregate.logoDetected ? "Visible logo cue detected" : "No logo cue in analyzed images",
      "ai-observation",
      visual.images.find((i) => i.logo.present)?.logo.confidence ?? 0.35,
      "Step 1 logo cues — not detected does not mean the product has no logo",
      evidenceFrom(visual.images.find((i) => i.logo.present), "logo", 0.7, visual.engineId),
    ),
  ];
  for (const feat of features.slice(0, 10)) {
    const src = visual.images.find((i) => i.visualFeatures.includes(feat));
    out.push(item(feat, `Visible: ${feat}`, "ai-observation", 0.72, "Visually supported feature from Step 1", evidenceFrom(src, feat, 0.72, visual.engineId)));
  }
  return out;
}

export function buildInferences(
  profile: ProductProfile,
  visual: VisualProductAnalysisPackage,
  intel: ServerProductIntel | null,
): LayeredItem[] {
  const out: LayeredItem[] = [];
  const src = visual.images.find((i) => /detail|texture|stitch|sole/i.test(i.fileName)) ?? visual.images[0];
  const materials = (intel?.materials ?? []).filter((m) => !/verification/i.test(m));
  for (const m of materials.slice(0, 3)) {
    out.push(item(
      "Possible material",
      m,
      "ai-inference",
      0.61,
      "Inferred from product/intelligence cues; not verified by pixel inspection",
      evidenceFrom(src, `material:${m}`, 0.61, "local-image-evidence-analyzer+product-intelligence"),
    ));
  }
  if (!materials.length && /shoe|footwear/i.test(profile.fields.category)) {
    out.push(item(
      "Possible material",
      "Surface appearance may suggest synthetic or leather-like finish",
      "ai-inference",
      0.55,
      "Category context only — material is not visually certain",
      evidenceFrom(src, "material-appearance", 0.55, visual.engineId),
    ));
  }
  if (/shoe|bag|apparel|clothing/i.test(profile.fields.category)) {
    out.push(item(
      "Possible use",
      "May be designed for casual everyday use",
      "ai-inference",
      0.67,
      "Category and silhouette cues; not a verified use-case claim",
      evidenceFrom(src, "use", 0.67, visual.engineId),
    ));
  }
  return out;
}

export function buildCrossValidation(
  profile: ProductProfile,
  visual: VisualProductAnalysisPackage,
  intel: ServerProductIntel | null,
): CrossCheck[] {
  const primary = visual.aggregate.primaryColor ?? "";
  const userColors = profile.fields.colors.join(", ");
  const brandVisual = visual.images.find((i) => i.logo.present)?.logo.possibleBrand ?? intel?.brand ?? "";
  const packaging = visual.coverage.find((c) => c.view === "PACKAGING");
  const checks: CrossCheck[] = [
    {
      id: "xv-category",
      field: "Category",
      userValue: profile.fields.category || "—",
      visualValue: visual.categoryCheck.visualEstimate,
      mark: visual.categoryCheck.conflict ? "conflict" : "consistent",
      confidence: visual.categoryCheck.confidence,
      detail: visual.categoryCheck.conflict
        ? `POSSIBLE CATEGORY CONFLICT — user ${profile.fields.category}, visual ${visual.categoryCheck.visualEstimate}`
        : "User category and visual estimate agree",
      reviewStatus: visual.categoryCheck.conflict ? "pending" : "pending",
    },
    {
      id: "xv-brand",
      field: "Brand",
      userValue: profile.fields.brand || "—",
      visualValue: brandVisual || "Not detected",
      mark: markAgreement(profile.fields.brand, brandVisual, Boolean(brandVisual)),
      confidence: brandVisual ? 0.74 : 0.4,
      detail: brandVisual && profile.fields.brand && !valuesAgree(profile.fields.brand, brandVisual)
        ? "CRITICAL REVIEW REQUIRED — detected brand cue differs from Product Profile"
        : "Brand compared against logo/text cues",
      reviewStatus: "pending",
    },
    {
      id: "xv-color",
      field: "Colors",
      userValue: userColors || "—",
      visualValue: primary || "Not detected",
      mark: !primary ? "not-visually-verified" : markAgreement(userColors, primary, true),
      confidence: visual.images.flatMap((i) => i.colors)[0]?.confidence ?? 0.5,
      detail: primary && userColors && !valuesAgree(userColors, primary)
        ? "POSSIBLE COLOR CONFLICT — user value remains authoritative"
        : "Color observation compared with Product Profile",
      reviewStatus: "pending",
    },
    {
      id: "xv-type",
      field: "Product Type",
      userValue: profile.fields.category || "—",
      visualValue: intel?.productType || visual.categoryCheck.visualEstimate,
      mark: visual.categoryCheck.conflict ? "conflict" : "consistent",
      confidence: visual.categoryCheck.confidence,
      detail: "Type compared using category + intelligence",
      reviewStatus: "pending",
    },
    {
      id: "xv-logo",
      field: "Logo",
      userValue: profile.fields.brand ? `Brand recorded: ${profile.fields.brand}` : "No brand on profile",
      visualValue: visual.aggregate.logoDetected ? "Logo cue detected" : "Not detected",
      mark: visual.aggregate.logoDetected ? "consistent" : "not-visually-verified",
      confidence: visual.images.find((i) => i.logo.present)?.logo.confidence ?? 0.35,
      detail: "Logo absence is not treated as no-logo fact",
      reviewStatus: "pending",
    },
    {
      id: "xv-packaging",
      field: "Packaging",
      userValue: packaging ? `${packaging.need}` : "—",
      visualValue: packaging?.status === "available" ? "Packaging view available" : "No packaging view",
      mark: packaging?.status === "available" ? "consistent" : "not-visually-verified",
      confidence: 0.8,
      detail: "Packaging view from Product Image Set",
      reviewStatus: "pending",
    },
    {
      id: "xv-views",
      field: "Product Views",
      userValue: `${visual.coverage.filter((c) => c.status === "available").length} available`,
      visualValue: `${visual.coveragePercent}% coverage`,
      mark: visual.coveragePercent >= 50 ? "consistent" : "uncertain",
      confidence: 0.85,
      detail: "Step 1 coverage reused — views are not reclassified",
      reviewStatus: "pending",
    },
  ];
  return checks;
}

export function buildCharacteristics(profile: ProductProfile, visual: VisualProductAnalysisPackage): LayeredItem[] {
  const first = visual.images[0];
  return [
    item("Appearance", `${visual.aggregate.primaryColor ?? "Color"} product presentation`, "ai-observation", 0.72, "Observed from analyzed images", evidenceFrom(first, "appearance", 0.72, visual.engineId)),
    item("Color", profile.fields.colors.join(", ") || visual.aggregate.primaryColor || "—", profile.fields.colors.length ? "verified" : "ai-observation", profile.fields.colors.length ? 1 : 0.7, "User colors remain authoritative", evidenceFrom(first, "color", 0.8, visual.engineId)),
    item("Design", first?.composition ?? "Product-focused composition", "ai-observation", 0.68, "Composition recorded as visual fact", evidenceFrom(first, "composition", 0.68, visual.engineId)),
    item("Brand presentation", visual.aggregate.logoDetected ? "Logo or brand cue visible" : "No visible brand cue", "ai-observation", 0.6, "Step 1 logo detection", evidenceFrom(visual.images.find((i) => i.logo.present), "logo", 0.6, visual.engineId)),
    item("Packaging characteristics", visual.coverage.find((c) => c.view === "PACKAGING" && c.status === "available") ? "Packaging view present" : "Packaging not in image set", "ai-observation", 0.8, "Image coverage", []),
    item("Material appearance", profile.fields.materials.join(", ") || "Not visually certain", profile.fields.materials.length ? "verified" : "ai-inference", profile.fields.materials.length ? 1 : 0.45, "User materials stay verified; visuals cannot confirm composition", evidenceFrom(first, "material", 0.45, visual.engineId)),
  ];
}

export function buildDifferentiators(visual: VisualProductAnalysisPackage): LayeredItem[] {
  const colors = [...new Set(visual.images.flatMap((i) => i.colors.map((c) => c.name)))];
  const out: LayeredItem[] = [];
  if (colors.length >= 2) {
    out.push(item("Color combination", colors.slice(0, 3).join(" + "), "ai-observation", 0.7, "Possible differentiator — not a market-wide USP", evidenceFrom(visual.images[0], "colors", 0.7, visual.engineId)));
  }
  if (visual.aggregate.logoDetected) {
    const logo = visual.images.find((i) => i.logo.present);
    out.push(item("Logo placement", logo?.logo.location ?? "Visible logo", "ai-observation", logo?.logo.confidence ?? 0.7, "Possible differentiator pending marketing evaluation", evidenceFrom(logo, "logo", 0.7, visual.engineId)));
  }
  const detail = visual.images.find((i) => i.viewType === "DETAIL" || /sole|stitch|pattern/i.test(i.fileName));
  if (detail) {
    out.push(item("Distinctive detail", detail.visualFeatures[0] ?? detail.fileName, "ai-observation", 0.66, "Possible construction or pattern differentiator", evidenceFrom(detail, "detail", 0.66, visual.engineId)));
  }
  if (visual.coverage.some((c) => c.view === "PACKAGING" && c.status === "available")) {
    out.push(item("Packaging style", "Packaging view available for later marketing evaluation", "ai-observation", 0.75, "Not claimed as USP", []));
  }
  return out;
}

export function buildBenefits(profile: ProductProfile, visual: VisualProductAnalysisPackage): LayeredItem[] {
  const out: LayeredItem[] = profile.fields.benefits.filter(Boolean).slice(0, 6).map((b) =>
    item("Verified benefit", b, "verified", 1, "User-confirmed Product Profile benefit", []),
  );
  const sole = visual.images.find((i) => i.visualFeatures.some((f) => /sole/i.test(f)));
  if (sole) {
    out.push(item("Visual benefit signal", "Raised or distinct sole appears visible", "ai-observation", 0.7, "Visible sole/structure only", evidenceFrom(sole, "sole", 0.7, visual.engineId)));
    out.push(item("AI-inferred benefit", "May provide additional grip", "ai-inference", 0.58, "Inference from sole visibility — not a factual product claim", evidenceFrom(sole, "grip", 0.58, visual.engineId)));
  }
  return out;
}

export function buildVariantChecks(profile: ProductProfile, visual: VisualProductAnalysisPackage): VariantCheck[] {
  const detected = new Set(visual.images.flatMap((i) => i.colors.map((c) => c.name.toLowerCase())));
  const out: VariantCheck[] = [];
  const variants: ProductVariant[] = profile.variants.length
    ? profile.variants
    : profile.fields.colors.length
      ? [{ id: "colors", kind: "color", label: "Colors", values: profile.fields.colors }]
      : [];
  for (const v of variants) {
    for (const declared of v.values) {
      const hit = [...detected].find((d) => declared.toLowerCase().includes(d) || d.includes(declared.toLowerCase()));
      out.push({
        kind: v.kind,
        label: v.label,
        declared,
        visualSupport: hit ?? null,
        status: hit ? "visually-supported" : "user-provided-not-visually-verified",
      });
    }
  }
  return out;
}

export function buildSpecChecks(profile: ProductProfile, visual: VisualProductAnalysisPackage, intel: ServerProductIntel | null): CrossCheck[] {
  const checks: CrossCheck[] = [];
  const userMat = profile.fields.materials.join(", ");
  const inferredMat = (intel?.materials ?? []).filter((m) => !/verification/i.test(m))[0] ?? "";
  if (userMat) {
    const support = inferredMat && valuesAgree(userMat, inferredMat);
    const conflict = inferredMat && !valuesAgree(userMat, inferredMat);
    checks.push({
      id: "spec-material",
      field: "Material",
      userValue: userMat,
      visualValue: inferredMat ? `${inferredMat} (appearance cue)` : "Leather-like or material appearance not verified from images",
      mark: conflict ? "conflict" : support ? "consistent" : "not-visually-verified",
      confidence: inferredMat ? 0.61 : 0.4,
      detail: conflict
        ? "POSSIBLE SPECIFICATION CONFLICT — user specification remains verified user data"
        : "User-provided specification remains VERIFIED USER DATA. Visual result is a supporting observation only.",
      reviewStatus: "pending",
    });
  }
  if (profile.fields.dimensions) {
    checks.push({
      id: "spec-dimensions",
      field: "Dimensions",
      userValue: profile.fields.dimensions,
      visualValue: "Exact dimensions cannot be determined from images alone",
      mark: "not-visually-verified",
      confidence: 0.9,
      detail: "Images do not measure physical size",
      reviewStatus: "pending",
    });
  }
  for (const [key, value] of Object.entries(profile.fields.specifications)) {
    if (!value) continue;
    checks.push({
      id: `spec-${key}`,
      field: key,
      userValue: value,
      visualValue: "Not independently measured from images",
      mark: "not-visually-verified",
      confidence: 0.5,
      detail: "Specification retained as user data",
      reviewStatus: "pending",
    });
  }
  return checks;
}

export function buildLogoTextChecks(profile: ProductProfile, visual: VisualProductAnalysisPackage): CrossCheck[] {
  const texts = visual.images.flatMap((i) => i.detectedText.map((t) => ({ ...t, assetId: i.assetId, fileName: i.fileName })));
  const out: CrossCheck[] = [];
  const brand = profile.fields.brand;
  for (const t of texts) {
    const conflict = Boolean(brand && t.kind === "brand" && !valuesAgree(brand, t.text));
    out.push({
      id: `txt-${t.assetId}-${t.text}`,
      field: `Detected text (${t.kind})`,
      userValue: brand || profile.fields.name,
      visualValue: t.text,
      mark: conflict ? "conflict" : valuesAgree(brand || profile.fields.name, t.text) ? "consistent" : "uncertain",
      confidence: t.confidence,
      detail: conflict ? `CRITICAL REVIEW REQUIRED — image text “${t.text}” on ${t.fileName}` : `Observed text stored separately from verified profile (${t.fileName})`,
      reviewStatus: "pending",
    });
  }
  if (!texts.length) {
    out.push({
      id: "txt-none",
      field: "Detected text",
      userValue: brand || "—",
      visualValue: "None observed",
      mark: "not-visually-verified",
      confidence: 0.4,
      detail: "No text cues in Step 1 results",
      reviewStatus: "pending",
    });
  }
  return out;
}

export function buildUnknown(profile: ProductProfile, visual: VisualProductAnalysisPackage): LayeredItem[] {
  const out: LayeredItem[] = [
    item("Material certainty", "Material is not visually certain from images alone", "ai-inference", 0.9, "Prevents later marketing false claims", []),
    item("Internal features", "Internal features are not visible", "ai-inference", 0.95, "Cannot be verified from photos", []),
  ];
  if (!/waterproof/i.test([...profile.fields.features, ...profile.fields.benefits, profile.fields.description].join(" "))) {
    out.push(item("Waterproofing", "Waterproofing cannot be confirmed from images", "ai-inference", 0.95, "Not a visual property", []));
  }
  if (/electronic|phone|laptop/i.test(profile.fields.category)) {
    out.push(item("Battery capacity", "Battery capacity is not visible", "ai-inference", 0.95, "Not observable", []));
  }
  out.push(item("Exact dimensions", "Exact dimensions cannot be determined from images alone", "ai-inference", 0.95, "No photogrammetry in this step", []));
  for (const row of visual.coverage.filter((c) => c.status === "missing" && c.need !== "optional")) {
    out.push(item("Missing view", `${row.view} (${row.need})`, "ai-observation", 0.9, "Image coverage from Step 1", []));
  }
  return out;
}

export function computeScores(
  identity: IdentityField[],
  visual: VisualProductAnalysisPackage,
  specChecks: CrossCheck[],
  cross: CrossCheck[],
): IntelligenceScores {
  const idConflicts = identity.filter((i) => i.mark === "conflict").length;
  const identityScore = Math.max(40, 100 - idConflicts * 12 - (identity.filter((i) => i.userValue === "—").length * 4));
  const visualUnderstanding = Math.round(
    (visual.aggregate.productDetectionAvg * 100 * 0.55) + (visual.coveragePercent * 0.45),
  );
  const specOk = specChecks.filter((c) => c.mark !== "conflict").length;
  const specificationSupport = specChecks.length ? Math.round((specOk / specChecks.length) * 100) : 80;
  const xvConflicts = cross.filter((c) => c.mark === "conflict").length;
  const consistency = Math.max(40, Math.round((visual.consistency.confidence * 100) - xvConflicts * 8));
  const overall = Math.round(
    identityScore * 0.22
    + visualUnderstanding * 0.22
    + specificationSupport * 0.18
    + visual.coveragePercent * 0.18
    + consistency * 0.2,
  );
  return {
    identity: identityScore,
    visualUnderstanding,
    specificationSupport,
    imageCoverage: visual.coveragePercent,
    consistency,
    overall,
    explanation: [
      `Identity ${identityScore}% from profile completeness minus ${idConflicts} identity conflict(s).`,
      `Visual understanding ${visualUnderstanding}% from detection ${Math.round(visual.aggregate.productDetectionAvg * 100)}% and coverage ${visual.coveragePercent}%.`,
      `Specification support ${specificationSupport}% (${specOk}/${specChecks.length || 0} without conflict).`,
      `Image coverage ${visual.coveragePercent}% from Step 1.`,
      `Consistency ${consistency}% from image-set consistency and ${xvConflicts} cross-check conflict(s).`,
      `Overall is a weighted average (not a substitute for factual review).`,
    ].join(" "),
  };
}

export function assembleIntelligence(input: {
  intelligenceId: string;
  versionNumber: number;
  versionLabel: string;
  history: IntelligenceVersionMeta[];
  profile: ProductProfile;
  visual: VisualProductAnalysisPackage;
  intel: ServerProductIntel | null;
  productionPackageRef: string | null;
}): ProductIntelligencePackage {
  const { profile, visual, intel } = input;
  const identity = buildIdentity(profile, visual, intel);
  const verifiedFacts = buildVerifiedFacts(profile);
  const visualObservations = buildObservations(visual);
  const inferences = buildInferences(profile, visual, intel);
  const features = visualObservations.filter((o) => o.field !== "Product detection" && o.field !== "Primary color" && o.field !== "Logo");
  const characteristics = buildCharacteristics(profile, visual);
  const differentiators = buildDifferentiators(visual);
  const benefits = buildBenefits(profile, visual);
  const variants = buildVariantChecks(profile, visual);
  const specificationChecks = buildSpecChecks(profile, visual, intel);
  const logoTextChecks = buildLogoTextChecks(profile, visual);
  const crossValidation = buildCrossValidation(profile, visual, intel);
  const unknown = buildUnknown(profile, visual);
  const scores = computeScores(identity, visual, specificationChecks, crossValidation);
  const xvConflicts = [...crossValidation, ...logoTextChecks, ...specificationChecks].filter((c) => c.mark === "conflict");
  const warnings = xvConflicts.map((c) => ({
    id: c.id,
    code: c.detail.includes("CRITICAL") ? "CRITICAL_REVIEW" : c.mark === "conflict" ? "CONFLICT" : "REVIEW",
    title: c.field,
    detail: c.detail,
    severity: (c.detail.includes("CRITICAL") ? "critical" : "warning") as "critical" | "warning",
  }));
  if (!visual.consistency.consistent) {
    warnings.push({
      id: "mismatch",
      code: "POSSIBLE_MISMATCH",
      title: "Possible product mismatch",
      detail: visual.consistency.note,
      severity: "warning",
    });
  }

  const specMark: ConsistencyMark = specificationChecks.some((c) => c.mark === "conflict") ? "conflict" : "consistent";
  const variantMark: ConsistencyMark = variants.some((v) => v.status === "user-provided-not-visually-verified")
    ? "not-visually-verified"
    : "consistent";

  return {
    version: 1,
    intelligenceId: input.intelligenceId,
    versionLabel: input.versionLabel,
    versionNumber: input.versionNumber,
    engineId: "deep-product-intelligence+product-intelligence",
    projectId: profile.projectId,
    productId: profile.productId,
    projectName: profile.projectName,
    productName: profile.fields.name || visual.productName,
    visualAnalysisId: visual.analysisId,
    productionPackageRef: input.productionPackageRef,
    identity,
    verifiedFacts,
    visualObservations,
    inferences,
    features,
    characteristics,
    differentiators,
    benefits,
    unknown,
    variants,
    specificationChecks,
    logoTextChecks,
    crossValidation,
    consistency: {
      product: identity.some((i) => i.mark === "conflict") ? "conflict" : "consistent",
      images: visual.consistency.consistent ? "consistent" : "conflict",
      specifications: specMark,
      variants: variantMark,
      note: visual.consistency.consistent
        ? "Images appear to show the same product. User values were not overwritten."
        : "POSSIBLE PRODUCT MISMATCH — image was not deleted.",
      confidence: visual.consistency.confidence,
    },
    coverage: visual.coverage,
    coveragePercent: visual.coveragePercent,
    scores,
    warnings,
    history: input.history,
    status: "complete",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
