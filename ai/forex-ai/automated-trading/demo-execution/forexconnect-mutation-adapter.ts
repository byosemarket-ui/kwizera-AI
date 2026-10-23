/**
 * Phase 58.1 — ForexConnect DEMO mutation adapter (Node → sidecar).
 * Calls gated sidecar routes only. Does not set global placesOrders=true.
 */
import { getForexConnectBridge } from "../../../market-data/forexconnect/client.js";

export interface DemoMutationOpenResult {
  ok: boolean;
  code: string;
  error?: string | null;
  brokerOrderId?: string | null;
  trade?: Record<string, unknown> | null;
  fillConfirmed?: boolean;
  mutatesBroker: boolean;
  raw: Record<string, unknown>;
}

export interface DemoMutationCloseResult {
  ok: boolean;
  code: string;
  error?: string | null;
  brokerOrderId?: string | null;
  tradeId?: string | null;
  closeConfirmed?: boolean;
  stillOpen?: boolean;
  mutatesBroker: boolean;
  raw: Record<string, unknown>;
}

function secret(): string {
  return String(process.env.KWIZERA_FOREXCONNECT_DEMO_MUTATION_SECRET || "").trim();
}

export class ForexConnectDemoMutationAdapter {
  /** Global AT flags remain false — this adapter is grant-scoped DEMO only. */
  readonly placesOrdersGlobal = false as const;
  readonly acceptsForExecutionGlobal = false as const;

  async probeSdkCapabilities(): Promise<Record<string, unknown>> {
    const bridge = getForexConnectBridge();
    return bridge.probeSdkCapabilities();
  }

  async openTrueMarket(input: {
    instrument: string;
    direction: "BUY" | "SELL";
    lots: number;
    accountId?: string | null;
  }): Promise<DemoMutationOpenResult> {
    const bridge = getForexConnectBridge();
    const raw = await bridge.demoMutationOpenMarket({
      instrument: input.instrument,
      buySell: input.direction,
      lots: input.lots,
      accountId: input.accountId ?? null,
      secret: secret(),
    });
    return {
      ok: Boolean(raw.ok),
      code: String(raw.code || (raw.ok ? "OK" : "FAILED")),
      error: raw.error && typeof raw.error === "object"
        ? String((raw.error as { message?: string }).message || "")
        : (raw.error == null ? null : String(raw.error)),
      brokerOrderId: raw.brokerOrderId == null ? null : String(raw.brokerOrderId),
      trade: (raw.trade as Record<string, unknown> | null | undefined) ?? null,
      fillConfirmed: Boolean(raw.fillConfirmed),
      mutatesBroker: Boolean(raw.mutatesBroker),
      raw,
    };
  }

  async closeTrade(input: {
    tradeId: string;
    instrument?: string | null;
    accountId?: string | null;
  }): Promise<DemoMutationCloseResult> {
    const bridge = getForexConnectBridge();
    const raw = await bridge.demoMutationCloseTrade({
      tradeId: input.tradeId,
      instrument: input.instrument ?? null,
      accountId: input.accountId ?? null,
      secret: secret(),
    });
    return {
      ok: Boolean(raw.ok),
      code: String(raw.code || (raw.ok ? "OK" : "FAILED")),
      error: raw.error && typeof raw.error === "object"
        ? String((raw.error as { message?: string }).message || "")
        : (raw.error == null ? null : String(raw.error)),
      brokerOrderId: raw.brokerOrderId == null ? null : String(raw.brokerOrderId),
      tradeId: raw.tradeId == null ? null : String(raw.tradeId),
      closeConfirmed: Boolean(raw.closeConfirmed),
      stillOpen: Boolean(raw.stillOpen),
      mutatesBroker: Boolean(raw.mutatesBroker),
      raw,
    };
  }
}

let adapter: ForexConnectDemoMutationAdapter | null = null;

export function getForexConnectDemoMutationAdapter(): ForexConnectDemoMutationAdapter {
  if (!adapter) adapter = new ForexConnectDemoMutationAdapter();
  return adapter;
}
