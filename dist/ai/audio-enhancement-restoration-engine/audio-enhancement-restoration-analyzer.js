import { AudioInputCategory, AudioEnhancementPlatform, EnhancementTechnique, AudioEnhancementType, PLATFORM_ENHANCEMENT_CONFIG, RestorationTechnique, } from "./types.js";
const INDUSTRY_TYPE_MAP = {
    technology: AudioEnhancementType.Voice,
    health: AudioEnhancementType.Voice,
    education: AudioEnhancementType.Voice,
    entertainment: AudioEnhancementType.Music,
    finance: AudioEnhancementType.Mixed,
    default: AudioEnhancementType.Mixed,
};
export class AudioEnhancementRestorationAnalyzer {
    analyzeAudioQuality(input, context) {
        const prompt = (input.audioPrompt ?? context.audioPrompt ?? "").toLowerCase();
        const category = input.audioCategory ?? this.detectAudioCategory(prompt, input);
        const metadata = input.audioMetadata ?? {};
        const humDetected = prompt.includes("hum") || prompt.includes("buzz");
        const clicksDetected = prompt.includes("click") || prompt.includes("pop");
        const popsDetected = prompt.includes("pop") || prompt.includes("plosive");
        const distortionDetected = prompt.includes("distort") || prompt.includes("crackle");
        const clippingDetected = prompt.includes("clip") || prompt.includes("peak");
        const defects = [];
        if (humDetected)
            defects.push("hum");
        if (clicksDetected)
            defects.push("clicks");
        if (popsDetected)
            defects.push("pops");
        if (distortionDetected)
            defects.push("distortion");
        if (clippingDetected)
            defects.push("clipping");
        if (prompt.includes("noise") || prompt.includes("hiss"))
            defects.push("background-noise");
        if (prompt.includes("echo") || prompt.includes("reverb"))
            defects.push("echo-reverb");
        if (prompt.includes("old") || prompt.includes("vintage"))
            defects.push("age-degradation");
        if (defects.length === 0 && category === AudioInputCategory.VoiceAudio)
            defects.push("minor-noise");
        return {
            sampleRate: Number(metadata.sampleRate ?? 48000),
            bitDepth: Number(metadata.bitDepth ?? 24),
            loudnessLufs: Number(metadata.loudnessLufs ?? -18),
            dynamicRangeDb: Number(metadata.dynamicRangeDb ?? 12),
            signalToNoiseRatioDb: defects.includes("background-noise") ? 28 : 42,
            backgroundNoiseLevel: defects.includes("background-noise") ? "moderate" : "low",
            echoLevel: defects.includes("echo-reverb") ? "moderate" : "minimal",
            reverbLevel: prompt.includes("reverb") ? "moderate" : "low",
            humDetected,
            clicksDetected,
            popsDetected,
            distortionDetected,
            clippingDetected,
            silenceGaps: prompt.includes("silence") ? 2 : 0,
            defects,
            audioCategory: category,
            durationSec: input.durationSec ?? 120,
            keywords: this.extractKeywords(prompt, context),
        };
    }
    buildProfile(input, platform, version, context, analysis) {
        const productId = context.productId ?? input.productId ?? "standalone";
        const enhancementType = input.enhancementType ?? this.detectAudioEnhancementType(context, analysis);
        const audioAssetId = input.audioAssetId ?? input.audioRef ?? `audio-${productId}`;
        const enhancementPlanId = `enhancement-plan-${productId}-${enhancementType}-${platform}-v${version}`;
        return {
            enhancementPlanId,
            projectId: input.projectId ?? context.projectId ?? `project-${productId}`,
            audioAssetId,
            brandId: input.brandId ?? context.brandId ?? context.brandName ?? "unknown-brand",
            campaignId: input.campaignId ?? context.campaignId,
            platform,
            enhancementType,
            version,
        };
    }
    buildEnhancementPlan(analysis, platform) {
        const config = PLATFORM_ENHANCEMENT_CONFIG[platform];
        const techniques = [EnhancementTechnique.NoiseReduction];
        if (analysis.audioCategory === AudioInputCategory.VoiceAudio) {
            techniques.push(EnhancementTechnique.VoiceEnhancement, EnhancementTechnique.LoudnessNormalization);
        }
        if (analysis.audioCategory === AudioInputCategory.MusicAudio) {
            techniques.push(EnhancementTechnique.MusicEnhancement, EnhancementTechnique.DynamicRangeOptimization, EnhancementTechnique.StereoEnhancement);
        }
        if (analysis.audioCategory === AudioInputCategory.AmbientAudio) {
            techniques.push(EnhancementTechnique.StereoEnhancement, EnhancementTechnique.DynamicRangeOptimization);
        }
        if (analysis.dynamicRangeDb < 10) {
            techniques.push(EnhancementTechnique.DynamicRangeOptimization);
        }
        if (analysis.loudnessLufs < config.targetLufs - 4) {
            techniques.push(EnhancementTechnique.LoudnessNormalization);
        }
        if (analysis.audioCategory === AudioInputCategory.MusicAudio) {
            techniques.push(EnhancementTechnique.BassEnhancement, EnhancementTechnique.TrebleEnhancement);
        }
        const unique = [...new Set(techniques)];
        const layerDetails = {};
        for (const t of unique) {
            layerDetails[t] = `${t} — target ${config.deliveryPriority} for ${analysis.audioCategory}`;
        }
        return {
            techniques: unique,
            primaryTechnique: unique[0],
            layerDetails,
            targetLoudnessLufs: config.targetLufs,
            processingChain: unique.map((t) => `Apply ${t}`),
        };
    }
    buildRestorationPlan(analysis) {
        const techniques = [];
        if (analysis.clicksDetected)
            techniques.push(RestorationTechnique.ClickRemoval);
        if (analysis.popsDetected)
            techniques.push(RestorationTechnique.PopRemoval);
        if (analysis.humDetected)
            techniques.push(RestorationTechnique.HumRemoval);
        if (analysis.defects.includes("background-noise"))
            techniques.push(RestorationTechnique.HissRemoval);
        if (analysis.echoLevel !== "minimal")
            techniques.push(RestorationTechnique.EchoReduction);
        if (analysis.distortionDetected)
            techniques.push(RestorationTechnique.DistortionReduction);
        if (analysis.clippingDetected)
            techniques.push(RestorationTechnique.ClippingRecovery);
        if (analysis.defects.includes("age-degradation")) {
            techniques.push(RestorationTechnique.OldRecordingRestoration);
        }
        if (analysis.silenceGaps > 0)
            techniques.push(RestorationTechnique.MissingAudioReconstruction);
        if (techniques.length === 0)
            techniques.push(RestorationTechnique.HissRemoval);
        const defectTargets = {};
        for (const d of analysis.defects) {
            defectTargets[d] = `Target reduction for ${d}`;
        }
        return {
            techniques,
            primaryTechnique: techniques[0],
            defectTargets,
            recoveryNotes: [
                `SNR baseline: ${analysis.signalToNoiseRatioDb}dB`,
                `Defects detected: ${analysis.defects.length}`,
                `Restoration priority: ${techniques[0]}`,
            ],
            severityLevel: analysis.defects.length >= 3 ? "high" : analysis.defects.length >= 1 ? "moderate" : "low",
        };
    }
    buildVoiceImprovementPlan(analysis) {
        const isVoice = analysis.audioCategory === AudioInputCategory.VoiceAudio ||
            analysis.audioCategory === AudioInputCategory.VideoAudio;
        return {
            speechClarity: isVoice ? "EQ boost 2-4kHz, de-mud 200-400Hz" : "N/A — non-voice source",
            pronunciationClarity: isVoice ? "Transient sharpening for consonants" : "N/A",
            breathControl: isVoice ? "Gentle breath reduction at -30dB threshold" : "N/A",
            deEsserPlanning: isVoice ? "De-esser at 6-8kHz, -6dB reduction" : "N/A",
            plosiveReduction: analysis.popsDetected ? "High-pass 80Hz + plosive repair" : "Preventive plosive filter",
            sibilanceControl: isVoice ? "Dynamic sibilance control 5-9kHz" : "N/A",
        };
    }
    buildMusicImprovementPlan(analysis) {
        const isMusic = analysis.audioCategory === AudioInputCategory.MusicAudio ||
            analysis.audioCategory === AudioInputCategory.Mixed;
        return {
            instrumentSeparation: isMusic ? "Mid-side separation for stem clarity" : "N/A — non-music source",
            harmonyPreservation: isMusic ? "Harmonic exciter with phase-safe processing" : "N/A",
            frequencyBalancing: isMusic ? "Multiband EQ — balanced tonal curve" : "Light spectral balance",
            stereoWidth: isMusic ? "Stereo width enhancement 110-120%" : "Mono-compatible stereo",
            tonalBalance: isMusic ? "Tonal balance aligned to platform loudness" : "Neutral tonal balance",
            musicalDetailRecovery: analysis.defects.includes("age-degradation")
                ? "Transient recovery + harmonic restoration"
                : "Detail enhancement via gentle exciter",
        };
    }
    buildSyncPlan(input, analysis) {
        const hasVideo = Boolean(input.videoId || input.videoAudioRef);
        const delayMs = hasVideo ? 0 : 0;
        return {
            videoSync: hasVideo ? "Frame-accurate video sync alignment" : "No video reference — audio-only",
            timelineAlignment: "Align enhancement segments to timeline markers",
            delayCorrectionMs: delayMs,
            lipSyncMetadata: hasVideo ? "Lip-sync offset metadata prepared for ±40ms correction" : "N/A",
            multiTrackAlignment: [
                "Primary audio track alignment",
                analysis.audioCategory === AudioInputCategory.Mixed ? "Secondary stem alignment" : "Single-track alignment",
                "Post-enhancement phase check",
            ],
            syncNotes: [
                `Duration: ${analysis.durationSec}s`,
                hasVideo ? "Video sync enabled" : "Standalone audio enhancement",
                "Multi-track phase coherence verified",
            ],
        };
    }
    buildOutputPreparation(platform, analysis) {
        const config = PLATFORM_ENHANCEMENT_CONFIG[platform];
        return {
            platform,
            formatNotes: [config.formatNotes, `Target loudness: ${config.targetLufs} LUFS`],
            loudnessTarget: `${config.targetLufs} LUFS integrated`,
            deliveryNotes: [
                `Delivery priority: ${config.deliveryPriority}`,
                `Category: ${analysis.audioCategory}`,
                "Production-ready enhancement blueprint prepared",
            ],
        };
    }
    buildProductionInstructions(profile, analysis, enhancement, restoration) {
        return {
            renderNotes: [
                `Enhancement plan ${profile.enhancementPlanId} — ${profile.enhancementType}`,
                `Processing chain: ${enhancement.processingChain.length} stages`,
                `Restoration: ${restoration.techniques.length} techniques`,
            ],
            clarityGuidance: [
                `Target clarity for ${analysis.audioCategory}`,
                `SNR improvement goal: +${Math.min(12, analysis.defects.length * 3)}dB`,
            ],
            restorationGuidance: restoration.recoveryNotes,
            exportPreparation: [
                `Platform: ${profile.platform}`,
                `Loudness: ${enhancement.targetLoudnessLufs} LUFS`,
                "Non-destructive enhancement workflow",
            ],
            qualityTargets: [
                "Audio clarity ≥ 55",
                "Restoration quality ≥ 55",
                "Noise reduction effective",
                "Sync alignment verified",
            ],
        };
    }
    buildRecommendations(analysis, context, enhancementType) {
        const recs = [];
        if (analysis.defects.includes("background-noise")) {
            recs.push("Apply adaptive noise reduction before other processing");
        }
        if (analysis.clippingDetected) {
            recs.push("Use clipping recovery before loudness normalization");
        }
        if (enhancementType === AudioEnhancementType.Voice) {
            recs.push("Apply de-esser and plosive reduction for voice clarity");
        }
        if (context.brandGuidelines) {
            recs.push("Align enhancement tone with brand audio guidelines");
        }
        if (analysis.defects.includes("age-degradation")) {
            recs.push("Use old recording restoration pipeline with gentle harmonic recovery");
        }
        return recs;
    }
    resolvePlatform(input, context) {
        if (input.platform)
            return input.platform;
        if (context.creative?.profile.platform === "youtube")
            return AudioEnhancementPlatform.YouTube;
        if (context.creative?.profile.platform === "tiktok")
            return AudioEnhancementPlatform.TikTok;
        if (context.industry === "health")
            return AudioEnhancementPlatform.Podcast;
        return AudioEnhancementPlatform.Website;
    }
    extractContextFromInput(input) {
        return {
            productId: input.productId,
            brandName: input.brandName,
            brandId: input.brandId,
            brandGuidelines: input.brandGuidelines,
            projectId: input.projectId,
            campaignId: input.campaignId,
            audioPrompt: input.audioPrompt,
        };
    }
    extractContextFromProduct(productId, productName, brandName, understanding, creative, strategy, input) {
        return {
            productId,
            productName,
            brandName,
            brandId: input?.brandId ?? brandName,
            brandGuidelines: input?.brandGuidelines,
            projectId: input?.projectId ?? `project-${productId}`,
            campaignId: input?.campaignId ?? strategy?.strategyId,
            targetAudience: understanding?.customer?.targetCustomer,
            industry: understanding?.customer?.targetIndustry,
            audioPrompt: input?.audioPrompt,
            creative,
            strategy,
            understanding,
        };
    }
    detectAudioCategory(prompt, input) {
        if (input.voiceAudioRef || prompt.includes("voice") || prompt.includes("speech") || prompt.includes("narrat")) {
            return AudioInputCategory.VoiceAudio;
        }
        if (input.musicAudioRef || prompt.includes("music") || prompt.includes("song") || prompt.includes("instrument")) {
            return AudioInputCategory.MusicAudio;
        }
        if (input.ambientAudioRef || prompt.includes("ambient") || prompt.includes("environment")) {
            return AudioInputCategory.AmbientAudio;
        }
        if (input.soundEffectsRef || prompt.includes("sfx") || prompt.includes("sound effect")) {
            return AudioInputCategory.SoundEffects;
        }
        if (input.videoAudioRef || input.videoId || prompt.includes("video")) {
            return AudioInputCategory.VideoAudio;
        }
        return AudioInputCategory.VoiceAudio;
    }
    detectAudioEnhancementType(context, analysis) {
        if (analysis.audioCategory === AudioInputCategory.MusicAudio)
            return AudioEnhancementType.Music;
        if (analysis.audioCategory === AudioInputCategory.VoiceAudio)
            return AudioEnhancementType.Voice;
        if (analysis.audioCategory === AudioInputCategory.AmbientAudio)
            return AudioEnhancementType.Ambient;
        if (analysis.audioCategory === AudioInputCategory.SoundEffects)
            return AudioEnhancementType.SoundEffects;
        if (analysis.audioCategory === AudioInputCategory.VideoAudio)
            return AudioEnhancementType.VideoAudio;
        const industry = context.industry ?? "default";
        return INDUSTRY_TYPE_MAP[industry] ?? INDUSTRY_TYPE_MAP.default;
    }
    extractKeywords(prompt, context) {
        const words = prompt.split(/\s+/).filter((w) => w.length > 3);
        const keywords = [...words];
        if (context.brandName)
            keywords.push(context.brandName.toLowerCase());
        if (context.productName)
            keywords.push(context.productName.toLowerCase());
        return [...new Set(keywords)].slice(0, 12);
    }
}
//# sourceMappingURL=audio-enhancement-restoration-analyzer.js.map