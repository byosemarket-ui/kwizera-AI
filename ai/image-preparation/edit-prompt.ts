/**
 * Phase 7 — product-locked image editing prompt.
 * PRODUCT — LOCKED is always separated from ENVIRONMENT — EDITABLE.
 * Never includes secrets, Admin data, provider names, or model ids.
 */

import type { I2vIdentityConstraints } from "../video-production/i2v-prompt.js";
import { sanitizeCreativeRequest } from "./decision.js";

const DEFAULT_PROTECTED = [
  "shape",
  "color",
  "logo",
  "material",
  "texture",
  "pattern",
  "sole",
  "laces",
  "design",
  "product details",
];

export function buildImageEditPrompt(input: {
  request: string;
  identity?: I2vIdentityConstraints | null;
  maskGuided: boolean;
}): string {
  const request = sanitizeCreativeRequest(input.request).text
    || "clean professional studio backdrop with soft commercial lighting";
  const protectedAttrs = (input.identity?.protectedAttributes?.length
    ? input.identity.protectedAttributes
    : DEFAULT_PROTECTED
  ).map((item) => String(item).trim()).filter(Boolean).slice(0, 16);

  const productFacts = [
    input.identity?.productName ? `Product: ${input.identity.productName}` : null,
    input.identity?.category ? `Category: ${input.identity.category}` : null,
    input.identity?.colors?.length ? `Exact colors: ${input.identity.colors.slice(0, 4).join(", ")}` : null,
    input.identity?.materials?.length ? `Exact materials: ${input.identity.materials.slice(0, 3).join(", ")}` : null,
    input.identity?.distinctiveDetails?.length
      ? `Keep details: ${input.identity.distinctiveDetails.slice(0, 4).join("; ")}`
      : null,
  ].filter(Boolean);

  return [
    "PRODUCT — LOCKED:",
    "Preserve the exact product from the source photo, pixel-faithful.",
    `Do not change: ${protectedAttrs.join(", ")}.`,
    productFacts.length ? `${productFacts.join(". ")}.` : null,
    "Do not add, remove, duplicate, deform, or restyle the product.",
    "",
    "ENVIRONMENT — EDITABLE:",
    `Edit target: ${request}`,
    input.maskGuided
      ? "Only the masked environment may change: background, surface, lighting, atmosphere, shadows."
      : "Only the environment may change: background, surface, lighting, atmosphere, shadows.",
    "",
    "COMPOSITION:",
    "Keep the product position, scale, angle, and framing unchanged. The product stays the hero.",
    "",
    "QUALITY:",
    "Photorealistic professional commercial product photography, natural contact shadows,",
    "no text, no captions, no watermark, no extra logos, no additional products.",
  ].filter((line) => line !== null).join("\n");
}
