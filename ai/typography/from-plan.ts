import type { CreativePlan, PlanScene } from "../creative-planning/creative-planning-manager.js";
import { buildConfirmedCommercial, priceSceneCopy, type ConfirmedCommercial } from "../creative-planning/commercial.js";
import type { CreativeProject } from "../creative-workspace/creative-workspace-manager.js";
import type { TypographyComposeInput, TextRole } from "./types.js";

export function sceneRoleTexts(
  scene: PlanScene,
  commercial?: ConfirmedCommercial,
): Array<{ role: TextRole; text: string }> {
  const purpose = scene.purpose.toUpperCase();
  const items: Array<{ role: TextRole; text: string }> = [];
  if (/price|promo|offer/i.test(purpose) && commercial) {
    const price = priceSceneCopy(commercial);
    if (price.oldPrice) items.push({ role: "previousPrice", text: `WAS ${price.oldPrice}` });
    if (price.newPrice) items.push({ role: "price", text: `NOW ${price.newPrice}` });
    else if (scene.copy?.priceOffer?.trim()) items.push({ role: "price", text: scene.copy.priceOffer.trim() });
    if (price.saveLabel) items.push({ role: "discount", text: price.saveLabel });
    if (items.length) return items.slice(0, 3);
  }

  const isClosing = /cta|call|closing|end|final|contact/i.test(purpose);
  if (isClosing) {
    if (scene.copy?.callToAction?.trim()) items.push({ role: "cta", text: scene.copy.callToAction.trim() });
    if (commercial?.productName) items.push({ role: "brand", text: commercial.productName });
    else if (typeof scene.copy?.headline === "string" && scene.copy.headline.trim()) {
      items.push({ role: "brand", text: scene.copy.headline.trim() });
    }
    if (commercial?.destination.website) items.push({ role: "website", text: commercial.destination.website });
    if (commercial?.destination.phone) items.push({ role: "phone", text: commercial.destination.phone });
    if (items.length) return items.slice(0, 4);
  }

  const headline = typeof scene.copy?.headline === "string"
    ? scene.copy.headline.trim()
    : typeof scene.text === "string"
      ? scene.text.trim()
      : "";
  if (headline && headline !== "[object Object]") {
    items.push({ role: /hook/i.test(purpose) ? "hook" : "headline", text: headline });
  }
  if (scene.copy?.featureText?.trim()) items.push({ role: "productFeature", text: scene.copy.featureText.trim() });
  if (scene.copy?.benefitText?.trim()) items.push({ role: "benefit", text: scene.copy.benefitText.trim() });
  if (scene.copy?.callToAction?.trim() && /cta|call/i.test(purpose)) {
    items.push({ role: "cta", text: scene.copy.callToAction.trim() });
  } else if (scene.copy?.supportingText?.trim()) {
    items.push({ role: "supporting", text: scene.copy.supportingText.trim() });
  } else if (scene.copy?.callToAction?.trim()) {
    items.push({ role: "cta", text: scene.copy.callToAction.trim() });
  } else if (scene.copy?.priceOffer?.trim()) {
    items.push({ role: "price", text: scene.copy.priceOffer.trim() });
  }
  return items.slice(0, 3);
}

export function composeInputFromProject(input: {
  project: CreativeProject;
  plan: CreativePlan;
  width: number;
  height: number;
  aspectRatio: "16:9" | "9:16" | "1:1" | "4:5";
  platform?: string;
  useOllama?: boolean;
  images?: TypographyComposeInput["scenes"][number]["image"][];
}): TypographyComposeInput {
  const brandColors = typeof input.project.brandInformation?.colors === "string"
    ? input.project.brandInformation.colors
      .split(/[,;\s]+/)
      .map((c) => c.trim())
      .filter((c) => /^#?[0-9a-f]{6}$/i.test(c))
      .map((c) => (c.startsWith("#") ? c : `#${c}`))
    : Array.isArray(input.project.productInformation?.colors)
      ? input.project.productInformation.colors.filter((c): c is string => typeof c === "string" && /^#?[0-9a-f]{6}$/i.test(c))
      : undefined;
  const commercial = buildConfirmedCommercial({
    productName: input.project.productInformation.name || input.project.name,
    currentPrice: input.project.productInformation.price,
    originalPrice: input.project.productInformation.originalPrice,
    currency: input.project.productInformation.currency,
    website: input.project.brandInformation.website,
    phone: (input.project.productInformation as { phone?: string }).phone
      ?? (input.project.brandInformation as { phone?: string }).phone,
    cta: input.project.campaignInformation.callToAction,
  });
  const scenes = [...input.plan.scenes].sort((a, b) => a.order - b.order).map((scene, index) => ({
    sceneId: scene.id,
    purpose: scene.purpose,
    assetId: scene.assetId,
    texts: sceneRoleTexts(scene, commercial),
    image: {
      composition: scene.composition,
      productLikelyCentered: !/edge|left|right/i.test(scene.composition ?? ""),
      brandColors,
      ...(input.images?.[index] ?? {}),
    },
  }));
  return {
    projectId: input.project.id,
    productCategory: input.project.productInformation?.category,
    productName: input.project.productInformation?.name ?? input.project.name,
    marketingGoal: input.plan.analyses?.campaign,
    audience: input.plan.analyses?.audience,
    platform: input.platform ?? input.plan.analyses?.platform,
    language: input.plan.analyses?.language,
    creativeTone: input.plan.creativeTone,
    productionMode: input.plan.productionMode,
    width: input.width,
    height: input.height,
    aspectRatio: input.aspectRatio,
    scenes,
    brandColors,
    useOllama: input.useOllama ?? process.env.KWIZERA_TYPOGRAPHY_OLLAMA === "1",
  };
}
