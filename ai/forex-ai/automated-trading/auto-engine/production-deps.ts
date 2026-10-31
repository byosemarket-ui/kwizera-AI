/**
 * Production deps for auto-engine ticks.
 * Read-only ForexConnect + local stores by default.
 * Broker submit only via worker armed_execute + submitAuthorized gates.
 */
import { getForexConnectBridge } from "../../../market-data/forexconnect/client.js";
import type { ForexConnectInstrument } from "../../../market-data/forexconnect/types.js";
import {
  DEMO_OPEN_RISK_DEFAULTS,
  countOpenPositionsFromTradesPayload,
  sumOpenExposureLotsFromTradesPayload,
  type DemoOpenMarketInstrumentSpecs,
} from "../demo-execution/open-market-risk.js";
import { getDemoLifecycleOrchestrator } from "../demo-execution/orchestrator.js";
import { getDemoExecutionGrantStore, normalizeGrantInstrument } from "../demo-execution/grant-store.js";
import { blocksAdditionalDemoEntries } from "../demo-execution/open-fill-assessment.js";
import { loadAutoEngineConfig } from "./config.js";
import type { AutoEngineTickDeps } from "./worker.js";
import type { StrategyCandle } from "./strategy/rules.js";

function selectInstrumentSpecs(
  instruments: ForexConnectInstrument[],
  instrument: string,
): DemoOpenMarketInstrumentSpecs | null {
  const want = normalizeGrantInstrument(instrument);
  if (!want || !Array.isArray(instruments)) return null;
  const row = instruments.find((i) => {
    const keys = [i.providerSymbol, i.displaySymbol, i.canonicalSymbol]
      .map((s) => normalizeGrantInstrument(String(s ?? "")));
    return keys.includes(want);
  });
  if (!row) return null;
  const condStop = row.condDistStop;
  return {
    providerSymbol: row.providerSymbol,
    baseUnitSize: row.baseUnitSize ?? null,
    pointSize: row.pointSize ?? null,
    pipCostAccount: row.pipCost ?? null,
    mmrPerLot: row.mmrPerLot ?? null,
    condDistStopRaw:
      condStop != null && Number.isFinite(Number(condStop)) ? Number(condStop) : null,
    condDistReportedUnit: row.condDistUnit ?? null,
    condDistMethod: row.condDistMethod ?? null,
    condDistAvailable: Boolean(row.condDistAvailable),
  };
}

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
      // Phase 4.7 — never throw on disconnect; dry-run must fail closed.
      // Match ForexConnectInstrument provider/display/canonical symbols (not legacy `symbol`).
      try {
        const bridge = getForexConnectBridge();
        const listed = await bridge.listInstruments();
        if (!listed.ok || !Array.isArray(listed.instruments)) return null;
        const want = normalizeGrantInstrument(instrument);
        if (!want) return null;
        for (const row of listed.instruments) {
          const r = row as Record<string, unknown>;
          const keys = [r.providerSymbol, r.displaySymbol, r.canonicalSymbol, r.symbol, r.instrument]
            .map((s) => normalizeGrantInstrument(String(s ?? "")));
          if (!keys.includes(want)) continue;
          const ps = Number(r.pointSize ?? r.PointSize);
          return Number.isFinite(ps) && ps > 0 ? ps : null;
        }
        return null;
      } catch {
        return null;
      }
    },
    async loadQuoteMeta(instrument) {
      try {
        const bridge = getForexConnectBridge();
        const quotes = await bridge.pollQuotes();
        const want = instrument.replace(/\s+/g, "").toUpperCase();
        const list = Array.isArray((quotes as { quotes?: unknown }).quotes)
          ? (quotes as { quotes: Array<Record<string, unknown>> }).quotes
          : Array.isArray(quotes)
            ? (quotes as Array<Record<string, unknown>>)
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
      } catch {
        return { ageMs: null, spread: null };
      }
    },
    async loadAccountRiskContext() {
      const bridge = getForexConnectBridge();
      const primaryInstrument = config.instruments[0] ?? "XAU/USD";
      const emptyAccounts = { ok: false, accounts: [] as never[], fetchedAt: null as string | null };
      const emptyTrades = { ok: false, trades: [] as never[], fetchedAt: null as string | null };
      const emptyClosed = { ok: false, closedTrades: [] as never[], fetchedAt: null as string | null };
      const emptyStatus = { status: "DISCONNECTED" };
      const emptyListed = { ok: false, instruments: [] as never[] };
      const [accounts, trades, closed, status, listed] = await Promise.all([
        bridge.listAccounts().catch(() => emptyAccounts),
        bridge.listTrades().catch(() => emptyTrades),
        bridge.listClosedTrades().catch(() => emptyClosed),
        bridge.getStatus().catch(() => emptyStatus),
        bridge.listInstruments().catch(() => emptyListed),
      ]);
      const acctRow = accounts.ok && Array.isArray(accounts.accounts) && accounts.accounts[0]
        ? accounts.accounts[0]
        : null;
      const equity = acctRow && Number.isFinite(Number(acctRow.equity)) ? Number(acctRow.equity) : null;
      const balance = acctRow && Number.isFinite(Number(acctRow.balance)) ? Number(acctRow.balance) : null;
      const usable = acctRow && Number.isFinite(Number(acctRow.usableMargin))
        ? Number(acctRow.usableMargin)
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

      const instruments = listed.ok && Array.isArray(listed.instruments) ? listed.instruments : [];
      const instrumentSpecs = selectInstrumentSpecs(instruments, primaryInstrument);
      const tradesPayload = trades as unknown as Record<string, unknown>;
      const openExposureLots = sumOpenExposureLotsFromTradesPayload(tradesPayload, {
        instrument: primaryInstrument,
        baseUnitSize: instrumentSpecs?.baseUnitSize ?? null,
        scope: "instrument",
      });
      const openPositionCount = countOpenPositionsFromTradesPayload(tradesPayload, {
        instrument: primaryInstrument,
        scope: "instrument",
      });

      const orch = getDemoLifecycleOrchestrator();
      const internalPositions = orch.listInternalPositionsForReconcile();
      const hasUnresolvedUnprotectedFill = internalPositions.some((p) =>
        p.blocksAdditionalEntries === true
        || blocksAdditionalDemoEntries({
          fillConfirmed: p.fillConfirmed,
          tradeId: p.tradeId,
          state: p.blocksAdditionalEntries ? "PROTECTION_FAILED" : "PROTECTED",
        })
      );

      const want = config.instruments.map((s) => normalizeGrantInstrument(s));
      const activeGrant = getDemoExecutionGrantStore().listActive().find((g) =>
        (g.instrumentAllowlist ?? []).some((i) => want.includes(normalizeGrantInstrument(i)))
      ) ?? null;
      const activeGrantId = activeGrant?.grantId ?? null;
      const grantMaxLots = activeGrant && Number.isFinite(Number(activeGrant.maxLots))
        ? Number(activeGrant.maxLots)
        : 1;
      const entriesUsedInGrant = activeGrantId
        ? internalPositions.filter((p) =>
          p.fillConfirmed && want.includes(normalizeGrantInstrument(p.instrument))
        ).length
        : 0;

      return {
        riskPartial: {
          requestedAccountId: acctRow?.accountId ?? null,
          account: acctRow
            ? {
              accountId: String(acctRow.accountId),
              environment: String(acctRow.environment ?? "demo"),
              accountCurrency: acctRow.accountCurrency,
              equity,
              usableMargin: usable,
              balance,
              missingFields: acctRow.missingFields ?? [],
              fetchedAtUtc: accounts.fetchedAt ?? new Date().toISOString(),
              equityIncludesFloatingPl: acctRow.equityIncludesFloatingPl,
            }
            : null,
          accountFetchOk: Boolean(accounts.ok),
          accountCount: Array.isArray(accounts.accounts) ? accounts.accounts.length : 0,
          instrumentSpecs,
          openExposureLots,
          openPositionCount,
          tradesFetchOk: Boolean(trades.ok),
          hasUnresolvedUnprotectedFill,
          quoteTimestamp: Date.now(),
          limits: { ...DEMO_OPEN_RISK_DEFAULTS },
        },
        grantMaxLots,
        emergencyEntryLock: options?.emergencyEntryLock !== false,
        masterEnable: options?.masterEnable === true,
        allowDemoMutationEnabled,
        entriesUsedInGrant,
        cooldownUntilMs: 0,
        accountId: acctRow?.accountId ?? null,
        accountCurrency: acctRow?.accountCurrency ?? null,
        equity,
        balance,
        usableMargin: usable,
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
        internalPositions,
        activeGrantId,
      };
    },
  };
}
