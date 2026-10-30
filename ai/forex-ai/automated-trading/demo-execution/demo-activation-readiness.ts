/**
 * Phase 4.0 — Read-only DEMO activation readiness evaluator.
 * Never enables mutation, never creates grants, never places orders.
 */
import {
  PROPOSED_BOUNDED_DEMO_ACTIVATION,
  type ProposedBoundedDemoActivation,
} from "./demo-activation-config.js";
import {
  loadDemoOpenMarketRiskLimitsDetailed,
  type DemoOpenMarketRiskLimits,
} from "./open-market-risk.js";

export interface DemoActivationReadinessInput {
  forexConnectStatus?: string | null;
  forexConnectEnvironment?: string | null;
  activeEnvironment?: string | null;
  trading?: string | null;
  liveProfileConfigured?: boolean | null;
  sidecarReachable?: boolean | null;
  /** true when Node+sidecar mutation env is enabled (boolean only; never print secrets). */
  allowDemoMutationEnabled?: boolean | null;
  placesOrders?: boolean | null;
  acceptsForExecution?: boolean | null;
  emergencyEntryLock?: boolean | null;
  masterEnable?: boolean | null;
  /** Whether authoritative day PnL / day-start equity telemetry exists. */
  dayRiskTelemetryReady?: boolean | null;
  /** Whether a continuous signal→openMarket automation loop is implemented and armed. */
  autoEntryLoopArmed?: boolean | null;
  openMarketRiskLimits?: DemoOpenMarketRiskLimits;
  proposed?: ProposedBoundedDemoActivation;
  nowMs?: number;
}

export interface DemoActivationCheck {
  code: string;
  status: "PASS" | "FAIL" | "BLOCKED" | "NOT_VERIFIED";
  message: string;
}

export interface DemoActivationReadinessResult {
  ok: boolean;
  readyForOwnerActivationApproval: boolean;
  mutationEnabled: false;
  grantsCreated: false;
  placesOrders: false;
  acceptsForExecution: false;
  liveUnauthorized: true;
  proposed: ProposedBoundedDemoActivation;
  checks: DemoActivationCheck[];
  blockers: string[];
  evaluatedAtUtc: string;
}

function push(
  checks: DemoActivationCheck[],
  blockers: string[],
  code: string,
  status: DemoActivationCheck["status"],
  message: string,
): void {
  checks.push({ code, status, message });
  if (status === "FAIL" || status === "BLOCKED") blockers.push(code);
}

/**
 * Evaluate whether the system is ready for the owner to separately approve
 * bounded DEMO mutation activation. This function never flips any gates.
 */
export function evaluateDemoActivationReadiness(
  input: DemoActivationReadinessInput = {},
): DemoActivationReadinessResult {
  const proposed = input.proposed ?? PROPOSED_BOUNDED_DEMO_ACTIVATION;
  const limits = input.openMarketRiskLimits
    ?? loadDemoOpenMarketRiskLimitsDetailed().limits;
  const checks: DemoActivationCheck[] = [];
  const blockers: string[] = [];
  const nowMs = input.nowMs ?? Date.now();

  const status = String(input.forexConnectStatus ?? "").toUpperCase();
  if (!input.forexConnectStatus) {
    push(checks, blockers, "FC_STATUS", "NOT_VERIFIED", "ForexConnect status not supplied to readiness.");
  } else if (status !== "CONNECTED") {
    push(checks, blockers, "FC_STATUS", "FAIL", `ForexConnect status is ${status}, expected CONNECTED.`);
  } else {
    push(checks, blockers, "FC_STATUS", "PASS", "ForexConnect CONNECTED.");
  }

  const env = String(input.forexConnectEnvironment ?? "").toLowerCase();
  const active = String(input.activeEnvironment ?? "").toLowerCase();
  if (!input.forexConnectEnvironment && !input.activeEnvironment) {
    push(checks, blockers, "FC_DEMO_ENV", "NOT_VERIFIED", "DEMO environment not supplied.");
  } else if (env !== "demo" && active !== "demo") {
    push(checks, blockers, "FC_DEMO_ENV", "FAIL", "Active ForexConnect environment is not DEMO.");
  } else {
    push(checks, blockers, "FC_DEMO_ENV", "PASS", "ForexConnect environment is DEMO.");
  }

  const trading = String(input.trading ?? "").toUpperCase();
  if (!input.trading) {
    push(checks, blockers, "TRADING_DISABLED", "NOT_VERIFIED", "Trading flag not supplied.");
  } else if (trading !== "DISABLED") {
    push(checks, blockers, "TRADING_DISABLED", "FAIL", `Trading flag is ${trading}, expected DISABLED until activation.`);
  } else {
    push(checks, blockers, "TRADING_DISABLED", "PASS", "Broker trading reported DISABLED.");
  }

  if (input.liveProfileConfigured == null) {
    push(checks, blockers, "LIVE_UNCONFIGURED", "NOT_VERIFIED", "LIVE profile configuration not supplied.");
  } else if (input.liveProfileConfigured === true) {
    push(checks, blockers, "LIVE_UNCONFIGURED", "FAIL", "LIVE profile appears configured — LIVE remains unauthorized.");
  } else {
    push(checks, blockers, "LIVE_UNCONFIGURED", "PASS", "LIVE profile not configured.");
  }

  if (input.sidecarReachable == null) {
    push(checks, blockers, "SIDECAR", "NOT_VERIFIED", "Sidecar reachability not supplied.");
  } else if (!input.sidecarReachable) {
    push(checks, blockers, "SIDECAR", "FAIL", "ForexConnect sidecar not reachable.");
  } else {
    push(checks, blockers, "SIDECAR", "PASS", "Sidecar reachable.");
  }

  if (input.placesOrders === true || input.acceptsForExecution === true) {
    push(checks, blockers, "EXECUTION_GATES", "FAIL", "Global execution gates must remain false before activation review.");
  } else {
    push(checks, blockers, "EXECUTION_GATES", "PASS", "placesOrders/acceptsForExecution remain false.");
  }

  if (input.emergencyEntryLock === false) {
    push(checks, blockers, "EMERGENCY_LOCK", "FAIL", "emergencyEntryLock is off — keep locked until activation.");
  } else if (input.emergencyEntryLock == null) {
    push(checks, blockers, "EMERGENCY_LOCK", "NOT_VERIFIED", "emergencyEntryLock not supplied.");
  } else {
    push(checks, blockers, "EMERGENCY_LOCK", "PASS", "emergencyEntryLock is ON.");
  }

  if (input.masterEnable === true) {
    push(checks, blockers, "MASTER_ENABLE", "FAIL", "masterEnable must remain false for bounded DEMO prep.");
  } else {
    push(checks, blockers, "MASTER_ENABLE", "PASS", "masterEnable is not true.");
  }

  if (input.allowDemoMutationEnabled === true) {
    push(
      checks,
      blockers,
      "MUTATION_FLAG",
      "BLOCKED",
      "ALLOW_DEMO_MUTATION is already enabled — owner must confirm intentional state before further activation.",
    );
  } else if (input.allowDemoMutationEnabled == null) {
    push(checks, blockers, "MUTATION_FLAG", "NOT_VERIFIED", "Mutation flag state not supplied (admin/env read required).");
  } else {
    push(checks, blockers, "MUTATION_FLAG", "PASS", "ALLOW_DEMO_MUTATION is not enabled.");
  }

  if (input.dayRiskTelemetryReady !== true) {
    push(
      checks,
      blockers,
      "DAY_RISK_TELEMETRY",
      "BLOCKED",
      "Authoritative day PnL / day-start equity telemetry is required before daily-loss and drawdown gates can pass.",
    );
  } else {
    push(checks, blockers, "DAY_RISK_TELEMETRY", "PASS", "Day risk telemetry marked ready.");
  }

  if (input.autoEntryLoopArmed === true) {
    push(checks, blockers, "AUTO_ENTRY_LOOP", "FAIL", "Auto-entry loop must not be armed before owner activation approval.");
  } else {
    push(
      checks,
      blockers,
      "AUTO_ENTRY_LOOP",
      "PASS",
      "No armed continuous signal→broker auto-entry loop (analysis/decision only).",
    );
  }

  // Proposed profile vs currently loaded open-market defaults (informational + soft blockers).
  if (limits.maxOpenPositions > proposed.maxOpenPositions) {
    push(
      checks,
      blockers,
      "OPEN_POSITION_LIMIT",
      "FAIL",
      `Loaded maxOpenPositions=${limits.maxOpenPositions} exceeds proposed bound ${proposed.maxOpenPositions}.`,
    );
  } else {
    push(
      checks,
      blockers,
      "OPEN_POSITION_LIMIT",
      "PASS",
      `maxOpenPositions=${limits.maxOpenPositions} within proposed bound ${proposed.maxOpenPositions}.`,
    );
  }

  if (limits.maxLotsPerOrder > proposed.maxLotsPerOrder) {
    push(
      checks,
      blockers,
      "LOT_LIMIT",
      "FAIL",
      `Loaded maxLotsPerOrder=${limits.maxLotsPerOrder} exceeds proposed ${proposed.maxLotsPerOrder}.`,
    );
  } else {
    push(checks, blockers, "LOT_LIMIT", "PASS", `maxLotsPerOrder=${limits.maxLotsPerOrder} within proposed bound.`);
  }

  push(
    checks,
    blockers,
    "PROPOSED_PROFILE",
    "PASS",
    `Proposed instruments=${proposed.permittedInstruments.join(",")}; session UTC ${proposed.sessionUtcStartMinute}-${proposed.sessionUtcEndMinute}; maxEntriesPerGrant=${proposed.maxEntriesPerGrant}.`,
  );

  const hardBlock = blockers.length > 0;
  return {
    ok: !hardBlock,
    readyForOwnerActivationApproval: !hardBlock,
    mutationEnabled: false,
    grantsCreated: false,
    placesOrders: false,
    acceptsForExecution: false,
    liveUnauthorized: true,
    proposed,
    checks,
    blockers,
    evaluatedAtUtc: new Date(nowMs).toISOString(),
  };
}
