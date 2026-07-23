import { CreativePlatform } from "../creative-direction-engine/types.js";
const PLATFORM_AUDIO_CONFIG = {
    [CreativePlatform.TikTok]: { maxVoiceSec: 25, musicVolume: "music at -18dB under voice", sfxDensity: "high", voiceRequired: true, pacing: "fast punchy", wpm: 160 },
    [CreativePlatform.InstagramReels]: { maxVoiceSec: 30, musicVolume: "music at -20dB under voice", sfxDensity: "medium-high", voiceRequired: true, pacing: "visual-first concise", wpm: 150 },
    [CreativePlatform.Facebook]: { maxVoiceSec: 45, musicVolume: "music at -22dB, sound-off captions primary", sfxDensity: "low", voiceRequired: false, pacing: "clear value-first", wpm: 140 },
    [CreativePlatform.YouTubeShorts]: { maxVoiceSec: 28, musicVolume: "music at -18dB under voice", sfxDensity: "medium", voiceRequired: true, pacing: "skip-proof hook", wpm: 155 },
    [CreativePlatform.YouTube]: { maxVoiceSec: 120, musicVolume: "music at -24dB under voice", sfxDensity: "low-medium", voiceRequired: true, pacing: "narrative chapters", wpm: 130 },
    [CreativePlatform.WhatsAppStatus]: { maxVoiceSec: 20, musicVolume: "music at -20dB under voice", sfxDensity: "low", voiceRequired: true, pacing: "conversational brief", wpm: 145 },
    [CreativePlatform.Website]: { maxVoiceSec: 90, musicVolume: "music at -26dB ambient", sfxDensity: "minimal", voiceRequired: false, pacing: "scannable sections", wpm: 135 },
};
const PURPOSE_EMOTION = {
    hook: "curiosity",
    "product-introduction": "trust",
    "feature-presentation": "professionalism",
    "benefit-demonstration": "excitement",
    "customer-value": "trust",
    "social-proof": "trust",
    "offer-presentation": "urgency",
    "call-to-action": "urgency",
    ending: "inspiration",
};
const PURPOSE_SFX = {
    hook: ["whoosh", "impact"],
    "product-introduction": ["ambient", "product"],
    "feature-presentation": ["click", "transition"],
    "benefit-demonstration": ["ambient"],
    "call-to-action": ["notification", "click"],
    ending: ["fade", "ambient"],
};
export class AudioPlanningAnalyzer {
    buildProfile(input, storyboard, scriptPlan, visualPlan, version, language) {
        const audioPlanId = input.audioPlanId ?? `audio-plan-${input.productId}-${storyboard.profile.platform}`;
        return {
            audioPlanId,
            projectId: input.projectId ?? storyboard.projectId,
            storyboardId: storyboard.storyboardId,
            scriptPlanId: scriptPlan.scriptPlanId,
            visualPlanId: visualPlan.visualPlanId,
            product: storyboard.profile.product,
            brand: storyboard.profile.brand,
            campaignGoal: storyboard.profile.campaignGoal,
            platform: storyboard.profile.platform,
            audioVersion: version,
            language,
        };
    }
    buildSceneAudioPlans(storyboard, scriptPlan, creative) {
        const config = PLATFORM_AUDIO_CONFIG[storyboard.profile.platform];
        return storyboard.scenes.map((scene, index) => {
            const scriptScene = scriptPlan.scenePlans[index];
            const emotion = PURPOSE_EMOTION[scene.scenePurpose] ?? "professionalism";
            const sfx = PURPOSE_SFX[scene.scenePurpose] ?? ["transition"];
            return {
                sceneNumber: scene.sceneNumber,
                scenePurpose: scene.scenePurpose,
                plannedVoiceOver: `Plan voice-over (${scriptPlan.profile.language}): ${scriptScene?.plannedNarration ?? scene.visualObjective}`,
                plannedNarrationTiming: scriptScene?.estimatedReadingTime ?? scene.estimatedDuration,
                plannedMusicLevel: scene.scenePurpose === "hook" ? "music full (-12dB)" : config.musicVolume,
                plannedSfx: sfx.map((s) => `Plan ${s} sfx for ${scene.scenePurpose}`),
                transitionAudio: `Plan transition audio — ${scene.transitionOut} with ${creative.cinematicDirection.transitionStyle}`,
                emotionalPacing: `Plan ${emotion} pacing for ${scene.emotionalGoal}`,
            };
        });
    }
    buildVoicePlanning(scriptPlan, creative, storyboard) {
        const config = PLATFORM_AUDIO_CONFIG[storyboard.profile.platform];
        const voice = scriptPlan.voicePreparation;
        const pauseTiming = {};
        const readingDuration = {};
        for (const scene of scriptPlan.scenePlans) {
            pauseTiming[scene.sceneNumber] = voice.pauseLocations.find((p) => p.includes(String(scene.sceneNumber)))
                ? `Pause 0.5s after scene ${scene.sceneNumber}`
                : `Natural pause at scene ${scene.sceneNumber} boundary`;
            readingDuration[scene.sceneNumber] = scene.estimatedReadingTime;
        }
        return {
            voiceStyle: voice.voiceStyle,
            voiceGenderPreference: "neutral-professional",
            voiceAgeStyle: storyboard.profile.platform === CreativePlatform.TikTok ? "young-adult" : "adult-professional",
            speakingSpeed: voice.speakingSpeed,
            speakingTone: creative.profile.tone,
            emotionalTone: voice.emotionalTone,
            pronunciationRules: [
                `Pronounce ${creative.profile.brand} consistently`,
                `Emphasize product name ${storyboard.profile.product}`,
                `Match ${scriptPlan.profile.language} locale pronunciation`,
            ],
            emphasisPoints: voice.emphasisPoints,
            pauseTiming,
            readingDuration,
        };
    }
    buildMusicPlanning(creative, storyboard) {
        const config = PLATFORM_AUDIO_CONFIG[storyboard.profile.platform];
        const mood = creative.profile.mood;
        const energy = storyboard.profile.platform === CreativePlatform.TikTok ? "high" : "medium";
        return {
            musicStyle: `${creative.profile.creativeStyle} — ${creative.profile.creativeTheme}`,
            musicMood: mood,
            musicEnergy: energy,
            introMusic: `Plan intro music — ${mood} ${energy}-energy stinger (2-4s)`,
            backgroundMusic: `Plan background music — ${config.pacing} bed at ${config.musicVolume}`,
            endingMusic: `Plan ending music — resolve to brand tone with ${creative.profile.brand} identity`,
            fadeIn: "Plan fade in — 1.5s from silence",
            fadeOut: "Plan fade out — 2s to silence at closing",
            volumeStrategy: config.musicVolume,
        };
    }
    buildSoundEffectPlanning(storyboard) {
        const sceneEffects = {};
        for (const scene of storyboard.scenes) {
            sceneEffects[scene.sceneNumber] = (PURPOSE_SFX[scene.scenePurpose] ?? ["transition"]).map((s) => `Plan ${s} for scene ${scene.sceneNumber}`);
        }
        return {
            transitionSounds: ["Plan whoosh between scenes", "Plan soft click on text reveals"],
            productSounds: ["Plan product interaction sfx", "Plan feature highlight chime"],
            clickSounds: ["Plan UI click for CTA moments", "Plan tap sound for mobile CTAs"],
            whooshSounds: ["Plan whoosh for hook transitions", "Plan swipe whoosh for scene changes"],
            impactSounds: ["Plan impact hit for hook", "Plan bass drop for offer reveal"],
            ambientSounds: ["Plan ambient room tone", "Plan environmental atmosphere per scene"],
            notificationSounds: ["Plan notification ping for CTA", "Plan alert for urgency scenes"],
            sceneEffects,
        };
    }
    buildSynchronization(storyboard, scriptPlan) {
        const voiceTiming = {};
        const musicTiming = {};
        const subtitleTiming = {};
        const sceneTiming = {};
        const transitionTiming = {};
        for (const scene of storyboard.scenes) {
            const scriptScene = scriptPlan.scenePlans.find((s) => s.sceneNumber === scene.sceneNumber);
            const timing = storyboard.timing.sceneTiming[scene.sceneNumber] ?? scene.estimatedDuration;
            voiceTiming[scene.sceneNumber] = `Plan voice start at scene ${scene.sceneNumber} — duration ${scriptScene?.estimatedReadingTime ?? timing}`;
            musicTiming[scene.sceneNumber] = `Plan music bed continuous — duck under voice at scene ${scene.sceneNumber}`;
            subtitleTiming[scene.sceneNumber] =
                scriptPlan.subtitlePreparation.subtitleTiming[scene.sceneNumber] ?? scriptScene?.estimatedDisplayTime ?? timing;
            sceneTiming[scene.sceneNumber] = timing;
            transitionTiming[scene.sceneNumber] = `Plan audio transition — ${scene.transitionOut} synced to ${storyboard.timing.transitionTiming}`;
        }
        return {
            voiceTiming,
            musicTiming,
            subtitleTiming,
            sceneTiming,
            transitionTiming,
            ctaTiming: storyboard.timing.ctaTiming,
        };
    }
    buildEmotionalFlow(creative, storyboard) {
        const tone = creative.profile.emotionalDirection;
        return {
            excitement: `Plan excitement arc — peak at hook and benefit scenes (${tone})`,
            trust: `Plan trust build — product intro and social proof (${creative.profile.brand})`,
            curiosity: `Plan curiosity hook — opening ${storyboard.storyFlow.hook.slice(0, 40)}`,
            urgency: `Plan urgency — CTA and offer scenes (${storyboard.storyFlow.callToAction.slice(0, 40)})`,
            luxury: creative.profile.creativeStyle === "luxury" ? `Plan luxury pacing — refined pauses and soft music` : "Plan standard commercial pacing",
            professionalism: `Plan professionalism — ${creative.brandDirection.brandVoice} throughout`,
            happiness: `Plan positive resolution — ending ${storyboard.storyFlow.ending.slice(0, 40)}`,
            inspiration: `Plan inspiration close — brand message and CTA uplift`,
        };
    }
    buildPlatformRules(storyboard) {
        const config = PLATFORM_AUDIO_CONFIG[storyboard.profile.platform];
        return {
            platform: storyboard.profile.platform,
            maxVoiceDuration: `${config.maxVoiceSec}s`,
            musicVolumeGuidance: config.musicVolume,
            sfxDensity: config.sfxDensity,
            voiceOverRequired: config.voiceRequired,
            pacingGuidance: config.pacing,
        };
    }
    validateAlignment(sceneAudioPlans, storyboard, scriptPlan, visualPlan) {
        const issues = [];
        if (sceneAudioPlans.length !== storyboard.scenes.length) {
            issues.push(`Scene count mismatch: audio ${sceneAudioPlans.length} vs storyboard ${storyboard.scenes.length}`);
        }
        if (sceneAudioPlans.length !== scriptPlan.scenePlans.length) {
            issues.push(`Scene count mismatch: audio ${sceneAudioPlans.length} vs script ${scriptPlan.scenePlans.length}`);
        }
        if (sceneAudioPlans.length !== visualPlan.scenePlans.length) {
            issues.push(`Scene count mismatch: audio ${sceneAudioPlans.length} vs visual ${visualPlan.scenePlans.length}`);
        }
        if (scriptPlan.storyboardId !== storyboard.storyboardId) {
            issues.push("Script plan storyboard ID does not match");
        }
        if (visualPlan.storyboardId !== storyboard.storyboardId) {
            issues.push("Visual plan storyboard ID does not match");
        }
        if (visualPlan.scriptPlanId !== scriptPlan.scriptPlanId) {
            issues.push("Visual plan script plan ID does not match");
        }
        for (let i = 0; i < Math.min(sceneAudioPlans.length, storyboard.scenes.length); i++) {
            if (sceneAudioPlans[i].sceneNumber !== storyboard.scenes[i].sceneNumber) {
                issues.push(`Scene ${i + 1} numbering misaligned with storyboard`);
            }
            if (sceneAudioPlans[i].scenePurpose !== storyboard.scenes[i].scenePurpose) {
                issues.push(`Scene ${sceneAudioPlans[i].sceneNumber} purpose does not match storyboard`);
            }
        }
        return { aligned: issues.length === 0, issues };
    }
}
//# sourceMappingURL=audio-planning-analyzer.js.map