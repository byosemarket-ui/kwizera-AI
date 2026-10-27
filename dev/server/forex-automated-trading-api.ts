/**
 * Phase 51–54 / 56.2 — Automated Trading configuration, verification, OpenAI TA,
 * live monitoring, read-only decision validation & simulation-only draft risk API.
 * Admin-gated mutations. Never places broker orders.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  AUTOMATED_EXECUTION_BANNER,
  getAutomatedTradingService,
} from "../../ai/forex-ai/automated-trading/index.js";
import { requireForexAdmin } from "./forex-admin-auth.js";

type SendJson = (res: ServerResponse, status: number, data: unknown) => void;

async function readJsonBody(req: IncomingMessage, max = 16_000): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buf.length;
    if (size > max) throw Object.assign(new Error("Body too large"), { code: "PAYLOAD_TOO_LARGE" });
    chunks.push(buf);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  return JSON.parse(raw) as unknown;
}

function isAtPath(pathname: string, base: string): boolean {
  return pathname === base || pathname === `${base}/`;
}

export async function handleForexAutomatedTradingApi(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  sendJson: SendJson,
): Promise<boolean> {
  if (!url.pathname.startsWith("/api/forex/automated-trading")) return false;

  // Phase 58.3 — grant-scoped DEMO lifecycle paths are allowlisted before the broad guard.
  // They still require forex-admin auth + server-side grant/readiness/DEMO checks.
  const isDemoLifecyclePath = url.pathname.startsWith("/api/forex/automated-trading/demo-lifecycle");

  // Reject any order-like paths explicitly (except allowlisted DEMO lifecycle).
  if (!isDemoLifecyclePath && /order|position\/close|submit|execute/i.test(url.pathname)) {
    sendJson(res, 403, {
      ok: false,
      error: {
        code: "EXECUTION_FORBIDDEN",
        message: AUTOMATED_EXECUTION_BANNER,
      },
      placesOrders: false,
    });
    return true;
  }

  try {
    if (!requireForexAdmin(req, res, sendJson, url.pathname)) return true;
    const service = getAutomatedTradingService();

    if (isAtPath(url.pathname, "/api/forex/automated-trading/broker-ro-tables")) {
      if (req.method !== "GET") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use GET." } });
        return true;
      }
      // Phase 56.2.3 / 60.0.2 / 60.0.3 — admin-gated RO accounts + ORDERS/TRADES/CLOSED_TRADES/SUMMARY
      // + Offers mark enrichment via existing pollQuotes (no duplicate session/subscribe).
      // Path deliberately avoids the substring "order" (blocked by EXECUTION_FORBIDDEN gate).
      const { getForexConnectBridge } = await import("../../ai/market-data/forexconnect/client.js");
      const {
        enrichOpenTradesWithMarks,
        ingestBrokerTradeSnapshots,
        getAtTradeHistoryStore,
        reconcileTradeMonitorSources,
      } = await import("../../ai/forex-ai/automated-trading/trade-history/index.js");
      const bridge = getForexConnectBridge();
      const [accounts, openOrders, openTrades, closedTrades, summary, fcStatus] = await Promise.all([
        bridge.listAccounts(),
        bridge.listOrders(),
        bridge.listTrades(),
        bridge.listClosedTrades(),
        bridge.listSummary(),
        bridge.getStatus(),
      ]);
      let quotes: Awaited<ReturnType<typeof bridge.pollQuotes>> = [];
      try {
        quotes = await bridge.pollQuotes();
      } catch {
        quotes = [];
      }
      const tradeRowsRaw = Array.isArray((openTrades as { trades?: unknown[] }).trades)
        ? (openTrades as { trades: unknown[] }).trades
        : [];
      const enrichedTrades = enrichOpenTradesWithMarks(tradeRowsRaw, quotes);
      const environment = String(
        (fcStatus as { environment?: string }).environment
        ?? (accounts as { status?: { environment?: string } }).status?.environment
        ?? "DEMO",
      );
      const ingest = await ingestBrokerTradeSnapshots({
        environment,
        openTrades: { trades: enrichedTrades },
        closedTrades,
      }).catch(() => null);
      const historyStore = getAtTradeHistoryStore();
      const historyMeta = historyStore.snapshot();
      const orderRows = Array.isArray((openOrders as { orders?: unknown[] }).orders)
        ? (openOrders as { orders: Array<Record<string, unknown>> }).orders
        : [];
      const closedRows = Array.isArray((closedTrades as { closedTrades?: unknown[] }).closedTrades)
        ? (closedTrades as { closedTrades: Array<Record<string, unknown>> }).closedTrades
        : [];
      const summaryRows = Array.isArray((summary as { summaries?: unknown[] }).summaries)
        ? (summary as { summaries: Array<Record<string, unknown>> }).summaries
        : [];
      const reconciliation = reconcileTradeMonitorSources({
        environment,
        openTrades: enrichedTrades as Array<{ tradeId?: string | null; accountIdMasked?: string | null }>,
        closedDayTrades: closedRows as Array<{ tradeId?: string | null }>,
        historyRecords: historyMeta.records,
        activeOrders: orderRows as Array<{ orderId?: string | null }>,
        instrumentSummaries: summaryRows as Array<{ instrument?: string | null; netPl?: number | null }>,
      });
      const closedCapability = String(
        (closedTrades as { capabilityStatus?: string }).capabilityStatus
        ?? ((closedTrades as { ok?: boolean }).ok ? "AVAILABLE" : "ERROR"),
      );
      const summaryCapability = String(
        (summary as { capabilityStatus?: string }).capabilityStatus
        ?? ((summary as { ok?: boolean }).ok ? "AVAILABLE" : "ERROR"),
      );
      sendJson(res, 200, {
        ok: true,
        placesOrders: false,
        acceptsForExecution: false,
        mutatesBroker: false,
        simulationOnly: true,
        accounts: {
          ok: accounts.ok,
          code: accounts.code,
          count: accounts.count,
          capabilityStatus: accounts.ok ? "AVAILABLE" : accounts.code === "DISCONNECTED" ? "AVAILABLE_BUT_DISCONNECTED" : "ERROR",
          // Masked rows only — never secrets.
          accounts: (accounts.accounts ?? []).map((a) => ({
            accountIdMasked: a.accountIdMasked,
            accountCurrency: a.accountCurrency,
            equity: a.equity,
            balance: a.balance,
            usedMargin: a.usedMargin,
            usableMargin: a.usableMargin,
            dayPl: (a as { dayPl?: number | null }).dayPl ?? null,
            grossPl: (a as { grossPl?: number | null }).grossPl ?? null,
            equityIncludesFloatingPl: true,
            missingFields: a.missingFields,
          })),
          fetchedAt: accounts.fetchedAt,
          trading: "DISABLED",
          note:
            "Equity/NAV already includes floating P/L when provided by the broker — do not add trade floatingPl again.",
        },
        openWorkingOrders: {
          ...openOrders,
          placesOrders: false,
          mutatesBroker: false,
          trading: "DISABLED",
          note:
            (openOrders as { note?: string }).note
            ?? "Read-only working-orders table probe (ORDERS). Not a broker mutation.",
        },
        openPositions: {
          ...openTrades,
          trades: enrichedTrades,
          count: enrichedTrades.length,
          placesOrders: false,
          mutatesBroker: false,
          trading: "DISABLED",
          markEnrichment: {
            source: "forexconnect-offers-pollQuotes",
            quoteCount: quotes.length,
            duplicateSubscription: false,
            note:
              "Mark prices use existing Offers pollQuotes path (BUY→bid, SELL→ask). Stale/invalid quotes are not presented as live.",
          },
          note:
            (openTrades as { note?: string }).note
            ?? "Read-only open-positions table probe (TRADES). Floating P/L from trades.gross_pl when SDK exposes it.",
        },
        closedTrades: {
          ...closedTrades,
          placesOrders: false,
          mutatesBroker: false,
          trading: "DISABLED",
          historyScope:
            (closedTrades as { historyScope?: string }).historyScope
            ?? "CURRENT_TRADING_DAY",
          capabilityStatus: closedCapability,
          note:
            (closedTrades as { note?: string }).note
            ?? "ClosedTrades is current trading day only — not an all-time ledger.",
        },
        instrumentSummaries: {
          ...summary,
          placesOrders: false,
          mutatesBroker: false,
          trading: "DISABLED",
          metricScope: "INSTRUMENT_SUMMARY",
          capabilityStatus: summaryCapability,
          note:
            (summary as { note?: string }).note
            ?? "Summary NetPL is instrument-scoped — never sum with trade floating P/L or label as account-wide.",
        },
        tradeHistoryIngest: ingest
          ? {
              openUpserted: ingest.openUpserted,
              closedUpserted: ingest.closedUpserted,
              skipped: ingest.skipped,
              skippedMissingId: ingest.skippedMissingId,
              historyAvailableFromUtc: ingest.historyAvailableFromUtc,
            }
          : null,
        reconciliation,
        historyAvailableFromUtc: historyMeta.historyAvailableFromUtc,
        phase: "60.0.6",
        quantityUnitSemantics: "SEE_STATUS_QUANTITY_SEMANTICS",
        minStopDistance: "SEE_STATUS_QUANTITY_SEMANTICS",
        note:
          "Use GET /api/forex/automated-trading/status for XAU quantity/min-stop evidence and exposure reconciliation. This route remains a read-only tables probe. Persisted history via GET /api/forex/automated-trading/trade-history. Performance via GET /api/forex/automated-trading/trade-performance. An empty closed/history array is not proof of all-time completeness. Session CONNECTED ≠ quote received.",
      });
      return true;
    }

    if (isAtPath(url.pathname, "/api/forex/automated-trading/trade-performance")) {
      if (req.method !== "GET") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use GET." } });
        return true;
      }
      // Phase 60.0.4 / 60.0.5 — read-only selected-period performance from persisted CLOSED + live snapshot.
      try {
        const {
          getAtTradeHistoryStore,
          buildPerformanceSummary,
          startOfUtcDayMs,
          TRADE_HISTORY_COVERAGE_NOTE,
          safeFiniteNumber,
        } = await import("../../ai/forex-ai/automated-trading/trade-history/index.js");
        const { getForexConnectBridge } = await import("../../ai/market-data/forexconnect/client.js");
        const store = getAtTradeHistoryStore();
        const preset = String(url.searchParams.get("preset") ?? "").trim().toLowerCase();
        let fromUtc = url.searchParams.get("from") || url.searchParams.get("fromUtc");
        let toUtc = url.searchParams.get("to") || url.searchParams.get("toUtc");
        const nowMs = Date.now();
        let periodLabel = "selected_range";
        if (preset === "today") {
          fromUtc = new Date(startOfUtcDayMs(nowMs)).toISOString();
          toUtc = new Date(nowMs).toISOString();
          periodLabel = "today_utc";
        } else if (preset === "all" || (!fromUtc && !toUtc && !preset)) {
          fromUtc = store.snapshot().historyAvailableFromUtc;
          toUtc = new Date(nowMs).toISOString();
          periodLabel = "all_persisted";
        }
        if (fromUtc && !Number.isFinite(Date.parse(fromUtc))) {
          sendJson(res, 400, {
            ok: false,
            error: { code: "INVALID_FROM", message: "from/fromUtc must be a valid ISO timestamp." },
            placesOrders: false,
          });
          return true;
        }
        if (toUtc && !Number.isFinite(Date.parse(toUtc))) {
          sendJson(res, 400, {
            ok: false,
            error: { code: "INVALID_TO", message: "to/toUtc must be a valid ISO timestamp." },
            placesOrders: false,
          });
          return true;
        }
        const accountIdMasked = url.searchParams.get("accountIdMasked");
        const environment = url.searchParams.get("environment");
        const instrument = url.searchParams.get("instrument");
        const direction = url.searchParams.get("direction") || url.searchParams.get("side");
        const accountScope = accountIdMasked?.trim() || null;
        // Reject obvious unmasked numeric account IDs — history only stores masked forms.
        if (accountScope && /^\d{5,}$/.test(accountScope)) {
          sendJson(res, 400, {
            ok: false,
            error: {
              code: "INVALID_ACCOUNT_SCOPE",
              message: "accountIdMasked must be a masked account identifier, not a raw account id.",
            },
            placesOrders: false,
          });
          return true;
        }
        const closed = store.queryMatchingAll({
          fromUtc,
          toUtc,
          instrument,
          direction: direction
            ? direction.toUpperCase().replace(/^B$/, "BUY").replace(/^S$/, "SELL")
            : null,
          status: "CLOSED",
          accountIdMasked: accountScope,
          environment: environment?.trim() || null,
        });

        // Optional live open/order counts — reuse shared bridge; no new Offers subscription.
        const bridge = getForexConnectBridge();
        const [accounts, openTrades, openOrders] = await Promise.all([
          bridge.listAccounts().catch(() => ({ ok: false, accounts: [] as unknown[] })),
          bridge.listTrades().catch(() => ({ trades: [] as unknown[] })),
          bridge.listOrders().catch(() => ({ orders: [] as unknown[] })),
        ]);
        const accountRows = Array.isArray((accounts as { accounts?: unknown[] }).accounts)
          ? (accounts as { accounts: Array<Record<string, unknown>> }).accounts
          : [];
        const primary = accountScope
          ? accountRows.find((a) => String(a.accountIdMasked ?? "") === accountScope)
          : accountRows[0];
        const tradeRowsRaw = Array.isArray((openTrades as { trades?: unknown[] }).trades)
          ? (openTrades as { trades: Array<Record<string, unknown>> }).trades
          : [];
        const tradeRows = accountScope
          ? tradeRowsRaw.filter((t) => String(t.accountIdMasked ?? "") === accountScope)
          : tradeRowsRaw;
        const orderRowsRaw = Array.isArray((openOrders as { orders?: unknown[] }).orders)
          ? (openOrders as { orders: Array<Record<string, unknown>> }).orders
          : [];
        const orderRows = accountScope
          ? orderRowsRaw.filter((o) => {
            const acct = o.accountIdMasked;
            return acct == null || String(acct) === accountScope;
          })
          : orderRowsRaw;
        const currency = primary?.accountCurrency != null ? String(primary.accountCurrency) : null;
        const openForAnalytics = tradeRows.map((t) => ({
          tradeId: t.tradeId != null ? String(t.tradeId) : null,
          accountIdMasked: t.accountIdMasked != null ? String(t.accountIdMasked) : null,
          floatingPl: safeFiniteNumber(t.floatingPl ?? t.grossPl),
          currency,
        }));
        const performance = buildPerformanceSummary({
          openTrades: openForAnalytics,
          activeOrderCount: orderRows.length,
          closedTrades: closed.map((r) => ({
            recordKey: r.recordKey,
            tradeId: r.tradeId,
            accountIdMasked: r.accountIdMasked,
            lifecycleStatus: r.lifecycleStatus,
            grossPl: r.grossPl,
            netPl: r.netPl,
            commission: r.commission,
            rolloverInterest: r.rolloverInterest,
            closeTime: r.closeTime,
            openTime: r.openTime,
            currency,
          })),
          period: {
            fromUtc,
            toUtc,
            historyAvailableFromUtc: store.snapshot().historyAvailableFromUtc,
            accountCurrency: currency,
            equity: safeFiniteNumber(primary?.equity),
            equityIncludesFloatingPl: true,
            nowMs,
          },
          periodLabel,
        });
        sendJson(res, 200, {
          ok: true,
          placesOrders: false,
          acceptsForExecution: false,
          mutatesBroker: false,
          coverageNote: TRADE_HISTORY_COVERAGE_NOTE,
          emptyClosedIsNotCompleteHistory: true,
          accountScope,
          performance,
          phase: "60.0.6",
        });
      } catch {
        sendJson(res, 500, {
          ok: false,
          error: {
            code: "TRADE_PERFORMANCE_UNAVAILABLE",
            message: "Trade performance summary is temporarily unavailable.",
          },
          placesOrders: false,
          acceptsForExecution: false,
          mutatesBroker: false,
        });
      }
      return true;
    }

    if (isAtPath(url.pathname, "/api/forex/automated-trading/trade-history")) {
      if (req.method !== "GET") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use GET." } });
        return true;
      }
      // Phase 60.0.3 — authenticated, account-scoped, read-only persisted trade history.
      try {
        const {
          getAtTradeHistoryStore,
          TRADE_HISTORY_COVERAGE_NOTE,
        } = await import("../../ai/forex-ai/automated-trading/trade-history/index.js");
        const store = getAtTradeHistoryStore();
        const fromUtc = url.searchParams.get("from") || url.searchParams.get("fromUtc");
        const toUtc = url.searchParams.get("to") || url.searchParams.get("toUtc");
        const instrument = url.searchParams.get("instrument");
        const direction = url.searchParams.get("direction") || url.searchParams.get("side");
        const statusParam = url.searchParams.get("status");
        const accountIdMasked = url.searchParams.get("accountIdMasked");
        const environment = url.searchParams.get("environment");
        const limitRaw = Number(url.searchParams.get("limit") ?? 50);
        const offsetRaw = Number(url.searchParams.get("offset") ?? 0);
        if (fromUtc && !Number.isFinite(Date.parse(fromUtc))) {
          sendJson(res, 400, {
            ok: false,
            error: { code: "INVALID_FROM", message: "from/fromUtc must be a valid ISO timestamp." },
            placesOrders: false,
          });
          return true;
        }
        if (toUtc && !Number.isFinite(Date.parse(toUtc))) {
          sendJson(res, 400, {
            ok: false,
            error: { code: "INVALID_TO", message: "to/toUtc must be a valid ISO timestamp." },
            placesOrders: false,
          });
          return true;
        }
        if (direction && !/^(BUY|SELL|B|S)$/i.test(direction.trim())) {
          sendJson(res, 400, {
            ok: false,
            error: { code: "INVALID_DIRECTION", message: "direction must be BUY or SELL." },
            placesOrders: false,
          });
          return true;
        }
        const accountScope = accountIdMasked?.trim() || null;
        if (accountScope && /^\d{5,}$/.test(accountScope)) {
          sendJson(res, 400, {
            ok: false,
            error: {
              code: "INVALID_ACCOUNT_SCOPE",
              message: "accountIdMasked must be a masked account identifier, not a raw account id.",
            },
            placesOrders: false,
          });
          return true;
        }
        const status =
          statusParam && /^(OPEN|CLOSED|ALL)$/i.test(statusParam.trim())
            ? (statusParam.trim().toUpperCase() as "OPEN" | "CLOSED" | "ALL")
            : statusParam
              ? null
              : "ALL";
        if (statusParam && status == null) {
          sendJson(res, 400, {
            ok: false,
            error: { code: "INVALID_STATUS", message: "status must be OPEN, CLOSED, or ALL." },
            placesOrders: false,
          });
          return true;
        }
        const result = store.query({
          fromUtc,
          toUtc,
          instrument,
          direction: direction ? direction.toUpperCase().replace(/^B$/, "BUY").replace(/^S$/, "SELL") : null,
          status,
          accountIdMasked: accountScope,
          environment: environment?.trim() || null,
          limit: Number.isFinite(limitRaw) ? limitRaw : 50,
          offset: Number.isFinite(offsetRaw) ? offsetRaw : 0,
        });
        sendJson(res, 200, {
          ok: true,
          placesOrders: false,
          acceptsForExecution: false,
          mutatesBroker: false,
          historyAvailableFromUtc: result.historyAvailableFromUtc,
          coverageNote: TRADE_HISTORY_COVERAGE_NOTE,
          emptyResultIsNotCompleteHistory: true,
          accountScope,
          total: result.total,
          limit: result.limit,
          offset: result.offset,
          records: result.records,
          phase: "60.0.6",
        });
      } catch {
        sendJson(res, 500, {
          ok: false,
          error: {
            code: "TRADE_HISTORY_UNAVAILABLE",
            message: "Persisted trade history is temporarily unavailable.",
          },
          placesOrders: false,
          acceptsForExecution: false,
          mutatesBroker: false,
        });
      }
      return true;
    }

    if (isAtPath(url.pathname, "/api/forex/automated-trading/status")) {
      // Phase 57.4 — align automation/worker before building authoritative status.
      await service.reconcileAutomationMonitorAlignment().catch(() => undefined);
      if (req.method !== "GET" && req.method !== "HEAD") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use GET." } });
        return true;
      }
      const status = await service.buildStatus();
      sendJson(res, 200, { ok: true, status, placesOrders: false });
      return true;
    }

    if (isAtPath(url.pathname, "/api/forex/automated-trading/audit")) {
      if (req.method !== "GET" && req.method !== "HEAD") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use GET." } });
        return true;
      }
      const limit = Number(url.searchParams.get("limit") ?? 40);
      sendJson(res, 200, {
        ok: true,
        events: service.getAudit(Number.isFinite(limit) ? limit : 40),
        placesOrders: false,
      });
      return true;
    }

    if (isAtPath(url.pathname, "/api/forex/automated-trading/environment")) {
      if (req.method !== "POST") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." } });
        return true;
      }
      const body = (await readJsonBody(req)) as Record<string, unknown>;
      const result = await service.selectEnvironment({
        environment: body.environment,
        confirm: body.confirm,
        expectedCurrentEnvironment: body.expectedCurrentEnvironment,
        expectedEnvironmentEpoch: body.expectedEnvironmentEpoch,
      });
      if (!result.ok) {
        sendJson(res, 409, {
          ok: false,
          error: { code: result.code, message: result.message },
          status: result.status,
          placesOrders: false,
        });
        return true;
      }
      sendJson(res, 200, { ok: true, status: result.status, placesOrders: false });
      return true;
    }

    if (isAtPath(url.pathname, "/api/forex/automated-trading/controls")) {
      if (req.method !== "POST") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." } });
        return true;
      }
      const body = (await readJsonBody(req)) as Record<string, unknown>;
      const patch = (body.patch && typeof body.patch === "object")
        ? (body.patch as Record<string, unknown>)
        : body;
      const result = await service.updateControls({
        environment: body.environment,
        expectedEnvironmentEpoch: body.expectedEnvironmentEpoch,
        patch: {
          masterEnable: typeof patch.masterEnable === "boolean" ? patch.masterEnable : undefined,
          automaticEntry: typeof patch.automaticEntry === "boolean" ? patch.automaticEntry : undefined,
          positionManagement:
            typeof patch.positionManagement === "boolean" ? patch.positionManagement : undefined,
          emergencyEntryLock:
            typeof patch.emergencyEntryLock === "boolean" ? patch.emergencyEntryLock : undefined,
          capitalAllocationPercent:
            patch.capitalAllocationPercent === null
              ? null
              : typeof patch.capitalAllocationPercent === "number"
                || (typeof patch.capitalAllocationPercent === "string"
                  && patch.capitalAllocationPercent.trim() !== "")
                ? Number(patch.capitalAllocationPercent)
                : undefined,
        },
      });
      if (!result.ok) {
        sendJson(res, 409, {
          ok: false,
          error: { code: result.code, message: result.message },
          status: result.status,
          placesOrders: false,
        });
        return true;
      }
      sendJson(res, 200, { ok: true, status: result.status, placesOrders: false });
      return true;
    }

    if (isAtPath(url.pathname, "/api/forex/automated-trading/emergency-lock")) {
      if (req.method !== "POST") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." } });
        return true;
      }
      const body = (await readJsonBody(req)) as Record<string, unknown>;
      const result = await service.setEmergencyLock({
        environment: body.environment,
        locked: body.locked,
        expectedEnvironmentEpoch: body.expectedEnvironmentEpoch,
      });
      if (!result.ok) {
        sendJson(res, 409, {
          ok: false,
          error: { code: result.code, message: result.message },
          status: result.status,
          placesOrders: false,
        });
        return true;
      }
      sendJson(res, 200, { ok: true, status: result.status, placesOrders: false });
      return true;
    }

    if (isAtPath(url.pathname, "/api/forex/automated-trading/verify-account")) {
      if (req.method !== "POST") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." } });
        return true;
      }
      const body = (await readJsonBody(req)) as Record<string, unknown>;
      const result = await service.recordAccountVerification({
        environment: body.environment,
        accountId: body.accountId,
        status: body.status,
        expectedEnvironmentEpoch: body.expectedEnvironmentEpoch,
      });
      if (!result.ok) {
        sendJson(res, 409, {
          ok: false,
          error: { code: result.code, message: result.message },
          status: result.status,
          placesOrders: false,
        });
        return true;
      }
      sendJson(res, 200, { ok: true, status: result.status, placesOrders: false });
      return true;
    }

    if (isAtPath(url.pathname, "/api/forex/automated-trading/verify")) {
      if (req.method !== "POST") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." } });
        return true;
      }
      const body = (await readJsonBody(req)) as Record<string, unknown>;
      const result = await service.runVerification({
        environment: body.environment,
        expectedEnvironmentEpoch: body.expectedEnvironmentEpoch,
        instrument: body.instrument,
        accountId: body.accountId,
        timeframe: body.timeframe,
      });
      if (!result.ok) {
        sendJson(res, result.code === "STALE_EPOCH" || result.code === "ENVIRONMENT_MISMATCH" ? 409 : 503, {
          ok: false,
          error: { code: result.code, message: result.message },
          status: result.status,
          placesOrders: false,
        });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        verification: result.verification,
        status: result.status,
        placesOrders: false,
      });
      return true;
    }

    if (isAtPath(url.pathname, "/api/forex/automated-trading/verification")) {
      if (req.method !== "GET" && req.method !== "HEAD") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use GET." } });
        return true;
      }
      const status = await service.buildStatus();
      sendJson(res, 200, {
        ok: true,
        verification: service.getLatestVerification(),
        status,
        placesOrders: false,
      });
      return true;
    }

    if (isAtPath(url.pathname, "/api/forex/automated-trading/instrument")) {
      if (req.method !== "POST") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." } });
        return true;
      }
      const body = (await readJsonBody(req)) as Record<string, unknown>;
      const result = await service.setSelectedInstrument({
        environment: body.environment,
        instrument: body.instrument,
        expectedEnvironmentEpoch: body.expectedEnvironmentEpoch,
      });
      if (!result.ok) {
        sendJson(res, 409, {
          ok: false,
          error: { code: result.code, message: result.message },
          status: result.status,
          placesOrders: false,
        });
        return true;
      }
      sendJson(res, 200, { ok: true, status: result.status, placesOrders: false });
      return true;
    }

    // Phase 57.1 — master automation START/STOP (monitoring only; never broker execution).
    if (isAtPath(url.pathname, "/api/forex/automated-trading/automation/status")) {
      if (req.method !== "GET" && req.method !== "HEAD") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use GET." } });
        return true;
      }
      // Phase 57.4 — heal MONITORING vs stopped-worker before reporting.
      await service.reconcileAutomationMonitorAlignment().catch(() => undefined);
      sendJson(res, 200, {
        ok: true,
        automation: service.getAutomationControlStatus(),
        monitor: service.getMonitorStatus(),
        placesOrders: false,
        acceptsForExecution: false,
        brokerExecution: "DISABLED",
        executionStatusLabel: "EXECUTION_FORBIDDEN",
      });
      return true;
    }

    if (isAtPath(url.pathname, "/api/forex/automated-trading/automation/start")) {
      if (req.method !== "POST") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." } });
        return true;
      }
      const body = (await readJsonBody(req, 4_000)) as Record<string, unknown>;
      const result = await service.startAutomation({
        expectedStateVersion:
          typeof body.expectedStateVersion === "number" ? body.expectedStateVersion : undefined,
        instrument: body.instrument,
        timeframe: body.timeframe,
        operatorHint: "admin",
      });
      sendJson(res, result.ok ? 200 : result.code === "STALE_STATE_VERSION" ? 409 : 422, {
        ok: result.ok,
        code: result.code,
        message: result.message,
        automation: result.automation,
        status: result.status,
        monitor: result.monitor,
        placesOrders: false,
        acceptsForExecution: false,
        brokerExecution: "DISABLED",
        entryGenerationEnabled: false,
      });
      return true;
    }

    if (isAtPath(url.pathname, "/api/forex/automated-trading/automation/stop")) {
      if (req.method !== "POST") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." } });
        return true;
      }
      const body = (await readJsonBody(req, 4_000)) as Record<string, unknown>;
      const result = await service.stopAutomation({
        expectedStateVersion:
          typeof body.expectedStateVersion === "number" ? body.expectedStateVersion : undefined,
        operatorHint: "admin",
      });
      sendJson(res, 200, {
        ok: true,
        code: result.code,
        message: result.message,
        automation: result.automation,
        status: result.status,
        monitor: result.monitor,
        placesOrders: false,
        acceptsForExecution: false,
        brokerExecution: "DISABLED",
        entryGenerationEnabled: false,
      });
      return true;
    }

    if (isAtPath(url.pathname, "/api/forex/automated-trading/monitor/status")) {
      if (req.method !== "GET" && req.method !== "HEAD") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use GET." } });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        monitor: service.getMonitorStatus(),
        placesOrders: false,
      });
      return true;
    }

    if (isAtPath(url.pathname, "/api/forex/automated-trading/monitor/start")) {
      if (req.method !== "POST") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." } });
        return true;
      }
      const body = (await readJsonBody(req, 4_000)) as Record<string, unknown>;
      const result = await service.startMonitoring({
        environment: body.environment,
        expectedEnvironmentEpoch: body.expectedEnvironmentEpoch,
        instrument: body.instrument,
        timeframe: body.timeframe,
      });
      if (!result.ok) {
        sendJson(res, result.code === "STALE_EPOCH" || result.code === "ENVIRONMENT_MISMATCH" ? 409 : 422, {
          ok: false,
          error: { code: result.code, message: result.message },
          status: result.status,
          monitor: result.monitor,
          placesOrders: false,
        });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        status: result.status,
        monitor: result.monitor,
        placesOrders: false,
      });
      return true;
    }

    if (isAtPath(url.pathname, "/api/forex/automated-trading/monitor/stop")) {
      if (req.method !== "POST") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." } });
        return true;
      }
      const result = await service.stopMonitoring();
      sendJson(res, 200, {
        ok: true,
        status: result.status,
        monitor: result.monitor,
        placesOrders: false,
      });
      return true;
    }

    if (isAtPath(url.pathname, "/api/forex/automated-trading/monitor/change")) {
      if (req.method !== "POST") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." } });
        return true;
      }
      const body = (await readJsonBody(req, 4_000)) as Record<string, unknown>;
      const result = await service.changeMonitoring({
        environment: body.environment,
        expectedEnvironmentEpoch: body.expectedEnvironmentEpoch,
        instrument: body.instrument,
        timeframe: body.timeframe,
      });
      if (!result.ok) {
        sendJson(res, result.code === "STALE_EPOCH" || result.code === "ENVIRONMENT_MISMATCH" ? 409 : 422, {
          ok: false,
          error: { code: result.code, message: result.message },
          status: result.status,
          monitor: result.monitor,
          placesOrders: false,
        });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        status: result.status,
        monitor: result.monitor,
        placesOrders: false,
      });
      return true;
    }

    if (isAtPath(url.pathname, "/api/forex/automated-trading/monitor/analyze-now")) {
      if (req.method !== "POST") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." } });
        return true;
      }
      const body = (await readJsonBody(req, 4_000)) as Record<string, unknown>;
      const result = await service.runMonitorAnalysisNow({
        environment: body.environment,
        expectedEnvironmentEpoch: body.expectedEnvironmentEpoch,
        instrument: body.instrument,
        timeframe: body.timeframe,
      });
      if (!result.ok) {
        const statusCode =
          result.code === "STALE_EPOCH" || result.code === "ENVIRONMENT_MISMATCH"
            ? 409
            : result.code === "ANALYSIS_IN_FLIGHT"
              ? 429
              : result.code === "MODEL_NOT_VISION_ELIGIBLE" || result.code === "OPENAI_NOT_CONFIGURED"
                ? 503
                : 422;
        sendJson(res, statusCode, {
          ok: false,
          error: { code: result.code, message: result.message },
          status: result.status,
          monitor: result.monitor,
          placesOrders: false,
        });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        analysisId: result.analysisId,
        status: result.status,
        monitor: result.monitor,
        placesOrders: false,
      });
      return true;
    }

    {
      const imgMatch = url.pathname.match(
        /^\/api\/forex\/automated-trading\/monitor\/chart-image\/([A-Za-z0-9_-]+)$/,
      );
      if (imgMatch?.[1]) {
        if (req.method !== "GET" && req.method !== "HEAD") {
          sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use GET." } });
          return true;
        }
        const buf = service.readMonitorChartImage(imgMatch[1]);
        if (!buf) {
          sendJson(res, 404, {
            ok: false,
            error: { code: "NOT_FOUND", message: "Chart image not found." },
            placesOrders: false,
          });
          return true;
        }
        res.writeHead(200, {
          "Content-Type": "image/png",
          "Content-Length": buf.length,
          "Cache-Control": "private, max-age=60",
        });
        if (req.method !== "HEAD") res.end(buf);
        else res.end();
        return true;
      }
    }

    if (isAtPath(url.pathname, "/api/forex/automated-trading/openai/status")) {
      if (req.method !== "GET" && req.method !== "HEAD") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use GET." } });
        return true;
      }
      const openai = await service.getOpenAiAnalysisStatus();
      sendJson(res, 200, { ok: true, openai, placesOrders: false });
      return true;
    }

    if (isAtPath(url.pathname, "/api/forex/automated-trading/openai/analyze")) {
      if (req.method !== "POST") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." } });
        return true;
      }
      const body = (await readJsonBody(req, 8_000)) as Record<string, unknown>;
      const result = await service.runOpenAiAnalysis({
        environment: body.environment,
        expectedEnvironmentEpoch: body.expectedEnvironmentEpoch,
        instrument: body.instrument,
        timeframes: body.timeframes,
        timeoutMs: body.timeoutMs,
      });
      if (!result.ok) {
        const statusCode =
          result.code === "STALE_EPOCH" || result.code === "ENVIRONMENT_MISMATCH"
            ? 409
            : result.code === "OPENAI_NOT_CONFIGURED" || result.code === "OPENAI_MODEL_INVALID"
              ? 503
              : result.code === "DATA_INSUFFICIENT" || result.code === "INSTRUMENT_NOT_SELECTED"
                ? 422
                : result.code === "ANALYSIS_IN_FLIGHT" || result.code === "AI_QUEUE_FULL"
                  ? 429
                  : 502;
        sendJson(res, statusCode, {
          ok: false,
          error: { code: result.code, message: result.message },
          analysis: result.analysis,
          status: result.status,
          placesOrders: false,
        });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        analysis: result.analysis,
        status: result.status,
        placesOrders: false,
      });
      return true;
    }

    if (isAtPath(url.pathname, "/api/forex/automated-trading/openai/latest")) {
      if (req.method !== "GET" && req.method !== "HEAD") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use GET." } });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        analysis: service.getLatestOpenAiAnalysis(),
        placesOrders: false,
      });
      return true;
    }

    if (isAtPath(url.pathname, "/api/forex/automated-trading/openai/history")) {
      if (req.method !== "GET" && req.method !== "HEAD") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use GET." } });
        return true;
      }
      const limit = Number(url.searchParams.get("limit") ?? 12);
      sendJson(res, 200, {
        ok: true,
        history: service.listOpenAiAnalyses(Number.isFinite(limit) ? limit : 12),
        placesOrders: false,
      });
      return true;
    }

    {
      const match = url.pathname.match(/^\/api\/forex\/automated-trading\/openai\/([A-Za-z0-9_-]+)$/);
      if (match && match[1] && !["status", "analyze", "latest", "history"].includes(match[1])) {
        if (req.method !== "GET" && req.method !== "HEAD") {
          sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use GET." } });
          return true;
        }
        const analysis = service.getOpenAiAnalysis(match[1]);
        if (!analysis) {
          sendJson(res, 404, {
            ok: false,
            error: { code: "NOT_FOUND", message: "Analysis not found." },
            placesOrders: false,
          });
          return true;
        }
        sendJson(res, 200, { ok: true, analysis, placesOrders: false });
        return true;
      }
    }

    // Phase 54 — read-only trading decision validation (never places orders).
    if (isAtPath(url.pathname, "/api/forex/automated-trading/decision/status")) {
      if (req.method !== "GET" && req.method !== "HEAD") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use GET." } });
        return true;
      }
      const decision = await service.getDecisionStatus();
      sendJson(res, 200, { ok: true, decision, placesOrders: false, acceptsForExecution: false });
      return true;
    }

    if (isAtPath(url.pathname, "/api/forex/automated-trading/decision/evaluate")) {
      if (req.method !== "POST") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." } });
        return true;
      }
      const body = (await readJsonBody(req, 4_000)) as Record<string, unknown>;
      const result = await service.evaluateTradingDecision({
        analysisId: body.analysisId,
        expectedEnvironmentEpoch: body.expectedEnvironmentEpoch,
      });
      if (!result.ok) {
        sendJson(res, result.code === "STALE_EPOCH" ? 409 : 422, {
          ok: false,
          error: { code: result.code, message: result.message },
          decision: result.decision,
          status: result.status,
          placesOrders: false,
          acceptsForExecution: false,
        });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        decision: result.decision,
        status: result.status,
        placesOrders: false,
        acceptsForExecution: false,
      });
      return true;
    }

    if (isAtPath(url.pathname, "/api/forex/automated-trading/decision/history")) {
      if (req.method !== "GET" && req.method !== "HEAD") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use GET." } });
        return true;
      }
      const limit = Number(url.searchParams.get("limit") ?? 12);
      sendJson(res, 200, {
        ok: true,
        history: service.listDecisions(Number.isFinite(limit) ? limit : 12),
        placesOrders: false,
        acceptsForExecution: false,
      });
      return true;
    }

    if (isAtPath(url.pathname, "/api/forex/automated-trading/decision/policy")) {
      if (req.method === "GET" || req.method === "HEAD") {
        sendJson(res, 200, {
          ok: true,
          policy: service.getDecisionPolicy(),
          placesOrders: false,
          acceptsForExecution: false,
        });
        return true;
      }
      if (req.method !== "POST") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use GET or POST." } });
        return true;
      }
      const body = (await readJsonBody(req, 4_000)) as Record<string, unknown>;
      const result = await service.updateDecisionPolicy(body);
      if (!result.ok) {
        sendJson(res, 422, {
          ok: false,
          error: { code: result.code, message: result.message },
          status: result.status,
          placesOrders: false,
          acceptsForExecution: false,
        });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        policy: result.policy,
        status: result.status,
        placesOrders: false,
        acceptsForExecution: false,
      });
      return true;
    }

    // Phase 56.2 — simulation-only draft validation (never places orders).
    if (isAtPath(url.pathname, "/api/forex/automated-trading/simulation-risk/status")) {
      if (req.method !== "GET" && req.method !== "HEAD") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use GET." } });
        return true;
      }
      const simulationRisk = await service.getSimRiskStatus();
      sendJson(res, 200, {
        ok: true,
        simulationRisk,
        placesOrders: false,
        acceptsForExecution: false,
        simulationOnly: true,
      });
      return true;
    }

    if (isAtPath(url.pathname, "/api/forex/automated-trading/simulation-risk/validate")) {
      if (req.method !== "POST") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." } });
        return true;
      }
      const body = (await readJsonBody(req, 8_000)) as Record<string, unknown>;
      const result = await service.validateSimulationDraft({
        expectedEnvironmentEpoch: body.expectedEnvironmentEpoch,
        instrument: body.instrument,
        direction: body.direction,
        entryPrice: body.entryPrice,
        stopLoss: body.stopLoss,
        takeProfit: body.takeProfit,
        requestedQuantity: body.requestedQuantity,
        requestedPerOrderAllocation: body.requestedPerOrderAllocation,
        decisionId: body.decisionId,
        persist: body.persist,
      });
      if (!result.ok) {
        sendJson(res, result.code === "STALE_EPOCH" ? 409 : 422, {
          ok: false,
          error: { code: result.code, message: result.message },
          draft: result.draft,
          status: result.status,
          placesOrders: false,
          acceptsForExecution: false,
          simulationOnly: true,
        });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        draft: result.draft,
        status: result.status,
        placesOrders: false,
        acceptsForExecution: false,
        simulationOnly: true,
      });
      return true;
    }

    if (isAtPath(url.pathname, "/api/forex/automated-trading/simulation-risk/history")) {
      if (req.method !== "GET" && req.method !== "HEAD") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use GET." } });
        return true;
      }
      const limit = Number(url.searchParams.get("limit") ?? 12);
      sendJson(res, 200, {
        ok: true,
        history: service.listSimDrafts(Number.isFinite(limit) ? limit : 12),
        placesOrders: false,
        acceptsForExecution: false,
        simulationOnly: true,
      });
      return true;
    }

    // Phase 56.4.2 — reopen draft with forced quote/budget revalidation (simulation only).
    if (isAtPath(url.pathname, "/api/forex/automated-trading/simulation-risk/reopen")) {
      if (req.method !== "POST") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." } });
        return true;
      }
      const body = (await readJsonBody(req, 4_000)) as Record<string, unknown>;
      const result = await service.reopenAndRevalidateLatestDraft({
        draftId: body.draftId,
        expectedEnvironmentEpoch: body.expectedEnvironmentEpoch,
        requestedPerOrderAllocation: body.requestedPerOrderAllocation,
      });
      if (!result.ok) {
        sendJson(res, 422, {
          ok: false,
          error: { code: result.code, message: result.message },
          draft: result.draft,
          status: result.status,
          placesOrders: false,
          acceptsForExecution: false,
          simulationOnly: true,
        });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        draft: result.draft,
        status: result.status,
        placesOrders: false,
        acceptsForExecution: false,
        simulationOnly: true,
      });
      return true;
    }

    if (isAtPath(url.pathname, "/api/forex/automated-trading/simulation-lifecycle/status")) {
      if (req.method !== "GET" && req.method !== "HEAD") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use GET." } });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        lifecycle: service.getSimLifecycleStatus(),
        placesOrders: false,
        acceptsForExecution: false,
        simulationOnly: true,
      });
      return true;
    }

    // Phase 57.0 — broker-intent architecture (never submit). Path avoids order/submit/execute.
    if (isAtPath(url.pathname, "/api/forex/automated-trading/broker-intent/status")) {
      if (req.method !== "GET" && req.method !== "HEAD") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use GET." } });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        brokerIntent: service.getBrokerIntentStatus(),
        placesOrders: false,
        acceptsForExecution: false,
        mutatesBroker: false,
        executionDisabled: true,
      });
      return true;
    }

    if (isAtPath(url.pathname, "/api/forex/automated-trading/broker-intent/validate")) {
      if (req.method !== "POST") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." } });
        return true;
      }
      const body = (await readJsonBody(req, 8_000)) as Record<string, unknown>;
      const result = await service.validateBrokerIntent({
        idempotencyKey: String(body.idempotencyKey ?? "").trim(),
        environment: body.environment === "LIVE" ? "LIVE" : "DEMO",
        environmentVerified: body.environmentVerified === true,
        accountIdMasked: body.accountIdMasked != null ? String(body.accountIdMasked).slice(0, 32) : null,
        accountStateVerified: body.accountStateVerified === true,
        instrument: String(body.instrument ?? "XAU/USD"),
        direction: body.direction === "SELL" ? "SELL" : body.direction === "BUY" ? "BUY" : null,
        quantity: typeof body.quantity === "number" ? body.quantity : null,
        quantityUnit: body.quantityUnit != null ? String(body.quantityUnit) : null,
        quantityUnitAmbiguous: body.quantityUnitAmbiguous === true,
        contractSizeVerified: body.contractSizeVerified === true,
        pointSize: typeof body.pointSize === "number" ? body.pointSize : null,
        entryPrice: typeof body.entryPrice === "number" ? body.entryPrice : null,
        stopLoss: typeof body.stopLoss === "number" ? body.stopLoss : null,
        takeProfit: typeof body.takeProfit === "number" ? body.takeProfit : null,
        quoteFresh: body.quoteFresh === true,
        quotePresent: body.quotePresent !== false,
        strategyAllocationPercent:
          typeof body.strategyAllocationPercent === "number" ? body.strategyAllocationPercent : null,
        perOrderAllocation: typeof body.perOrderAllocation === "number" ? body.perOrderAllocation : null,
        estimatedSlLossAccount:
          typeof body.estimatedSlLossAccount === "number" ? body.estimatedSlLossAccount : null,
        sourceDraftId: body.sourceDraftId != null ? String(body.sourceDraftId) : null,
        sourceDecisionId: body.sourceDecisionId != null ? String(body.sourceDecisionId) : null,
        masterEnable: body.masterEnable === true,
        emergencyEntryLock: body.emergencyEntryLock !== false,
        placesOrders: body.placesOrders === true,
        acceptsForExecution: body.acceptsForExecution === true,
        forexConnectTradingEnabled: body.forexConnectTradingEnabled === true,
        automaticEntryEnabled: body.automaticEntryEnabled === true,
        automaticReentryEnabled: body.automaticReentryEnabled === true,
        duplicateIdempotencyKey: false,
        exposureReconciliationRequired: body.exposureReconciliationRequired === true,
        protectionCapabilityVerified: body.protectionCapabilityVerified === true,
        ownerExecutionAuthorized: false,
        requireProtective: body.requireProtective !== false,
        requireThreeR: body.requireThreeR !== false,
      });
      sendJson(res, 200, {
        ok: true,
        preflightPassed: result.preflightPassed,
        maySubmitToBroker: false,
        intent: result.intent,
        duplicated: result.duplicated,
        mutationProbe: result.mutationProbe,
        placesOrders: false,
        acceptsForExecution: false,
        mutatesBroker: false,
        executionDisabled: true,
        status: result.status,
      });
      return true;
    }

    if (isAtPath(url.pathname, "/api/forex/automated-trading/broker-intent/reconcile")) {
      if (req.method !== "POST") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." } });
        return true;
      }
      const body = (await readJsonBody(req, 4_000)) as Record<string, unknown>;
      const intentId = body.intentId != null ? String(body.intentId).trim() : null;
      const result = await service.reconcileBrokerIntent(intentId || null);
      sendJson(res, 200, {
        ok: true,
        reconcile: result.reconcile,
        placesOrders: false,
        mutatesBroker: false,
        executionDisabled: true,
        status: result.status,
      });
      return true;
    }

    if (isAtPath(url.pathname, "/api/forex/automated-trading/simulation-lifecycle/open")) {
      if (req.method !== "POST") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." } });
        return true;
      }
      await readJsonBody(req, 2_000);
      const result = await service.openSimulatedFromLatestDraft();
      if (!result.ok) {
        sendJson(res, 422, {
          ok: false,
          error: { code: result.code, message: result.message },
          status: result.status,
          placesOrders: false,
          acceptsForExecution: false,
          simulationOnly: true,
        });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        position: result.position,
        status: result.status,
        placesOrders: false,
        acceptsForExecution: false,
        simulationOnly: true,
      });
      return true;
    }

    if (isAtPath(url.pathname, "/api/forex/automated-trading/simulation-lifecycle/monitor")) {
      if (req.method !== "POST") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." } });
        return true;
      }
      const body = (await readJsonBody(req, 4_000)) as Record<string, unknown>;
      const positionId = String(body.positionId ?? "").trim();
      const result = await service.monitorSimulatedPosition(positionId);
      if (!result.ok) {
        sendJson(res, 422, {
          ok: false,
          error: { code: result.code, message: result.message },
          status: result.status,
          placesOrders: false,
          acceptsForExecution: false,
          simulationOnly: true,
        });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        position: result.position,
        status: result.status,
        placesOrders: false,
        acceptsForExecution: false,
        simulationOnly: true,
      });
      return true;
    }

    // Phase 56.4.7 — idempotent simulation-only process-restart recovery (never broker).
    if (isAtPath(url.pathname, "/api/forex/automated-trading/simulation-lifecycle/recover")) {
      if (req.method !== "POST") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." } });
        return true;
      }
      await readJsonBody(req, 2_000);
      const result = await service.recoverSimLifecycleFromPersistence();
      sendJson(res, 200, {
        ok: true,
        recovered: result.recovered,
        changedCount: result.changedCount,
        results: result.results,
        lifecycle: result.lifecycle,
        placesOrders: false,
        acceptsForExecution: false,
        autoReentryEnabled: false,
        simulationOnly: true,
      });
      return true;
    }

    // Phase 56.4.6 — controlled simulation-only monitor inject (SL acceptance / stale). Never broker.
    if (isAtPath(url.pathname, "/api/forex/automated-trading/simulation-lifecycle/controlled-inject")) {
      if (req.method !== "POST") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." } });
        return true;
      }
      const body = (await readJsonBody(req, 4_000)) as Record<string, unknown>;
      const positionId = String(body.positionId ?? "").trim();
      const modeRaw = String(body.mode ?? "").trim();
      const mode =
        modeRaw === "sl_cross" || modeRaw === "sl_approach" || modeRaw === "stale"
          ? modeRaw
          : null;
      if (!mode) {
        sendJson(res, 422, {
          ok: false,
          error: {
            code: "SIM_INJECT_MODE_INVALID",
            message: "mode must be sl_cross | sl_approach | stale.",
          },
          placesOrders: false,
          acceptsForExecution: false,
          simulationOnly: true,
        });
        return true;
      }
      const result = await service.injectControlledSimMonitorTick({ positionId, mode });
      if (!result.ok) {
        sendJson(res, 422, {
          ok: false,
          error: { code: result.code, message: result.message },
          status: result.status,
          placesOrders: false,
          acceptsForExecution: false,
          simulationOnly: true,
        });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        position: result.position,
        controlled: true,
        status: result.status,
        placesOrders: false,
        acceptsForExecution: false,
        simulationOnly: true,
      });
      return true;
    }

    // Phase 58.5 — DEMO lifecycle (grant-scoped). Allowlisted ahead of order|submit regex.
    // Does NOT set placesOrders/acceptsForExecution globally. LIVE remains unauthorized.
    if (url.pathname.startsWith("/api/forex/automated-trading/demo-lifecycle")) {
      const {
        getDemoLifecycleOrchestrator,
      } = await import("../../ai/forex-ai/automated-trading/demo-execution/index.js");
      const orch = getDemoLifecycleOrchestrator();

      if (isAtPath(url.pathname, "/api/forex/automated-trading/demo-lifecycle/status")) {
        if (req.method !== "GET") {
          sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use GET." } });
          return true;
        }
        sendJson(res, 200, {
          ...orch.getStatus(),
          placesOrders: false,
          acceptsForExecution: false,
        });
        return true;
      }

      if (isAtPath(url.pathname, "/api/forex/automated-trading/demo-lifecycle/readiness")) {
        if (req.method !== "GET") {
          sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use GET." } });
          return true;
        }
        // Phase 59.0.12E — optional instrument/lots scope grant coverage without mutating.
        const instrumentQ = url.searchParams.get("instrument");
        const lotsQ = url.searchParams.get("lots");
        const lotsParsed = lotsQ == null || lotsQ === "" ? null : Number(lotsQ);
        const readiness = await orch.readiness({
          instrument: instrumentQ,
          lots: lotsParsed != null && Number.isFinite(lotsParsed) ? lotsParsed : null,
        });
        sendJson(res, 200, {
          ...readiness,
          placesOrders: false,
          acceptsForExecution: false,
        });
        return true;
      }

      if (isAtPath(url.pathname, "/api/forex/automated-trading/demo-lifecycle/quote-probe")) {
        if (req.method !== "POST") {
          sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." } });
          return true;
        }
        const body = (await readJsonBody(req, 4_000)) as Record<string, unknown>;
        const instrument = String(body.instrument ?? "").trim();
        if (!instrument) {
          sendJson(res, 400, {
            ok: false,
            error: { code: "INSTRUMENT_REQUIRED", message: "instrument is required." },
            placesOrders: false,
          });
          return true;
        }
        const probe = await orch.probeQuote(instrument);
        sendJson(res, probe.ok ? 200 : 422, {
          ...probe,
          placesOrders: false,
          acceptsForExecution: false,
          liveUnauthorized: true,
        });
        return true;
      }

      if (isAtPath(url.pathname, "/api/forex/automated-trading/demo-lifecycle/grant")) {
        if (req.method !== "POST") {
          sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." } });
          return true;
        }
        const body = (await readJsonBody(req, 4_000)) as Record<string, unknown>;
        const grant = orch.createGrant({
          ttlMs: typeof body.ttlMs === "number" ? body.ttlMs : undefined,
          accountIdMasked: body.accountIdMasked == null ? null : String(body.accountIdMasked),
          instrumentAllowlist: Array.isArray(body.instrumentAllowlist)
            ? body.instrumentAllowlist.map(String)
            : undefined,
          maxLots: typeof body.maxLots === "number" ? body.maxLots : 1,
        });
        sendJson(res, 200, {
          ok: true,
          grant,
          placesOrders: false,
          acceptsForExecution: false,
          note: "Time-bounded DEMO grant created. Does not enable global trading or LIVE. Does not enable mutation flag.",
        });
        return true;
      }

      if (isAtPath(url.pathname, "/api/forex/automated-trading/demo-lifecycle/grant/revoke")) {
        if (req.method !== "POST") {
          sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." } });
          return true;
        }
        const body = (await readJsonBody(req, 2_000)) as Record<string, unknown>;
        const grantId = String(body.grantId ?? "").trim();
        const grant = orch.revokeGrant(grantId);
        if (!grant) {
          sendJson(res, 404, {
            ok: false,
            error: { code: "GRANT_NOT_FOUND", message: "Grant not found." },
            placesOrders: false,
          });
          return true;
        }
        sendJson(res, 200, { ok: true, grant, placesOrders: false, acceptsForExecution: false });
        return true;
      }

      // Phase 59.0 — prepare analysis→risk→DEMO request plan (non-mutating).
      if (isAtPath(url.pathname, "/api/forex/automated-trading/demo-lifecycle/prepare-from-draft")) {
        if (req.method !== "POST") {
          sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." } });
          return true;
        }
        const body = (await readJsonBody(req, 8_000)) as Record<string, unknown>;
        const plan = service.prepareDemoExecutionPlan({
          decisionId: body.decisionId,
          draftId: body.draftId,
          grantId: body.grantId,
          lotsOverride: body.lotsOverride,
          maxDecisionAgeMs: body.maxDecisionAgeMs,
        });
        sendJson(res, plan.status === "READY_FOR_DEMO_GRANT_SUBMISSION" ? 200 : 422, {
          ok: plan.status === "READY_FOR_DEMO_GRANT_SUBMISSION",
          plan,
          placesOrders: false,
          acceptsForExecution: false,
          mutatesBroker: false,
          liveUnauthorized: true,
          note: "Prepare-from-draft never submits to ForexConnect. Call open-market separately only when authorized.",
        });
        return true;
      }

      if (isAtPath(url.pathname, "/api/forex/automated-trading/demo-lifecycle/open-market")) {
        if (req.method !== "POST") {
          sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." } });
          return true;
        }
        const body = (await readJsonBody(req, 8_000)) as Record<string, unknown>;
        const directionRaw = String(body.direction ?? body.buySell ?? "").toUpperCase();
        const direction = directionRaw === "SELL" ? "SELL" as const : directionRaw === "BUY" ? "BUY" as const : null;
        if (!direction) {
          sendJson(res, 400, {
            ok: false,
            error: { code: "INVALID_DIRECTION", message: "direction must be BUY or SELL." },
            placesOrders: false,
          });
          return true;
        }
        const stopLoss = body.stopLoss == null || body.stopLoss === ""
          ? null
          : Number(body.stopLoss);
        const takeProfit = body.takeProfit == null || body.takeProfit === ""
          ? null
          : Number(body.takeProfit);
        const entryHint = body.entryHint == null || body.entryHint === ""
          ? null
          : Number(body.entryHint);
        const result = await orch.openMarket({
          grantId: String(body.grantId ?? "").trim(),
          instrument: String(body.instrument ?? "").trim(),
          direction,
          lots: Math.max(1, Math.floor(Number(body.lots ?? 1))),
          accountId: body.accountId == null ? null : String(body.accountId),
          requireProtective: body.requireProtective === true,
          stopLoss: Number.isFinite(stopLoss as number) ? (stopLoss as number) : null,
          takeProfit: Number.isFinite(takeProfit as number) ? (takeProfit as number) : null,
          entryHint: Number.isFinite(entryHint as number) ? (entryHint as number) : null,
          attachProtectiveAfterFill: body.attachProtectiveAfterFill !== false,
          closeIfUnprotected: body.closeIfUnprotected !== false,
          idempotencyKey: String(body.idempotencyKey ?? "").trim() || `demo_open_${Date.now()}`,
          sourceDecisionId: body.sourceDecisionId == null ? null : String(body.sourceDecisionId),
          sourceAnalysisId: body.sourceAnalysisId == null ? null : String(body.sourceAnalysisId),
          sourceDraftId: body.sourceDraftId == null ? null : String(body.sourceDraftId),
          sourcePlanId: body.sourcePlanId == null ? null : String(body.sourcePlanId),
        });
        sendJson(res, result.ok ? 200 : 422, {
          ...result,
          placesOrders: false,
          acceptsForExecution: false,
          liveUnauthorized: true,
        });
        return true;
      }

      if (isAtPath(url.pathname, "/api/forex/automated-trading/demo-lifecycle/close-trade")) {
        if (req.method !== "POST") {
          sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." } });
          return true;
        }
        const body = (await readJsonBody(req, 8_000)) as Record<string, unknown>;
        const amountRaw = body.amount;
        const amount = amountRaw == null || amountRaw === ""
          ? null
          : Math.floor(Number(amountRaw));
        const result = await orch.closeTrade({
          grantId: String(body.grantId ?? "").trim(),
          tradeId: String(body.tradeId ?? "").trim(),
          instrument: body.instrument == null ? null : String(body.instrument),
          accountId: body.accountId == null ? null : String(body.accountId),
          amount: Number.isFinite(amount as number) && (amount as number) > 0 ? (amount as number) : null,
          idempotencyKey: String(body.idempotencyKey ?? "").trim() || `demo_close_${Date.now()}`,
        });
        sendJson(res, result.ok ? 200 : 422, {
          ...result,
          placesOrders: false,
          acceptsForExecution: false,
          liveUnauthorized: true,
        });
        return true;
      }

      if (isAtPath(url.pathname, "/api/forex/automated-trading/demo-lifecycle/cancel-pending")) {
        if (req.method !== "POST") {
          sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." } });
          return true;
        }
        const body = (await readJsonBody(req, 8_000)) as Record<string, unknown>;
        const result = await orch.cancelPending({
          grantId: String(body.grantId ?? "").trim(),
          brokerOrderId: String(body.brokerOrderId ?? body.orderId ?? "").trim(),
          accountId: body.accountId == null ? null : String(body.accountId),
          idempotencyKey: String(body.idempotencyKey ?? "").trim() || `demo_cancel_${Date.now()}`,
        });
        sendJson(res, result.ok ? 200 : 422, {
          ...result,
          placesOrders: false,
          acceptsForExecution: false,
          liveUnauthorized: true,
        });
        return true;
      }

      if (isAtPath(url.pathname, "/api/forex/automated-trading/demo-lifecycle/attach-protective")) {
        if (req.method !== "POST") {
          sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." } });
          return true;
        }
        const body = (await readJsonBody(req, 8_000)) as Record<string, unknown>;
        const grantId = String(body.grantId ?? "").trim();
        const tradeId = String(body.tradeId ?? "").trim();
        const { getDemoExecutionGrantStore } = await import(
          "../../ai/forex-ai/automated-trading/demo-execution/grant-store.js"
        );
        const { getForexConnectDemoMutationAdapter } = await import(
          "../../ai/forex-ai/automated-trading/demo-execution/forexconnect-mutation-adapter.js"
        );
        const grantCheck = getDemoExecutionGrantStore().requireActive(grantId);
        if (!grantCheck.ok) {
          sendJson(res, 422, {
            ok: false,
            code: grantCheck.code,
            error: grantCheck.error,
            placesOrders: false,
            acceptsForExecution: false,
          });
          return true;
        }
        const readiness = await orch.readiness();
        if (!readiness.mayAttemptDemoMutation) {
          sendJson(res, 422, {
            ok: false,
            code: "READINESS_BLOCKED",
            error: `DEMO mutation readiness failed: ${(readiness.blockers as string[]).join(",")}`,
            placesOrders: false,
          });
          return true;
        }
        const stopLoss = body.stopLoss == null || body.stopLoss === "" ? null : Number(body.stopLoss);
        const takeProfit = body.takeProfit == null || body.takeProfit === "" ? null : Number(body.takeProfit);
        const result = await getForexConnectDemoMutationAdapter().attachProtective({
          tradeId,
          stopLoss: Number.isFinite(stopLoss as number) ? (stopLoss as number) : null,
          takeProfit: Number.isFinite(takeProfit as number) ? (takeProfit as number) : null,
          accountId: body.accountId == null ? null : String(body.accountId),
        });
        sendJson(res, result.ok ? 200 : 422, {
          ...result,
          placesOrders: false,
          acceptsForExecution: false,
          liveUnauthorized: true,
        });
        return true;
      }

      if (isAtPath(url.pathname, "/api/forex/automated-trading/demo-lifecycle/reconcile-protection")) {
        if (req.method !== "POST") {
          sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." } });
          return true;
        }
        const body = (await readJsonBody(req, 4_000)) as Record<string, unknown>;
        const grantId = String(body.grantId ?? "").trim();
        const tradeId = String(body.tradeId ?? "").trim();
        const { getDemoExecutionGrantStore } = await import(
          "../../ai/forex-ai/automated-trading/demo-execution/grant-store.js"
        );
        const { getForexConnectDemoMutationAdapter } = await import(
          "../../ai/forex-ai/automated-trading/demo-execution/forexconnect-mutation-adapter.js"
        );
        const grantCheck = getDemoExecutionGrantStore().requireActive(grantId);
        if (!grantCheck.ok) {
          sendJson(res, 422, {
            ok: false,
            code: grantCheck.code,
            error: grantCheck.error,
            placesOrders: false,
          });
          return true;
        }
        const result = await getForexConnectDemoMutationAdapter().reconcileProtection(tradeId);
        sendJson(res, result.ok ? 200 : 422, {
          ...result,
          placesOrders: false,
          acceptsForExecution: false,
          liveUnauthorized: true,
        });
        return true;
      }

      sendJson(res, 404, {
        ok: false,
        error: { code: "NOT_FOUND", message: "Unknown demo-lifecycle endpoint." },
        placesOrders: false,
      });
      return true;
    }

    // Phase 56.4.3 — user-requested simulated close (never broker).
    if (isAtPath(url.pathname, "/api/forex/automated-trading/simulation-lifecycle/close")) {
      if (req.method !== "POST") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." } });
        return true;
      }
      const body = (await readJsonBody(req, 4_000)) as Record<string, unknown>;
      const positionId = String(body.positionId ?? "").trim();
      const result = await service.closeSimulatedPosition(positionId);
      if (!result.ok) {
        sendJson(res, 422, {
          ok: false,
          error: { code: result.code, message: result.message },
          status: result.status,
          placesOrders: false,
          acceptsForExecution: false,
          simulationOnly: true,
        });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        position: result.position,
        idempotent: result.idempotent,
        status: result.status,
        placesOrders: false,
        acceptsForExecution: false,
        simulationOnly: true,
      });
      return true;
    }

    sendJson(res, 404, {
      ok: false,
      error: { code: "NOT_FOUND", message: "Unknown Automated Trading endpoint." },
      placesOrders: false,
    });
    return true;
  } catch (err) {
    const code = (err as { code?: string })?.code === "PAYLOAD_TOO_LARGE"
      ? "PAYLOAD_TOO_LARGE"
      : "AUTOMATED_TRADING_ERROR";
    sendJson(res, code === "PAYLOAD_TOO_LARGE" ? 413 : 500, {
      ok: false,
      error: {
        code,
        message: err instanceof Error ? err.message.slice(0, 240) : "Automated Trading request failed.",
      },
      placesOrders: false,
    });
    return true;
  }
}
