export class VideoAnalysisLinker {
    detectRelationships(record, allRecords, knowledgeIds = [], memoryRefs = []) {
        const relatedVideos = [];
        const relatedBrands = [];
        const relatedProducts = [];
        const relatedCreativeStyles = [record.classification.creativeStyle];
        const product = record.relationships?.relatedProducts?.[0];
        const brand = record.relationships?.relatedBrands?.[0];
        for (const other of allRecords) {
            if (other.videoId === record.videoId)
                continue;
            if (brand && other.relationships.relatedBrands.includes(brand)) {
                relatedVideos.push(other.videoId);
                if (!relatedBrands.includes(brand))
                    relatedBrands.push(brand);
            }
            else if (product && other.relationships.relatedProducts.includes(product)) {
                relatedVideos.push(other.videoId);
                if (!relatedProducts.includes(product))
                    relatedProducts.push(product);
            }
            else if (other.classification.videoType === record.classification.videoType) {
                relatedVideos.push(other.videoId);
            }
            else if (other.classification.creativeStyle === record.classification.creativeStyle) {
                relatedVideos.push(other.videoId);
                if (!relatedCreativeStyles.includes(other.classification.creativeStyle)) {
                    relatedCreativeStyles.push(other.classification.creativeStyle);
                }
            }
        }
        return {
            relatedProducts: [...new Set([...(record.relationships?.relatedProducts ?? []), ...relatedProducts])],
            relatedBrands: [...new Set([...(record.relationships?.relatedBrands ?? []), ...relatedBrands])],
            relatedImages: record.relationships?.relatedImages ?? [],
            relatedAudio: record.relationships?.relatedAudio ?? [],
            relatedCampaigns: record.relationships?.relatedCampaigns ?? [],
            relatedStoryboards: record.relationships?.relatedStoryboards ?? [],
            relatedCreativeStyles: [...new Set(relatedCreativeStyles)],
            relatedKnowledge: [...new Set([...(record.relationships?.relatedKnowledge ?? []), ...knowledgeIds])],
            relatedVideos: [...new Set([...(record.relationships?.relatedVideos ?? []), ...relatedVideos])].slice(0, 10),
            relatedMemory: [...new Set([...(record.relationships?.relatedMemory ?? []), ...memoryRefs])],
            relatedProjects: record.relationships?.relatedProjects ?? [],
        };
    }
    classifySimilarity(a, b) {
        let score = 0;
        if (a.videoType === b.videoType)
            score += 35;
        if (a.category === b.category)
            score += 25;
        if (a.subcategory === b.subcategory)
            score += 20;
        if (a.creativeStyle === b.creativeStyle)
            score += 10;
        if (a.useCase === b.useCase)
            score += 10;
        return score;
    }
}
//# sourceMappingURL=video-analysis-linker.js.map