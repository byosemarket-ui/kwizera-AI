export class MusicGenerationLinker {
    detectRelationships(record, input, creative, strategy, understanding) {
        const relationships = {
            musicPlans: [record.musicPlanId],
            products: input.productId ? [input.productId] : [],
            brands: record.profile.brandId !== "unknown-brand" ? [record.profile.brandId] : [],
            campaigns: input.campaignId ? [input.campaignId] : record.profile.campaignId ? [record.profile.campaignId] : [],
            videos: input.videoId ? [input.videoId] : input.videoRef ? [input.videoRef] : [],
            images: input.imageId ? [input.imageId] : input.imageRef ? [input.imageRef] : [],
            voicePlans: input.voicePlanIds ?? [],
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
//# sourceMappingURL=music-generation-linker.js.map