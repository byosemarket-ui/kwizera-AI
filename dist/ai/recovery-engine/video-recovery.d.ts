import { RecoveryEngineLogger } from "./recovery-logger.js";
import { VideoRecoveryContext } from "./types.js";
export declare class VideoRecovery {
    private readonly logger;
    constructor(logger: RecoveryEngineLogger);
    buildRecoveryContext(videoId: string, metadata?: Record<string, unknown>): VideoRecoveryContext;
    findInterruptedVideos(tasks: Record<string, {
        id: string;
        state: string;
        metadata?: Record<string, unknown>;
    }>): VideoRecoveryContext[];
}
//# sourceMappingURL=video-recovery.d.ts.map