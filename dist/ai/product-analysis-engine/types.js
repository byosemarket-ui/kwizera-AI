/**
 * KWIZERA AI STUDIO — Product Analysis Engine types (Step 5B)
 */
export var ProductAnalysisIndustry;
(function (ProductAnalysisIndustry) {
    ProductAnalysisIndustry["Technology"] = "technology";
    ProductAnalysisIndustry["Fashion"] = "fashion";
    ProductAnalysisIndustry["Beauty"] = "beauty";
    ProductAnalysisIndustry["Food"] = "food";
    ProductAnalysisIndustry["Hospitality"] = "hospitality";
    ProductAnalysisIndustry["Automotive"] = "automotive";
    ProductAnalysisIndustry["RealEstate"] = "real-estate";
    ProductAnalysisIndustry["Education"] = "education";
    ProductAnalysisIndustry["Health"] = "health";
    ProductAnalysisIndustry["HomeLiving"] = "home-living";
    ProductAnalysisIndustry["Creative"] = "creative";
    ProductAnalysisIndustry["General"] = "general";
})(ProductAnalysisIndustry || (ProductAnalysisIndustry = {}));
export var ProductAnalysisCategory;
(function (ProductAnalysisCategory) {
    ProductAnalysisCategory["Electronics"] = "electronics";
    ProductAnalysisCategory["Fashion"] = "fashion";
    ProductAnalysisCategory["Shoes"] = "shoes";
    ProductAnalysisCategory["Bags"] = "bags";
    ProductAnalysisCategory["Beauty"] = "beauty";
    ProductAnalysisCategory["Food"] = "food";
    ProductAnalysisCategory["Restaurant"] = "restaurant";
    ProductAnalysisCategory["Hotel"] = "hotel";
    ProductAnalysisCategory["Furniture"] = "furniture";
    ProductAnalysisCategory["HomeAppliances"] = "home-appliances";
    ProductAnalysisCategory["Vehicles"] = "vehicles";
    ProductAnalysisCategory["RealEstate"] = "real-estate";
    ProductAnalysisCategory["Education"] = "education";
    ProductAnalysisCategory["Health"] = "health";
    ProductAnalysisCategory["Software"] = "software";
    ProductAnalysisCategory["Services"] = "services";
})(ProductAnalysisCategory || (ProductAnalysisCategory = {}));
export var ProductBusinessType;
(function (ProductBusinessType) {
    ProductBusinessType["B2C"] = "b2c";
    ProductBusinessType["B2B"] = "b2b";
    ProductBusinessType["D2C"] = "d2c";
    ProductBusinessType["Marketplace"] = "marketplace";
    ProductBusinessType["Subscription"] = "subscription";
    ProductBusinessType["Enterprise"] = "enterprise";
})(ProductBusinessType || (ProductBusinessType = {}));
export var ProductAvailabilityStatus;
(function (ProductAvailabilityStatus) {
    ProductAvailabilityStatus["InStock"] = "in-stock";
    ProductAvailabilityStatus["PreOrder"] = "pre-order";
    ProductAvailabilityStatus["OutOfStock"] = "out-of-stock";
    ProductAvailabilityStatus["Discontinued"] = "discontinued";
    ProductAvailabilityStatus["ComingSoon"] = "coming-soon";
})(ProductAvailabilityStatus || (ProductAvailabilityStatus = {}));
export class ProductAnalysisEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "ProductAnalysisEngineError";
    }
}
//# sourceMappingURL=types.js.map