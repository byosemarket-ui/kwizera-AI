export class VideoRecovery {
    logger;
    constructor(logger) {
        this.logger = logger;
    }
    buildRecoveryContext(videoId, metadata) {
        const progressPercent = metadata?.progressPercent ?? 0;
        const completedSegments = metadata?.completedSegments ?? [];
        const context = {
            videoId,
            progressPercent,
            completedSegments,
            resumeFromSegment: completedSegments.length > 0
                ? completedSegments[completedSegments.length - 1]
                : undefined,
        };
        this.logger.log("info", "recovery-attempt", `Video recovery context: ${videoId}`, {
            progressPercent,
            segments: completedSegments.length,
            resume: context.resumeFromSegment ?? "start",
        });
        return context;
    }
    findInterruptedVideos(tasks) {
        const contexts = [];
        for (const [, task] of Object.entries(tasks)) {
            const taskType = task.metadata?.taskType;
            if ((taskType === "video-generation" || task.metadata?.videoId) &&
                (task.state === "running" || task.state === "recovered" || task.state === "retrying")) {
                contexts.push(this.buildRecoveryContext(task.metadata?.videoId ?? task.id, task.metadata));
            }
        }
        return contexts;
    }
}
//# sourceMappingURL=video-recovery.js.map