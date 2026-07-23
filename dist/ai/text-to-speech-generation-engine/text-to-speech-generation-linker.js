export class TextToSpeechGenerationLinker {
    detectRelationships(record, input, creative, strategy, understanding) {
        const relationships = {
            scripts: [record.profile.scriptId],
            voices: [record.profile.voiceProfileId],
            products: input.productId ? [input.productId] : [],
            brands: record.profile.brandId !== "unknown-brand" ? [record.profile.brandId] : [],
            campaigns: input.campaignId ? [input.campaignId] : record.profile.campaignId ? [record.profile.campaignId] : [],
            videos: [],
            images: [],
            knowledgeRecords: input.knowledgeRecordIds ?? [],
            productionPlans: [],
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
//# sourceMappingURL=text-to-speech-generation-linker.js.map