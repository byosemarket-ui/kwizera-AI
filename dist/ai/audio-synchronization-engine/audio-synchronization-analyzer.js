import { AudioSyncPlanType, AUDIO_SYNC_PLATFORM_TARGETS, PLATFORM_AUDIO_SYNC_CONFIG, } from "./types.js";
import { StoryboardGenerationPlatform } from "../story-generation-engine/types.js";
export class AudioSynchronizationAnalyzer {
    buildAudioSyncPlan(scene, cameraPlan, motionPlan, animationPlan, vfxPlan, version, input) {
        const profile = this.buildProfile(scene, cameraPlan, motionPlan, animationPlan, vfxPlan, version);
        const hasVoice = Boolean(input.voiceFileIds?.length || scene.audioPlanning.voiceTiming);
        return {
            audioSynchronizationId: profile.audioSynchronizationId,
            profile,
            planType: hasVoice ? AudioSyncPlanType.Combined : AudioSyncPlanType.Mixed,
            voiceSynchronization: this.buildVoiceSync(scene, animationPlan, input),
            musicSynchronization: this.buildMusicSync(scene, input),
            soundEffectSynchronization: this.buildSoundEffectSync(scene, motionPlan, vfxPlan, input),
            subtitleSynchronization: this.buildSubtitleSync(scene, animationPlan),
            audioMixing: this.buildAudioMixing(scene),
            sceneSynchronization: this.buildSceneSync(scene, cameraPlan, motionPlan, animationPlan, vfxPlan),
            continuity: this.buildContinuity(scene),
            platformOptimizations: this.buildPlatformOptimizations(scene.profile.platform),
        };
    }
    buildProfile(scene, cameraPlan, motionPlan, animationPlan, vfxPlan, version) {
        return {
            audioSynchronizationId: `audio-sync-${scene.sceneId}-v${version}`,
            projectId: scene.profile.projectId,
            sceneId: scene.sceneId,
            storyboardId: scene.profile.storyboardId,
            productId: scene.profile.productId,
            brandId: scene.profile.brandId,
            platform: scene.profile.platform,
            audioVersion: version,
            visualEffectPlanId: vfxPlan.visualEffectPlanId,
            animationPlanId: animationPlan.animationPlanId,
            motionPlanId: motionPlan.motionPlanId,
            cameraPlanId: cameraPlan.cameraPlanId,
        };
    }
    buildVoiceSync(scene, animationPlan, input) {
        const ap = scene.audioPlanning;
        const voiceRef = input.voiceFileIds?.length ? `Voice files: ${input.voiceFileIds.join(", ")}` : "Generated voice-over track";
        return {
            voiceTiming: ap.voiceTiming,
            speechAlignment: `Speech aligned to scene ${scene.structure.sceneDuration} — word-level sync`,
            pronunciationTiming: "Phoneme timing mapped to dialogue script beats",
            emotionTiming: `${scene.structure.sceneMood} — emotional pacing on key phrases`,
            dialogueTiming: `Dialogue blocks synced to ${scene.structure.scenePurpose} objectives`,
            lipSyncBlueprint: animationPlan.characterAnimation.lipMovementPlan !== "N/A"
                ? animationPlan.characterAnimation.lipMovementPlan
                : "Static lip hold — product-focus scene without dialogue sync",
        };
    }
    buildMusicSync(scene, input) {
        const ap = scene.audioPlanning;
        const musicRef = input.musicIds?.length ? `Tracks: ${input.musicIds.join(", ")}` : "Campaign music bed";
        return {
            musicPlacement: `${musicRef} — ${ap.musicTiming}`,
            musicTiming: ap.musicTiming,
            beatDetection: "Beat markers at scene transition points and CTA moments",
            rhythmAlignment: "Music rhythm aligned to motion and animation beats",
            musicFadeIn: "Fade in 0.5s at scene start",
            musicFadeOut: scene.structure.scenePurpose === "ending" ? "Fade out 2s before lockup" : "Cross-fade to next scene",
        };
    }
    buildSoundEffectSync(scene, motionPlan, vfxPlan, input) {
        const sfxRef = input.soundEffectIds?.length ? `SFX: ${input.soundEffectIds.join(", ")}` : scene.audioPlanning.soundEffects;
        return {
            effectTiming: `SFX timed to ${scene.structure.sceneDuration} — sync with motion beats`,
            environmentalSounds: vfxPlan.environmentEffects.ambientMotion,
            productSounds: motionPlan.productMotion.primaryAction.includes("reveal") ? "Product reveal whoosh and highlight chime" : "Subtle product interaction SFX",
            transitionSounds: scene.transitionPlanning.audioTransition,
            ambientSounds: sfxRef,
        };
    }
    buildSubtitleSync(scene, animationPlan) {
        const isCta = scene.structure.scenePurpose === "call-to-action";
        return {
            subtitleTiming: `Subtitles synced to ${scene.audioPlanning.voiceTiming}`,
            captionTiming: scene.audioPlanning.silenceTiming,
            multiLanguageSupport: "Primary language + optional secondary caption track",
            readingSpeedValidation: "Reading speed validated at 160-180 WPM for accessibility",
            subtitlePosition: animationPlan.textAnimation.reveal.includes("lower") ? "Lower-third safe zone" : "Center-bottom safe zone",
            captionStyling: `${scene.visualPlan.typographyPlacement} — brand caption styling`,
        };
    }
    buildAudioMixing(scene) {
        const isSocial = [StoryboardGenerationPlatform.TikTok, StoryboardGenerationPlatform.InstagramReels].includes(scene.profile.platform);
        return {
            voiceLevel: isSocial ? "-12 dBFS peak — voice prominent" : "-14 dBFS peak — broadcast voice",
            musicLevel: isSocial ? "-18 dBFS under voice" : "-20 dBFS under voice — cinematic bed",
            effectLevel: "-22 dBFS — supporting SFX layer",
            noiseReduction: "Light noise gate and spectral denoise on voice track",
            loudnessNormalization: PLATFORM_AUDIO_SYNC_CONFIG[scene.profile.platform].loudnessTarget,
            dynamicRange: scene.profile.platform === StoryboardGenerationPlatform.Television ? "Broadcast DR — controlled" : "Moderate DR for digital platforms",
            stereoPlanning: "Stereo mix — voice center, music wide, SFX spatial",
            surroundSoundPreparation: scene.profile.platform === StoryboardGenerationPlatform.Television ? "5.1 surround stem preparation" : "Stereo-only — surround N/A",
        };
    }
    buildSceneSync(scene, cameraPlan, motionPlan, animationPlan, vfxPlan) {
        return {
            voiceSync: [scene.audioPlanning.voiceTiming, scene.audioPlanning.audioSynchronization],
            musicSync: [scene.audioPlanning.musicTiming],
            motionSync: motionPlan.cameraSynchronization.syncPoints,
            cameraSync: cameraPlan.shotPlans.map((s) => `Shot ${s.shotOrder}: ${s.shotDuration}`),
            animationSync: animationPlan.synchronization.motionSync,
            visualEffectsSync: vfxPlan.synchronization.motionSync,
            sceneChangeSync: [scene.transitionPlanning.sceneTransition, scene.transitionPlanning.audioTransition],
        };
    }
    buildContinuity(scene) {
        return {
            crossSceneContinuity: scene.structure.sceneOrder > 1,
            voiceContinuity: true,
            musicContinuity: scene.structure.scenePurpose !== "opening-hook",
            effectContinuity: true,
            issues: [],
        };
    }
    buildPlatformOptimizations(platform) {
        return AUDIO_SYNC_PLATFORM_TARGETS.map((p) => {
            const config = PLATFORM_AUDIO_SYNC_CONFIG[p];
            return {
                platform: p,
                loudnessTarget: config.loudnessTarget,
                musicMixRatio: config.musicMixRatio,
                notes: p === platform ? ["Primary platform audio sync profile"] : [`Adapt ${config.musicMixRatio} mix for ${p}`],
            };
        });
    }
    buildRecommendations(draft) {
        const recs = [];
        recs.push("Verify lip sync blueprint against final voice-over timing before render");
        if (draft.subtitleSynchronization.multiLanguageSupport.includes("secondary")) {
            recs.push("Confirm multi-language caption tracks with brand localization guidelines");
        }
        return recs;
    }
}
//# sourceMappingURL=audio-synchronization-analyzer.js.map