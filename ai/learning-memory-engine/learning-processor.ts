import crypto from "node:crypto";
import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { MemoryStorageType } from "../memory-storage-engine/types.js";
import { LearningEvaluator } from "./learning-evaluator.js";
import { LearningHistoryStore } from "./learning-history-store.js";
import { LearningMemoryLogger } from "./learning-logger.js";
import { PatternDetector } from "./pattern-detector.js";
import {
  LearningEventInput,
  LearningOutcome,
  LearningProcessResult,
  LearningRecord,
} from "./types.js";

export class LearningProcessor {
  constructor(
    private readonly foundation: AiMemoryFoundation,
    private readonly evaluator: LearningEvaluator,
    private readonly history: LearningHistoryStore,
    private readonly patterns: PatternDetector,
    private readonly logger: LearningMemoryLogger
  ) {}

  async process(input: LearningEventInput): Promise<LearningProcessResult> {
    const start = Date.now();
    let steps = 0;

    // Step 1: Detect completed activity
    steps++;
    if (!input.title || !input.description) {
      return this.reject("Missing activity information", start, steps);
    }

    // Step 2: Collect important information
    steps++;
    const collected = this.collectInformation(input);

    // Step 3: Evaluate quality
    steps++;
    const evaluation = this.evaluator.evaluate(collected);

    // Step 4: Determine learning value
    steps++;
    if (!evaluation.approved) {
      this.logger.log("warn", "learning-event", "Learning rejected", {
        reason: evaluation.reason,
      });
      return {
        success: false,
        rejected: true,
        reason: evaluation.reason,
        confidenceScore: evaluation.confidenceScore,
        learningValue: 0,
        durationMs: Date.now() - start,
        stepsCompleted: steps,
      };
    }

    // Step 5: Remove unnecessary information
    steps++;
    const refined = this.refineInformation(collected);

    // Step 6: Store useful experience
    steps++;
    const storage = this.foundation.getStorageEngine();
    const learningId = `learning-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

    const storeResult = await storage.storeRecord(
      {
        memoryId: learningId,
        memoryType: MemoryStorageType.Learning,
        category: refined.category,
        title: refined.title,
        description: refined.description,
        source: "learning-memory-engine",
        tags: [refined.source, refined.category, refined.outcome ?? "success"],
        keywords: refined.patterns ?? [],
        relatedProject: refined.relatedProject,
        relatedWorkflow: refined.relatedWorkflow,
        qualityScore: evaluation.confidenceScore,
        payload: {
          learningType: refined.category,
          source: refined.source,
          outcome: refined.outcome,
          lessonLearned: refined.lessonLearned,
          relatedMemoryIds: refined.relatedMemoryIds,
        },
      },
      "learning-memory-engine"
    );

    if (!storeResult.success || !storeResult.record) {
      return this.reject("Failed to store learning memory", start, steps);
    }

    // Step 7: Link related memories
    steps++;
    const relatedMemories = refined.relatedMemoryIds ?? [];
    if (refined.relatedProject) {
      const related = this.foundation.getIndexEngine().lookup({ project: refined.relatedProject });
      for (const id of related.memoryIds.slice(0, 5)) {
        if (!relatedMemories.includes(id)) relatedMemories.push(id);
      }
    }

    // Step 8: Update learning history
    steps++;
    const record: LearningRecord = {
      learningId,
      learningType: refined.category,
      source: refined.source,
      relatedProject: refined.relatedProject,
      relatedWorkflow: refined.relatedWorkflow,
      relatedMemories,
      confidenceScore: evaluation.confidenceScore,
      learningValue: evaluation.learningValue,
      creationTime: new Date().toISOString(),
      lastUpdate: new Date().toISOString(),
      futureUsage: 0,
      title: refined.title,
      description: refined.description,
      outcome: refined.outcome ?? LearningOutcome.Success,
      memoryId: storeResult.record.memoryId,
      verified: evaluation.verified,
      patterns: refined.patterns ?? [],
    };
    this.history.append(record);

    // Step 9: Improve future recommendations (patterns updated)
    steps++;
    const allPatterns = this.patterns.detectPatterns([...this.history.getAll()]);

    this.logger.log("info", "learning-event", "Learning processed", {
      learningId,
      learningValue: evaluation.learningValue,
      patterns: allPatterns.length,
    });

    return {
      success: true,
      learningId,
      memoryId: storeResult.record.memoryId,
      rejected: false,
      confidenceScore: evaluation.confidenceScore,
      learningValue: evaluation.learningValue,
      durationMs: Date.now() - start,
      stepsCompleted: steps,
    };
  }

  private collectInformation(input: LearningEventInput): LearningEventInput {
    return {
      ...input,
      patterns: input.patterns ?? [],
      relatedMemoryIds: input.relatedMemoryIds ?? [],
    };
  }

  private refineInformation(input: LearningEventInput): LearningEventInput {
    const maxDesc = 2000;
    return {
      ...input,
      description: input.description.slice(0, maxDesc),
      title: input.title.slice(0, 200),
    };
  }

  private reject(reason: string, start: number, steps: number): LearningProcessResult {
    return {
      success: false,
      rejected: true,
      reason,
      confidenceScore: 0,
      learningValue: 0,
      durationMs: Date.now() - start,
      stepsCompleted: steps,
    };
  }
}
