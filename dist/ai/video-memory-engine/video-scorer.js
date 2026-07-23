export class VideoScorer {
    computeScores(video) {
        const sceneCount = video.scenes?.length ?? 0;
        const hasMarketing = Boolean(video.marketing?.hook && video.marketing?.callToAction);
        const hasAudio = Boolean(video.audio?.backgroundMusic || video.audio?.narration);
        const hasVisual = Boolean(video.visual?.colorPalette?.length && video.visual?.motionStyle);
        const exportCount = video.exportHistory?.length ?? 0;
        const satisfaction = video.scores?.userSatisfaction ?? 0;
        const videoQualityScore = Math.min(100, 30 +
            sceneCount * 8 +
            (hasAudio ? 15 : 0) +
            (hasVisual ? 15 : 0) +
            (video.resolution ? 10 : 0));
        const marketingScore = Math.min(100, (hasMarketing ? 50 : 20) +
            (video.marketing?.sellingPoints?.length ?? 0) * 10 +
            (video.marketingGoal ? 15 : 0));
        const learningScore = Math.min(100, (video.lessonsLearned?.length ?? 0) * 15 +
            (video.patterns?.length ?? 0) * 10 +
            (video.strengths?.length ?? 0) * 8);
        const exportQuality = exportCount > 0 ? 85 : 40;
        const aiConfidenceScore = Math.round((videoQualityScore + marketingScore + learningScore + exportQuality) / 4);
        return {
            videoQualityScore,
            marketingScore,
            aiConfidenceScore,
            learningScore,
            userSatisfaction: satisfaction,
            exportQuality,
        };
    }
}
//# sourceMappingURL=video-scorer.js.map