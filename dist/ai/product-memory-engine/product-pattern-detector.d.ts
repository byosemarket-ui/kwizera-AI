import { ProductPatternStore } from "./product-pattern-store.js";
import { ProductPattern, ProductRecord } from "./types.js";
export declare class ProductPatternDetector {
    private readonly patternStore;
    constructor(patternStore: ProductPatternStore);
    detect(product: ProductRecord): ProductPattern[];
    private create;
}
//# sourceMappingURL=product-pattern-detector.d.ts.map