import type { ProductAnalysisIntelligenceRecord } from "../product-analysis-engine/types.js";
import type { AudienceIntelligenceRecord } from "../audience-intelligence-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import { BrandDirection, CinematicDirection, CreativeDirectionInput, CreativeDirectionProfile, MarketingDirection, PlatformCreativeDirection, VisualDirection } from "./types.js";
export declare class CreativeDirectionAnalyzer {
    buildProfile(input: CreativeDirectionInput, strategy: MarketingStrategyRecord, audience: AudienceIntelligenceRecord, understanding: ProductUnderstandingRecord, analysis: ProductAnalysisIntelligenceRecord): CreativeDirectionProfile;
    buildVisualDirection(profile: CreativeDirectionProfile, understanding: ProductUnderstandingRecord, analysis: ProductAnalysisIntelligenceRecord, strategy: MarketingStrategyRecord): VisualDirection;
    buildCinematicDirection(profile: CreativeDirectionProfile, strategy: MarketingStrategyRecord, understanding: ProductUnderstandingRecord): CinematicDirection;
    buildBrandDirection(profile: CreativeDirectionProfile, understanding: ProductUnderstandingRecord, analysis: ProductAnalysisIntelligenceRecord): BrandDirection;
    buildMarketingDirection(profile: CreativeDirectionProfile, strategy: MarketingStrategyRecord, understanding: ProductUnderstandingRecord, audience: AudienceIntelligenceRecord): MarketingDirection;
    buildPlatformDirections(profile: CreativeDirectionProfile, strategy: MarketingStrategyRecord, understanding: ProductUnderstandingRecord): PlatformCreativeDirection[];
    private inferPrimaryPlatform;
    private platformsFromStrategy;
    private buildEmotionalDirection;
}
//# sourceMappingURL=creative-direction-analyzer.d.ts.map