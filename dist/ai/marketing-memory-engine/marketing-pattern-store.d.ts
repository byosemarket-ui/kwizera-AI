import { MarketingPattern } from "./types.js";
export declare class MarketingPatternStore {
    private patternsPath;
    private readonly patterns;
    initialize(marketingDir: string): void;
    store(pattern: MarketingPattern): void;
    getAll(): ReadonlyArray<MarketingPattern>;
    getByType(type: MarketingPattern["patternType"]): MarketingPattern[];
    getReusable(): MarketingPattern[];
    getCount(): number;
}
//# sourceMappingURL=marketing-pattern-store.d.ts.map