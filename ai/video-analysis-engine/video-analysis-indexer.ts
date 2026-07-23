import type { AiVideoIntelligenceFoundation } from "../video-intelligence-foundation/video-intelligence-foundation.js";
import { VideoIndexType } from "../video-intelligence-foundation/types.js";
import {
  VideoAnalysisIndexes,
  VideoAnalysisIntelligenceRecord,
} from "./types.js";

export class VideoAnalysisIndexer {
  constructor(private readonly foundation: AiVideoIntelligenceFoundation) {}

  createIndexes(
    record: VideoAnalysisIntelligenceRecord,
    projectId?: string
  ): VideoAnalysisIndexes {
    const start = Date.now();
    const project = projectId ?? record.relationships.relatedProjects[0] ?? "default-project";
    const frameIndex = this.foundation.getFrameIndexManager();
    const indexes: VideoAnalysisIndexes = {
      frameIndexIds: [],
      keyframeIndexIds: [],
      timelineIndexIds: [],
      sceneIndexIds: [],
      audioIndexIds: [],
      metadataIndexIds: [],
    };

    const timelineEntry = frameIndex.indexTimeline(project, record.videoId, `timeline-${record.videoId}`);
    indexes.timelineIndexIds.push(timelineEntry.indexId);

    for (const segment of record.timeline.segments) {
      if (segment.type === "scene") {
        const sceneEntry = frameIndex.indexScene(
          project,
          record.videoId,
          segment.segmentId,
          segment.startMs,
          segment.endMs,
          timelineEntry.timelineId
        );
        indexes.sceneIndexIds.push(sceneEntry.indexId);
      } else if (segment.type === "shot") {
        const shotEntry = frameIndex.indexShot(
          project,
          record.videoId,
          segment.segmentId,
          segment.segmentId.replace("shot", "scene-1"),
          segment.startMs
        );
        indexes.frameIndexIds.push(shotEntry.indexId);
      }
    }

    const keyframeInterval = Math.max(1, Math.floor(record.frame.totalFrames / Math.max(record.frame.keyFrames, 1)));
    for (let i = 0; i < record.frame.keyFrames; i++) {
      const frameNum = i * keyframeInterval;
      const timecodeMs = Math.round((frameNum / record.technical.fps) * 1000);
      const kfEntry = frameIndex.indexFrame(project, record.videoId, frameNum, timecodeMs, {
        keyframe: true,
        timelineId: timelineEntry.timelineId,
      });
      indexes.keyframeIndexIds.push(kfEntry.indexId);
    }

    if (record.frame.totalFrames > 0) {
      const midFrame = Math.floor(record.frame.totalFrames / 2);
      const midEntry = frameIndex.indexFrame(
        project,
        record.videoId,
        midFrame,
        Math.round((midFrame / record.technical.fps) * 1000),
        { timelineId: timelineEntry.timelineId }
      );
      indexes.frameIndexIds.push(midEntry.indexId);
    }

    frameIndex.indexSequence(project, record.videoId, `seq-${record.videoId}`);

    for (const track of record.audio.tracks) {
      const audioEntry = frameIndex.indexEntry({
        indexType: VideoIndexType.Timeline,
        projectId: project,
        videoId: record.videoId,
        label: `audio-${track.trackId}`,
        relationshipLinks: [track.trackId, record.videoId],
      });
      indexes.audioIndexIds.push(audioEntry.indexId);
    }

    const metaEntry = frameIndex.indexEntry({
      indexType: VideoIndexType.Sequence,
      projectId: project,
      videoId: record.videoId,
      label: `metadata-${record.videoId}`,
      relationshipLinks: [record.analysisId, record.videoId],
    });
    indexes.metadataIndexIds.push(metaEntry.indexId);

    void start;
    return indexes;
  }
}
