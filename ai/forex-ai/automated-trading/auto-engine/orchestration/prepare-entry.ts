/**
 * Phase 4.1 — Signal → risk → order preparation.
 * Never enables mutation. Never calls broker open/close/cancel.
 */
import {
  DEMO_OPEN_RISK_DEFAULTS,
  evaluateDemoOpenMarketRisk,
  type DemoOpenMarketRiskInput,
  type DemoOpenMarketRiskResult,
} from "../../demo-execution/open-market-risk.js";
import type { DailyRiskSnapshot } from "../daily-risk/types.js";
import type { AutoSignalRecord } from "../signals/types.js";
import { PROPOSED_BOUNDED_DEMO_ACTIVATION } from "../../demo-execution/demo-activation-config.js";

export type AutoEntryMode = "dry_run" | "armed_prepare_only";

export interface PrepareAutoEntryInput {
  signal: AutoSignalRecord;
  lots: number;
  grantMaxLots: number;
  riskInput: Omit<
    DemoOpenMarketRiskInput,
    | "instrument"
    | "direction"
    | "lots"
    | "stopLoss"
    | "takeProfit"
    | "entryPrice"
    | "requireProtective"
    | "dayRealizedPnlAccount"
    | "dayStartEquity"
  >;
  dailyRisk: DailyRiskSnapshot | null;
  emergencyEntryLock: boolean;
  masterEnable: boolean;
  allowDemoMutationEnabled: boolean;
  entriesUsedInGrant: number;
  maxEntriesPerGrant?: number;
  cooldownUntilMs?: number | null;
  mode?: AutoEntryMode;
  nowMs?: number;
}

export interface PrepareAutoEntryResult {
  ok: boolean;
  code: string;
  blockers: string[];
  maySubmitDemoMutation: false;
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
  mode: AutoEntryMode;
  signalId: string;
  risk: DemoOpenMarketRiskResult | null;
  prepared: {
    instrument: string;
    direction: "BUY" | "SELL";
    lots: number;
    stopLoss: number;
    takeProfit: number;
    entryPrice: number;
    requireProtective: true;
  } | null;
  note: string;
}

export function prepareAutoEntryFromSignal(input: PrepareAutoEntryInput): PrepareAutoEntryResult {
  const mode: AutoEntryMode = input.mode ?? "dry_run";
  const blockers: string[] = [];
  const nowMs = input.nowMs ?? Date.now();
  const maxEntries = input.maxEntriesPerGrant
    ?? PROPOSED_BOUNDED_DEMO_ACTIVATION.maxEntriesPerGrant;

  const baseDeny = (code: string, extra: string[] = []): PrepareAutoEntryResult => ({
    ok: false,
    code,
    blockers: [...extra, ...blockers],
    maySubmitDemoMutation: false,
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    mode,
    signalId: input.signal.signalId,
    risk: null,
    prepared: null,
    note: "Preparation only. Broker mutation remains disabled until separate activation authorization.",
  });

  if (input.emergencyEntryLock !== true) {
    blockers.push("EMERGENCY_LOCK_REQUIRED");
  }
  if (input.masterEnable === true) {
    blockers.push("MASTER_ENABLE_MUST_REMAIN_FALSE");
  }
  // Even when armed_prepare_only, never claim mutation may submit from this helper.
  if (input.allowDemoMutationEnabled === true) {
    blockers.push("MUTATION_FLAG_ON_BUT_PREPARE_ONLY");
  }
  if (input.signal.status !== "ACTIVE") {
    return baseDeny("SIGNAL_NOT_ACTIVE", [`signal status=${input.signal.status}`]);
  }
  if (input.signal.direction !== "BUY" && input.signal.direction !== "SELL") {
    return baseDeny("SIGNAL_NOT_DIRECTIONAL");
  }
  if (
    input.signal.entryPrice == null
    || input.signal.stopLoss == null
    || input.signal.takeProfit == null
  ) {
    return baseDeny("SIGNAL_LEVELS_MISSING");
  }
  if (input.entriesUsedInGrant >= maxEntries) {
    blockers.push("MAX_ENTRIES_PER_GRANT_EXCEEDED");
  }

  const daily = input.dailyRisk;
  if (!daily || !daily.authoritative) {
    blockers.push("DAY_RISK_TELEMETRY_NOT_AUTHORITATIVE");
    if (daily?.blockers?.length) blockers.push(...daily.blockers.map((b) => `DAILY:${b}`));
  }

  const limits = {
    ...DEMO_OPEN_RISK_DEFAULTS,
    ...input.riskInput.limits,
    maxLotsPerOrder: PROPOSED_BOUNDED_DEMO_ACTIVATION.maxLotsPerOrder,
    maxTotalExposureLots: PROPOSED_BOUNDED_DEMO_ACTIVATION.maxTotalExposureLots,
    maxOpenPositions: PROPOSED_BOUNDED_DEMO_ACTIVATION.maxOpenPositions,
    maxDailyLossAccount: PROPOSED_BOUNDED_DEMO_ACTIVATION.maxDailyLossAccount,
    maxDrawdownFractionOfDayStartEquity:
      PROPOSED_BOUNDED_DEMO_ACTIVATION.maxDrawdownFractionOfDayStartEquity,
    maxSlLossAccount: PROPOSED_BOUNDED_DEMO_ACTIVATION.maxSlLossAccount,
    sessionUtcStartMinute: PROPOSED_BOUNDED_DEMO_ACTIVATION.sessionUtcStartMinute,
    sessionUtcEndMinute: PROPOSED_BOUNDED_DEMO_ACTIVATION.sessionUtcEndMinute,
    cooldownAfterLossMs: PROPOSED_BOUNDED_DEMO_ACTIVATION.cooldownAfterLossMs,
  };

  const risk = evaluateDemoOpenMarketRisk({
    ...input.riskInput,
    instrument: input.signal.instrument,
    direction: input.signal.direction,
    lots: input.lots,
    stopLoss: input.signal.stopLoss,
    takeProfit: input.signal.takeProfit,
    entryPrice: input.signal.entryPrice,
    requireProtective: true,
    grantMaxLots: input.grantMaxLots,
    dayRealizedPnlAccount: daily?.realizedPnlAccount ?? null,
    dayStartEquity: daily?.dayStartEquity ?? null,
    cooldownUntilMs: input.cooldownUntilMs ?? (limits.cooldownAfterLossMs > 0 ? null : 0),
    limits,
    nowMs,
  });

  blockers.push(...risk.blockers.filter((b) => !blockers.includes(b)));

  if (blockers.length > 0 || !risk.ok) {
    return {
      ok: false,
      code: blockers[0] ?? risk.code,
      blockers,
      maySubmitDemoMutation: false,
      placesOrders: false,
      acceptsForExecution: false,
      mutatesBroker: false,
      mode,
      signalId: input.signal.signalId,
      risk,
      prepared: null,
      note: "Entry rejected by risk/session/telemetry gates. No broker mutation attempted.",
    };
  }

  return {
    ok: true,
    code: "ENTRY_PREPARED_DRY_RUN",
    blockers: [],
    maySubmitDemoMutation: false,
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    mode,
    signalId: input.signal.signalId,
    risk,
    prepared: {
      instrument: input.signal.instrument,
      direction: input.signal.direction,
      lots: input.lots,
      stopLoss: input.signal.stopLoss,
      takeProfit: input.signal.takeProfit,
      entryPrice: input.signal.entryPrice,
      requireProtective: true,
    },
    note:
      mode === "dry_run"
        ? "Dry-run preparation succeeded. Mutation remains disabled."
        : "Armed prepare-only succeeded. Explicit activation + grant + mutation flag still required before any broker submit.",
  };
}
