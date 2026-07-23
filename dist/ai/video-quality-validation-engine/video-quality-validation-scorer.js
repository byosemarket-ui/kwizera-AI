import { QualityIssueSeverity } from "./types.js";
export class VideoQualityValidationScorer {
    computeScores(draft, storyboard, upstream) {
        const visualQualityScore = this.computeVisualQuality(draft, storyboard);
        const audioQualityScore = this.computeAudioQuality(draft);
        const motionScore = this.computeMotionScore(upstream);
        const animationScore = this.computeAnimationScore(upstream);
        const cameraScore = this.computeCameraScore(upstream);
        const brandConsistencyScore = this.computeBrandConsistency(draft, storyboard, upstream);
        const platformCompatibilityScore = this.computePlatformCompatibility(draft);
        const renderReadinessScore = this.computeRenderReadiness(draft, upstream);
        const overallQualityScore = Math.round((visualQualityScore +
            audioQualityScore +
            motionScore +
            animationScore +
            cameraScore +
            brandConsistencyScore +
            platformCompatibilityScore +
            renderReadinessScore) /
            8);
        const aiConfidenceScore = Math.round((overallQualityScore + renderReadinessScore + brandConsistencyScore) / 3);
        return {
            overallQualityScore,
            visualQualityScore,
            audioQualityScore,
            motionScore,
            animationScore,
            cameraScore,
            brandConsistencyScore,
            platformCompatibilityScore,
            renderReadinessScore,
            aiConfidenceScore,
        };
    }
    isValidationValid(scores, draft) {
        const diagnostics = [];
        const criticalCount = draft.issues.filter((i) => i.severity === QualityIssueSeverity.Critical && !i.repaired).length;
        if (criticalCount > 0) {
            diagnostics.push(`${criticalCount} unresolved critical issue(s) — approval blocked`);
        }
        if (!draft.productionReadiness.allInputsReady) {
            diagnostics.push("Production inputs not fully ready");
        }
        if (!draft.dependencyValidation.allDependenciesReady) {
            diagnostics.push(`Missing dependencies: ${draft.dependencyValidation.missingDependencies.join(", ")}`);
        }
        if (!draft.videoQuality.allVisualChecksPassed) {
            diagnostics.push("Visual quality validation incomplete");
        }
        if (!draft.audioQuality.allAudioChecksPassed) {
            diagnostics.push("Audio quality validation incomplete");
        }
        if (!draft.technicalQuality.allTechnicalChecksPassed) {
            diagnostics.push("Technical validation incomplete");
        }
        if (scores.overallQualityScore < 55) {
            diagnostics.push(`Overall quality score ${scores.overallQualityScore} below threshold (55)`);
        }
        if (scores.renderReadinessScore < 55) {
            diagnostics.push(`Render readiness score ${scores.renderReadinessScore} below threshold (55)`);
        }
        if (scores.aiConfidenceScore < 55) {
            diagnostics.push(`AI confidence score ${scores.aiConfidenceScore} below threshold (55)`);
        }
        return { valid: diagnostics.length === 0, diagnostics };
    }
    isApproved(scores, draft) {
        const hasCritical = draft.issues.some((i) => i.severity === QualityIssueSeverity.Critical && !i.repaired);
        return (!hasCritical &&
            scores.overallQualityScore >= 55 &&
            scores.renderReadinessScore >= 55 &&
            draft.productionReadiness.renderPlansReady &&
            draft.platformValidations.length >= 7);
    }
    isBrandConsistent(storyboard, upstream) {
        return (storyboard.brandConsistent &&
            upstream.marketingPlan.brandConsistent &&
            upstream.productionPlan.brandConsistent &&
            upstream.renderPlan.brandConsistent &&
            draftBrandCheck(upstream));
    }
    hasCriticalIssues(draft) {
        return draft.issues.some((i) => i.severity === QualityIssueSeverity.Critical && !i.repaired);
    }
    computeVisualQuality(draft, storyboard) {
        let score = 45;
        if (draft.videoQuality.allVisualChecksPassed)
            score += 35;
        if (storyboard.productionReady)
            score += 10;
        if (draft.videoQuality.transitionConsistency.includes("consistent"))
            score += 10;
        return Math.min(100, score);
    }
    computeAudioQuality(draft) {
        let score = 45;
        if (draft.audioQuality.allAudioChecksPassed)
            score += 35;
        if (draft.audioQuality.lipSync.length > 3)
            score += 10;
        if (draft.audioQuality.loudness.length > 3)
            score += 10;
        return Math.min(100, score);
    }
    computeMotionScore(upstream) {
        const ready = upstream.motionPlans.filter((p) => p.validated && p.productionReady).length;
        const total = upstream.motionPlans.length || 1;
        return Math.min(100, Math.round(50 + (ready / total) * 50));
    }
    computeAnimationScore(upstream) {
        const ready = upstream.animationPlans.filter((p) => p.validated && p.productionReady).length;
        const total = upstream.animationPlans.length || 1;
        return Math.min(100, Math.round(50 + (ready / total) * 50));
    }
    computeCameraScore(upstream) {
        const ready = upstream.cameraPlans.filter((p) => p.validated && p.productionReady).length;
        const total = upstream.cameraPlans.length || 1;
        return Math.min(100, Math.round(50 + (ready / total) * 50));
    }
    computeBrandConsistency(draft, storyboard, upstream) {
        let score = 45;
        if (draft.brandQuality.allBrandChecksPassed)
            score += 35;
        if (storyboard.brandConsistent)
            score += 10;
        if (upstream.marketingPlan.brandConsistent)
            score += 10;
        return Math.min(100, score);
    }
    computePlatformCompatibility(draft) {
        const ready = draft.platformValidations.filter((p) => p.resolutionReady && p.aspectRatioReady && p.durationReady).length;
        return Math.min(100, Math.round((ready / Math.max(draft.platformValidations.length, 1)) * 100));
    }
    computeRenderReadiness(draft, upstream) {
        let score = 45;
        if (draft.productionReadiness.renderPlansReady)
            score += 25;
        if (upstream.renderPlan.renderReady)
            score += 15;
        if (draft.technicalQuality.allTechnicalChecksPassed)
            score += 15;
        return Math.min(100, score);
    }
}
function draftBrandCheck(upstream) {
    return upstream.scenes.every((s) => s.brandConsistent);
}
//# sourceMappingURL=video-quality-validation-scorer.js.map