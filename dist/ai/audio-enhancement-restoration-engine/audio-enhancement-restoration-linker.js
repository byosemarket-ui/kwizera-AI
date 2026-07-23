export class AudioEnhancementRestorationLinker {
    detectRelationships(record, input, creative, strategy, understanding) {
        const relationships = {
            enhancementPlans: [record.enhancementPlanId],
            voicePlans: input.voicePlanIds ?? [],
            musicPlans: input.musicPlanIds ?? [],
            ambientPlans: input.ambientPlanIds ?? [],
            soundPlans: input.soundPlanIds ?? [],
            products: input.productId ? [input.productId] : [],
            brands: record.profile.brandId !== "unknown-brand" ? [record.profile.brandId] : [],
            campaigns: input.campaignId ? [input.campaignId] : record.profile.campaignId ? [record.profile.campaignId] : [],
            videos: input.videoId ? [input.videoId] : [],
            knowledgeRecords: input.knowledgeRecordIds ?? [],
        };
        if (understanding?.productId && !relationships.products.includes(understanding.productId)) {
            relationships.products.push(understanding.productId);
        }
        if (creative?.profile.brand && !relationships.brands.includes(creative.profile.brand)) {
            relationships.brands.push(creative.profile.brand);
        }
        if (strategy?.strategyId && !relationships.campaigns.includes(strategy.strategyId)) {
            relationships.campaigns.push(strategy.strategyId);
        }
        return relationships;
    }
}
//# sourceMappingURL=audio-enhancement-restoration-linker.js.map