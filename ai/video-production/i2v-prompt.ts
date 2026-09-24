/**
 * Internal I2V prompt builder for cinematic Product Marketing Video scenes.
 * Separates PRODUCT identity constraints from MOTION / presentation direction.
 * Never includes secrets, Admin config, or provider model IDs.
 */

export interface I2vIdentityConstraints {
  protectedAttributes?: string[];
  allowedCreativeChanges?: string[];
  productName?: string;
  category?: string;
  colors?: string[];
  materials?: string[];
  distinctiveDetails?: string[];
}

export interface I2vScenePromptInput {
  purpose?: string;
  durationSeconds: number;
  motionHint?: string;
  cameraHint?: string;
  atmosphere?: string;
  lighting?: string;
  background?: string;
  visualDescription?: string;
  identity?: I2vIdentityConstraints | null;
}

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

export function buildI2vSystemInstructions(): string {
  return [
    "You are generating cinematic camera motion for a real product photograph in KWIZERA AI STUDIO.",
    "Preserve the exact product appearance from the source image.",
    "Do not alter protected product identity.",
    "Do not invent marketing text, logos, watermarks, or captions in the video.",
    "Focus only on camera movement, lighting atmosphere, and presentation around the product.",
  ].join(" ");
}

export function buildI2vMotionPrompt(input: I2vScenePromptInput): string {
  const protectedAttrs = (input.identity?.protectedAttributes?.length
    ? input.identity.protectedAttributes
    : DEFAULT_PROTECTED
  ).map((item) => String(item).trim()).filter(Boolean).slice(0, 16);

  const allowed = (input.identity?.allowedCreativeChanges?.length
    ? input.identity.allowedCreativeChanges
    : ["background", "lighting", "camera", "motion", "atmosphere", "composition"]
  ).map((item) => String(item).trim()).filter(Boolean).slice(0, 12);

  const productBits = [
    input.identity?.productName ? `Product: ${input.identity.productName}` : null,
    input.identity?.category ? `Category: ${input.identity.category}` : null,
    input.identity?.colors?.length ? `Known colors: ${input.identity.colors.slice(0, 4).join(", ")}` : null,
    input.identity?.materials?.length ? `Known materials: ${input.identity.materials.slice(0, 3).join(", ")}` : null,
  ].filter(Boolean);

  const camera = (input.cameraHint || "slow cinematic push-in").trim().slice(0, 120);
  const motion = (input.motionHint || "subtle product-preserving motion").trim().slice(0, 120);
  const purpose = (input.purpose || "product showcase").trim().slice(0, 80);
  const atmosphere = (input.atmosphere || input.lighting || "clean commercial lighting").trim().slice(0, 100);
  const background = (input.background || "professional marketing presentation").trim().slice(0, 100);
  const visual = (input.visualDescription || "").trim().slice(0, 160);

  return [
    "PRODUCT:",
    "Preserve the exact product appearance from the source image.",
    `Do not alter: ${protectedAttrs.join(", ")}.`,
    productBits.length ? productBits.join(". ") + "." : null,
    input.identity?.distinctiveDetails?.length
      ? `Keep distinctive details: ${input.identity.distinctiveDetails.slice(0, 4).join("; ")}.`
      : null,
    "",
    "MOTION:",
    `Scene purpose: ${purpose}.`,
    `Camera: ${camera}.`,
    `Motion: ${motion}.`,
    `Atmosphere: ${atmosphere}.`,
    `Presentation: ${background}.`,
    visual ? `Visual direction: ${visual}.` : null,
    `Allowed creative changes only: ${allowed.join(", ")}.`,
    `Duration target: ~${Math.max(2, Math.min(10, Math.round(input.durationSeconds)))} seconds.`,
    "No on-screen marketing text. Keep the product recognizable and centered.",
  ].filter((line) => line !== null).join("\n");
}

export function buildI2vNegativePrompt(identity?: I2vIdentityConstraints | null): string {
  const protectedAttrs = (identity?.protectedAttributes?.length
    ? identity.protectedAttributes
    : DEFAULT_PROTECTED
  ).map((item) => String(item).trim()).filter(Boolean).slice(0, 12);

  return [
    "do not change product shape",
    "do not change product color",
    "do not change logo",
    "do not change material",
    "do not deform the product",
    "do not duplicate the product",
    "do not invent another product",
    "do not add extra logos",
    "do not distort printed text on the product",
    "no watermark",
    "no captions",
    "no marketing typography burned into the frame",
    ...protectedAttrs.map((attr) => `do not alter ${attr}`),
  ].join(", ");
}
