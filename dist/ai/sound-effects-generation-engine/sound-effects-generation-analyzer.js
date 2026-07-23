import { CinematicType, EnvironmentalType, FoleyType, PLATFORM_SFX_CONFIG, SfxPlatform, SfxSyncTarget, SoundCategory, } from "./types.js";
const INDUSTRY_CATEGORY_MAP = {
    technology: SoundCategory.Interface,
    health: SoundCategory.Environmental,
    education: SoundCategory.Foley,
    fashion: SoundCategory.Transition,
    finance: SoundCategory.Interface,
    entertainment: SoundCategory.Cinematic,
    default: SoundCategory.Mixed,
};
const INDUSTRY_ENVIRONMENT_MAP = {
    technology: EnvironmentalType.Office,
    health: EnvironmentalType.Office,
    education: EnvironmentalType.Office,
    fashion: EnvironmentalType.City,
    finance: EnvironmentalType.Office,
    entertainment: EnvironmentalType.City,
    default: EnvironmentalType.Office,
};
export class SoundEffectsGenerationAnalyzer {
    analyzeSound(input, context) {
        const category = input.soundCategory ?? this.detectCategory(context);
        const durationSec = input.durationSec ?? this.resolveDuration(input.platform);
        const prompt = input.soundPrompt ?? context.soundPrompt ?? "";
        const scene = input.sceneHint ?? context.sceneHint ?? this.detectScene(context, category);
        return {
            scene,
            environment: this.detectEnvironment(context, category),
            action: this.detectAction(prompt, category),
            objects: this.detectObjects(prompt, context),
            distance: category === SoundCategory.Cinematic ? "mid-close" : "close",
            direction: "center-panned with subtle stereo width",
            durationSec,
            intensity: category === SoundCategory.Cinematic ? "high" : "medium",
            emotion: this.detectEmotion(context, category),
            intendedAudience: context.targetAudience ?? "general audience",
            keywords: this.extractKeywords(prompt, context),
        };
    }
    buildProfile(input, platform, version, context, analysis) {
        const productId = context.productId ?? input.productId ?? "standalone";
        const category = input.soundCategory ?? this.detectCategory(context);
        const soundPlanId = `sfx-plan-${productId}-${category}-${platform}-v${version}`;
        return {
            soundPlanId,
            projectId: input.projectId ?? context.projectId ?? `project-${productId}`,
            brandId: input.brandId ?? context.brandId ?? context.brandName ?? "unknown-brand",
            campaignId: input.campaignId ?? context.campaignId,
            platform,
            soundCategory: category,
            version,
        };
    }
    buildSoundEffectPlan(analysis, category) {
        const base = this.baseSoundsForCategory(category, analysis);
        return {
            foleySounds: base.foley,
            objectSounds: base.objects,
            humanSounds: base.human,
            natureSounds: base.nature,
            animalSounds: base.animal,
            vehicleSounds: base.vehicle,
            mechanicalSounds: base.mechanical,
            electronicSounds: base.electronic,
            interfaceSounds: base.interface,
            transitionSounds: base.transition,
        };
    }
    buildFoleyPlan(analysis, category) {
        const types = category === SoundCategory.Foley || category === SoundCategory.Mixed
            ? [FoleyType.Footsteps, FoleyType.DoorSounds, FoleyType.PaperSounds]
            : [FoleyType.Footsteps];
        return {
            foleyTypes: types,
            footsteps: `Footsteps on ${analysis.environment} surface — ${analysis.intensity} intensity`,
            clothingMovement: "Subtle fabric rustle during movement",
            doorSounds: "Door open/close with natural room tone",
            glassSounds: "Glass clink or placement on surface",
            metalSounds: "Light metal contact for object interaction",
            paperSounds: "Page turn or document handling",
            waterSounds: "Pour or splash for relevant scene actions",
            toolSounds: "Tool pickup and use for mechanical scenes",
            notes: [`Foley matched to ${analysis.scene} scene`, `Distance: ${analysis.distance}`],
        };
    }
    buildEnvironmentalPlan(context, analysis) {
        const industry = context.industry?.toLowerCase() ?? "default";
        const primary = INDUSTRY_ENVIRONMENT_MAP[industry] ?? EnvironmentalType.Office;
        const types = [primary];
        if (analysis.environment.includes("outdoor"))
            types.push(EnvironmentalType.Wind);
        if (analysis.scene.includes("market"))
            types.push(EnvironmentalType.Market);
        const details = {};
        for (const t of types) {
            details[t] = `${t} ambient layer for ${analysis.scene}`;
        }
        return {
            environmentalTypes: types,
            primaryEnvironment: analysis.environment,
            ambientLayers: types.map((t) => `${t} bed — low intensity background`),
            spatialNotes: ["Stereo field with depth positioning", `Environment matches ${analysis.scene}`],
            environmentDetails: details,
        };
    }
    buildCinematicPlan(analysis, category) {
        const types = category === SoundCategory.Cinematic || category === SoundCategory.Mixed
            ? [CinematicType.Impact, CinematicType.Whoosh, CinematicType.Rise, CinematicType.Atmosphere]
            : [CinematicType.TransitionEffects];
        return {
            cinematicTypes: types,
            impact: "Deep impact hit for scene emphasis",
            boom: "Sub-bass boom for dramatic reveals",
            whoosh: "Fast whoosh for transitions and motion",
            rise: "Tension rise leading to key moment",
            hit: "Punchy hit synchronized to visual cue",
            trailerEffects: "Epic trailer stinger for brand moments",
            transitionEffects: "Smooth transition SFX between sections",
            atmosphere: `Atmospheric bed supporting ${analysis.emotion} tone`,
        };
    }
    buildTimelinePlan(analysis, soundPlan) {
        const duration = analysis.durationSec;
        const cuePoints = [
            { timeSec: 0, label: "Start", soundType: "fade-in" },
            { timeSec: Math.round(duration * 0.25), label: "First action", soundType: soundPlan.foleySounds[0] ?? "foley" },
            { timeSec: Math.round(duration * 0.5), label: "Midpoint", soundType: soundPlan.transitionSounds[0] ?? "transition" },
            { timeSec: Math.round(duration * 0.75), label: "Climax", soundType: soundPlan.objectSounds[0] ?? "impact" },
            { timeSec: duration, label: "End", soundType: "fade-out" },
        ];
        return {
            cuePoints,
            layerPositions: [
                "Layer 1: Environmental bed",
                "Layer 2: Foley and object sounds",
                "Layer 3: Cinematic accents",
                "Layer 4: Interface/transition SFX",
            ],
            totalDurationSec: duration,
            fadeIn: "0.5s fade-in on environmental layer",
            fadeOut: duration > 10 ? "1.5s fade-out" : "0.5s fade-out",
            crossfade: "250ms crossfade between cue transitions",
        };
    }
    buildSyncPreparation(input, analysis, platform) {
        const syncTarget = input.syncTarget ?? this.detectSyncTarget(platform);
        const config = PLATFORM_SFX_CONFIG[platform];
        return {
            syncTarget,
            hitPoints: analysis.objects.length > 0
                ? analysis.objects.map((o, i) => `${o} hit at cue ${i + 1}`)
                : ["Primary hit at midpoint", "Secondary accent at 75%"],
            syncNotes: [
                `Sync SFX to ${syncTarget} timeline`,
                `Total duration: ${analysis.durationSec}s`,
                `Intensity: ${analysis.intensity}`,
            ],
            platformNotes: [config.formatNotes, `Loudness: ${config.loudnessTarget}`],
        };
    }
    buildProductionInstructions(profile, analysis, timeline) {
        return {
            renderNotes: [
                `SFX blueprint v${profile.version} — ${profile.soundCategory} ${profile.platform}`,
                "Blueprint only — no audio synthesis in this engine",
            ],
            layerGuidance: timeline.layerPositions,
            mixGuidance: [
                `Balance layers for ${analysis.intensity} intensity`,
                `Spatial: ${analysis.direction}`,
                PLATFORM_SFX_CONFIG[profile.platform].loudnessTarget,
            ],
            exportPreparation: [
                `Duration: ${analysis.durationSec}s`,
                PLATFORM_SFX_CONFIG[profile.platform].formatNotes,
            ],
            qualityTargets: ["Realism ≥ 80%", "Sync accuracy ≥ 85%", "Layer clarity ≥ 80%"],
        };
    }
    buildRecommendations(analysis, context, category) {
        const recs = [];
        if (analysis.durationSec > 60) {
            recs.push("Consider looping ambient layers for extended duration");
        }
        if (context.brandGuidelines) {
            recs.push(`Apply brand SFX guidelines: ${context.brandGuidelines.slice(0, 80)}`);
        }
        if (category === SoundCategory.Cinematic) {
            recs.push("Align impact and whoosh SFX to video cut points");
        }
        if (analysis.objects.length > 0) {
            recs.push(`Plan object sounds for: ${analysis.objects.join(", ")}`);
        }
        return recs.length > 0 ? recs : ["Sound effect blueprint ready for production planning"];
    }
    resolvePlatform(input, context) {
        if (input.platform)
            return input.platform;
        if (context.creative?.profile.platform) {
            const p = context.creative.profile.platform.toLowerCase();
            if (p.includes("youtube"))
                return SfxPlatform.YouTube;
            if (p.includes("tiktok"))
                return SfxPlatform.TikTok;
            if (p.includes("instagram"))
                return SfxPlatform.Instagram;
            if (p.includes("facebook"))
                return SfxPlatform.Facebook;
            if (p.includes("mobile"))
                return SfxPlatform.Mobile;
            if (p.includes("tv") || p.includes("television"))
                return SfxPlatform.Television;
        }
        return SfxPlatform.Website;
    }
    extractContextFromInput(input) {
        return {
            brandName: input.brandName ?? "KWIZERA",
            brandId: input.brandId,
            brandGuidelines: input.brandGuidelines,
            projectId: input.projectId,
            campaignId: input.campaignId,
            soundPrompt: input.soundPrompt,
            sceneHint: input.sceneHint,
        };
    }
    extractContextFromProduct(productId, productName, brandName, understanding, creative, strategy, input) {
        return {
            productId,
            productName,
            brandName,
            brandId: input?.brandId ?? brandName,
            brandGuidelines: input?.brandGuidelines ?? creative?.profile.tone,
            projectId: input?.projectId ?? `project-${productId}`,
            campaignId: input?.campaignId ?? strategy?.relationships?.campaigns?.[0],
            targetAudience: understanding?.customer?.targetCustomer,
            industry: understanding?.customer?.targetIndustry,
            soundPrompt: input?.soundPrompt,
            sceneHint: input?.sceneHint,
            creative,
            strategy,
            understanding,
        };
    }
    detectCategory(context) {
        const prompt = (context.soundPrompt ?? "").toLowerCase();
        if (prompt.includes("cinematic") || prompt.includes("trailer"))
            return SoundCategory.Cinematic;
        if (prompt.includes("foley") || prompt.includes("footstep"))
            return SoundCategory.Foley;
        if (prompt.includes("ambient") || prompt.includes("environment"))
            return SoundCategory.Environmental;
        if (prompt.includes("ui") || prompt.includes("interface"))
            return SoundCategory.Interface;
        if (prompt.includes("transition") || prompt.includes("whoosh"))
            return SoundCategory.Transition;
        const industry = context.industry?.toLowerCase() ?? "default";
        return INDUSTRY_CATEGORY_MAP[industry] ?? SoundCategory.Mixed;
    }
    detectScene(context, category) {
        if (context.sceneHint)
            return context.sceneHint;
        if (category === SoundCategory.Cinematic)
            return "Product reveal cinematic sequence";
        if (category === SoundCategory.Environmental)
            return "Ambient environment establishing shot";
        return `${context.productName ?? "Brand"} ${category} scene`;
    }
    detectEnvironment(context, category) {
        const industry = context.industry?.toLowerCase() ?? "default";
        if (category === SoundCategory.Environmental) {
            const env = INDUSTRY_ENVIRONMENT_MAP[industry];
            return `${env} environment`;
        }
        return industry === "technology" ? "modern office indoor" : "professional studio indoor";
    }
    detectAction(prompt, category) {
        if (prompt.includes("click"))
            return "UI click interaction";
        if (prompt.includes("door"))
            return "Door open and close";
        if (prompt.includes("impact"))
            return "Dramatic impact moment";
        if (category === SoundCategory.Transition)
            return "Scene transition sweep";
        return "Primary scene action with supporting foley";
    }
    detectObjects(prompt, context) {
        const objects = [];
        if (/phone|mobile|device/i.test(prompt))
            objects.push("mobile device");
        if (/door/i.test(prompt))
            objects.push("door");
        if (/keyboard|typing/i.test(prompt))
            objects.push("keyboard");
        if (/car|vehicle/i.test(prompt))
            objects.push("vehicle");
        if (context.productName)
            objects.push(context.productName);
        return objects.length > 0 ? objects : ["primary object"];
    }
    detectEmotion(context, category) {
        if (category === SoundCategory.Cinematic)
            return "epic";
        if (category === SoundCategory.Interface)
            return "neutral-professional";
        if (context.industry === "health")
            return "calm";
        return "confident";
    }
    resolveDuration(platform) {
        if (platform && PLATFORM_SFX_CONFIG[platform]) {
            return Math.min(PLATFORM_SFX_CONFIG[platform].maxDurationSec, 60);
        }
        return 30;
    }
    detectSyncTarget(platform) {
        const map = {
            [SfxPlatform.YouTube]: SfxSyncTarget.Video,
            [SfxPlatform.TikTok]: SfxSyncTarget.SocialMedia,
            [SfxPlatform.Instagram]: SfxSyncTarget.SocialMedia,
            [SfxPlatform.Facebook]: SfxSyncTarget.Advertisement,
            [SfxPlatform.Television]: SfxSyncTarget.Film,
            [SfxPlatform.Mobile]: SfxSyncTarget.Animation,
        };
        return map[platform] ?? SfxSyncTarget.Video;
    }
    baseSoundsForCategory(category, analysis) {
        const empty = { foley: [], objects: [], human: [], nature: [], animal: [], vehicle: [], mechanical: [], electronic: [], interface: [], transition: [] };
        switch (category) {
            case SoundCategory.Foley:
                return { ...empty, foley: ["footsteps", "door open", "paper rustle"], objects: ["object placement"] };
            case SoundCategory.Environmental:
                return { ...empty, nature: ["ambient wind", "room tone", analysis.environment] };
            case SoundCategory.Cinematic:
                return { ...empty, transition: ["whoosh", "rise"], objects: ["impact hit", "boom"] };
            case SoundCategory.Interface:
                return { ...empty, interface: ["click", "notification", "success chime"], electronic: ["ui beep"] };
            case SoundCategory.Transition:
                return { ...empty, transition: ["swoosh", "stinger", "reverse cymbal"] };
            case SoundCategory.Mechanical:
                return { ...empty, mechanical: ["gear turn", "machine hum"], electronic: ["servo"] };
            default:
                return {
                    foley: ["footsteps"],
                    objects: ["object interaction"],
                    human: ["breath accent"],
                    nature: ["ambient tone"],
                    animal: [],
                    vehicle: [],
                    mechanical: ["subtle mechanism"],
                    electronic: ["ui feedback"],
                    interface: ["click"],
                    transition: ["whoosh"],
                };
        }
    }
    extractKeywords(prompt, context) {
        const words = `${prompt} ${context.productName ?? ""} ${context.brandName ?? ""}`.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
        const base = [...new Set(words)].slice(0, 8);
        if (context.brandName)
            base.push(context.brandName.toLowerCase());
        return [...new Set(base)];
    }
}
//# sourceMappingURL=sound-effects-generation-analyzer.js.map