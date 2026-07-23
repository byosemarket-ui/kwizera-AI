import { EmotionType, VoiceType } from "../text-to-speech-generation-engine/types.js";
import { ALL_S2S_PLATFORMS, AccentType, PLATFORM_S2S_CONFIG, S2sLanguage, S2sOutputUseCase, S2sPlatform, } from "./types.js";
const INDUSTRY_VOICE_MAP = {
    technology: VoiceType.Professional,
    health: VoiceType.Neutral,
    education: VoiceType.Narrator,
    fashion: VoiceType.Female,
    finance: VoiceType.Professional,
    default: VoiceType.Narrator,
};
const ACCENT_LANGUAGE_MAP = {
    [S2sLanguage.English]: AccentType.American,
    [S2sLanguage.French]: AccentType.French,
    [S2sLanguage.Kinyarwanda]: AccentType.African,
    [S2sLanguage.Swahili]: AccentType.African,
};
export class SpeechToSpeechGenerationAnalyzer {
    analyzeSpeech(input, context) {
        const language = input.language ?? this.detectLanguage(input, context);
        const durationMs = input.durationMs ?? 45000;
        const segments = this.buildSpeakerSegments(input, context, durationMs);
        const transcript = input.transcriptHint ?? context.transcriptHint ?? "";
        return {
            language,
            speakerSegments: segments,
            pronunciationNotes: `Pronunciation analysis for ${language} — accent ${input.sourceAccent ?? ACCENT_LANGUAGE_MAP[language] ?? AccentType.Neutral}`,
            accent: input.sourceAccent ?? ACCENT_LANGUAGE_MAP[language] ?? AccentType.Neutral,
            speakingRate: this.estimateSpeakingRate(durationMs, transcript),
            pitchRange: input.sourceVoiceType === VoiceType.Female ? "Mid-high (180-280 Hz)" : "Mid-low (85-180 Hz)",
            intonationPattern: "Natural declarative with question lift at segment boundaries",
            rhythmPattern: "Syllable-timed with stress on content words",
            detectedEmotion: input.sourceEmotion ?? EmotionType.Professional,
            backgroundNoiseLevel: "Low — studio-quality source assumed",
            silenceRatio: 0.12,
            audioQualityScore: 88,
            durationMs,
            keywords: this.extractKeywords(transcript, context),
            properNames: this.extractProperNames(transcript, context),
            technicalTerms: this.extractTechnicalTerms(transcript, context),
        };
    }
    buildProfile(input, platform, version, context, speechAnalysis) {
        const productId = context.productId ?? input.productId ?? "unknown-product";
        const sourceAudioId = input.sourceAudioId ?? `source-audio-${productId}-v${version}`;
        const transformationId = `s2s-transform-${productId}-${speechAnalysis.language}-${platform}-v${version}`;
        return {
            transformationId,
            sourceAudioId,
            projectId: input.projectId ?? context.projectId ?? `project-${productId}`,
            sourceVoiceId: input.sourceVoiceId ?? `source-voice-${productId}`,
            targetVoiceId: input.targetVoiceId ?? `target-voice-${productId}-${speechAnalysis.language}`,
            brandId: input.brandId ?? context.brandId ?? context.brandName ?? "unknown-brand",
            campaignId: input.campaignId ?? context.campaignId,
            language: speechAnalysis.language,
            platform,
            outputUseCase: input.outputUseCase ?? S2sOutputUseCase.VideoNarration,
            version,
        };
    }
    buildVoiceTransformation(input, context, speechAnalysis) {
        const industry = context.industry ?? "default";
        const sourceVoice = input.sourceVoiceType ?? INDUSTRY_VOICE_MAP[industry] ?? VoiceType.Narrator;
        const targetVoice = input.targetVoiceType ?? VoiceType.Professional;
        const brand = context.brandName ?? "brand";
        return {
            sourceVoiceType: sourceVoice,
            targetVoiceType: targetVoice,
            voiceMapping: {
                [sourceVoice]: targetVoice,
                pitch: speechAnalysis.pitchRange,
                rate: speechAnalysis.speakingRate,
            },
            accentAdaptation: `Adapt ${speechAnalysis.accent} accent to ${targetVoice} ${speechAnalysis.language} delivery`,
            pitchAdaptation: `Map source ${speechAnalysis.pitchRange} to target voice timbre while preserving intent`,
            speakingRateAdaptation: `Preserve relative pacing — source ${speechAnalysis.speakingRate}, target aligned to platform`,
            toneAdaptation: context.brandGuidelines ?? `Professional ${brand} tone with clarity`,
            emotionAdaptation: `Preserve ${speechAnalysis.detectedEmotion} emotional intent through voice mapping`,
            genderNeutralPlanning: targetVoice === VoiceType.Neutral ? "Gender-neutral delivery with balanced pitch contour" : "Not required",
            characterVoicePlanning: targetVoice === VoiceType.Character ? "Character voice mapping with distinct timbre separation" : "Standard voice mapping",
            brandVoiceAlignment: `Align transformed voice with ${brand} identity — ${targetVoice} execution`,
        };
    }
    buildEmotionPreservation(input, speechAnalysis) {
        const source = speechAnalysis.detectedEmotion;
        const target = input.sourceEmotion ?? source;
        return {
            sourceEmotion: source,
            targetEmotion: target,
            preservationScore: source === target ? 95 : 82,
            emotionMapping: { [source]: target },
            intensityPreservation: 75,
            emotionalArc: speechAnalysis.speakerSegments.map((s, i) => `Segment ${i + 1}: preserve ${s.emotion} through transformation`),
            sceneEmotionNotes: [
                `Maintain ${source} emotional intent across ${speechAnalysis.speakerSegments.length} segment(s)`,
                "Preserve speaker intent and emotional continuity",
            ],
        };
    }
    buildPronunciationAdaptation(speechAnalysis, context) {
        const dict = {};
        for (const name of speechAnalysis.properNames) {
            dict[name] = `${name} [preserve pronunciation — ${speechAnalysis.language}]`;
        }
        for (const term of speechAnalysis.technicalTerms) {
            dict[term] = `${term} [technical vocabulary — ${speechAnalysis.language}]`;
        }
        return {
            phonemeMapping: Object.fromEntries(speechAnalysis.properNames.map((n) => [n, `${n} phoneme chain preserved`])),
            pronunciationDictionary: dict,
            namePreservation: dict,
            technicalVocabulary: Object.fromEntries(speechAnalysis.technicalTerms.map((t) => [t, `${t} [adapted for ${speechAnalysis.language}]`])),
            acronymHandling: {},
            numberReadingRules: [
                "Preserve number pronunciation timing from source segments",
                "Maintain digit grouping pauses from original speech",
            ],
            dateReadingRules: ["Preserve locale date reading order from source analysis"],
        };
    }
    buildTimingPreservation(speechAnalysis) {
        return {
            speechTiming: `Preserve ${speechAnalysis.durationMs}ms total duration with segment-aligned mapping`,
            naturalPauses: [
                "Comma pause: 200ms (preserved from source)",
                "Period pause: 400ms (preserved from source)",
                "Segment boundary pause: 300ms",
            ],
            rhythmPreservation: speechAnalysis.rhythmPattern,
            sentenceBoundaries: speechAnalysis.speakerSegments.map((s) => `${s.segmentId}: ${s.startMs}-${s.endMs}ms`),
            breathPlanning: [
                "Preserve breath pauses at original segment boundaries",
                "Maintain natural breath rhythm from source audio",
            ],
            segmentTiming: speechAnalysis.speakerSegments.map((s) => ({
                segmentId: s.segmentId,
                startMs: s.startMs,
                endMs: s.endMs,
            })),
        };
    }
    buildPlatformOptimizations(profile, input) {
        const platforms = input.generatePlatformOptimizations !== false ? ALL_S2S_PLATFORMS : [profile.platform];
        return platforms.map((platform) => {
            const config = PLATFORM_S2S_CONFIG[platform];
            return {
                platform,
                speakingRate: config.speakingRate,
                pauseProfile: config.pauseProfile,
                emphasisStyle: platform === S2sPlatform.Television ? "broadcast-clear" : "natural-narrative",
                formatNotes: [
                    `Max duration: ${config.maxDurationSec}s`,
                    `Language: ${profile.language}`,
                    `Use case: ${profile.outputUseCase}`,
                ],
                optimizationNotes: [
                    `Optimize transformation for ${platform}`,
                    `Speaking rate: ${config.speakingRate}`,
                    `Pause profile: ${config.pauseProfile}`,
                ],
            };
        });
    }
    buildProductionInstructions(profile, timingPlan, voicePlan) {
        return {
            renderNotes: [
                `Execute ${profile.outputUseCase} speech transformation for ${profile.platform}`,
                voicePlan.voiceMapping[voicePlan.sourceVoiceType],
                timingPlan.speechTiming,
            ],
            segmentGuidance: [
                "Map each source segment to target voice with timing preservation",
                "Preserve non-destructive source audio reference",
                "Mark emphasis points for downstream rendering preparation",
            ],
            timingGuidance: timingPlan.naturalPauses,
            exportPreparation: [
                `Target platform: ${profile.platform}`,
                `Language locale: ${profile.language}`,
                "Prepare waveform metadata without final synthesis",
            ],
            qualityTargets: [
                "Preserve linguistic meaning from source speech",
                "Maintain emotion and timing fidelity",
                "Brand-consistent transformed voice delivery",
            ],
        };
    }
    buildRecommendations(speechAnalysis, emotionPlan, context) {
        const recs = [];
        if (speechAnalysis.silenceRatio > 0.2) {
            recs.push("High silence ratio detected — review segment boundaries");
        }
        if (speechAnalysis.properNames.length > 0) {
            recs.push("Verify proper name pronunciation preservation with brand team");
        }
        if (context.brandName) {
            recs.push(`Ensure ${context.brandName} brand voice in transformed delivery`);
        }
        if (emotionPlan.preservationScore < 90) {
            recs.push("Review emotion mapping for cross-voice fidelity");
        }
        recs.push("Validate timing preservation before render preparation");
        return recs;
    }
    resolvePlatform(input, context) {
        if (input.platform)
            return input.platform;
        if (context.creative?.profile.platform === "youtube")
            return S2sPlatform.YouTube;
        if (context.creative?.profile.platform === "tiktok")
            return S2sPlatform.TikTok;
        if (context.creative?.profile.platform === "instagram-reels")
            return S2sPlatform.Instagram;
        return S2sPlatform.Website;
    }
    extractContextFromInput(input) {
        return {
            productId: input.productId,
            brandName: input.brandName,
            brandId: input.brandId,
            brandGuidelines: input.brandGuidelines,
            projectId: input.projectId,
            campaignId: input.campaignId,
            transcriptHint: input.transcriptHint,
            sourceAudioRef: input.sourceAudioRef,
            industry: "general",
        };
    }
    extractContextFromProduct(productId, productName, brandName, understanding, creative, strategy, input) {
        return {
            productId,
            productName,
            brandName,
            brandId: input?.brandId ?? brandName,
            brandGuidelines: input?.brandGuidelines,
            projectId: input?.projectId ?? creative?.profile.projectId,
            campaignId: input?.campaignId ?? strategy?.relationships.campaigns[0],
            targetAudience: understanding?.customer.targetCustomer ?? creative?.profile.targetAudience,
            keyBenefit: understanding?.uniqueValue.keyBenefits[0],
            industry: understanding?.customer.targetIndustry ?? "general",
            transcriptHint: input?.transcriptHint,
            sourceAudioRef: input?.sourceAudioRef,
            creative,
            strategy,
            understanding,
        };
    }
    buildSpeakerSegments(input, context, durationMs) {
        const transcript = input.transcriptHint ?? context.transcriptHint ?? "Sample spoken content for transformation";
        const sentences = transcript.split(/[.!?]+/).filter((s) => s.trim().length > 0);
        const segmentDuration = Math.floor(durationMs / Math.max(sentences.length, 1));
        return sentences.map((sentence, i) => ({
            segmentId: `seg-${i + 1}`,
            startMs: i * segmentDuration,
            endMs: (i + 1) * segmentDuration,
            speakerLabel: `speaker-${(i % 2) + 1}`,
            transcriptHint: sentence.trim().slice(0, 80),
            emotion: input.sourceEmotion ?? EmotionType.Professional,
        }));
    }
    detectLanguage(input, context) {
        if (input.language)
            return input.language;
        const text = input.transcriptHint ?? context.transcriptHint ?? "";
        if (/\b(murakoze|amakuru)\b/i.test(text))
            return S2sLanguage.Kinyarwanda;
        if (/\b(bonjour|merci)\b/i.test(text))
            return S2sLanguage.French;
        if (/\b(asante|habari|karibu)\b/i.test(text))
            return S2sLanguage.Swahili;
        return S2sLanguage.English;
    }
    estimateSpeakingRate(durationMs, transcript) {
        const words = transcript.split(/\s+/).filter(Boolean).length || 50;
        const minutes = durationMs / 60000;
        const wpm = Math.round(words / Math.max(minutes, 0.5));
        return `${wpm} wpm`;
    }
    extractKeywords(transcript, context) {
        const words = transcript.toLowerCase().split(/\W+/).filter((w) => w.length > 4);
        const keywords = [...new Set(words)].slice(0, 8);
        if (context.productName)
            keywords.unshift(context.productName.toLowerCase());
        if (context.brandName)
            keywords.unshift(context.brandName.toLowerCase());
        return [...new Set(keywords)].slice(0, 10);
    }
    extractProperNames(transcript, context) {
        const names = [];
        if (context.brandName)
            names.push(context.brandName);
        if (context.productName)
            names.push(context.productName);
        const capitalized = [...transcript.matchAll(/\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)?\b/g)].map((m) => m[0]);
        return [...new Set([...names, ...capitalized])].slice(0, 10);
    }
    extractTechnicalTerms(transcript, context) {
        const terms = [];
        if (context.industry === "technology")
            terms.push("AI", "API");
        const matches = [...transcript.matchAll(/\b(?:AI|API|SaaS|TTS|SDK)\b/gi)].map((m) => m[0]);
        return [...new Set([...terms, ...matches])].slice(0, 8);
    }
}
//# sourceMappingURL=speech-to-speech-generation-analyzer.js.map