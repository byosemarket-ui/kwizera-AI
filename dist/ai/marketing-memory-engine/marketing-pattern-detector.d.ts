import { MarketingPatternStore } from "./marketing-pattern-store.js";
import { MarketingPattern, MarketingRecord } from "./types.js";
export declare class MarketingPatternDetector {
    private readonly patternStore;
    constructor(patternStore: MarketingPatternStore);
    detect(campaign: MarketingRecord): MarketingPattern[];
    private create;
}
//# sourceMappingURL=marketing-pattern-detector.d.ts.map