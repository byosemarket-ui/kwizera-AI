import type { AuthoritativeMarketingBrief } from "../marketing-brief/types.js";
import type { CanonicalProduct } from "../product-record/types.js";
import type { CreativeProject } from "../creative-workspace/creative-workspace-manager.js";
import { humanizeValue } from "../product-record/humanize.js";
import { formatPrice, priceSceneCopy, type ConfirmedCommercial } from "./commercial.js";
import type { StoryBeatId } from "./story-structure.js";

export interface ProductionScript {
  headline: string;
  hook: string;
  productName: string;
  mainMessage: string;
  supportingPoints: string[];
  featureText: string;
  cta: string;
  narration: string[];
  website?: string;
  priceLine?: string;
}

function claimText(value: { text?: string } | string | undefined): string {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  return String(value.text ?? "").trim();
}

function localizedCta(language: string | undefined, productName: string): string {
  const lang = String(language ?? "").toLowerCase();
  if (lang.includes("kinyarwanda") || lang === "rw") return `Gura ${productName} ubu`;
  if (lang.includes("french") || lang === "fr") return `Découvrez ${productName}`;
  return `Discover ${productName}`;
}

export function buildProductionScript(
  project: CreativeProject,
  beats: StoryBeatId[],
  options: {
    product?: CanonicalProduct | null;
    brief?: AuthoritativeMarketingBrief | null;
    commercial: ConfirmedCommercial;
  },
): ProductionScript {
  const name = options.product?.identity.name || project.productInformation.name;
  const marketing = options.brief?.marketing;
  const main = claimText(marketing?.mainSellingPoint) || humanizeValue(project.productInformation.description) || name;
  const supporting = (marketing?.supportingPoints ?? [])
    .map((item) => claimText(item))
    .filter(Boolean)
    .slice(0, 3);
  const cta = marketing?.cta || options.brief?.campaign.cta || project.campaignInformation.callToAction
    || localizedCta(options.brief?.campaign.language || project.language, name);
  const hook = main.length > 48 ? `${name}` : main;
  const feature = supporting[0] || humanizeValue((project.productInformation.features ?? [])[0]) || "";
  const website = options.commercial.destination.website;
  const prices = priceSceneCopy(options.commercial);
  const priceLine = prices.saveLabel
    ? `${prices.newPrice} · ${prices.saveLabel}`
    : prices.newPrice;

  const narration: string[] = [];
  for (const beat of beats) {
    if (beat === "HOOK") narration.push(hook);
    else if (beat === "PRODUCT_REVEAL") narration.push(name);
    else if (beat === "FEATURE") narration.push(feature || main);
    else if (beat === "DETAIL") narration.push(supporting[1] || "A closer look at the product.");
    else if (beat === "EXPLORATION") narration.push(supporting[2] || main);
    else if (beat === "MESSAGE") narration.push(marketing?.message || main);
    else if (beat === "PRICE") narration.push(priceLine || options.commercial.promotion.message);
    else narration.push(website ? `${cta} ${website}` : cta);
  }

  return {
    headline: hook,
    hook,
    productName: name,
    mainMessage: main,
    supportingPoints: supporting,
    featureText: feature,
    cta,
    narration,
    website: website || undefined,
    priceLine,
  };
}
