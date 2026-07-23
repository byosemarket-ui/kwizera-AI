/**
 * KWIZERA AI STUDIO — Product Memory Engine types (Step 3I)
 */
export var ProductStatus;
(function (ProductStatus) {
    ProductStatus["Draft"] = "draft";
    ProductStatus["Active"] = "active";
    ProductStatus["Archived"] = "archived";
    ProductStatus["Discontinued"] = "discontinued";
})(ProductStatus || (ProductStatus = {}));
export class ProductMemoryEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "ProductMemoryEngineError";
    }
}
//# sourceMappingURL=types.js.map