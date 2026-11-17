/**
 * HFM MT5 Phase 1 realtime hub — polls Demo agent stream_snapshot and fans out SSE.
 * Read-only. Bounded subscribers. No credential leakage.
 */
import { randomUUID } from "node:crypto";
import type { ServerResponse } from "node:http";
import { callMt5HfmAgent } from "./agent-client.js";
import {
  buildEnvelope,
  MT5_HFM_SSE_SCHEMA_VERSION,
  type Mt5HfmEventEnvelope,
  type Mt5HfmSseEventType,
} from "./event-contract.js";
import {
  DEFAULT_MT5_HFM_FRESHNESS_POLICY,
  freshnessFromAgeSec,
  inferMarketClosed,
  isValidOhlcCandle,
  type Mt5HfmFreshness,
  type Mt5HfmFreshnessPolicy,
} from "./freshness.js";
import { getHfmQuoteService } from "./quote-service.js";
import { getHfmQuoteSubscriptionRegistry } from "./quote-subscriptions.js";
import { getHfmSubscriptionManager } from "./subscription-manager.js";
import { getHfmSymbolFreshnessEngine } from "./symbol-freshness.js";
import { getHfmRecoveryEngine } from "./recovery-engine.js";
import { getHfmSnapshotTracker } from "./snapshot-tracker.js";
import { getHfmSubscriptionScheduler } from "./subscription-scheduler.js";
import {
  buildHfmConnectionSnapshot,
  getHfmSseDistributionMetrics,
  quotePayloadForSse,
  recordHfmSseCoalesced,
  recordHfmSseDropped,
  recordHfmSsePublished,
  recordHfmSseRejected,
  recordQuotePublishLatency,
  resolveHfmSseReplay,
  shouldDistributeQuoteEvent,
  HFM_SSE_MAX_EVENT_BYTES,
  freshnessFromQuoteStatus,
  resetHfmSseDistributionForTests,
} from "./sse-distribution.js";
import { getMt5HfmDemoProfileManager } from "./demo-profile.js";
import { getHfmLiveCandleEngine } from "./live-candle-engine.js";

export interface Mt5HfmHubSubscriber {
  id: string;
  res: ServerResponse;
  symbols: Set<string> | null; // null = all
  includeCandles: boolean;
  lastEventAt: number;
  /** Latest pending quote envelope per symbol (coalesce under backpressure). */
  pendingQuotes: Map<string, Mt5HfmEventEnvelope>;
  coalescedCount: number;
  droppedCount: number;
}

interface QuoteFingerprint {
  bid: number;
  ask: number;
  tickTime: number | null;
  status?: string;
}

interface HubState {
  lastSeq: number | null;
  lastAccountJson: string;
  lastQuotes: Map<string, QuoteFingerprint>;
  lastFreshness: Mt5HfmFreshness;
  lastSnapshot: Record<string, unknown> | null;
  lastPollOkAt: number | null;
  lastPollError: string | null;
  consecutiveFailures: number;
  candleCycleAt: number;
}

const MAX_SUBSCRIBERS = 8;
const MAX_WRITE_QUEUE_HINT = 32;

let started = false;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let candlePollCounter = 0;

const subscribers = new Map<string, Mt5HfmHubSubscriber>();
const hubState: HubState = {
  lastSeq: null,
  lastAccountJson: "",
  lastQuotes: new Map(),
  lastFreshness: "WAITING_FOR_DATA",
  lastSnapshot: null,
  lastPollOkAt: null,
  lastPollError: null,
  consecutiveFailures: 0,
  candleCycleAt: 0,
};

const policy: Mt5HfmFreshnessPolicy = { ...DEFAULT_MT5_HFM_FRESHNESS_POLICY };

function nowIso(): string {
  return new Date().toISOString();
}

function writeSse(res: ServerResponse, event: string, payload: unknown, id?: string): boolean {
  try {
    if (res.writableEnded || res.destroyed) return false;
    // Soft backpressure: if Node write buffer is huge, signal caller to coalesce.
    const buffered = typeof (res as { writableLength?: number }).writableLength === "number"
      ? (res as { writableLength: number }).writableLength
      : 0;
    if (buffered > 256_000) return false;
    const body = typeof payload === "string" ? payload : JSON.stringify(payload);
    if (Buffer.byteLength(body) > HFM_SSE_MAX_EVENT_BYTES) return false;
    let chunk = "";
    if (id) chunk += `id: ${id}\n`;
    chunk += `event: ${event}\n`;
    for (const line of body.split("\n")) {
      chunk += `data: ${line}\n`;
    }
    chunk += "\n";
    res.write(chunk);
    return true;
  } catch {
    return false;
  }
}

function flushPendingQuotes(sub: Mt5HfmHubSubscriber): void {
  if (sub.pendingQuotes.size === 0) return;
  for (const [sym, envelope] of sub.pendingQuotes) {
    const ok = writeSse(sub.res, envelope.type, envelope, envelope.eventId);
    if (!ok) {
      sub.droppedCount += 1;
      recordHfmSseDropped();
      continue;
    }
    sub.lastEventAt = Date.now();
    void sym;
  }
  sub.pendingQuotes.clear();
}

function publish(type: Mt5HfmSseEventType, envelope: Mt5HfmEventEnvelope, filterSymbol?: string): void {
  const json = JSON.stringify(envelope);
  const bytes = Buffer.byteLength(json);
  if (bytes > HFM_SSE_MAX_EVENT_BYTES) {
    recordHfmSseRejected();
    return;
  }
  recordHfmSsePublished(envelope, bytes);

  for (const [id, sub] of subscribers) {
    if (filterSymbol && sub.symbols && !sub.symbols.has(filterSymbol.toUpperCase())) {
      continue;
    }
    if (type === "candles" && !sub.includeCandles) continue;

    // Quote coalescing under backpressure — keep newest accepted state per symbol.
    if (type === "quote" && filterSymbol) {
      const buffered = typeof (sub.res as { writableLength?: number }).writableLength === "number"
        ? (sub.res as { writableLength: number }).writableLength
        : 0;
      if (buffered > 64_000 || sub.pendingQuotes.size > 0) {
        if (sub.pendingQuotes.has(filterSymbol)) {
          sub.coalescedCount += 1;
          recordHfmSseCoalesced();
        }
        sub.pendingQuotes.set(filterSymbol, envelope);
        flushPendingQuotes(sub);
        continue;
      }
    }

    const ok = writeSse(sub.res, type, envelope, envelope.eventId);
    if (!ok) {
      if (type === "quote" && filterSymbol) {
        if (sub.pendingQuotes.has(filterSymbol)) {
          sub.coalescedCount += 1;
          recordHfmSseCoalesced();
        }
        sub.pendingQuotes.set(filterSymbol, envelope);
        continue;
      }
      subscribers.delete(id);
      try {
        sub.res.end();
      } catch {
        /* ignore */
      }
      continue;
    }
    sub.lastEventAt = Date.now();
    if (type !== "quote") flushPendingQuotes(sub);
  }
}

function rawQuotesForIngest(raw: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(raw)) return [];
  const out: Array<Record<string, unknown>> = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    out.push(item as Record<string, unknown>);
  }
  return out;
}

function accountFingerprint(account: Record<string, unknown> | null | undefined): string {
  if (!account) return "";
  const keys = [
    "loginExact",
    "server",
    "currency",
    "balance",
    "equity",
    "freeMargin",
    "usedMargin",
    "marginLevel",
    "leverage",
    "openPositionsCount",
    "pendingOrdersCount",
  ];
  const slim: Record<string, unknown> = {};
  for (const k of keys) slim[k] = account[k] ?? null;
  return JSON.stringify(slim);
}

/** Persist non-secret account fields for REST /account — never invent balances. */
async function persistStreamAccount(account: Record<string, unknown> | null): Promise<void> {
  if (!account) return;
  const balance = typeof account.balance === "number" ? account.balance : null;
  const equity = typeof account.equity === "number" ? account.equity : null;
  // Skip identity-only frames that would only re-assert login without money fields;
  // recordDemoAccountSnapshot already merges nulls, but avoid noisy disk writes.
  if (balance == null && equity == null && account.currency == null) return;
  try {
    const manager = await getMt5HfmDemoProfileManager();
    const loginExact = account.loginExact != null ? String(account.loginExact) : null;
    const loginHint =
      account.loginHint != null
        ? String(account.loginHint)
        : loginExact
          ? `••••${loginExact.slice(-4)}`
          : null;
    await manager.recordDemoAccountSnapshot({
      loginHint,
      server: account.server != null ? String(account.server) : null,
      currency: account.currency != null ? String(account.currency) : null,
      balance,
      equity,
      freeMargin: typeof account.freeMargin === "number" ? account.freeMargin : null,
      marginLevel: typeof account.marginLevel === "number" ? account.marginLevel : null,
      leverage: account.leverage != null ? String(account.leverage) : null,
      company: account.company != null ? String(account.company) : null,
      syncedAt: new Date().toISOString(),
      note:
        account.note != null
          ? String(account.note)
          : "Account fields from HFM realtime stream (MQL snapshot).",
    });
  } catch {
    // REST account persistence must not break the quote poll loop.
  }
}

async function pollOnce(): Promise<void> {
  candlePollCounter += 1;
  const includeCandles = candlePollCounter % 10 === 1;
  const scheduler = getHfmSubscriptionScheduler();
  if (!scheduler.beginCycle()) return;
  const cycleStarted = Date.now();
  try {
    const resp = await callMt5HfmAgent("demo.stream_snapshot", { includeCandles }, { timeoutMs: 12_000 });
    if (!resp.ok || !resp.result || typeof resp.result !== "object") {
      hubState.consecutiveFailures += 1;
      hubState.lastPollError = resp.code || "STREAM_SNAPSHOT_FAILED";
      const freshness: Mt5HfmFreshness =
        hubState.consecutiveFailures >= 3 ? "DISCONNECTED" : "WAITING_FOR_DATA";
      hubState.lastFreshness = freshness;
      getHfmSymbolFreshnessEngine().setConnectivity({
        terminalRunning: freshness !== "DISCONNECTED",
        transportOk: false,
        marketClosed: false,
      });
      const recovery = getHfmRecoveryEngine();
      recovery.markDegraded(hubState.lastPollError);
      const attempt = recovery.begin(hubState.lastPollError, "transport_check");
      if (attempt.shouldAttempt) {
        recovery.completeAttempt({
          ok: false,
          errorCode: hubState.lastPollError,
          stage: "agent_poll",
          validQuoteObserved: false,
          transportOk: false,
          terminalRunning: false,
        });
      }
      publish(
        "state",
        buildEnvelope(
          "state",
          {
            ok: false,
            code: hubState.lastPollError,
            consecutiveFailures: hubState.consecutiveFailures,
          },
          {
            eventId: randomUUID(),
            serverReceivedAt: nowIso(),
            freshness,
            provenance: "agent",
            validation: "rejected",
          },
        ),
      );
      return;
    }

    const snap = resp.result as Record<string, unknown>;
    hubState.lastSnapshot = snap;
    hubState.lastPollOkAt = Date.now();
    hubState.consecutiveFailures = 0;
    hubState.lastPollError = null;

    const ageSec = typeof snap.ageSec === "number" ? snap.ageSec : null;
    const terminalRunning = snap.terminalRunning !== false;
    const brokerTime = typeof snap.brokerTime === "number" ? snap.brokerTime : null;
    const gmtTime = typeof snap.gmtTime === "number" ? snap.gmtTime : null;
    const marketClosed =
      snap.marketClosed === true ||
      inferMarketClosed(brokerTime, gmtTime, { terminalRunning });
    let freshness: Mt5HfmFreshness =
      typeof snap.freshness === "string"
        ? (snap.freshness as Mt5HfmFreshness)
        : freshnessFromAgeSec(ageSec, policy, { terminalRunning, marketClosed });
    // Never label a fresh closed-session acquisition as LIVE.
    if (freshness === "LIVE" && marketClosed) {
      freshness = "MARKET_CLOSED";
    }
    hubState.lastFreshness = freshness;

    const seq = typeof snap.seq === "number" ? snap.seq : null;
    const serverReceivedAt =
      typeof snap.serverReceivedAt === "string" ? snap.serverReceivedAt : nowIso();
    const provenance =
      snap.source === "mql5_readonly_snapshot"
        ? "mql5_readonly_snapshot"
        : snap.source === "journal_fallback"
          ? "journal_fallback"
          : "agent";

    const isNewSeq = seq != null && seq !== hubState.lastSeq;
    if (seq != null) hubState.lastSeq = seq;

    // Full snapshot on first successful poll for each recovery, or when seq advances after gap.
    if (
      !hubState.lastAccountJson ||
      isNewSeq ||
      freshness === "LIVE" ||
      freshness === "MARKET_CLOSED" ||
      freshness === "STALE"
    ) {
      // Account incremental
      const account = (snap.account && typeof snap.account === "object"
        ? (snap.account as Record<string, unknown>)
        : null);
      const acctFp = accountFingerprint(account);
      if (acctFp && acctFp !== hubState.lastAccountJson) {
        hubState.lastAccountJson = acctFp;
        publish(
          "account",
          buildEnvelope(
            "account",
            {
              ...account,
              // Never invent balance from equity.
              balanceAuthoritative: true,
            },
            {
              eventId: randomUUID(),
              seq,
              brokerTimestamp: brokerTime,
              serverReceivedAt,
              freshness,
              provenance,
            },
          ),
        );
        void persistStreamAccount(account);
      }

      const accountServer =
        account && typeof account.server === "string" ? String(account.server) : null;
      const expectedSymbols = getHfmSubscriptionManager().listAcquisitionSymbols();
      const rawForIngest = rawQuotesForIngest(snap.quotes);
      const snapObs = getHfmSnapshotTracker().observe({
        snapshotId: typeof snap.schemaVersion === "string" ? String(snap.schemaVersion) : `seq-${seq ?? "na"}`,
        batchId: seq != null ? `batch-${seq}` : null,
        sequence: seq,
        expectedBatchCount: 1,
        symbolsInBatch: rawForIngest.map((q) => String(q.symbol ?? "")).filter(Boolean),
        expectedSymbols,
        receivedAt: serverReceivedAt,
      });
      if (snapObs.eventWorthy && snapObs.incomplete) {
        publish(
          "state",
          buildEnvelope(
            "state",
            {
              subtype: "snapshot.incomplete",
              reason: snapObs.reason,
              missingSymbols: snapObs.tracker.missingSymbols,
              sequence: seq,
              duplicate: snapObs.duplicate,
              outOfOrder: snapObs.outOfOrder,
              provider: "HFM_MT5",
              environment: "demo",
            },
            {
              eventId: randomUUID(),
              seq,
              serverReceivedAt,
              freshness,
              provenance,
              validation: "partial",
            },
          ),
        );
      }
      const ingest = await getHfmQuoteService().ingestRawQuotes(rawForIngest, {
        server: accountServer,
        sequence: seq,
        receivedAt: serverReceivedAt,
        ageSec,
        marketClosed,
        terminalRunning,
        feedFreshness: freshness,
        requireCatalogMatch: false,
      });
      getHfmSymbolFreshnessEngine().setConnectivity({
        terminalRunning,
        transportOk: true,
        marketClosed,
      });
      if (ingest.published.length > 0) {
        getHfmRecoveryEngine().completeAttempt({
          ok: true,
          stage: "quotes_validated",
          validQuoteObserved: true,
          transportOk: true,
          terminalRunning,
        });
      } else if (terminalRunning && freshness !== "DISCONNECTED") {
        getHfmRecoveryEngine().completeAttempt({
          ok: true,
          stage: "connected",
          validQuoteObserved: false,
          transportOk: true,
          terminalRunning,
        });
      }
      for (const q of ingest.published) {
        if (!getHfmQuoteSubscriptionRegistry().isSubscribed(q.symbol)) continue;
        if (q.bid == null || q.ask == null) continue;
        const payload = quotePayloadForSse(q);
        payload.subtype = "quote.updated";
        const gate = shouldDistributeQuoteEvent(payload);
        if (!gate.ok) {
          recordHfmSseRejected();
          continue;
        }
        const symbolKey = q.symbol.toUpperCase();
        const tickTime = q.quoteTimestamp;
        const prev = hubState.lastQuotes.get(symbolKey);
        const changed =
          !prev ||
          prev.bid !== q.bid ||
          prev.ask !== q.ask ||
          prev.tickTime !== tickTime ||
          isNewSeq ||
          prev.status !== q.status;
        if (!changed) continue;
        hubState.lastQuotes.set(symbolKey, {
          bid: q.bid,
          ask: q.ask,
          tickTime,
          status: q.status,
        });
        const quoteFreshness = freshnessFromQuoteStatus(q.status, freshness);
        recordQuotePublishLatency(q.receivedAt);
        publish(
          "quote",
          buildEnvelope("quote", payload, {
            eventId: randomUUID(),
            seq,
            correlationId: typeof seq === "number" ? `seq-${seq}` : null,
            brokerTimestamp: tickTime ?? brokerTime,
            occurredAt: q.receivedAt,
            serverReceivedAt,
            freshness: quoteFreshness,
            provenance,
            validation:
              q.validation.verdict === "ok"
                ? "ok"
                : q.validation.verdict === "partial" || q.validation.verdict === "warning"
                  ? "partial"
                  : "rejected",
          }),
          symbolKey,
        );

        // STEP 2: incremental forming candles from validated bid (CopyRates price basis).
        // Default M1 only in hub to bound SSE volume; Charts may poll other TFs via API.
        if (typeof tickTime === "number" && tickTime > 0) {
          const candleEvents = getHfmLiveCandleEngine().applyTick(
            {
              symbol: symbolKey,
              bid: q.bid,
              ask: q.ask,
              last: null,
              timeSec: tickTime,
              timeMsc: typeof q.quoteTimestampMs === "number" ? q.quoteTimestampMs : null,
              receiveMs: Date.parse(q.receivedAt) || Date.now(),
              volume: null,
              flags: null,
              acquisition: "SymbolInfoTick",
            },
            "M1",
          );
          for (const ev of candleEvents.slice(-2)) {
            const evType = ev.type === "candle_finalized" ? "candle_finalized" : "candle_update";
            publish(
              evType,
              buildEnvelope(evType, ev, {
                eventId: randomUUID(),
                seq,
                correlationId: typeof seq === "number" ? `seq-${seq}` : null,
                brokerTimestamp: tickTime,
                occurredAt: q.receivedAt,
                serverReceivedAt,
                freshness: quoteFreshness,
                provenance: "hub",
                validation: "ok",
              }),
              symbolKey,
            );
          }
        }
      }

      if (includeCandles && snap.candles && typeof snap.candles === "object") {
        const candlesRoot = snap.candles as Record<string, unknown>;
        const sanitized: Record<string, Record<string, unknown[]>> = {};
        for (const [sym, tfs] of Object.entries(candlesRoot)) {
          if (!tfs || typeof tfs !== "object") continue;
          const outTfs: Record<string, unknown[]> = {};
          for (const [tf, bars] of Object.entries(tfs as Record<string, unknown>)) {
            if (!Array.isArray(bars)) continue;
            outTfs[tf] = bars.filter((b) => b && typeof b === "object" && isValidOhlcCandle(b as never));
          }
          sanitized[sym.toUpperCase()] = outTfs;
        }
        hubState.candleCycleAt = Date.now();
        publish(
          "candles",
          buildEnvelope(
            "candles",
            { symbols: sanitized },
            {
              eventId: randomUUID(),
              seq,
              brokerTimestamp: brokerTime,
              serverReceivedAt,
              freshness,
              provenance,
            },
          ),
        );
      }
    }

    publish(
      "state",
      buildEnvelope(
        "state",
        {
          ok: true,
          freshness,
          ageSec,
          seq,
          terminalRunning,
          terminalConnected: snap.terminalConnected === true,
          authenticated: snap.authenticated === true,
          quoteCount: Array.isArray(snap.quotes) ? snap.quotes.length : 0,
          ordersEnabled: false,
          mutatesBroker: false,
        },
        {
          eventId: randomUUID(),
          seq,
          brokerTimestamp: brokerTime,
          serverReceivedAt,
          freshness,
          provenance,
        },
      ),
    );
  } catch (err) {
    hubState.consecutiveFailures += 1;
    hubState.lastPollError = err instanceof Error ? err.message : "POLL_ERROR";
    hubState.lastFreshness = hubState.consecutiveFailures >= 3 ? "DISCONNECTED" : "WAITING_FOR_DATA";
    getHfmRecoveryEngine().begin(hubState.lastPollError, "poll_exception");
  } finally {
    scheduler.endCycle(Date.now() - cycleStarted);
  }
}

function heartbeat(): void {
  const envelope = buildEnvelope(
    "heartbeat",
    {
      subscribers: subscribers.size,
      lastPollOkAt: hubState.lastPollOkAt,
      lastPollError: hubState.lastPollError,
      freshness: hubState.lastFreshness,
      lastSeq: hubState.lastSeq,
    },
    {
      eventId: randomUUID(),
      seq: hubState.lastSeq,
      serverReceivedAt: nowIso(),
      freshness: hubState.lastFreshness,
      provenance: "hub",
    },
  );
  publish("heartbeat", envelope);
}

let step2bWired = false;

function wireStep2bEventBridges(): void {
  if (step2bWired) return;
  step2bWired = true;
  getHfmSubscriptionManager().onEvent((ev) => {
    publish(
      "subscription",
      buildEnvelope(
        "subscription",
        {
          ...ev,
          subtype: ev.type,
          placesOrders: false,
          mutatesBroker: false,
          acceptsForExecution: false,
        },
        {
          eventId: randomUUID(),
          occurredAt: ev.timestamp,
          serverReceivedAt: ev.timestamp,
          freshness: hubState.lastFreshness,
          provenance: "hub",
        },
      ),
      ev.symbol,
    );
  });
  getHfmSymbolFreshnessEngine().onEvent((ev) => {
    publish(
      "freshness",
      buildEnvelope(
        "freshness",
        { ...ev, subtype: "freshness.changed" },
        {
          eventId: randomUUID(),
          occurredAt: ev.timestamp,
          serverReceivedAt: ev.timestamp,
          freshness: hubState.lastFreshness,
          provenance: "hub",
        },
      ),
      ev.symbol,
    );
  });
  getHfmRecoveryEngine().onEvent((ev) => {
    publish(
      "recovery",
      buildEnvelope(
        "recovery",
        { ...ev, subtype: ev.type },
        {
          eventId: randomUUID(),
          occurredAt: ev.timestamp,
          serverReceivedAt: ev.timestamp,
          freshness: hubState.lastFreshness,
          provenance: "hub",
        },
      ),
    );
  });
  getHfmSymbolFreshnessEngine().startMonitor(() => getHfmSubscriptionManager().listAcquisitionSymbols());
  void getHfmSubscriptionManager().restoreFromDisk();
}

export function ensureMt5HfmRealtimeHubStarted(): void {
  if (started) return;
  started = true;
  wireStep2bEventBridges();
  void pollOnce();
  pollTimer = setInterval(() => {
    void pollOnce();
  }, policy.pollIntervalMs);
  // Unref so hub does not keep process alive alone in tests.
  if (typeof pollTimer === "object" && "unref" in pollTimer) {
    (pollTimer as NodeJS.Timeout).unref();
  }
  heartbeatTimer = setInterval(heartbeat, policy.heartbeatSec * 1000);
  if (typeof heartbeatTimer === "object" && "unref" in heartbeatTimer) {
    (heartbeatTimer as NodeJS.Timeout).unref();
  }
}

export function getMt5HfmRealtimeHubStatus(): Record<string, unknown> {
  const quoteSnap = getHfmQuoteService().snapshot();
  const dist = getHfmSseDistributionMetrics();
  const avgLatency =
    dist.quoteToPublishLatencyMsCount > 0
      ? Math.round(dist.quoteToPublishLatencyMsSum / dist.quoteToPublishLatencyMsCount)
      : null;
  return {
    broker: "HFM_MT5",
    environment: "demo",
    schemaVersion: MT5_HFM_SSE_SCHEMA_VERSION,
    started,
    subscribers: subscribers.size,
    maxSubscribers: MAX_SUBSCRIBERS,
    freshness: hubState.lastFreshness,
    lastSeq: hubState.lastSeq,
    lastPollOkAt: hubState.lastPollOkAt,
    lastPollError: hubState.lastPollError,
    consecutiveFailures: hubState.consecutiveFailures,
    policy,
    streaming: true,
    quoteSubscriptions: getHfmQuoteSubscriptionRegistry().list(),
    quoteCounts: quoteSnap.counts,
    subscribedQuoteSymbols: quoteSnap.subscribedSymbols,
    subscriptionCapacity: getHfmSubscriptionManager().capacity(),
    symbolFreshnessCounts: getHfmSymbolFreshnessEngine().counts(),
    recovery: getHfmRecoveryEngine().metrics(),
    scheduler: getHfmSubscriptionScheduler().status(),
    snapshotTracker: getHfmSnapshotTracker().snapshot(),
    distribution: {
      ...dist,
      avgQuoteToPublishLatencyMs: avgLatency,
      clientCoalesce: [...subscribers.values()].reduce((n, s) => n + s.coalescedCount, 0),
      clientDropped: [...subscribers.values()].reduce((n, s) => n + s.droppedCount, 0),
    },
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
  };
}

function sendValidatedConnectionSnapshot(res: ServerResponse): void {
  const snap = hubState.lastSnapshot;
  const ageSec = snap && typeof snap.ageSec === "number" ? snap.ageSec : null;
  const feed =
    snap && typeof snap.freshness === "string"
      ? (snap.freshness as Mt5HfmFreshness)
      : hubState.lastFreshness;
  const built = buildHfmConnectionSnapshot({
    feedFreshness: feed,
    terminalRunning: snap && typeof snap.terminalRunning === "boolean" ? snap.terminalRunning : null,
    terminalConnected:
      snap && typeof snap.terminalConnected === "boolean" ? snap.terminalConnected : null,
    authenticated: snap && typeof snap.authenticated === "boolean" ? snap.authenticated : null,
    ageSec,
    seq: hubState.lastSeq,
    server:
      snap &&
      snap.account &&
      typeof snap.account === "object" &&
      typeof (snap.account as { server?: unknown }).server === "string"
        ? String((snap.account as { server: string }).server)
        : null,
    account:
      snap && snap.account && typeof snap.account === "object"
        ? (snap.account as Record<string, unknown>)
        : null,
  });
  writeSse(res, "snapshot", built.envelope, built.envelope.eventId);
  recordHfmSsePublished(built.envelope, built.byteLength);
}

export function subscribeMt5HfmSse(
  res: ServerResponse,
  opts?: { symbols?: string[]; includeCandles?: boolean; lastEventId?: string | null },
): { ok: true; subscriberId: string } | { ok: false; code: string; message: string } {
  ensureMt5HfmRealtimeHubStarted();
  if (subscribers.size >= MAX_SUBSCRIBERS) {
    return {
      ok: false,
      code: "TOO_MANY_SUBSCRIBERS",
      message: `Max ${MAX_SUBSCRIBERS} concurrent HFM SSE subscribers.`,
    };
  }

  const id = randomUUID();
  const symbols =
    opts?.symbols && opts.symbols.length > 0
      ? new Set(opts.symbols.map((s) => s.toUpperCase()))
      : null;

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  const sub: Mt5HfmHubSubscriber = {
    id,
    res,
    symbols,
    includeCandles: Boolean(opts?.includeCandles),
    lastEventAt: Date.now(),
    pendingQuotes: new Map(),
    coalescedCount: 0,
    droppedCount: 0,
  };
  subscribers.set(id, sub);

  const hello = buildEnvelope(
    "hello",
    {
      subscriberId: id,
      broker: "HFM_MT5",
      environment: "demo",
      schemaVersion: MT5_HFM_SSE_SCHEMA_VERSION,
      maxSubscribers: MAX_SUBSCRIBERS,
      policy,
      note: "HFM MT5 Demo read-only stream. Reconnect on drop. Use Last-Event-ID when retained.",
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
    },
    {
      eventId: randomUUID(),
      serverReceivedAt: nowIso(),
      freshness: hubState.lastFreshness,
      provenance: "hub",
    },
  );
  writeSse(res, "hello", hello, hello.eventId);
  recordHfmSsePublished(hello, Buffer.byteLength(JSON.stringify(hello)));

  // Last-Event-ID: replay retained events when possible; otherwise validated snapshot.
  const replay = resolveHfmSseReplay(opts?.lastEventId);
  if (replay.mode === "replay" && replay.envelopes.length > 0) {
    for (const env of replay.envelopes) {
      if (symbols && env.type === "quote") {
        const sym = (env.data as { symbol?: string } | null)?.symbol;
        if (sym && !symbols.has(String(sym).toUpperCase())) continue;
      }
      if (env.type === "candles" && !sub.includeCandles) continue;
      writeSse(res, env.type, env, env.eventId);
    }
  } else {
    sendValidatedConnectionSnapshot(res);
  }

  const onClose = () => {
    subscribers.delete(id);
  };
  res.on("close", onClose);
  res.on("error", onClose);

  void MAX_WRITE_QUEUE_HINT;

  return { ok: true, subscriberId: id };
}

/** Test helper — stop timers. */
export function stopMt5HfmRealtimeHubForTests(): void {
  if (pollTimer) clearInterval(pollTimer);
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  pollTimer = null;
  heartbeatTimer = null;
  started = false;
  for (const [, sub] of subscribers) {
    try {
      sub.res.end();
    } catch {
      /* ignore */
    }
  }
  subscribers.clear();
  hubState.lastSeq = null;
  hubState.lastAccountJson = "";
  hubState.lastQuotes.clear();
  hubState.lastFreshness = "WAITING_FOR_DATA";
  hubState.lastSnapshot = null;
  hubState.lastPollOkAt = null;
  hubState.lastPollError = null;
  hubState.consecutiveFailures = 0;
  resetHfmSseDistributionForTests();
}
