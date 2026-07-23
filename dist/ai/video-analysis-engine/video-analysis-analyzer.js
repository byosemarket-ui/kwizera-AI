import { AudioCodec, FrameRateMode, VideoAnalysisType, VideoColorSpace, VideoContainer, VideoFileFormat, VideoOrientation, VideoCodec, } from "./types.js";
const TYPE_DEFAULTS = {
    [VideoAnalysisType.Advertisement]: {
        category: "marketing",
        subcategory: "advertisement",
        creativeStyle: "promotional",
        useCase: "paid-media",
    },
    [VideoAnalysisType.Commercial]: {
        category: "marketing",
        subcategory: "commercial",
        creativeStyle: "commercial",
        useCase: "broadcast",
    },
    [VideoAnalysisType.ProductShowcase]: {
        category: "commerce",
        subcategory: "product-demo",
        creativeStyle: "commercial",
        useCase: "product-launch",
    },
    [VideoAnalysisType.Tutorial]: {
        category: "education",
        subcategory: "how-to",
        creativeStyle: "instructional",
        useCase: "training",
    },
    [VideoAnalysisType.SocialMedia]: {
        category: "social",
        subcategory: "short-form",
        creativeStyle: "engaging",
        useCase: "social-feed",
    },
    [VideoAnalysisType.Documentary]: {
        category: "documentary",
        subcategory: "feature",
        creativeStyle: "cinematic",
        useCase: "storytelling",
    },
    [VideoAnalysisType.Presentation]: {
        category: "corporate",
        subcategory: "presentation",
        creativeStyle: "professional",
        useCase: "business",
    },
    [VideoAnalysisType.Interview]: {
        category: "corporate",
        subcategory: "interview",
        creativeStyle: "conversational",
        useCase: "thought-leadership",
    },
    [VideoAnalysisType.Animation]: {
        category: "creative",
        subcategory: "animation",
        creativeStyle: "animated",
        useCase: "motion-graphics",
    },
    [VideoAnalysisType.Corporate]: {
        category: "corporate",
        subcategory: "brand",
        creativeStyle: "professional",
        useCase: "brand-communication",
    },
    [VideoAnalysisType.Other]: {
        category: "general",
        subcategory: "uncategorized",
        creativeStyle: "standard",
        useCase: "general-purpose",
    },
};
export class VideoAnalysisAnalyzer {
    analyze(input) {
        const videoName = input.videoName ?? "Unnamed Video";
        const filePath = input.filePath ?? "";
        const width = input.width ?? 0;
        const height = input.height ?? 0;
        const durationMs = input.durationMs ?? 0;
        const fps = input.fps ?? 30;
        const fileFormat = input.fileFormat ?? this.inferFormat(filePath);
        const aspectRatio = width > 0 && height > 0 ? this.computeAspectRatio(width, height) : "unknown";
        const orientation = this.computeOrientation(width, height);
        const technical = {
            videoName,
            videoId: input.videoId ?? "",
            filePath,
            fileFormat,
            container: input.container ?? this.inferContainer(fileFormat),
            videoCodec: input.videoCodec ?? VideoCodec.H264,
            videoCodecProfile: input.videoCodecProfile ?? "high",
            audioCodec: input.audioCodec ?? AudioCodec.AAC,
            fileSizeBytes: input.fileSizeBytes ?? 0,
            durationMs,
            resolution: width > 0 && height > 0 ? `${width}x${height}` : "unknown",
            width,
            height,
            aspectRatio,
            orientation,
            fps,
            frameRateMode: input.frameRateMode ?? FrameRateMode.Constant,
            bitrateKbps: input.bitrateKbps ?? this.estimateBitrate(input.fileSizeBytes ?? 0, durationMs),
            hdrSupported: input.hdrSupported ?? false,
            colorSpace: input.colorSpace ?? VideoColorSpace.Rec709,
            metadata: input.metadata ?? {},
            creationDate: input.creationDate,
            lastModifiedDate: input.lastModifiedDate,
        };
        const totalFrames = durationMs > 0 && fps > 0 ? Math.round((durationMs / 1000) * fps) : 0;
        const keyFrames = input.frame?.keyFrames ?? Math.max(1, Math.round(totalFrames / (fps * 2)));
        const frame = {
            totalFrames,
            keyFrames,
            averageFrameIntervalMs: fps > 0 ? Math.round(1000 / fps) : 0,
            frameConsistencyScore: input.frame?.frameConsistencyScore ?? 88,
            missingFrames: input.frame?.missingFrames ?? 0,
            duplicateFrames: input.frame?.duplicateFrames ?? 0,
            corruptedFrames: input.frame?.corruptedFrames ?? 0,
            sceneChangeCandidates: input.frame?.sceneChangeCandidates ?? (input.sceneCount ?? 3),
            motionDensity: input.frame?.motionDensity ?? 55,
            visualComplexity: input.frame?.visualComplexity ?? 62,
        };
        const sceneCount = input.sceneCount ?? input.timeline?.sceneCount ?? 3;
        const shotCount = input.shotCount ?? input.timeline?.shotCount ?? Math.max(sceneCount, 5);
        const segments = this.buildTimelineSegments(durationMs, sceneCount, shotCount, input);
        const timeline = {
            timelineLengthMs: durationMs,
            sceneCount,
            shotCount,
            frameDistribution: input.timeline?.frameDistribution ?? {
                intro: Math.round(totalFrames * 0.15),
                body: Math.round(totalFrames * 0.7),
                outro: Math.round(totalFrames * 0.15),
            },
            segments,
            sceneDistribution: input.timeline?.sceneDistribution ?? this.distributeScenes(sceneCount),
            shotDistribution: input.timeline?.shotDistribution ?? this.distributeShots(shotCount),
        };
        const audioTracks = input.audio?.tracks ??
            [
                {
                    trackId: "audio-primary",
                    trackName: "Primary Audio",
                    language: input.language ?? "en",
                    sampleRate: 48000,
                    channels: 2,
                    loudnessDb: -14,
                    dynamicRangeDb: 12,
                    audioQualityScore: 82,
                    syncOffsetMs: 0,
                    silenceSegments: 1,
                },
            ];
        const audio = {
            tracks: audioTracks,
            primaryLanguage: input.language ?? audioTracks[0]?.language ?? "en",
            synchronizationScore: input.audio?.synchronizationScore ?? 92,
            overallAudioQualityScore: input.audio?.overallAudioQualityScore ??
                Math.round(audioTracks.reduce((s, t) => s + t.audioQualityScore, 0) / Math.max(audioTracks.length, 1)),
        };
        const visual = {
            brightness: input.visual?.brightness ?? 68,
            contrast: input.visual?.contrast ?? 72,
            saturation: input.visual?.saturation ?? 65,
            sharpness: input.visual?.sharpness ?? 78,
            noise: input.visual?.noise ?? 12,
            whiteBalance: input.visual?.whiteBalance ?? 70,
            exposure: input.visual?.exposure ?? 68,
            dynamicRange: input.visual?.dynamicRange ?? 75,
            dominantColors: input.visual?.dominantColors ?? this.inferDominantColors(input),
            visualStability: input.visual?.visualStability ?? 80,
        };
        const videoType = input.videoType ?? this.classifyVideoType(input);
        const defaults = TYPE_DEFAULTS[videoType];
        const classification = {
            videoType,
            category: input.category ?? defaults.category,
            subcategory: input.subcategory ?? defaults.subcategory,
            creativeStyle: input.creativeStyle ?? defaults.creativeStyle,
            useCase: input.useCase ?? defaults.useCase,
        };
        return { technical, frame, timeline, audio, visual, classification };
    }
    inferFormat(filePath) {
        const ext = filePath.split(".").pop()?.toLowerCase();
        const map = {
            mp4: VideoFileFormat.MP4,
            mov: VideoFileFormat.MOV,
            avi: VideoFileFormat.AVI,
            mkv: VideoFileFormat.MKV,
            webm: VideoFileFormat.WebM,
            mpeg: VideoFileFormat.MPEG,
            mpg: VideoFileFormat.MPEG,
        };
        return ext && map[ext] ? map[ext] : VideoFileFormat.Other;
    }
    inferContainer(format) {
        const map = {
            [VideoFileFormat.MP4]: VideoContainer.MP4,
            [VideoFileFormat.MOV]: VideoContainer.QuickTime,
            [VideoFileFormat.MKV]: VideoContainer.Matroska,
            [VideoFileFormat.WebM]: VideoContainer.WebM,
            [VideoFileFormat.AVI]: VideoContainer.AVI,
        };
        return map[format] ?? VideoContainer.Other;
    }
    estimateBitrate(fileSizeBytes, durationMs) {
        if (fileSizeBytes <= 0 || durationMs <= 0)
            return 5000;
        return Math.round((fileSizeBytes * 8) / durationMs);
    }
    computeAspectRatio(width, height) {
        const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
        const d = gcd(width, height);
        return `${width / d}:${height / d}`;
    }
    computeOrientation(width, height) {
        if (width === height)
            return VideoOrientation.Square;
        return width > height ? VideoOrientation.Landscape : VideoOrientation.Portrait;
    }
    classifyVideoType(input) {
        if (input.videoType)
            return input.videoType;
        const name = (input.videoName ?? "").toLowerCase();
        const path = (input.filePath ?? "").toLowerCase();
        if (name.includes("tutorial") || path.includes("tutorial"))
            return VideoAnalysisType.Tutorial;
        if (name.includes("social") || path.includes("reels") || path.includes("tiktok"))
            return VideoAnalysisType.SocialMedia;
        if (name.includes("commercial") || path.includes("commercial"))
            return VideoAnalysisType.Commercial;
        if (name.includes("product") || input.product)
            return VideoAnalysisType.ProductShowcase;
        if (name.includes("interview"))
            return VideoAnalysisType.Interview;
        if (name.includes("presentation"))
            return VideoAnalysisType.Presentation;
        if (name.includes("documentary"))
            return VideoAnalysisType.Documentary;
        if (name.includes("animation") || name.includes("animated"))
            return VideoAnalysisType.Animation;
        if (name.includes("corporate") || name.includes("brand"))
            return VideoAnalysisType.Corporate;
        if (input.campaign || name.includes("ad") || name.includes("campaign"))
            return VideoAnalysisType.Advertisement;
        return VideoAnalysisType.Other;
    }
    inferDominantColors(input) {
        if (input.visual?.dominantColors?.length)
            return input.visual.dominantColors;
        if (input.brand?.toLowerCase().includes("kwizera"))
            return ["#1a1a2e", "#e94560", "#ffffff"];
        return ["#2d3436", "#636e72", "#dfe6e9"];
    }
    buildTimelineSegments(durationMs, sceneCount, shotCount, input) {
        if (input.timeline?.segments?.length)
            return input.timeline.segments;
        const segments = [];
        const sceneDuration = durationMs > 0 ? Math.floor(durationMs / sceneCount) : 0;
        for (let i = 0; i < sceneCount; i++) {
            segments.push({
                segmentId: `scene-${i + 1}`,
                startMs: i * sceneDuration,
                endMs: i === sceneCount - 1 ? durationMs : (i + 1) * sceneDuration,
                label: `Scene ${i + 1}`,
                type: "scene",
            });
        }
        const shotDuration = durationMs > 0 ? Math.floor(durationMs / shotCount) : 0;
        for (let i = 0; i < Math.min(shotCount, 5); i++) {
            segments.push({
                segmentId: `shot-${i + 1}`,
                startMs: i * shotDuration,
                endMs: i === shotCount - 1 ? durationMs : (i + 1) * shotDuration,
                label: `Shot ${i + 1}`,
                type: "shot",
            });
        }
        return segments;
    }
    distributeScenes(count) {
        const dist = {};
        for (let i = 1; i <= count; i++)
            dist[`scene-${i}`] = Math.round(100 / count);
        return dist;
    }
    distributeShots(count) {
        const dist = {};
        for (let i = 1; i <= count; i++)
            dist[`shot-${i}`] = Math.round(100 / count);
        return dist;
    }
}
//# sourceMappingURL=video-analysis-analyzer.js.map