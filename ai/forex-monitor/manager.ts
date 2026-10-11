/**
 * ForexMonitorManager — shared tick loop, lifecycle, persistence.
 */
import { randomUUID } from "node:crypto";
import type { UnifiedCandleSeries } from "../market-data/providers/contracts.js";
import type { HistoricalCandlesRequest } from "../market-data/providers/market-data-service.js";
import type { ForexAiAnalyzeResult } from "../forex-ai/types.js";
import { evaluateMonitorTick, type FetchMonitorCandles } from "./evaluate.js";
import { ForexMonitorNarrativeQueue, type RunNarrativeFn } from "./narrative-queue.js";
import { resolveForexMonitorLimits, type ForexMonitorLimits } from "./limits.js";
import { ForexMonitorStore } from "./store.js";
import {
  assertTransition,
  canTransition,
  mapSetupStateToLifecycle,
} from "./transitions.js";
import {
  DEFAULT_FOREX_MONITOR_CONFIG,
  type ForexMonitorEvent,
  type ForexMonitorSession,
  type StartForexMonitorRequest,
} from "./types.js";

export { assertTransition, canTransition, ForexMonitorTransitionError } from "./transitions.js";

function sessionKey(s: Pick<ForexMonitorSession, "provider" | "environment" | "symbol" | "timeframe">): string {
  return [
    String(s.provider).toUpperCase(),
    s.environment || "default",
    s.symbol.toUpperCase(),
    s.timeframe.toLowerCase(),
  ].join("|");
}

function nowIso(): string {
  return new Date().toISOString();
}

function emptyNarrative(): ForexMonitorSession["narrative"] {
  return { status: "NONE" };
}

export function shouldApplyNarrativeResult(
  session: Pick<ForexMonitorSession, "narrativeGeneration" | "narrative">,
  payload: { generation: number; eventId: string },
): boolean {
  if ((session.narrativeGeneration ?? 0) !== payload.generation) return false;
  if (session.narrative.eventId && session.narrative.eventId !== payload.eventId) return false;
  return true;
}

export interface ForexMonitorManagerOptions {
  storageRoot?: string;
  limits?: Partial<ForexMonitorLimits>;
  fetchCandles?: FetchMonitorCandles;
  runNarrative?: RunNarrativeFn;
  pollIntervalMs?: number;
}

export interface ForexMonitorRuntimeStats {
  activeSessions: number;
  tickCount: number;
  lastTickAt: string | null;
  narrativePending: number;
}

export class ForexMonitorManager {
  private readonly store: ForexMonitorStore;
  private readonly limits: ForexMonitorLimits;
  private readonly fetchCandles?: FetchMonitorCandles;
  private readonly narrativeQueue: ForexMonitorNarrativeQueue;
  private readonly sessions = new Map<string, ForexMonitorSession>();
  private readonly activeIds = new Set<string>();
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private tickCount = 0;
  private lastTickAt: string | null = null;
  private disposed = false;
  private lastEmittedKey = new Map<string, string>();

  constructor(options?: ForexMonitorManagerOptions) {
    this.limits = resolveForexMonitorLimits(options?.limits);
    this.store = new ForexMonitorStore(options?.storageRoot);
    this.fetchCandles = options?.fetchCandles;
    this.narrativeQueue = new ForexMonitorNarrativeQueue({
      runNarrative: options?.runNarrative,
      limits: this.limits,
      onComplete: (payload) => {
        void this.applyNarrativeResult(payload);
      },
    });
    const pollMs = options?.pollIntervalMs ?? this.limits.POLL_INTERVAL_MS;
    if (pollMs > 0 && pollMs < 86400_000 * 365) {
      this.tickTimer = setInterval(() => {
        void this.runTick();
      }, pollMs);
      if (typeof this.tickTimer === "object" && "unref" in this.tickTimer) {
        this.tickTimer.unref();
      }
    }
  }

  getLimits(): ForexMonitorLimits {
    return { ...this.limits };
  }

  getRuntimeStats(): ForexMonitorRuntimeStats {
    return {
      activeSessions: this.activeIds.size,
      tickCount: this.tickCount,
      lastTickAt: this.lastTickAt,
      narrativePending: this.narrativeQueue.pendingCount(),
    };
  }

  async recoverOnBoot(): Promise<number> {
    const { sessions } = await this.store.load();
    let recovered = 0;
    for (const s of sessions) {
      if (s.lifecycleState === "STOPPED") {
        this.sessions.set(s.sessionId, { ...s, workerActive: false });
        continue;
      }
      const patched: ForexMonitorSession = {
        ...s,
        lifecycleState: "STARTING",
        workerActive: false,
        narrative: s.narrative?.status === "PENDING"
          ? { ...s.narrative, status: "SKIPPED", error: "Interrupted on restart" }
          : s.narrative ?? emptyNarrative(),
      };
      this.sessions.set(s.sessionId, patched);
      this.activeIds.add(s.sessionId);
      await this.store.saveSession(patched);
      recovered += 1;
    }
    return recovered;
  }

  async start(request: StartForexMonitorRequest): Promise<ForexMonitorSession> {
    const env = request.environment ?? request.config?.environment ?? "default";
    const symbol = request.symbol.trim().toUpperCase();
    const timeframe = request.timeframe.trim().toLowerCase();
    const provider = String(request.provider).trim().toUpperCase();

    for (const s of this.sessions.values()) {
      if (
        s.lifecycleState !== "STOPPED"
        && sessionKey(s) === sessionKey({ provider, environment: env, symbol, timeframe })
      ) {
        throw new Error("DUPLICATE_ACTIVE_SESSION");
      }
    }

    const activeCount = [...this.sessions.values()].filter((s) => s.lifecycleState !== "STOPPED").length;
    if (activeCount >= this.limits.MAX_SESSIONS) {
      throw new Error("MAX_SESSIONS_REACHED");
    }

    const createdAt = nowIso();
    const session: ForexMonitorSession = {
      sessionId: randomUUID(),
      ownerKey: request.ownerKey ?? "admin",
      provider,
      environment: env,
      symbol,
      timeframe,
      config: { ...DEFAULT_FOREX_MONITOR_CONFIG, ...request.config, environment: env },
      lifecycleState: "STARTING",
      createdAt,
      updatedAt: createdAt,
      startedAt: createdAt,
      stoppedAt: null,
      lastEvaluationAt: null,
      lastValidCandleTime: null,
      lastDataUpdateAt: null,
      dataAgeMs: null,
      freshnessState: "UNKNOWN",
      lastError: null,
      evaluationCount: 0,
      lastSetupEventId: null,
      lastClosedCandleTimeEvaluated: null,
      currentSetup: null,
      lastEvidenceSummary: null,
      narrative: emptyNarrative(),
      workerActive: false,
      narrativeGeneration: 0,
      failureBackoffMs: this.limits.FAILURE_BACKOFF_MS,
      nextEvalAfterMs: 0,
    };

    this.sessions.set(session.sessionId, session);
    this.activeIds.add(session.sessionId);
    await this.store.saveSession(session);
    await this.emitEvent(session, "SESSION_STARTED", null, "STARTING", "Monitor session started");
    return session;
  }

  async pause(sessionId: string): Promise<ForexMonitorSession> {
    const session = this.requireSession(sessionId);
    assertTransition(session.lifecycleState, "PAUSED");
    const next = await this.patch(sessionId, { lifecycleState: "PAUSED", workerActive: false });
    await this.emitEvent(next, "SESSION_PAUSED", session.lifecycleState, "PAUSED", "Session paused");
    return next;
  }

  async resume(sessionId: string): Promise<ForexMonitorSession> {
    const session = this.requireSession(sessionId);
    if (session.lifecycleState !== "PAUSED") {
      throw new Error("NOT_PAUSED");
    }
    assertTransition(session.lifecycleState, "WATCHING");
    this.activeIds.add(sessionId);
    const next = await this.patch(sessionId, { lifecycleState: "WATCHING", workerActive: false });
    await this.emitEvent(next, "SESSION_RESUMED", "PAUSED", "WATCHING", "Session resumed");
    return next;
  }

  async stop(sessionId: string): Promise<ForexMonitorSession> {
    const session = this.requireSession(sessionId);
    assertTransition(session.lifecycleState, "STOPPED");
    this.activeIds.delete(sessionId);
    const stoppedAt = nowIso();
    const next = await this.patch(sessionId, {
      lifecycleState: "STOPPED",
      stoppedAt,
      workerActive: false,
    });
    await this.emitEvent(next, "SESSION_STOPPED", session.lifecycleState, "STOPPED", "Session stopped");
    await this.store.pruneStoppedSessions();
    return next;
  }

  getSession(sessionId: string): ForexMonitorSession | null {
    return this.sessions.get(sessionId) ?? null;
  }

  async listSessions(): Promise<ForexMonitorSession[]> {
    if (this.sessions.size === 0) {
      const listed = await this.store.listSessions();
      for (const s of listed) this.sessions.set(s.sessionId, s);
    }
    return [...this.sessions.values()];
  }

  getEvents(sessionId: string): Promise<ForexMonitorEvent[]> {
    return this.store.getEvents(sessionId);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.tickTimer = null;
    this.activeIds.clear();
  }

  private requireSession(sessionId: string): ForexMonitorSession {
    const s = this.sessions.get(sessionId);
    if (!s) throw new Error("SESSION_NOT_FOUND");
    return s;
  }

  private async patch(
    sessionId: string,
    patch: Partial<ForexMonitorSession>,
  ): Promise<ForexMonitorSession> {
    const current = this.requireSession(sessionId);
    const next: ForexMonitorSession = {
      ...current,
      ...patch,
      updatedAt: nowIso(),
    };
    this.sessions.set(sessionId, next);
    await this.store.saveSession(next);
    return next;
  }

  private async emitEvent(
    session: ForexMonitorSession,
    type: ForexMonitorEvent["type"],
    fromState: ForexMonitorLifecycleState | null,
    toState: ForexMonitorLifecycleState | null,
    message: string,
    extra?: Partial<ForexMonitorEvent>,
  ): Promise<ForexMonitorEvent | null> {
    const dedupeKey = `${type}|${fromState}|${toState}|${extra?.setupId ?? ""}|${message}`;
    if (this.lastEmittedKey.get(session.sessionId) === dedupeKey) {
      return null;
    }
    this.lastEmittedKey.set(session.sessionId, dedupeKey);
    return this.store.appendEvent({
      sessionId: session.sessionId,
      type,
      at: nowIso(),
      fromState,
      toState,
      message,
      ...extra,
    });
  }

  private async applyNarrativeResult(payload: {
    sessionId: string;
    eventId: string;
    generation: number;
    narrative: ForexMonitorSession["narrative"];
  }): Promise<void> {
    const session = this.sessions.get(payload.sessionId);
    if (!session) return;
    if ((session.narrativeGeneration ?? 0) !== payload.generation) return;
    if (session.narrative.eventId && session.narrative.eventId !== payload.eventId) return;
    await this.patch(payload.sessionId, { narrative: payload.narrative });
  }

  private maybeEnqueueNarrative(
    session: ForexMonitorSession,
    toState: ForexMonitorLifecycleState,
    event: ForexMonitorEvent | null,
    evidencePack: import("../forex-ai/evidence/types.js").ForexAiEvidencePack | null,
  ): void {
    if (!session.config.narrativeEnabled) return;
    if (!["SETUP_DETECTED", "CONFIRMED", "INVALIDATED"].includes(toState)) return;
    if (!evidencePack || !event) return;

    const generation = (session.narrativeGeneration ?? 0) + 1;
    void this.patch(session.sessionId, {
      narrativeGeneration: generation,
      narrative: {
        status: "PENDING",
        eventId: event.eventId,
        requestedAt: nowIso(),
        generation,
      },
    });

    this.narrativeQueue.enqueue({
      sessionId: session.sessionId,
      eventId: event.eventId,
      generation,
      evidencePack,
      provider: String(session.provider),
      symbol: session.symbol,
      timeframe: session.timeframe,
    });
  }

  async runTick(nowMs = Date.now()): Promise<void> {
    if (this.disposed) return;
    this.tickCount += 1;
    this.lastTickAt = new Date(nowMs).toISOString();

    for (const sessionId of [...this.activeIds]) {
      const session = this.sessions.get(sessionId);
      if (!session || session.lifecycleState === "PAUSED" || session.lifecycleState === "STOPPED") {
        continue;
      }
      if ((session.nextEvalAfterMs ?? 0) > nowMs) continue;

      const lastEval = session.lastEvaluationAt ? Date.parse(session.lastEvaluationAt) : 0;
      if (lastEval && nowMs - lastEval < this.limits.MIN_EVAL_GAP_MS && session.lifecycleState !== "STARTING") {
        continue;
      }

      await this.evaluateSession(session, nowMs);
    }
  }

  private async evaluateSession(session: ForexMonitorSession, nowMs: number): Promise<void> {
    if (this.disposed) return;
    if (session.workerActive) return;
    await this.patch(session.sessionId, { workerActive: true });

    try {
      const result = await evaluateMonitorTick(
        { session, nowMs },
        { fetchCandles: this.fetchCandles, limits: this.limits },
      );

      let next = result.session;
      const fromState = session.lifecycleState;

      if (result.error && fromState === "STARTING") {
        next = { ...next, lifecycleState: "ERROR", lastError: result.error };
      } else if (!result.skipped) {
        let target = mapSetupStateToLifecycle(
          result.setupEval.state,
          result.freshnessState,
          fromState === "STARTING" ? "WATCHING" : fromState,
        );
        // Leaving STARTING must always land on a post-start analytical/freshness state.
        if (fromState === "STARTING" && target === "STARTING") {
          target = result.freshnessState === "STALE" || result.freshnessState === "INACTIVE"
            ? "STALE"
            : result.freshnessState === "UNAVAILABLE"
              ? "ERROR"
              : (result.setupEval.state as ForexMonitorLifecycleState);
        }
        if (fromState === "STARTING" && canTransition("STARTING", target)) {
          next = { ...next, lifecycleState: target };
        } else if (fromState !== "STARTING" && target !== fromState && canTransition(fromState, target)) {
          next = { ...next, lifecycleState: target };
        } else if (fromState === "STARTING" && canTransition("STARTING", "WATCHING")) {
          next = { ...next, lifecycleState: "WATCHING" };
        }
      } else if (fromState === "STARTING" && canTransition("STARTING", "WATCHING")) {
        next = { ...next, lifecycleState: "WATCHING" };
      }

      next = {
        ...next,
        failureBackoffMs: this.limits.FAILURE_BACKOFF_MS,
        nextEvalAfterMs: 0,
      };

      this.sessions.set(session.sessionId, next);
      await this.store.saveSession(next);

      if (!result.skipped && next.lifecycleState !== fromState) {
        const ev = await this.emitEvent(
          next,
          "LIFECYCLE_TRANSITION",
          fromState,
          next.lifecycleState,
          result.setupEval.transitionReason,
          {
            setupId: next.currentSetup?.setupId ?? null,
            evidenceRefs: result.evidenceSummary?.pack.evidenceIds ?? null,
            dataFreshness: result.freshnessState,
          },
        );
        if (ev) {
          await this.patch(session.sessionId, { lastSetupEventId: ev.eventId });
          this.maybeEnqueueNarrative(next, next.lifecycleState, ev, result.evidenceSummary?.pack ?? null);
        }
      } else if (
        !result.skipped
        && next.currentSetup
        && next.currentSetup.setupId !== session.currentSetup?.setupId
      ) {
        const ev = await this.emitEvent(
          next,
          "SETUP_CHANGED",
          fromState,
          next.lifecycleState,
          result.setupEval.transitionReason,
          {
            setupId: next.currentSetup.setupId,
            evidenceRefs: result.evidenceSummary?.pack.evidenceIds ?? null,
            dataFreshness: result.freshnessState,
          },
        );
        if (ev) {
          await this.patch(session.sessionId, { lastSetupEventId: ev.eventId });
          this.maybeEnqueueNarrative(next, next.lifecycleState, ev, result.evidenceSummary?.pack ?? null);
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const backoff = Math.min(
        (session.failureBackoffMs ?? this.limits.FAILURE_BACKOFF_MS) * 2,
        this.limits.FAILURE_BACKOFF_MAX_MS,
      );
      await this.patch(session.sessionId, {
        lastError: msg,
        lifecycleState: canTransition(session.lifecycleState, "ERROR") ? "ERROR" : session.lifecycleState,
        failureBackoffMs: backoff,
        nextEvalAfterMs: nowMs + backoff,
      });
      await this.emitEvent(session, "EVAL_ERROR", session.lifecycleState, "ERROR", msg);
    } finally {
      await this.patch(session.sessionId, { workerActive: false });
    }
  }
}

type ForexMonitorLifecycleState = ForexMonitorSession["lifecycleState"];

let singleton: ForexMonitorManager | null = null;

export function getForexMonitorManager(options?: ForexMonitorManagerOptions): ForexMonitorManager {
  if (!singleton) {
    singleton = new ForexMonitorManager(options);
  }
  return singleton;
}

export function resetForexMonitorManagerForTests(): void {
  singleton?.dispose();
  singleton = null;
}

export type { HistoricalCandlesRequest, UnifiedCandleSeries, ForexAiAnalyzeResult, RunNarrativeFn };
