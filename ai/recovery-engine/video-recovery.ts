import { RecoveryEngineLogger } from "./recovery-logger.js";
import { VideoRecoveryContext } from "./types.js";

export class VideoRecovery {
  constructor(private readonly logger: RecoveryEngineLogger) {}

  buildRecoveryContext(
    videoId: string,
    metadata?: Record<string, unknown>
  ): VideoRecoveryContext {
    const progressPercent = (metadata?.progressPercent as number) ?? 0;
    const completedSegments = (metadata?.completedSegments as string[]) ?? [];

    const context: VideoRecoveryContext = {
      videoId,
      progressPercent,
      completedSegments,
      resumeFromSegment:
        completedSegments.length > 0
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

  findInterruptedVideos(
    tasks: Record<string, { id: string; state: string; metadata?: Record<string, unknown> }>
  ): VideoRecoveryContext[] {
    const contexts: VideoRecoveryContext[] = [];

    for (const [, task] of Object.entries(tasks)) {
      const taskType = task.metadata?.taskType as string | undefined;
      if (
        (taskType === "video-generation" || task.metadata?.videoId) &&
        (task.state === "running" || task.state === "recovered" || task.state === "retrying")
      ) {
        contexts.push(
          this.buildRecoveryContext(
            (task.metadata?.videoId as string) ?? task.id,
            task.metadata
          )
        );
      }
    }

    return contexts;
  }
}
