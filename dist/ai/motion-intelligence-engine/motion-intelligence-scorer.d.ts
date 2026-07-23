import { MotionQualityScores, ObjectMotionAnalysis, SubjectTrack } from "./types.js";
export declare class MotionIntelligenceScorer {
    computeScores(metrics: {
        presence: boolean;
        stability: number;
        continuity: number;
        density: number;
    }, objectMotions: ObjectMotionAnalysis[], subjectTracks: SubjectTrack[], eventCount: number, productionBase: number, cinematicBase: number): MotionQualityScores;
    isAnalysisValid(scores: MotionQualityScores, objectMotionCount: number, trackCount: number, eventCount: number): {
        valid: boolean;
        diagnostics: string[];
    };
}
//# sourceMappingURL=motion-intelligence-scorer.d.ts.map