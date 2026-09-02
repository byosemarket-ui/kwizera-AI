/**
 * Verified facts for AI Director — only user-confirmed or analysis-backed data.
 * Prevents Ollama from inventing product claims.
 */
import type { ConfirmedCommercial } from "./commercial.js";
import type { AiCreativePlannerInput } from "./ai-creative-planner.js";

export interface VerifiedFactsContext {
  allowedFacts: string[];
  unknownFacts: string[];
  priceAllowed: boolean;
  discountAllowed: boolean;
  ctaAllowed: string | null;
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function buildVerifiedFactsContext(input: AiCreativePlannerInput): VerifiedFactsContext {
  const info = input.project.productInformation ?? {};
  const commercial = input.commercial;
  const product = input.productIntelligence;
  const allowed: string[] = [];
  const unknown: string[] = [];

  const name = asText(info.name) || asText(product?.productName) || asText(input.project.name);
  if (name) allowed.push(`Product name: ${name}`);
  else unknown.push("Product name");

  const category = asText(info.category) || asText(product?.category);
  if (category) allowed.push(`Category: ${category}`);
  else unknown.push("Product category");

  const description = asText(info.description) || asText(product?.description);
  if (description) allowed.push(`Description: ${description.slice(0, 280)}`);
  else unknown.push("Product description");

  for (const feature of (product?.features ?? []).slice(0, 8)) {
    if (feature?.trim()) allowed.push(`Feature: ${feature.trim()}`);
  }
  for (const material of (product?.materials ?? []).slice(0, 4)) {
    if (material?.trim()) allowed.push(`Material: ${material.trim()}`);
  }

  const price = info.price ?? commercial?.pricing.currentPrice;
  const originalPrice = info.originalPrice ?? commercial?.pricing.originalPrice;
  const currency = asText(info.currency) || asText(commercial?.pricing.currency);
  const priceAllowed = price != null && Number.isFinite(price);
  const discountAllowed = Boolean(
    priceAllowed
    && originalPrice != null
    && Number.isFinite(originalPrice)
    && originalPrice > (price as number),
  );

  if (priceAllowed) {
    allowed.push(`Current price: ${price} ${currency || ""}`.trim());
  } else {
    unknown.push("Current price");
  }
  if (originalPrice != null && Number.isFinite(originalPrice)) {
    allowed.push(`Original price: ${originalPrice} ${currency || ""}`.trim());
  }
  if (!discountAllowed) unknown.push("Verified discount");

  const cta = asText(input.marketingSettings?.marketing.cta)
    || asText(input.project.campaignInformation?.callToAction);
  const ctaAllowed = cta || null;
  if (ctaAllowed) allowed.push(`Call to action: ${ctaAllowed}`);
  else unknown.push("Call to action");

  const goal = asText(input.videoSettings.objective)
    || asText(input.marketingSettings?.campaign.objective);
  if (goal) allowed.push(`Marketing goal: ${goal}`);
  else unknown.push("Marketing goal");

  return {
    allowedFacts: allowed,
    unknownFacts: unknown,
    priceAllowed,
    discountAllowed,
    ctaAllowed,
  };
}
