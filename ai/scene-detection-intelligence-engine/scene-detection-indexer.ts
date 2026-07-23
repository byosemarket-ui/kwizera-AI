import type { AiVideoIntelligenceFoundation } from "../video-intelligence-foundation/video-intelligence-foundation.js";
import { VideoIndexType } from "../video-intelligence-foundation/types.js";
import { SceneDetectionIndexes, SceneDetectionRecord } from "./types.js";

export class SceneDetectionIndexer {
  constructor(private readonly foundation: AiVideoIntelligenceFoundation) {}

  createIndexes(record: SceneDetectionRecord, projectId?: string): SceneDetectionIndexes {
    const project = projectId ?? record.relationships.relatedProjects[0] ?? "default-project";
    const frameIndex = this.foundation.getFrameIndexManager();
    const indexes: SceneDetectionIndexes = {
      sceneIndexIds: [],
      shotIndexIds: [],
      transitionIndexIds: [],
      timelineIndexIds: [],
      keyframeIndexIds: [],
    };

    const timelineEntry = frameIndex.indexTimeline(project, record.videoId, `timeline-${record.videoId}`);
    indexes.timelineIndexIds.push(timelineEntry.indexId);

    for (const scene of record.scenes) {
      const sceneEntry = frameIndex.indexScene(
        project,
        record.videoId,
        scene.sceneId,
        scene.startMs,
        scene.endMs,
        timelineEntry.timelineId
      );
      indexes.sceneIndexIds.push(sceneEntry.indexId);
    }

    for (const shot of record.shots) {
      const shotEntry = frameIndex.indexShot(
        project,
        record.videoId,
        shot.shotId,
        shot.sceneId,
        shot.startMs
      );
      indexes.shotIndexIds.push(shotEntry.indexId);
    }

    for (const transition of record.transitions) {
      const transitionEntry = frameIndex.indexEntry({
        indexType: VideoIndexType.Sequence,
        projectId: project,
        videoId: record.videoId,
        label: `transition-${transition.transitionId}`,
        timecodeMs: transition.startMs,
        sceneId: transition.fromSceneId,
        timelineId: timelineEntry.timelineId,
        relationshipLinks: [
          transition.transitionId,
          transition.fromSceneId,
          transition.toSceneId,
        ],
      });
      indexes.transitionIndexIds.push(transitionEntry.indexId);
    }

    const fps = record.shots.length > 0 ? 30 : 30;
    for (const scene of record.scenes) {
      const keyframeMs = scene.startMs;
      const frameNum = Math.round((keyframeMs / 1000) * fps);
      const kfEntry = frameIndex.indexFrame(project, record.videoId, frameNum, keyframeMs, {
        keyframe: true,
        sceneId: scene.sceneId,
        timelineId: timelineEntry.timelineId,
      });
      indexes.keyframeIndexIds.push(kfEntry.indexId);
    }

    return indexes;
  }
}
