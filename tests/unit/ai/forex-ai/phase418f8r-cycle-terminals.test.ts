/**
 * Phase 4.18F.8R — scheduled cycle terminals must never treat mid-flight as complete.
 */
import { describe, expect, it } from "vitest";
import {
  isTerminalCycleStatus,
  defaultMonitorHealth,
} from "../../../../ai/forex-ai/automated-trading/monitoring/types.ts";

describe("Phase 4.18F.8R cycle terminal acceptance", () => {
  it("rejects ANALYSIS_IN_FLIGHT as a terminal cycle status", () => {
    expect(isTerminalCycleStatus("ANALYSIS_IN_FLIGHT")).toBe(false);
    expect(isTerminalCycleStatus("ANALYSIS_IN_PROGRESS")).toBe(false);
    expect(isTerminalCycleStatus(null)).toBe(false);
  });

  it("accepts real terminal outcomes including overlap skip and stale block", () => {
    expect(isTerminalCycleStatus("ANALYSIS_VALID")).toBe(true);
    expect(isTerminalCycleStatus("SCHEDULE_SLOT_SKIPPED_IN_FLIGHT")).toBe(true);
    expect(isTerminalCycleStatus("SCHEDULE_SLOT_MISSED")).toBe(true);
    expect(isTerminalCycleStatus("STALE_QUOTES")).toBe(true);
    expect(isTerminalCycleStatus("BLOCKED_STALE_QUOTES")).toBe(true);
    expect(isTerminalCycleStatus("ANALYSIS_FAILED")).toBe(true);
  });

  it("default health includes empty recentCycleTerminals ring", () => {
    const h = defaultMonitorHealth();
    expect(Array.isArray(h.recentCycleTerminals)).toBe(true);
    expect(h.recentCycleTerminals).toEqual([]);
    expect(h.lastCycleTerminalStatus).toBeNull();
  });

  it("smoke acceptance: mid-flight poll must not count as a completed cycle", () => {
    // Mirrors the production smoke rule: require completedAt + terminalStatus, never IN_FLIGHT.
    const midFlightPoll = {
      lastScheduleSlotSec: 1_793_719_500,
      lastCycleCompletedAtUtc: null,
      lastBlockerCode: "ANALYSIS_IN_FLIGHT",
      lastCycleTerminalStatus: null,
      analysisInFlight: true,
    };
    const countsAsCycle = Boolean(
      midFlightPoll.lastScheduleSlotSec != null
      && midFlightPoll.lastCycleCompletedAtUtc
      && midFlightPoll.lastCycleTerminalStatus
      && midFlightPoll.lastCycleTerminalStatus !== "ANALYSIS_IN_FLIGHT"
      && !midFlightPoll.analysisInFlight,
    );
    expect(countsAsCycle).toBe(false);

    const terminalSkip = {
      lastScheduleSlotSec: 1_793_719_500,
      lastCycleCompletedAtUtc: "2026-11-03T15:26:10.000Z",
      lastCycleTerminalStatus: "SCHEDULE_SLOT_SKIPPED_IN_FLIGHT",
      analysisInFlight: false,
    };
    const skipCounts = Boolean(
      terminalSkip.lastScheduleSlotSec != null
      && terminalSkip.lastCycleCompletedAtUtc
      && terminalSkip.lastCycleTerminalStatus
      && terminalSkip.lastCycleTerminalStatus !== "ANALYSIS_IN_FLIGHT"
      && !terminalSkip.analysisInFlight,
    );
    expect(skipCounts).toBe(true);
  });
});
