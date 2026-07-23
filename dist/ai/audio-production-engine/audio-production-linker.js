export class AudioProductionLinker {
    detectRelationships(record, input, creative, strategy, understanding) {
        const relationships = {
            audioPlans: [record.profile.audioPlanId],
            productionPlans: [record.audioProductionId],
            voicePlans: input.voicePlanIds ?? [],
            musicPlans: input.musicPlanIds ?? [],
            ambientPlans: input.ambientPlanIds ?? [],
            soundPlans: input.soundPlanIds ?? [],
            enhancementPlans: input.enhancementPlanIds ?? [],
            mixingPlans: input.mixingPlanId ? [input.mixingPlanId] : [],
            masteringPlans: input.masteringPlanId ? [input.masteringPlanId] : [],
            products: input.productId ? [input.productId] : [],
            brands: record.profile.brandId !== "unknown-brand" ? [record.profile.brandId] : [],
            campaigns: input.campaignId ? [input.campaignId] : [record.profile.campaignId],
            videos: input.videoId ? [input.videoId] : [],
            knowledgeRecords: input.knowledgeRecordIds ?? [],
        };
        if (understanding?.productId && !relationships.products.includes(understanding.productId)) {
            relationships.products.push(understanding.productId);
        }
        if (creative?.profile.brand && !relationships.brands.includes(creative.profile.brand)) {
            relationships.brands.push(creative.profile.brand);
        }
        return relationships;
    }
}
//# sourceMappingURL=audio-production-linker.js.map