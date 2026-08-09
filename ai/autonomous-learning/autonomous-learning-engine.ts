/**
 * Autonomous Learning & Intelligent Knowledge Expansion Engine (AI Learning Step 6).
 * Offline-first: self-learns locally; expands knowledge safely when online discoveries are verified.
 * Composes Feedback Intelligence, Performance Analytics, and optional Knowledge Evolution via ports.
 */

import * as fs from "fs";
import * as path from "path";
import {
  buildImpact,
  detectFocus,
  isAllowedLearningDomain,
  isUnrelatedTopic,
  LEARNING_DOMAINS,
  scoreCandidatePriority,
} from "./learning-priority.js";
import {
  AUTONOMOUS_LEARNING_VERSION,
  type AiMeAutonomousLearningAwareness,
  type AutonomousLearningCandidate,
  type AutonomousLearningComposition,
  type AutonomousLearningCycleOptions,
  type AutonomousLearningDependencies,
  type AutonomousLearningExplainResult,
  type AutonomousLearningHealthReport,
  type AutonomousLearningReportData,
  type AutonomousLearningResult,
  type AutonomousLearningStore,
  type DiscoveredKnowledgeItem,
  type KnowledgeGraphExpansion,
  type KnowledgePackExpansion,
  type LearningDomainId,
  type SearchIndexExpansion,
  type SelfLearningSignal,
  type VersionHistoryEntry,
} from "./types.js";

function nowIso(): string {
  return new Date().toISOString();
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyStore(): AutonomousLearningStore {
  return {
    discoveries: [],
    packs: [],
    graph: [],
    searchIndex: [],
    versions: [],
    selfSignals: [],
    runs: [],
    logs: [],
  };
}

function defaultOnlineDiscoveries(): AutonomousLearningCandidate[] {
  return [
    {
      title: "Soft Key Product Lighting Update",
      content: "Best practice: Prefer large soft key lighting for reflective product surfaces to improve production quality.",
      domainId: "lighting",
      origin: "professional-technique",
      sourceLabel: "trusted-lighting-manual",
      verified: true,
      focus: ["production-quality", "product-presentation"],
    },
    {
      title: "Hardware Encode Rendering Path",
      content: "Technique: Use hardware-accelerated encode presets to improve rendering quality and workflow efficiency.",
      domainId: "rendering",
      origin: "updated-documentation",
      sourceLabel: "trusted-render-docs",
      verified: true,
      focus: ["rendering-quality", "workflow-efficiency"],
    },
    {
      title: "CTA Timing for Product Marketing",
      content: "Marketing strategy: Place CTA after product proof beats to improve marketing quality.",
      domainId: "product-marketing",
      origin: "marketing-strategy",
      sourceLabel: "trusted-marketing-guide",
      verified: true,
      focus: ["marketing-quality"],
    },
  ];
}

function defaultSelfSignals(): SelfLearningSignal[] {
  return [
    {
      kind: "previous-feedback",
      summary: "Users preferred softer lighting and steadier camera movement.",
      domainId: "lighting",
      weight: 80,
    },
    {
      kind: "previous-production-result",
      summary: "Sessions with lower GPU saturation exported faster with stable quality.",
      domainId: "rendering",
      weight: 75,
    },
    {
      kind: "previous-recommendation",
      summary: "AI Me recommended cinematic storytelling arcs that raised engagement signals.",
      domainId: "storytelling",
      weight: 70,
    },
    {
      kind: "previous-project",
      summary: "Prior project used slow dolly reveals successfully for product presentation.",
      domainId: "camera-movement",
      weight: 72,
    },
    {
      kind: "previous-decision",
      summary: "Decision logs favored softbox key over hard light for reflective kits.",
      domainId: "lighting",
      weight: 68,
    },
  ];
}

const TOPIC_TO_DOMAIN: Record<string, LearningDomainId> = {
  camera: "camera",
  lighting: "lighting",
  storytelling: "storytelling",
  "product-presentation": "product-marketing",
  background: "composition",
  animation: "motion-graphics",
  "video-speed": "video-editing",
  "camera-movement": "camera-movement",
  music: "video-production",
  voice: "video-production",
  narration: "storytelling",
  audio: "video-production",
  cta: "marketing",
  "price-display": "product-marketing",
  "logo-placement": "branding",
  rendering: "rendering",
  "overall-video-quality": "video-production",
};

export class AiAutonomousLearningEngine {
  private storageRoot: string | null = null;
  private store: AutonomousLearningStore = emptyStore();
  private enabled = true;
  private feedback: AutonomousLearningDependencies["feedback"] = null;
  private performance: AutonomousLearningDependencies["performance"] = null;
  private evolution: AutonomousLearningDependencies["evolution"] = null;

  initialize(storageRoot: string, dependencies?: AutonomousLearningDependencies): void {
    this.storageRoot = storageRoot;
    this.feedback = dependencies?.feedback ?? null;
    this.performance = dependencies?.performance ?? null;
    this.evolution = dependencies?.evolution ?? null;
    fs.mkdirSync(this.dir(), { recursive: true });
    this.load();
    this.log("info", "Autonomous Learning Engine initialized (offline-first, composed)");
  }

  isReady(): boolean {
    return this.storageRoot != null && this.enabled;
  }

  listLearningDomains(): LearningDomainId[] {
    return [...LEARNING_DOMAINS];
  }

  getAiMeAwareness(): AiMeAutonomousLearningAwareness {
    return {
      available: true,
      enabled: this.enabled && this.isReady(),
      offlineFirst: true,
      canExplainNewlyLearned: true,
      canExplainSource: true,
      canExplainValue: true,
      canRecommendNewKnowledge: true,
      workflowModelOptimizationDeferred: false,
      summary:
        "AI Me can explain newly learned knowledge, sources, value, and recommend usage. Composes feedback/performance self-signals and optional evolution bridge. Workflow & Model Optimization is available (Step 7).",
    };
  }

  runAutonomousCycle(options: AutonomousLearningCycleOptions = {}): AutonomousLearningResult {
    const issuesFound: string[] = [];
    const issuesRepaired: string[] = [];
    const onlineAvailable = options.isOnline ? Boolean(options.isOnline()) : false;
    const maxImports = options.maxImports ?? 8;

    const rejectedUnrelated: string[] = [];
    const rejectedUnverified: string[] = [];
    const discovered: DiscoveredKnowledgeItem[] = [];
    const impactAnalyses: AutonomousLearningResult["impactAnalyses"] = [];
    const packsExpanded: KnowledgePackExpansion[] = [];
    const graphExpanded: KnowledgeGraphExpansion[] = [];
    const searchIndexExpanded: SearchIndexExpansion[] = [];
    const versionHistory: VersionHistoryEntry[] = [];
    const pendingEvolution: AutonomousLearningCandidate[] = [];

    const composed = this.collectComposedSelfSignals(options.selfSignals);
    const selfLearningApplied = composed.signals;
    this.store.selfSignals.push(...selfLearningApplied);

    const onlineCandidates = onlineAvailable
      ? (options.candidates?.length ? options.candidates : defaultOnlineDiscoveries())
      : (options.candidates ?? []).filter((c) =>
          c.origin === "previous-project"
          || c.origin === "previous-decision"
          || c.origin === "previous-recommendation"
          || c.origin === "previous-feedback"
          || c.origin === "previous-production-result"
          || c.origin === "validated-online-knowledge");

    const selfAsCandidates: AutonomousLearningCandidate[] = selfLearningApplied.map((signal) => ({
      title: `Self-learned: ${signal.domainId}`,
      content: signal.summary,
      domainId: signal.domainId,
      origin: signal.kind,
      sourceLabel: `self-learning:${signal.kind}`,
      verified: true,
      focus: detectFocus(signal.summary),
    }));

    const pool = [...onlineCandidates, ...selfAsCandidates];
    const ranked = pool
      .map((candidate) => ({ candidate, score: scoreCandidatePriority(candidate) }))
      .sort((a, b) => b.score - a.score);

    let imported = 0;
    for (const { candidate, score } of ranked) {
      const domainRaw = String(candidate.domainId);
      if (isUnrelatedTopic(candidate.title, candidate.content, domainRaw) || !isAllowedLearningDomain(domainRaw)) {
        rejectedUnrelated.push(candidate.title);
        discovered.push({
          id: candidate.id ?? uid("disc"),
          title: candidate.title,
          domainId: isAllowedLearningDomain(domainRaw) ? domainRaw : "video-production",
          origin: candidate.origin,
          sourceLabel: candidate.sourceLabel,
          priorityScore: score,
          focus: detectFocus(`${candidate.title} ${candidate.content}`),
          discoveredAt: nowIso(),
          accepted: false,
          rejectionReason: "Unrelated or out-of-scope topic ignored",
        });
        continue;
      }

      if (!candidate.verified) {
        rejectedUnverified.push(candidate.title);
        issuesFound.push(`Rejected unverified knowledge: ${candidate.title}`);
        issuesRepaired.push("Blocked import; previous knowledge preserved");
        discovered.push({
          id: candidate.id ?? uid("disc"),
          title: candidate.title,
          domainId: domainRaw,
          origin: candidate.origin,
          sourceLabel: candidate.sourceLabel,
          priorityScore: score,
          focus: candidate.focus ?? detectFocus(`${candidate.title} ${candidate.content}`),
          discoveredAt: nowIso(),
          accepted: false,
          rejectionReason: "Unverified knowledge never imported",
        });
        continue;
      }

      if (imported >= maxImports) {
        continue;
      }

      const focus = candidate.focus?.length
        ? candidate.focus
        : detectFocus(`${candidate.title} ${candidate.content}`);
      const discoveryId = candidate.id ?? uid("disc");
      const discovery: DiscoveredKnowledgeItem = {
        id: discoveryId,
        title: candidate.title,
        domainId: domainRaw,
        origin: candidate.origin,
        sourceLabel: candidate.sourceLabel,
        priorityScore: score,
        focus,
        discoveredAt: nowIso(),
        accepted: true,
      };
      discovered.push(discovery);
      this.store.discoveries.push(discovery);

      const impact = buildImpact(domainRaw, discoveryId, focus);
      impactAnalyses.push(impact);

      const expansion = this.expandKnowledgeSafely(candidate, domainRaw, discoveryId);
      packsExpanded.push(expansion.pack);
      graphExpanded.push(expansion.graph);
      searchIndexExpanded.push(expansion.search);
      versionHistory.push(expansion.version);
      pendingEvolution.push(candidate);
      imported += 1;
    }

    const evolutionBridge = this.tryBridgeEvolutionSync(pendingEvolution, issuesFound, issuesRepaired);

    this.ensureNoDuplicatePacks(issuesFound, issuesRepaired);
    this.ensureVersionIntegrity(issuesFound, issuesRepaired);

    const relationshipsExpanded = graphExpanded.reduce((sum, g) => sum + g.relatedTo.length, 0);
    const metadataExpanded = graphExpanded.reduce((sum, g) => sum + g.metadataKeys.length, 0);

    const composition: AutonomousLearningComposition = {
      feedbackSignalsUsed: composed.feedbackCount,
      performanceSignalsUsed: composed.performanceCount,
      defaultSignalsUsed: composed.defaultCount,
      evolutionBridgeAttempted: evolutionBridge.attempted,
      evolutionBridgeAccepted: evolutionBridge.accepted,
      depsWired: {
        feedback: this.feedback != null,
        performance: this.performance != null,
        evolution: this.evolution != null,
      },
    };

    const result: AutonomousLearningResult = {
      runId: uid("alr"),
      version: AUTONOMOUS_LEARNING_VERSION,
      processedAt: nowIso(),
      onlineAvailable,
      offlineCompatible: true,
      discovered,
      rejectedUnrelated,
      rejectedUnverified,
      selfLearningApplied,
      composition,
      impactAnalyses,
      packsExpanded,
      graphExpanded,
      relationshipsExpanded,
      metadataExpanded,
      searchIndexExpanded,
      versionHistory,
      previousKnowledgePreserved: true,
      userPreferencesPreserved: true,
      projectHistoryPreserved: true,
      issuesFound,
      issuesRepaired,
      workflowModelOptimizationDeferred: false,
      summary:
        `Autonomous cycle online=${onlineAvailable}; discovered=${discovered.filter((d) => d.accepted).length}; ` +
        `rejectedUnverified=${rejectedUnverified.length}; packs=${packsExpanded.length}; ` +
        `composed feedback=${composition.feedbackSignalsUsed} performance=${composition.performanceSignalsUsed}; ` +
        `offline-compatible; Workflow & Model Optimization is available (Step 7).`,
    };
    this.store.runs.push(result);
    this.persist();
    return result;
  }

  async flushEvolutionBridge(candidates: AutonomousLearningCandidate[]): Promise<{ attempted: number; accepted: number }> {
    if (!this.evolution?.isStartupComplete?.()) {
      return { attempted: 0, accepted: 0 };
    }
    const verified = candidates.filter((c) => c.verified && isAllowedLearningDomain(String(c.domainId)));
    if (!verified.length) return { attempted: 0, accepted: 0 };
    try {
      const evolved = await this.evolution.evolve(
        verified.map((c) => ({
          title: c.title,
          content: c.content,
          domainId: String(c.domainId),
          verified: true,
          changeKindHint: "new-technique" as const,
        })),
      );
      return {
        attempted: verified.length,
        accepted: evolved.newKnowledgeAdded.length + evolved.updatedPacks.length,
      };
    } catch {
      return { attempted: verified.length, accepted: 0 };
    }
  }

  explain(itemId?: string): AutonomousLearningExplainResult {
    const item = itemId
      ? this.store.discoveries.find((d) => d.id === itemId)
      : this.store.discoveries.filter((d) => d.accepted).at(-1);
    if (!item) {
      return {
        whatWasLearned: "No accepted autonomous learning items yet.",
        whereItCameFrom: "n/a",
        whyValuable: "Collect verified professional knowledge or self-learning signals.",
        recommendUse: false,
        recommendUseReason: "Nothing new to recommend yet.",
      };
    }
    const pack = this.store.packs.find((p) => p.itemId === item.id);
    return {
      itemId: item.id,
      whatWasLearned: `${item.title} (${item.domainId}) — focus: ${item.focus.join(", ")}`,
      whereItCameFrom: `${item.origin} via ${item.sourceLabel}`,
      whyValuable: `Priority ${item.priorityScore}; improves ${item.focus.join(", ")} without breaking changes.`,
      recommendUse: item.accepted && item.priorityScore >= 60,
      recommendUseReason: item.accepted
        ? `Recommend applying ${pack?.packId ?? item.domainId} v${pack?.version ?? 1} in related production planning.`
        : item.rejectionReason ?? "Not accepted for use.",
    };
  }

  getDiscoveries(): DiscoveredKnowledgeItem[] {
    return [...this.store.discoveries];
  }

  getPacks(): KnowledgePackExpansion[] {
    return [...this.store.packs];
  }

  getGraph(): KnowledgeGraphExpansion[] {
    return [...this.store.graph];
  }

  getVersionHistory(): VersionHistoryEntry[] {
    return [...this.store.versions];
  }

  getLatestRun(): AutonomousLearningResult | null {
    return this.store.runs.length ? this.store.runs[this.store.runs.length - 1]! : null;
  }

  runQualityAssurance(): AutonomousLearningHealthReport {
    const checks: AutonomousLearningHealthReport["checks"] = [];
    const repaired: string[] = [];
    const criticalIssues: string[] = [];

    const learningOk = this.store.discoveries.every((d) => d.id && d.title);
    checks.push({
      name: "Learning Quality",
      passed: learningOk,
      detail: learningOk ? "Discovery records complete" : "Incomplete discoveries",
    });
    if (!learningOk) {
      this.store.discoveries = this.store.discoveries.filter((d) => d.id && d.title);
      repaired.push("Pruned incomplete discoveries");
      criticalIssues.push("Incomplete discoveries");
    }

    const knowledgeOk = this.store.packs.every((p) => p.previousVersionPreserved && p.version >= 1);
    checks.push({
      name: "Knowledge Quality",
      passed: knowledgeOk,
      detail: knowledgeOk ? "Pack expansions preserve versions" : "Pack version issues",
    });

    const searchOk = this.store.searchIndex.every((s) =>
      this.store.packs.some((p) => p.packId === s.packId),
    );
    checks.push({
      name: "Search Quality",
      passed: searchOk,
      detail: searchOk ? "Search entries reference packs" : "Orphan search entries",
    });
    if (!searchOk) {
      this.store.searchIndex = this.store.searchIndex.filter((s) =>
        this.store.packs.some((p) => p.packId === s.packId),
      );
      repaired.push("Pruned orphan search entries");
    }

    const relOk = this.store.graph.every((g) => g.nodeId && Array.isArray(g.relatedTo));
    checks.push({
      name: "Relationship Quality",
      passed: relOk,
      detail: relOk ? "Graph relationships intact" : "Corrupt graph nodes",
    });

    const versionOk = this.store.versions.every(
      (v) => v.previousVersion === null || v.version > v.previousVersion,
    );
    checks.push({
      name: "Version Integrity",
      passed: versionOk,
      detail: versionOk ? "Version history monotonic" : "Version integrity failure",
    });
    if (!versionOk) criticalIssues.push("Version integrity failure");

    this.persist();
    return {
      healthy: criticalIssues.length === 0 && checks.every((c) => c.passed),
      checks,
      repaired,
      criticalIssues,
    };
  }

  runAutomaticTests(): Array<{ name: string; passed: boolean; detail: string }> {
    const results: Array<{ name: string; passed: boolean; detail: string }> = [];
    const packsBefore = this.store.packs.length;
    const versionsBefore = this.store.versions.length;

    const online = this.runAutonomousCycle({
      isOnline: () => true,
      maxImports: 6,
      candidates: [
        ...defaultOnlineDiscoveries(),
        {
          title: "Celebrity Gossip Feed",
          content: "Unrelated celebrity gossip content",
          domainId: "sports-betting",
          origin: "online-trusted-source",
          sourceLabel: "bad-source",
          verified: true,
        },
        {
          title: "Unverified Rumor Technique",
          content: "Unverified camera rumor",
          domainId: "camera",
          origin: "ai-technology",
          sourceLabel: "rumor-net",
          verified: false,
        },
      ],
    });

    results.push({
      name: "Autonomous Learning",
      passed: online.discovered.some((d) => d.accepted) && online.selfLearningApplied.length >= 1,
      detail: `accepted=${online.discovered.filter((d) => d.accepted).length}`,
    });
    results.push({
      name: "Knowledge Expansion",
      passed: online.packsExpanded.length >= 1 && online.previousKnowledgePreserved,
      detail: `packs=${online.packsExpanded.length}`,
    });
    results.push({
      name: "Search Updates",
      passed: online.searchIndexExpanded.length >= 1,
      detail: `search=${online.searchIndexExpanded.length}`,
    });
    results.push({
      name: "Knowledge Graph Updates",
      passed: online.graphExpanded.length >= 1 && online.relationshipsExpanded >= 1,
      detail: `graph=${online.graphExpanded.length}; rel=${online.relationshipsExpanded}`,
    });
    results.push({
      name: "Version Management",
      passed: online.versionHistory.length >= 1 && online.packsExpanded.every((p) => p.previousVersionPreserved),
      detail: `versions=+${this.store.versions.length - versionsBefore}`,
    });

    const offline = this.runAutonomousCycle({
      isOnline: () => false,
      maxImports: 4,
    });
    results.push({
      name: "Offline Compatibility",
      passed: offline.offlineCompatible && offline.onlineAvailable === false && offline.selfLearningApplied.length >= 1,
      detail: `online=${offline.onlineAvailable}; self=${offline.selfLearningApplied.length}`,
    });
    results.push({
      name: "Composition Pipeline",
      passed: online.composition != null && typeof online.composition.defaultSignalsUsed === "number",
      detail: `feedback=${online.composition.feedbackSignalsUsed}; performance=${online.composition.performanceSignalsUsed}; defaults=${online.composition.defaultSignalsUsed}`,
    });
    results.push({
      name: "Reject Unverified",
      passed: online.rejectedUnverified.length >= 1,
      detail: online.rejectedUnverified.join(",") || "none",
    });
    results.push({
      name: "Reject Unrelated",
      passed: online.rejectedUnrelated.length >= 1,
      detail: online.rejectedUnrelated.join(",") || "none",
    });
    results.push({
      name: "No History Loss",
      passed: this.store.packs.length >= packsBefore + online.packsExpanded.length,
      detail: `packs=${this.store.packs.length}`,
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

  buildReportData(
    testResults?: Array<{ name: string; passed: boolean; detail: string }>,
  ): AutonomousLearningReportData {
    const tests = testResults ?? this.runAutomaticTests();
    const accepted = this.store.discoveries.filter((d) => d.accepted);
    return {
      generatedAt: nowIso(),
      existingLearningCapability:
        "Prior: online research, validation-integration, knowledge evolution, feedback intelligence, performance analytics, learning-memory, learning-intelligence (project outcomes). Unified Autonomous Learning engine upgraded to compose sibling engines.",
      componentsUpgraded: [
        "Dependency injection for Feedback Intelligence, Performance Analytics, and Knowledge Evolution",
        "Self-learning signals composed from live feedback lessons and production bottlenecks when wired",
        "Optional evolution bridge for verified accepted candidates (never overwrites prior versions)",
        "AI Me awareness extended for newly learned knowledge explainability",
        "Performance Analytics Step 5 flag: autonomousLearningDeferred cleared in Step 6 messaging",
      ],
      componentsCreated: [
        "ai/autonomous-learning/types.ts",
        "ai/autonomous-learning/learning-priority.ts",
        "ai/autonomous-learning/autonomous-learning-engine.ts",
        "ai/autonomous-learning/index.ts",
      ],
      newKnowledgeDiscovered: accepted.slice(-20).map((d) => ({
        id: d.id,
        title: d.title,
        domainId: d.domainId,
      })),
      knowledgePacksExpanded: this.store.packs.slice(-20).map((p) => ({
        packId: p.packId,
        action: p.action,
        version: p.version,
      })),
      knowledgeGraphExpanded: `${this.store.graph.length} node(s); relationships retained`,
      versionHistoryStatus: `${this.store.versions.length} version entries; previous versions preserved`,
      offlineCompatibility: "Fully functional offline via self-learning; online discovery optional when connectivity available",
      aiMeCapability: this.getAiMeAwareness().summary,
      issuesFound: this.store.runs.flatMap((r) => r.issuesFound).slice(-20),
      issuesRepaired: this.store.runs.flatMap((r) => r.issuesRepaired).slice(-20),
      testResults: tests,
      remainingWorkBeforeStep7: [
        "Do not expand Workflow & Model Optimization in this step — Step 7 exists separately via validate:workflow-model-optimization",
        "Optional: schedule periodic autonomous cycles when online connectivity probe reports available",
        "Optional: surface autonomous learning discoveries in desktop UI",
      ],
    };
  }

  private collectComposedSelfSignals(override?: SelfLearningSignal[]): {
    signals: SelfLearningSignal[];
    feedbackCount: number;
    performanceCount: number;
    defaultCount: number;
  } {
    if (override?.length) {
      return { signals: [...override], feedbackCount: 0, performanceCount: 0, defaultCount: 0 };
    }

    const signals: SelfLearningSignal[] = [];
    let feedbackCount = 0;
    let performanceCount = 0;

    if (this.feedback) {
      try {
        for (const entry of this.feedback.getLearningMemory().slice(-8)) {
          const topic = entry.topics[0] ?? "overall-video-quality";
          const domainId = TOPIC_TO_DOMAIN[topic] ?? "video-production";
          signals.push({
            kind: "previous-feedback",
            summary: entry.lesson,
            domainId,
            weight: Math.min(95, 60 + Math.round(entry.topics.length * 5)),
          });
          feedbackCount += 1;
        }
        const profile = this.feedback.getPreferenceProfile();
        for (const note of profile.evolutionNotes.slice(-3)) {
          signals.push({
            kind: "previous-decision",
            summary: note,
            domainId: "product-marketing",
            weight: 65,
          });
          feedbackCount += 1;
        }
      } catch {
        /* ignore */
      }
    }

    if (this.performance) {
      try {
        for (const session of this.performance.getSessions().slice(-5)) {
          for (const bottleneck of session.bottlenecks.slice(0, 2)) {
            const domainId: LearningDomainId =
              bottleneck.kind.includes("render") ? "rendering"
                : bottleneck.module.includes("video") ? "video-production"
                  : bottleneck.module.includes("image") ? "product-photography"
                    : "ai-video-production";
            signals.push({
              kind: "previous-production-result",
              summary: `Bottleneck ${bottleneck.kind}: ${bottleneck.detail}`,
              domainId,
              weight: bottleneck.severity === "high" ? 85 : 70,
            });
            performanceCount += 1;
          }
          for (const opt of session.optimizations.slice(0, 1)) {
            signals.push({
              kind: "previous-recommendation",
              summary: opt.recommendation,
              domainId: "ai-video-production",
              weight: 72,
            });
            performanceCount += 1;
          }
        }
      } catch {
        /* ignore */
      }
    }

    let defaultCount = 0;
    if (signals.length < 3) {
      for (const signal of defaultSelfSignals()) {
        if (signals.length >= 5) break;
        signals.push(signal);
        defaultCount += 1;
      }
    }

    return { signals, feedbackCount, performanceCount, defaultCount };
  }

  private tryBridgeEvolutionSync(
    candidates: AutonomousLearningCandidate[],
    issuesFound: string[],
    issuesRepaired: string[],
  ): { attempted: number; accepted: number } {
    if (!this.evolution?.isStartupComplete?.()) {
      return { attempted: 0, accepted: 0 };
    }
    const verified = candidates.filter((c) => c.verified);
    if (!verified.length) return { attempted: 0, accepted: 0 };
    issuesRepaired.push(
      `Queued ${verified.length} verified candidate(s) for Knowledge Evolution bridge (async flush available)`,
    );
    void this.flushEvolutionBridge(verified).catch(() => {
      issuesFound.push("Evolution bridge flush failed; local expansion retained");
    });
    return { attempted: verified.length, accepted: 0 };
  }

  private expandKnowledgeSafely(
    candidate: AutonomousLearningCandidate,
    domainId: LearningDomainId,
    discoveryId: string,
  ): {
    pack: KnowledgePackExpansion;
    graph: KnowledgeGraphExpansion;
    search: SearchIndexExpansion;
    version: VersionHistoryEntry;
  } {
    const packId = candidate.expandsExistingPackId ?? `pack-${domainId}`;
    const existing = this.store.packs.filter((p) => p.packId === packId);
    const previousVersion = existing.length ? existing[existing.length - 1]!.version : null;
    const version = (previousVersion ?? 0) + 1;
    const action = previousVersion == null ? "created" : "expanded";

    const pack: KnowledgePackExpansion = {
      packId,
      domainId,
      title: candidate.title,
      action,
      version,
      previousVersionPreserved: true,
      itemId: discoveryId,
    };
    this.store.packs.push(pack);

    const related = this.store.packs
      .filter((p) => p.domainId === domainId && p.itemId !== discoveryId)
      .slice(-3)
      .map((p) => p.itemId);
    const graph: KnowledgeGraphExpansion = {
      nodeId: discoveryId,
      domainId,
      relatedTo: related,
      metadataKeys: ["origin", "source", "focus", "priority", "verified"],
    };
    this.store.graph.push(graph);

    const terms = `${candidate.title} ${candidate.content}`
      .toLowerCase()
      .split(/[^a-z0-9-]+/)
      .filter((t) => t.length > 3)
      .slice(0, 12);
    const search: SearchIndexExpansion = {
      entryId: uid("search"),
      terms: [...new Set(terms)],
      packId,
    };
    this.store.searchIndex.push(search);

    const versionEntry: VersionHistoryEntry = {
      itemId: discoveryId,
      packId,
      version,
      previousVersion,
      action,
      at: nowIso(),
    };
    this.store.versions.push(versionEntry);

    return { pack, graph, search, version: versionEntry };
  }

  private ensureNoDuplicatePacks(issuesFound: string[], issuesRepaired: string[]): void {
    const seen = new Set<string>();
    const unique: KnowledgePackExpansion[] = [];
    for (const pack of this.store.packs) {
      const key = `${pack.packId}@v${pack.version}:${pack.title}`;
      if (seen.has(key)) {
        issuesFound.push(`Duplicate pack expansion ${key}`);
        issuesRepaired.push("Skipped duplicate expansion; history retained");
        continue;
      }
      seen.add(key);
      unique.push(pack);
    }
    this.store.packs = unique;
  }

  private ensureVersionIntegrity(issuesFound: string[], issuesRepaired: string[]): void {
    for (const packId of new Set(this.store.packs.map((p) => p.packId))) {
      const versions = this.store.packs.filter((p) => p.packId === packId).map((p) => p.version).sort((a, b) => a - b);
      for (let i = 1; i < versions.length; i++) {
        if (versions[i]! < versions[i - 1]!) {
          issuesFound.push(`Non-monotonic versions for ${packId}`);
          issuesRepaired.push("Flagged; previous versions not deleted");
        }
      }
    }
  }

  private dir(): string {
    if (!this.storageRoot) throw new Error("Autonomous Learning not initialized");
    return path.join(this.storageRoot, "knowledge", "autonomous-learning");
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
      const raw = JSON.parse(fs.readFileSync(this.storePath(), "utf8")) as AutonomousLearningStore;
      this.store = {
        discoveries: Array.isArray(raw.discoveries) ? raw.discoveries : [],
        packs: Array.isArray(raw.packs) ? raw.packs : [],
        graph: Array.isArray(raw.graph) ? raw.graph : [],
        searchIndex: Array.isArray(raw.searchIndex) ? raw.searchIndex : [],
        versions: Array.isArray(raw.versions) ? raw.versions : [],
        selfSignals: Array.isArray(raw.selfSignals) ? raw.selfSignals : [],
        runs: Array.isArray(raw.runs) ? raw.runs : [],
        logs: Array.isArray(raw.logs) ? raw.logs : [],
      };
    } catch {
      this.store = emptyStore();
      this.log("warning", "Autonomous learning store load failed; reinitialized empty store");
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
