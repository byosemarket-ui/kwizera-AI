import type { VideoAnalysisIntelligenceRecord } from "../video-analysis-engine/types.js";
import { VideoAnalysisType } from "../video-analysis-engine/types.js";
import type { SceneDetectionRecord } from "../scene-detection-intelligence-engine/types.js";
import type { VideoUnderstandingRecord } from "../video-understanding-engine/types.js";
import {
  SceneSequenceEntry,
  ShotSequenceEntry,
  SynchronizationState,
  TimelineDependency,
  TimelineHierarchy,
  TimelineIntelligenceInput,
  TimelineOptimization,
  TimelineRecommendation,
  TimelineSection,
  TimelineTrack,
  TimelineVariant,
  TrackType,
  VariantTimeline,
} from "./types.js";

const DEFAULT_VARIANTS: TimelineVariant[] = [
  TimelineVariant.Main,
  TimelineVariant.ShortVersion,
  TimelineVariant.Trailer,
  TimelineVariant.Teaser,
  TimelineVariant.SocialMedia,
];

export class TimelineIntelligenceAnalyzer {
  analyze(
    analysis: VideoAnalysisIntelligenceRecord,
    sceneDetection: SceneDetectionRecord,
    understanding: VideoUnderstandingRecord | null | undefined,
    input: TimelineIntelligenceInput
  ): {
    timelineId: string;
    sections: TimelineSection[];
    hierarchy: TimelineHierarchy;
    dependencies: TimelineDependency[];
    sceneSequence: SceneSequenceEntry[];
    shotSequence: ShotSequenceEntry[];
    tracks: TimelineTrack[];
    synchronization: SynchronizationState;
    optimization: TimelineOptimization;
    variants: VariantTimeline[];
    recommendations: TimelineRecommendation[];
    keywords: string[];
    editingReadiness: number;
    renderingReadiness: number;
  } {
    const timelineId = `timeline-${input.videoId}`;
    const durationMs = analysis.technical.durationMs;
    const variants = this.buildVariants(
      timelineId,
      durationMs,
      sceneDetection,
      input.variants ?? DEFAULT_VARIANTS,
      input.platform
    );

    const sections = this.buildSections(sceneDetection, durationMs);
    const sceneSequence = this.buildSceneSequence(sceneDetection);
    const shotSequence = this.buildShotSequence(sceneDetection);
    const tracks = this.buildTracks(analysis, sceneDetection, durationMs);
    const dependencies = this.buildDependencies(sceneSequence, shotSequence, tracks);
    const hierarchy: TimelineHierarchy = {
      levels: ["timeline", "sections", "scenes", "shots", "tracks"],
      rootTimelineId: timelineId,
      childTimelineIds: variants.filter((v) => v.variant !== TimelineVariant.Main).map((v) => v.timelineId),
    };

    const synchronization = this.buildSynchronization(analysis, sceneDetection);
    const optimization = this.buildOptimization(
      analysis,
      sceneDetection,
      understanding,
      synchronization,
      tracks
    );
    const recommendations = this.buildRecommendations(
      analysis,
      sceneDetection,
      synchronization,
      optimization,
      tracks
    );

    const editingReadiness = Math.round(
      (optimization.timelineFlowScore + optimization.sceneContinuityScore + synchronization.overallSyncScore) / 3
    );
    const renderingReadiness = Math.round(
      (optimization.renderingEfficiencyScore +
        analysis.productionReadiness.renderingReadiness +
        optimization.trackAlignmentScore) /
        3
    );

    const keywords = [
      ...analysis.keywords,
      timelineId,
      ...variants.map((v) => v.variant),
      ...tracks.map((t) => t.trackType),
      input.platform ?? "multi-platform",
    ].filter(Boolean);

    return {
      timelineId,
      sections,
      hierarchy,
      dependencies,
      sceneSequence,
      shotSequence,
      tracks,
      synchronization,
      optimization,
      variants,
      recommendations,
      keywords,
      editingReadiness,
      renderingReadiness,
    };
  }

  private buildSections(sceneDetection: SceneDetectionRecord, durationMs: number): TimelineSection[] {
    const third = Math.floor(durationMs / 3);
    const introScenes = sceneDetection.scenes.filter((s) => s.order <= 2).map((s) => s.sceneId);
    const bodyScenes = sceneDetection.scenes
      .filter((s) => s.order > 2 && s.order < sceneDetection.sceneCount)
      .map((s) => s.sceneId);
    const outroScenes = sceneDetection.scenes
      .filter((s) => s.order === sceneDetection.sceneCount)
      .map((s) => s.sceneId);

    return [
      {
        sectionId: "section-intro",
        title: "Introduction",
        startMs: 0,
        endMs: third,
        durationMs: third,
        sceneIds: introScenes.length ? introScenes : [sceneDetection.scenes[0]?.sceneId ?? "scene-1"],
        order: 1,
      },
      {
        sectionId: "section-body",
        title: "Main Content",
        startMs: third,
        endMs: third * 2,
        durationMs: third,
        sceneIds: bodyScenes.length ? bodyScenes : sceneDetection.scenes.map((s) => s.sceneId),
        order: 2,
      },
      {
        sectionId: "section-outro",
        title: "Conclusion",
        startMs: third * 2,
        endMs: durationMs,
        durationMs: durationMs - third * 2,
        sceneIds: outroScenes.length
          ? outroScenes
          : [sceneDetection.scenes[sceneDetection.scenes.length - 1]?.sceneId ?? "scene-1"],
        order: 3,
      },
    ];
  }

  private buildSceneSequence(sceneDetection: SceneDetectionRecord): SceneSequenceEntry[] {
    return sceneDetection.scenes.map((scene) => {
      const rel = sceneDetection.sceneRelationships.find((r) => r.sceneId === scene.sceneId);
      return {
        sceneId: scene.sceneId,
        order: scene.order,
        startMs: scene.startMs,
        endMs: scene.endMs,
        durationMs: scene.durationMs,
        priority: scene.priority,
        dependencies: rel?.previousSceneId ? [rel.previousSceneId] : [],
        relatedSceneIds: rel?.relatedSceneIds ?? [],
      };
    });
  }

  private buildShotSequence(sceneDetection: SceneDetectionRecord): ShotSequenceEntry[] {
    const groups = new Map<string, string[]>();
    for (const shot of sceneDetection.shots) {
      const group = groups.get(shot.sceneId) ?? [];
      group.push(shot.shotId);
      groups.set(shot.sceneId, group);
    }

    return sceneDetection.shots.map((shot, i) => ({
      shotId: shot.shotId,
      sceneId: shot.sceneId,
      order: i + 1,
      startMs: shot.startMs,
      endMs: shot.endMs,
      durationMs: shot.durationMs,
      shotGroup: `group-${shot.sceneId}`,
      relatedShotIds: [
        shot.previousShotId,
        shot.nextShotId,
        ...(groups.get(shot.sceneId)?.filter((id) => id !== shot.shotId) ?? []),
      ].filter((id): id is string => Boolean(id)),
    }));
  }

  private buildTracks(
    analysis: VideoAnalysisIntelligenceRecord,
    sceneDetection: SceneDetectionRecord,
    durationMs: number
  ): TimelineTrack[] {
    const tracks: TimelineTrack[] = [
      {
        trackId: `track-video-primary-${analysis.videoId}`,
        trackType: TrackType.Video,
        label: "Primary Video",
        startMs: 0,
        endMs: durationMs,
        muted: false,
        locked: false,
        clipCount: sceneDetection.sceneCount,
      },
    ];

    for (const audioTrack of analysis.audio.tracks) {
      tracks.push({
        trackId: `track-audio-${audioTrack.trackId}`,
        trackType: TrackType.Audio,
        label: audioTrack.trackName,
        startMs: 0,
        endMs: durationMs,
        muted: false,
        locked: false,
        clipCount: 1,
      });
    }

    if (analysis.audio.tracks.length > 0) {
      tracks.push({
        trackId: `track-voice-${analysis.videoId}`,
        trackType: TrackType.Voice,
        label: "Voice / Narration",
        startMs: 0,
        endMs: durationMs,
        muted: false,
        locked: false,
        clipCount: sceneDetection.sceneCount,
      });
    }

    tracks.push(
      {
        trackId: `track-subtitle-${analysis.videoId}`,
        trackType: TrackType.Subtitle,
        label: "Subtitles",
        startMs: 0,
        endMs: durationMs,
        muted: false,
        locked: false,
        clipCount: sceneDetection.sceneCount,
      },
      {
        trackId: `track-caption-${analysis.videoId}`,
        trackType: TrackType.Caption,
        label: "Captions",
        startMs: 0,
        endMs: durationMs,
        muted: false,
        locked: false,
        clipCount: sceneDetection.sceneCount,
      },
      {
        trackId: `track-effects-${analysis.videoId}`,
        trackType: TrackType.Effects,
        label: "Effects",
        startMs: 0,
        endMs: durationMs,
        muted: false,
        locked: false,
        clipCount: sceneDetection.transitions.length,
      },
      {
        trackId: `track-motion-${analysis.videoId}`,
        trackType: TrackType.MotionGraphics,
        label: "Motion Graphics",
        startMs: 0,
        endMs: durationMs,
        muted: false,
        locked: false,
        clipCount: Math.max(1, Math.floor(sceneDetection.sceneCount / 2)),
      },
      {
        trackId: `track-overlay-${analysis.videoId}`,
        trackType: TrackType.Overlay,
        label: "Overlays",
        startMs: 0,
        endMs: durationMs,
        muted: false,
        locked: false,
        clipCount: sceneDetection.shotCount,
      },
      {
        trackId: `track-adjustment-${analysis.videoId}`,
        trackType: TrackType.Adjustment,
        label: "Color / Exposure Adjustments",
        startMs: 0,
        endMs: durationMs,
        muted: false,
        locked: true,
        clipCount: 1,
      }
    );

    return tracks;
  }

  private buildDependencies(
    sceneSequence: SceneSequenceEntry[],
    shotSequence: ShotSequenceEntry[],
    tracks: TimelineTrack[]
  ): TimelineDependency[] {
    const deps: TimelineDependency[] = [];

    for (let i = 1; i < sceneSequence.length; i++) {
      deps.push({
        dependencyId: `dep-scene-${sceneSequence[i]!.sceneId}`,
        sourceId: sceneSequence[i - 1]!.sceneId,
        targetId: sceneSequence[i]!.sceneId,
        type: "scene",
        description: "Sequential scene dependency",
      });
    }

    for (let i = 1; i < shotSequence.length; i++) {
      deps.push({
        dependencyId: `dep-shot-${shotSequence[i]!.shotId}`,
        sourceId: shotSequence[i - 1]!.shotId,
        targetId: shotSequence[i]!.shotId,
        type: "shot",
        description: "Sequential shot dependency",
      });
    }

    const videoTrack = tracks.find((t) => t.trackType === TrackType.Video);
    const audioTrack = tracks.find((t) => t.trackType === TrackType.Audio);
    if (videoTrack && audioTrack) {
      deps.push({
        dependencyId: `dep-sync-audio-${videoTrack.trackId}`,
        sourceId: videoTrack.trackId,
        targetId: audioTrack.trackId,
        type: "sync",
        description: "Audio-video synchronization dependency",
      });
    }

    return deps;
  }

  private buildSynchronization(
    analysis: VideoAnalysisIntelligenceRecord,
    sceneDetection: SceneDetectionRecord
  ): SynchronizationState {
    const audioBase = analysis.audio.synchronizationScore;
    const transitionBase = sceneDetection.transitions.length > 0 ? 85 : 70;

    return {
      audioSyncScore: Math.min(100, audioBase),
      subtitleSyncScore: Math.min(100, audioBase - 5),
      voiceSyncScore: Math.min(100, audioBase - 3),
      transitionSyncScore: Math.min(100, transitionBase),
      animationSyncScore: Math.min(100, 75 + Math.round(analysis.visual.visualStability * 0.15)),
      effectSyncScore: Math.min(100, transitionBase - 5),
      overallSyncScore: Math.round(
        (audioBase + transitionBase + analysis.audio.overallAudioQualityScore) / 3
      ),
    };
  }

  private buildOptimization(
    analysis: VideoAnalysisIntelligenceRecord,
    sceneDetection: SceneDetectionRecord,
    understanding: VideoUnderstandingRecord | null | undefined,
    sync: SynchronizationState,
    tracks: TimelineTrack[]
  ): TimelineOptimization {
    const storyFlow = understanding?.scores.storytellingScore ?? 70;
    const sceneContinuity =
      sceneDetection.scenes.length >= 3
        ? Math.min(100, 70 + sceneDetection.scores.timelineAccuracyScore * 0.25)
        : 55;
    const trackAlignment = tracks.length >= 5 ? 82 : 65;
    const resourceUsage = analysis.technical.bitrateKbps <= 20_000 ? 85 : 70;
    const renderingEfficiency = Math.round(
      (analysis.productionReadiness.renderingReadiness + sceneDetection.scores.timelineAccuracyScore) / 2
    );

    const recommendations: string[] = [];
    if (sync.overallSyncScore < 80) recommendations.push("Review audio-video sync points");
    if (sceneContinuity < 75) recommendations.push("Improve scene continuity transitions");
    if (trackAlignment < 80) recommendations.push("Align overlay tracks with scene boundaries");

    return {
      timelineFlowScore: Math.min(100, sceneDetection.scores.sceneDetectionScore),
      storyFlowScore: storyFlow,
      sceneContinuityScore: Math.round(sceneContinuity),
      trackAlignmentScore: trackAlignment,
      resourceUsageScore: resourceUsage,
      renderingEfficiencyScore: renderingEfficiency,
      recommendations,
    };
  }

  private buildVariants(
    rootTimelineId: string,
    durationMs: number,
    sceneDetection: SceneDetectionRecord,
    variants: TimelineVariant[],
    platform?: string
  ): VariantTimeline[] {
    const ratios: Record<TimelineVariant, number> = {
      [TimelineVariant.Main]: 1,
      [TimelineVariant.ShortVersion]: 0.6,
      [TimelineVariant.Trailer]: 0.3,
      [TimelineVariant.Teaser]: 0.15,
      [TimelineVariant.SocialMedia]: 0.5,
      [TimelineVariant.PlatformSpecific]: 0.45,
    };

    return variants.map((variant) => {
      const ratio = ratios[variant];
      const lengthMs = Math.round(durationMs * ratio);
      const sceneCount = Math.max(1, Math.round(sceneDetection.sceneCount * ratio));
      const shotCount = Math.max(1, Math.round(sceneDetection.shotCount * ratio));

      return {
        variant,
        timelineId: variant === TimelineVariant.Main ? rootTimelineId : `${rootTimelineId}-${variant}`,
        lengthMs,
        sectionCount: 3,
        sceneCount,
        shotCount,
        platform:
          variant === TimelineVariant.PlatformSpecific
            ? platform ?? "instagram"
            : variant === TimelineVariant.SocialMedia
              ? "social"
              : undefined,
      };
    });
  }

  private buildRecommendations(
    analysis: VideoAnalysisIntelligenceRecord,
    sceneDetection: SceneDetectionRecord,
    sync: SynchronizationState,
    optimization: TimelineOptimization,
    tracks: TimelineTrack[]
  ): TimelineRecommendation[] {
    const recs: TimelineRecommendation[] = [];

    if (sync.overallSyncScore < 85) {
      recs.push({
        category: "sync",
        suggestion: "Re-align audio and subtitle tracks at scene boundaries",
        priority: "high",
        reason: `Sync score ${sync.overallSyncScore}/100`,
      });
    }
    if (optimization.sceneContinuityScore < 75) {
      recs.push({
        category: "structure",
        suggestion: "Add transition buffers between scenes for smoother flow",
        priority: "medium",
        reason: `Scene continuity ${optimization.sceneContinuityScore}/100`,
      });
    }
    if (tracks.filter((t) => t.trackType === TrackType.Subtitle).length === 0) {
      recs.push({
        category: "track",
        suggestion: "Add subtitle track for accessibility compliance",
        priority: "medium",
        reason: "No subtitle track detected",
      });
    }
    if (analysis.classification.videoType === VideoAnalysisType.SocialMedia) {
      recs.push({
        category: "optimization",
        suggestion: "Use social-media variant timeline for platform export",
        priority: "low",
        reason: "Social media video detected",
      });
    }
    if (optimization.renderingEfficiencyScore < 75) {
      recs.push({
        category: "production",
        suggestion: "Optimize track count and effects before rendering handoff",
        priority: "medium",
        reason: `Rendering efficiency ${optimization.renderingEfficiencyScore}/100`,
      });
    }

    for (const opt of optimization.recommendations) {
      recs.push({
        category: "optimization",
        suggestion: opt,
        priority: "low",
        reason: "Timeline optimization analysis",
      });
    }

    return recs;
  }
}
