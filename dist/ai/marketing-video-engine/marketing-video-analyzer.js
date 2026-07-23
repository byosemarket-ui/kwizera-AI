import { MarketingVideoPlanType, MARKETING_VIDEO_PLATFORM_TARGETS, PLATFORM_MARKETING_CONFIG, } from "./types.js";
export class MarketingVideoAnalyzer {
    buildMarketingVideoPlan(storyboard, scenes, audioPlans, version) {
        const profile = this.buildProfile(storyboard, version);
        const hookScene = scenes.find((s) => s.structure.scenePurpose === "opening-hook") ?? scenes[0];
        const ctaScene = scenes.find((s) => s.structure.scenePurpose === "call-to-action") ?? scenes[scenes.length - 1];
        const productScene = scenes.find((s) => s.structure.scenePurpose === "product-showcase") ?? scenes[0];
        const hookAudio = audioPlans.find((a) => a.profile.sceneId === hookScene?.sceneId) ?? audioPlans[0];
        return {
            marketingVideoId: profile.marketingVideoId,
            profile,
            planType: MarketingVideoPlanType.Combined,
            marketingStrategy: this.buildMarketingStrategy(storyboard),
            hookOptimization: this.buildHookOptimization(storyboard, hookScene, hookAudio),
            productPresentation: this.buildProductPresentation(storyboard, productScene),
            callToAction: this.buildCallToAction(storyboard, ctaScene),
            engagementOptimization: this.buildEngagementOptimization(storyboard),
            conversionOptimization: this.buildConversionOptimization(storyboard),
            abTestPreparation: this.buildAbTestPreparation(storyboard, hookScene),
            platformOptimizations: this.buildPlatformOptimizations(storyboard.profile.platform),
        };
    }
    buildProfile(storyboard, version) {
        return {
            marketingVideoId: `marketing-video-${storyboard.storyboardId}-v${version}`,
            projectId: storyboard.profile.projectId,
            campaignId: storyboard.profile.campaignId,
            productId: storyboard.profile.productId,
            brandId: storyboard.profile.brandId,
            platform: storyboard.profile.platform,
            targetAudience: storyboard.profile.targetAudience,
            marketingVersion: version,
            storyboardId: storyboard.storyboardId,
        };
    }
    buildMarketingStrategy(storyboard) {
        const mp = storyboard.marketingPlanning;
        const ss = storyboard.storyStructure;
        return {
            campaignObjective: storyboard.profile.storyType,
            marketingGoal: storyboard.productionStructure.marketingFlow.join(" → ") || "drive conversion",
            targetAudience: storyboard.profile.targetAudience,
            customerPersona: `Primary persona — ${storyboard.profile.targetAudience}`,
            valueProposition: ss.solution,
            productBenefits: [ss.benefits, ss.productShowcase].filter(Boolean),
            brandPositioning: mp.brandPlacement,
        };
    }
    buildHookOptimization(storyboard, hookScene, hookAudio) {
        const vj = storyboard.viewerJourney;
        return {
            first3SecondsStrategy: `Pattern interrupt — ${vj.attentionPhase} within 3 seconds`,
            attentionHook: hookScene?.structure.sceneObjectives[0] ?? vj.attentionPhase,
            visualHook: hookScene?.visualPlan.composition ?? storyboard.visualPlanning.graphics,
            audioHook: hookAudio?.musicSynchronization.musicFadeIn ?? storyboard.audioPlanning.musicPlacement,
            emotionalHook: hookScene?.structure.sceneMood ?? storyboard.cinematicPlanning.emotionalArc,
        };
    }
    buildProductPresentation(storyboard, productScene) {
        const mp = storyboard.marketingPlanning;
        return {
            productRevealTiming: mp.productReveal,
            productHighlight: productScene?.objectPlanning.productPosition ?? "Hero product center-frame",
            productDemonstration: productScene?.structure.sceneObjectives.join("; ") || "Feature demonstration sequence",
            featurePresentation: productScene?.structure.sceneObjectives[0] ?? "Primary feature showcase",
            benefitPresentation: storyboard.storyStructure.benefits,
            productComparison: "Differentiation vs. alternatives — value-led comparison",
        };
    }
    buildCallToAction(storyboard, ctaScene) {
        const mp = storyboard.marketingPlanning;
        const platformVariation = storyboard.platformVariations.find((p) => p.platform === storyboard.profile.platform);
        return {
            ctaTiming: mp.ctaPlacement,
            ctaPosition: ctaScene?.visualPlan.typographyPlacement ?? "Lower-third + end card",
            ctaStyle: platformVariation?.ctaAdaptation ?? "Bold brand-color CTA button",
            ctaAnimation: ctaScene?.transitionPlanning.motionTransition ?? "Pop + glow on appearance",
            ctaVisibility: "High contrast — always visible in safe zone",
            ctaPriority: "Primary conversion action — highest visual hierarchy",
        };
    }
    buildEngagementOptimization(storyboard) {
        const vj = storyboard.viewerJourney;
        return {
            viewerRetentionStrategy: `${vj.retentionPhase} — pacing aligned to ${storyboard.cinematicPlanning.pacing}`,
            emotionalJourney: `${vj.attentionPhase} → ${vj.interestPhase} → ${vj.desirePhase} → ${vj.actionPhase}`,
            curiosityTriggers: [
                "Open-loop question in hook",
                "Benefit reveal at midpoint",
                "Social proof before CTA",
            ],
            socialEngagement: "Shareable moment — product reveal + emotional peak",
            shareability: "Clip-friendly segments at hook and product showcase",
            watchTimeOptimization: storyboard.cinematicPlanning.pacing,
        };
    }
    buildConversionOptimization(storyboard) {
        const mp = storyboard.marketingPlanning;
        return {
            purchaseMotivation: storyboard.storyStructure.solution,
            trustBuilding: "Brand credentials + product proof points",
            socialProofPlacement: mp.offerPlacement,
            offerTiming: mp.offerPlacement,
            urgencyStrategy: "Limited-time offer cue before final CTA",
            conversionPath: mp.conversionStrategy,
        };
    }
    buildAbTestPreparation(storyboard, hookScene) {
        return {
            hookVariants: [
                `Variant A: ${hookScene?.structure.sceneMood ?? "direct"} hook`,
                "Variant B: Question-led curiosity hook",
                "Variant C: Problem-agitation hook",
            ],
            ctaVariants: [
                "Variant A: Shop Now",
                "Variant B: Learn More",
                "Variant C: Get Started Free",
            ],
            endingVariants: [
                "Variant A: Brand lockup + URL",
                "Variant B: Offer recap + CTA",
                "Variant C: Testimonial + CTA",
            ],
            productPresentationVariants: [
                "Variant A: Hero product rotation",
                "Variant B: Feature breakdown sequence",
                "Variant C: Before/after demonstration",
            ],
        };
    }
    buildPlatformOptimizations(platform) {
        return MARKETING_VIDEO_PLATFORM_TARGETS.map((p) => {
            const config = PLATFORM_MARKETING_CONFIG[p];
            return {
                platform: p,
                hookStyle: config.hookStyle,
                ctaAdaptation: config.ctaAdaptation,
                pacingNotes: p === platform ? ["Primary platform marketing profile"] : [`Adapt ${config.hookStyle} for ${p}`],
            };
        });
    }
    buildRecommendations(draft) {
        const recs = [];
        recs.push("A/B test hook variants before full production render");
        recs.push("Validate CTA visibility against platform safe zones");
        if (draft.conversionOptimization.urgencyStrategy.includes("Limited")) {
            recs.push("Confirm offer urgency aligns with campaign compliance guidelines");
        }
        return recs;
    }
}
//# sourceMappingURL=marketing-video-analyzer.js.map