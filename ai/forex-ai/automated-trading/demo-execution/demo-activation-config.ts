/**
 * Phase 4.0 — Proposed bounded DEMO automated-trading activation profile.
 *
 * This module is documentation + readiness input only.
 * It does NOT enable ALLOW_DEMO_MUTATION, create grants, flip placesOrders,
 * or submit broker orders.
 */
import { DEMO_OPEN_RISK_DEFAULTS } from "./open-market-risk.js";

/** Conservative proposed DEMO activation bounds for owner review. */
export const PROPOSED_BOUNDED_DEMO_ACTIVATION = {
  schema: "kwizera.demo-activation.v1" as const,
  environment: "DEMO" as const,
  liveForbidden: true as const,
  placesOrdersGlobal: false as const,
  acceptsForExecutionGlobal: false as const,
  /** Explicit instrument allowlist for first controlled DEMO runs. */
  permittedInstruments: ["XAU/USD"] as readonly string[],
  maxLotsPerOrder: DEMO_OPEN_RISK_DEFAULTS.maxLotsPerOrder,
  maxTotalExposureLots: 1,
  maxOpenPositions: 1,
  maxDailyLossAccount: 25,
  maxDrawdownFractionOfDayStartEquity: 0.03,
  maxSlLossFractionOfEquity: DEMO_OPEN_RISK_DEFAULTS.maxSlLossFractionOfEquity,
  maxSlLossAccount: 25,
  minUsableMargin: DEMO_OPEN_RISK_DEFAULTS.minUsableMargin,
  marginReserveFractionOfEquity: DEMO_OPEN_RISK_DEFAULTS.marginReserveFractionOfEquity,
  /** UTC 07:00–21:00 inclusive-start / exclusive-end. */
  sessionUtcStartMinute: 7 * 60,
  sessionUtcEndMinute: 21 * 60,
  cooldownAfterLossMs: 15 * 60_000,
  /** Hard cap on successful DEMO entries per grant window. */
  maxEntriesPerGrant: 3,
  requireProtectiveOrders: true as const,
  emergencyStopConditions: [
    "emergencyEntryLock=true",
    "FOREXCONNECT status !== CONNECTED",
    "unprotected fill with blockAdditionalEntries",
    "MAX_DAILY_LOSS_EXCEEDED",
    "MAX_DRAWDOWN_EXCEEDED",
    "ALLOW_DEMO_MUTATION unset/false",
    "grant expired or revoked",
  ] as readonly string[],
  mutationEnableRequires: [
    "Owner explicit Phase 4 activation approval",
    "KWIZERA_FOREXCONNECT_ALLOW_DEMO_MUTATION=1 on Node and sidecar",
    "Active time-bounded DEMO grant with matching allowlist",
    "Activation readiness PASS",
  ] as readonly string[],
  notes: [
    "Does not authorize LIVE trading.",
    "Does not auto-enable mutation when imported.",
    "Day PnL and day-start equity telemetry must be authoritative before daily-loss/drawdown gates can pass.",
    "Phase 4.1 auto-engine runs signal→prepare in dry_run only; broker submit still requires separate activation.",
    "Strategy kwizera.sma-crossover.v1 is plumbing/demo rules — no profitability claim.",
  ] as readonly string[],
} as const;

export type ProposedBoundedDemoActivation = typeof PROPOSED_BOUNDED_DEMO_ACTIVATION;
