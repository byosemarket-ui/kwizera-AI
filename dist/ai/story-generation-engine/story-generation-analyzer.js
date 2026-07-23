import { ALL_STORYBOARD_PLATFORMS, CameraAngle, CameraMovement, PLATFORM_CONFIG, ShotType, StoryboardGenerationPlatform, StoryboardStoryType, mapCreativePlatform, } from "./types.js";
import { CreativeDirectionStyle } from "../creative-direction-engine/types.js";
const SCENE_BLUEPRINTS = [
    { purpose: "opening-hook", structureKey: "openingHook", mood: "attention-grabbing", shotsPerScene: 2 },
    { purpose: "introduction", structureKey: "introduction", mood: "welcoming", shotsPerScene: 2 },
    { purpose: "problem", structureKey: "problem", mood: "empathetic", shotsPerScene: 2 },
    { purpose: "solution", structureKey: "solution", mood: "hopeful", shotsPerScene: 2 },
    { purpose: "product-showcase", structureKey: "productShowcase", mood: "showcase", shotsPerScene: 3 },
    { purpose: "benefits", structureKey: "benefits", mood: "confident", shotsPerScene: 2 },
    { purpose: "social-proof", structureKey: "socialProof", mood: "trustworthy", shotsPerScene: 2 },
    { purpose: "call-to-action", structureKey: "callToAction", mood: "urgent", shotsPerScene: 2 },
    { purpose: "ending", structureKey: "ending", mood: "resolution", shotsPerScene: 1 },
];
const SHOT_TYPE_SEQUENCE = [
    ShotType.Wide,
    ShotType.Medium,
    ShotType.CloseUp,
    ShotType.Medium,
    ShotType.OverTheShoulder,
];
export class StoryGenerationAnalyzer {
    buildProfile(input, platform, version, context) {
        const config = PLATFORM_CONFIG[platform];
        const storyboardId = input.storyboardIntelligenceId ??
            `gen-storyboard-${context.productId || "prompt"}-${platform}-v${version}`;
        return {
            storyboardId,
            projectId: input.projectId ?? context.projectId ?? `project-${context.productId || "default"}`,
            campaignId: input.campaignId ?? context.campaignId ?? `campaign-${context.productId || "default"}`,
            productId: context.productId ?? input.productId ?? "unknown-product",
            brandId: input.brandId ?? context.brandId ?? context.brandName ?? "unknown-brand",
            platform,
            language: input.language ?? "en",
            version,
            storyType: input.storyType ?? StoryboardStoryType.Conversion,
            creativeStyle: context.creativeStyle ?? CreativeDirectionStyle.Storytelling,
            targetAudience: context.targetAudience ?? "general audience",
            estimatedDuration: `${config.totalSeconds} seconds`,
            totalScenes: config.sceneCount,
            totalShots: 0,
        };
    }
    buildStoryStructure(context, input) {
        const product = context.productName ?? "the product";
        const brand = context.brandName ?? "the brand";
        const benefit = context.keyBenefit ?? "transformative value";
        const pain = context.customerPain ?? "common challenges";
        const feature = context.keyFeature ?? "innovative capability";
        const prompt = input.textPrompt ?? input.creativeBrief ?? "";
        return {
            openingHook: context.intelligence?.storyFlow.hook ??
                (prompt.slice(0, 120) || `Capture attention with a bold visual hook for ${brand}`),
            introduction: context.intelligence?.storyFlow.opening ??
                `Introduce ${brand} and establish context for ${context.targetAudience ?? "viewers"}`,
            problem: `Address ${pain} that ${context.targetAudience ?? "customers"} face daily`,
            solution: `Present ${product} as the definitive solution to ${pain}`,
            productShowcase: context.intelligence?.storyFlow.featurePresentation ??
                `Showcase ${feature} with cinematic product hero shots`,
            benefits: context.intelligence?.storyFlow.benefitDemonstration ??
                `Demonstrate ${benefit} through real-world application`,
            socialProof: input.includeSocialProof !== false
                ? context.intelligence?.storyFlow.socialProof ??
                    `Feature customer testimonials and trust signals for ${brand}`
                : "N/A — social proof optional for this campaign",
            callToAction: context.intelligence?.storyFlow.callToAction ??
                context.ctaText ??
                `Take action now — discover ${product}`,
            ending: context.intelligence?.storyFlow.ending ??
                `Close with ${brand} brand lockup and memorable final frame`,
        };
    }
    buildScenes(profile, storyStructure, context, includeSocialProof) {
        const config = PLATFORM_CONFIG[profile.platform];
        let blueprints = [...SCENE_BLUEPRINTS];
        if (!includeSocialProof || storyStructure.socialProof.startsWith("N/A")) {
            blueprints = blueprints.filter((b) => b.purpose !== "social-proof");
        }
        const selected = this.selectScenesForPlatform(blueprints, config.sceneCount);
        const secondsPerScene = Math.round(config.totalSeconds / selected.length);
        return selected.map((bp, index) => {
            const sceneNum = index + 1;
            const structureText = storyStructure[bp.structureKey];
            const shots = this.buildShots(`${profile.storyboardId}-scene-${sceneNum}`, bp.shotsPerScene, bp.purpose, bp.mood, secondsPerScene);
            return {
                sceneId: `${profile.storyboardId}-scene-${sceneNum}`,
                sceneOrder: sceneNum,
                scenePurpose: bp.purpose,
                sceneDuration: `${secondsPerScene}s`,
                sceneObjective: structureText,
                sceneMood: bp.mood,
                sceneEnvironment: context.environmentStyle ?? "studio with brand-aligned backdrop",
                sceneAssets: this.buildSceneAssets(bp.purpose, context),
                shots,
            };
        });
    }
    buildShots(sceneId, shotCount, purpose, mood, sceneSeconds) {
        const shots = [];
        const shotDuration = Math.max(2, Math.round(sceneSeconds / shotCount));
        for (let i = 0; i < shotCount; i++) {
            const shotType = SHOT_TYPE_SEQUENCE[i % SHOT_TYPE_SEQUENCE.length];
            shots.push({
                shotId: `${sceneId}-shot-${i + 1}`,
                shotOrder: i + 1,
                shotType,
                cameraAngle: this.angleForPurpose(purpose, i),
                cameraMovement: this.movementForPurpose(purpose, i),
                framing: this.framingForShotType(shotType),
                motionInstructions: `${mood} motion — ${this.movementForPurpose(purpose, i)} for ${purpose}`,
                duration: `${shotDuration}s`,
                description: `Shot ${i + 1}: ${shotType} ${purpose} sequence`,
            });
        }
        return shots;
    }
    buildVisualPlanning(context) {
        const creative = context.creative;
        const palette = creative?.visualDirection.colorPalette;
        return {
            composition: creative?.visualDirection.compositionStyle ?? "rule-of-thirds with product hero placement",
            lighting: creative?.visualDirection.lightingStyle ?? "soft key light with brand accent rim",
            colorStyle: palette?.length ? palette.join(", ") : "brand-primary with neutral accents",
            background: creative?.visualDirection.backgroundStyle ?? "clean gradient with subtle texture",
            typography: creative?.brandDirection.brandTypography ?? "brand sans-serif, bold headlines",
            graphics: creative?.visualDirection.graphicStyle ?? creative?.visualDirection.iconStyle ?? "minimal iconography and lower-thirds",
            branding: creative?.brandDirection.brandConsistency ?? "consistent logo placement and brand colors",
        };
    }
    buildAudioPlanning(context, profile) {
        const config = PLATFORM_CONFIG[profile.platform];
        return {
            voiceTiming: `Voice-over synchronized across ${profile.totalScenes} scenes, hook within first 3s`,
            musicPlacement: context.creative?.cinematicDirection.editingStyle ??
                "Upbeat brand track — intro swell, sustained mid, crescendo at CTA",
            soundEffects: "Subtle transition whooshes, product interaction SFX at showcase",
            silencePlanning: "0.5s pause before CTA for emphasis",
            audioSynchronization: `Beat-aligned cuts every ${Math.round(config.totalSeconds / profile.totalScenes)}s`,
        };
    }
    buildMarketingPlanning(context, storyStructure) {
        return {
            productReveal: storyStructure.productShowcase,
            offerPlacement: context.intelligence?.storyFlow.offerPresentation ??
                context.strategy?.campaignDirection.messagingTheme ??
                "Offer presented at peak emotional moment before CTA",
            brandPlacement: `Brand visible in opening, showcase, and ending — ${context.brandName ?? "brand"}`,
            ctaPlacement: storyStructure.callToAction,
            conversionStrategy: context.strategy?.campaignDirection.campaignFocus ??
                context.strategy?.campaignDirection.channelStrategy ??
                "Hook-problem-solution-benefit-CTA conversion funnel",
        };
    }
    buildViewerJourney(storyStructure) {
        return {
            attentionPhase: storyStructure.openingHook,
            interestPhase: storyStructure.introduction,
            desirePhase: `${storyStructure.benefits} — ${storyStructure.productShowcase}`,
            actionPhase: storyStructure.callToAction,
            retentionPhase: storyStructure.ending,
        };
    }
    buildCinematicPlanning(context, profile) {
        return {
            pacing: context.creative?.cinematicDirection.sceneRhythm ?? "platform-native dynamic pacing",
            rhythm: `Scene rhythm: ${profile.totalScenes} beats over ${profile.estimatedDuration}`,
            visualArc: "Wide establishing → intimate close-ups → hero product → brand resolution",
            emotionalArc: context.creative?.profile.emotionalDirection ?? "curiosity → empathy → desire → action",
            transitionStrategy: context.creative?.cinematicDirection.transitionStyle ?? "smooth cross-dissolve with motion continuity",
        };
    }
    buildProductionStructure(storyStructure) {
        return {
            acts: ["Act I: Hook & Problem", "Act II: Solution & Showcase", "Act III: Proof & CTA"],
            narrativeFlow: [
                storyStructure.openingHook,
                storyStructure.problem,
                storyStructure.solution,
                storyStructure.ending,
            ],
            marketingFlow: [
                storyStructure.introduction,
                storyStructure.productShowcase,
                storyStructure.benefits,
                storyStructure.callToAction,
            ],
        };
    }
    buildPlatformVariations(profile, scenes) {
        return ALL_STORYBOARD_PLATFORMS.map((platform) => {
            const config = PLATFORM_CONFIG[platform];
            const isPrimary = platform === profile.platform;
            return {
                platform,
                adaptedSceneCount: isPrimary ? scenes.length : config.sceneCount,
                adaptedDuration: `${config.totalSeconds} seconds`,
                pacingAdjustments: isPrimary
                    ? ["Primary platform — no adaptation required"]
                    : [
                        `Adapted from ${profile.platform} to ${platform}`,
                        `Scene count adjusted to ${config.sceneCount}`,
                        `Pacing optimized for ${config.aspectRatio}`,
                    ],
                formatNotes: [`Aspect ratio: ${config.aspectRatio}`, `Target duration: ${config.totalSeconds}s`],
                ctaAdaptation: platform === StoryboardGenerationPlatform.Television
                    ? "Broadcast-safe CTA with legal disclaimer zone"
                    : platform === StoryboardGenerationPlatform.WhatsApp
                        ? "Compact CTA with tap-to-action overlay"
                        : "Platform-native CTA placement in safe zone",
                aspectRatio: config.aspectRatio,
            };
        });
    }
    buildRecommendations(scenes, context) {
        const recs = [];
        if (scenes.length < 5)
            recs.push("Consider adding transitional scenes for smoother narrative flow");
        if (!context.intelligence)
            recs.push("Link storyboard intelligence for enhanced brand consistency");
        if (context.productName) {
            recs.push(`Ensure ${context.productName} hero shots in product-showcase scene`);
        }
        recs.push("Review platform variations before final scene generation");
        return recs;
    }
    extractContextFromIntelligence(intelligence, creative, strategy, understanding) {
        return {
            productId: intelligence.productId,
            productName: understanding?.identity.productName ?? intelligence.profile.product,
            brandName: understanding?.identity.brand ?? intelligence.profile.brand,
            brandId: intelligence.profile.brand,
            projectId: intelligence.projectId,
            campaignId: strategy?.strategyId ?? intelligence.strategyId,
            targetAudience: intelligence.profile.targetAudience,
            keyBenefit: understanding?.uniqueValue.keyBenefits[0],
            keyFeature: understanding?.uniqueValue.uniqueSellingPoints[0],
            customerPain: understanding?.customer.customerPainPoints[0],
            creativeStyle: intelligence.profile.creativeStyle,
            environmentStyle: creative?.visualDirection.backgroundStyle,
            ctaText: creative?.marketingDirection.callToActionPlacement,
            creative: creative ?? undefined,
            strategy: strategy ?? undefined,
            intelligence,
        };
    }
    extractContextFromInput(input) {
        return {
            productId: input.productId,
            productName: input.textPrompt?.slice(0, 60) ?? "Featured Product",
            brandName: input.brandName ?? input.brandId ?? "Brand",
            brandId: input.brandId,
            projectId: input.projectId,
            campaignId: input.campaignId,
            targetAudience: "target audience from brief",
            keyBenefit: "core product benefit",
            keyFeature: "key product feature",
            customerPain: "customer pain point",
        };
    }
    resolvePlatform(input, context) {
        if (input.platform)
            return input.platform;
        if (context.intelligence)
            return mapCreativePlatform(context.intelligence.profile.platform);
        if (context.creative)
            return mapCreativePlatform(context.creative.profile.platform);
        return StoryboardGenerationPlatform.Website;
    }
    selectScenesForPlatform(blueprints, targetCount) {
        if (blueprints.length <= targetCount)
            return blueprints;
        const essential = blueprints.filter((b) => ["opening-hook", "product-showcase", "call-to-action", "ending"].includes(b.purpose));
        const optional = blueprints.filter((b) => !essential.includes(b));
        const result = [...essential];
        for (const bp of optional) {
            if (result.length >= targetCount)
                break;
            result.push(bp);
        }
        return result.sort((a, b) => SCENE_BLUEPRINTS.findIndex((x) => x.purpose === a.purpose) -
            SCENE_BLUEPRINTS.findIndex((x) => x.purpose === b.purpose));
    }
    buildSceneAssets(purpose, context) {
        const assets = ["brand-logo", "color-palette-reference"];
        if (purpose.includes("product"))
            assets.push("product-hero-image");
        if (purpose === "social-proof")
            assets.push("testimonial-overlay", "rating-badge");
        if (purpose === "call-to-action")
            assets.push("cta-button-graphic");
        if (context.productName)
            assets.push(`product-${context.productName.toLowerCase().replace(/\s+/g, "-")}`);
        return assets;
    }
    angleForPurpose(purpose, shotIndex) {
        if (purpose === "opening-hook")
            return shotIndex === 0 ? CameraAngle.LowAngle : CameraAngle.EyeLevel;
        if (purpose === "product-showcase")
            return CameraAngle.EyeLevel;
        if (purpose === "call-to-action")
            return CameraAngle.HighAngle;
        return CameraAngle.EyeLevel;
    }
    movementForPurpose(purpose, shotIndex) {
        if (purpose === "opening-hook")
            return CameraMovement.Dolly;
        if (purpose === "product-showcase")
            return shotIndex === 0 ? CameraMovement.Tracking : CameraMovement.Static;
        if (purpose === "ending")
            return CameraMovement.Crane;
        return CameraMovement.Pan;
    }
    framingForShotType(shotType) {
        const map = {
            [ShotType.Wide]: "Full environment with subject in context",
            [ShotType.Medium]: "Waist-up framing with product visibility",
            [ShotType.CloseUp]: "Tight product detail framing",
            [ShotType.ExtremeCloseUp]: "Macro product texture detail",
            [ShotType.OverTheShoulder]: "POV over shoulder toward product",
            [ShotType.Aerial]: "Top-down establishing view",
            [ShotType.POV]: "First-person product interaction",
            [ShotType.Insert]: "Graphic or text insert frame",
        };
        return map[shotType];
    }
}
//# sourceMappingURL=story-generation-analyzer.js.map