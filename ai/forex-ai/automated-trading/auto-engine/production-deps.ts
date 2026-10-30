/**
 * Production deps for auto-engine ticks.
 * Read-only ForexConnect + local stores by default.
 * Broker submit only via worker armed_execute + submitAuthorized gates.
 */
import { getForexConnectBridge } from "../../../market-data/forexconnect/client.js";
import { DEMO_OPEN_RISK_DEFAULTS } from "../demo-execution/open-market-risk.js";
import { getDemoLifecycleOrchestrator } from "../demo-execution/orchestrator.js";
import { getDemoExecutionGrantStore } from "../demo-execution/grant-store.js";
import { loadAutoEngineConfig } from "./config.js";
import type { AutoEngineTickDeps } from "./worker.js";
import type { StrategyCandle } from "./strategy/rules.js";

function mapCandles(raw: unknown): StrategyCandle[] {
  if (!Array.isArray(raw)) return [];
  const out: StrategyCandle[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const open = Number(o.open);
    const high = Number(o.high);
    const low = Number(o.low);
    const close = Number(o.close);
    if (![open, high, low, close].every((x) => Number.isFinite(x))) continue;
    const tRaw = o.time ?? o.timestamp ?? o.t;
    const t = typeof tRaw === "number" ? tRaw : Number(tRaw);
    if (!Number.isFinite(t)) continue;
    const time = t > 1e12 ? Math.floor(t / 1000) : Math.floor(t);
    const closed = o.closed === false ? false : true;
    out.push({ time, open, high, low, close, closed });
  }
  out.sort((a, b) => a.time - b.time);
  return out;
}

export function createProductionAutoEngineDeps(
  options?: {
    emergencyEntryLock?: boolean;
    masterEnable?: boolean;
  },
): AutoEngineTickDeps {
  const config = loadAutoEngineConfig();
  return {
    config,
    getOrchestrator: () => getDemoLifecycleOrchestrator(),
    async loadCandles(instrument, timeframe) {
      const bridge = getForexConnectBridge();
      try {
        const result = await bridge.getHistoricalCandles({
          symbol: instrument,
          timeframe: timeframe as never,
          limit: 120,
        });
        return mapCandles(result.candles);
      } catch {
        return [];
      }
    },
    async loadPointSize(instrument) {
      const bridge = getForexConnectBridge();
      const listed = await bridge.listInstruments();
      if (!listed.ok || !Array.isArray(listed.instruments)) return null;
      const want = instrument.replace(/\s+/g, "").toUpperCase();
      for (const row of listed.instruments) {
        const r = row as Record<string, unknown>;
        const sym = String(r.symbol ?? r.instrument ?? r.Instrument ?? "")
          .replace(/\s+/g, "")
          .toUpperCase();
        if (sym !== want) continue;
        const ps = Number(r.pointSize ?? r.PointSize);
        return Number.isFinite(ps) && ps > 0 ? ps : null;
      }
      return null;
    },
    async loadQuoteMeta(instrument) {
      const bridge = getForexConnectBridge();
      const quotes = await bridge.pollQuotes();
      const want = instrument.replace(/\s+/g, "").toUpperCase();
      const list = Array.isArray((quotes as { quotes?: unknown }).quotes)
        ? (quotes as { quotes: Array<Record<string, unknown>> }).quotes
        : [];
      const hit = list.find((q) =>
        String(q.providerSymbol ?? q.displaySymbol ?? q.symbol ?? "")
          .replace(/\s+/g, "")
          .toUpperCase() === want
      );
      if (!hit) return { ageMs: null, spread: null };
      const received = Number(hit.receivedAtMs ?? hit.sourceTimestampMs);
      const ageMs = Number.isFinite(received) ? Date.now() - received : null;
      const bid = Number(hit.bid);
      const ask = Number(hit.ask);
      const spread =
        Number.isFinite(bid) && Number.isFinite(ask) && ask >= bid ? ask - bid : null;
      return { ageMs, spread };
    },
    async loadAccountRiskContext() {
      const bridge = getForexConnectBridge();
      const [accounts, trades, closed, status] = await Promise.all([
        bridge.listAccounts(),
        bridge.listTrades(),
        bridge.listClosedTrades(),
        bridge.getStatus(),
      ]);
      const acct = accounts.ok && Array.isArray(accounts.accounts) && accounts.accounts[0]
        ? (accounts.accounts[0] as Record<string, unknown>)
        : null;
      const equity = acct ? Number(acct.equity ?? acct.Equity) : null;
      const balance = acct ? Number(acct.balance ?? acct.Balance) : null;
      const usableMargin = acct
        ? Number(acct.usableMargin ?? acct.UsableMargin ?? acct.dayPL)
        : null;
      // Prefer explicit usableMargin fields when present.
      const usable = acct
        ? Number(
          acct.usableMargin
            ?? acct.UsableMargin
            ?? acct.availableMargin
            ?? acct.AvailableMargin,
        )
        : null;

      const openTrades = trades.ok && Array.isArray((trades as { trades?: unknown }).trades)
        ? ((trades as { trades: Array<Record<string, unknown>> }).trades)
        : [];
      let openUnrealized = 0;
      let unrealizedOk = trades.ok === true;
      for (const t of openTrades) {
        const upl = Number(t.grossPL ?? t.GrossPL ?? t.pl ?? t.PL);
        if (!Number.isFinite(upl)) {
          unrealizedOk = false;
          break;
        }
        openUnrealized += upl;
      }
      if (!trades.ok) unrealizedOk = false;
      if (openTrades.length === 0 && trades.ok) {
        openUnrealized = 0;
        unrealizedOk = true;
      }

      const closedRows = (closed as { ok?: boolean; closedTrades?: unknown }).ok
        && Array.isArray((closed as { closedTrades: unknown }).closedTrades)
        ? ((closed as { closedTrades: Array<Record<string, unknown>> }).closedTrades)
        : null;

      const dayClosedTrades = closedRows
        ? closedRows.map((r) => ({
          tradeId: r.tradeId == null ? null : String(r.tradeId),
          closeTimeUtc: r.closeTime == null && r.CloseTime == null
            ? null
            : String(r.closeTime ?? r.CloseTime),
          realizedPnl: Number.isFinite(Number(r.grossPL ?? r.GrossPL ?? r.pl ?? r.PL))
            ? Number(r.grossPL ?? r.GrossPL ?? r.pl ?? r.PL)
            : null,
        }))
        : null;

      const allowRaw = String(process.env.KWIZERA_FOREXCONNECT_ALLOW_DEMO_MUTATION ?? "").trim();
      const allowDemoMutationEnabled = allowRaw === "1" || /^true$/i.test(allowRaw);

      return {
        riskPartial: {
          requestedAccountId: acct?.accountId == null ? null : String(acct.accountId),
          account: acct
            ? {
              accountId: String(acct.accountId ?? acct.AccountID ?? ""),
              environment: "demo",
              accountCurrency: acct.accountCurrency == null && acct.currency == null
                ? null
                : String(acct.accountCurrency ?? acct.currency),
              equity: Number.isFinite(equity) ? equity : null,
              usableMargin: Number.isFinite(usable) ? usable : (Number.isFinite(usableMargin) ? usableMargin : null),
              balance: Number.isFinite(balance) ? balance : null,
              missingFields: [],
              fetchedAtUtc: accounts.fetchedAt ?? new Date().toISOString(),
            }
            : null,
          accountFetchOk: Boolean(accounts.ok),
          accountCount: Array.isArray(accounts.accounts) ? accounts.accounts.length : 0,
          instrumentSpecs: null,
          openExposureLots: null,
          openPositionCount: null,
          tradesFetchOk: Boolean(trades.ok),
          hasUnresolvedUnprotectedFill: false,
          quoteTimestamp: Date.now(),
          limits: { ...DEMO_OPEN_RISK_DEFAULTS },
        },
        grantMaxLots: 1,
        emergencyEntryLock: options?.emergencyEntryLock !== false,
        masterEnable: options?.masterEnable === true,
        allowDemoMutationEnabled,
        entriesUsedInGrant: 0,
        cooldownUntilMs: 0,
        accountId: acct?.accountId == null ? null : String(acct.accountId),
        accountCurrency: acct
          ? String(acct.accountCurrency ?? acct.currency ?? "")
          : null,
        equity: Number.isFinite(equity) ? equity : null,
        balance: Number.isFinite(balance) ? balance : null,
        usableMargin: Number.isFinite(usable) ? usable : null,
        accountsFetchedAtUtc: accounts.fetchedAt ?? null,
        dayClosedTrades,
        closedTradesFetchOk: Boolean((closed as { ok?: boolean }).ok),
        closedTradesFetchedAtUtc: (closed as { fetchedAt?: string }).fetchedAt ?? null,
        openUnrealizedPnl: unrealizedOk ? openUnrealized : null,
        openTradesFetchOk: Boolean(trades.ok),
        openTradesFetchedAtUtc: (trades as { fetchedAt?: string }).fetchedAt ?? null,
        brokerConnected: String((status as { status?: string }).status ?? "").toUpperCase() === "CONNECTED",
        brokerPositions: openTrades.map((t) => ({
          tradeId: String(t.tradeId ?? t.TradeID ?? ""),
          instrument: String(t.instrument ?? t.symbol ?? t.Instrument ?? ""),
          lots: Number.isFinite(Number(t.lots)) ? Number(t.lots) : null,
          amount: Number.isFinite(Number(t.amount ?? t.Amount)) ? Number(t.amount ?? t.Amount) : null,
        })).filter((t) => t.tradeId),
        internalPositions: getDemoLifecycleOrchestrator().listInternalPositionsForReconcile(),
        activeGrantId: (() => {
          const active = getDemoExecutionGrantStore().listActive();
          const want = config.instruments.map((s) => s.replace(/\s+/g, "").toUpperCase());
          const hit = active.find((g) =>
            (g.instrumentAllowlist ?? []).some((i) =>
              want.includes(String(i).replace(/\s+/g, "").toUpperCase())
            )
          );
          return hit?.grantId ?? null;
        })(),
      };
    },
  };
}
