/**
 * STEP 1B.4 — Semantic poll outcomes for Realtime Hub recovery wiring.
 *
 * Distinguishes transport failure from a healthy no-change snapshot so
 * duplicate/unchanged quotes do not fake DEGRADED recovery flaps.
 *
 * Transport health and market-data freshness remain separate concerns:
 * VALID_NO_CHANGE confirms snapshot/transport observation, not tick age.
 */

export type HfmPollOutcomeKind =
  | "POLL_FAILED"
  | "SNAPSHOT_INVALID"
  | "EMPTY_OR_UNCONFIRMED"
  | "VALID_NO_CHANGE"
  | "VALID_WITH_NEW_QUOTES"
  | "VALID_PARTIAL_SNAPSHOT";

export interface HfmPollOutcome {
  kind: HfmPollOutcomeKind;
  /** Confirmed presence of usable market quotes (new or duplicate LKG). */
  validQuoteObserved: boolean;
  /** Agent/hub transport succeeded for this cycle. */
  transportOk: boolean;
  reason: string;
}

export function classifyFailedPoll(errorCode: string | null | undefined): HfmPollOutcome {
  const code = String(errorCode ?? "POLL_FAILED").slice(0, 120);
  return {
    kind: "POLL_FAILED",
    validQuoteObserved: false,
    transportOk: false,
    reason: code || "POLL_FAILED",
  };
}

export function classifySuccessfulIngestPoll(input: {
  rawQuoteCount: number;
  published: number;
  rejected: number;
  skippedStaleOrDuplicate: number;
  expectedSymbolCount: number;
  symbolsInSnapshot: number;
  lkgCountBeforeIngest: number;
  terminalRunning: boolean;
  feedDisconnected: boolean;
}): HfmPollOutcome {
  if (input.feedDisconnected || input.terminalRunning === false) {
    return {
      kind: "EMPTY_OR_UNCONFIRMED",
      validQuoteObserved: false,
      transportOk: true,
      reason: input.feedDisconnected ? "FEED_DISCONNECTED" : "TERMINAL_NOT_RUNNING",
    };
  }

  if (input.rawQuoteCount <= 0) {
    return {
      kind: "EMPTY_OR_UNCONFIRMED",
      validQuoteObserved: false,
      transportOk: true,
      reason: "SNAPSHOT_HAS_NO_QUOTES",
    };
  }

  const confirmedUnchanged = input.skippedStaleOrDuplicate > 0;
  const hasNew = input.published > 0;
  const allRejected =
    input.rejected >= input.rawQuoteCount &&
    input.published === 0 &&
    input.skippedStaleOrDuplicate === 0;

  if (allRejected) {
    return {
      kind: "SNAPSHOT_INVALID",
      validQuoteObserved: false,
      transportOk: true,
      reason: "ALL_QUOTES_REJECTED",
    };
  }

  const expected = Math.max(0, input.expectedSymbolCount);
  const partial =
    expected > 0 &&
    input.symbolsInSnapshot > 0 &&
    input.symbolsInSnapshot < expected;

  if (hasNew && partial) {
    return {
      kind: "VALID_PARTIAL_SNAPSHOT",
      validQuoteObserved: true,
      transportOk: true,
      reason: "PARTIAL_WITH_NEW_QUOTES",
    };
  }

  if (hasNew) {
    return {
      kind: "VALID_WITH_NEW_QUOTES",
      validQuoteObserved: true,
      transportOk: true,
      reason: "NEW_QUOTES_PUBLISHED",
    };
  }

  if (confirmedUnchanged || (input.lkgCountBeforeIngest > 0 && input.rejected < input.rawQuoteCount)) {
    if (partial) {
      return {
        kind: "VALID_PARTIAL_SNAPSHOT",
        validQuoteObserved: true,
        transportOk: true,
        reason: "PARTIAL_NO_CHANGE",
      };
    }
    return {
      kind: "VALID_NO_CHANGE",
      validQuoteObserved: true,
      transportOk: true,
      reason: confirmedUnchanged ? "DUPLICATE_OR_UNCHANGED_QUOTES" : "SNAPSHOT_CONFIRMS_EXISTING_LKG",
    };
  }

  return {
    kind: "EMPTY_OR_UNCONFIRMED",
    validQuoteObserved: false,
    transportOk: true,
    reason: "NO_USABLE_QUOTE_CONFIRMATION",
  };
}
