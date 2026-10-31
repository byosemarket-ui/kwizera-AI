/**
 * Phase 4.12 — Isolated dry-run trade lifecycle.
 * Never calls the broker mutation adapter. All fills are labeled SIMULATED.
 */
import { accumulateFillEvents, type FillEvent } from "../auto-engine/lifecycle/fill-event-accumulator.js";
import {
  evaluateSmaCrossoverStrategy,
  type StrategyEvaluation,
} from "../auto-engine/strategy/evaluate.js";
import { SMA_CROSSOVER_RULES, type StrategyCandle } from "../auto-engine/strategy/rules.js";
import {
  evaluateBrokerQuantityContract,
  type BrokerQuantityContractInput,
  type BrokerQuantityContractResult,
} from "../order-execution/broker-quantity-contract.js";

export const PHASE_412_DRY_RUN_BANNER =
  "SIMULATED DRY-RUN LIFECYCLE — NEVER BROKER EXECUTION — FILLS ARE NOT DEMO_FILL_CONFIRMED";

export type DryRunStepId =
  | "STRATEGY_SIGNAL"
  | "ENTRY_DECISION"
  | "RISK_PREFLIGHT"
  | "QUANTITY_MARGIN"
  | "ORDER_REQUEST_PREP"
  | "SIMULATED_ACK"
  | "PARTIAL_FILL"
  | "FULL_FILL"
  | "POSITION_TRACKING"
  | "SL_TP_PROTECTION"
  | "EXIT_SIGNAL"
  | "SIMULATED_CLOSE"
  | "PNL"
  | "HISTORY";

export interface DryRunStepResult {
  step: DryRunStepId;
  ok: boolean;
  code: string;
  detail: string;
  simulated: true;
  atUtc: string;
}

export interface DryRunLifecycleResult {
  ok: boolean;
  simulationOnly: true;
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
  acknowledgementLabel: "SIMULATED";
  banner: typeof PHASE_412_DRY_RUN_BANNER;
  instrument: string;
  strategyId: string;
  strategy: StrategyEvaluation;
  candleDiagnostics: {
    count: number;
    closedCount: number;
    firstOpenSec: number | null;
    lastOpenSec: number | null;
    lastClose: number | null;
    orderedAscending: boolean;
  };
  quantityContract: BrokerQuantityContractResult;
  ownerMaxLots: 0.01;
  steps: DryRunStepResult[];
  simulatedPosition: {
    simulationPositionId: string;
    state: string;
    direction: string;
    quantity: number;
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
    entryAtUtc: string;
    exitAtUtc: string | null;
    exitReason: string | null;
    exitPrice: number | null;
    unrealizedPnl: number | null;
    realizedPnl: number | null;
    fillLabel: "SIMULATED";
  } | null;
  historyEntry: {
    kind: "SIMULATED_DRY_RUN";
    instrument: string;
    direction: string | null;
    realizedPnl: number | null;
    closedAtUtc: string | null;
    note: string;
  } | null;
  brokerExecutionBlockers: string[];
  note: string;
}

function nowUtc(): string {
  return new Date().toISOString();
}

function step(
  id: DryRunStepId,
  ok: boolean,
  code: string,
  detail: string,
): DryRunStepResult {
  return {
    step: id,
    ok,
    code,
    detail: detail.slice(0, 240),
    simulated: true,
    atUtc: nowUtc(),
  };
}

function candlesOrderedAscending(candles: StrategyCandle[]): boolean {
  for (let i = 1; i < candles.length; i++) {
    if (candles[i]!.time < candles[i - 1]!.time) return false;
  }
  return true;
}

/**
 * Run the complete dry-run lifecycle from closed candles + optional contract meta.
 * Uses strategy levels for a synthetic SIMULATED position; never mutates broker.
 */
export function runIsolatedStrategyDryRunLifecycle(input: {
  instrument: string;
  candles: StrategyCandle[];
  pointSize: number | null;
  quantityContract?: BrokerQuantityContractInput | null;
  /** When true, force a crossover-shaped exit via take-profit mark (simulation only). */
  forceSimulatedTpExit?: boolean;
}): DryRunLifecycleResult {
  const instrument = String(input.instrument ?? "").trim() || "UNKNOWN";
  const steps: DryRunStepResult[] = [];
  const blockers: string[] = [
    "OWNER_MAX_LOTS_0_01",
    "BROKER_DEMO_MIN_QUANTITY_INCOMPATIBLE_OR_UNVERIFIED",
    "LIVE_LOCKED",
    "ARMED_EXECUTE_DISABLED",
    "NO_BROKER_MUTATION_IN_DRY_RUN",
  ];

  const closed = input.candles.filter((c) => c && c.closed !== false);
  const candleDiagnostics = {
    count: input.candles.length,
    closedCount: closed.length,
    firstOpenSec: input.candles[0]?.time ?? null,
    lastOpenSec: input.candles[input.candles.length - 1]?.time ?? null,
    lastClose: input.candles[input.candles.length - 1]?.close ?? null,
    orderedAscending: candlesOrderedAscending(input.candles),
  };

  const strategy = evaluateSmaCrossoverStrategy({
    candles: input.candles,
    pointSize: input.pointSize,
    rules: SMA_CROSSOVER_RULES,
  });

  steps.push(
    step(
      "STRATEGY_SIGNAL",
      strategy.ok,
      strategy.code,
      `strategy=${strategy.strategyId}; direction=${strategy.direction}; closedCandle=${strategy.closedCandleOpenSec}; fast=${strategy.fastSma}; slow=${strategy.slowSma}; atr=${strategy.atr}`,
    ),
  );

  const hasSignal = strategy.ok && (strategy.direction === "BUY" || strategy.direction === "SELL");
  steps.push(
    step(
      "ENTRY_DECISION",
      hasSignal,
      hasSignal ? "ENTRY_CANDIDATE_SIMULATED" : "NO_ENTRY",
      hasSignal
        ? `Would prepare ${strategy.direction} at ${strategy.entryPrice} (SIMULATED only).`
        : "No executable entry from latest closed candle.",
    ),
  );

  const contractInput: BrokerQuantityContractInput = input.quantityContract ?? {
    requestedLots: 0.01,
    baseUnitSize: null,
    minQuantity: null,
    mmrPerLot: null,
    maxLotsPerOrder: 0.01,
  };
  const quantityContract = evaluateBrokerQuantityContract(contractInput);
  const qtyBlocked = !quantityContract.requestedLotsSupported || quantityContract.blockers.length > 0;
  steps.push(
    step(
      "RISK_PREFLIGHT",
      qtyBlocked,
      qtyBlocked ? "RISK_BLOCKED_AS_EXPECTED" : "RISK_PASS_UNEXPECTED",
      qtyBlocked
        ? `Risk/quantity preflight blocked: ${quantityContract.blockers.slice(0, 4).join(", ") || quantityContract.summary}`
        : "Quantity contract unexpectedly passed — review owner 0.01 limit.",
    ),
  );
  steps.push(
    step(
      "QUANTITY_MARGIN",
      false,
      qtyBlocked ? "QUANTITY_MARGIN_BLOCKED" : "QUANTITY_MARGIN_PASS",
      `ownerMaxLots=0.01; amount=${quantityContract.amountConversion.amount}; minQuantity=${quantityContract.minQuantity}; mmr=${quantityContract.estimatedMarginAccount}; blockers=${quantityContract.blockers.join(",")}`,
    ),
  );

  if (!hasSignal || strategy.entryPrice == null || strategy.stopLoss == null || strategy.takeProfit == null) {
    steps.push(
      step("ORDER_REQUEST_PREP", false, "SKIPPED_NO_SIGNAL", "Order request not prepared — no signal."),
    );
    return {
      ok: true,
      simulationOnly: true,
      placesOrders: false,
      acceptsForExecution: false,
      mutatesBroker: false,
      acknowledgementLabel: "SIMULATED",
      banner: PHASE_412_DRY_RUN_BANNER,
      instrument,
      strategyId: SMA_CROSSOVER_RULES.strategyId,
      strategy,
      candleDiagnostics,
      quantityContract,
      ownerMaxLots: 0.01,
      steps,
      simulatedPosition: null,
      historyEntry: null,
      brokerExecutionBlockers: blockers,
      note: "Strategy analyzed; no SIMULATED position opened (no signal or incomplete levels). Broker mutation never called.",
    };
  }

  // Continue dry-run with SIMULATED fills even when quantity is broker-incompatible —
  // this validates lifecycle plumbing without claiming DEMO order submission.
  const direction = strategy.direction as "BUY" | "SELL";
  const entry = strategy.entryPrice;
  const stopLoss = strategy.stopLoss;
  const takeProfit = strategy.takeProfit;
  const simQty = 0.01; // owner max; not submitted to broker

  const orderReq = {
    environment: "DEMO" as const,
    instrument,
    direction,
    lots: simQty,
    entryPrice: entry,
    stopLoss,
    takeProfit,
    acknowledgement: "SIMULATED" as const,
    mutatesBroker: false as const,
  };
  steps.push(
    step(
      "ORDER_REQUEST_PREP",
      true,
      "SIMULATED_ORDER_REQUEST",
      JSON.stringify(orderReq).slice(0, 220),
    ),
  );
  steps.push(
    step(
      "SIMULATED_ACK",
      true,
      "SIMULATED_ACK",
      "Broker acknowledgement is SIMULATED — not a DEMO order id.",
    ),
  );

  const partialEvents: FillEvent[] = [
    {
      eventId: "sim_fill_partial_1",
      orderId: "SIMULATED_ORDER",
      tradeId: "SIMULATED_TRADE_P1",
      filledAmount: simQty * 0.4,
      timestampMs: Date.now() - 2_000,
    },
    {
      eventId: "sim_fill_partial_1", // duplicate — must be suppressed
      orderId: "SIMULATED_ORDER",
      tradeId: "SIMULATED_TRADE_P1",
      filledAmount: simQty * 0.4,
      timestampMs: Date.now() - 1_900,
    },
    {
      eventId: "sim_fill_partial_2",
      orderId: "SIMULATED_ORDER",
      tradeId: "SIMULATED_TRADE_P2",
      filledAmount: simQty * 0.6,
      timestampMs: Date.now() - 1_000,
    },
  ];
  const partialAcc = accumulateFillEvents({
    events: partialEvents.slice(0, 2),
    expectedAmount: simQty,
  });
  steps.push(
    step(
      "PARTIAL_FILL",
      partialAcc.duplicateEventIds.length > 0 && !partialAcc.fillConfirmed,
      "SIMULATED_PARTIAL_FILL",
      `filled=${partialAcc.finalFilledAmount}; duplicates=${partialAcc.duplicateEventIds.join(",") || "none"}; fillConfirmed=${partialAcc.fillConfirmed}`,
    ),
  );

  const fullAcc = accumulateFillEvents({
    events: partialEvents,
    expectedAmount: simQty,
  });
  steps.push(
    step(
      "FULL_FILL",
      Boolean(fullAcc.ok && fullAcc.fillConfirmed),
      fullAcc.fillConfirmed ? "SIMULATED_FULL_FILL" : fullAcc.code,
      `finalFilled=${fullAcc.finalFilledAmount}; fillConfirmed=${fullAcc.fillConfirmed} (SIMULATED — not DEMO_FILL_CONFIRMED)`,
    ),
  );

  const entryAtUtc = nowUtc();
  const simId = `sim_dry_${Date.now().toString(36)}`;
  steps.push(
    step(
      "POSITION_TRACKING",
      true,
      "SIMULATED_POSITION_OPEN",
      `${simId} ${direction} qty=${simQty} entry=${entry}`,
    ),
  );

  // SL/TP protection: drive mark to TP (or leave at entry if force false and mid).
  const exitViaTp = input.forceSimulatedTpExit !== false;
  const exitPrice = exitViaTp ? takeProfit : entry;
  const exitReason = exitViaTp ? "TAKE_PROFIT_HIT" : "MANUAL_SIM_CLOSE";
  steps.push(
    step(
      "SL_TP_PROTECTION",
      true,
      "SIMULATED_PROTECTION_ARMED",
      `SL=${stopLoss}; TP=${takeProfit}; mark→${exitPrice} (${exitReason})`,
    ),
  );
  steps.push(
    step(
      "EXIT_SIGNAL",
      true,
      exitReason,
      `SIMULATED exit signal at ${exitPrice}`,
    ),
  );

  const move = direction === "BUY" ? exitPrice - entry : entry - exitPrice;
  // Without verified pip cost, monetary P/L stays null — report price move only.
  const realizedPnl: number | null = null;
  const exitAtUtc = nowUtc();
  steps.push(
    step(
      "SIMULATED_CLOSE",
      true,
      "SIMULATED_CLOSED",
      `Closed ${simId} @ ${exitPrice} reason=${exitReason}`,
    ),
  );
  steps.push(
    step(
      "PNL",
      true,
      realizedPnl == null ? "PNL_PRICE_MOVE_ONLY" : "PNL_COMPUTED",
      `priceMove=${move}; realizedPnl=${realizedPnl}; monetary P/L withheld without verified pip cost (not PNL_VERIFIED)`,
    ),
  );

  const historyEntry = {
    kind: "SIMULATED_DRY_RUN" as const,
    instrument,
    direction,
    realizedPnl,
    closedAtUtc: exitAtUtc,
    note: "SIMULATED dry-run history — not a broker closed trade.",
  };
  steps.push(
    step(
      "HISTORY",
      true,
      "SIMULATED_HISTORY_RECORDED",
      historyEntry.note,
    ),
  );

  return {
    ok: true,
    simulationOnly: true,
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    acknowledgementLabel: "SIMULATED",
    banner: PHASE_412_DRY_RUN_BANNER,
    instrument,
    strategyId: SMA_CROSSOVER_RULES.strategyId,
    strategy,
    candleDiagnostics,
    quantityContract,
    ownerMaxLots: 0.01,
    steps,
    simulatedPosition: {
      simulationPositionId: simId,
      state: "SIMULATED_CLOSED",
      direction,
      quantity: simQty,
      entryPrice: entry,
      stopLoss,
      takeProfit,
      entryAtUtc,
      exitAtUtc,
      exitReason,
      exitPrice,
      unrealizedPnl: null,
      realizedPnl,
      fillLabel: "SIMULATED",
    },
    historyEntry,
    brokerExecutionBlockers: [
      ...blockers,
      ...quantityContract.blockers,
    ],
    note: "Isolated dry-run completed. Simulated fills are not broker-confirmed. Quantity/margin remain blocked for real DEMO orders at 0.01 lots.",
  };
}
