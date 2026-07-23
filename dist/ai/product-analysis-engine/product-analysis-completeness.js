const REQUIRED_FIELDS = ["productName", "brand", "description", "subcategory"];
export class ProductAnalysisCompletenessDetector {
    detect(input, profile) {
        const missing = [];
        if (!profile.productName || profile.productName === "Unnamed Product")
            missing.push("productName");
        if (!profile.brand || profile.brand === "Unknown Brand")
            missing.push("brand");
        if (!profile.description || profile.description.length < 10)
            missing.push("description");
        if (!profile.subcategory)
            missing.push("subcategory");
        if (!profile.features?.length)
            missing.push("features");
        if (!profile.specifications || Object.keys(profile.specifications).length === 0)
            missing.push("specifications");
        if (!profile.materials?.length)
            missing.push("materials");
        if (!profile.colors?.length)
            missing.push("colors");
        if (!profile.sizes?.length)
            missing.push("sizes");
        if (!profile.price || profile.price <= 0)
            missing.push("price");
        if (!profile.currency)
            missing.push("currency");
        if (!profile.sku)
            missing.push("sku");
        if (!profile.model)
            missing.push("model");
        if (!profile.dimensions)
            missing.push("dimensions");
        if (!profile.weight)
            missing.push("weight");
        if (!profile.packaging)
            missing.push("packaging");
        if (!profile.countryOfOrigin)
            missing.push("countryOfOrigin");
        if (!profile.supplier)
            missing.push("supplier");
        if (!input.tags?.length)
            missing.push("tags");
        if (!input.keywords?.length)
            missing.push("keywords");
        return [...new Set(missing)];
    }
    isCriticallyIncomplete(missing) {
        return REQUIRED_FIELDS.some((f) => missing.includes(f));
    }
}
//# sourceMappingURL=product-analysis-completeness.js.map