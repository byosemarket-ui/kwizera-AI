import { VideoIndexType } from "../video-intelligence-foundation/types.js";
import { TrackType } from "./types.js";
export class TimelineIntelligenceIndexer {
    foundation;
    constructor(foundation) {
        this.foundation = foundation;
    }
    createIndexes(record, projectId) {
        const project = projectId ?? record.relationships.relatedProjects[0] ?? "default-project";
        const frameIndex = this.foundation.getFrameIndexManager();
        const indexes = {
            timelineIndexIds: [],
            sceneIndexIds: [],
            shotIndexIds: [],
            trackIndexIds: [],
            syncIndexIds: [],
        };
        const timelineEntry = frameIndex.indexTimeline(project, record.videoId, record.timelineId);
        indexes.timelineIndexIds.push(timelineEntry.indexId);
        for (const variant of record.variants) {
            if (variant.timelineId !== record.timelineId) {
                const variantEntry = frameIndex.indexTimeline(project, record.videoId, variant.timelineId);
                indexes.timelineIndexIds.push(variantEntry.indexId);
            }
        }
        for (const scene of record.sceneSequence) {
            const sceneEntry = frameIndex.indexScene(project, record.videoId, scene.sceneId, scene.startMs, scene.endMs, timelineEntry.timelineId);
            indexes.sceneIndexIds.push(sceneEntry.indexId);
        }
        for (const shot of record.shotSequence) {
            const shotEntry = frameIndex.indexShot(project, record.videoId, shot.shotId, shot.sceneId, shot.startMs);
            indexes.shotIndexIds.push(shotEntry.indexId);
        }
        for (const track of record.tracks) {
            const trackEntry = frameIndex.indexEntry({
                indexType: VideoIndexType.Sequence,
                projectId: project,
                videoId: record.videoId,
                label: `track-${track.trackId}`,
                timelineId: timelineEntry.timelineId,
                relationshipLinks: [track.trackId, track.trackType, record.videoId],
            });
            indexes.trackIndexIds.push(trackEntry.indexId);
        }
        const syncEntry = frameIndex.indexEntry({
            indexType: VideoIndexType.Sequence,
            projectId: project,
            videoId: record.videoId,
            label: `sync-${record.timelineId}`,
            timelineId: timelineEntry.timelineId,
            relationshipLinks: [
                record.timelineId,
                String(record.synchronization.overallSyncScore),
                ...record.tracks.filter((t) => t.trackType === TrackType.Audio).map((t) => t.trackId),
            ],
        });
        indexes.syncIndexIds.push(syncEntry.indexId);
        return indexes;
    }
}
//# sourceMappingURL=timeline-intelligence-indexer.js.map