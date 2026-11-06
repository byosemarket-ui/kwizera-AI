/**
 * Stage 2 — Fetch live RO ForexConnect payloads for risk intelligence.
 * Read-only only: listAccounts / listTrades / listClosedTrades / getStatus.
 */
import { getForexConnectBridge } from "../../../market-data/forexconnect/client.js";
import type { ForexConnectAccountsResult } from "../../../market-data/forexconnect/types.js";
import { getDailyRiskStore } from "../auto-engine/daily-risk/store.js";
import type { DailyRiskSnapshot } from "../auto-engine/daily-risk/types.js";
import {
  buildRiskIntelligenceSnapshot,
  logRiskIntelligenceEvents,
  type RiskIntelligenceGatherInput,
} from "./gather.js";
import type { RiskIntelligenceSnapshot } from "./types.js";

export interface FetchLiveRiskIntelligenceOptions {
  environment: string;
  instrument: string | null;
  expectedAccountId?: string | null;
  expectedAccountIdMasked?: string | null;
  baseUnitSize: number | null;
  contractVerified: boolean;
  bid: number | null;
  ask: number | null;
  quoteAgeMs: number | null;
  maxSpreadAbsolute?: number | null;
  priorDaily?: DailyRiskSnapshot | null;
  persistDaily?: boolean;
  nowMs?: number;
  accountMaxAgeMs?: number;
  quoteMaxAgeMs?: number;
  /** Injectable bridge for tests. */
  bridge?: {
    listAccounts: () => Promise<ForexConnectAccountsResult>;
    listTrades: () => Promise<Record<string, unknown>>;
    listClosedTrades: () => Promise<Record<string, unknown>>;
    getStatus: () => Promise<{ status?: string }>;
  };
}

export async function fetchLiveRiskIntelligence(
  options: FetchLiveRiskIntelligenceOptions,
): Promise<RiskIntelligenceSnapshot> {
  const bridge = options.bridge ?? getForexConnectBridge();
  const emptyAccounts: ForexConnectAccountsResult = {
    ok: false,
    count: 0,
    accounts: [],
    fetchedAt: null,
  };
  const emptyTrades = { ok: false, trades: [] as unknown[], fetchedAt: null as string | null };
  const emptyClosed = {
    ok: false,
    closedTrades: [] as unknown[],
    fetchedAt: null as string | null,
  };

  let forexConnectAvailable = true;
  let brokerConnected = false;
  let accounts: ForexConnectAccountsResult | null = emptyAccounts;
  let trades: Record<string, unknown> | null = emptyTrades;
  let closedTrades: Record<string, unknown> | null = emptyClosed;

  try {
    const status = await bridge.getStatus().catch(() => ({ status: "DISCONNECTED" }));
    brokerConnected = String(status?.status ?? "").toUpperCase() === "CONNECTED";
    const [a, t, c] = await Promise.all([
      bridge.listAccounts().catch(() => emptyAccounts),
      bridge.listTrades().catch(() => emptyTrades),
      bridge.listClosedTrades().catch(() => emptyClosed),
    ]);
    accounts = a;
    trades = t;
    closedTrades = c;
  } catch {
    forexConnectAvailable = false;
    brokerConnected = false;
  }

  const priorDaily = options.priorDaily !== undefined
    ? options.priorDaily
    : getDailyRiskStore().get();

  const gatherInput: RiskIntelligenceGatherInput = {
    environment: options.environment,
    instrument: options.instrument,
    expectedAccountId: options.expectedAccountId ?? null,
    expectedAccountIdMasked: options.expectedAccountIdMasked ?? null,
    accounts,
    trades,
    closedTrades,
    brokerConnected,
    forexConnectAvailable,
    baseUnitSize: options.baseUnitSize,
    contractVerified: options.contractVerified,
    bid: options.bid,
    ask: options.ask,
    quoteAgeMs: options.quoteAgeMs,
    maxSpreadAbsolute: options.maxSpreadAbsolute,
    priorDaily,
    nowMs: options.nowMs,
    accountMaxAgeMs: options.accountMaxAgeMs,
    quoteMaxAgeMs: options.quoteMaxAgeMs,
  };

  const { snapshot, dailyComputed } = buildRiskIntelligenceSnapshot(gatherInput);

  if (options.persistDaily !== false && dailyComputed) {
    try {
      getDailyRiskStore().save(dailyComputed);
    } catch {
      // Persistence failure must not invent risk metrics; snapshot already carries blockers.
    }
  }

  logRiskIntelligenceEvents(snapshot);
  return snapshot;
}
