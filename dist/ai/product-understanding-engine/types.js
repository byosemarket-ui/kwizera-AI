/**
 * KWIZERA AI STUDIO — Product Understanding Engine types (Step 5C)
 */
export var ProductUnderstandingMarketingGoal;
(function (ProductUnderstandingMarketingGoal) {
    ProductUnderstandingMarketingGoal["Conversion"] = "conversion";
    ProductUnderstandingMarketingGoal["Awareness"] = "awareness";
    ProductUnderstandingMarketingGoal["Engagement"] = "engagement";
    ProductUnderstandingMarketingGoal["Retention"] = "retention";
    ProductUnderstandingMarketingGoal["Launch"] = "launch";
    ProductUnderstandingMarketingGoal["Education"] = "education";
})(ProductUnderstandingMarketingGoal || (ProductUnderstandingMarketingGoal = {}));
export class ProductUnderstandingEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "ProductUnderstandingEngineError";
    }
}
//# sourceMappingURL=types.js.map