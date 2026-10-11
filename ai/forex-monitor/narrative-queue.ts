/**
 * Optional narrative queue — does not block monitoring ticks.
 */
import type { ForexAiAnalyzeResult } from "../forex-ai/types.js";
import type { ForexAiEvidencePack } from "../forex-ai/evidence/types.js";
import { resolveForexMonitorLimits } from "./limits.js";
import type { ForexMonitorNarrative, NarrativeStatus } from "./types.js";

export interface NarrativeQueueItem {
  sessionId: string;
  eventId: string;
  generation: number;
  evidencePack: ForexAiEvidencePack;
  provider: string;
  symbol: string;
  timeframe: string;
}

export type RunNarrativeFn = (item: NarrativeQueueItem) => Promise<ForexAiAnalyzeResult>;

export interface NarrativeCompletePayload {
  sessionId: string;
  eventId: string;
  generation: number;
  status: NarrativeStatus;
  analysisId?: string | null;
  summary?: string | null;
  latencyMs?: number | null;
  error?: string | null;
}

export type NarrativeCompleteCallback = (payload: NarrativeCompleteCallbackPayload) => void;

export interface NarrativeCompleteCallbackPayload extends NarrativeCompletePayload {
  narrative: ForexMonitorNarrative;
}

async function defaultRunNarrative(item: NarrativeQueueItem): Promise<ForexAiAnalyzeResult> {
  const { runForexMarketAnalysis } = await import("../forex-ai/orchestrator.js");
  const limits = resolveForexMonitorLimits();
  return runForexMarketAnalysis(
    {
      symbol: item.symbol,
      timeframe: item.timeframe,
      provider: item.provider as "BINANCE" | "FXCM" | "FOREXCONNECT",
      analysisType: "MARKET_STRUCTURE",
      timeoutMs: limits.NARRATIVE_TIMEOUT_MS,
    },
    {},
  );
}

export class ForexMonitorNarrativeQueue {
  private readonly limits = resolveForexMonitorLimits();
  private readonly queue: NarrativeQueueItem[] = [];
  private active = 0;
  private readonly inFlight = new Set<string>();
  private readonly runNarrative: RunNarrativeFn;
  private readonly onComplete: NarrativeCompleteCallback | null;

  constructor(options?: {
    runNarrative?: RunNarrativeFn;
    onComplete?: NarrativeCompleteCallback;
    limits?: ReturnType<typeof resolveForexMonitorLimits>;
  }) {
    this.runNarrative = options?.runNarrative ?? defaultRunNarrative;
    this.onComplete = options?.onComplete ?? null;
    if (options?.limits) {
      Object.assign(this.limits, options.limits);
    }
  }

  enqueue(item: NarrativeQueueItem): boolean {
    if (this.inFlight.has(item.eventId)) {
      return false;
    }
    const dup = this.queue.findIndex((q) => q.eventId === item.eventId);
    if (dup >= 0) {
      this.queue.splice(dup, 1);
    }
    this.queue.push(item);
    while (this.queue.length > this.limits.MAX_NARRATIVE_QUEUE) {
      this.queue.shift();
    }
    void this.pump();
    return true;
  }

  private async pump(): Promise<void> {
    if (this.active >= this.limits.MAX_NARRATIVE_CONCURRENCY) return;
    const next = this.queue.shift();
    if (!next) return;
    this.active += 1;
    this.inFlight.add(next.eventId);
    const started = Date.now();
    try {
      const result = await Promise.race([
        this.runNarrative(next),
        new Promise<ForexAiAnalyzeResult>((_, reject) => {
          setTimeout(
            () => reject(new Error("NARRATIVE_TIMEOUT")),
            this.limits.NARRATIVE_TIMEOUT_MS,
          );
        }),
      ]);
      const latencyMs = Date.now() - started;
      const status: NarrativeStatus = result.ok ? "COMPLETED" : "FAILED";
      this.finish(next, {
        status,
        analysisId: result.analysis?.analysisId ?? null,
        summary: result.analysis?.summary ?? null,
        latencyMs,
        error: result.ok ? null : result.error ?? result.code,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const status: NarrativeStatus = msg.includes("TIMEOUT") ? "TIMEOUT" : "FAILED";
      this.finish(next, {
        status,
        analysisId: null,
        summary: null,
        latencyMs: Date.now() - started,
        error: msg,
      });
    } finally {
      this.inFlight.delete(next.eventId);
      this.active -= 1;
      void this.pump();
    }
  }

  private finish(
    item: NarrativeQueueItem,
    outcome: {
      status: NarrativeStatus;
      analysisId: string | null;
      summary: string | null;
      latencyMs: number;
      error: string | null;
    },
  ): void {
    const narrative: ForexMonitorNarrative = {
      status: outcome.status,
      analysisId: outcome.analysisId,
      summary: outcome.summary,
      latencyMs: outcome.latencyMs,
      error: outcome.error,
      eventId: item.eventId,
      generation: item.generation,
      completedAt: new Date().toISOString(),
    };
    this.onComplete?.({
      sessionId: item.sessionId,
      eventId: item.eventId,
      generation: item.generation,
      status: outcome.status,
      analysisId: outcome.analysisId,
      summary: outcome.summary,
      latencyMs: outcome.latencyMs,
      error: outcome.error,
      narrative,
    });
  }

  pendingCount(): number {
    return this.queue.length + this.active;
  }
}
