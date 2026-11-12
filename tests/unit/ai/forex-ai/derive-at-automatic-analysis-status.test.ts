/**
 * Phase 4.18F.8 — automatic analysis status derivation (false-green ACTIVE fix).
 */
import { describe, expect, it } from "vitest";
import {
  AT_AUTOMATIC_ANALYSIS_SUCCESS_RECENCY_MS,
  deriveAtAutomaticAnalysisStatus,
} from "../../../../ai/forex-ai/automated-trading/monitoring/status.js";

const NOW = Date.parse("2024-06-01T12:00:00.000Z");
const recentSuccess = new Date(NOW - 5 * 60_000).toISOString();
const staleSuccess = new Date(NOW - AT_AUTOMATIC_ANALYSIS_SUCCESS_RECENCY_MS - 60_000).toISOString();

describe("deriveAtAutomaticAnalysisStatus", () => {
  it("returns STOPPED when disabled or worker inactive", () => {
    expect(
      deriveAtAutomaticAnalysisStatus({
        enabled: false,
        workerActive: true,
        analysisInFlight: false,
        lastBlockerCode: null,
        lastSuccessfulAnalysisAtUtc: null,
        lastCycleTerminalStatus: null,
        nowMs: NOW,
      }),
    ).toBe("STOPPED");
    expect(
      deriveAtAutomaticAnalysisStatus({
        enabled: true,
        workerActive: false,
        analysisInFlight: false,
        lastBlockerCode: null,
        lastSuccessfulAnalysisAtUtc: null,
        lastCycleTerminalStatus: null,
        nowMs: NOW,
      }),
    ).toBe("STOPPED");
  });

  it("returns ANALYSIS_RUNNING when analysis in flight", () => {
    expect(
      deriveAtAutomaticAnalysisStatus({
        enabled: true,
        workerActive: true,
        analysisInFlight: true,
        lastBlockerCode: null,
        lastSuccessfulAnalysisAtUtc: null,
        lastCycleTerminalStatus: null,
        nowMs: NOW,
      }),
    ).toBe("ANALYSIS_RUNNING");
  });

  it("maps OpenAI provider blockers", () => {
    expect(
      deriveAtAutomaticAnalysisStatus({
        enabled: true,
        workerActive: true,
        analysisInFlight: false,
        lastBlockerCode: "OPENAI_BILLING_BLOCKED",
        lastSuccessfulAnalysisAtUtc: null,
        lastCycleTerminalStatus: null,
        nowMs: NOW,
      }),
    ).toBe("PROVIDER_BILLING_BLOCKED");
    expect(
      deriveAtAutomaticAnalysisStatus({
        enabled: true,
        workerActive: true,
        analysisInFlight: false,
        lastBlockerCode: "OPENAI_AUTH_ERROR",
        lastSuccessfulAnalysisAtUtc: null,
        lastCycleTerminalStatus: null,
        nowMs: NOW,
      }),
    ).toBe("PROVIDER_AUTH_FAILED");
    expect(
      deriveAtAutomaticAnalysisStatus({
        enabled: true,
        workerActive: true,
        analysisInFlight: false,
        lastBlockerCode: "OPENAI_RATE_LIMIT",
        lastSuccessfulAnalysisAtUtc: null,
        lastCycleTerminalStatus: null,
        nowMs: NOW,
      }),
    ).toBe("PROVIDER_RATE_LIMITED");
  });

  it("does not report ACTIVE when quotes are stale", () => {
    const status = deriveAtAutomaticAnalysisStatus({
      enabled: true,
      workerActive: true,
      analysisInFlight: false,
      lastBlockerCode: "STALE_QUOTES",
      lastSuccessfulAnalysisAtUtc: recentSuccess,
      lastCycleTerminalStatus: "ANALYSIS_VALID",
      nowMs: NOW,
    });
    expect(status).toBe("STALE_MARKET_DATA");
    expect(status).not.toBe("ACTIVE");
  });

  it("reports recent success and stale success distinctly", () => {
    expect(
      deriveAtAutomaticAnalysisStatus({
        enabled: true,
        workerActive: true,
        analysisInFlight: false,
        lastBlockerCode: null,
        lastSuccessfulAnalysisAtUtc: recentSuccess,
        lastCycleTerminalStatus: "ANALYSIS_VALID",
        nowMs: NOW,
      }),
    ).toBe("ANALYSIS_SUCCEEDED");

    expect(
      deriveAtAutomaticAnalysisStatus({
        enabled: true,
        workerActive: true,
        analysisInFlight: false,
        lastBlockerCode: null,
        lastSuccessfulAnalysisAtUtc: staleSuccess,
        lastCycleTerminalStatus: "ANALYSIS_VALID",
        nowMs: NOW,
      }),
    ).toBe("LAST_SUCCESS_STALE");
  });

  it("defaults armed scheduler to WAITING between slots", () => {
    expect(
      deriveAtAutomaticAnalysisStatus({
        enabled: true,
        workerActive: true,
        analysisInFlight: false,
        lastBlockerCode: null,
        lastSuccessfulAnalysisAtUtc: null,
        lastCycleTerminalStatus: null,
        nowMs: NOW,
      }),
    ).toBe("WAITING");
  });
});
