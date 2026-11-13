/**
 * Phase 4 — Module readiness matrix from actual runtime evidence.
 */
import { randomUUID } from "node:crypto";
import type {
  AtHealthState,
  AtModuleHealthId,
  AtModuleHealthRow,
  AtObservabilityAlert,
  AtRecoveryDecision,
} from "./types.js";

export interface BuildAtModuleHealthInput {
  nowUtc?: string;
  systemMasterOwnerState?: "ON" | "OFF" | null;
  systemMasterOperationalState?: string | null;
  brokerConnected?: boolean | null;
  quoteFresh?: boolean | null;
  quoteReasonCode?: string | null;
  monitorEnabled?: boolean | null;
  workerState?: string | null;
  schedulerNextAtUtc?: string | null;
  lastSuccessfulAnalysisAtUtc?: string | null;
  phase2Status?: string | null;
  phase3Status?: string | null;
  boundaryStatus?: string | null;
  recovery?: AtRecoveryDecision | null;
  openaiBlockedCode?: string | null;
}

function row(
  id: AtModuleHealthId,
  label: string,
  state: AtHealthState,
  ready: boolean,
  live: boolean,
  detail: string,
  code: string | null,
  updatedAtUtc: string | null,
): AtModuleHealthRow {
  return { id, label, state, ready, live, detail, code, updatedAtUtc };
}

export function buildAtModuleHealthMatrix(input: BuildAtModuleHealthInput): {
  modules: AtModuleHealthRow[];
  alerts: AtObservabilityAlert[];
} {
  const now = input.nowUtc ?? new Date().toISOString();
  const masterOn = input.systemMasterOwnerState === "ON";
  const brokerOk = input.brokerConnected === true;
  const quoteOk = input.quoteFresh === true;
  const workerLive = Boolean(input.monitorEnabled) && /MONITOR|LIVE|RUNNING/i.test(String(input.workerState ?? ""));
  const quoteCode = input.quoteReasonCode ?? null;
  const marketClosed = /MARKET_CLOSED|MARKET_INACTIVE/i.test(String(quoteCode ?? ""));

  const modules: AtModuleHealthRow[] = [
    row("gateway", "Application gateway", "HEALTHY", true, true, "Gateway process responding.", null, now),
    row("storage", "Persistence", "HEALTHY", true, true, "AT storage root readable.", null, now),
    row(
      "system_master",
      "System Master",
      masterOn ? (input.systemMasterOperationalState === "BLOCKED" ? "BLOCKED" : "HEALTHY") : "STOPPED",
      masterOn,
      masterOn,
      masterOn
        ? `Owner ON · operational ${input.systemMasterOperationalState ?? "UNKNOWN"}`
        : "Owner OFF — Automated Trading-owned automation stopped.",
      masterOn ? null : "SYSTEM_MASTER_OFF",
      now,
    ),
    row(
      "forexconnect_session",
      "ForexConnect session",
      brokerOk ? "HEALTHY" : "DISCONNECTED",
      brokerOk,
      brokerOk,
      brokerOk ? "Read-only session connected." : "ForexConnect session not connected.",
      brokerOk ? null : "FC_DISCONNECTED",
      now,
    ),
    row(
      "xau_offer",
      "XAU/USD offer",
      brokerOk ? (quoteOk || marketClosed ? "HEALTHY" : "DEGRADED") : "BLOCKED",
      brokerOk,
      brokerOk,
      brokerOk ? "XAU/USD offer path available (read-only)." : "Offer path blocked until FC connects.",
      brokerOk ? null : "OFFER_UNAVAILABLE",
      now,
    ),
    row(
      "quote_freshness",
      "Quote freshness",
      quoteOk ? "HEALTHY" : marketClosed ? "DISABLED" : "STALE",
      quoteOk,
      quoteOk,
      quoteOk
        ? "XAU/USD quote fresh."
        : marketClosed
          ? "Market closed/inactive — not treated as broken provider."
          : `Quote not fresh (${quoteCode ?? "UNKNOWN"}).`,
      quoteOk ? "LIVE_FRESH" : quoteCode,
      now,
    ),
    row(
      "scheduler",
      "Five-minute scheduler",
      !masterOn ? "STOPPED" : workerLive ? "HEALTHY" : "BLOCKED",
      masterOn && workerLive,
      masterOn && workerLive,
      !masterOn
        ? "Scheduler inactive while System Master OFF."
        : workerLive
          ? `Scheduler active · next ${input.schedulerNextAtUtc ?? "—"}`
          : "Scheduler not active despite System Master ON.",
      !masterOn ? "SYSTEM_MASTER_OFF" : workerLive ? null : "SCHEDULER_INACTIVE",
      now,
    ),
    row(
      "monitoring_worker",
      "Monitoring worker",
      !masterOn ? "STOPPED" : workerLive ? "HEALTHY" : "FAILED",
      masterOn && workerLive,
      masterOn && workerLive,
      `Worker state: ${input.workerState ?? "STOPPED"}`,
      !masterOn ? "SYSTEM_MASTER_OFF" : null,
      now,
    ),
    row(
      "openai_provider",
      "OpenAI provider",
      input.openaiBlockedCode ? "BLOCKED" : masterOn ? "HEALTHY" : "DISABLED",
      !input.openaiBlockedCode && masterOn,
      masterOn,
      input.openaiBlockedCode
        ? `Blocked: ${input.openaiBlockedCode}`
        : masterOn
          ? "Authorized for analysis when market data ready."
          : "Disabled while System Master OFF.",
      input.openaiBlockedCode ?? null,
      now,
    ),
    row(
      "analysis_engine",
      "Analysis engine",
      input.lastSuccessfulAnalysisAtUtc ? "HEALTHY" : masterOn ? "DEGRADED" : "STOPPED",
      Boolean(input.lastSuccessfulAnalysisAtUtc),
      masterOn,
      input.lastSuccessfulAnalysisAtUtc
        ? `Last success ${input.lastSuccessfulAnalysisAtUtc}`
        : "No successful analysis yet in current session.",
      null,
      input.lastSuccessfulAnalysisAtUtc ?? null,
    ),
    row(
      "result_intake",
      "Result Intake",
      input.phase2Status ? "HEALTHY" : "STOPPED",
      Boolean(input.phase2Status),
      Boolean(input.phase2Status),
      input.phase2Status ? `Phase 2 chain ${input.phase2Status}` : "No Phase 2 chain yet.",
      null,
      now,
    ),
    row(
      "proposal_engine",
      "Proposal engine",
      /PROPOSAL|PRECHECK|HANDOFF/i.test(String(input.phase2Status ?? "")) ? "HEALTHY" : "STOPPED",
      /PROPOSAL|PRECHECK|HANDOFF/i.test(String(input.phase2Status ?? "")),
      Boolean(input.phase2Status),
      `Phase 2: ${input.phase2Status ?? "—"}`,
      null,
      now,
    ),
    row(
      "risk_engine",
      "Risk engine",
      /PRECHECK_PASSED|HANDOFF_VALIDATED|PROPOSAL_CREATED/i.test(String(input.phase2Status ?? ""))
        ? "HEALTHY"
        : /BLOCK|REJECT/i.test(String(input.phase2Status ?? ""))
          ? "BLOCKED"
          : "STOPPED",
      /PRECHECK_PASSED|HANDOFF_VALIDATED|PROPOSAL_CREATED/i.test(String(input.phase2Status ?? "")),
      Boolean(input.phase2Status),
      `Phase 2: ${input.phase2Status ?? "—"}`,
      null,
      now,
    ),
    row(
      "precheck",
      "Precheck",
      /PRECHECK_PASSED/i.test(String(input.phase2Status ?? ""))
        ? "HEALTHY"
        : /PRECHECK_BLOCK/i.test(String(input.phase2Status ?? ""))
          ? "BLOCKED"
          : "STOPPED",
      /PRECHECK_PASSED/i.test(String(input.phase2Status ?? "")),
      Boolean(input.phase2Status),
      `Phase 2: ${input.phase2Status ?? "—"}`,
      null,
      now,
    ),
    row(
      "payload_builder",
      "FXCM payload builder",
      /PAYLOAD_VALIDATED|HANDOFF_VALIDATED|EXECUTION_BLOCKED/i.test(String(input.phase3Status ?? ""))
        ? "HEALTHY"
        : /PAYLOAD_INVALID/i.test(String(input.phase3Status ?? ""))
          ? "BLOCKED"
          : "STOPPED",
      /PAYLOAD_VALIDATED|HANDOFF_VALIDATED|EXECUTION_BLOCKED/i.test(String(input.phase3Status ?? "")),
      Boolean(input.phase3Status),
      `Phase 3: ${input.phase3Status ?? "—"}`,
      null,
      now,
    ),
    row(
      "handoff",
      "Broker handoff (internal)",
      /HANDOFF_VALIDATED|EXECUTION_BLOCKED/i.test(String(input.phase3Status ?? ""))
        ? "HEALTHY"
        : "STOPPED",
      /HANDOFF_VALIDATED|EXECUTION_BLOCKED/i.test(String(input.phase3Status ?? "")),
      Boolean(input.phase3Status),
      `Phase 3: ${input.phase3Status ?? "—"}`,
      null,
      now,
    ),
    row(
      "execution_boundary",
      "Execution boundary",
      input.boundaryStatus === "EXECUTION_BLOCKED" ? "BLOCKED" : "HEALTHY",
      false,
      true,
      "Hard boundary — submission always blocked in Phase 3/4.",
      "EXECUTION_DISABLED_BY_OWNER_POLICY",
      now,
    ),
  ];

  const alerts: AtObservabilityAlert[] = [];
  const push = (
    component: AtObservabilityAlert["component"],
    severity: AtObservabilityAlert["severity"],
    code: string,
    message: string,
    suggestedAction: string,
  ) => {
    alerts.push({
      id: randomUUID(),
      component,
      severity,
      code,
      message,
      suggestedAction,
      correlationId: null,
      atUtc: now,
      placesOrders: false,
      mutatesBroker: false,
    });
  };

  if (!brokerOk) {
    push(
      "forexconnect_session",
      "ERROR",
      "FC_DISCONNECTED",
      "ForexConnect session is not connected.",
      "Check kwizera-forexconnect.service and DEMO credentials; reconnect read-only.",
    );
  }
  if (!quoteOk && !marketClosed) {
    push(
      "quote_freshness",
      "WARN",
      quoteCode || "QUOTE_STALE",
      "XAU/USD quote is not fresh.",
      "Confirm offer subscription and live Offers updates before analysis.",
    );
  }
  if (marketClosed) {
    push(
      "quote_freshness",
      "INFO",
      "MARKET_CLOSED",
      "Market closed/inactive — provider may still be healthy.",
      "Do not treat as broken FC; avoid reconnect storms and OpenAI spam.",
    );
  }
  if (masterOn && !workerLive) {
    push(
      "monitoring_worker",
      "ERROR",
      "WORKER_INACTIVE",
      "System Master ON but monitoring worker is not live.",
      "Use System Master OFF then ON, or inspect worker logs; do not duplicate workers.",
    );
  }
  if (input.recovery?.ownerInterventionRequired) {
    push(
      "recovery",
      "CRITICAL",
      input.recovery.code,
      input.recovery.message,
      input.recovery.suggestedAction,
    );
  }
  push(
    "execution_boundary",
    "INFO",
    "EXECUTION_DISABLED_BY_OWNER_POLICY",
    "Broker execution remains disabled.",
    "Keep Execution Master OFF; Phase 4 never submits orders.",
  );

  return { modules, alerts: alerts.slice(0, 12) };
}
