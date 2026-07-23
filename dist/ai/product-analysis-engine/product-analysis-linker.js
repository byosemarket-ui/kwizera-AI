export class ProductAnalysisLinker {
    detectRelationships(record, allRecords, knowledgeIds = [], memoryRefs = []) {
        const relatedProducts = [];
        const relatedBrands = [];
        const relatedCategories = [record.classification.category, record.classification.subcategory];
        for (const other of allRecords) {
            if (other.productId === record.productId)
                continue;
            if (other.profile.brand.toLowerCase() === record.profile.brand.toLowerCase()) {
                if (!relatedBrands.includes(other.profile.brand))
                    relatedBrands.push(other.profile.brand);
                relatedProducts.push(other.productId);
            }
            else if (other.classification.category === record.classification.category) {
                relatedProducts.push(other.productId);
            }
            else if (other.classification.industry === record.classification.industry &&
                other.profile.subcategory === record.profile.subcategory) {
                relatedProducts.push(other.productId);
            }
        }
        return {
            relatedProducts: [...new Set(relatedProducts)].slice(0, 10),
            relatedBrands: [...new Set(relatedBrands)],
            relatedCategories: [...new Set(relatedCategories)],
            relatedProjects: record.relationships?.relatedProjects ?? [],
            relatedMarketingCampaigns: [],
            relatedKnowledge: [...new Set([...(record.relationships?.relatedKnowledge ?? []), ...knowledgeIds])],
            relatedMemory: [...new Set([...(record.relationships?.relatedMemory ?? []), ...memoryRefs])],
        };
    }
    classifySimilarity(a, b) {
        let score = 0;
        if (a.industry === b.industry)
            score += 30;
        if (a.category === b.category)
            score += 30;
        if (a.subcategory === b.subcategory)
            score += 20;
        if (a.businessType === b.businessType)
            score += 10;
        if (a.useCase === b.useCase)
            score += 10;
        return score;
    }
}
//# sourceMappingURL=product-analysis-linker.js.map