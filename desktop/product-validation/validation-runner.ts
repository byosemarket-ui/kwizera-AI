import type { ProductProfile } from "../product-profile/types";
import type { MarketingProductionBrief } from "../marketing-input/types";
import { resolvedCta, resolvedLanguage, resolvedPlatforms } from "../marketing-input/types";
import { validateProfileFields, computeCompleteness as computeProfileCompleteness } from "../product-profile/validation";
import { validateMarketingFields, detectConflicts, computeMarketingCompleteness } from "../marketing-input/validation";
import type {
  CompletenessScores,
  ProductionRequirements,
  ReadinessState,
  ValidationIssue,
} from "./types";

function issue(
  partial: Omit<ValidationIssue, "acknowledged"> & { acknowledged?: boolean },
): ValidationIssue {
  return { ...partial, acknowledged: partial.acknowledged ?? false };
}

export function validateAssets(profile: ProductProfile): ValidationIssue[] {
  const set = profile.productImageSet;
  const images = set?.images ?? [];
  const out: ValidationIssue[] = [];

  if (!images.length) {
    out.push(issue({
      id: "assets-none",
      area: "assets",
      severity: "critical",
      code: "NO_IMAGES",
      title: "No valid product image",
      checked: "Required product images exist",
      found: "Zero images in Product Image Set",
      why: "Production cannot start without at least one product image.",
      howToFix: "Return to Image Organization or Product Intake and import images.",
      quickFix: "edit-images",
    }));
    return out;
  }

  const failed = images.filter((i) => i.analysisFailed && !i.userCorrected);
  if (failed.length) {
    out.push(issue({
      id: "assets-corrupt",
      area: "assets",
      severity: "critical",
      code: "CORRUPT_OR_FAILED",
      title: "Critical asset analysis failure",
      checked: "Images readable / analysis status",
      found: `${failed.length} image(s) failed analysis without user correction`,
      why: "Failed assets may break later generation stages.",
      howToFix: "Reclassify or replace failed images in Image Organization.",
      quickFix: "edit-images",
    }));
  }

  const unreadable = images.filter((i) => !i.url && !i.fileName);
  if (unreadable.length) {
    out.push(issue({
      id: "assets-meta",
      area: "assets",
      severity: "warning",
      code: "METADATA",
      title: "Incomplete asset metadata",
      checked: "Asset metadata validity",
      found: `${unreadable.length} image(s) missing URL/fileName`,
      why: "Thumbnails and pipeline references may fail.",
      howToFix: "Re-import affected assets.",
      quickFix: "edit-images",
    }));
  }

  out.push(issue({
    id: "assets-ok",
    area: "assets",
    severity: "info",
    code: "ASSETS_OK",
    title: "Product images present",
    checked: "Required product images exist; originals preserved as metadata-only organization",
    found: `${images.length} image(s) available`,
    why: "Assets are available for production.",
    howToFix: "No action required.",
  }));

  return out;
}

export function validateImageSet(profile: ProductProfile): ValidationIssue[] {
  const set = profile.productImageSet;
  const out: ValidationIssue[] = [];
  if (!set) {
    out.push(issue({
      id: "imageset-missing",
      area: "image-set",
      severity: "critical",
      code: "NO_IMAGE_SET",
      title: "Product Image Set missing",
      checked: "Product Image Set from Step 2",
      found: "No Product Image Set",
      why: "View classifications and coverage are required for production planning.",
      howToFix: "Complete Image Organization (Step 2).",
      quickFix: "edit-images",
    }));
    return out;
  }

  const noPrimary = !set.images.some((i) => i.roleInGroup === "primary");
  if (noPrimary) {
    out.push(issue({
      id: "imageset-primary",
      area: "image-set",
      severity: "warning",
      code: "NO_PRIMARY",
      title: "No primary image flagged",
      checked: "Primary images",
      found: "No image marked as primary",
      why: "Hero frames may be ambiguous.",
      howToFix: "Set a primary image in Image Organization.",
      quickFix: "edit-images",
    }));
  }

  const lowConf = set.images.filter((i) => i.confidence < 0.7 && !i.userCorrected);
  if (lowConf.length) {
    out.push(issue({
      id: "imageset-confidence",
      area: "image-set",
      severity: "warning",
      code: "LOW_CONFIDENCE",
      title: "Low-confidence classifications",
      checked: "Confidence scores",
      found: `${lowConf.length} image(s) below 70% confidence`,
      why: "Wrong view roles can confuse scene planning.",
      howToFix: "Review and reclassify flagged images.",
      quickFix: "edit-images",
    }));
  }

  for (const view of set.missingViews) {
    const required = view === "FRONT";
    out.push(issue({
      id: `imageset-missing-${view}`,
      area: "image-set",
      severity: required ? "critical" : "warning",
      code: required ? "MISSING_REQUIRED_VIEW" : "MISSING_RECOMMENDED_VIEW",
      title: `${view} view missing`,
      checked: "Important views available when required",
      found: `${view} is ${required ? "required" : "recommended"} and not present`,
      why: required
        ? "Front/primary product view is critical for production."
        : "Recommended views improve coverage but are optional for launch.",
      howToFix: required ? "Add a front/primary product image." : "Optionally add this view, or continue with warnings.",
      quickFix: "edit-images",
    }));
  }

  const dups = set.images.filter((i) => i.duplicateOfAssetId);
  if (dups.length) {
    out.push(issue({
      id: "imageset-dup",
      area: "image-set",
      severity: "info",
      code: "DUPLICATE",
      title: "Possible duplicate images",
      checked: "Product consistency / duplicates",
      found: `${dups.length} possible duplicate(s)`,
      why: "Duplicates waste generation slots but are not blockers.",
      howToFix: "Review duplicates in Image Organization if desired.",
      quickFix: "edit-images",
    }));
  }

  if (!set.consistencyOk) {
    out.push(issue({
      id: "imageset-consistency",
      area: "image-set",
      severity: "warning",
      code: "CONSISTENCY",
      title: "Possible product consistency issue",
      checked: "Product consistency across images",
      found: "Organization flagged inconsistent product signals",
      why: "Mixed products confuse storytelling.",
      howToFix: "Review classifications or keep if intentional.",
      quickFix: "review-conflict",
    }));
  }

  return out;
}

export function validateProductInfo(profile: ProductProfile): ValidationIssue[] {
  const fields = profile.fields;
  const imageCount = profile.productImageSet?.images.length ?? 0;
  const rows = validateProfileFields(fields, imageCount);
  const out: ValidationIssue[] = [];

  for (const row of rows) {
    if (row.status === "ok") continue;
    out.push(issue({
      id: `product-${row.field}`,
      area: "product-information",
      severity: row.status === "error" ? "critical" : "warning",
      code: row.field.toUpperCase(),
      title: row.message,
      checked: `Product field: ${row.field}`,
      found: row.message,
      why: row.status === "error"
        ? "Critical commerce fields must be present before production."
        : "Recommended for stronger product communication.",
      howToFix: "Edit Product Information and fill the field if relevant.",
      quickFix: "edit-product",
    }));
  }

  // Category-irrelevant: do not force apparel sizes on electronics — already handled by completeness warnings
  return out;
}

export function validateMarketing(brief: MarketingProductionBrief): ValidationIssue[] {
  const fields = brief.fields;
  const rows = validateMarketingFields(fields);
  const conflicts = detectConflicts(fields);
  const out: ValidationIssue[] = [];

  for (const row of rows) {
    if (row.status === "ok") continue;
    out.push(issue({
      id: `mkt-${row.field}`,
      area: "marketing",
      severity: row.status === "error" ? "critical" : "warning",
      code: row.field.toUpperCase(),
      title: row.message,
      checked: `Marketing field: ${row.field}`,
      found: row.message,
      why: row.status === "error"
        ? "Critical marketing settings must be set before production."
        : "Recommended for campaign quality.",
      howToFix: "Edit Marketing Input and update the setting.",
      quickFix: "edit-marketing",
    }));
  }

  for (const c of conflicts) {
    out.push(issue({
      id: `mkt-conflict-${c.id}`,
      area: c.code === "voice-language" ? "language" : c.code === "missing-cta" ? "cta" : "marketing",
      severity: c.severity === "error" ? "critical" : "warning",
      code: c.code.toUpperCase(),
      title: c.message,
      checked: "Marketing configuration conflicts",
      found: c.message,
      why: "Conflicting settings may produce wrong-format or weak campaigns.",
      howToFix: "Review marketing settings or keep intentionally after acknowledgment.",
      quickFix: "edit-marketing",
      acknowledged: c.acknowledged,
    }));
  }

  return out;
}

export function validateConsistency(profile: ProductProfile, brief: MarketingProductionBrief): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const colors = profile.fields.colors.map((c) => c.toLowerCase());
  const aiColors = profile.aiDerived
    .filter((a) => a.field === "colors" && a.status !== "rejected")
    .flatMap((a) => (Array.isArray(a.value) ? a.value : [String(a.value)]).map((v) => String(v).toLowerCase()));

  if (colors.length && aiColors.length) {
    const mismatch = aiColors.some((c) => !colors.some((u) => u.includes(c) || c.includes(u)));
    if (mismatch) {
      out.push(issue({
        id: "consist-color",
        area: "consistency",
        severity: "warning",
        code: "COLOR_CONFLICT",
        title: "COLOR CONFLICT",
        checked: "Product Profile colors vs AI visual estimate",
        found: `User: ${profile.fields.colors.join(", ")} · AI: ${aiColors.join(", ")}`,
        why: "Visual estimate differs from user-provided colors. User value is authoritative.",
        howToFix: "Keep user colors or review images / edit product colors.",
        quickFix: "keep-current",
        userValue: profile.fields.colors.join(", "),
        aiValue: aiColors.join(", "),
      }));
    }
  }

  const userBrand = profile.fields.brand.trim();
  const aiBrand = profile.aiDerived.find((a) => a.field === "brand" && a.status !== "rejected");
  if (userBrand && aiBrand && String(aiBrand.value).toLowerCase() !== userBrand.toLowerCase()
    && !/unknown|not determined/i.test(String(aiBrand.value))) {
    out.push(issue({
      id: "consist-brand",
      area: "consistency",
      severity: "warning",
      code: "BRAND_CONFLICT",
      title: "Brand mismatch warning",
      checked: "User brand vs AI brand estimate",
      found: `User: ${userBrand} · AI: ${String(aiBrand.value)}`,
      why: "User brand remains authoritative.",
      howToFix: "Keep user brand or accept AI suggestion in Product Information.",
      quickFix: "keep-current",
      userValue: userBrand,
      aiValue: String(aiBrand.value),
    }));
  }

  // Brand in marketing vs product
  if (brief.fields.brandName.trim() && userBrand
    && brief.fields.brandName.trim().toLowerCase() !== userBrand.toLowerCase()) {
    out.push(issue({
      id: "consist-brand-mkt",
      area: "consistency",
      severity: "warning",
      code: "BRAND_MARKETING",
      title: "Marketing brand differs from product brand",
      checked: "Product Profile brand vs Marketing brand settings",
      found: `Product: ${userBrand} · Marketing: ${brief.fields.brandName}`,
      why: "Inconsistent brand naming can confuse creatives.",
      howToFix: "Align brand names or keep if intentional.",
      quickFix: "review-conflict",
      userValue: userBrand,
      aiValue: brief.fields.brandName,
    }));
  }

  return out;
}

export function validatePricing(profile: ProductProfile, brief: MarketingProductionBrief): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const f = profile.fields;
  const price = f.price;

  if (price == null) {
    const sales = /sales|promotion|launch|order|buy/i.test(brief.fields.objective);
    if (sales) {
      out.push(issue({
        id: "price-missing-sales",
        area: "pricing",
        severity: "critical",
        code: "PRICE_REQUIRED",
        title: "Product price missing for a sales campaign",
        checked: "Price for sales-oriented objective",
        found: "No selling price on Product Profile",
        why: "Sales campaigns need an authoritative price.",
        howToFix: "Edit Product and set selling price (user value only).",
        quickFix: "edit-product",
      }));
    }
    return out;
  }

  if (f.originalPrice != null && f.originalPrice < price) {
    out.push(issue({
      id: "price-original",
      area: "pricing",
      severity: "warning",
      code: "ORIGINAL_LT_SELLING",
      title: "Original price lower than selling price",
      checked: "Original vs selling price",
      found: `Original ${f.originalPrice} < selling ${price}`,
      why: "May confuse discount messaging.",
      howToFix: "Correct prices in Product Information. User values are not auto-changed.",
      quickFix: "edit-product",
    }));
  }

  const promoType = brief.fields.promotionType;
  const promoDetails = brief.fields.promotionDetails.trim();
  if (promoType && promoType !== "None") {
    if (!promoDetails) {
      out.push(issue({
        id: "promo-empty",
        area: "pricing",
        severity: "warning",
        code: "PROMO_NO_DETAIL",
        title: "Promotion Conflict — missing details",
        checked: "Marketing promotion vs product price",
        found: `Promotion “${promoType}” without details`,
        why: "Promotion claims need user-provided details; never invent discounts.",
        howToFix: "Add promotion details in Marketing, or set promotion to None.",
        quickFix: "edit-marketing",
      }));
    }

    const pctMatch = promoDetails.match(/(\d+(?:\.\d+)?)\s*%/);
    if (pctMatch && f.discount != null && Math.abs(Number(pctMatch[1]) - f.discount) > 0.01) {
      out.push(issue({
        id: "promo-discount-mismatch",
        area: "pricing",
        severity: "warning",
        code: "PROMO_DISCOUNT_MISMATCH",
        title: "Promotion Conflict",
        checked: "Product discount vs marketing promotion percentage",
        found: `Product discount ${f.discount}% vs marketing “${pctMatch[1]}%”`,
        why: "Inconsistent discount messaging. User data is not overwritten.",
        howToFix: "Align product discount and marketing promotion details.",
        quickFix: "review-conflict",
        userValue: String(f.discount),
        aiValue: pctMatch[1],
      }));
    }

    if (pctMatch && f.originalPrice != null && price != null) {
      const expected = Math.round(f.originalPrice * (1 - Number(pctMatch[1]) / 100));
      if (Math.abs(expected - price) > 1) {
        out.push(issue({
          id: "promo-math",
          area: "pricing",
          severity: "warning",
          code: "PROMO_MATH",
          title: "Promotion Conflict — math inconsistency",
          checked: "Original price − discount ≈ selling price",
          found: `Expected ~${expected} ${f.currency} from ${f.originalPrice} − ${pctMatch[1]}%, got ${price}`,
          why: "Promotional math does not match stored prices.",
          howToFix: "Review prices or promotion details. Do not invent values.",
          quickFix: "edit-product",
        }));
      }
    }
  }

  // AI must never invent price — surface if AI somehow suggested price (should not exist)
  const aiPrice = profile.aiDerived.find((a) => a.field === "price");
  if (aiPrice) {
    out.push(issue({
      id: "price-ai",
      area: "pricing",
      severity: "info",
      code: "USER_PRICE_PRESERVED",
      title: "User price preserved",
      checked: "User price vs any AI price signal",
      found: `User price ${price} ${f.currency} kept; AI signal ignored for overwrite`,
      why: "User-provided prices are authoritative.",
      howToFix: "No action — review only if you want to change the price yourself.",
      quickFix: "keep-current",
      userValue: `${price} ${f.currency}`,
      aiValue: String(aiPrice.value),
    }));
  }

  return out;
}

export function validateCta(brief: MarketingProductionBrief): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const objective = brief.fields.objective;
  const cta = resolvedCta(brief.fields);
  const sales = /sales|promotion|launch|order|buy|lead/i.test(objective);
  const soft = /learn more|discover|explore/i.test(cta);

  if (sales && soft) {
    out.push(issue({
      id: "cta-soft",
      area: "cta",
      severity: "warning",
      code: "CTA_REVIEW",
      title: "CTA Could Be Stronger",
      checked: "CTA matches campaign objective",
      found: `Objective “${objective}” with CTA “${cta || "(empty)"}”`,
      why: "Sales objectives often perform better with direct CTAs.",
      howToFix: "Consider Buy Now / Order Now / Shop Now — user remains in control.",
      quickFix: "use-ai-recommendation",
      userValue: cta,
      aiValue: "Buy Now / Order Now / Shop Now",
    }));
  }

  return out;
}

export function validateLanguage(brief: MarketingProductionBrief): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const content = resolvedLanguage(brief.fields);
  const voice = brief.fields.voiceLanguage.trim() || content;

  if (brief.fields.narrationEnabled && voice && content && voice !== content && brief.fields.language !== "Other") {
    out.push(issue({
      id: "lang-mismatch",
      area: "language",
      severity: "warning",
      code: "LANGUAGE_MISMATCH",
      title: "Language mismatch",
      checked: "Content language vs voice language",
      found: `Content: ${content} · Voice: ${voice}`,
      why: "Mismatch may confuse narration/subtitles unless intentional.",
      howToFix: "Align languages or keep intentionally after review.",
      quickFix: "edit-marketing",
      userValue: content,
      aiValue: voice,
    }));
  }

  return out;
}

export function buildProductionRequirements(
  profile: ProductProfile,
  brief: MarketingProductionBrief,
): ProductionRequirements {
  const platforms = resolvedPlatforms(brief.fields);
  return {
    productImages: (profile.productImageSet?.images.length ?? 0) > 0,
    productInformation: Boolean(profile.fields.name && profile.fields.category),
    marketingInformation: Boolean(brief.fields.objective && platforms.length),
    storyRequirements: [
      `Objective: ${brief.fields.objective || "unspecified"}`,
      `Tone: ${brief.fields.tone || "unspecified"}`,
      `Format: ${brief.fields.contentFormat || "unspecified"}`,
    ],
    creativeRequirements: [
      brief.fields.style || "style unspecified",
      brief.fields.mood || "mood unspecified",
      brief.fields.visualPreference || "visual preference unspecified",
    ].filter(Boolean),
    audioRequirements: brief.fields.narrationEnabled
      ? [`Narration on · ${brief.fields.voiceLanguage || resolvedLanguage(brief.fields)} · ${brief.fields.tone}`]
      : ["Narration off"],
    videoRequirements: [
      `Duration: ${brief.fields.duration}${brief.fields.duration === "custom" ? ` (${brief.fields.customDurationSeconds}s)` : ""}`,
      `Format: ${brief.fields.contentFormat || "unspecified"}`,
    ],
    platformRequirements: platforms.length ? platforms : ["No platform selected"],
    exportRequirements: ["Local production package", "Pipeline enqueue when confirmed"],
  };
}

export function computeReadinessScores(
  profile: ProductProfile,
  brief: MarketingProductionBrief,
  issues: ValidationIssue[],
): CompletenessScores {
  const imageCount = profile.productImageSet?.images.length ?? 0;
  const coverage = profile.productImageSet?.coverageScore ?? (imageCount ? 50 : 0);
  const profileComp = computeProfileCompleteness(
    profile.fields,
    coverage,
    profile.variants,
  );
  const mkt = computeMarketingCompleteness(brief.fields);

  const productAssets = imageCount ? (issues.some((i) => i.area === "assets" && i.severity === "critical" && !i.acknowledged) ? 40 : 100) : 0;
  const imageSet = Math.round(coverage);
  const productInformation = profileComp.overall;
  const marketing = mkt.overall;

  const critical = issues.filter((i) => i.severity === "critical" && !i.acknowledged).length;
  const warnings = issues.filter((i) => i.severity === "warning" && !i.acknowledged).length;
  const validation = critical ? Math.max(0, 40 - critical * 10) : warnings ? Math.max(60, 100 - warnings * 8) : 100;

  const overall = Math.round(
    productAssets * 0.2 + imageSet * 0.15 + productInformation * 0.25 + marketing * 0.25 + validation * 0.15,
  );

  const blockersTo100: string[] = [];
  for (const i of issues.filter((x) => x.severity !== "info" && !x.acknowledged)) {
    blockersTo100.push(i.title);
  }
  if (imageSet < 100 && profile.productImageSet?.missingViews.length) {
    blockersTo100.push(`Missing views: ${profile.productImageSet.missingViews.join(", ")}`);
  }

  return {
    productAssets,
    imageSet,
    productInformation,
    marketing,
    validation,
    overall,
    blockersTo100: [...new Set(blockersTo100)].slice(0, 12),
  };
}

export function deriveReadiness(issues: ValidationIssue[], scores: CompletenessScores): {
  readiness: ReadinessState;
  reason: string;
} {
  const critical = issues.filter((i) => i.severity === "critical" && !i.acknowledged);
  const warnings = issues.filter((i) => i.severity === "warning" && !i.acknowledged);
  const manual = issues.filter((i) =>
    !i.acknowledged && (i.code === "COLOR_CONFLICT" || i.code === "BRAND_CONFLICT" || i.code === "PROMO_MATH"),
  );

  if (critical.length) {
    return {
      readiness: "NOT_READY",
      reason: `Critical blocker(s): ${critical.map((c) => c.title).join("; ")}`,
    };
  }
  if (manual.length && scores.overall < 85) {
    return {
      readiness: "MANUAL_REVIEW_REQUIRED",
      reason: `Ambiguity needs confirmation: ${manual.map((m) => m.title).join("; ")}`,
    };
  }
  if (warnings.length) {
    return {
      readiness: "READY_WITH_WARNINGS",
      reason: `${warnings.length} warning(s) remain — production can continue after review.`,
    };
  }
  return {
    readiness: "READY",
    reason: "No critical issues or unacknowledged warnings.",
  };
}

export function runAllValidations(
  profile: ProductProfile,
  brief: MarketingProductionBrief,
): ValidationIssue[] {
  const raw = [
    ...validateAssets(profile),
    ...validateImageSet(profile),
    ...validateProductInfo(profile),
    ...validateMarketing(brief),
    ...validateConsistency(profile, brief),
    ...validatePricing(profile, brief),
    ...validateCta(brief),
    ...validateLanguage(brief),
  ];
  // Drop pure success info noise except assets-ok — keep useful infos
  return raw.filter((i) => !(i.severity === "info" && i.code === "ASSETS_OK"));
}
