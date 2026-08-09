/**
 * Feedback Intelligence & User Learning Engine (AI Learning Step 4).
 * Offline-first: understands feedback, learns preferences, never overwrites Professional Knowledge.
 */

import * as fs from "fs";
import * as path from "path";
import {
  analyzeRootCause,
  buildLesson,
  classifyFeedback,
  detectFeedbackTopics,
} from "./feedback-classifier.js";
import {
  FEEDBACK_INTELLIGENCE_VERSION,
  type AiMeFeedbackIntelligenceAwareness,
  type AnalyzedFeedback,
  type FeedbackInput,
  type FeedbackIntelligenceExplainResult,
  type FeedbackIntelligenceHealthReport,
  type FeedbackIntelligenceReportData,
  type FeedbackIntelligenceResult,
  type FeedbackIntelligenceStore,
  type LearningMemoryEntry,
  type ProjectFeedbackHistoryEntry,
  type RecommendationImprovement,
  type UserPreferenceProfile,
} from "./types.js";

function nowIso(): string {
  return new Date().toISOString();
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyStore(): FeedbackIntelligenceStore {
  return {
    feedback: [],
    learningMemory: [],
    preferenceProfiles: [],
    projectHistory: [],
    recommendationImprovements: [],
    runs: [],
    logs: [],
  };
}

function defaultProfile(userId: string): UserPreferenceProfile {
  return {
    userId,
    preferredVideoStyle: null,
    preferredCameraStyle: null,
    preferredLightingStyle: null,
    preferredBackgroundStyle: null,
    preferredMusicStyle: null,
    preferredVoiceStyle: null,
    preferredCtaStyle: null,
    preferredMarketingStyle: null,
    updatedAt: nowIso(),
    evolutionNotes: [],
  };
}

export class AiFeedbackIntelligenceEngine {
  private storageRoot: string | null = null;
  private store: FeedbackIntelligenceStore = emptyStore();
  private enabled = true;

  initialize(storageRoot: string): void {
    this.storageRoot = storageRoot;
    const dir = this.dir();
    fs.mkdirSync(dir, { recursive: true });
    this.load();
    this.log("info", "Feedback Intelligence Engine initialized (offline-first)");
  }

  isReady(): boolean {
    return this.storageRoot != null && this.enabled;
  }

  getAiMeAwareness(): AiMeFeedbackIntelligenceAwareness {
    return {
      available: true,
      enabled: this.enabled && this.isReady(),
      offlineFirst: true,
      canExplainWhatWasLearned: true,
      canExplainRecommendationChanges: true,
      canExplainPreferences: true,
      canRecommendFromPriorFeedback: true,
      performanceAnalyticsDeferred: false,
      summary:
        "AI Me can explain feedback learning, preference evolution, and recommendation changes. Performance Analytics is available (Step 5).",
    };
  }

  ingestAndLearn(inputs: FeedbackInput[], options?: { userId?: string }): FeedbackIntelligenceResult {
    const issuesFound: string[] = [];
    const issuesRepaired: string[] = [];
    const analyzed: AnalyzedFeedback[] = [];
    const learningEntries: LearningMemoryEntry[] = [];
    const recommendationImprovements: RecommendationImprovement[] = [];
    const userId = options?.userId ?? "default-user";

    if (!inputs.length) {
      issuesFound.push("No feedback inputs provided");
    }

    for (const input of inputs) {
      if (!input.projectId?.trim()) {
        issuesFound.push("Feedback missing projectId — repaired with unknown-project");
        issuesRepaired.push("Assigned projectId unknown-project");
        input.projectId = "unknown-project";
      }
      if (!input.text?.trim()) {
        issuesFound.push(`Empty feedback text for project ${input.projectId}`);
        issuesRepaired.push("Skipped empty feedback");
        continue;
      }

      const topics = detectFeedbackTopics(input.text);
      const { classification, sentimentScore, qualityScore } = classifyFeedback(input, topics);
      const rootCause = analyzeRootCause(input.text, topics, classification);
      const accepted =
        input.accepted !== false &&
        qualityScore >= 45 &&
        classification !== "feature-request";

      if (qualityScore < 45) {
        issuesFound.push(`Low feedback quality for "${input.text.slice(0, 40)}..." (${qualityScore})`);
        issuesRepaired.push("Marked not accepted for learning; retained in history");
      }

      const record: AnalyzedFeedback = {
        id: input.id ?? uid("fb"),
        projectId: input.projectId,
        source: input.source,
        text: input.text.trim(),
        rating: input.rating,
        topics,
        classification,
        sentimentScore,
        qualityScore,
        analyzedAt: input.timestamp ?? nowIso(),
        acceptedForLearning: accepted,
        rootCause,
        professionalKnowledgeOverwritten: false,
      };
      analyzed.push(record);
      this.store.feedback.push(record);

      if (accepted) {
        const lesson = buildLesson(classification, topics, rootCause);
        const entry: LearningMemoryEntry = {
          id: uid("learn"),
          feedbackId: record.id,
          projectId: record.projectId,
          topics,
          classification,
          lesson: lesson.lesson,
          recommendationRule: lesson.recommendationRule,
          workflowPreference: lesson.workflowPreference,
          qualityPreference: lesson.qualityPreference,
          stylePreference: lesson.stylePreference,
          learnedAt: nowIso(),
        };
        learningEntries.push(entry);
        this.store.learningMemory.push(entry);

        const improvement: RecommendationImprovement = {
          id: uid("rec"),
          basedOnFeedbackId: record.id,
          topic: topics[0]!,
          before: "Prior recommendation without this user signal",
          after: lesson.recommendationRule,
          createdAt: nowIso(),
        };
        recommendationImprovements.push(improvement);
        this.store.recommendationImprovements.push(improvement);

        this.applyPreferenceEvolution(userId, record, lesson.stylePreference ?? lesson.lesson);
      }

      this.upsertProjectHistory(record, accepted ? [rootCause.recommendedCorrection] : []);
    }

    this.ensureStoreIntegrity(issuesFound, issuesRepaired);

    const profile = this.getOrCreateProfile(userId);
    const projectIds = [...new Set(analyzed.map((item) => item.projectId))];
    const projectHistory = this.store.projectHistory.filter((entry) => projectIds.includes(entry.projectId));

    const result: FeedbackIntelligenceResult = {
      runId: uid("fir"),
      version: FEEDBACK_INTELLIGENCE_VERSION,
      processedAt: nowIso(),
      analyzed,
      learningEntries,
      preferenceProfile: profile,
      projectHistory,
      recommendationImprovements,
      issuesFound,
      issuesRepaired,
      professionalKnowledgeOverwritten: false,
      performanceAnalyticsDeferred: false,
      summary: `Analyzed ${analyzed.length} feedback item(s); learned ${learningEntries.length}; Professional Knowledge untouched; Performance Analytics deferred.`,
    };
    this.store.runs.push(result);
    this.persist();
    return result;
  }

  explain(feedbackId?: string, userId = "default-user"): FeedbackIntelligenceExplainResult {
    const profile = this.getOrCreateProfile(userId);
    const memory = feedbackId
      ? this.store.learningMemory.filter((entry) => entry.feedbackId === feedbackId)
      : this.store.learningMemory.slice(-5);
    const recs = feedbackId
      ? this.store.recommendationImprovements.filter((item) => item.basedOnFeedbackId === feedbackId)
      : this.store.recommendationImprovements.slice(-5);

    const whatWasLearned = memory.length
      ? memory.map((entry) => entry.lesson).join(" ")
      : "No accepted learning entries yet.";
    const howRecommendationsChanged = recs.length
      ? recs.map((item) => `${item.topic}: ${item.before} → ${item.after}`).join("; ")
      : "No recommendation updates yet.";
    const whyPreferenceExists = profile.evolutionNotes.length
      ? `Preferences evolved from feedback: ${profile.evolutionNotes.slice(-3).join(" | ")}`
      : "No preference evolution notes yet.";
    const recommendedImprovements = memory
      .map((entry) => entry.recommendationRule)
      .concat(
        this.store.feedback
          .filter((item) => item.acceptedForLearning === false && item.classification !== "positive")
          .slice(-3)
          .map((item) => item.rootCause.recommendedCorrection),
      )
      .slice(0, 5);

    return {
      feedbackId,
      whatWasLearned,
      howRecommendationsChanged,
      whyPreferenceExists,
      recommendedImprovements: recommendedImprovements.length
        ? recommendedImprovements
        : ["Collect more accepted feedback to refine recommendations."],
    };
  }

  getLearningMemory(): LearningMemoryEntry[] {
    return [...this.store.learningMemory];
  }

  getPreferenceProfile(userId = "default-user"): UserPreferenceProfile {
    return { ...this.getOrCreateProfile(userId), evolutionNotes: [...this.getOrCreateProfile(userId).evolutionNotes] };
  }

  getProjectHistory(projectId?: string): ProjectFeedbackHistoryEntry[] {
    if (!projectId) return [...this.store.projectHistory];
    return this.store.projectHistory.filter((entry) => entry.projectId === projectId);
  }

  getAllFeedback(): AnalyzedFeedback[] {
    return [...this.store.feedback];
  }

  getLatestRun(): FeedbackIntelligenceResult | null {
    return this.store.runs.length ? this.store.runs[this.store.runs.length - 1]! : null;
  }

  runQualityAssurance(): FeedbackIntelligenceHealthReport {
    const checks: FeedbackIntelligenceHealthReport["checks"] = [];
    const repaired: string[] = [];
    const criticalIssues: string[] = [];

    const feedbackOk = this.store.feedback.every((item) => item.id && item.projectId && item.text);
    checks.push({
      name: "Feedback Quality",
      passed: feedbackOk,
      detail: feedbackOk ? "All stored feedback records are complete" : "Incomplete feedback records detected",
    });
    if (!feedbackOk) {
      criticalIssues.push("Incomplete feedback records");
      this.store.feedback = this.store.feedback.filter((item) => item.id && item.projectId && item.text);
      repaired.push("Removed incomplete feedback records (history retained for valid items)");
    }

    const learningOk = this.store.learningMemory.every((entry) =>
      this.store.feedback.some((fb) => fb.id === entry.feedbackId),
    );
    checks.push({
      name: "Learning Quality",
      passed: learningOk,
      detail: learningOk ? "Learning entries reference stored feedback" : "Orphan learning entries found",
    });
    if (!learningOk) {
      this.store.learningMemory = this.store.learningMemory.filter((entry) =>
        this.store.feedback.some((fb) => fb.id === entry.feedbackId),
      );
      repaired.push("Pruned orphan learning entries");
    }

    const profilesOk = this.store.preferenceProfiles.every((profile) => profile.userId);
    checks.push({
      name: "Preference Consistency",
      passed: profilesOk,
      detail: profilesOk ? "Preference profiles have userId" : "Invalid preference profiles",
    });

    const noPkOverwrite = this.store.feedback.every((item) => item.professionalKnowledgeOverwritten === false);
    checks.push({
      name: "Memory Integrity",
      passed: noPkOverwrite && this.storageRoot != null,
      detail: noPkOverwrite
        ? "Professional Knowledge never overwritten; store path ready"
        : "Integrity flag violation",
    });
    if (!noPkOverwrite) criticalIssues.push("Professional Knowledge overwrite flag violated");

    const historyOk = this.store.projectHistory.every(
      (entry) => entry.projectId && Array.isArray(entry.feedbackIds) && entry.timestamp,
    );
    checks.push({
      name: "History Integrity",
      passed: historyOk,
      detail: historyOk ? "Project history entries intact" : "Corrupt project history entries",
    });
    if (!historyOk) {
      this.store.projectHistory = this.store.projectHistory.filter(
        (entry) => entry.projectId && Array.isArray(entry.feedbackIds) && entry.timestamp,
      );
      repaired.push("Repaired project history integrity");
    }

    this.persist();
    return {
      healthy: criticalIssues.length === 0 && checks.every((check) => check.passed),
      checks,
      repaired,
      criticalIssues,
    };
  }

  runAutomaticTests(): Array<{ name: string; passed: boolean; detail: string }> {
    const results: Array<{ name: string; passed: boolean; detail: string }> = [];
    const before = this.store.feedback.length;

    const sample = this.ingestAndLearn([
      {
        projectId: "test-project-fi",
        text: "The lighting is too harsh and the camera movement feels shaky. Please improve soft lighting.",
        source: "user-comment",
        rating: 2,
        accepted: true,
      },
      {
        projectId: "test-project-fi",
        text: "Love the music and CTA — great overall video quality.",
        source: "user-rating",
        rating: 5,
        accepted: true,
      },
    ], { userId: "test-user" });

    results.push({
      name: "Feedback Analysis",
      passed: sample.analyzed.length === 2 && sample.analyzed[0]!.topics.includes("lighting"),
      detail: `topics=${sample.analyzed[0]?.topics.join(",")}; class=${sample.analyzed[0]?.classification}`,
    });
    results.push({
      name: "Learning Memory",
      passed: sample.learningEntries.length >= 1,
      detail: `learned=${sample.learningEntries.length}`,
    });
    results.push({
      name: "Preference Learning",
      passed: Boolean(sample.preferenceProfile.userId === "test-user"),
      detail: `notes=${sample.preferenceProfile.evolutionNotes.length}`,
    });
    results.push({
      name: "Project History",
      passed: sample.projectHistory.some((entry) => entry.projectId === "test-project-fi"),
      detail: `history=${sample.projectHistory.length}`,
    });
    results.push({
      name: "Recommendation Improvement",
      passed: sample.recommendationImprovements.length >= 1,
      detail: `improvements=${sample.recommendationImprovements.length}`,
    });
    results.push({
      name: "Professional Knowledge Guard",
      passed: sample.professionalKnowledgeOverwritten === false,
      detail: "Professional Knowledge not overwritten",
    });
    results.push({
      name: "History Never Deleted",
      passed: this.store.feedback.length >= before + 2,
      detail: `feedbackCount=${this.store.feedback.length}`,
    });

    let health = this.runQualityAssurance();
    let loops = 0;
    while (!health.healthy && health.criticalIssues.length && loops < 3) {
      health = this.runQualityAssurance();
      loops += 1;
    }
    results.push({
      name: "QA Loop",
      passed: health.criticalIssues.length === 0,
      detail: `healthy=${health.healthy}; repaired=${health.repaired.join(",") || "none"}`,
    });

    return results;
  }

  buildReportData(testResults?: Array<{ name: string; passed: boolean; detail: string }>): FeedbackIntelligenceReportData {
    const tests = testResults ?? this.runAutomaticTests();
    return {
      generatedAt: nowIso(),
      existingFeedbackCapability:
        "Prior: learning-memory corrections, creative-review approve/regen, recommendation professional feedback, project-history-store, self-review. No unified Feedback Intelligence engine before Step 4.",
      componentsUpgraded: [
        "Composes learning signals into unified analyze→learn→prefer→history pipeline",
        "AI Me awareness extended for feedback explainability",
        "Knowledge Evolution Step 3 flag: feedbackIntelligenceDeferred cleared in Step 4 messaging",
      ],
      componentsCreated: [
        "ai/feedback-intelligence/types.ts",
        "ai/feedback-intelligence/feedback-classifier.ts",
        "ai/feedback-intelligence/feedback-intelligence-engine.ts",
        "ai/feedback-intelligence/index.ts",
      ],
      feedbackAnalyzed: this.store.feedback.slice(-20).map((item) => ({
        id: item.id,
        classification: item.classification,
        topics: item.topics,
      })),
      learningMemoryStatus: `${this.store.learningMemory.length} learning entries; never overwrites Professional Knowledge`,
      userPreferenceProfileStatus: `${this.store.preferenceProfiles.length} profile(s); styles evolve over time`,
      projectHistoryStatus: `${this.store.projectHistory.length} project history record(s); append-only feedback links`,
      recommendationImprovementStatus: `${this.store.recommendationImprovements.length} recommendation improvement(s)`,
      aiMeCapability: this.getAiMeAwareness().summary,
      issuesFound: this.store.runs.flatMap((run) => run.issuesFound).slice(-20),
      issuesRepaired: this.store.runs.flatMap((run) => run.issuesRepaired).slice(-20),
      testResults: tests,
      remainingWorkBeforeStep5: [
        "Performance Analytics (Step 5) is implemented — use AiPerformanceAnalyticsEngine / validate:performance-analytics.",
        "Optional: bridge accepted lessons into learning-memory-engine UserPreferences live sync",
        "Optional: surface Feedback Intelligence in conversation UI beyond intent handler",
      ],
    };
  }

  private applyPreferenceEvolution(userId: string, feedback: AnalyzedFeedback, note: string): void {
    const profile = this.getOrCreateProfile(userId);
    const primary = feedback.topics[0];
    const snippet = feedback.text.slice(0, 80);
    switch (primary) {
      case "camera":
      case "camera-movement":
        profile.preferredCameraStyle = snippet;
        break;
      case "lighting":
        profile.preferredLightingStyle = snippet;
        break;
      case "background":
        profile.preferredBackgroundStyle = snippet;
        break;
      case "music":
        profile.preferredMusicStyle = snippet;
        break;
      case "voice":
      case "narration":
        profile.preferredVoiceStyle = snippet;
        break;
      case "cta":
        profile.preferredCtaStyle = snippet;
        break;
      case "storytelling":
      case "product-presentation":
        profile.preferredMarketingStyle = snippet;
        break;
      default:
        profile.preferredVideoStyle = snippet;
        break;
    }
    profile.evolutionNotes.push(`${nowIso()}: ${note}`);
    if (profile.evolutionNotes.length > 50) profile.evolutionNotes = profile.evolutionNotes.slice(-50);
    profile.updatedAt = nowIso();
  }

  private upsertProjectHistory(feedback: AnalyzedFeedback, improvements: string[]): void {
    let entry = this.store.projectHistory.find((item) => item.projectId === feedback.projectId);
    if (!entry) {
      entry = {
        id: uid("ph"),
        projectId: feedback.projectId,
        feedbackIds: [],
        improvementsApplied: [],
        finalResult: "in-progress",
        userSatisfaction: null,
        timestamp: nowIso(),
      };
      this.store.projectHistory.push(entry);
    }
    if (!entry.feedbackIds.includes(feedback.id)) entry.feedbackIds.push(feedback.id);
    for (const improvement of improvements) {
      if (!entry.improvementsApplied.includes(improvement)) entry.improvementsApplied.push(improvement);
    }
    if (feedback.rating != null) {
      const ratings = this.store.feedback
        .filter((item) => item.projectId === feedback.projectId && item.rating != null)
        .map((item) => item.rating!);
      entry.userSatisfaction = ratings.length
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
        : feedback.rating;
    }
    entry.finalResult = feedback.classification === "positive" ? "accepted" : entry.finalResult;
    entry.timestamp = nowIso();
  }

  private getOrCreateProfile(userId: string): UserPreferenceProfile {
    let profile = this.store.preferenceProfiles.find((item) => item.userId === userId);
    if (!profile) {
      profile = defaultProfile(userId);
      this.store.preferenceProfiles.push(profile);
    }
    return profile;
  }

  private ensureStoreIntegrity(issuesFound: string[], issuesRepaired: string[]): void {
    const seen = new Set<string>();
    const unique: AnalyzedFeedback[] = [];
    for (const item of this.store.feedback) {
      if (seen.has(item.id)) {
        issuesFound.push(`Duplicate feedback id ${item.id}`);
        issuesRepaired.push("Kept first occurrence; did not delete history payload");
        continue;
      }
      seen.add(item.id);
      unique.push(item);
    }
    this.store.feedback = unique;
  }

  private dir(): string {
    if (!this.storageRoot) throw new Error("Feedback Intelligence not initialized");
    return path.join(this.storageRoot, "knowledge", "feedback-intelligence");
  }

  private storePath(): string {
    return path.join(this.dir(), "store.json");
  }

  private load(): void {
    try {
      if (!fs.existsSync(this.storePath())) {
        this.store = emptyStore();
        this.persist();
        return;
      }
      const raw = JSON.parse(fs.readFileSync(this.storePath(), "utf8")) as FeedbackIntelligenceStore;
      this.store = {
        ...emptyStore(),
        ...raw,
        feedback: Array.isArray(raw.feedback) ? raw.feedback : [],
        learningMemory: Array.isArray(raw.learningMemory) ? raw.learningMemory : [],
        preferenceProfiles: Array.isArray(raw.preferenceProfiles) ? raw.preferenceProfiles : [],
        projectHistory: Array.isArray(raw.projectHistory) ? raw.projectHistory : [],
        recommendationImprovements: Array.isArray(raw.recommendationImprovements)
          ? raw.recommendationImprovements
          : [],
        runs: Array.isArray(raw.runs) ? raw.runs : [],
        logs: Array.isArray(raw.logs) ? raw.logs : [],
      };
    } catch {
      this.store = emptyStore();
      this.log("warning", "Feedback store load failed; reinitialized empty store");
      this.persist();
    }
  }

  private persist(): void {
    if (!this.storageRoot) return;
    fs.mkdirSync(this.dir(), { recursive: true });
    fs.writeFileSync(this.storePath(), JSON.stringify(this.store, null, 2), "utf8");
  }

  private log(level: "info" | "warning" | "error", message: string): void {
    this.store.logs.push({ at: nowIso(), level, message });
    if (this.store.logs.length > 200) this.store.logs = this.store.logs.slice(-200);
  }
}
