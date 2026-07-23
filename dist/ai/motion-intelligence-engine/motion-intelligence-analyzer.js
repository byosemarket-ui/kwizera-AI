import { CameraMovementType } from "../camera-movement-intelligence-engine/types.js";
import { SceneClassification, ShotType } from "../scene-detection-intelligence-engine/types.js";
import { VideoAnalysisType } from "../video-analysis-engine/types.js";
import { MotionClassification, MotionDirection, MotionEventType, MotionSpeed, ObjectMotionType, TrackingSubjectType, } from "./types.js";
export class MotionIntelligenceAnalyzer {
    analyze(analysis, sceneDetection, timeline, camera, understanding) {
        const motionDensity = analysis.frame.motionDensity;
        const visualStability = analysis.visual.visualStability;
        const durationMs = analysis.technical.durationMs;
        const metrics = this.buildMetrics(analysis, motionDensity, visualStability, durationMs);
        const objectMotions = this.analyzeObjectMotions(sceneDetection, analysis, motionDensity);
        const subjectTracks = this.buildSubjectTracks(objectMotions, sceneDetection);
        const motionEvents = this.detectMotionEvents(sceneDetection, objectMotions, subjectTracks, camera, motionDensity);
        const classifications = this.classifyMotion(analysis, motionDensity, camera, understanding, metrics);
        const dominantClassification = this.getDominantClassification(classifications);
        const motionPlan = this.buildMotionPlan(classifications, metrics, timeline, camera, understanding, sceneDetection);
        const recommendations = this.buildRecommendations(metrics, subjectTracks, motionEvents, analysis, camera);
        const keywords = [
            ...analysis.keywords,
            ...classifications,
            ...objectMotions.map((o) => o.type),
            dominantClassification,
        ].filter(Boolean);
        return {
            metrics,
            objectMotions,
            subjectTracks,
            motionEvents,
            classifications,
            dominantClassification,
            motionPlan,
            recommendations,
            keywords,
        };
    }
    buildMetrics(analysis, motionDensity, visualStability, durationMs) {
        const presence = motionDensity > 15;
        const direction = this.inferGlobalDirection(motionDensity, analysis.classification.videoType);
        const speed = this.inferSpeed(motionDensity);
        const intensity = Math.min(100, Math.round(motionDensity * 1.1));
        const continuity = Math.min(100, Math.round(visualStability * 0.6 + analysis.frame.frameConsistencyScore * 0.4));
        return {
            presence,
            direction,
            speed,
            intensity,
            durationMs,
            continuity,
            density: motionDensity,
            stability: Math.min(100, Math.round(visualStability * 0.85 + continuity * 0.15)),
        };
    }
    inferGlobalDirection(motionDensity, videoType) {
        if (motionDensity < 20)
            return MotionDirection.Static;
        if (videoType === VideoAnalysisType.SocialMedia)
            return MotionDirection.Mixed;
        if (motionDensity > 65)
            return MotionDirection.Forward;
        if (motionDensity > 45)
            return MotionDirection.Right;
        return MotionDirection.Left;
    }
    inferSpeed(motionDensity) {
        if (motionDensity < 20)
            return MotionSpeed.Static;
        if (motionDensity < 40)
            return MotionSpeed.Slow;
        if (motionDensity < 65)
            return MotionSpeed.Normal;
        if (motionDensity < 80)
            return MotionSpeed.Fast;
        return MotionSpeed.VeryFast;
    }
    analyzeObjectMotions(sceneDetection, analysis, motionDensity) {
        const motions = [];
        const hasProduct = analysis.relationships.relatedProducts.length > 0;
        for (let i = 0; i < sceneDetection.shots.length; i++) {
            const shot = sceneDetection.shots[i];
            const scene = sceneDetection.scenes.find((s) => s.sceneId === shot.sceneId);
            const intensity = Math.min(100, Math.round(motionDensity * (0.8 + (i % 3) * 0.1)));
            const direction = this.inferShotDirection(i, motionDensity);
            const speed = this.inferSpeed(intensity);
            if (hasProduct && (scene?.classification === SceneClassification.ProductDemo || i % 3 === 0)) {
                motions.push(this.objectMotion("product", ObjectMotionType.ProductMovement, TrackingSubjectType.Product, shot, intensity, direction, speed, 85));
            }
            if (scene?.classification === SceneClassification.Testimonial || shot.shotType === ShotType.CloseUp) {
                motions.push(this.objectMotion("human", ObjectMotionType.HumanMovement, TrackingSubjectType.Human, shot, intensity, direction, speed, 82));
            }
            if (i % 5 === 0 && motionDensity > 50) {
                motions.push(this.objectMotion("bg", ObjectMotionType.BackgroundMotion, TrackingSubjectType.Background, shot, Math.round(intensity * 0.6), MotionDirection.Mixed, MotionSpeed.Slow, 70));
            }
            if (scene?.classification === SceneClassification.BRoll) {
                motions.push(this.objectMotion("env", ObjectMotionType.EnvironmentalMotion, TrackingSubjectType.Background, shot, Math.round(intensity * 0.5), MotionDirection.Circular, MotionSpeed.Slow, 75));
            }
        }
        if (motions.length === 0 && sceneDetection.shots.length > 0) {
            const shot = sceneDetection.shots[0];
            motions.push(this.objectMotion("default", ObjectMotionType.BackgroundMotion, TrackingSubjectType.Object, shot, motionDensity, MotionDirection.Static, MotionSpeed.Static, 65));
        }
        return motions;
    }
    objectMotion(prefix, type, subjectType, shot, intensity, direction, speed, confidence) {
        return {
            objectId: `obj-${prefix}-${shot.shotId}`,
            type,
            subjectType,
            shotId: shot.shotId,
            sceneId: shot.sceneId,
            startMs: shot.startMs,
            endMs: shot.endMs,
            direction,
            speed,
            intensity,
            confidence,
        };
    }
    inferShotDirection(index, motionDensity) {
        if (motionDensity < 20)
            return MotionDirection.Static;
        const dirs = [
            MotionDirection.Left,
            MotionDirection.Right,
            MotionDirection.Forward,
            MotionDirection.Up,
            MotionDirection.Down,
            MotionDirection.Circular,
        ];
        return dirs[index % dirs.length] ?? MotionDirection.Mixed;
    }
    buildSubjectTracks(objectMotions, sceneDetection) {
        const bySubject = new Map();
        for (const m of objectMotions) {
            const list = bySubject.get(m.subjectType) ?? [];
            list.push(m);
            bySubject.set(m.subjectType, list);
        }
        const tracks = [];
        for (const [subjectType, motions] of bySubject) {
            const sorted = [...motions].sort((a, b) => a.startMs - b.startMs);
            const first = sorted[0];
            const last = sorted[sorted.length - 1];
            const gaps = this.detectTrackGaps(sorted);
            tracks.push({
                trackId: `track-${subjectType}-${first.shotId}`,
                subjectType,
                label: `${subjectType} track`,
                shotIds: [...new Set(sorted.map((m) => m.shotId))],
                sceneIds: [...new Set(sorted.map((m) => m.sceneId))],
                startMs: first.startMs,
                endMs: last.endMs,
                entryDetected: first.startMs <= (sceneDetection.scenes[0]?.startMs ?? 0) + 500,
                exitDetected: last.endMs >= (sceneDetection.scenes.at(-1)?.endMs ?? last.endMs) - 500,
                reappearanceDetected: gaps > 0,
                trackingAccuracy: Math.round(sorted.reduce((s, m) => s + m.confidence, 0) / sorted.length),
                pathSummary: `${subjectType}: ${sorted.length} segment(s), ${this.summarizeDirections(sorted)}`,
            });
        }
        return tracks;
    }
    detectTrackGaps(motions) {
        let gaps = 0;
        for (let i = 1; i < motions.length; i++) {
            if (motions[i].startMs - motions[i - 1].endMs > 1000)
                gaps++;
        }
        return gaps;
    }
    summarizeDirections(motions) {
        return [...new Set(motions.map((m) => m.direction))].join(" → ");
    }
    detectMotionEvents(sceneDetection, objectMotions, subjectTracks, camera, motionDensity) {
        const events = [];
        if (sceneDetection.shots.length > 0) {
            const first = sceneDetection.shots[0];
            events.push({
                eventId: `evt-start-${first.shotId}`,
                type: MotionEventType.StartMotion,
                startMs: first.startMs,
                endMs: first.startMs + 200,
                shotId: first.shotId,
                sceneId: first.sceneId,
                description: "Initial motion onset",
                confidence: 80,
            });
        }
        for (let i = 0; i < sceneDetection.shots.length - 1; i++) {
            const from = sceneDetection.shots[i];
            const to = sceneDetection.shots[i + 1];
            const fromMotion = objectMotions.find((m) => m.shotId === from.shotId);
            const toMotion = objectMotions.find((m) => m.shotId === to.shotId);
            if (fromMotion && toMotion && fromMotion.direction !== toMotion.direction) {
                events.push({
                    eventId: `evt-dir-${from.shotId}-${to.shotId}`,
                    type: MotionEventType.DirectionChange,
                    startMs: to.startMs,
                    endMs: to.startMs + 300,
                    shotId: to.shotId,
                    sceneId: to.sceneId,
                    description: `${fromMotion.direction} → ${toMotion.direction}`,
                    confidence: 78,
                });
            }
            if (fromMotion && toMotion && fromMotion.speed !== toMotion.speed) {
                events.push({
                    eventId: `evt-speed-${from.shotId}-${to.shotId}`,
                    type: MotionEventType.SpeedChange,
                    startMs: to.startMs,
                    endMs: to.startMs + 300,
                    shotId: to.shotId,
                    sceneId: to.sceneId,
                    description: `${fromMotion.speed} → ${toMotion.speed}`,
                    confidence: 75,
                });
            }
            if (from.sceneId !== to.sceneId) {
                events.push({
                    eventId: `evt-focus-${from.shotId}-${to.shotId}`,
                    type: MotionEventType.FocusShift,
                    startMs: to.startMs,
                    endMs: to.startMs + 400,
                    shotId: to.shotId,
                    sceneId: to.sceneId,
                    description: `Scene transition focus shift`,
                    confidence: 82,
                });
            }
        }
        for (const track of subjectTracks) {
            if (track.entryDetected) {
                events.push({
                    eventId: `evt-entry-${track.trackId}`,
                    type: MotionEventType.AttentionShift,
                    startMs: track.startMs,
                    endMs: track.startMs + 250,
                    trackId: track.trackId,
                    description: `${track.label} entry detected`,
                    confidence: track.trackingAccuracy,
                });
            }
            if (track.reappearanceDetected) {
                events.push({
                    eventId: `evt-reappear-${track.trackId}`,
                    type: MotionEventType.Interaction,
                    startMs: track.startMs + 500,
                    endMs: track.endMs - 500,
                    trackId: track.trackId,
                    description: `${track.label} reappearance`,
                    confidence: Math.max(65, track.trackingAccuracy - 10),
                });
            }
        }
        if (camera?.shotAnalyses.some((s) => s.movement === CameraMovementType.PushIn)) {
            events.push({
                eventId: `evt-attention-camera`,
                type: MotionEventType.AttentionShift,
                startMs: camera.shotAnalyses[0]?.startMs ?? 0,
                endMs: (camera.shotAnalyses[0]?.startMs ?? 0) + 500,
                description: "Camera push-in drives attention shift",
                confidence: 85,
            });
        }
        if (motionDensity > 70 && events.length < 4) {
            events.push({
                eventId: `evt-action-${sceneDetection.detectionId}`,
                type: MotionEventType.Collision,
                startMs: Math.floor(sceneDetection.scenes[0]?.durationMs ?? 1000 / 2),
                endMs: Math.floor((sceneDetection.scenes[0]?.durationMs ?? 1000) / 2) + 400,
                sceneId: sceneDetection.scenes[0]?.sceneId,
                description: "High-intensity motion interaction",
                confidence: 72,
            });
        }
        const lastShot = sceneDetection.shots.at(-1);
        if (lastShot && motionDensity < 30) {
            events.push({
                eventId: `evt-stop-${lastShot.shotId}`,
                type: MotionEventType.StopMotion,
                startMs: lastShot.endMs - 300,
                endMs: lastShot.endMs,
                shotId: lastShot.shotId,
                sceneId: lastShot.sceneId,
                description: "Motion cessation at scene end",
                confidence: 77,
            });
        }
        return events;
    }
    classifyMotion(analysis, motionDensity, camera, understanding, metrics) {
        const classes = new Set();
        if (motionDensity < 20)
            classes.add(MotionClassification.Static);
        if (motionDensity >= 20 && motionDensity < 40)
            classes.add(MotionClassification.SlowMotion);
        if (motionDensity >= 35 && motionDensity < 70)
            classes.add(MotionClassification.NormalMotion);
        if (motionDensity >= 65)
            classes.add(MotionClassification.FastMotion);
        if (motionDensity >= 75)
            classes.add(MotionClassification.Action);
        if (analysis.classification.videoType === VideoAnalysisType.Commercial) {
            classes.add(MotionClassification.PromotionalMotion);
        }
        if (analysis.classification.videoType === VideoAnalysisType.SocialMedia) {
            classes.add(MotionClassification.DynamicMotion);
        }
        if (camera && camera.scores.cinematicScore >= 70) {
            classes.add(MotionClassification.CinematicMotion);
        }
        if (understanding?.context.creativeContext?.toLowerCase().includes("animated")) {
            classes.add(MotionClassification.AnimatedMotion);
        }
        if (metrics.continuity >= 80) {
            classes.add(MotionClassification.CinematicMotion);
        }
        if (classes.size === 0)
            classes.add(MotionClassification.Other);
        return [...classes];
    }
    getDominantClassification(classifications) {
        const priority = [
            MotionClassification.Action,
            MotionClassification.DynamicMotion,
            MotionClassification.PromotionalMotion,
            MotionClassification.CinematicMotion,
            MotionClassification.FastMotion,
            MotionClassification.NormalMotion,
            MotionClassification.SlowMotion,
            MotionClassification.Static,
            MotionClassification.AnimatedMotion,
            MotionClassification.Other,
        ];
        for (const p of priority) {
            if (classifications.includes(p))
                return p;
        }
        return classifications[0] ?? MotionClassification.Other;
    }
    buildMotionPlan(classifications, metrics, timeline, camera, understanding, sceneDetection) {
        const segments = sceneDetection.scenes.map((scene, i) => ({
            segmentId: `motion-seg-${scene.sceneId}`,
            startMs: scene.startMs,
            endMs: scene.endMs,
            classification: classifications[i % classifications.length] ?? MotionClassification.NormalMotion,
            direction: this.inferShotDirection(i, metrics.density),
            speed: this.inferSpeed(metrics.density * (0.9 + i * 0.05)),
            intensity: Math.min(100, Math.round(metrics.intensity * (0.85 + (i % 2) * 0.1))),
            label: scene.classification,
        }));
        const style = understanding?.context.creativeContext ?? analysisStyleFallback(camera);
        const continuity = Math.round((metrics.continuity + (camera?.movementPlan.motionContinuity ?? 75)) / 2);
        return {
            motionTimeline: segments,
            motionPath: `Progressive ${metrics.direction} motion with ${metrics.speed} pacing across ${segments.length} scene(s)`,
            motionSynchronization: timeline
                ? `Sync motion beats to timeline ${timeline.timelineId} at scene boundaries`
                : "Align motion segments with detected scene boundaries",
            motionContinuity: continuity,
            enhancementNotes: [
                metrics.stability < 70 ? "Stabilize high-motion segments in post" : "Motion stability acceptable",
                camera ? `Coordinate with camera ${camera.dominantMovement} movement` : "Add camera movement data for richer sync",
            ],
            aiMotionBlueprint: `${style} — ${classifications.join(", ")} blueprint for AI generation`,
        };
    }
    buildRecommendations(metrics, tracks, events, analysis, camera) {
        const recs = [];
        if (metrics.stability < 65) {
            recs.push({
                category: "stability",
                suggestion: "Reduce motion intensity or apply stabilization on high-shake segments",
                priority: "high",
                reason: `Motion stability ${metrics.stability}/100`,
            });
        }
        if (tracks.length < 2 && analysis.relationships.relatedProducts.length > 0) {
            recs.push({
                category: "tracking",
                suggestion: "Add dedicated product tracking path for hero product shots",
                priority: "high",
                reason: "Product video with limited subject tracks",
            });
        }
        if (!events.some((e) => e.type === MotionEventType.AttentionShift)) {
            recs.push({
                category: "motion",
                suggestion: "Introduce attention-shift beats to guide viewer focus",
                priority: "medium",
                reason: "No attention shift events detected",
            });
        }
        if (!camera) {
            recs.push({
                category: "planning",
                suggestion: "Run camera movement analysis for synchronized motion planning",
                priority: "medium",
                reason: "Camera intelligence not linked",
            });
        }
        recs.push({
            category: "cinematic",
            suggestion: "Maintain motion continuity across scene transitions",
            priority: "low",
            reason: "Cinematic motion best practice",
        });
        return recs;
    }
}
function analysisStyleFallback(camera) {
    return camera?.movementPlan.cinematicStyle ?? "balanced cinematic";
}
//# sourceMappingURL=motion-intelligence-analyzer.js.map