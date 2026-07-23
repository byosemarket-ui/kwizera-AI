import type { AudienceIntelligenceRecord } from "../audience-intelligence-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import { BrandDirection, CreativeDirectionProfile, CreativeScores, MarketingDirection, PlatformCreativeDirection, VisualDirection } from "./types.js";
export declare class CreativeDirectionScorer {
    computeScores(profile: CreativeDirectionProfile, visual: VisualDirection, brand: BrandDirection, marketing: MarketingDirection, platformDirections: PlatformCreativeDirection[], strategy: MarketingStrategyRecord, audience: AudienceIntelligenceRecord): CreativeScores;
    isCreativeDirectionValid(scores: CreativeScores, profile: CreativeDirectionProfile, brand: BrandDirection, marketing: MarketingDirection, platformDirections: PlatformCreativeDirection[]): {
        valid: boolean;
        diagnostics: string[];
    };
    private computeCreativeQuality;
    private computeBrandConsistency;
    private computeVisualDirectionScore;
}
//# sourceMappingURL=creative-direction-scorer.d.ts.map