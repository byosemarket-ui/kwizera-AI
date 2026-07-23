import { ProductAnalysisCategory, ProductAnalysisIndustry, ProductAvailabilityStatus, ProductBusinessType, } from "./types.js";
const CATEGORY_INDUSTRY = {
    [ProductAnalysisCategory.Electronics]: ProductAnalysisIndustry.Technology,
    [ProductAnalysisCategory.Software]: ProductAnalysisIndustry.Technology,
    [ProductAnalysisCategory.Fashion]: ProductAnalysisIndustry.Fashion,
    [ProductAnalysisCategory.Shoes]: ProductAnalysisIndustry.Fashion,
    [ProductAnalysisCategory.Bags]: ProductAnalysisIndustry.Fashion,
    [ProductAnalysisCategory.Beauty]: ProductAnalysisIndustry.Beauty,
    [ProductAnalysisCategory.Food]: ProductAnalysisIndustry.Food,
    [ProductAnalysisCategory.Restaurant]: ProductAnalysisIndustry.Food,
    [ProductAnalysisCategory.Hotel]: ProductAnalysisIndustry.Hospitality,
    [ProductAnalysisCategory.Furniture]: ProductAnalysisIndustry.HomeLiving,
    [ProductAnalysisCategory.HomeAppliances]: ProductAnalysisIndustry.HomeLiving,
    [ProductAnalysisCategory.Vehicles]: ProductAnalysisIndustry.Automotive,
    [ProductAnalysisCategory.RealEstate]: ProductAnalysisIndustry.RealEstate,
    [ProductAnalysisCategory.Education]: ProductAnalysisIndustry.Education,
    [ProductAnalysisCategory.Health]: ProductAnalysisIndustry.Health,
    [ProductAnalysisCategory.Services]: ProductAnalysisIndustry.General,
};
const CATEGORY_DEFAULTS = {
    [ProductAnalysisCategory.Electronics]: { subcategory: "smart-devices", materials: ["aluminum", "plastic"], packaging: "retail-box" },
    [ProductAnalysisCategory.Software]: { subcategory: "saas", materials: ["digital"], packaging: "digital-license" },
    [ProductAnalysisCategory.Fashion]: { subcategory: "apparel", materials: ["cotton", "polyester"], packaging: "branded-bag" },
    [ProductAnalysisCategory.Shoes]: { subcategory: "footwear", materials: ["leather", "rubber"], packaging: "shoe-box" },
    [ProductAnalysisCategory.Bags]: { subcategory: "handbags", materials: ["leather", "canvas"], packaging: "dust-bag" },
    [ProductAnalysisCategory.Beauty]: { subcategory: "skincare", materials: ["glass", "serum"], packaging: "premium-box" },
    [ProductAnalysisCategory.Food]: { subcategory: "packaged-food", materials: ["organic"], packaging: "sealed-pack" },
    [ProductAnalysisCategory.Restaurant]: { subcategory: "dining", materials: ["fresh-ingredients"], packaging: "dine-in" },
    [ProductAnalysisCategory.Hotel]: { subcategory: "accommodation", materials: ["premium-linens"], packaging: "experience" },
    [ProductAnalysisCategory.Furniture]: { subcategory: "living-room", materials: ["wood", "fabric"], packaging: "flat-pack" },
    [ProductAnalysisCategory.HomeAppliances]: { subcategory: "kitchen", materials: ["stainless-steel"], packaging: "retail-box" },
    [ProductAnalysisCategory.Vehicles]: { subcategory: "automotive", materials: ["steel", "aluminum"], packaging: "showroom" },
    [ProductAnalysisCategory.RealEstate]: { subcategory: "residential", materials: ["concrete", "glass"], packaging: "listing" },
    [ProductAnalysisCategory.Education]: { subcategory: "courses", materials: ["digital-content"], packaging: "digital-access" },
    [ProductAnalysisCategory.Health]: { subcategory: "wellness", materials: ["natural"], packaging: "pharma-box" },
    [ProductAnalysisCategory.Services]: { subcategory: "professional", materials: ["service"], packaging: "digital" },
};
export class ProductAnalysisAnalyzer {
    analyze(input) {
        const category = input.category ?? ProductAnalysisCategory.Electronics;
        const defaults = CATEGORY_DEFAULTS[category];
        const productName = input.productName ?? "Unnamed Product";
        const brand = input.brand ?? "Unknown Brand";
        const profile = {
            productName,
            category,
            subcategory: input.subcategory ?? defaults.subcategory,
            brand,
            model: input.model,
            sku: input.sku,
            description: input.description ?? `Professional ${productName} from ${brand}`,
            features: input.features ?? ["premium quality", "innovative design"],
            specifications: input.specifications ?? {},
            materials: input.materials ?? defaults.materials,
            dimensions: input.dimensions,
            weight: input.weight,
            colors: input.colors ?? ["standard"],
            sizes: input.sizes ?? ["standard"],
            packaging: input.packaging ?? defaults.packaging,
            countryOfOrigin: input.countryOfOrigin,
            supplier: input.supplier,
            price: input.price ?? 0,
            currency: input.currency ?? "USD",
            availability: input.availability ?? ProductAvailabilityStatus.InStock,
        };
        const visual = {
            productImages: input.visual?.productImages ?? [],
            productAngles: input.visual?.productAngles ?? ["front", "side", "detail"],
            productBackground: input.visual?.productBackground ?? "studio-white",
            productVisibility: input.visual?.productVisibility ?? 75,
            productPackaging: input.visual?.productPackaging ?? profile.packaging ?? defaults.packaging,
            productQuality: input.visual?.productQuality ?? 75,
            productLighting: input.visual?.productLighting ?? "soft-studio",
            productComposition: input.visual?.productComposition ?? "centered-product",
        };
        const classification = {
            industry: input.industry ?? CATEGORY_INDUSTRY[category],
            category,
            subcategory: profile.subcategory,
            useCase: input.useCase ?? this.inferUseCase(category, profile),
            targetCustomer: input.targetCustomer ?? this.inferTargetCustomer(category),
            businessType: input.businessType ?? ProductBusinessType.B2C,
        };
        const marketingPreparation = this.buildMarketingPreparation(profile, visual, category, input.targetCustomer);
        return { profile, visual, classification, marketingPreparation };
    }
    inferUseCase(category, profile) {
        if (category === ProductAnalysisCategory.Software || category === ProductAnalysisCategory.Electronics) {
            return "productivity-and-creation";
        }
        if (category === ProductAnalysisCategory.Beauty || category === ProductAnalysisCategory.Fashion) {
            return "personal-lifestyle";
        }
        if (category === ProductAnalysisCategory.Food || category === ProductAnalysisCategory.Restaurant) {
            return "consumption-experience";
        }
        return `${profile.subcategory}-use-case`;
    }
    inferTargetCustomer(category) {
        const map = {
            [ProductAnalysisCategory.Electronics]: "tech-savvy professionals",
            [ProductAnalysisCategory.Software]: "businesses and creators",
            [ProductAnalysisCategory.Fashion]: "style-conscious consumers 18-45",
            [ProductAnalysisCategory.Beauty]: "beauty enthusiasts 25-40",
            [ProductAnalysisCategory.Food]: "health-conscious consumers",
            [ProductAnalysisCategory.Health]: "wellness-focused adults",
            [ProductAnalysisCategory.Education]: "learners and professionals",
        };
        return map[category] ?? "general consumers";
    }
    buildMarketingPreparation(profile, visual, category, targetCustomerInput) {
        const gaps = [];
        const prepared = [];
        if (profile.description.length >= 20)
            prepared.push("description");
        else
            gaps.push("description");
        if (profile.features.length >= 2)
            prepared.push("features");
        else
            gaps.push("features");
        if (profile.price > 0)
            prepared.push("pricing");
        else
            gaps.push("pricing");
        if (visual.productVisibility >= 70)
            prepared.push("visual-visibility");
        else
            gaps.push("visual-visibility");
        const baseReady = prepared.length >= 3;
        const targetCustomer = targetCustomerInput ?? this.inferTargetCustomer(category);
        return {
            marketingStrategyReady: baseReady && Boolean(targetCustomer && profile.brand),
            creativeDirectionReady: baseReady && visual.productQuality >= 65,
            storyboardReady: baseReady && profile.features.length >= 2,
            scriptPlanningReady: baseReady && profile.description.length >= 30,
            visualPlanningReady: baseReady && visual.productVisibility >= 70,
            audioPlanningReady: baseReady,
            videoGenerationReady: baseReady && visual.productQuality >= 70 && visual.productVisibility >= 75,
            preparedFields: prepared,
            gaps,
        };
    }
}
//# sourceMappingURL=product-analysis-analyzer.js.map