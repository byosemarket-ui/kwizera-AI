import path from "node:path";
import type { AiAudioGenerationFoundation } from "../audio-generation-foundation/audio-generation-foundation.js";
import {
  AudioGenerationAccessPermission,
  AudioGenerationCategory,
  AudioGenerationModuleStatus,
} from "../audio-generation-foundation/types.js";
import { TextToSpeechGenerationAnalyzer } from "./text-to-speech-generation-analyzer.js";
import { TextToSpeechGenerationLinker } from "./text-to-speech-generation-linker.js";
import { TextToSpeechGenerationLogger } from "./text-to-speech-generation-logger.js";
import { TextToSpeechGenerationProcessor } from "./text-to-speech-generation-processor.js";
import { TextToSpeechGenerationScorer } from "./text-to-speech-generation-scorer.js";
import { TextToSpeechGenerationRecordStore } from "./text-to-speech-generation-stores.js";
import {
  TextToSpeechGenerationEngineError,
  TextToSpeechGenerationEngineStatusReport,
  TextToSpeechGenerationInput,
  TextToSpeechGenerationRecord,
  TextToSpeechGenerationResult,
  TextToSpeechSearchQuery,
  TtsLanguage,
  TtsPlatform,
} from "./types.js";

/**
 * AI Text-to-Speech Generation Engine — transforms structured text into
 * production-ready speech generation blueprints.
 */
export class AiTextToSpeechGenerationEngine {
  private foundation: AiAudioGenerationFoundation | null = null;
  private engineDir = "";
  private initialized = false;
  private startupComplete = false;

  readonly logger = new TextToSpeechGenerationLogger();
  readonly records = new TextToSpeechGenerationRecordStore();

  private readonly analyzer = new TextToSpeechGenerationAnalyzer();
  private readonly scorer = new TextToSpeechGenerationScorer();
  private readonly linker = new TextToSpeechGenerationLinker();
  private processor: TextToSpeechGenerationProcessor | null = null;

  private generationTimes: number[] = [];
  private searchTimes: number[] = [];
  private blueprintTimes: number[] = [];

  initialize(foundation: AiAudioGenerationFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.engineDir = path.join(foundation.getGenerationRoot(), "text-to-speech", "engine");

    this.logger.initialize(path.join(storageRoot, "logs"));
    this.records.initialize(this.engineDir);

    this.processor = new TextToSpeechGenerationProcessor(
      foundation,
      this.analyzer,
      this.scorer,
      this.linker,
      this.records,
      this.logger
    );

    this.initialized = true;
    this.logger.log("info", "startup", "Text-to-Speech Generation Engine initialized", {
      engineDir: this.engineDir,
    });
  }

  async runStartup(): Promise<void> {
    this.ensureReady();

    this.foundation!.registerAudioGenerationModule({
      moduleId: "text-to-speech-generation-engine",
      moduleName: "Text-to-Speech Generation Engine",
      category: AudioGenerationCategory.TextToSpeech,
      version: "0.1.0",
      status: AudioGenerationModuleStatus.Active,
      dependencies: ["audio-generation-engine", "knowledge-engine", "product-intelligence-engine"],
      qualityScore: 92,
      confidenceScore: 90,
      storageLocation: path.join(this.foundation!.getGenerationRoot(), "text-to-speech"),
      accessPermissions: [
        AudioGenerationAccessPermission.Read,
        AudioGenerationAccessPermission.Write,
        AudioGenerationAccessPermission.Validate,
      ],
      implemented: true,
    });

    this.startupComplete = true;
    this.logger.log("info", "startup", "Text-to-Speech Generation Engine startup complete", {
      recordsLoaded: this.records.getCount(),
    });
  }

  async generateSpeechPlan(input: TextToSpeechGenerationInput): Promise<TextToSpeechGenerationResult> {
    this.ensureReady();
    const result = await this.processor!.generateSpeechPlan(input);
    if (result.success) {
      this.generationTimes.push(result.durationMs);
      this.blueprintTimes.push(result.durationMs);
    }
    return result;
  }

  getSpeechPlan(speechPlanId: string): TextToSpeechGenerationRecord | null {
    this.ensureReady();
    return this.records.get(speechPlanId) ?? null;
  }

  getSpeechPlansByProduct(productId: string): TextToSpeechGenerationRecord[] {
    this.ensureReady();
    return this.records.getByProduct(productId);
  }

  getSpeechPlansByProject(projectId: string): TextToSpeechGenerationRecord[] {
    this.ensureReady();
    return this.records.getByProject(projectId);
  }

  getSpeechPlansByLanguage(language: TtsLanguage): TextToSpeechGenerationRecord[] {
    this.ensureReady();
    return this.records.getByLanguage(language);
  }

  searchSpeechPlans(query: TextToSpeechSearchQuery): TextToSpeechGenerationRecord[] {
    this.ensureReady();
    const start = Date.now();
    const results = this.processor!.search(query);
    this.searchTimes.push(Date.now() - start);
    this.logger.log("info", "search", "Speech plan search executed", {
      query,
      resultCount: results.length,
      durationMs: Date.now() - start,
    });
    return results;
  }

  async repairSpeechPlan(productId: string, platform?: TtsPlatform): Promise<TextToSpeechGenerationResult | null> {
    this.ensureReady();
    this.logger.log("info", "repair", "Repairing speech plan generation", { productId, platform });
    return this.generateSpeechPlan({
      productId,
      platform,
      generatePlatformOptimizations: true,
    });
  }

  buildStatusReport(): TextToSpeechGenerationEngineStatusReport {
    const avg = (times: number[]) =>
      times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

    const all = this.records.getAll();
    const avgPronunciation =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.pronunciationScore, 0) / all.length)
        : 0;
    const avgProductionReadiness =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.productionReadinessScore, 0) / all.length)
        : 0;

    let readinessScore = 100;
    if (!this.initialized) readinessScore = 0;
    if (!this.startupComplete) readinessScore -= 25;
    if (!this.foundation?.isStartupComplete()) readinessScore -= 10;

    const module = this.foundation?.getRegistry().getModule("text-to-speech-generation-engine");
    if (!module?.implemented) readinessScore -= 15;

    return {
      engineStatus: this.startupComplete ? "operational" : "initializing",
      textAnalysisStatus: "language, grammar, punctuation, keywords, numbers, dates analysis active",
      pronunciationPlanningStatus: "phoneme mapping, dictionary, acronyms, names, numbers active",
      emotionPlanningStatus: "10 emotion types with intensity and arc planning",
      naturalnessPlanningStatus: "intonation, pitch, pacing, pauses, rhythm, breath planning active",
      platformOptimizationStatus: "7 platform speech profiles prepared",
      speechPlansGenerated: all.length,
      averagePronunciationScore: avgPronunciation,
      averageProductionReadinessScore: avgProductionReadiness,
      performance: {
        averageGenerationMs: avg(this.generationTimes),
        averageSearchMs: avg(this.searchTimes),
        averageBlueprintMs: avg(this.blueprintTimes),
      },
      knownIssues: [],
      readinessScore: Math.max(0, readinessScore),
      timestamp: new Date().toISOString(),
    };
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  isStartupComplete(): boolean {
    return this.startupComplete;
  }

  private ensureReady(): void {
    if (!this.initialized || !this.foundation || !this.processor) {
      throw new TextToSpeechGenerationEngineError(
        "Text-to-Speech Generation Engine not initialized",
        "NOT_INITIALIZED"
      );
    }
  }
}
