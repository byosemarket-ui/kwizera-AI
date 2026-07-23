import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import { ContinuityCheck, PlatformStoryboardRules, ScenePlan, StoryboardIntelligenceInput, StoryboardProfile, StoryFlow, TimingIntelligence } from "./types.js";
export declare class StoryboardAnalyzer {
    buildProfile(input: StoryboardIntelligenceInput, creative: CreativeDirectionRecord, version: number): StoryboardProfile;
    buildStoryFlow(creative: CreativeDirectionRecord, understanding: ProductUnderstandingRecord, strategy: MarketingStrategyRecord, includeSocialProof: boolean): StoryFlow;
    buildScenes(profile: StoryboardProfile, storyFlow: StoryFlow, creative: CreativeDirectionRecord, understanding: ProductUnderstandingRecord, includeSocialProof: boolean): ScenePlan[];
    buildPlatformRules(creative: CreativeDirectionRecord): PlatformStoryboardRules;
    buildTiming(scenes: ScenePlan[], profile: StoryboardProfile): TimingIntelligence;
    checkContinuity(scenes: ScenePlan[], creative: CreativeDirectionRecord, understanding: ProductUnderstandingRecord): ContinuityCheck;
    private selectScenesForPlatform;
    private productFocusText;
    private cameraForBeat;
}
//# sourceMappingURL=storyboard-analyzer.d.ts.map