export class ProductUnderstandingLinker {
    detectRelationships(record, allRecords, analysis, projects = [], knowledgeIds = []) {
        const similarProducts = [];
        const customerSegments = [...record.customer.customerSegments];
        const businessCategories = [record.identity.category, analysis.classification.industry];
        const creativeStyles = [];
        for (const other of allRecords) {
            if (other.productId === record.productId)
                continue;
            if (other.customer.targetIndustry === record.customer.targetIndustry) {
                similarProducts.push(other.productId);
            }
            else if (other.identity.category === record.identity.category) {
                similarProducts.push(other.productId);
            }
            for (const seg of other.customer.customerSegments) {
                if (!customerSegments.includes(seg))
                    customerSegments.push(seg);
            }
        }
        if (analysis.classification.industry === "fashion" || analysis.classification.industry === "beauty") {
            creativeStyles.push("lifestyle", "premium-visual");
        }
        else if (analysis.classification.industry === "technology") {
            creativeStyles.push("modern-minimal", "product-demo");
        }
        const marketingStrategies = [];
        if (record.marketingPreparation.marketingStrategyReady)
            marketingStrategies.push("conversion-focused");
        if (record.marketingPreparation.audienceIntelligenceReady)
            marketingStrategies.push("audience-targeted");
        return {
            similarProducts: [...new Set(similarProducts)].slice(0, 10),
            customerSegments: [...new Set(customerSegments)],
            businessCategories: [...new Set(businessCategories)],
            marketingStrategies,
            creativeStyles,
            projects: [...new Set([...projects, ...analysis.relationships.relatedProjects])],
            knowledgeRecords: [
                ...new Set([
                    ...knowledgeIds,
                    ...(analysis.knowledgeId ? [analysis.knowledgeId] : []),
                    ...analysis.relationships.relatedKnowledge,
                ]),
            ],
        };
    }
}
//# sourceMappingURL=product-understanding-linker.js.map