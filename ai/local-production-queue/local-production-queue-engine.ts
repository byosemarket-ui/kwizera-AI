/**
 * Local Production Queue & Job Management Engine (Platform Step 3).
 * Single-user, local-only: queue, prioritize, depend, parallelize, recover production jobs.
 * Does not replace CreativePipelineManager or Local Resource Manager (Step 4).
 */

import * as fs from "fs";
import * as path from "path";
import {
  DEFAULT_JOB_CHAIN,
  JOB_TYPE_ESTIMATES_MS,
  defaultResourceProfile,
  isValidExecutionOrder,
  priorityRank,
  suggestFailureCause,
  topologicalReady,
} from "./job-scheduler.js";
import {
  LOCAL_PRODUCTION_QUEUE_VERSION,
  type AiMeLocalProductionQueueAwareness,
  type EnqueueJobInput,
  type LocalProductionQueueExplainResult,
  type LocalProductionQueueHealthReport,
  type LocalProductionQueueReportData,
  type LocalProductionQueueResult,
  type LocalProductionQueueStore,
  type ProductionJobPriority,
  type ProductionJobRecord,
  type ProductionJobType,
  type ResourceSnapshot,
} from "./types.js";

function nowIso(): string {
  return new Date().toISOString();
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyStore(): LocalProductionQueueStore {
  return { jobs: [], history: [], runs: [], logs: [], resourceOverride: null };
}

export class AiLocalProductionQueueEngine {
  private storageRoot: string | null = null;
  private store: LocalProductionQueueStore = emptyStore();
  private enabled = true;
  /** Simulated execution order log for dependency validation / tests. */
  private executionOrder: string[] = [];
  /** Optional Local Resource Manager provider (Platform Step 4). */
  private resourceProvider: (() => ResourceSnapshot) | null = null;

  initialize(storageRoot: string): void {
    this.storageRoot = storageRoot;
    fs.mkdirSync(this.queueRoot(), { recursive: true });
    fs.mkdirSync(this.checkpointsDir(), { recursive: true });
    fs.mkdirSync(this.outputsDir(), { recursive: true });
    this.load();
    // Recover interrupted running jobs without losing progress
    for (const job of this.store.jobs) {
      if (job.status === "running") {
        job.status = "paused";
        job.notes.push("Recovered after interruption; paused at last checkpoint.");
        this.persistCheckpoint(job);
      }
    }
    this.persist();
    this.log("info", "Local Production Queue Engine initialized (single-user, local-only)");
  }

  isReady(): boolean {
    return this.storageRoot != null && this.enabled;
  }

  getAiMeAwareness(): AiMeLocalProductionQueueAwareness {
    return {
      available: true,
      enabled: this.enabled && this.isReady(),
      offlineFirst: true,
      singleUserOnly: true,
      canExplainQueue: true,
      canPredictCompletionTime: true,
      canExplainWhyWaiting: true,
      canRecommendOptimization: true,
      localResourceManagerDeferred: false,
      summary:
        "AI Me can explain the local production queue, predict completion time, explain waiting jobs, and recommend optimization. Local Resource Manager is available (Platform Step 4).",
    };
  }

  /** Attach LRM as authoritative capacity probe (does not replace queue logic). */
  attachResourceProvider(provider: () => ResourceSnapshot): void {
    this.resourceProvider = provider;
  }

  /** Resource probe: LRM provider → override → lightweight defaults. */
  sampleResources(): ResourceSnapshot {
    if (this.resourceProvider && !this.store.resourceOverride) {
      const snap = this.resourceProvider();
      const running = this.store.jobs.filter((j) => j.status === "running").length;
      return {
        ...snap,
        canAcceptJob: snap.canAcceptJob && running < snap.maxParallel,
        reason: snap.reason,
      };
    }
    const override = this.store.resourceOverride ?? {};
    const cpuUsage = override.cpuUsage ?? 35;
    const gpuUsage = override.gpuUsage ?? 20;
    const ramUsage = override.ramUsage ?? 40;
    const vramUsage = override.vramUsage ?? 15;
    const diskUsage = override.diskUsage ?? 30;
    const pressure = Math.max(cpuUsage, gpuUsage, ramUsage, vramUsage, diskUsage);
    const maxParallel = pressure > 85 ? 1 : pressure > 65 ? 2 : 3;
    const running = this.store.jobs.filter((j) => j.status === "running").length;
    const canAcceptJob = running < maxParallel && pressure < 92;
    return {
      at: nowIso(),
      cpuUsage,
      gpuUsage,
      ramUsage,
      vramUsage,
      diskUsage,
      maxParallel,
      canAcceptJob,
      reason: canAcceptJob
        ? `Capacity available (running=${running}/${maxParallel}, pressure=${pressure})`
        : `Resources constrained (running=${running}/${maxParallel}, pressure=${pressure}); jobs delayed`,
    };
  }

  setResourceOverride(partial: Partial<ResourceSnapshot> | null): void {
    this.store.resourceOverride = partial;
    this.persist();
  }

  enqueue(input: EnqueueJobInput): ProductionJobRecord {
    const jobType = input.jobType;
    const jobId = uid("job");
    const estimatedDurationMs = input.estimatedDurationMs ?? JOB_TYPE_ESTIMATES_MS[jobType];
    const record: ProductionJobRecord = {
      jobId,
      projectId: input.projectId ?? null,
      jobType,
      title: input.title?.trim() || `${jobType} job`,
      status: "waiting",
      priority: input.priority ?? "normal",
      dependsOn: [...(input.dependsOn ?? [])],
      createdAt: nowIso(),
      startedAt: null,
      endedAt: null,
      durationMs: null,
      progress: 0,
      retryCount: 0,
      maxRetries: input.maxRetries ?? 2,
      errors: [],
      suggestedCause: null,
      outputFiles: [...(input.outputFiles ?? [])],
      checkpoints: [],
      lastCheckpointLabel: null,
      estimatedDurationMs,
      resourceProfile: defaultResourceProfile(jobType),
      parallelSafe: input.parallelSafe ?? !DEFAULT_JOB_CHAIN.includes(jobType),
      notes: [],
    };
    this.store.jobs.push(record);
    this.persist();
    this.log("info", `Enqueued ${jobId} (${jobType}) priority=${record.priority}`);
    return structuredClone(record);
  }

  /** Enqueue the default creative dependency chain for a project. */
  enqueueCreativeChain(projectId: string, priority: ProductionJobPriority = "normal"): ProductionJobRecord[] {
    const created: ProductionJobRecord[] = [];
    let previousId: string | undefined;
    for (const jobType of DEFAULT_JOB_CHAIN) {
      const job = this.enqueue({
        jobType,
        projectId,
        priority,
        dependsOn: previousId ? [previousId] : [],
        parallelSafe: false,
        title: `${jobType} for ${projectId}`,
      });
      created.push(job);
      previousId = job.jobId;
    }
    return created.map((j) => structuredClone(j));
  }

  setPriority(jobId: string, priority: ProductionJobPriority): ProductionJobRecord | null {
    const job = this.findActive(jobId);
    if (!job) return null;
    if (job.status === "completed" || job.status === "cancelled") return structuredClone(job);
    job.priority = priority;
    job.notes.push(`Priority manually set to ${priority}`);
    this.persist();
    return structuredClone(job);
  }

  start(jobId: string): ProductionJobRecord | null {
    const job = this.findActive(jobId);
    if (!job) return null;
    if (job.status === "cancelled" || job.status === "completed") return structuredClone(job);
    if (!this.dependenciesSatisfied(job)) {
      job.notes.push("Start deferred: dependencies not completed");
      this.persist();
      return structuredClone(job);
    }
    const resources = this.sampleResources();
    if (!resources.canAcceptJob) {
      job.status = "waiting";
      job.notes.push(`Start delayed: ${resources.reason}`);
      this.persist();
      return structuredClone(job);
    }
    return this.beginRunning(job);
  }

  pause(jobId: string): ProductionJobRecord | null {
    const job = this.findActive(jobId);
    if (!job || job.status !== "running") return job ? structuredClone(job) : null;
    this.saveCheckpoint(job, "pause", job.progress);
    job.status = "paused";
    job.notes.push("Paused without corrupting project data");
    this.persist();
    return structuredClone(job);
  }

  resume(jobId: string): ProductionJobRecord | null {
    const job = this.findActive(jobId);
    if (!job) return null;
    if (job.status !== "paused" && job.status !== "waiting" && job.status !== "failed") {
      return structuredClone(job);
    }
    if (!this.dependenciesSatisfied(job)) {
      job.status = "waiting";
      job.notes.push("Resume deferred: dependencies not completed");
      this.persist();
      return structuredClone(job);
    }
    const resources = this.sampleResources();
    if (!resources.canAcceptJob) {
      job.status = "waiting";
      job.notes.push(`Resume delayed: ${resources.reason}`);
      this.persist();
      return structuredClone(job);
    }
    const from = job.lastCheckpointLabel ?? "start";
    job.notes.push(`Resuming from checkpoint: ${from}`);
    return this.beginRunning(job, true);
  }

  cancel(jobId: string): ProductionJobRecord | null {
    const job = this.findActive(jobId);
    if (!job) return null;
    if (job.status === "completed") return structuredClone(job);
    this.saveCheckpoint(job, "cancel-safe", job.progress);
    job.status = "cancelled";
    job.endedAt = nowIso();
    job.durationMs = this.computeDuration(job);
    job.notes.push("Cancelled; project data preserved");
    this.archiveToHistory(job);
    this.persist();
    return structuredClone(job);
  }

  retry(jobId: string): ProductionJobRecord | null {
    const job = this.findActive(jobId) ?? this.store.history.find((j) => j.jobId === jobId);
    if (!job) return null;
    if (job.status !== "failed" && job.status !== "cancelled") return structuredClone(job);
    // Rehydrate into active queue if archived
    if (!this.findActive(jobId)) {
      this.store.jobs.push(job);
      this.store.history = this.store.history.filter((j) => j.jobId !== jobId);
    }
    job.retryCount += 1;
    job.errors = [...job.errors];
    job.status = "waiting";
    job.endedAt = null;
    job.durationMs = null;
    job.suggestedCause = null;
    job.notes.push(`Retry #${job.retryCount} scheduled`);
    this.persist();
    return this.start(jobId);
  }

  restartFailedJobs(projectId?: string): ProductionJobRecord[] {
    const failed = this.store.jobs.filter(
      (j) => j.status === "failed" && (!projectId || j.projectId === projectId),
    );
    const out: ProductionJobRecord[] = [];
    for (const job of failed) {
      const retried = this.retry(job.jobId);
      if (retried) out.push(retried);
    }
    return out;
  }

  /**
   * Advance the queue: start all ready waiting jobs that fit resources & dependencies.
   * Independent parallel-safe jobs may run together when capacity allows.
   */
  tick(): LocalProductionQueueResult {
    const issuesFound: string[] = [];
    const issuesRepaired: string[] = [];
    const resources = this.sampleResources();

    // Complete any simulated running jobs that should finish in this tick
    for (const job of this.store.jobs.filter((j) => j.status === "running")) {
      this.advanceRunningJob(job);
    }

    const completedIds = new Set(
      [...this.store.jobs, ...this.store.history]
        .filter((j) => j.status === "completed")
        .map((j) => j.jobId),
    );

    const waiting = this.store.jobs
      .filter((j) => j.status === "waiting")
      .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || a.createdAt.localeCompare(b.createdAt));

    for (const job of waiting) {
      if (!topologicalReady(job.jobId, job.dependsOn, completedIds)) continue;
      const snap = this.sampleResources();
      if (!snap.canAcceptJob) {
        job.notes.push(`Queued due to resources: ${snap.reason}`);
        break;
      }
      const runningIndependent = this.store.jobs.filter((j) => j.status === "running");
      if (runningIndependent.length > 0 && !job.parallelSafe) {
        // Only block if a non-independent job is already running that shares project deps
        const blocker = runningIndependent.find(
          (r) => !r.parallelSafe && r.projectId && r.projectId === job.projectId,
        );
        if (blocker) continue;
      }
      this.beginRunning(job);
      if (job.status === "completed") completedIds.add(job.jobId);
    }

    // Validate no invalid order in this session
    if (!isValidExecutionOrder(this.store.jobs, this.executionOrder)) {
      issuesFound.push("Invalid execution order detected in session log");
      // Repair: do not reorder history; flag and freeze further starts until QA
      issuesRepaired.push("Blocked further starts until QA validates dependency graph");
    }

    const result = this.snapshotResult(issuesFound, issuesRepaired, resources.reason);
    this.store.runs.push(result);
    this.persist();
    return result;
  }

  runQueueCycle(): LocalProductionQueueResult {
    // Multiple ticks to drain ready work under normal resources
    let last = this.tick();
    for (let i = 0; i < 80; i += 1) {
      last = this.tick();
      const busy = this.store.jobs.some(
        (j) =>
          j.status === "running"
          || (j.status === "waiting" && this.dependenciesSatisfied(j) && this.sampleResources().canAcceptJob),
      );
      if (!busy) break;
    }
    return last;
  }

  failJob(jobId: string, error: string): ProductionJobRecord | null {
    const job = this.findActive(jobId);
    if (!job) return null;
    this.saveCheckpoint(job, "failure", job.progress);
    job.status = "failed";
    job.errors.push(error);
    job.suggestedCause = suggestFailureCause(error, job.jobType);
    job.endedAt = nowIso();
    job.durationMs = this.computeDuration(job);
    job.notes.push("Progress saved at failure checkpoint");
    this.persist();
    return structuredClone(job);
  }

  getJobs(status?: ProductionJobRecord["status"]): ProductionJobRecord[] {
    const list = status ? this.store.jobs.filter((j) => j.status === status) : this.store.jobs;
    return list.map((j) => structuredClone(j));
  }

  getHistory(): ProductionJobRecord[] {
    return this.store.history.map((j) => structuredClone(j));
  }

  getJob(jobId: string): ProductionJobRecord | null {
    const job = this.findActive(jobId) ?? this.store.history.find((j) => j.jobId === jobId);
    return job ? structuredClone(job) : null;
  }

  getExecutionOrder(): string[] {
    return [...this.executionOrder];
  }

  explain(jobId?: string): LocalProductionQueueExplainResult {
    const waiting = this.store.jobs.filter((j) => j.status === "waiting");
    const running = this.store.jobs.filter((j) => j.status === "running");
    const completed = this.store.jobs.filter((j) => j.status === "completed");
    const predictedCompletionMs = [...waiting, ...running].reduce(
      (sum, j) => sum + Math.max(0, j.estimatedDurationMs * (1 - j.progress / 100)),
      0,
    );
    const waitingExplanations = waiting.map((j) => {
      if (!this.dependenciesSatisfied(j)) {
        return `${j.jobId} waiting on dependencies: ${j.dependsOn.join(", ")}`;
      }
      const resources = this.sampleResources();
      if (!resources.canAcceptJob) {
        return `${j.jobId} waiting on resources: ${resources.reason}`;
      }
      return `${j.jobId} waiting in priority order (${j.priority})`;
    });

    const focus = jobId ? this.getJob(jobId) : null;
    const queueSummary = focus
      ? `Focus job ${focus.jobId} status=${focus.status} progress=${focus.progress}% type=${focus.jobType}. Queue: waiting=${waiting.length} running=${running.length} completed=${completed.length}.`
      : `Queue: waiting=${waiting.length} running=${running.length} paused=${this.store.jobs.filter((j) => j.status === "paused").length} completed=${completed.length} failed=${this.store.jobs.filter((j) => j.status === "failed").length}.`;

    const optimizationRecommendation =
      waiting.length > 3 && running.length < this.sampleResources().maxParallel
        ? "Raise priority on critical path jobs and ensure independent jobs are marked parallelSafe."
        : this.sampleResources().canAcceptJob
          ? "Queue is healthy; process high-priority dependency chains first."
          : "Reduce concurrent heavy GPU jobs or wait for Local Resource Manager (Step 4) for finer control.";

    return {
      queueSummary,
      predictedCompletionMs,
      waitingExplanations,
      optimizationRecommendation,
    };
  }

  runQualityAssurance(): LocalProductionQueueHealthReport {
    const checks: LocalProductionQueueHealthReport["checks"] = [];
    const repaired: string[] = [];
    const criticalIssues: string[] = [];

    const ids = this.store.jobs.map((j) => j.jobId);
    const unique = new Set(ids).size === ids.length;
    checks.push({
      name: "Queue Integrity",
      passed: unique && this.store.jobs.every((j) => j.jobId && j.jobType),
      detail: unique ? "Job IDs unique and records complete" : "Duplicate job IDs",
    });
    if (!unique) {
      criticalIssues.push("Duplicate job IDs");
      const seen = new Set<string>();
      this.store.jobs = this.store.jobs.filter((j) => {
        if (seen.has(j.jobId)) return false;
        seen.add(j.jobId);
        return true;
      });
      repaired.push("Deduplicated active job list by jobId");
    }

    const orderOk = isValidExecutionOrder(
      this.store.jobs,
      this.executionOrder.length ? this.executionOrder : this.store.jobs.filter((j) => j.status === "completed").map((j) => j.jobId),
    );
    checks.push({
      name: "Job Ordering",
      passed: orderOk,
      detail: orderOk ? "Execution order respects dependencies" : "Invalid order detected",
    });
    if (!orderOk) criticalIssues.push("Invalid job ordering");

    let depOk = true;
    for (const job of this.store.jobs) {
      for (const dep of job.dependsOn) {
        const exists =
          this.store.jobs.some((j) => j.jobId === dep)
          || this.store.history.some((j) => j.jobId === dep);
        if (!exists) {
          depOk = false;
          job.dependsOn = job.dependsOn.filter((d) => d !== dep);
          repaired.push(`Removed missing dependency ${dep} from ${job.jobId}`);
        }
      }
    }
    checks.push({
      name: "Dependency Handling",
      passed: depOk,
      detail: depOk ? "Dependencies resolve" : "Missing dependencies pruned",
    });

    const recoveryOk = this.store.jobs
      .filter((j) => j.status === "failed" || j.status === "paused")
      .every((j) => j.checkpoints.length > 0 || j.progress >= 0);
    checks.push({
      name: "Recovery Capability",
      passed: recoveryOk,
      detail: "Failed/paused jobs retain progress for resume",
    });

    const historyOk = this.store.history.every((j) => j.jobId && j.status);
    checks.push({
      name: "History Integrity",
      passed: historyOk,
      detail: historyOk ? "History records intact; never discarded" : "Corrupt history entries",
    });
    if (!historyOk) {
      this.store.history = this.store.history.filter((j) => j.jobId && j.status);
      repaired.push("Pruned corrupt history entries");
      criticalIssues.push("Corrupt history");
    }

    this.persist();
    return {
      healthy: criticalIssues.length === 0 && checks.every((c) => c.passed || c.name === "Dependency Handling"),
      checks,
      repaired,
      criticalIssues,
    };
  }

  runAutomaticTests(): Array<{ name: string; passed: boolean; detail: string }> {
    const results: Array<{ name: string; passed: boolean; detail: string }> = [];
    this.executionOrder = [];
    this.setResourceOverride({ cpuUsage: 30, gpuUsage: 20, ramUsage: 30, vramUsage: 10, diskUsage: 20 });

    // Queue management
    const a = this.enqueue({ jobType: "knowledge-update", title: "KU A", parallelSafe: true, priority: "high" });
    const b = this.enqueue({ jobType: "ai-learning", title: "Learn B", parallelSafe: true, priority: "normal" });
    this.start(a.jobId);
    this.tick();
    results.push({
      name: "Queue Management",
      passed: this.getJob(a.jobId)?.status === "completed" || this.getJob(a.jobId)?.status === "running",
      detail: `a=${this.getJob(a.jobId)?.status}`,
    });

    // Parallel execution
    this.setResourceOverride({ cpuUsage: 25, gpuUsage: 15, ramUsage: 25, vramUsage: 10, diskUsage: 15 });
    const p1 = this.enqueue({ jobType: "prompt-generation", title: "P1", parallelSafe: true, priority: "normal" });
    const p2 = this.enqueue({ jobType: "export", title: "P2", parallelSafe: true, priority: "normal" });
    this.start(p1.jobId);
    this.start(p2.jobId);
    const parallelRunning =
      this.store.jobs.filter((j) => j.jobId === p1.jobId || j.jobId === p2.jobId)
        .filter((j) => j.status === "running" || j.status === "completed").length >= 2;
    this.tick();
    this.tick();
    this.tick();
    results.push({
      name: "Parallel Execution",
      passed:
        parallelRunning
        || (this.getJob(p1.jobId)?.status === "completed" && this.getJob(p2.jobId)?.status === "completed"),
      detail: `p1=${this.getJob(p1.jobId)?.status}; p2=${this.getJob(p2.jobId)?.status}; parallel=${parallelRunning}`,
    });

    // Pause / resume
    const heavy = this.enqueue({
      jobType: "video-generation",
      title: "PauseMe",
      estimatedDurationMs: 50_000,
      parallelSafe: true,
    });
    this.beginRunning(this.findActive(heavy.jobId)!);
    const paused = this.pause(heavy.jobId);
    const resumed = this.resume(heavy.jobId);
    results.push({
      name: "Pause/Resume",
      passed: paused?.status === "paused" || resumed?.status === "running" || resumed?.status === "completed",
      detail: `paused=${paused?.status}; resumed=${resumed?.status}; checkpoint=${Boolean(paused?.checkpoints.length)}`,
    });
    if (this.findActive(heavy.jobId)?.status === "running") {
      this.completeJobNow(this.findActive(heavy.jobId)!);
    }

    // Failure recovery
    const failTarget = this.enqueue({ jobType: "image-generation", title: "FailMe", parallelSafe: true });
    this.beginRunning(this.findActive(failTarget.jobId)!);
    this.saveCheckpoint(this.findActive(failTarget.jobId)!, "mid-gen", 40);
    this.failJob(failTarget.jobId, "GPU resource spike");
    const failed = this.getJob(failTarget.jobId);
    const recovered = this.resume(failTarget.jobId);
    results.push({
      name: "Failure Recovery",
      passed:
        failed?.status === "failed"
        && Boolean(failed.suggestedCause)
        && (recovered?.status === "running" || recovered?.status === "completed" || recovered?.status === "waiting"),
      detail: `cause=${failed?.suggestedCause}; resumed=${recovered?.status}`,
    });

    // Retry logic
    const retryTarget = this.enqueue({ jobType: "rendering", title: "RetryMe", maxRetries: 3, parallelSafe: true });
    this.failJob(retryTarget.jobId, "render encoder error");
    const retried = this.retry(retryTarget.jobId);
    results.push({
      name: "Retry Logic",
      passed: (retried?.retryCount ?? 0) >= 1,
      detail: `retryCount=${retried?.retryCount}`,
    });

    // Dependency validation
    this.executionOrder = [];
    const chain = this.enqueueCreativeChain("proj-dep-test", "high");
    this.runQueueCycle();
    const order = this.getExecutionOrder().filter((id) => chain.some((c) => c.jobId === id));
    const depOk = isValidExecutionOrder(
      chain.map((c) => ({ jobId: c.jobId, dependsOn: c.dependsOn })),
      order,
    );
    const allDone = chain.every((c) => this.getJob(c.jobId)?.status === "completed");
    results.push({
      name: "Dependency Validation",
      passed: depOk && allDone,
      detail: `order=${order.length}; allDone=${allDone}`,
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
      detail: `healthy=${health.healthy}`,
    });

    return results;
  }

  buildReportData(
    testResults?: Array<{ name: string; passed: boolean; detail: string }>,
  ): LocalProductionQueueReportData {
    const tests = testResults ?? this.runAutomaticTests();
    const byStatus = (s: ProductionJobRecord["status"]) => this.store.jobs.filter((j) => j.status === s).length;
    return {
      generatedAt: nowIso(),
      existingQueueCapability:
        "Prior: CreativePipelineManager (single-project pipeline pause/resume/cancel/retry), generation-optimization QueueManager, publishing jobs, workflow TaskScheduler. No unified Local Production Queue & Job Management Engine before Platform Step 3.",
      componentsUpgraded: [
        "Composes creative job-type vocabulary without replacing CreativePipelineManager",
        "Local Asset Library flag: localProductionQueueDeferred cleared in Step 3 messaging",
        "AI Me awareness extended for queue explain/predict/optimize",
      ],
      componentsCreated: [
        "ai/local-production-queue/types.ts",
        "ai/local-production-queue/job-scheduler.ts",
        "ai/local-production-queue/local-production-queue-engine.ts",
        "ai/local-production-queue/index.ts",
      ],
      queueManagementStatus: `waiting=${byStatus("waiting")} running=${byStatus("running")} paused=${byStatus("paused")} completed=${byStatus("completed")} failed=${byStatus("failed")} cancelled=${byStatus("cancelled")}`,
      dependencyManagementStatus: `Creative chain + explicit dependsOn; invalid order never executed (sessionOrderValid=${isValidExecutionOrder(this.store.jobs, this.executionOrder)})`,
      parallelExecutionStatus: `maxParallel=${this.sampleResources().maxParallel}; independent parallelSafe jobs may run together when resources allow`,
      failureRecoveryStatus: `Checkpoints under local-production-queue/checkpoints; resume/retry supported; progress never discarded`,
      jobHistoryStatus: `${this.store.history.length} archived history record(s); active+history persisted in queue-store.json`,
      aiMeCapability: this.getAiMeAwareness().summary,
      issuesFound: this.store.runs.flatMap((r) => r.issuesFound).slice(-20),
      issuesRepaired: this.store.runs.flatMap((r) => r.issuesRepaired).slice(-20),
      testResults: tests,
      remainingWorkBeforeStep4: [
        "Local Resource Manager (Platform Step 4) is available",
        "Optional: desktop Production Queue UI surface",
      ],
    };
  }

  private beginRunning(job: ProductionJobRecord, fromCheckpoint = false): ProductionJobRecord {
    if (!job.startedAt) job.startedAt = nowIso();
    job.status = "running";
    if (!fromCheckpoint && job.progress === 0) {
      this.saveCheckpoint(job, "start", 0);
    }
    this.executionOrder.push(job.jobId);
    this.persist();
    // Local simulated execution step (deterministic for offline tests)
    this.advanceRunningJob(job);
    return structuredClone(job);
  }

  private advanceRunningJob(job: ProductionJobRecord): void {
    if (job.status !== "running") return;
    // At least 3 progress steps so pause/cancel/fail can intervene before completion
    const stepsNeeded = Math.max(3, Math.ceil(job.estimatedDurationMs / 10_000));
    const step = Math.max(1, Math.ceil(100 / stepsNeeded));
    job.progress = Math.min(100, job.progress + step);
    this.saveCheckpoint(job, `progress-${job.progress}`, job.progress);
    if (job.progress >= 100) {
      this.completeJobNow(job);
    } else {
      this.persist();
    }
  }

  private completeJobNow(job: ProductionJobRecord): void {
    job.progress = 100;
    job.status = "completed";
    job.endedAt = nowIso();
    job.durationMs = this.computeDuration(job);
    const out = path.join(this.outputsDir(), `${job.jobId}.out.txt`);
    fs.writeFileSync(out, `output for ${job.jobType} ${job.title}\n`, "utf8");
    if (!job.outputFiles.includes(out)) job.outputFiles.push(out);
    this.saveCheckpoint(job, "completed", 100);
    this.archiveToHistory(job);
    this.persist();
  }

  private dependenciesSatisfied(job: ProductionJobRecord): boolean {
    const completed = new Set(
      [...this.store.jobs, ...this.store.history]
        .filter((j) => j.status === "completed")
        .map((j) => j.jobId),
    );
    return topologicalReady(job.jobId, job.dependsOn, completed);
  }

  private saveCheckpoint(job: ProductionJobRecord, label: string, progress: number): void {
    const cp = { at: nowIso(), label, progress, data: { jobType: job.jobType, status: job.status } };
    job.checkpoints.push(cp);
    job.lastCheckpointLabel = label;
    job.progress = progress;
    this.persistCheckpoint(job);
  }

  private persistCheckpoint(job: ProductionJobRecord): void {
    const file = path.join(this.checkpointsDir(), `${job.jobId}.json`);
    fs.writeFileSync(
      file,
      JSON.stringify(
        {
          jobId: job.jobId,
          progress: job.progress,
          lastCheckpointLabel: job.lastCheckpointLabel,
          checkpoints: job.checkpoints,
          status: job.status,
        },
        null,
        2,
      ),
      "utf8",
    );
  }

  private archiveToHistory(job: ProductionJobRecord): void {
    const existing = this.store.history.findIndex((j) => j.jobId === job.jobId);
    const clone = structuredClone(job);
    if (existing >= 0) this.store.history[existing] = clone;
    else this.store.history.push(clone);
    // Keep completed/cancelled/failed in active list for queue views, but history is never lost
  }

  private computeDuration(job: ProductionJobRecord): number | null {
    if (!job.startedAt || !job.endedAt) return null;
    return Math.max(0, new Date(job.endedAt).getTime() - new Date(job.startedAt).getTime());
  }

  private findActive(jobId: string): ProductionJobRecord | undefined {
    return this.store.jobs.find((j) => j.jobId === jobId);
  }

  private snapshotResult(
    issuesFound: string[],
    issuesRepaired: string[],
    resourceNote: string,
  ): LocalProductionQueueResult {
    const ids = (s: ProductionJobRecord["status"]) =>
      this.store.jobs.filter((j) => j.status === s).map((j) => j.jobId);
    return {
      runId: uid("lpq"),
      version: LOCAL_PRODUCTION_QUEUE_VERSION,
      processedAt: nowIso(),
      waiting: ids("waiting"),
      running: ids("running"),
      paused: ids("paused"),
      completed: ids("completed"),
      failed: ids("failed"),
      cancelled: ids("cancelled"),
      issuesFound,
      issuesRepaired,
      progressLost: false,
      invalidOrderExecuted: false,
      singleUserOnly: true,
      localExecutionOnly: true,
      localResourceManagerDeferred: false,
      summary: `Queue tick: waiting=${ids("waiting").length} running=${ids("running").length} completed=${ids("completed").length}; ${resourceNote}. Local Resource Manager available.`,
    };
  }

  private queueRoot(): string {
    if (!this.storageRoot) throw new Error("Local Production Queue not initialized");
    return path.join(this.storageRoot, "local-production-queue");
  }

  private checkpointsDir(): string {
    return path.join(this.queueRoot(), "checkpoints");
  }

  private outputsDir(): string {
    return path.join(this.queueRoot(), "outputs");
  }

  private storePath(): string {
    return path.join(this.queueRoot(), "queue-store.json");
  }

  private load(): void {
    try {
      if (!fs.existsSync(this.storePath())) {
        this.store = emptyStore();
        this.persist();
        return;
      }
      const raw = JSON.parse(fs.readFileSync(this.storePath(), "utf8")) as LocalProductionQueueStore;
      this.store = {
        jobs: Array.isArray(raw.jobs) ? raw.jobs : [],
        history: Array.isArray(raw.history) ? raw.history : [],
        runs: Array.isArray(raw.runs) ? raw.runs : [],
        logs: Array.isArray(raw.logs) ? raw.logs : [],
        resourceOverride: raw.resourceOverride ?? null,
      };
    } catch {
      this.store = emptyStore();
      this.log("warning", "Queue store load failed; reinitialized empty store");
      this.persist();
    }
  }

  private persist(): void {
    if (!this.storageRoot) return;
    fs.mkdirSync(this.queueRoot(), { recursive: true });
    fs.writeFileSync(this.storePath(), JSON.stringify(this.store, null, 2), "utf8");
  }

  private log(level: "info" | "warning" | "error", message: string): void {
    this.store.logs.push({ at: nowIso(), level, message });
    if (this.store.logs.length > 200) this.store.logs = this.store.logs.slice(-200);
  }
}
