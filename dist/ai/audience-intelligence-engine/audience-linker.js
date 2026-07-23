const INDUSTRY_CREATIVE_STYLES = {
    fashion: ["lifestyle", "aspirational-visual"],
    beauty: ["beauty-tutorial", "self-care"],
    technology: ["product-demo", "modern-minimal"],
    food: ["sensory", "lifestyle"],
    education: ["informative", "tutorial"],
};
export class AudienceLinker {
    detectRelationships(record, allRecords, understanding, analysis, campaignId) {
        const products = [record.productId];
        const brands = [understanding.identity.brand];
        const campaigns = [];
        if (campaignId)
            campaigns.push(campaignId);
        const creativeStyles = [
            ...(INDUSTRY_CREATIVE_STYLES[analysis.classification.industry] ?? ["general-marketing"]),
            ...understanding.relationships.creativeStyles,
        ];
        const languages = [];
        if (record.profile.preferredLanguage) {
            languages.push(record.profile.preferredLanguage);
        }
        if (record.demographics.language) {
            languages.push(record.demographics.language);
        }
        const industries = [record.profile.industry, understanding.customer.targetIndustry];
        const customerSegments = [
            ...understanding.customer.customerSegments,
            record.profile.audienceName,
            record.demographics.customerType,
        ];
        const knowledgeRecords = [
            ...new Set([
                ...understanding.relationships.knowledgeRecords,
                ...(analysis.knowledgeId ? [analysis.knowledgeId] : []),
                ...analysis.relationships.relatedKnowledge,
            ]),
        ];
        for (const other of allRecords) {
            if (other.audienceId === record.audienceId)
                continue;
            if (other.profile.industry === record.profile.industry) {
                industries.push(other.profile.industry);
            }
            if (other.profile.audienceCategory === record.profile.audienceCategory) {
                customerSegments.push(other.profile.audienceName);
            }
        }
        return {
            products: [...new Set(products)],
            brands: [...new Set(brands)],
            campaigns: [...new Set(campaigns)],
            creativeStyles: [...new Set(creativeStyles)].slice(0, 12),
            languages: [...new Set(languages)],
            industries: [...new Set(industries)],
            customerSegments: [...new Set(customerSegments)].slice(0, 15),
            knowledgeRecords,
        };
    }
}
//# sourceMappingURL=audience-linker.js.map