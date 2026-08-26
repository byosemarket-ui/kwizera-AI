import type { OrganizedImage, OrganizationViewType, ProductImageSet } from "../image-organization/types";
import { classifyBackground, recommendedViewsForCategory } from "../image-organization/classify";
import type { ProductProfile } from "../product-profile/types";
import type {
  CategoryVisualCheck,
  CoverageRow,
  ImageVisualResult,
  QualityClass,
  VisualAnalysisWarning,
  VisualProductAnalysisPackage,
} from "./types";
import { LOW_CONFIDENCE } from "./types";

export interface ServerImageProfile {
  imageId: string;
  fileName: string;
  mimeType?: string;
  quality?: { score: number; confidence?: number; notes?: string[]; classification?: QualityClass };
  background?: {
    type: string;
    removable?: boolean;
    confidence?: number;
    complexity?: string;
    separation?: string;
    removalSuitability?: string;
  };
  resolution?: { tier: string; notes?: string };
  viewRole?: string;
  lighting?: string;
  shadows?: string;
  reflections?: string;
  cameraAngle?: string;
  composition?: string;
  objects?: Array<{ label: string; confidence: number }>;
  defects?: string[];
  colors?: Array<{ name: string; role: string; confidence: number }>;
  logo?: { present: boolean; possibleBrand?: string; location?: string; confidence: number };
  detectedText?: Array<{ text: string; kind: string; confidence: number }>;
  visibility?: {
    percent: number;
    framing: string;
    cutoff: boolean;
    obstruction: string;
    status: string;
    confidence: number;
  };
  metadata?: Record<string, string | number>;
  duplicateOfImageId?: string;
}

export interface ServerProductIntel {
  category?: string;
  productType?: string;
  identifiedAs?: string;
  brand?: string;
  colours?: string[];
  colors?: string[];
  materials?: string[];
  features?: string[];
  visibleLogos?: string[];
  multiView?: { missingAngles?: string[] };
  imageAnalysis?: { missingAngles?: string[]; duplicateImageIds?: string[] };
}

const COLOR_RULES: Array<[RegExp, string]> = [
  [/black|noir|dark/i, "Black"],
  [/white|ivory|cream/i, "White"],
  [/red|crimson/i, "Red"],
  [/blue|navy/i, "Blue"],
  [/green|olive/i, "Green"],
  [/brown|tan|beige/i, "Brown"],
  [/gray|grey|silver/i, "Gray"],
  [/gold|yellow/i, "Gold"],
  [/pink|rose/i, "Pink"],
  [/orange/i, "Orange"],
];

export function detectColorsLocal(fileName: string, profileColors: string[]): Array<{ name: string; role: string; confidence: number }> {
  const evidence = `${fileName} ${profileColors.join(" ")}`;
  const found: Array<{ name: string; role: string; confidence: number }> = [];
  for (const [pattern, name] of COLOR_RULES) {
    if (pattern.test(evidence) && !found.some((c) => c.name === name)) {
      found.push({
        name,
        role: found.length === 0 ? "primary" : found.length === 1 ? "secondary" : "accent",
        confidence: 0.74,
      });
    }
  }
  for (const c of profileColors) {
    if (!c.trim() || found.some((f) => f.name.toLowerCase() === c.toLowerCase())) continue;
    found.push({ name: c, role: found.length ? "secondary" : "primary", confidence: 0.5 });
  }
  return found.slice(0, 5);
}

export function visualFeaturesForCategory(category: string, fileName: string, materials: string[]): string[] {
  const c = category.toLowerCase();
  const f = fileName.toLowerCase();
  const out: string[] = [];
  if (/shoe|sneaker|boot|footwear/.test(c)) {
    if (/sole|bottom/.test(f)) out.push("Sole");
    if (/lace/.test(f)) out.push("Laces");
    if (/logo|mark/.test(f)) out.push("Logo");
    if (/detail|stitch|texture/.test(f)) out.push("Stitching / texture");
    if (!out.length) out.push("Footwear silhouette");
  } else if (/bag|handbag|backpack|tote/.test(c)) {
    if (/strap|handle/.test(f)) out.push("Strap / handle");
    if (/zip/.test(f)) out.push("Zipper");
    if (/logo/.test(f)) out.push("Logo");
    if (!out.length) out.push("Bag body");
  } else if (/phone|laptop|tablet|electronic|camera|headphone/.test(c)) {
    if (/screen|display/.test(f)) out.push("Screen / display");
    if (/port|button/.test(f)) out.push("Ports / controls");
    if (/camera/.test(f)) out.push("Camera module");
    if (!out.length) out.push("Device housing");
  } else if (/apparel|shirt|dress|jacket|clothing/.test(c)) {
    if (/collar|sleeve|button|pattern/.test(f)) out.push("Garment detail");
    if (/fabric|texture/.test(f)) out.push("Fabric appearance");
    if (!out.length) out.push("Apparel form");
  } else {
    out.push("Primary product subject");
  }
  for (const m of materials.filter((x) => !/verification|requires/i.test(x)).slice(0, 2)) {
    out.push(`Material cue: ${m}`);
  }
  return [...new Set(out)].slice(0, 8);
}

export function qualityClassFromScore(score: number): QualityClass {
  if (score >= 85) return "GOOD";
  if (score >= 72) return "ACCEPTABLE";
  if (score >= 55) return "NEEDS_REVIEW";
  return "POOR";
}

export function categoryVisualCheck(profile: ProductProfile, intel: ServerProductIntel | null): CategoryVisualCheck {
  const profileCategory = profile.fields.category || "Unspecified";
  const visualEstimate = intel?.category || intel?.productType || profile.productImageSet?.categoryEstimate || profileCategory;
  const conflict = Boolean(
    profileCategory
    && visualEstimate
    && !profileCategory.toLowerCase().includes(visualEstimate.toLowerCase().slice(0, 4))
    && !visualEstimate.toLowerCase().includes(profileCategory.toLowerCase().slice(0, 4))
    && !/general|consumer|unspecified/i.test(visualEstimate),
  );
  return {
    profileCategory,
    visualEstimate,
    confidence: intel?.category ? 0.82 : profile.productImageSet?.categoryEstimate ? 0.7 : 0.55,
    conflict,
  };
}

export function buildCoverage(set: ProductImageSet | null, category: string): CoverageRow[] {
  const recommended = recommendedViewsForCategory(category || set?.categoryEstimate || "general");
  const present = new Set((set?.images ?? []).map((i) => i.viewType));
  const required: OrganizationViewType[] = ["FRONT"];
  return recommended.map((view) => ({
    view,
    need: required.includes(view) ? "required" : view === "PACKAGING" || view === "LOGO" ? "optional" : "recommended",
    status: present.has(view) ? "available" : "missing",
  }));
}

export function analyzeOneImage(
  image: OrganizedImage,
  profile: ProductProfile,
  server: ServerImageProfile | undefined,
  intel: ServerProductIntel | null,
): ImageVisualResult {
  const localBg = classifyBackground(image.fileName);
  const localColors = detectColorsLocal(image.fileName, profile.fields.colors);
  const score = server?.quality?.score ?? image.qualityScore ?? 70;
  const classification = server?.quality?.classification ?? qualityClassFromScore(score);
  const defects = server?.defects ?? image.warnings.map((w) => w.message);
  const visibility = server?.visibility ?? {
    percent: image.visibilityStatus === "clear" ? 94 : image.visibilityStatus === "partial" ? 70 : image.visibilityStatus === "cut-off" ? 55 : 60,
    framing: image.visibilityStatus === "cut-off" ? "Cut-off risk" : "Good",
    cutoff: image.visibilityStatus === "cut-off",
    obstruction: image.visibilityStatus === "partial" ? "Partial" : "Low",
    status: image.visibilityStatus === "clear" ? "good" : "needs-review",
    confidence: 0.7,
  };
  const colors = (server?.colors?.length ? server.colors : localColors).map((c) => ({
    name: c.name,
    role: c.role,
    confidence: typeof c.confidence === "number" && c.confidence <= 1 ? c.confidence : Number(c.confidence) / 100,
  }));
  const brand = profile.fields.brand || intel?.brand || null;
  const logo = server?.logo ?? {
    present: image.viewType === "LOGO" || /logo/i.test(image.fileName),
    possibleBrand: brand,
    location: image.viewType === "LOGO" ? "Logo view" : /logo/i.test(image.fileName) ? "Filename evidence" : null,
    confidence: image.viewType === "LOGO" ? 0.9 : /logo/i.test(image.fileName) ? 0.7 : 0.35,
  };
  const detectedText = server?.detectedText ?? [];
  const detConf = server?.objects?.[0]?.confidence
    ? (server.objects[0].confidence > 1 ? server.objects[0].confidence / 100 : server.objects[0].confidence)
    : image.analysisFailed ? 0.2 : 0.86;
  const bgType = server?.background?.type ?? mapLocalBackgroundLabel(localBg);
  const rawBgConf = server?.background?.confidence ?? 0.6;
  const viewConf = typeof server?.metadata?.viewConfidence === "number"
    ? Number(server.metadata.viewConfidence) / 100
    : image.confidence;

  return {
    assetId: image.assetId,
    fileName: image.fileName,
    url: image.url,
    width: image.width,
    height: image.height,
    viewType: image.viewType,
    viewConfidence: viewConf,
    productDetection: {
      detected: !image.analysisFailed && detConf >= 0.4,
      confidence: detConf,
      visibilityPercent: visibility.percent,
      mainProduct: profile.fields.name || server?.objects?.[0]?.label || "Primary product",
      obstruction: visibility.obstruction,
      needsReview: detConf < LOW_CONFIDENCE || image.needsReview || image.analysisFailed,
    },
    background: {
      type: bgType,
      complexity: String(server?.background?.complexity ?? (localBg === "Complex" ? "high" : localBg === "Unknown" ? "unknown" : "low")),
      separation: String(server?.background?.separation ?? (localBg === "White" || localBg === "Transparent" ? "Excellent" : localBg === "Complex" ? "Poor" : "Fair")),
      removalSuitability: String(server?.background?.removalSuitability ?? (
        server?.background?.removable ? "high"
          : localBg === "White" || localBg === "Transparent" ? "high"
            : localBg === "Complex" ? "low"
              : "medium"
      )),
      confidence: rawBgConf > 1 ? rawBgConf / 100 : rawBgConf,
    },
    colors,
    logo: {
      present: Boolean(logo.present),
      possibleBrand: logo.possibleBrand ?? null,
      location: logo.location ?? null,
      confidence: logo.confidence > 1 ? logo.confidence / 100 : logo.confidence,
    },
    detectedText: detectedText.map((t) => ({
      text: t.text,
      kind: t.kind,
      confidence: t.confidence > 1 ? t.confidence / 100 : t.confidence,
    })),
    quality: {
      classification,
      score,
      sharpness: score >= 80 ? "Good" : score >= 60 ? "Acceptable" : "Needs review",
      lighting: server?.lighting ?? "Requires verification",
      blur: /blur|soft/i.test(defects.join(" ")) ? "Elevated" : "Low",
      resolutionNote: server?.resolution?.notes
        ?? (image.width && image.height ? `${image.width} × ${image.height}` : `File ${Math.round(image.fileSize / 1024)} KB`),
      confidence: (server?.quality?.confidence ?? score) > 1
        ? Number(server?.quality?.confidence ?? score) / 100
        : Number(server?.quality?.confidence ?? 0.7),
    },
    lighting: {
      exposure: /dark|low-light/i.test(server?.lighting ?? "") ? "Low" : "Good",
      shadows: server?.shadows ?? "Moderate",
      highlights: server?.reflections ?? "Controlled",
      productVisibility: visibility.percent >= 85 ? "Excellent" : visibility.percent >= 70 ? "Good" : "Limited",
    },
    visibility: {
      percent: visibility.percent,
      framing: visibility.framing,
      cutoff: visibility.cutoff,
      obstruction: visibility.obstruction,
      status: visibility.status,
      confidence: visibility.confidence > 1 ? visibility.confidence / 100 : visibility.confidence,
    },
    composition: server?.composition ?? server?.cameraAngle ?? (image.roleInGroup === "primary" ? "Centered product-focused" : "Supporting product view"),
    visualFeatures: visualFeaturesForCategory(
      profile.fields.category,
      image.fileName,
      [...profile.fields.materials, ...(intel?.materials ?? [])],
    ),
    failed: Boolean(image.analysisFailed),
    failureReason: image.analysisError,
    reviewStatus: "pending",
    analyzedAt: new Date().toISOString(),
  };
}

export function assembleVisualPackage(input: {
  analysisId: string;
  projectId: string;
  projectName: string;
  productId: string;
  productionPackageRef: string | null;
  profile: ProductProfile;
  imageSet: ProductImageSet;
  serverProfiles: ServerImageProfile[];
  productIntel: ServerProductIntel | null;
}): VisualProductAnalysisPackage {
  const byId = new Map(input.serverProfiles.map((p) => [p.imageId, p]));
  const images = input.imageSet.images.map((img) =>
    analyzeOneImage(img, input.profile, byId.get(img.assetId), input.productIntel),
  );
  const categoryCheck = categoryVisualCheck(input.profile, input.productIntel);
  const coverage = buildCoverage(input.imageSet, input.profile.fields.category || input.imageSet.categoryEstimate);
  const available = coverage.filter((c) => c.status === "available").length;
  const coveragePercent = coverage.length ? Math.round((available / coverage.length) * 100) : 0;

  const warnings: VisualAnalysisWarning[] = [];
  for (const img of images) {
    if (img.productDetection.needsReview) {
      warnings.push({
        id: `rev-${img.assetId}`,
        code: "NEEDS_REVIEW",
        title: `${img.fileName} needs review`,
        detail: `Product detection confidence ${Math.round(img.productDetection.confidence * 100)}%.`,
        severity: "warning",
      });
    }
    if (img.failed) {
      warnings.push({
        id: `fail-${img.assetId}`,
        code: "ANALYSIS_FAILED",
        title: `Analysis failed: ${img.fileName}`,
        detail: img.failureReason ?? "Unknown failure",
        severity: "critical",
      });
    }
    if (img.quality.classification === "POOR" || img.quality.classification === "NEEDS_REVIEW") {
      warnings.push({
        id: `qual-${img.assetId}`,
        code: "QUALITY",
        title: `Image quality ${img.quality.classification}`,
        detail: img.fileName,
        severity: "warning",
      });
    }
  }
  if (categoryCheck.conflict) {
    warnings.push({
      id: "cat-conflict",
      code: "CATEGORY_CONFLICT",
      title: "Possible category conflict",
      detail: `User-provided: ${categoryCheck.profileCategory} · Visual estimate: ${categoryCheck.visualEstimate}`,
      severity: "warning",
    });
  }

  const userColors = input.profile.fields.colors.map((c) => c.toLowerCase());
  const aiColors = images.flatMap((i) => i.colors.map((c) => c.name.toLowerCase()));
  if (userColors.length && aiColors.length && aiColors.some((c) => !userColors.some((u) => u.includes(c) || c.includes(u)))) {
    warnings.push({
      id: "color-conflict",
      code: "COLOR_CONFLICT",
      title: "Color observation differs from Product Profile",
      detail: `Verified: ${input.profile.fields.colors.join(", ")} · AI: ${[...new Set(images.flatMap((i) => i.colors.map((c) => c.name)))].join(", ")}`,
      severity: "warning",
    });
  }

  const dupIds = new Set(input.imageSet.images.filter((i) => i.duplicateOfAssetId).map((i) => i.assetId));
  if (dupIds.size || !input.imageSet.consistencyOk) {
    warnings.push({
      id: "consistency",
      code: "POSSIBLE_MISMATCH",
      title: "Possible product mismatch",
      detail: !input.imageSet.consistencyOk
        ? "Image set consistency flag raised in Step 2."
        : `${dupIds.size} possible duplicate image(s).`,
      severity: "warning",
    });
  }

  for (const row of coverage.filter((r) => r.status === "missing" && r.need !== "optional")) {
    warnings.push({
      id: `miss-${row.view}`,
      code: "MISSING_VIEW",
      title: `${row.view} ${row.need}`,
      detail: `${row.need === "required" ? "Required" : "Recommended"} view not available.`,
      severity: row.need === "required" ? "critical" : "info",
    });
  }

  const primaryColor = images.flatMap((i) => i.colors).find((c) => c.role === "primary")?.name
    ?? images.flatMap((i) => i.colors)[0]?.name
    ?? null;
  const secondaryColor = images.flatMap((i) => i.colors).find((c) => c.role === "secondary")?.name ?? null;

  const verifiedFacts = [
    { field: "Product Name", value: input.profile.fields.name },
    { field: "Brand", value: input.profile.fields.brand || "—" },
    { field: "Category", value: input.profile.fields.category || "—" },
    { field: "Colors (user)", value: input.profile.fields.colors.join(", ") || "—" },
    {
      field: "Price",
      value: input.profile.fields.price != null
        ? `${input.profile.fields.price} ${input.profile.fields.currency}`
        : "—",
    },
  ];

  const aiObservations = [
    { field: "Primary Color (observed)", value: primaryColor ?? "Not detected", confidence: primaryColor ? 0.74 : 0.3 },
    { field: "Background (majority)", value: majority(images.map((i) => i.background.type)), confidence: 0.7 },
    {
      field: "Logo",
      value: images.some((i) => i.logo.present) ? "Detected in one or more images" : "Not detected",
      confidence: 0.65,
    },
  ];

  const aiInferences = [
    ...(input.productIntel?.materials ?? [])
      .filter((m) => !/verification/i.test(m))
      .slice(0, 3)
      .map((m) => ({ field: "Material (inference)", value: m, confidence: 0.55 })),
    ...(categoryCheck.conflict
      ? [{ field: "Category (inference)", value: categoryCheck.visualEstimate, confidence: categoryCheck.confidence }]
      : []),
  ];

  const detAvg = images.length
    ? images.reduce((s, i) => s + i.productDetection.confidence, 0) / images.length
    : 0;

  return {
    version: 1,
    analysisId: input.analysisId,
    projectId: input.projectId,
    productId: input.productId,
    projectName: input.projectName,
    productName: input.profile.fields.name || input.projectName,
    engineId: "local-image-evidence-analyzer+product-intelligence",
    productionPackageRef: input.productionPackageRef,
    productImageSet: input.imageSet,
    productProfile: input.profile,
    images,
    categoryCheck,
    consistency: {
      consistent: input.imageSet.consistencyOk && dupIds.size === 0,
      confidence: input.imageSet.consistencyOk ? 0.8 : 0.45,
      note: input.imageSet.consistencyOk
        ? "Images appear consistent with the same product."
        : "Possible product mismatch — review flagged images.",
    },
    coverage,
    coveragePercent,
    aggregate: {
      productDetectionAvg: detAvg,
      primaryColor,
      secondaryColor,
      logoDetected: images.some((i) => i.logo.present),
      textDetected: images.some((i) => i.detectedText.length > 0),
      qualityGoodCount: images.filter((i) => i.quality.classification === "GOOD" || i.quality.classification === "ACCEPTABLE").length,
      needsReviewCount: images.filter((i) => i.productDetection.needsReview || i.quality.classification === "NEEDS_REVIEW").length,
      warningCount: warnings.filter((w) => w.severity !== "info").length,
      imagesAnalyzed: images.filter((i) => !i.failed).length,
      imagesTotal: images.length,
    },
    warnings,
    verifiedFacts,
    aiObservations,
    aiInferences,
    status: images.some((i) => i.failed) && images.every((i) => i.failed) ? "failed"
      : images.some((i) => i.failed) ? "partial"
        : "complete",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function majority(values: string[]): string {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = "Unknown";
  let n = 0;
  for (const [k, c] of counts) {
    if (c > n) {
      best = k;
      n = c;
    }
  }
  return best;
}

function mapLocalBackgroundLabel(localBg: string): string {
  switch (localBg) {
    case "White": return "White Studio";
    case "Black": return "Black";
    case "Neutral": return "Neutral";
    case "Transparent": return "Transparent";
    case "Indoor": return "Indoor";
    case "Outdoor": return "Outdoor";
    case "Complex": return "Complex";
    default: return "Unknown";
  }
}
