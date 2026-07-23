import { ProductPattern } from "./types.js";
export declare class ProductPatternStore {
    private patternsPath;
    private readonly patterns;
    initialize(productDir: string): void;
    store(pattern: ProductPattern): void;
    getAll(): ReadonlyArray<ProductPattern>;
    getReusable(): ProductPattern[];
    getCount(): number;
}
//# sourceMappingURL=product-pattern-store.d.ts.map