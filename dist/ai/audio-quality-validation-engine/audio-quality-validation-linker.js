export class AudioQualityValidationLinker {
    detectRelationships(record, input, productionPlan, renderPlan) {
        return {
            audioPlans: record.profile.audioPlanId ? [record.profile.audioPlanId] : [],
            productionPlans: input.productionId
                ? [input.productionId]
                : productionPlan
                    ? [productionPlan.audioProductionId]
                    : [],
            renderPlans: input.renderPlanId
                ? [input.renderPlanId]
                : renderPlan
                    ? [renderPlan.audioRenderPlanId]
                    : [],
            voicePlans: input.voicePlanIds ?? productionPlan?.relationships.voicePlans ?? renderPlan?.relationships.voicePlans ?? [],
            musicPlans: input.musicPlanIds ?? productionPlan?.relationships.musicPlans ?? renderPlan?.relationships.musicPlans ?? [],
            soundPlans: input.soundPlanIds ?? productionPlan?.relationships.soundPlans ?? [],
            ambientPlans: input.ambientPlanIds ?? productionPlan?.relationships.ambientPlans ?? [],
            products: record.profile.productId !== "unknown-product" ? [record.profile.productId] : [],
            brands: record.profile.brandId !== "unknown-brand" ? [record.profile.brandId] : [],
            campaigns: productionPlan?.profile.campaignId ? [productionPlan.profile.campaignId] : input.campaignId ? [input.campaignId] : [],
            knowledgeRecords: input.knowledgeRecordIds ?? productionPlan?.relationships.knowledgeRecords ?? [],
        };
    }
}
//# sourceMappingURL=audio-quality-validation-linker.js.map