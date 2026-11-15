/**
 * HFM MT5 Phase 1 realtime hub — polls Demo agent stream_snapshot and fans out SSE.
 * Read-only. Bounded subscribers. No credential leakage.
 */
import { randomUUID } from "node:crypto";
import type { ServerResponse } from "node:http";
import { callMt5HfmAgent } from "./agent-client.js";
import {
  buildEnvelope,
  type Mt5HfmEventEnvelope,
  type Mt5HfmSseEventType,
} from "./event-contract.js";
import {
  DEFAULT_MT5_HFM_FRESHNESS_POLICY,
  freshnessFromAgeSec,
  isValidOhlcCandle,
  isValidQuoteTick,
  type Mt5HfmFreshness,
  type Mt5HfmFreshnessPolicy,
} from "./freshness.js";

export interface Mt5HfmHubSubscriber {
  id: string;
  res: ServerResponse;
  symbols: Set<string> | null; // null = all
  includeCandles: boolean;
  lastEventAt: number;
}

interface QuoteFingerprint {
  bid: number;
  ask: number;
  tickTime: number | null;
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
    const body = typeof payload === "string" ? payload : JSON.stringify(payload);
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

function publish(type: Mt5HfmSseEventType, envelope: Mt5HfmEventEnvelope, filterSymbol?: string): void {
  for (const [id, sub] of subscribers) {
    if (filterSymbol && sub.symbols && !sub.symbols.has(filterSymbol.toUpperCase())) {
      continue;
    }
    if (type === "candles" && !sub.includeCandles) continue;
    const ok = writeSse(sub.res, type, envelope, envelope.eventId);
    if (!ok) {
      subscribers.delete(id);
      try {
        sub.res.end();
      } catch {
        /* ignore */
      }
      continue;
    }
    sub.lastEventAt = Date.now();
  }
}

function normalizeQuotes(raw: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(raw)) return [];
  const out: Array<Record<string, unknown>> = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const q = item as Record<string, unknown>;
    if (!isValidQuoteTick(q)) continue;
    out.push(q);
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

async function pollOnce(): Promise<void> {
  candlePollCounter += 1;
  const includeCandles = candlePollCounter % 10 === 1;
  try {
    const resp = await callMt5HfmAgent("demo.stream_snapshot", { includeCandles }, { timeoutMs: 12_000 });
    if (!resp.ok || !resp.result || typeof resp.result !== "object") {
      hubState.consecutiveFailures += 1;
      hubState.lastPollError = resp.code || "STREAM_SNAPSHOT_FAILED";
      const freshness: Mt5HfmFreshness =
        hubState.consecutiveFailures >= 3 ? "DISCONNECTED" : "WAITING_FOR_DATA";
      hubState.lastFreshness = freshness;
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
    const freshness =
      typeof snap.freshness === "string"
        ? (snap.freshness as Mt5HfmFreshness)
        : freshnessFromAgeSec(ageSec, policy, { terminalRunning });
    hubState.lastFreshness = freshness;

    const seq = typeof snap.seq === "number" ? snap.seq : null;
    const brokerTime = typeof snap.brokerTime === "number" ? snap.brokerTime : null;
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
    if (!hubState.lastAccountJson || isNewSeq || freshness === "LIVE" || freshness === "STALE") {
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
      }

      const quotes = normalizeQuotes(snap.quotes);
      for (const q of quotes) {
        const symbol = String(q.symbol).toUpperCase();
        const bid = Number(q.bid);
        const ask = Number(q.ask);
        const tickTime = typeof q.tickTime === "number" ? q.tickTime : null;
        const prev = hubState.lastQuotes.get(symbol);
        const changed =
          !prev || prev.bid !== bid || prev.ask !== ask || prev.tickTime !== tickTime || isNewSeq;
        if (!changed) continue;
        hubState.lastQuotes.set(symbol, { bid, ask, tickTime });
        publish(
          "quote",
          buildEnvelope(
            "quote",
            {
              symbol,
              bid,
              ask,
              last: q.last ?? null,
              spread: q.spread ?? ask - bid,
              digits: q.digits ?? null,
              point: q.point ?? null,
              tickTime,
              tickVolume: q.tickVolume ?? null,
              provider: "HFM_MT5",
            },
            {
              eventId: randomUUID(),
              seq,
              brokerTimestamp: tickTime ?? brokerTime,
              serverReceivedAt,
              freshness,
              provenance,
            },
          ),
          symbol,
        );
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

export function ensureMt5HfmRealtimeHubStarted(): void {
  if (started) return;
  started = true;
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
  return {
    broker: "HFM_MT5",
    environment: "demo",
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
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
  };
}

export function subscribeMt5HfmSse(
  res: ServerResponse,
  opts?: { symbols?: string[]; includeCandles?: boolean },
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
  };
  subscribers.set(id, sub);

  const hello = buildEnvelope(
    "hello",
    {
      subscriberId: id,
      broker: "HFM_MT5",
      environment: "demo",
      maxSubscribers: MAX_SUBSCRIBERS,
      policy,
      note: "HFM MT5 Demo read-only stream. Reconnect on drop.",
    },
    {
      eventId: randomUUID(),
      serverReceivedAt: nowIso(),
      freshness: hubState.lastFreshness,
      provenance: "hub",
    },
  );
  writeSse(res, "hello", hello, hello.eventId);

  // Initial authoritative snapshot if available.
  if (hubState.lastSnapshot) {
    const snap = hubState.lastSnapshot;
    const ageSec = typeof snap.ageSec === "number" ? snap.ageSec : null;
    const freshness =
      typeof snap.freshness === "string"
        ? (snap.freshness as Mt5HfmFreshness)
        : freshnessFromAgeSec(ageSec, policy);
    const envelope = buildEnvelope(
      "snapshot",
      {
        account: snap.account ?? null,
        quotes: normalizeQuotes(snap.quotes),
        freshness,
        ageSec,
        seq: snap.seq ?? null,
        terminalRunning: snap.terminalRunning ?? null,
        authenticated: snap.authenticated ?? null,
      },
      {
        eventId: randomUUID(),
        seq: typeof snap.seq === "number" ? snap.seq : null,
        brokerTimestamp: typeof snap.brokerTime === "number" ? snap.brokerTime : null,
        serverReceivedAt:
          typeof snap.serverReceivedAt === "string" ? snap.serverReceivedAt : nowIso(),
        freshness,
        provenance:
          snap.source === "mql5_readonly_snapshot" ? "mql5_readonly_snapshot" : "agent",
      },
    );
    writeSse(res, "snapshot", envelope, envelope.eventId);
  }

  const onClose = () => {
    subscribers.delete(id);
  };
  res.on("close", onClose);
  res.on("error", onClose);

  // Soft backpressure hint — drop subscriber if far behind (idle write failures handled in publish).
  if (subscribers.size > MAX_WRITE_QUEUE_HINT) {
    /* cap already enforced */
  }

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
}
