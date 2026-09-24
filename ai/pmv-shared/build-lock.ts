/**
 * Build Product Identity Lock + customer review from Product Intelligence profile.
 * Does not invent attributes — unknown when unsupported by evidence.
 */

import type { ProductIntelligenceProfile } from "../product-intelligence/types.js";
import {
  ALLOWED_CREATIVE_CHANGES,
  PRODUCT_IDENTITY_LOCK_VERSION,
  PROTECTED_PRODUCT_ATTRIBUTES,
  type IdentityAttribute,
  type ProductIdentityLock,
  type ProductIntelligenceReview,
} from "./identity-lock-types.js";

function attr(
  value: string | undefined | null,
  confidence: number,
  evidenceAssetId: string | null,
  source: IdentityAttribute["source"] = "unknown",
): IdentityAttribute {
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    return { value: "unknown", confidence: 0, evidenceAssetId: null, source: "unknown" };
  }
  return {
    value: trimmed,
    confidence: Math.max(0, Math.min(1, confidence)),
    evidenceAssetId,
    source,
  };
}

function pickEvidence(profile: ProductIntelligenceProfile, heroAssetId: string | null): string | null {
  return heroAssetId
    ?? profile.imageIds[0]
    ?? null;
}

function findProvenance(
  profile: ProductIntelligenceProfile,
  fieldHints: string[],
): { confidence: number; assetId: string | null; kind: IdentityAttribute["source"] } {
  const pools = [
    ...(profile.userFacts ?? []),
    ...(profile.imageObservations ?? []),
    ...(profile.inferences ?? []),
  ];
  for (const hint of fieldHints) {
    const hit = pools.find((s) => s.field.toLowerCase().includes(hint.toLowerCase()));
    if (hit) {
      const kind: IdentityAttribute["source"] =
        hit.kind === "user-provided" ? "user-provided"
          : hit.kind === "observed-from-image" ? "observed-from-image"
            : hit.kind === "inferred" ? "inferred"
              : "unknown";
      return {
        confidence: Math.max(0, Math.min(1, hit.confidence > 1 ? hit.confidence / 100 : hit.confidence)),
        assetId: hit.assetId ?? null,
        kind,
      };
    }
  }
  return { confidence: 0.55, assetId: null, kind: "inferred" };
}

function confidenceLabel(score: number): ProductIntelligenceReview["confidenceLabel"] {
  if (score <= 0) return "unknown";
  if (score >= 0.8) return "high";
  if (score >= 0.55) return "medium";
  return "low";
}

export function computeAssetFingerprint(
  assetIds: string[],
  heroAssetId: string | null,
): string {
  const sorted = [...new Set(assetIds)].filter(Boolean).sort();
  return `fp:${heroAssetId ?? "none"}:${sorted.join(",")}`;
}

export function buildProductIntelligenceReview(
  profile: ProductIntelligenceProfile,
  heroAssetId: string | null,
): ProductIntelligenceReview {
  const qualityScore = (profile.quality?.confidence ?? profile.quality?.score ?? 0);
  const overall = qualityScore > 1 ? qualityScore / 100 : qualityScore;
  const visionUnavailable = profile.aiInferenceStatus === "IMAGE_ANALYSIS_UNAVAILABLE"
    || profile.aiInferenceStatus === "not-configured";
  const warnings: string[] = [];
  for (const miss of profile.missingInformation ?? []) {
    if (miss.severity === "critical") warnings.push(miss.recommendation || `${miss.field} needs attention`);
  }
  if ((profile.colours?.length ?? 0) === 0) warnings.push("Product color could not be confirmed with high confidence.");
  if (visionUnavailable) {
    warnings.push("Advanced visual analysis is not available. Identity uses your photos and product details.");
  }
  if (profile.analysisState === "failed" || profile.analysisState === "partial") {
    warnings.push("Product analysis is incomplete. Review carefully before locking.");
  }

  const readyToConfirm = Boolean(profile.productName?.trim())
    && (profile.imageIds?.length ?? 0) > 0
    && Boolean(heroAssetId)
    && profile.analysisState !== "failed";

  return {
    profileId: profile.id ?? null,
    productIdentified: profile.identifiedAs || profile.productName || "Product",
    productType: profile.productType || profile.category || "unknown",
    category: profile.category || "unknown",
    brand: profile.brand || "unknown",
    keyColors: profile.colours ?? [],
    material: profile.materials ?? [],
    textures: profile.textures ?? [],
    patterns: profile.patterns ?? [],
    shapes: profile.shapes ?? [],
    visibleFeatures: [
      ...(profile.features ?? []),
      ...(profile.sellingPoints ?? []).map((s) => s.point),
    ].filter(Boolean).slice(0, 12),
    logoBranding: [
      ...(profile.visibleLogos ?? []),
      profile.brand && profile.brand !== "unknown" ? profile.brand : "",
    ].filter(Boolean),
    heroAssetId,
    imageCount: profile.imageIds?.length ?? profile.viewCount ?? 0,
    qualityNotes: (profile.quality?.notes ?? profile.qualityIndicators ?? []).slice(0, 6),
    warnings,
    confidenceLabel: confidenceLabel(overall),
    overallConfidence: overall,
    analysisVersion: profile.analysisVersion || "unknown",
    visionUnavailable,
    visionUnavailableMessage: visionUnavailable
      ? "Vision analysis is not configured in this environment. The product lock will use photo evidence and the details you entered."
      : null,
    readyToConfirm,
    analyzedAt: profile.updatedAt || profile.createdAt || null,
  };
}

export function buildProductIdentityLock(input: {
  projectId: string;
  profile: ProductIntelligenceProfile;
  heroAssetId: string;
  productAssetIds: string[];
  assetFingerprint: string;
}): ProductIdentityLock {
  const { projectId, profile, heroAssetId, productAssetIds, assetFingerprint } = input;
  const evidence = pickEvidence(profile, heroAssetId);
  const now = new Date().toISOString();
  const colorProv = findProvenance(profile, ["colour", "color"]);
  const materialProv = findProvenance(profile, ["material"]);
  const shapeProv = findProvenance(profile, ["shape", "silhouette"]);
  const logoProv = findProvenance(profile, ["logo", "brand"]);

  const colors = (profile.colours?.length ? profile.colours : ["unknown"]).map((c) =>
    attr(c, c === "unknown" ? 0 : colorProv.confidence, evidence ?? colorProv.assetId, colorProv.kind),
  );

  const distinctiveDetails = [
    ...(profile.features ?? []),
    ...(profile.qualityIndicators ?? []),
  ].filter(Boolean).slice(0, 8).map((d) =>
    attr(d, 0.6, evidence, "observed-from-image"),
  );

  const warnings: string[] = [];
  if (colors.every((c) => c.value === "unknown")) warnings.push("Color identity is unknown — confirm before generation.");
  if (!(profile.materials?.length)) warnings.push("Material identity is unknown.");
  if (!(profile.visibleLogos?.length) && !profile.brand) warnings.push("No logo/branding observed on product images.");

  const confidenceValues = [
    ...colors.map((c) => c.confidence),
    materialProv.confidence,
    shapeProv.confidence,
    logoProv.confidence,
  ];
  const confidence = confidenceValues.length
    ? confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length
    : 0;

  const shapeValue = profile.shapes?.[0] ?? "";
  const silhouetteValue = profile.shapes?.[1] ?? profile.shapes?.[0] ?? "";

  return {
    version: PRODUCT_IDENTITY_LOCK_VERSION,
    projectId,
    productAssetIds: [...productAssetIds],
    heroAssetId,
    identityVersion: `${PRODUCT_IDENTITY_LOCK_VERSION}-${Date.now()}`,
    productType: profile.productType || profile.category || "unknown",
    shape: attr(shapeValue, shapeValue ? shapeProv.confidence : 0, evidence, shapeValue ? shapeProv.kind : "unknown"),
    silhouette: attr(silhouetteValue, silhouetteValue ? shapeProv.confidence : 0, evidence, silhouetteValue ? shapeProv.kind : "unknown"),
    colors,
    logo: attr(
      profile.visibleLogos?.[0] ?? "",
      profile.visibleLogos?.[0] ? logoProv.confidence : 0,
      evidence,
      profile.visibleLogos?.[0] ? logoProv.kind : "unknown",
    ),
    branding: attr(
      profile.brand || "",
      profile.brand ? Math.max(logoProv.confidence, 0.7) : 0,
      evidence,
      profile.brand ? "user-provided" : "unknown",
    ),
    material: attr(
      profile.materials?.[0] ?? "",
      profile.materials?.[0] ? materialProv.confidence : 0,
      evidence,
      profile.materials?.[0] ? materialProv.kind : "unknown",
    ),
    texture: attr(profile.textures?.[0] ?? "", profile.textures?.[0] ? 0.55 : 0, evidence, profile.textures?.[0] ? "observed-from-image" : "unknown"),
    pattern: attr(profile.patterns?.[0] ?? "", profile.patterns?.[0] ? 0.55 : 0, evidence, profile.patterns?.[0] ? "observed-from-image" : "unknown"),
    sole: attr("", 0, null, "unknown"),
    laces: attr("", 0, null, "unknown"),
    structure: attr(profile.style?.[0] ?? "", profile.style?.[0] ? 0.5 : 0, evidence, profile.style?.[0] ? "inferred" : "unknown"),
    design: attr(profile.style?.join(", ") ?? "", profile.style?.length ? 0.5 : 0, evidence, profile.style?.length ? "inferred" : "unknown"),
    proportions: attr("", 0, null, "unknown"),
    distinctiveDetails: distinctiveDetails.length
      ? distinctiveDetails
      : [attr("unknown", 0, null, "unknown")],
    protectedAttributes: [...PROTECTED_PRODUCT_ATTRIBUTES],
    allowedCreativeChanges: [...ALLOWED_CREATIVE_CHANGES],
    sourceEvidence: [
      { field: "hero", assetId: heroAssetId, note: "Primary product reference image" },
      ...productAssetIds.slice(0, 12).map((id) => ({
        field: "productImage",
        assetId: id,
        note: "Product asset used for identity",
      })),
    ],
    confidence,
    analysisCapability: "VISION_ANALYSIS",
    analysisVersion: profile.analysisVersion || "unknown",
    profileId: profile.id ?? null,
    assetFingerprint,
    warnings,
    status: "PENDING_CONFIRMATION",
    createdAt: now,
    updatedAt: now,
    lockedAt: null,
  };
}

export function confirmIdentityLock(lock: ProductIdentityLock): ProductIdentityLock {
  const now = new Date().toISOString();
  return {
    ...lock,
    status: "LOCKED",
    updatedAt: now,
    lockedAt: now,
  };
}

export function markIdentityLockStale(lock: ProductIdentityLock): ProductIdentityLock {
  return {
    ...lock,
    status: "STALE",
    updatedAt: new Date().toISOString(),
    lockedAt: null,
  };
}
