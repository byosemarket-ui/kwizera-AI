import {
  KnowledgeProductCategory,
  KnowledgeProductMarketingGoal,
  ProductAnalysisInput,
  ProductBrandKnowledge,
  ProductCustomerKnowledge,
  ProductMarketingKnowledge,
  ProductProfileKnowledge,
  ProductVisualKnowledge,
} from "./types.js";

const CATEGORY_DEFAULTS: Record<
  KnowledgeProductCategory,
  { subcategory: string; materials: string[]; visual: Partial<ProductVisualKnowledge> }
> = {
  [KnowledgeProductCategory.Electronics]: {
    subcategory: "smart-devices",
    materials: ["aluminum", "glass", "plastic"],
    visual: { productShape: "sleek-rectangular", productTexture: "matte-metal", productPackaging: "minimal-box" },
  },
  [KnowledgeProductCategory.Fashion]: {
    subcategory: "apparel",
    materials: ["cotton", "polyester"],
    visual: { productShape: "garment-form", productTexture: "woven-fabric", productPackaging: "branded-bag" },
  },
  [KnowledgeProductCategory.Shoes]: {
    subcategory: "footwear",
    materials: ["leather", "rubber", "mesh"],
    visual: { productShape: "footwear-silhouette", productTexture: "mixed-material", productPackaging: "shoe-box" },
  },
  [KnowledgeProductCategory.Bags]: {
    subcategory: "handbags",
    materials: ["leather", "canvas"],
    visual: { productShape: "bag-silhouette", productTexture: "grain-leather", productPackaging: "dust-bag" },
  },
  [KnowledgeProductCategory.Beauty]: {
    subcategory: "skincare",
    materials: ["glass", "cream-formula"],
    visual: { productShape: "bottle-jar", productTexture: "smooth-gloss", productPackaging: "premium-box" },
  },
  [KnowledgeProductCategory.Food]: {
    subcategory: "packaged-food",
    materials: ["organic-ingredients"],
    visual: { productShape: "package-form", productTexture: "fresh-natural", productPackaging: "sealed-pack" },
  },
  [KnowledgeProductCategory.Restaurant]: {
    subcategory: "dining",
    materials: ["fresh-ingredients"],
    visual: { productShape: "plate-presentation", productTexture: "appetizing", productPackaging: "dine-in" },
  },
  [KnowledgeProductCategory.Hotel]: {
    subcategory: "accommodation",
    materials: ["premium-linens"],
    visual: { productShape: "room-layout", productTexture: "luxury-finish", productPackaging: "experience" },
  },
  [KnowledgeProductCategory.Furniture]: {
    subcategory: "living-room",
    materials: ["wood", "fabric", "metal"],
    visual: { productShape: "furniture-form", productTexture: "wood-grain", productPackaging: "flat-pack" },
  },
  [KnowledgeProductCategory.HomeAppliances]: {
    subcategory: "kitchen",
    materials: ["stainless-steel", "plastic"],
    visual: { productShape: "appliance-form", productTexture: "brushed-steel", productPackaging: "retail-box" },
  },
  [KnowledgeProductCategory.Vehicles]: {
    subcategory: "automotive",
    materials: ["steel", "aluminum", "leather"],
    visual: { productShape: "vehicle-profile", productTexture: "metallic-paint", productPackaging: "showroom" },
  },
  [KnowledgeProductCategory.RealEstate]: {
    subcategory: "residential",
    materials: ["concrete", "glass", "wood"],
    visual: { productShape: "property-exterior", productTexture: "architectural", productPackaging: "listing" },
  },
  [KnowledgeProductCategory.Education]: {
    subcategory: "courses",
    materials: ["digital-content"],
    visual: { productShape: "course-card", productTexture: "clean-modern", productPackaging: "digital-access" },
  },
  [KnowledgeProductCategory.Health]: {
    subcategory: "wellness",
    materials: ["natural-ingredients"],
    visual: { productShape: "supplement-bottle", productTexture: "clean-medical", productPackaging: "pharma-box" },
  },
  [KnowledgeProductCategory.Future]: {
    subcategory: "general",
    materials: ["composite"],
    visual: { productShape: "adaptive", productTexture: "versatile", productPackaging: "standard" },
  },
};

export class ProductAnalyzer {
  analyze(input: ProductAnalysisInput): {
    profile: ProductProfileKnowledge;
    visual: ProductVisualKnowledge;
    brand: ProductBrandKnowledge;
    marketing: ProductMarketingKnowledge;
    customer: ProductCustomerKnowledge;
  } {
    const category =
      input.category ?? input.profile?.category ?? KnowledgeProductCategory.Electronics;
    const defaults = CATEGORY_DEFAULTS[category];
    const productName = input.productName ?? input.profile?.productName ?? "Unnamed Product";
    const brand = input.brand ?? input.profile?.brand ?? "Unknown Brand";

    const profile: ProductProfileKnowledge = {
      productName,
      category,
      subcategory: input.subcategory ?? input.profile?.subcategory ?? defaults.subcategory,
      brand,
      description:
        input.description ??
        input.profile?.description ??
        `Professional ${productName} from ${brand}`,
      features: input.features ??
        input.profile?.features ?? ["premium quality", "innovative design", "reliable performance"],
      specifications: input.specifications ??
        input.profile?.specifications ?? { weight: "standard", warranty: "12 months" },
      materials: input.materials ?? input.profile?.materials ?? defaults.materials,
      dimensions: input.dimensions ?? input.profile?.dimensions ?? "standard",
      colors: input.colors ?? input.profile?.colors ?? ["black", "white"],
      sizes: input.sizes ?? input.profile?.sizes ?? ["standard"],
      price: input.price ?? input.profile?.price ?? 99.99,
      currency: input.currency ?? input.profile?.currency ?? "USD",
      targetAudience:
        input.targetAudience ?? input.profile?.targetAudience ?? "general consumers",
      marketingGoal:
        input.marketingGoal ??
        input.profile?.marketingGoal ??
        KnowledgeProductMarketingGoal.Conversion,
      supplier: input.supplier ?? input.profile?.supplier,
    };

    const visual: ProductVisualKnowledge = {
      productAppearance:
        input.visual?.productAppearance ?? defaults.visual.productShape ?? "clean-modern",
      productShape: input.visual?.productShape ?? defaults.visual.productShape ?? "standard",
      productColor: input.visual?.productColor ?? profile.colors[0] ?? "neutral",
      productTexture: input.visual?.productTexture ?? defaults.visual.productTexture ?? "smooth",
      productPackaging:
        input.visual?.productPackaging ?? defaults.visual.productPackaging ?? "retail-box",
      productBackground: input.visual?.productBackground ?? "studio-white-gradient",
      productPlacement: input.visual?.productPlacement ?? "center-hero",
      productVisibility: input.visual?.productVisibility ?? 90,
      productQuality: input.visual?.productQuality ?? 85,
    };

    const brandKnowledge: ProductBrandKnowledge = {
      brandIdentity: input.brandKnowledge?.brandIdentity ?? `${brand} premium identity`,
      brandColors: input.brandKnowledge?.brandColors ?? ["#1a1a2e", "#e94560", "#ffffff"],
      brandStyle: input.brandKnowledge?.brandStyle ?? "modern-premium",
      brandPersonality: input.brandKnowledge?.brandPersonality ?? "trustworthy-innovative",
      logoUsage: input.brandKnowledge?.logoUsage ?? "top-left-watermark",
      brandConsistency: input.brandKnowledge?.brandConsistency ?? 85,
    };

    const marketing: ProductMarketingKnowledge = {
      productBenefits:
        input.marketing?.productBenefits ??
        profile.features.map((f) => `Benefit: ${f}`),
      customerProblems:
        input.marketing?.customerProblems ?? [
          "needs better quality",
          "wants reliable solution",
        ],
      productSolutions:
        input.marketing?.productSolutions ?? [
          `${productName} delivers premium ${profile.subcategory} experience`,
        ],
      uniqueSellingPoints:
        input.marketing?.uniqueSellingPoints ?? profile.features.slice(0, 3),
      emotionalAppeal:
        input.marketing?.emotionalAppeal ?? "confidence and satisfaction",
      callToAction: input.marketing?.callToAction ?? "Shop Now — Limited Offer",
      salesStrategy: input.marketing?.salesStrategy ?? "value-driven-direct",
      productPositioning:
        input.marketing?.productPositioning ??
        `Premium ${profile.subcategory} for ${profile.targetAudience}`,
    };

    const customer: ProductCustomerKnowledge = {
      customerNeeds:
        input.customer?.customerNeeds ?? ["quality", "value", "reliability"],
      customerInterests:
        input.customer?.customerInterests ?? [profile.category, profile.subcategory, brand],
      buyingMotivation:
        input.customer?.buyingMotivation ?? "solve a specific need with trusted product",
      preferredPresentation:
        input.customer?.preferredPresentation ?? "hero-product-on-clean-background",
      preferredMarketingStyle:
        input.customer?.preferredMarketingStyle ?? "benefit-driven-visual",
      preferredPlatforms:
        input.customer?.preferredPlatforms ?? ["instagram", "website", "youtube"],
    };

    return {
      profile,
      visual,
      brand: brandKnowledge,
      marketing,
      customer,
    };
  }
}
