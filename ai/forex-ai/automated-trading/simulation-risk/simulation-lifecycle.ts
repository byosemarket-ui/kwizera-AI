/**
 * Phase 56.4.2 — Simulation-only order lifecycle (never broker execution).
 * States: DRAFT → VALIDATED → SIMULATED_OPEN → MONITORING → EXIT_TRIGGERED → SIMULATED_CLOSED
 * Automatic re-entry is NOT enabled — requires a new independently validated draft.
 */
import type { AtBinaryDirection } from "../analysis/direction.js";
import type { AtSimDraftResult } from "./types.js";
import { evaluateProfitProtection } from "./profit-protection.js";
import type { DraftQuoteSnapshot } from "./draft-quote-refresh.js";

export type SimLifecycleState =
  | "DRAFT"
  | "VALIDATED"
  | "REJECTED"
  | "SIMULATED_OPEN"
  | "MONITORING"
  | "EXIT_TRIGGERED"
  | "SIMULATED_CLOSED"
  | "STALE_INTERRUPTED";

export type SimExitReason =
  | "STOP_LOSS_HIT"
  | "TAKE_PROFIT_HIT"
  | "QUOTE_STALE"
  | "FEED_NOT_LIVE"
  | "STRATEGY_INVALIDATED"
  | "MANUAL_SIM_CLOSE"
  | "PROTECTIVE_EARLY_EXIT_SIM";

export interface SimPosition {
  simulationPositionId: string;
  sourceDraftId: string;
  environment: string;
  instrument: string;
  direction: AtBinaryDirection;
  quantity: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  entryAtUtc: string;
  entryQuoteSnapshotId: string | null;
  allocation: number | null;
  estimatedMargin: number | null;
  initialRiskAccount: number | null;
  state: SimLifecycleState;
  latestBid: number | null;
  latestAsk: number | null;
  latestQuoteAtUtc: string | null;
  unrealizedPnl: number | null;
  exitReason: SimExitReason | null;
  exitPrice: number | null;
  exitAtUtc: string | null;
  /** Triggering Offers quote snapshot id when exit is determined from a monitored tick. */
  exitQuoteSnapshotId: string | null;
  realizedPnl: number | null;
  achievedR: number | null;
  transitions: Array<{ atUtc: string; from: SimLifecycleState; to: SimLifecycleState; note: string }>;
  placesOrders: false;
  acceptsForExecution: false;
  simulationOnly: true;
}

export interface SimLifecyclePublicStatus {
  openCount: number;
  closedCount: number;
  positions: SimPosition[];
  autoReentryEnabled: false;
  placesOrders: false;
  acceptsForExecution: false;
  simulationOnly: true;
  note: string;
}

function id(): string {
  return `sim_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function markPrice(direction: AtBinaryDirection, bid: number, ask: number): number {
  // Mark-to-market: long valued at bid (exit), short valued at ask (exit).
  return direction === "BUY" ? bid : ask;
}

function unrealized(
  direction: AtBinaryDirection,
  entry: number,
  qty: number,
  bid: number,
  ask: number,
  pipCostAccount: number | null,
  pointSize: number | null,
): number | null {
  const mark = markPrice(direction, bid, ask);
  const move = direction === "BUY" ? mark - entry : entry - mark;
  if (pipCostAccount != null && pointSize != null && pointSize > 0) {
    return (move / pointSize) * pipCostAccount * qty;
  }
  // Without verified pip cost, do not invent monetary P/L.
  return null;
}

function transition(
  pos: SimPosition,
  to: SimLifecycleState,
  note: string,
): SimPosition {
  const from = pos.state;
  if (from === to) return pos;
  return {
    ...pos,
    state: to,
    transitions: [
      ...pos.transitions,
      { atUtc: new Date().toISOString(), from, to, note: note.slice(0, 160) },
    ],
  };
}

/**
 * Open a simulated position only from VALIDATION_PASSED draft + fresh quote snapshot.
 * Never maps to broker order IDs.
 */
export function openSimulatedPosition(input: {
  draft: AtSimDraftResult;
  quote: DraftQuoteSnapshot;
  estimatedMargin?: number | null;
  initialRiskAccount?: number | null;
  pipCostAccount?: number | null;
  pointSize?: number | null;
}):
  | { ok: true; position: SimPosition }
  | { ok: false; code: string; message: string } {
  const d = input.draft;
  if (d.overallStatus !== "VALIDATION_PASSED") {
    return {
      ok: false,
      code: "SIM_OPEN_DRAFT_NOT_VALIDATED",
      message: `Draft status is ${d.overallStatus} — only VALIDATION_PASSED may open a simulated position.`,
    };
  }
  if (!input.quote.fresh) {
    return {
      ok: false,
      code: "SIM_OPEN_QUOTE_NOT_FRESH",
      message: "Cannot open simulated position without a fresh LIVE quote at open time.",
    };
  }
  if (d.direction !== "BUY" && d.direction !== "SELL") {
    return { ok: false, code: "SIM_OPEN_DIRECTION_MISSING", message: "Direction missing." };
  }
  if (
    d.entryPrice == null
    || d.stopLoss == null
    || d.takeProfit == null
    || d.proposedQuantity == null
    || !(d.proposedQuantity > 0)
  ) {
    return {
      ok: false,
      code: "SIM_OPEN_LEVELS_INCOMPLETE",
      message: "Entry, SL, TP, and verified quantity are required to open a simulated position.",
    };
  }
  if (d.placesOrders !== false || d.acceptsForExecution !== false) {
    return {
      ok: false,
      code: "SIMULATION_ONLY_EXECUTION_LOCKED",
      message: "Safety invariants violated — simulation open refused.",
    };
  }

  const now = new Date().toISOString();
  let pos: SimPosition = {
    simulationPositionId: id(),
    sourceDraftId: d.draftId,
    environment: d.environment,
    instrument: d.instrument,
    direction: d.direction,
    quantity: d.proposedQuantity,
    entryPrice: d.entryPrice,
    stopLoss: d.stopLoss,
    takeProfit: d.takeProfit,
    entryAtUtc: now,
    entryQuoteSnapshotId: input.quote.snapshotId,
    allocation: d.capitalBudgetAnalysis?.perOrderAllocation ?? null,
    estimatedMargin: input.estimatedMargin ?? null,
    initialRiskAccount: input.initialRiskAccount ?? null,
    state: "VALIDATED",
    latestBid: input.quote.bid,
    latestAsk: input.quote.ask,
    latestQuoteAtUtc: input.quote.observedAtUtc,
    unrealizedPnl: unrealized(
      d.direction,
      d.entryPrice,
      d.proposedQuantity,
      input.quote.bid,
      input.quote.ask,
      input.pipCostAccount ?? null,
      input.pointSize ?? null,
    ),
    exitReason: null,
    exitPrice: null,
    exitAtUtc: null,
    exitQuoteSnapshotId: null,
    realizedPnl: null,
    achievedR: null,
    transitions: [],
    placesOrders: false,
    acceptsForExecution: false,
    simulationOnly: true,
  };
  pos = transition(pos, "SIMULATED_OPEN", "Opened from VALIDATION_PASSED draft (simulation only).");
  pos = transition(pos, "MONITORING", "Monitoring verified Offers quotes.");
  return { ok: true, position: pos };
}

/**
 * Monitor one tick. SL/TP use executable-side marks (BUY exit=bid, SELL exit=ask).
 *
 * Gap / jump policy (simulation only): when a fresh quote crosses SL and/or TP,
 * the exit fill is the executable mark on that quote (bid for BUY, ask for SELL),
 * not necessarily the exact SL/TP level. If both SL and TP would fire on the same
 * tick, Stop Loss wins (conservative). Stale/invalid quotes never invent a fill.
 * Tick-size rounding is not applied here — compare mark to stored SL/TP as provided
 * by the validated draft (fail closed when quote metadata is missing/non-finite).
 */
export function monitorSimulatedPosition(input: {
  position: SimPosition;
  quote: DraftQuoteSnapshot;
  pipCostAccount?: number | null;
  pointSize?: number | null;
  multiTimeframeReversalEvidence?: boolean;
}): SimPosition {
  let pos = input.position;
  if (pos.state === "SIMULATED_CLOSED" || pos.state === "REJECTED") return pos;

  const bidRaw = input.quote.bid;
  const askRaw = input.quote.ask;
  const quoteFinite =
    typeof bidRaw === "number"
    && Number.isFinite(bidRaw)
    && bidRaw > 0
    && typeof askRaw === "number"
    && Number.isFinite(askRaw)
    && askRaw > 0
    && askRaw >= bidRaw;

  if (!input.quote.fresh || !quoteFinite) {
    const reasonCode = !quoteFinite
      ? (input.quote.reasonCode === "QUOTE_INVALID" ? "QUOTE_INVALID" : "QUOTE_MISSING")
      : input.quote.reasonCode;
    pos = transition(
      pos,
      "STALE_INTERRUPTED",
      `Monitoring interrupted: ${reasonCode} (no fill invented).`,
    );
    // Do not set exitReason / exitPrice — position remains open but monitoring blocked.
    return {
      ...pos,
      latestBid: quoteFinite ? bidRaw : pos.latestBid,
      latestAsk: quoteFinite ? askRaw : pos.latestAsk,
      latestQuoteAtUtc: input.quote.observedAtUtc,
      unrealizedPnl: null,
      // Preserve a true exit reason only if already closed; otherwise clear interrupt noise.
      exitReason: pos.state === "SIMULATED_CLOSED" ? pos.exitReason : null,
      exitPrice: pos.state === "SIMULATED_CLOSED" ? pos.exitPrice : null,
    };
  }

  if (pos.state === "STALE_INTERRUPTED") {
    pos = transition(pos, "MONITORING", "Fresh LIVE quote restored — monitoring resumed.");
    pos = {
      ...pos,
      exitReason: null,
      exitPrice: null,
      exitAtUtc: null,
    };
  }

  const bid = bidRaw;
  const ask = askRaw;
  const mark = markPrice(pos.direction, bid, ask);
  const pnl = unrealized(
    pos.direction,
    pos.entryPrice,
    pos.quantity,
    bid,
    ask,
    input.pipCostAccount ?? null,
    input.pointSize ?? null,
  );

  pos = {
    ...pos,
    latestBid: bid,
    latestAsk: ask,
    latestQuoteAtUtc: input.quote.observedAtUtc,
    unrealizedPnl: pnl,
  };

  // Conservative: if a gap crosses both levels on one tick, Stop Loss wins.
  const slHit =
    pos.direction === "BUY" ? mark <= pos.stopLoss : mark >= pos.stopLoss;
  const tpHit =
    pos.direction === "BUY" ? mark >= pos.takeProfit : mark <= pos.takeProfit;

  if (slHit || tpHit) {
    // Deterministic same-tick order: Stop Loss wins over Take Profit (never prefer the
    // more profitable outcome). Achieved R = signed price move / initial stop distance.
    const exitReason: SimExitReason = slHit ? "STOP_LOSS_HIT" : "TAKE_PROFIT_HIT";
    const stopDist = Math.abs(pos.entryPrice - pos.stopLoss);
    const signedMove =
      pos.direction === "BUY" ? mark - pos.entryPrice : pos.entryPrice - mark;
    const achievedR = stopDist > 0 && Number.isFinite(signedMove) ? signedMove / stopDist : null;
    pos = transition(pos, "EXIT_TRIGGERED", exitReason);
    pos = transition(pos, "SIMULATED_CLOSED", `Simulated close: ${exitReason}`);
    return {
      ...pos,
      exitReason,
      // Gap fill = executable mark on the triggering quote (may differ from exact SL/TP).
      exitPrice: mark,
      exitAtUtc: new Date().toISOString(),
      exitQuoteSnapshotId: input.quote.snapshotId || null,
      // Realized P/L only when pip/point metadata was provided; otherwise UNKNOWN (null).
      realizedPnl: pnl,
      // Price-based R (independent of account-currency pip cost). SL exits are typically < 0.
      achievedR,
      unrealizedPnl: pnl != null ? 0 : null,
    };
  }

  // Optional sim-only profit protection — never widens SL; never auto-reopens.
  const stopDist = Math.abs(pos.entryPrice - pos.stopLoss);
  const favorable =
    pos.direction === "BUY" ? mark - pos.entryPrice : pos.entryPrice - mark;
  const protection = evaluateProfitProtection({
    direction: pos.direction,
    originalStopLoss: pos.stopLoss,
    entryPrice: pos.entryPrice,
    currentPrice: mark,
    favorableMovePrice: favorable > 0 ? favorable : 0,
    stopDistancePrice: stopDist,
    multiTimeframeReversalEvidence: Boolean(input.multiTimeframeReversalEvidence),
    evidenceContradictory: false,
    evidenceInsufficient: !input.multiTimeframeReversalEvidence,
    proposedMinFavorableR: 1,
    proposedTightenToBreakEven: true,
  });
  if (
    protection.proposedAction === "TIGHTEN_SL_SIM"
    && protection.proposedStopLoss != null
    && Number.isFinite(protection.proposedStopLoss)
  ) {
    // Only tighten (never widen).
    const tighter =
      pos.direction === "BUY"
        ? protection.proposedStopLoss > pos.stopLoss
        : protection.proposedStopLoss < pos.stopLoss;
    if (tighter) {
      pos = {
        ...pos,
        stopLoss: protection.proposedStopLoss,
        transitions: [
          ...pos.transitions,
          {
            atUtc: new Date().toISOString(),
            from: pos.state,
            to: pos.state,
            note: `Sim SL tightened to ${protection.proposedStopLoss} (never widens).`,
          },
        ],
      };
    }
  }
  if (protection.proposedAction === "EARLY_EXIT_SIM" && input.multiTimeframeReversalEvidence) {
    pos = transition(pos, "EXIT_TRIGGERED", "PROTECTIVE_EARLY_EXIT_SIM");
    pos = transition(pos, "SIMULATED_CLOSED", "Confirmed reversal evidence — sim early exit.");
    return {
      ...pos,
      exitReason: "PROTECTIVE_EARLY_EXIT_SIM",
      exitPrice: mark,
      exitAtUtc: new Date().toISOString(),
      exitQuoteSnapshotId: input.quote.snapshotId || null,
      realizedPnl: pnl,
      unrealizedPnl: pnl != null ? 0 : null,
    };
  }

  return pos;
}

/**
 * Explicit user-requested simulated close (never a broker close).
 * Idempotent: already-closed positions are returned unchanged.
 */
export function closeSimulatedPositionManual(input: {
  position: SimPosition;
  bid?: number | null;
  ask?: number | null;
  pipCostAccount?: number | null;
  pointSize?: number | null;
}):
  | { ok: true; position: SimPosition; idempotent: boolean }
  | { ok: false; code: string; message: string } {
  const pos = input.position;
  if (pos.state === "SIMULATED_CLOSED") {
    return { ok: true, position: pos, idempotent: true };
  }
  if (pos.state === "REJECTED") {
    return {
      ok: false,
      code: "SIM_CLOSE_INVALID_STATE",
      message: `Cannot close simulated position in state ${pos.state}.`,
    };
  }
  const bid = input.bid;
  const ask = input.ask;
  let exitPrice: number | null = null;
  let realized: number | null = null;
  if (
    typeof bid === "number"
    && Number.isFinite(bid)
    && bid > 0
    && typeof ask === "number"
    && Number.isFinite(ask)
    && ask > 0
  ) {
    exitPrice = markPrice(pos.direction, bid, ask);
    realized = unrealized(
      pos.direction,
      pos.entryPrice,
      pos.quantity,
      bid,
      ask,
      input.pipCostAccount ?? null,
      input.pointSize ?? null,
    );
  }
  const stopDist = Math.abs(pos.entryPrice - pos.stopLoss);
  const achievedR =
    exitPrice != null && stopDist > 0
      ? (pos.direction === "BUY" ? exitPrice - pos.entryPrice : pos.entryPrice - exitPrice)
        / stopDist
      : null;
  let next = transition(pos, "EXIT_TRIGGERED", "MANUAL_SIM_CLOSE");
  next = transition(next, "SIMULATED_CLOSED", "User-requested simulated close (not a broker close).");
  return {
    ok: true,
    idempotent: false,
    position: {
      ...next,
      exitReason: "MANUAL_SIM_CLOSE",
      exitPrice,
      exitAtUtc: new Date().toISOString(),
      exitQuoteSnapshotId: pos.exitQuoteSnapshotId,
      realizedPnl: realized,
      achievedR,
      unrealizedPnl: realized != null ? 0 : null,
      latestBid: typeof bid === "number" ? bid : pos.latestBid,
      latestAsk: typeof ask === "number" ? ask : pos.latestAsk,
    },
  };
}

/**
 * Phase 56.4.6 — Controlled simulation-only quote levels that cross Stop Loss
 * using the documented executable-side convention (BUY=bid, SELL=ask).
 * Never used for broker execution. Gap fill = these marks, not exact SL.
 */
export function proposeControlledSlCrossingLevels(pos: SimPosition): {
  bid: number;
  ask: number;
  expectedExitReason: "STOP_LOSS_HIT";
} {
  const spread = 0.3;
  if (pos.direction === "BUY") {
    const bid = pos.stopLoss - 0.05;
    return { bid, ask: bid + spread, expectedExitReason: "STOP_LOSS_HIT" };
  }
  const ask = pos.stopLoss + 0.05;
  return { bid: Math.max(0.01, ask - spread), ask, expectedExitReason: "STOP_LOSS_HIT" };
}

/** Levels that approach SL without triggering (simulation fixtures). */
export function proposeControlledSlApproachLevels(pos: SimPosition): { bid: number; ask: number } {
  const spread = 0.3;
  if (pos.direction === "BUY") {
    const bid = pos.stopLoss + 0.05;
    return { bid, ask: bid + spread };
  }
  const ask = pos.stopLoss - 0.05;
  return { bid: Math.max(0.01, ask - spread), ask };
}

/**
 * Re-entry is intentionally disabled: requires a new independently validated draft.
 */
export function evaluateSimReentryPolicy(): {
  allowed: false;
  autoReentryEnabled: false;
  code: "SIM_REENTRY_REQUIRES_NEW_DRAFT";
  message: string;
} {
  return {
    allowed: false,
    autoReentryEnabled: false,
    code: "SIM_REENTRY_REQUIRES_NEW_DRAFT",
    message:
      "Automatic re-entry is disabled. Close the simulated position, then validate a new draft with a fresh LIVE quote.",
  };
}

/** Phase 56.4.7 — per-position process-restart recovery action (simulation only). */
export type SimRestartRecoveryAction =
  | "UNCHANGED_CLOSED"
  | "UNCHANGED_REJECTED"
  | "ALREADY_INTERRUPTED"
  | "MARKED_STALE_AWAITING_FRESH_QUOTE"
  | "AMBIGUOUS_EXIT_BLOCKED";

export interface SimRestartRecoveryItem {
  positionId: string;
  action: SimRestartRecoveryAction;
  fromState: SimLifecycleState;
  toState: SimLifecycleState;
  changed: boolean;
  placesOrders: false;
  acceptsForExecution: false;
}

export const SIM_RESTART_RECOVERY_NOTE =
  "PROCESS_RESTART_RECOVERY: awaiting fresh LIVE quote (pre-restart quote invalidated).";

/**
 * Phase 56.4.7 — Fail-closed recovery for one simulated position after process restart.
 * Never fabricates fills, exit prices, realized P/L, or broker orders.
 * Closed positions stay closed. Open/monitoring positions become STALE_INTERRUPTED
 * until a post-restart fresh LIVE quote resumes monitoring via the normal monitor path.
 * Idempotent for already-interrupted positions.
 */
export function recoverSimPositionAfterProcessRestart(pos: SimPosition): {
  position: SimPosition;
  action: SimRestartRecoveryAction;
  changed: boolean;
} {
  if (pos.state === "SIMULATED_CLOSED") {
    return { position: pos, action: "UNCHANGED_CLOSED", changed: false };
  }
  if (pos.state === "REJECTED") {
    return { position: pos, action: "UNCHANGED_REJECTED", changed: false };
  }
  if (pos.state === "STALE_INTERRUPTED") {
    // Already blocked — never invent an exit from recovery.
    if (pos.exitReason != null || pos.exitPrice != null || pos.exitAtUtc != null) {
      return {
        position: {
          ...pos,
          exitReason: null,
          exitPrice: null,
          exitAtUtc: null,
        },
        action: "ALREADY_INTERRUPTED",
        changed: true,
      };
    }
    return { position: pos, action: "ALREADY_INTERRUPTED", changed: false };
  }

  const from = pos.state;
  const action: SimRestartRecoveryAction =
    from === "EXIT_TRIGGERED" ? "AMBIGUOUS_EXIT_BLOCKED" : "MARKED_STALE_AWAITING_FRESH_QUOTE";
  // Do not complete EXIT_TRIGGERED → SIMULATED_CLOSED here: that could report a close
  // without a durable close audit. Fail closed and await a fresh monitor tick.
  let next = transition(pos, "STALE_INTERRUPTED", SIM_RESTART_RECOVERY_NOTE);
  next = {
    ...next,
    unrealizedPnl: null,
    exitReason: null,
    exitPrice: null,
    exitAtUtc: null,
    exitQuoteSnapshotId: null,
  };
  return { position: next, action, changed: true };
}

/**
 * Idempotent batch recovery after process restart. Does not open positions,
 * does not register broker monitors, and does not call market data.
 */
export function recoverSimPositionsAfterProcessRestart(positions: SimPosition[]): {
  positions: SimPosition[];
  results: SimRestartRecoveryItem[];
  changedCount: number;
  placesOrders: false;
  acceptsForExecution: false;
  autoReentryEnabled: false;
  note: string;
} {
  const results: SimRestartRecoveryItem[] = [];
  const nextPositions: SimPosition[] = [];
  let changedCount = 0;
  for (const pos of positions) {
    const r = recoverSimPositionAfterProcessRestart(pos);
    nextPositions.push(r.position);
    if (r.changed) changedCount += 1;
    results.push({
      positionId: pos.simulationPositionId,
      action: r.action,
      fromState: pos.state,
      toState: r.position.state,
      changed: r.changed,
      placesOrders: false,
      acceptsForExecution: false,
    });
  }
  return {
    positions: nextPositions,
    results,
    changedCount,
    placesOrders: false,
    acceptsForExecution: false,
    autoReentryEnabled: false,
    note:
      "Process-restart recovery is simulation-only. Monitoring resumes only after a fresh LIVE quote.",
  };
}

export function simulationLifecyclePublicStatus(positions: SimPosition[]): SimLifecyclePublicStatus {
  const open = positions.filter(
    (p) =>
      p.state === "SIMULATED_OPEN"
      || p.state === "MONITORING"
      || p.state === "EXIT_TRIGGERED"
      || p.state === "STALE_INTERRUPTED",
  );
  const closed = positions.filter((p) => p.state === "SIMULATED_CLOSED");
  const awaitingFresh = open.filter((p) => p.state === "STALE_INTERRUPTED").length;
  return {
    openCount: open.length,
    closedCount: closed.length,
    positions: [...positions].slice(0, 40),
    autoReentryEnabled: false,
    placesOrders: false,
    acceptsForExecution: false,
    simulationOnly: true,
    note:
      awaitingFresh > 0
        ? `Simulation lifecycle only — never broker orders. ${awaitingFresh} position(s) STALE_INTERRUPTED awaiting fresh LIVE quote after interrupt/recovery.`
        : "Simulation lifecycle only — never broker orders. Auto re-entry disabled; new VALIDATION_PASSED draft required.",
  };
}
