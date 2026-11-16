/**
 * STEP 2B — snapshot / sequence / batch consistency tracker (bounded).
 */
import type { HfmSnapshotBatchTracker } from "./subscription-types.js";

const MAX_SEQ_WINDOW = 64;

export interface HfmSnapshotObserveInput {
  snapshotId?: string | null;
  batchId?: string | null;
  sequence?: number | null;
  expectedBatchCount?: number | null;
  symbolsInBatch?: string[];
  expectedSymbols?: string[];
  receivedAt?: string;
}

export interface HfmSnapshotObserveResult {
  tracker: HfmSnapshotBatchTracker;
  duplicate: boolean;
  outOfOrder: boolean;
  gap: number | null;
  incomplete: boolean;
  eventWorthy: boolean;
  reason: string | null;
}

export class HfmSnapshotTracker {
  private state: HfmSnapshotBatchTracker = emptyTracker();
  private readonly seenSequences: number[] = [];
  private lastSequence: number | null = null;

  observe(input: HfmSnapshotObserveInput): HfmSnapshotObserveResult {
    const now = input.receivedAt ?? new Date().toISOString();
    let duplicate = false;
    let outOfOrder = false;
    let gap: number | null = null;
    let reason: string | null = null;
    let eventWorthy = false;

    if (input.snapshotId && input.snapshotId !== this.state.snapshotId) {
      this.state = emptyTracker();
      this.state.snapshotId = input.snapshotId;
      this.state.snapshotStartedAt = now;
      this.seenSequences.length = 0;
      this.lastSequence = null;
      eventWorthy = true;
      reason = "NEW_SNAPSHOT";
    }

    if (input.batchId) this.state.batchId = input.batchId;
    if (input.expectedBatchCount != null) this.state.expectedBatchCount = input.expectedBatchCount;

    const seq = typeof input.sequence === "number" && Number.isFinite(input.sequence) ? input.sequence : null;
    if (seq != null) {
      if (this.seenSequences.includes(seq)) {
        duplicate = true;
        this.state.duplicateSequences = [...this.state.duplicateSequences, seq].slice(-16);
        reason = "DUPLICATE_SEQUENCE";
        eventWorthy = true;
      } else {
        this.seenSequences.push(seq);
        while (this.seenSequences.length > MAX_SEQ_WINDOW) this.seenSequences.shift();
        if (this.lastSequence != null && seq < this.lastSequence) {
          outOfOrder = true;
          this.state.outOfOrder = true;
          reason = "OUT_OF_ORDER_SEQUENCE";
          eventWorthy = true;
        } else if (this.lastSequence != null && seq > this.lastSequence + 1) {
          gap = seq - this.lastSequence - 1;
          this.state.lastGap = gap;
          reason = "SEQUENCE_GAP";
          eventWorthy = true;
        }
        this.lastSequence = seq;
        this.state.sequence = seq;
        this.state.receivedBatchCount += 1;
      }
    } else {
      this.state.receivedBatchCount += 1;
    }

    const expected = input.expectedSymbols ?? [];
    const got = new Set(input.symbolsInBatch ?? []);
    const missing = expected.filter((s) => !got.has(s));
    this.state.missingSymbols = missing.slice(0, 64);

    const incomplete =
      missing.length > 0 ||
      (this.state.expectedBatchCount != null &&
        this.state.receivedBatchCount < this.state.expectedBatchCount);

    this.state.isComplete = !incomplete && !duplicate;
    if (this.state.isComplete) this.state.snapshotCompletedAt = now;
    if (incomplete) {
      reason = reason ?? "INCOMPLETE_SNAPSHOT";
      eventWorthy = true;
    }

    return {
      tracker: { ...this.state, missingSymbols: [...this.state.missingSymbols] },
      duplicate,
      outOfOrder,
      gap,
      incomplete,
      eventWorthy,
      reason,
    };
  }

  snapshot(): HfmSnapshotBatchTracker {
    return { ...this.state, missingSymbols: [...this.state.missingSymbols] };
  }

  reset(): void {
    this.state = emptyTracker();
    this.seenSequences.length = 0;
    this.lastSequence = null;
  }
}

function emptyTracker(): HfmSnapshotBatchTracker {
  return {
    snapshotId: null,
    batchId: null,
    sequence: null,
    expectedBatchCount: null,
    receivedBatchCount: 0,
    snapshotStartedAt: null,
    snapshotCompletedAt: null,
    isComplete: false,
    missingSymbols: [],
    duplicateSequences: [],
    outOfOrder: false,
    lastGap: null,
  };
}

let singleton: HfmSnapshotTracker | null = null;

export function getHfmSnapshotTracker(): HfmSnapshotTracker {
  if (!singleton) singleton = new HfmSnapshotTracker();
  return singleton;
}

export function resetHfmSnapshotTrackerForTests(): void {
  singleton = null;
}
