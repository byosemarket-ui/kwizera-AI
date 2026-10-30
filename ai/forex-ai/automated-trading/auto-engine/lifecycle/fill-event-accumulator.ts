/**
 * Phase 4.1 — Aggregate multiple partial-fill events with duplicate suppression.
 * Fail closed when the stream is incomplete or inconsistent.
 * Never invents a successful final fill.
 */

export interface FillEvent {
  eventId: string;
  orderId: string | null;
  tradeId: string | null;
  filledAmount: number;
  timestampMs: number;
}

export interface FillAccumulationResult {
  ok: boolean;
  code: string;
  finalFilledAmount: number | null;
  fillConfirmed: boolean;
  duplicateEventIds: string[];
  eventCount: number;
  blockers: string[];
}

/**
 * @param expectedAmount Broker amount expected for the order (base units), when known.
 * @param brokerReportedFinalAmount Optional authoritative final amount from trades table.
 */
export function accumulateFillEvents(input: {
  events: FillEvent[];
  expectedAmount: number | null;
  brokerReportedFinalAmount?: number | null;
  tolerance?: number;
}): FillAccumulationResult {
  const tolerance = input.tolerance ?? 1e-9;
  const blockers: string[] = [];
  const seen = new Set<string>();
  const duplicateEventIds: string[] = [];
  let sum = 0;

  if (!Array.isArray(input.events) || input.events.length === 0) {
    return {
      ok: false,
      code: "FILL_EVENTS_MISSING",
      finalFilledAmount: null,
      fillConfirmed: false,
      duplicateEventIds: [],
      eventCount: 0,
      blockers: ["FILL_EVENTS_MISSING"],
    };
  }

  const sorted = [...input.events].sort((a, b) => a.timestampMs - b.timestampMs);
  for (const ev of sorted) {
    if (!ev.eventId || !Number.isFinite(ev.filledAmount) || !(ev.filledAmount > 0)) {
      blockers.push("FILL_EVENT_INVALID");
      continue;
    }
    if (seen.has(ev.eventId)) {
      duplicateEventIds.push(ev.eventId);
      continue;
    }
    seen.add(ev.eventId);
    sum += ev.filledAmount;
  }

  if (blockers.includes("FILL_EVENT_INVALID")) {
    return {
      ok: false,
      code: "FILL_EVENT_INVALID",
      finalFilledAmount: null,
      fillConfirmed: false,
      duplicateEventIds,
      eventCount: seen.size,
      blockers,
    };
  }

  if (
    input.brokerReportedFinalAmount != null
    && Number.isFinite(input.brokerReportedFinalAmount)
  ) {
    const finalAmt = input.brokerReportedFinalAmount;
    if (input.expectedAmount != null && Number.isFinite(input.expectedAmount)) {
      if (Math.abs(finalAmt - input.expectedAmount) > tolerance) {
        blockers.push("BROKER_FINAL_AMOUNT_MISMATCH");
      }
    }
    // Prefer broker final when present and consistent with cumulative events (or events incomplete).
    if (sum > finalAmt + tolerance) {
      blockers.push("FILL_EVENTS_EXCEED_BROKER_FINAL");
    }
    if (blockers.length > 0) {
      return {
        ok: false,
        code: blockers[0]!,
        finalFilledAmount: null,
        fillConfirmed: false,
        duplicateEventIds,
        eventCount: seen.size,
        blockers,
      };
    }
    return {
      ok: true,
      code: "FILL_CONFIRMED_BROKER_FINAL",
      finalFilledAmount: finalAmt,
      fillConfirmed: true,
      duplicateEventIds,
      eventCount: seen.size,
      blockers: [],
    };
  }

  if (input.expectedAmount == null || !Number.isFinite(input.expectedAmount)) {
    return {
      ok: false,
      code: "EXPECTED_AMOUNT_UNKNOWN",
      finalFilledAmount: null,
      fillConfirmed: false,
      duplicateEventIds,
      eventCount: seen.size,
      blockers: ["EXPECTED_AMOUNT_UNKNOWN"],
    };
  }

  if (sum + tolerance < input.expectedAmount) {
    return {
      ok: false,
      code: "PARTIAL_FILL_INCOMPLETE",
      finalFilledAmount: sum,
      fillConfirmed: false,
      duplicateEventIds,
      eventCount: seen.size,
      blockers: ["PARTIAL_FILL_INCOMPLETE"],
    };
  }
  if (sum - input.expectedAmount > tolerance) {
    return {
      ok: false,
      code: "FILL_AMOUNT_EXCEEDS_EXPECTED",
      finalFilledAmount: null,
      fillConfirmed: false,
      duplicateEventIds,
      eventCount: seen.size,
      blockers: ["FILL_AMOUNT_EXCEEDS_EXPECTED"],
    };
  }

  return {
    ok: true,
    code: "FILL_CONFIRMED_EVENT_SUM",
    finalFilledAmount: input.expectedAmount,
    fillConfirmed: true,
    duplicateEventIds,
    eventCount: seen.size,
    blockers: [],
  };
}
