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

export const PHASE_413_FIXTURE_BANNER =
  "DETERMINISTIC_FIXTURE LIFECYCLE — NOT A MARKET SIGNAL — SIMULATED ONLY — NOT LIVE QUOTES";

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
  /** True when position/fills came from deterministic fixtures, not a live strategy signal. */
  usedDeterministicFixture: boolean;
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
function appendSimulatedFillLifecycle(input: {
  steps: DryRunStepResult[];
  instrument: string;
  direction: "BUY" | "SELL";
  entry: number;
  stopLoss: number;
  takeProfit: number;
  forceSimulatedTpExit: boolean;
  fixture: boolean;
}): {
  simulatedPosition: DryRunLifecycleResult["simulatedPosition"];
  historyEntry: DryRunLifecycleResult["historyEntry"];
} {
  const { steps, instrument, direction, entry, stopLoss, takeProfit } = input;
  const simQty = 0.01;
  const label = input.fixture ? "DETERMINISTIC_FIXTURE" : "SIMULATED";
  steps.push(
    step(
      "ORDER_REQUEST_PREP",
      true,
      input.fixture ? "FIXTURE_ORDER_REQUEST" : "SIMULATED_ORDER_REQUEST",
      JSON.stringify({
        environment: "DEMO",
        instrument,
        direction,
        lots: simQty,
        entryPrice: entry,
        stopLoss,
        takeProfit,
        acknowledgement: label,
        mutatesBroker: false,
        fixture: input.fixture,
      }).slice(0, 220),
    ),
  );
  steps.push(
    step(
      "SIMULATED_ACK",
      true,
      input.fixture ? "FIXTURE_ACK" : "SIMULATED_ACK",
      `${label} acknowledgement — not a DEMO order id.`,
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
      eventId: "sim_fill_partial_1",
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
      `filled=${partialAcc.finalFilledAmount}; duplicates=${partialAcc.duplicateEventIds.join(",") || "none"}; fillConfirmed=${partialAcc.fillConfirmed}; label=${label}`,
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
      `finalFilled=${fullAcc.finalFilledAmount}; fillConfirmed=${fullAcc.fillConfirmed} (${label} — not DEMO_FILL_CONFIRMED)`,
    ),
  );

  const entryAtUtc = nowUtc();
  const simId = `sim_dry_${Date.now().toString(36)}`;
  steps.push(
    step(
      "POSITION_TRACKING",
      true,
      "SIMULATED_POSITION_OPEN",
      `${simId} ${direction} qty=${simQty} entry=${entry} label=${label}`,
    ),
  );
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
  steps.push(step("EXIT_SIGNAL", true, exitReason, `${label} exit signal at ${exitPrice}`));
  const move = direction === "BUY" ? exitPrice - entry : entry - exitPrice;
  const realizedPnl: number | null = null;
  const exitAtUtc = nowUtc();
  steps.push(
    step("SIMULATED_CLOSE", true, "SIMULATED_CLOSED", `Closed ${simId} @ ${exitPrice} reason=${exitReason}`),
  );
  steps.push(
    step(
      "PNL",
      true,
      "PNL_PRICE_MOVE_ONLY",
      `priceMove=${move}; realizedPnl=${realizedPnl}; monetary P/L withheld without verified pip cost (not PNL_VERIFIED)`,
    ),
  );
  const historyEntry = {
    kind: "SIMULATED_DRY_RUN" as const,
    instrument,
    direction,
    realizedPnl,
    closedAtUtc: exitAtUtc,
    note: input.fixture
      ? "DETERMINISTIC_FIXTURE history — not a market signal and not a broker closed trade."
      : "SIMULATED dry-run history — not a broker closed trade.",
  };
  steps.push(step("HISTORY", true, "SIMULATED_HISTORY_RECORDED", historyEntry.note));
  return {
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
  };
}

/**
 * Run the complete dry-run lifecycle from closed candles + optional contract meta.
 * Uses strategy levels for a synthetic SIMULATED position; never mutates broker.
 * Never invents a BUY/SELL crossover — optional deterministic fixture path is labeled.
 */
export function runIsolatedStrategyDryRunLifecycle(input: {
  instrument: string;
  candles: StrategyCandle[];
  pointSize: number | null;
  quantityContract?: BrokerQuantityContractInput | null;
  /** When true, force a crossover-shaped exit via take-profit mark (simulation only). */
  forceSimulatedTpExit?: boolean;
  /**
   * When strategy has no signal, still exercise fill/SL/TP plumbing with
   * clearly labeled DETERMINISTIC_FIXTURE levels (never presented as market signal).
   */
  includeDeterministicFixtureLifecycle?: boolean;
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

  const baseReturn = {
    ok: true as const,
    simulationOnly: true as const,
    placesOrders: false as const,
    acceptsForExecution: false as const,
    mutatesBroker: false as const,
    acknowledgementLabel: "SIMULATED" as const,
    instrument,
    strategyId: SMA_CROSSOVER_RULES.strategyId,
    strategy,
    candleDiagnostics,
    quantityContract,
    ownerMaxLots: 0.01 as const,
    brokerExecutionBlockers: [...blockers, ...quantityContract.blockers],
  };

  if (!hasSignal || strategy.entryPrice == null || strategy.stopLoss == null || strategy.takeProfit == null) {
    if (input.includeDeterministicFixtureLifecycle) {
      const lastClose = candleDiagnostics.lastClose ?? 100;
      const fixture = appendSimulatedFillLifecycle({
        steps,
        instrument,
        direction: "BUY",
        entry: lastClose,
        stopLoss: lastClose * 0.99,
        takeProfit: lastClose * 1.02,
        forceSimulatedTpExit: input.forceSimulatedTpExit !== false,
        fixture: true,
      });
      return {
        ...baseReturn,
        banner: PHASE_413_FIXTURE_BANNER,
        steps,
        simulatedPosition: fixture.simulatedPosition,
        historyEntry: fixture.historyEntry,
        usedDeterministicFixture: true,
        note:
          "No market signal. DETERMINISTIC_FIXTURE lifecycle exercised fill/SL/TP plumbing only — not a live crossover and not broker execution.",
      };
    }
    steps.push(
      step("ORDER_REQUEST_PREP", false, "SKIPPED_NO_SIGNAL", "Order request not prepared — no signal."),
    );
    return {
      ...baseReturn,
      banner: PHASE_412_DRY_RUN_BANNER,
      steps,
      simulatedPosition: null,
      historyEntry: null,
      usedDeterministicFixture: false,
      note: "Strategy analyzed; no SIMULATED position opened (no signal). Broker mutation never called.",
    };
  }

  // Signal-driven SIMULATED fills — still never broker-confirmed.
  const life = appendSimulatedFillLifecycle({
    steps,
    instrument,
    direction: strategy.direction as "BUY" | "SELL",
    entry: strategy.entryPrice,
    stopLoss: strategy.stopLoss,
    takeProfit: strategy.takeProfit,
    forceSimulatedTpExit: input.forceSimulatedTpExit !== false,
    fixture: false,
  });

  return {
    ...baseReturn,
    banner: PHASE_412_DRY_RUN_BANNER,
    steps,
    simulatedPosition: life.simulatedPosition,
    historyEntry: life.historyEntry,
    usedDeterministicFixture: false,
    note: "Isolated dry-run completed from strategy signal levels. Simulated fills are not broker-confirmed. 0.01-lot DEMO execution remains blocked.",
  };
}
