/**
 * Product-specific scene planning for Creative Planning.
 * References original asset IDs. Does not generate video.
 */
import { randomUUID } from "node:crypto";
import type { CreativeProject } from "../creative-workspace/creative-workspace-manager.js";
import { isOriginalProductImage } from "../creative-workspace/project-asset.js";
import type { ImageIntelligenceProfile } from "../image-intelligence/types.js";
import type { ProductIntelligenceProfile } from "../product-intelligence/types.js";
import type { PlanScene } from "./creative-planning-manager.js";

export type CameraDirection =
  | "close-up"
  | "medium-product"
  | "wide-hero"
  | "slow-push-in"
  | "orbit"
  | "side-reveal"
  | "top-down"
  | "detail-macro";

export interface SceneCopy {
  headline?: string;
  featureText?: string;
  benefitText?: string;
  supportingText?: string;
  priceOffer?: string;
  callToAction?: string;
}

export function planProductScenes(
  project: CreativeProject,
  product?: ProductIntelligenceProfile | null,
  imageProfiles: ImageIntelligenceProfile[] = [],
  existing: PlanScene[] = [],
): PlanScene[] {
  const originals = project.productImages.filter(isOriginalProductImage);
  if (!originals.length) return [];

  const pickAsset = (prefer: RegExp, fallbackIndex: number) => {
    const match = originals.find((image) => {
      const profile = imageProfiles.find((item) => item.imageId === image.id);
      return prefer.test(`${image.fileName} ${profile?.viewRole ?? ""}`);
    }) ?? originals[Math.min(fallbackIndex, originals.length - 1)]!;
    const profile = imageProfiles.find((item) => item.imageId === match.id);
    return { asset: match, profile };
  };

  const angles = product?.creativeAngles ?? [];
  const wants = (id: string) => angles.some((item) => item.id === id);
  const cta = project.campaignInformation.callToAction?.trim()
    || (product?.userFacts?.some((item) => item.field === "call-to-action") ? product.userFacts.find((item) => item.field === "call-to-action")?.value : undefined);
  const benefit = (project.productInformation.benefits ?? [])[0]
    || product?.valueProposition?.customerBenefit
    || "";
  const feature = (project.productInformation.features ?? [])[0]
    || product?.userFacts?.find((item) => item.field === "feature")?.value
    || "";
  const lightingFromImage = (profile?: ImageIntelligenceProfile) =>
    profile?.visualMetrics?.lightingObserved
    || profile?.lighting
    || "Keep lighting consistent with the source product photograph.";

  type Draft = {
    purpose: string;
    durationSeconds: number;
    visual: string;
    narration: string;
    camera: CameraDirection;
    lighting: string;
    composition: string;
    animation: string;
    assetId: string;
    imageRole: string;
    visualPurpose: string;
    cameraDirection: CameraDirection;
    transition: string;
    text: string;
    copy: SceneCopy;
  };

  const drafts: Draft[] = [];
  const hero = pickAsset(/front|hero/i, 0);
  drafts.push({
    purpose: "Product introduction",
    durationSeconds: 3,
    visual: `Introduce ${project.productInformation.name} using the real product still.`,
    narration: `${project.productInformation.name}${project.productInformation.category ? `, a ${project.productInformation.category}` : ""}.`,
    camera: "medium-product",
    lighting: lightingFromImage(hero.profile),
    composition: "Product centered with clean negative space",
    animation: "Subtle hold, then slow push-in",
    assetId: hero.asset.id,
    imageRole: hero.profile?.viewRole || "front",
    visualPurpose: "establish the product",
    cameraDirection: "medium-product",
    transition: "cut",
    text: project.productInformation.name,
    copy: { headline: project.productInformation.name },
  });

  if (wants("close-up-detail") || originals.length > 1) {
    const detail = pickAsset(/detail|close|macro/i, originals.length > 1 ? 1 : 0);
    drafts.push({
      purpose: "Product detail",
      durationSeconds: 3,
      visual: "Move closer to visible surface, colour, or construction details from the source image.",
      narration: product?.imageObservations?.find((item) => item.field === "visible-color")?.value
        ? `Visible ${product.imageObservations.find((item) => item.field === "visible-color")?.value} finish.`
        : `A closer look at ${project.productInformation.name}.`,
      camera: "detail-macro",
      lighting: lightingFromImage(detail.profile),
      composition: "Fill the frame with a defining product surface",
      animation: "Slow push-in",
      assetId: detail.asset.id,
      imageRole: detail.profile?.viewRole || "detail",
      visualPurpose: "show visible material and colour",
      cameraDirection: "close-up",
      transition: "cut",
      text: feature || "",
      copy: { featureText: feature || undefined, supportingText: "Visible product detail from the source image." },
    });
  }

  if (wants("feature-demonstration") && (feature || benefit)) {
    const proof = pickAsset(/side|left|right|back/i, 0);
    drafts.push({
      purpose: "Feature / benefit",
      durationSeconds: 4,
      visual: `Demonstrate ${feature || benefit} using the real product asset.`,
      narration: feature && benefit ? `${feature}. ${benefit}` : feature || benefit,
      camera: "slow-push-in",
      lighting: lightingFromImage(proof.profile),
      composition: "Product-led with room for a short feature line",
      animation: "Feature text resolves in",
      assetId: proof.asset.id,
      imageRole: proof.profile?.viewRole || "side",
      visualPurpose: "connect a recorded attribute to the product",
      cameraDirection: "slow-push-in",
      transition: "dissolve",
      text: feature || benefit,
      copy: { featureText: feature || undefined, benefitText: benefit || undefined },
    });
  }

  if (wants("lifestyle") || wants("premium-showcase")) {
    const life = pickAsset(/lifestyle|wide/i, 0);
    drafts.push({
      purpose: wants("lifestyle") ? "Lifestyle use" : "Premium presentation",
      durationSeconds: 4,
      visual: wants("lifestyle")
        ? "Place the product in a use context without inventing a setting the image does not support."
        : "Present the product with restrained, premium pacing.",
      narration: product?.valueProposition?.positioning || `Made for ${project.targetAudience || "everyday use"}.`,
      camera: wants("lifestyle") ? "wide-hero" : "orbit",
      lighting: lightingFromImage(life.profile),
      composition: "Product remains the visual priority",
      animation: "Gentle camera move",
      assetId: life.asset.id,
      imageRole: life.profile?.viewRole || "lifestyle",
      visualPurpose: wants("lifestyle") ? "suggest use context" : "premium product emphasis",
      cameraDirection: wants("lifestyle") ? "wide-hero" : "orbit",
      transition: "cut",
      text: "",
      copy: { supportingText: product?.customerIntelligence?.useCase },
    });
  }

  const close = pickAsset(/front|hero/i, 0);
  drafts.push({
    purpose: "Hero presentation",
    durationSeconds: 3,
    visual: `Return to a clear hero of ${project.productInformation.name}.`,
    narration: product?.valueProposition?.customerBenefit || project.productInformation.description || project.productInformation.name,
    camera: "wide-hero",
    lighting: lightingFromImage(close.profile),
    composition: "Hero product, logo-safe margins",
    animation: "Hold, then resolve toward the close",
    assetId: close.asset.id,
    imageRole: close.profile?.viewRole || "front",
    visualPurpose: "hero product close",
    cameraDirection: "wide-hero",
    transition: "cut",
    text: project.productInformation.name,
    copy: { headline: project.productInformation.name },
  });

  const userPrice = product?.userFacts?.find((item) => item.field === "price")?.value;
  drafts.push({
    purpose: "Call to action",
    durationSeconds: 3,
    visual: "End on the product with a clear next step. Do not invent offers.",
    narration: cta || `Discover ${project.productInformation.name}.`,
    camera: "medium-product",
    lighting: lightingFromImage(close.profile),
    composition: "Stable closing frame for CTA text",
    animation: "CTA text resolves cleanly",
    assetId: close.asset.id,
    imageRole: close.profile?.viewRole || "front",
    visualPurpose: "closing action",
    cameraDirection: "medium-product",
    transition: "fade",
    text: cta || `Discover ${project.productInformation.name}`,
    copy: {
      callToAction: cta || `Discover ${project.productInformation.name}`,
      priceOffer: userPrice,
    },
  });

  const generated = drafts.map((draft, index) => {
    const kept = existing.find((item) => item.userEdited && (item.order === index + 1 || item.purpose === draft.purpose));
    if (kept?.userEdited) {
      return {
        ...kept,
        order: index + 1,
        assetId: kept.assetId && originals.some((image) => image.id === kept.assetId) ? kept.assetId : draft.assetId,
      };
    }
    return toScene(index + 1, draft);
  });

  return generated;
}

function toScene(order: number, draft: {
  purpose: string;
  durationSeconds: number;
  visual: string;
  narration: string;
  camera: CameraDirection;
  lighting: string;
  composition: string;
  animation: string;
  assetId: string;
  imageRole: string;
  visualPurpose: string;
  cameraDirection: CameraDirection;
  transition: string;
  text: string;
  copy: SceneCopy;
}): PlanScene {
  return {
    id: randomUUID(),
    order,
    durationSeconds: draft.durationSeconds,
    purpose: draft.purpose,
    visual: draft.visual,
    narration: draft.narration,
    camera: draft.camera,
    lighting: draft.lighting,
    composition: draft.composition,
    animation: draft.animation,
    assetId: draft.assetId,
    imageRole: draft.imageRole,
    visualPurpose: draft.visualPurpose,
    cameraDirection: draft.cameraDirection,
    transition: draft.transition,
    text: draft.text,
    copy: draft.copy,
    userEdited: false,
  };
}
