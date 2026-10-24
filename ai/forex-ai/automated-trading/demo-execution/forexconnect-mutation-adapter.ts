/**
 * Phase 58.3 — ForexConnect DEMO mutation adapter (Node → sidecar).
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
  brokerProtected?: boolean;
  protection?: Record<string, unknown> | null;
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
  remainingAmount?: number | null;
  partial?: boolean;
  mutatesBroker: boolean;
  raw: Record<string, unknown>;
}

export interface DemoMutationProtectResult {
  ok: boolean;
  code: string;
  error?: string | null;
  brokerProtected?: boolean;
  protection?: Record<string, unknown> | null;
  mutatesBroker: boolean;
  raw: Record<string, unknown>;
}

export interface DemoMutationCancelResult {
  ok: boolean;
  code: string;
  error?: string | null;
  brokerOrderId?: string | null;
  cancelConfirmed?: boolean;
  stillPresent?: boolean;
  mutatesBroker: boolean;
  raw: Record<string, unknown>;
}

function secret(): string {
  return String(process.env.KWIZERA_FOREXCONNECT_DEMO_MUTATION_SECRET || "").trim();
}

function extractError(raw: Record<string, unknown>): string | null {
  if (raw.error && typeof raw.error === "object") {
    return String((raw.error as { message?: string }).message || "") || null;
  }
  return raw.error == null ? null : String(raw.error);
}

export class ForexConnectDemoMutationAdapter {
  readonly placesOrdersGlobal = false as const;
  readonly acceptsForExecutionGlobal = false as const;

  async probeSdkCapabilities(): Promise<Record<string, unknown>> {
    const bridge = getForexConnectBridge();
    return bridge.probeSdkCapabilities();
  }

  async getOfferQuote(instrument: string): Promise<Record<string, unknown>> {
    const bridge = getForexConnectBridge();
    return bridge.getOfferQuote(instrument);
  }

  async openTrueMarket(input: {
    instrument: string;
    direction: "BUY" | "SELL";
    lots: number;
    accountId?: string | null;
    stopLoss?: number | null;
    takeProfit?: number | null;
    attachProtectiveAfterFill?: boolean;
  }): Promise<DemoMutationOpenResult> {
    const bridge = getForexConnectBridge();
    const raw = await bridge.demoMutationOpenMarket({
      instrument: input.instrument,
      buySell: input.direction,
      lots: input.lots,
      accountId: input.accountId ?? null,
      rateStop: input.stopLoss ?? null,
      rateLimit: input.takeProfit ?? null,
      attachProtectiveAfterFill: input.attachProtectiveAfterFill === true,
      secret: secret(),
    });
    return {
      ok: Boolean(raw.ok),
      code: String(raw.code || (raw.ok ? "OK" : "FAILED")),
      error: extractError(raw),
      brokerOrderId: raw.brokerOrderId == null ? null : String(raw.brokerOrderId),
      trade: (raw.trade as Record<string, unknown> | null | undefined) ?? null,
      fillConfirmed: Boolean(raw.fillConfirmed),
      brokerProtected: Boolean(raw.brokerProtected),
      protection: (raw.protection as Record<string, unknown> | null | undefined) ?? null,
      mutatesBroker: Boolean(raw.mutatesBroker),
      raw,
    };
  }

  async attachProtective(input: {
    tradeId: string;
    stopLoss?: number | null;
    takeProfit?: number | null;
    accountId?: string | null;
  }): Promise<DemoMutationProtectResult> {
    const bridge = getForexConnectBridge();
    const raw = await bridge.demoMutationAttachProtective({
      tradeId: input.tradeId,
      stopRate: input.stopLoss ?? null,
      limitRate: input.takeProfit ?? null,
      accountId: input.accountId ?? null,
      secret: secret(),
    });
    return {
      ok: Boolean(raw.ok),
      code: String(raw.code || (raw.ok ? "OK" : "FAILED")),
      error: extractError(raw),
      brokerProtected: Boolean(raw.brokerProtected),
      protection: (raw.protection as Record<string, unknown> | null | undefined) ?? null,
      mutatesBroker: Boolean(raw.mutatesBroker),
      raw,
    };
  }

  async reconcileProtection(tradeId: string): Promise<DemoMutationProtectResult> {
    const bridge = getForexConnectBridge();
    const raw = await bridge.demoMutationReconcileProtection({
      tradeId,
      secret: secret(),
    });
    return {
      ok: Boolean(raw.ok),
      code: String(raw.code || (raw.ok ? "OK" : "FAILED")),
      error: extractError(raw),
      brokerProtected: Boolean(raw.brokerProtected),
      protection: (raw.protection as Record<string, unknown> | null | undefined) ?? null,
      mutatesBroker: false,
      raw,
    };
  }

  async closeTrade(input: {
    tradeId: string;
    instrument?: string | null;
    accountId?: string | null;
    amount?: number | null;
  }): Promise<DemoMutationCloseResult> {
    const bridge = getForexConnectBridge();
    const raw = await bridge.demoMutationCloseTrade({
      tradeId: input.tradeId,
      instrument: input.instrument ?? null,
      accountId: input.accountId ?? null,
      amount: input.amount ?? null,
      secret: secret(),
    });
    return {
      ok: Boolean(raw.ok),
      code: String(raw.code || (raw.ok ? "OK" : "FAILED")),
      error: extractError(raw),
      brokerOrderId: raw.brokerOrderId == null ? null : String(raw.brokerOrderId),
      tradeId: raw.tradeId == null ? null : String(raw.tradeId),
      closeConfirmed: Boolean(raw.closeConfirmed),
      stillOpen: Boolean(raw.stillOpen),
      remainingAmount: raw.remainingAmount == null ? null : Number(raw.remainingAmount),
      partial: Boolean(raw.partial),
      mutatesBroker: Boolean(raw.mutatesBroker),
      raw,
    };
  }

  async cancelPending(input: {
    brokerOrderId: string;
    accountId?: string | null;
  }): Promise<DemoMutationCancelResult> {
    const bridge = getForexConnectBridge();
    const raw = await bridge.demoMutationCancelPending({
      brokerOrderId: input.brokerOrderId,
      accountId: input.accountId ?? null,
      secret: secret(),
    });
    return {
      ok: Boolean(raw.ok),
      code: String(raw.code || (raw.ok ? "OK" : "FAILED")),
      error: extractError(raw),
      brokerOrderId: raw.brokerOrderId == null ? null : String(raw.brokerOrderId),
      cancelConfirmed: Boolean(raw.cancelConfirmed),
      stillPresent: Boolean(raw.stillPresent),
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
