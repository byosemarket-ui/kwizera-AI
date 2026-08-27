import type { ProductProfile } from "../product-profile/types";
import type {
  MarketingInputFields,
  StructuredMarketingPlan,
  VideoConcept,
} from "./types";
import {
  resolvedAudienceSummary,
  resolvedCta,
  resolvedFormat,
  resolvedLanguage,
  resolvedPlatforms,
} from "./types";

function durationSeconds(fields: MarketingInputFields): number {
  if (fields.duration === "short") return 15;
  if (fields.duration === "medium") return 30;
  if (fields.duration === "long") return 60;
  if (fields.duration === "custom" && fields.customDurationSeconds) return fields.customDurationSeconds;
  const platforms = resolvedPlatforms(fields);
  if (platforms.some((p) => /tiktok|instagram|whatsapp/i.test(p))) return 20;
  return 30;
}

export function buildStructuredMarketingPlan(
  fields: MarketingInputFields,
  product: ProductProfile,
  intel: Record<string, unknown> | null,
): StructuredMarketingPlan {
  const pf = product.fields;
  const selling = pf.benefits.length ? pf.benefits : pf.features;
  const structured = product.structuredProfile;
  const aiSelling = structured?.commercial.sellingPoints ?? [];
  const mainPoint = selling[0] || aiSelling[0] || pf.shortDescription || pf.name;
  const supporting = [...new Set([...selling.slice(1, 4), ...aiSelling.slice(0, 3)])].filter(Boolean);
  const audience = resolvedAudienceSummary(fields) || structured?.commercial.targetAudience || "Product buyers";
  const platforms = resolvedPlatforms(fields);
  const strategy = String(intel?.strategy ?? "");
  const platformIntel = intel?.platform as { recommendations?: string[]; format?: string } | undefined;
  const angle = strategy || `${fields.objective || "Showcase"} focused on ${mainPoint}`;
  const messageParts = [pf.name, mainPoint, pf.description?.slice(0, 120)].filter(Boolean);
  const ctas = Array.isArray(intel?.ctas) ? intel!.ctas.map(String) : [];
  const cta = resolvedCta(fields) || ctas[0] || "Learn More";

  return {
    audience,
    angle,
    mainSellingPoint: mainPoint,
    supportingPoints: supporting,
    message: messageParts.join(" — "),
    cta,
    platformStrategy: platforms.length
      ? `${platforms.join(", ")}${platformIntel?.format ? ` · ${platformIntel.format}` : ""}${platformIntel?.recommendations?.length ? ` · ${platformIntel.recommendations[0]}` : ""}`
      : "Multi-platform short-form video",
    tone: fields.tone || "Professional",
    videoObjective: fields.objective || "Showcase product value",
    analyzedAt: new Date().toISOString(),
  };
}

export function buildVideoConcept(
  fields: MarketingInputFields,
  product: ProductProfile,
  plan: StructuredMarketingPlan,
): VideoConcept {
  const pf = product.fields;
  const duration = durationSeconds(fields);
  const format = resolvedFormat(fields) || "Short Product Video";
  const imageCount = product.productImageSet?.images.length ?? 0;

  return {
    purpose: plan.videoObjective,
    presentationStyle: format.includes("Demonstration") ? "feature walkthrough" : "hero product showcase",
    visualDirection: fields.style || fields.mood || `${pf.category || "product"} studio presentation`,
    storyDirection: `Hook → ${plan.mainSellingPoint} → supporting benefits → ${plan.cta}`,
    approximateDurationSec: duration,
    sceneStrategy: imageCount >= 3
      ? "Rotate through uploaded product views with benefit callouts"
      : "Focus on primary product image with animated detail moments",
    ctaPlacement: "Final scene with on-screen CTA",
    createdAt: new Date().toISOString(),
  };
}

export function applyMarketingDefaults(fields: MarketingInputFields): MarketingInputFields {
  const next = { ...fields };
  if (!next.contentFormat.trim() || (next.contentFormat === "Custom Format" && !next.customFormat.trim())) {
    next.contentFormat = "Short Product Video";
  }
  if (!resolvedLanguage(next)) {
    next.language = "Kinyarwanda";
  }
  if (!next.voiceLanguage.trim()) {
    next.voiceLanguage = resolvedLanguage(next) || "Kinyarwanda";
  }
  if (!next.tone.trim()) next.tone = "Professional";
  return next;
}
