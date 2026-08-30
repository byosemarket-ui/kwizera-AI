export type ProductionModeId = "AI_PRODUCT_MOTION" | "CINEMATIC_3D" | "CLASSIC_SHOWCASE";

export type CreativeToneId = "Premium" | "Modern" | "Energetic" | "Minimal" | "Luxury";

export interface ProductionModeCapability {
  mode: ProductionModeId;
  label: string;
  description: string;
  available: boolean;
  provider: string;
  reason: string;
  limitations: string[];
  recommended?: boolean;
}

export const MODE_COPY: Record<ProductionModeId, { label: string; description: string }> = {
  AI_PRODUCT_MOTION: {
    label: "AI Product Motion",
    description:
      "Transform your real product photographs into a dynamic marketing video with intelligent motion, camera movement, professional framing and marketing composition.",
  },
  CINEMATIC_3D: {
    label: "3D / Cinematic Product",
    description:
      "Create a more cinematic product presentation when a real 3D or generative transformation provider is configured.",
  },
  CLASSIC_SHOWCASE: {
    label: "Classic Product Showcase",
    description:
      "Create a clean, professional marketing video by sequencing original product photographs with controlled motion, transitions, text and commercial information.",
  },
};

export function recommendProductionMode(
  capabilities: ProductionModeCapability[],
  uniqueViewCount: number,
): ProductionModeId {
  const recommended = capabilities.find((c) => c.recommended && c.available);
  if (recommended) return recommended.mode;
  if (uniqueViewCount >= 2) {
    const motion = capabilities.find((c) => c.mode === "AI_PRODUCT_MOTION" && c.available);
    if (motion) return motion.mode;
  }
  const classic = capabilities.find((c) => c.mode === "CLASSIC_SHOWCASE" && c.available);
  if (classic) return classic.mode;
  return "AI_PRODUCT_MOTION";
}

export function recommendCreativeTone(
  category: string,
  objective: string,
): CreativeToneId {
  const cat = category.toLowerCase();
  const obj = objective.toLowerCase();
  if (/luxury|premium|jewel|watch|leather|formal|oxford|suit/.test(cat)) return "Premium";
  if (/sale|promote|order|drive/.test(obj)) return "Energetic";
  if (/brand|awareness/.test(obj)) return "Modern";
  if (/minimal|tech|software/.test(cat)) return "Minimal";
  return "Modern";
}

export function cinematicProviderConfigured(): boolean {
  const provider = (process.env.KWIZERA_IMAGE_TO_VIDEO_PROVIDER ?? "").trim().toLowerCase();
  return provider.length > 0 && provider !== "none" && provider !== "unavailable";
}
