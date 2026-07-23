/**
 * KWIZERA AI STUDIO — Product Knowledge Engine types (Step 4H)
 */
export var KnowledgeProductCategory;
(function (KnowledgeProductCategory) {
    KnowledgeProductCategory["Electronics"] = "electronics";
    KnowledgeProductCategory["Fashion"] = "fashion";
    KnowledgeProductCategory["Shoes"] = "shoes";
    KnowledgeProductCategory["Bags"] = "bags";
    KnowledgeProductCategory["Beauty"] = "beauty";
    KnowledgeProductCategory["Food"] = "food";
    KnowledgeProductCategory["Restaurant"] = "restaurant";
    KnowledgeProductCategory["Hotel"] = "hotel";
    KnowledgeProductCategory["Furniture"] = "furniture";
    KnowledgeProductCategory["HomeAppliances"] = "home-appliances";
    KnowledgeProductCategory["Vehicles"] = "vehicles";
    KnowledgeProductCategory["RealEstate"] = "real-estate";
    KnowledgeProductCategory["Education"] = "education";
    KnowledgeProductCategory["Health"] = "health";
    KnowledgeProductCategory["Future"] = "future";
})(KnowledgeProductCategory || (KnowledgeProductCategory = {}));
export var KnowledgeProductMarketingGoal;
(function (KnowledgeProductMarketingGoal) {
    KnowledgeProductMarketingGoal["Conversion"] = "conversion";
    KnowledgeProductMarketingGoal["Awareness"] = "awareness";
    KnowledgeProductMarketingGoal["Engagement"] = "engagement";
    KnowledgeProductMarketingGoal["Retention"] = "retention";
    KnowledgeProductMarketingGoal["Launch"] = "launch";
})(KnowledgeProductMarketingGoal || (KnowledgeProductMarketingGoal = {}));
export class ProductKnowledgeEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "ProductKnowledgeEngineError";
    }
}
//# sourceMappingURL=types.js.map