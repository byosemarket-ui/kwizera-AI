import path from "node:path";
import { MemoryStorageType } from "../memory-storage-engine/types.js";
import { LearningEvaluator } from "./learning-evaluator.js";
import { LearningHistoryStore } from "./learning-history-store.js";
import { LearningMemoryLogger } from "./learning-logger.js";
import { LearningProcessor } from "./learning-processor.js";
import { PatternDetector } from "./pattern-detector.js";
import { PreferenceStore } from "./preference-store.js";
import { SelfImprovementAnalyzer } from "./self-improvement-analyzer.js";
import { LearningCategory, LearningMemoryEngineError, LearningOutcome, LearningSource, } from "./types.js";
/**
 * Learning Memory Engine — continuous learning from projects, workflows, and user feedback.
 */
export class AiLearningMemoryEngine {
    foundation = null;
    storageRoot = "";
    initialized = false;
    startupComplete = false;
    logger = new LearningMemoryLogger();
    history = new LearningHistoryStore();
    preferences = new PreferenceStore(this.logger);
    evaluator = new LearningEvaluator();
    patterns = null;
    processor = null;
    selfImprovement = null;
    learningTimes = [];
    initialize(foundation, storageRoot) {
        this.foundation = foundation;
        this.storageRoot = storageRoot;
        const logDir = path.join(storageRoot, "logs");
        const learningDir = path.join(storageRoot, "memory", "learning");
        this.logger.initialize(logDir);
        this.history.initialize(learningDir);
        this.preferences.initialize(learningDir);
        this.patterns = new PatternDetector(this.history);
        this.processor = new LearningProcessor(foundation, this.evaluator, this.history, this.patterns, this.logger);
        this.selfImprovement = new SelfImprovementAnalyzer(this.history, this.patterns, this.preferences);
        this.initialized = true;
        this.logger.log("info", "startup", "Learning Memory Engine initialized", { storageRoot });
    }
    async runStartup() {
        this.ensureReady();
        this.startupComplete = true;
        this.logger.log("info", "startup", "Learning Memory Engine startup complete", {
            historyRecords: this.history.getCount(),
        });
    }
    async learnFromEvent(input) {
        this.ensureReady();
        const result = await this.processor.process(input);
        if (result.durationMs) {
            this.learningTimes.push(result.durationMs);
        }
        return result;
    }
    async learnFromUserCorrection(correction, context) {
        this.logger.log("info", "correction", "User correction received", { correction });
        return this.learnFromEvent({
            source: context.source ?? LearningSource.UserCorrection,
            category: context.category ?? LearningCategory.Workflow,
            title: context.title ?? "User Correction",
            description: correction,
            outcome: LearningOutcome.Correction,
            userFeedback: correction,
            qualityScore: 85,
            ...context,
        });
    }
    async updateUserPreferences(partial) {
        this.ensureReady();
        const updated = this.preferences.update(partial);
        await this.foundation.getStorageEngine().storeRecord({
            memoryId: `prefs-${Date.now()}`,
            memoryType: MemoryStorageType.UserPreference,
            category: "user-preference",
            title: "User Preferences",
            description: `Updated: ${Object.keys(partial).join(", ")}`,
            source: "learning-memory-engine",
            tags: ["preferences"],
            keywords: Object.keys(partial),
            qualityScore: 90,
            payload: updated,
        }, "learning-memory-engine");
        return updated;
    }
    getUserPreferences() {
        return this.preferences.get();
    }
    getLearningHistory() {
        return this.history.getAll();
    }
    getSelfImprovementInsights() {
        return this.selfImprovement.analyze();
    }
    getDetectedPatterns() {
        return this.patterns.detectPatterns([...this.history.getAll()]);
    }
    async getRecommendationsForProject(projectId) {
        const projectLearning = this.history.getByProject(projectId);
        const insights = this.selfImprovement.analyze();
        const prefs = this.preferences.get();
        const recs = [...insights.recommendations];
        if (prefs.preferredWorkflow)
            recs.push(`Workflow: ${prefs.preferredWorkflow}`);
        if (projectLearning.length > 0) {
            recs.push(`Apply ${projectLearning.length} prior learning(s) from this project`);
        }
        return recs;
    }
    isInitialized() {
        return this.initialized;
    }
    isStartupComplete() {
        return this.startupComplete;
    }
    buildStatusReport() {
        const records = [...this.history.getAll()];
        const avg = this.learningTimes.length > 0
            ? Math.round(this.learningTimes.reduce((a, b) => a + b, 0) / this.learningTimes.length)
            : 0;
        const accuracy = this.selfImprovement.computeAccuracy(records);
        const patterns = this.patterns.detectPatterns(records);
        let readinessScore = 100;
        if (!this.initialized)
            readinessScore = 0;
        if (!this.startupComplete)
            readinessScore -= 25;
        return {
            engineStatus: this.startupComplete ? "operational" : "initializing",
            learningAccuracy: accuracy,
            preferenceLearningStatus: this.preferences.getPreferenceCount() > 0 ? "active" : "awaiting preferences",
            historyStatus: `${records.length} learning record(s)`,
            totalLearningRecords: records.length,
            totalPreferences: this.preferences.getPreferenceCount(),
            performance: {
                averageLearningMs: avg,
                lastLearningMs: this.learningTimes[this.learningTimes.length - 1] ?? 0,
                patternsDetected: patterns.length,
            },
            knownIssues: [],
            readinessScore: Math.max(0, readinessScore),
            timestamp: new Date().toISOString(),
        };
    }
    ensureReady() {
        if (!this.initialized || !this.foundation) {
            throw new LearningMemoryEngineError("Learning Memory Engine not initialized", "NOT_INITIALIZED");
        }
    }
}
//# sourceMappingURL=learning-memory-engine.js.map