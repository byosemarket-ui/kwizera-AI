import type { HfmResearchSourceMode } from "../strategy-research/types.js";
import type { HfmEventReliabilityReport } from "./types.js";

export function assessEventReliability(input: {
  liveCalendarAllowed: boolean;
  eventsProvided: boolean;
  eventSourceMode: HfmResearchSourceMode | null | undefined;
  eventCount?: number;
}): HfmEventReliabilityReport {
  const notes: string[] = ["Phase 07 calendar gates unchanged"];
  if (!input.liveCalendarAllowed) {
    notes.push("live calendar disabled");
    return {
      status: "BLOCKED_CONFIGURATION_REQUIRED",
      sourceMode: "UNAVAILABLE",
      eventCount: input.eventCount ?? 0,
      notes,
      calendarGatesUnchanged: true,
      evidenceKind: "UNAVAILABLE",
    };
  }
  if (!input.eventsProvided) {
    return {
      status: "UNAVAILABLE",
      sourceMode: "UNAVAILABLE",
      eventCount: 0,
      notes: [...notes, "no events supplied"],
      calendarGatesUnchanged: true,
      evidenceKind: "UNAVAILABLE",
    };
  }
  if (input.eventSourceMode === "FIXTURE" || input.eventSourceMode === "SYNTHETIC_TEST_DATA") {
    return {
      status: "FIXTURE_ONLY",
      sourceMode: input.eventSourceMode,
      eventCount: input.eventCount ?? 0,
      notes: [...notes, "fixture/synthetic events — not live economic calendar"],
      calendarGatesUnchanged: true,
      evidenceKind: "ASSUMED",
    };
  }
  return {
    status: "VALID",
    sourceMode: input.eventSourceMode ?? "HISTORICAL_SOURCE",
    eventCount: input.eventCount ?? 0,
    notes,
    calendarGatesUnchanged: true,
    evidenceKind: "MEASURED",
  };
}
