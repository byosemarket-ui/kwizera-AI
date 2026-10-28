/**
 * Phase 58.3 — DEMO lifecycle orchestrator.
 * Grant checks + quote/preflight + ForexConnect DEMO mutation (open/protect/cancel/close).
 * Does not enable global Master Trading, placesOrders, or automatic entry.
 */
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getForexConnectBridge } from "../../../market-data/forexconnect/client.js";
import {
  evaluateProtectiveGeometry,
  evaluateUnprotectedFillPolicy,
} from "../broker-intent/protective-geometry.js";
import { getDemoExecutionGrantStore } from "./grant-store.js";
import {
  getForexConnectDemoMutationAdapter,
  nodeDemoMutationEnvEnabled,
} from "./forexconnect-mutation-adapter.js";
import { evaluateDemoLifecyclePreflight } from "./preflight.js";
import {
  evaluateDemoGrantCoverage,
  groupDemoReadinessBlockers,
  primaryDemoReadinessBlocker,
} from "./readiness-blockers.js";
import type {
  DemoCancelPendingRequest,
  DemoCloseTradeRequest,
  DemoLifecycleRecord,
  DemoLifecycleState,
  DemoOpenMarketRequest,
  DemoProtectionStatus,
} from "./types.js";

function storePath(): string {
  return join(process.cwd(), "data", "forex", "demo-lifecycle-records.json");
}

function nowIso(): string {
  return new Date().toISOString();
}

function emptyRecord(partial: Partial<DemoLifecycleRecord> & {
  lifecycleId: string;
  idempotencyKey: string;
}): DemoLifecycleRecord {
  return {
    lifecycleId: partial.lifecycleId,
    state: partial.state ?? "IDLE",
    grantId: partial.grantId ?? null,
    intentId: partial.intentId ?? null,
    idempotencyKey: partial.idempotencyKey,
    instrument: partial.instrument ?? null,
    direction: partial.direction ?? null,
    lots: partial.lots ?? null,
    stopLoss: partial.stopLoss ?? null,
    takeProfit: partial.takeProfit ?? null,
    brokerOrderId: partial.brokerOrderId ?? null,
    tradeId: partial.tradeId ?? null,
    closeOrderId: partial.closeOrderId ?? null,
    fillConfirmed: partial.fillConfirmed ?? false,
    closeConfirmed: partial.closeConfirmed ?? false,
    cancelConfirmed: partial.cancelConfirmed ?? false,
    brokerProtected: partial.brokerProtected ?? false,
    remainingAmount: partial.remainingAmount ?? null,
    protectionStatus: partial.protectionStatus ?? "NOT_REQUESTED",
    lastError: partial.lastError ?? null,
    lastCode: partial.lastCode ?? null,
    mutatesBroker: partial.mutatesBroker ?? false,
    placesOrdersGlobal: false,
    acceptsForExecutionGlobal: false,
    createdAtUtc: partial.createdAtUtc ?? nowIso(),
    updatedAtUtc: partial.updatedAtUtc ?? nowIso(),
    evidence: partial.evidence ?? {},
  };
}

function protectionStatusFromBroker(
  brokerProtected: boolean,
  requested: boolean,
  partial?: boolean,
): DemoProtectionStatus {
  if (!requested) return "NOT_REQUESTED";
  if (brokerProtected) return "BROKER_CONFIRMED";
  if (partial) return "BROKER_PARTIAL";
  return "BROKER_UNVERIFIED";
}

export class DemoLifecycleOrchestrator {
  private records: DemoLifecycleRecord[] = [];

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      if (!existsSync(storePath())) {
        this.records = [];
        return;
      }
      const raw = JSON.parse(readFileSync(storePath(), "utf8")) as { records?: DemoLifecycleRecord[] };
      this.records = Array.isArray(raw.records)
        ? raw.records.map((r) => emptyRecord({
          ...r,
          lifecycleId: r.lifecycleId,
          idempotencyKey: r.idempotencyKey,
        }))
        : [];
    } catch {
      this.records = [];
    }
  }

  private save(): void {
    mkdirSync(dirname(storePath()), { recursive: true });
    writeFileSync(
      storePath(),
      JSON.stringify({ schemaVersion: "demo-lifecycle-v3", records: this.records.slice(0, 100) }, null, 2),
      "utf8",
    );
  }

  private upsert(rec: DemoLifecycleRecord): DemoLifecycleRecord {
    const idx = this.records.findIndex((r) => r.lifecycleId === rec.lifecycleId);
    if (idx >= 0) this.records[idx] = rec;
    else this.records.unshift(rec);
    this.save();
    return rec;
  }

  getStatus(): Record<string, unknown> {
    const grants = getDemoExecutionGrantStore().listActive();
    const latest = this.records[0] ?? null;
    return {
      ok: true,
      phase: "58.5",
      placesOrdersGlobal: false,
      acceptsForExecutionGlobal: false,
      masterTradingGlobal: false,
      emergencyEntryLockPolicy: true,
      automaticEntryDisabled: true,
      automaticReentryDisabled: true,
      liveExecutionUnauthorized: true,
      activeDemoGrants: grants.map((g) => ({
        grantId: g.grantId,
        expiresAtUtc: g.expiresAtUtc,
        maxLots: g.maxLots,
        instrumentAllowlist: g.instrumentAllowlist,
        accountIdMasked: g.accountIdMasked,
      })),
      latestLifecycle: latest,
      note:
        "DEMO lifecycle: grant + quote preflight + sidecar mutation flag/secret. Supports open/protect/cancel-pending/partial-close. LIVE locked.",
    };
  }

  createGrant(input: {
    ttlMs?: number;
    accountIdMasked?: string | null;
    instrumentAllowlist?: string[];
    maxLots?: number;
  }) {
    return getDemoExecutionGrantStore().create(input);
  }

  revokeGrant(grantId: string) {
    return getDemoExecutionGrantStore().revoke(grantId);
  }

  async readiness(opts?: {
    instrument?: string | null;
    lots?: number | null;
  }): Promise<Record<string, unknown>> {
    const bridge = getForexConnectBridge();
    const status = await bridge.getStatus();
    const caps = await getForexConnectDemoMutationAdapter().probeSdkCapabilities();
    const env = String((status as { environment?: string }).environment || "").toLowerCase();
    const connected = String((status as { status?: string }).status || "") === "CONNECTED";
    const demoOk = env === "demo";
    const sidecarMutationEnv = Boolean((caps as { mutationEnvEnabled?: boolean }).mutationEnvEnabled);
    const nodeMutationEnv = nodeDemoMutationEnvEnabled();
    const mutationEnv = sidecarMutationEnv && nodeMutationEnv;
    // Phase 59.0.12E — report Node vs sidecar secret presence separately (booleans only).
    const sidecarMutationSecretConfigured = Boolean(
      (caps as { mutationSecretConfigured?: boolean }).mutationSecretConfigured,
    );
    const nodeMutationSecretConfigured = Boolean(
      String(process.env.KWIZERA_FOREXCONNECT_DEMO_MUTATION_SECRET || "").trim(),
    );
    const secretOk = sidecarMutationSecretConfigured && nodeMutationSecretConfigured;
    const sdkOk = Boolean((caps as { hasCreateOrderRequest?: boolean }).hasCreateOrderRequest)
      && Boolean((caps as { trueMarketOpen?: unknown }).trueMarketOpen != null
        || (caps as { ordersConstants?: string[] }).ordersConstants?.includes?.("TRUE_MARKET_OPEN"));
    const protectiveSurface = Boolean(
      (caps as { supportsAttachedRateStopLimit?: boolean }).supportsAttachedRateStopLimit
      || (caps as { supportsPostFillStopLimitTradeId?: boolean }).supportsPostFillStopLimitTradeId
      || (caps as { stopOrder?: unknown }).stopOrder != null
      || (caps as { ordersConstants?: string[] }).ordersConstants?.includes?.("STOP"),
    );
    const cancelSurface = Boolean(
      (caps as { supportsDeleteOrder?: boolean }).supportsDeleteOrder
      || (caps as { ordersConstants?: string[] }).ordersConstants?.includes?.("STOP"),
    );

    const activeGrants = getDemoExecutionGrantStore().listActive();
    const grantCoverage = evaluateDemoGrantCoverage({
      instrument: opts?.instrument,
      lots: opts?.lots,
      grants: activeGrants,
    });

    const blockers: string[] = [];
    if (!connected) blockers.push("SESSION_NOT_CONNECTED");
    if (!demoOk) blockers.push("ENVIRONMENT_NOT_DEMO");
    if (!sidecarMutationEnv) blockers.push("SIDECAR_MUTATION_ENV_DISABLED");
    if (!nodeMutationEnv) blockers.push("NODE_MUTATION_ENV_DISABLED");
    if (!sidecarMutationSecretConfigured) blockers.push("SIDECAR_MUTATION_SECRET_NOT_CONFIGURED");
    if (!nodeMutationSecretConfigured) blockers.push("NODE_MUTATION_SECRET_NOT_CONFIGURED");
    // Compatibility umbrella for clients that still key on the Phase 58.5 code.
    if (!secretOk) blockers.push("MUTATION_SECRET_NOT_CONFIGURED");
    if (!sdkOk) blockers.push("SDK_MUTATION_SURFACE_UNVERIFIED");
    if (!protectiveSurface) blockers.push("SDK_PROTECTIVE_SURFACE_UNVERIFIED");
    for (const code of grantCoverage.blockers) {
      if (!blockers.includes(code)) blockers.push(code);
    }

    const ownerActionChecklist: string[] = [];
    if (!sidecarMutationEnv || !nodeMutationEnv) {
      ownerActionChecklist.push(
        "Set KWIZERA_FOREXCONNECT_ALLOW_DEMO_MUTATION=1 on both Node app and ForexConnect sidecar, then restart those processes only if authorized.",
      );
    }
    if (!secretOk) {
      ownerActionChecklist.push(
        "Set identical KWIZERA_FOREXCONNECT_DEMO_MUTATION_SECRET on Node + sidecar (never in browser).",
      );
    }
    if (!grantCoverage.ok) {
      ownerActionChecklist.push(
        opts?.instrument
          ? `Authenticate with Admin API token, then POST /demo-lifecycle/grant (short ttl, maxLots>=${Math.max(1, Math.floor(Number(opts.lots) || 1))}, non-empty instrumentAllowlist explicitly including ${String(opts.instrument)}; empty allowlists are rejected).`
          : "Authenticate with Admin API token, then POST /demo-lifecycle/grant (short ttl, maxLots=1, non-empty instrumentAllowlist; empty allowlists are rejected).",
      );
    }
    ownerActionChecklist.push(
      "Confirm offer-quote for the test instrument via POST /demo-lifecycle/quote-probe before open.",
    );
    ownerActionChecklist.push(
      "After one controlled lifecycle: revoke grant and set ALLOW_DEMO_MUTATION back to off.",
    );

    // Phase 59.0.3 — quote subscription readiness (CONNECTED ≠ quote-ready).
    // Pass real offer bid/ask/timestamp when available; gate mayAttemptDemoMutation on quote readiness.
    let quoteSubscriptionReadiness: Record<string, unknown> | null = null;
    try {
      const { getForexConnectLiveCandleService } = await import(
        "../../../market-data/forexconnect/live-service.js"
      );
      const { collectConfiguredAtQuoteInstruments } = await import(
        "../../../market-data/forexconnect/seed-at-quote-instruments.js"
      );
      const { evaluateQuoteSubscriptionReadiness, parseQuoteTimestampMs } = await import(
        "../quote-subscription-readiness.js"
      );
      const { MARKET_QUOTE_STALE_MS } = await import("../quote-freshness.js");
      const live = getForexConnectLiveCandleService();
      const life = live.getLifecycleDiagnostics();
      const stream = await bridge.getStreamStatus();
      const configured = collectConfiguredAtQuoteInstruments();
      const requested = configured.instruments[0]?.symbol ?? null;

      let bid: number | null = null;
      let ask: number | null = null;
      let quoteInstrument: string | null = null;
      let lastQuoteAt: string | number | null =
        stream.lastQuoteAt
        ?? (status as { lastQuoteAt?: string | null }).lastQuoteAt
        ?? null;
      let lastQuoteAgeMs: number | null =
        typeof stream.lastQuoteAgeMs === "number" ? stream.lastQuoteAgeMs : null;
      let instrumentPermissionError: string | null = null;

      if (requested) {
        const ensured = await live.ensureValidatedAtInstrument(requested, "1m");
        if (!ensured.ok) {
          instrumentPermissionError = `${ensured.code}: ${ensured.message}`;
          blockers.push(ensured.code);
        }
        const quoteRaw = await getForexConnectDemoMutationAdapter().getOfferQuote(requested);
        const qBid = quoteRaw.bid == null ? null : Number(quoteRaw.bid);
        const qAsk = quoteRaw.ask == null ? null : Number(quoteRaw.ask);
        bid = Number.isFinite(qBid as number) ? (qBid as number) : null;
        ask = Number.isFinite(qAsk as number) ? (qAsk as number) : null;
        quoteInstrument = quoteRaw.instrument != null
          ? String(quoteRaw.instrument)
          : requested;
        if (quoteRaw.offerTime != null) {
          lastQuoteAt = quoteRaw.offerTime as string | number;
          const ts = parseQuoteTimestampMs(quoteRaw.offerTime);
          if (ts != null && lastQuoteAgeMs == null) {
            lastQuoteAgeMs = Math.max(0, Date.now() - ts);
          }
        }
      }

      const readinessEval = evaluateQuoteSubscriptionReadiness({
        sessionStatus: String((status as { status?: string }).status || ""),
        configuredInstrumentCount: configured.instruments.length,
        intendedCount: life.intendedCount,
        subscriptionCount: Number(
          stream.subscriptionCount
          ?? (status as { subscriptionCount?: number }).subscriptionCount
          ?? 0,
        ),
        offersListenerActive: Boolean(
          stream.offersListenerActive
          ?? (status as { offersListenerActive?: boolean }).offersListenerActive,
        ),
        streamState: String(
          stream.streamState
          ?? (status as { streamState?: string }).streamState
          ?? "",
        ),
        requestedInstrument: requested,
        quoteInstrument,
        lastQuoteAt,
        lastQuoteAgeMs,
        freshnessThresholdMs: MARKET_QUOTE_STALE_MS,
        bid,
        ask,
        subscriptionError: null,
        instrumentPermissionError,
      });
      quoteSubscriptionReadiness = { ...readinessEval, configuredInstruments: configured.instruments };
      if (!readinessEval.readyForExecutionQuote) {
        blockers.push(readinessEval.code);
        ownerActionChecklist.push(
          "Ensure an AT selectedInstrument (or monitor instrument) is set, then restore/subscribe Offers until a fresh bid/ask is observed.",
        );
      }
    } catch {
      quoteSubscriptionReadiness = {
        code: "SUBSCRIPTION_FAILED",
        readyForExecutionQuote: false,
        message: "Quote subscription readiness diagnostics unavailable.",
      };
      blockers.push("SUBSCRIPTION_FAILED");
    }

    const blockerCategories = groupDemoReadinessBlockers(blockers);
    const primaryBlocker = primaryDemoReadinessBlocker(blockers);
    return {
      ok: blockers.length === 0,
      phase: "59.0.12E",
      connected,
      environment: env || null,
      demoSession: demoOk,
      mutationEnvEnabled: mutationEnv,
      sidecarMutationEnvEnabled: sidecarMutationEnv,
      nodeMutationEnvEnabled: nodeMutationEnv,
      mutationSecretConfigured: secretOk,
      sidecarMutationSecretConfigured,
      nodeMutationSecretConfigured,
      protectiveSurfaceDocumented: protectiveSurface,
      cancelSurfaceDocumented: cancelSurface,
      partialCloseDocumented: Boolean((caps as { supportsPartialClose?: boolean }).supportsPartialClose),
      sdkCapabilities: caps,
      activeGrantCount: activeGrants.length,
      grantCoverage,
      quoteSubscriptionReadiness,
      blockers,
      blockerCategories,
      primaryBlocker: blockers.length ? primaryBlocker : null,
      ownerActionChecklist,
      mayAttemptDemoMutation: blockers.length === 0,
      placesOrdersGlobal: false,
      liveLocked: true,
      note:
        "Unauthenticated 403 on this route is correct. Mutation remains fail-closed until Node+sidecar flags, secret, grant, and a fresh valid quote are all valid. CONNECTED alone is not quote-ready. Blockers are categorized (OWNER_CONFIG / GRANT_AUTHORIZATION / SESSION / MARKET / SDK) — not a single generic BLOCKED.",
    };
  }

  /**
   * Phase 58.5 — best-effort subscribe + Offers snapshot for DEMO preflight evidence.
   * Does not mutate broker orders.
   */
  async probeQuote(instrument: string): Promise<Record<string, unknown>> {
    const symbol = String(instrument || "").trim();
    let subscribe: Record<string, unknown> | null = null;
    try {
      // Phase 59.0.3 — validate allowlist+catalog, then live.ensure (durable intended).
      const { getForexConnectLiveCandleService } = await import(
        "../../../market-data/forexconnect/live-service.js"
      );
      const live = getForexConnectLiveCandleService();
      const ensured = await live.ensureValidatedAtInstrument(symbol, "1m");
      subscribe = {
        ok: ensured.ok,
        via: "live.ensureValidatedAtInstrument",
        code: ensured.code,
        streamState: ensured.series?.streamState ?? null,
        providerSymbol: ensured.series?.providerSymbol ?? symbol,
        message: ensured.message,
        placesOrders: false,
      };
    } catch (error) {
      subscribe = {
        ok: false,
        via: "live.ensureValidatedAtInstrument",
        error: error instanceof Error ? error.message : "subscribe failed",
      };
    }
    const quote = await getForexConnectDemoMutationAdapter().getOfferQuote(symbol);
    const { evaluateExecutionQuoteEvidence, parseQuoteTimestampMs } = await import(
      "../quote-subscription-readiness.js"
    );
    const { MARKET_QUOTE_STALE_MS } = await import("../quote-freshness.js");
    const qBid = quote.bid == null ? null : Number(quote.bid);
    const qAsk = quote.ask == null ? null : Number(quote.ask);
    const evidence = evaluateExecutionQuoteEvidence({
      requestedInstrument: symbol,
      quoteInstrument: quote.instrument != null ? String(quote.instrument) : symbol,
      bid: Number.isFinite(qBid as number) ? (qBid as number) : null,
      ask: Number.isFinite(qAsk as number) ? (qAsk as number) : null,
      lastQuoteAt: (quote.offerTime as string | number | null | undefined) ?? null,
      lastQuoteAgeMs: null,
      freshnessThresholdMs: MARKET_QUOTE_STALE_MS,
    });
    return {
      ok: Boolean(quote.ok) && Boolean(quote.quotePresent) && evidence.readyForExecutionQuote,
      phase: "59.0.3",
      instrument: symbol,
      subscribe,
      quote,
      quoteReadiness: evidence,
      quoteTimestampMs: parseQuoteTimestampMs(quote.offerTime),
      mutatesBroker: false,
      placesOrdersGlobal: false,
      note:
        "Offer table snapshot is the DEMO open preflight source; subscribe uses validated live.ensure (registers intended).",
    };
  }

  async openMarket(req: DemoOpenMarketRequest): Promise<{
    ok: boolean;
    code: string;
    error: string | null;
    record: DemoLifecycleRecord;
  }> {
    const existing = this.records.find((r) => r.idempotencyKey === req.idempotencyKey);
    if (existing) {
      const successStates: DemoLifecycleState[] = ["POSITION_OPEN", "FILLED", "PROTECTED"];
      return {
        ok: successStates.includes(existing.state) || existing.fillConfirmed,
        code: "IDEMPOTENT_REPLAY",
        error: null,
        record: existing,
      };
    }

    const grantCheck = getDemoExecutionGrantStore().requireActive(
      req.grantId,
      req.instrument,
      req.lots,
    );
    const base = emptyRecord({
      lifecycleId: randomUUID(),
      state: "IDLE",
      grantId: req.grantId,
      intentId: randomUUID(),
      idempotencyKey: req.idempotencyKey,
      instrument: req.instrument,
      direction: req.direction,
      lots: req.lots,
      stopLoss: req.stopLoss ?? null,
      takeProfit: req.takeProfit ?? null,
      protectionStatus: req.requireProtective ? "REQUESTED" : "NOT_REQUESTED",
      evidence: {
        sourceDecisionId: req.sourceDecisionId ?? null,
        sourceAnalysisId: req.sourceAnalysisId ?? null,
        sourceDraftId: req.sourceDraftId ?? null,
        sourcePlanId: req.sourcePlanId ?? null,
        phase: "59.0",
      },
    });

    if (!grantCheck.ok) {
      base.state = "AUTHORIZATION_REJECTED";
      base.lastCode = grantCheck.code;
      base.lastError = grantCheck.error;
      this.upsert(base);
      return { ok: false, code: grantCheck.code, error: grantCheck.error, record: base };
    }

    if (req.requireProtective) {
      const sl = req.stopLoss;
      const tp = req.takeProfit;
      if (sl == null || !Number.isFinite(sl) || tp == null || !Number.isFinite(tp)) {
        base.state = "VALIDATION_FAILED";
        base.protectionStatus = "FAILED";
        base.lastCode = "PROTECTION_LEVELS_REQUIRED";
        base.lastError =
          "requireProtective=true requires finite stopLoss and takeProfit absolute prices.";
        this.upsert(base);
        return { ok: false, code: base.lastCode, error: base.lastError, record: base };
      }
      const entryHint = req.entryHint != null && Number.isFinite(req.entryHint)
        ? Number(req.entryHint)
        : null;
      if (entryHint != null) {
        const geometry = evaluateProtectiveGeometry({
          direction: req.direction,
          entryPrice: entryHint,
          stopLoss: sl,
          takeProfit: tp,
          requireProtective: true,
          requireThreeR: false,
        });
        if (!geometry.ok) {
          base.state = "VALIDATION_FAILED";
          base.protectionStatus = "FAILED";
          base.lastCode = geometry.rejections[0]?.code ?? "PROTECTION_GEOMETRY_INVALID";
          base.lastError = geometry.rejections.map((r) => r.message).join("; ");
          base.evidence = { geometry };
          this.upsert(base);
          return { ok: false, code: base.lastCode, error: base.lastError, record: base };
        }
      }
    }

    const ready = await this.readiness({
      instrument: req.instrument,
      lots: req.lots,
    });
    if (!ready.mayAttemptDemoMutation) {
      const primary = primaryDemoReadinessBlocker(ready.blockers);
      base.state = "MUTATION_DISABLED";
      base.lastCode = primary;
      base.lastError = `DEMO mutation readiness failed: ${(ready.blockers as string[]).join(",")}`;
      base.evidence = { readiness: ready, readinessPrimaryBlocker: primary };
      this.upsert(base);
      return { ok: false, code: base.lastCode, error: base.lastError, record: base };
    }

    const adapter = getForexConnectDemoMutationAdapter();
    // Phase 59.0.3 — validate allowlist+catalog, then durable intended via live.ensure.
    try {
      const { getForexConnectLiveCandleService } = await import(
        "../../../market-data/forexconnect/live-service.js"
      );
      const ensured = await getForexConnectLiveCandleService().ensureValidatedAtInstrument(
        req.instrument,
        "1m",
      );
      if (!ensured.ok) {
        base.state = "VALIDATION_FAILED";
        base.lastCode = ensured.code;
        base.lastError = ensured.message;
        base.evidence = { ensureValidated: ensured };
        this.upsert(base);
        return { ok: false, code: base.lastCode, error: base.lastError, record: base };
      }
    } catch (error) {
      base.state = "VALIDATION_FAILED";
      base.lastCode = "SUBSCRIPTION_FAILED";
      base.lastError = error instanceof Error ? error.message : "Validated subscribe failed.";
      this.upsert(base);
      return { ok: false, code: base.lastCode, error: base.lastError, record: base };
    }
    const quoteRaw = await adapter.getOfferQuote(req.instrument);
    const quotePresent = Boolean(quoteRaw.quotePresent ?? quoteRaw.ok);
    const quoteBid = quoteRaw.bid == null ? null : Number(quoteRaw.bid);
    const quoteAsk = quoteRaw.ask == null ? null : Number(quoteRaw.ask);
    const { MARKET_QUOTE_STALE_MS } = await import("../quote-freshness.js");

    const preflight = evaluateDemoLifecyclePreflight({
      instrument: req.instrument,
      direction: req.direction,
      lots: req.lots,
      maxLots: grantCheck.grant.maxLots,
      environment: String(ready.environment ?? ""),
      sessionConnected: Boolean(ready.connected),
      quotePresent: quotePresent && Number.isFinite(quoteBid) && Number.isFinite(quoteAsk),
      quoteBid: Number.isFinite(quoteBid as number) ? (quoteBid as number) : null,
      quoteAsk: Number.isFinite(quoteAsk as number) ? (quoteAsk as number) : null,
      quoteInstrument: quoteRaw.instrument != null ? String(quoteRaw.instrument) : req.instrument,
      quoteTimestamp: (quoteRaw.offerTime as string | number | null | undefined) ?? null,
      lastQuoteAgeMs: null,
      nowMs: Date.now(),
      freshnessThresholdMs: MARKET_QUOTE_STALE_MS,
      requireProtective: req.requireProtective,
      stopLoss: req.stopLoss ?? null,
      takeProfit: req.takeProfit ?? null,
      entryHint: req.entryHint ?? null,
      grantActive: true,
    });
    base.evidence = { ...base.evidence, quote: quoteRaw, preflight };

    if (!preflight.maySubmitDemoMutation) {
      base.state = "VALIDATION_FAILED";
      base.lastCode = preflight.code;
      base.lastError = `DEMO preflight blocked: ${preflight.blockers.join(",")}`;
      if (req.requireProtective) base.protectionStatus = "FAILED";
      this.upsert(base);
      return { ok: false, code: base.lastCode, error: base.lastError, record: base };
    }

    base.state = "SUBMITTING";
    if (req.requireProtective) base.protectionStatus = "PENDING";
    this.upsert(base);

    const result = await adapter.openTrueMarket({
      instrument: req.instrument,
      direction: req.direction,
      lots: req.lots,
      accountId: req.accountId,
      stopLoss: req.stopLoss ?? null,
      takeProfit: req.takeProfit ?? null,
      attachProtectiveAfterFill: req.requireProtective || req.attachProtectiveAfterFill === true,
    });

    base.mutatesBroker = result.mutatesBroker;
    base.brokerOrderId = result.brokerOrderId ?? null;
    base.lastCode = result.code;
    base.lastError = result.error ?? null;
    base.evidence = { ...base.evidence, open: result.raw };
    base.updatedAtUtc = nowIso();

    if (!result.ok) {
      base.state = result.code.includes("TIMEOUT") || result.code.includes("UNKNOWN")
        ? "SUBMISSION_UNKNOWN"
        : "BROKER_REJECTED";
      if (result.brokerOrderId) base.state = "RECONCILIATION_REQUIRED";
      if (req.requireProtective) base.protectionStatus = "FAILED";
      this.upsert(base);
      return { ok: false, code: result.code, error: result.error ?? result.code, record: base };
    }

    const trade = result.trade;
    if (trade && trade.tradeId) {
      base.tradeId = String(trade.tradeId);
      base.fillConfirmed = true;
      base.state = "POSITION_OPEN";
      if (trade.amount != null) base.remainingAmount = Number(trade.amount);
    } else {
      base.fillConfirmed = false;
      base.state = "ACCEPTED_PENDING";
    }

    let brokerProtected = Boolean(result.brokerProtected);
    const protection = result.protection as Record<string, unknown> | null | undefined;
    const hasPartial = Boolean(
      protection && (protection.stop != null || protection.limit != null),
    );

    if (req.requireProtective && base.tradeId && !brokerProtected) {
      base.state = "PROTECTION_PENDING";
      const attach = await adapter.attachProtective({
        tradeId: base.tradeId,
        stopLoss: req.stopLoss ?? null,
        takeProfit: req.takeProfit ?? null,
        accountId: req.accountId,
      });
      base.evidence = { ...base.evidence, attach: attach.raw };
      base.mutatesBroker = base.mutatesBroker || attach.mutatesBroker;
      brokerProtected = Boolean(attach.brokerProtected);
      if (!brokerProtected) {
        const recon = await adapter.reconcileProtection(base.tradeId);
        base.evidence = { ...base.evidence, reconcile: recon.raw };
        brokerProtected = Boolean(recon.brokerProtected);
      }
    }

    base.brokerProtected = brokerProtected;
    base.protectionStatus = protectionStatusFromBroker(
      brokerProtected,
      Boolean(req.requireProtective),
      hasPartial,
    );

    if (req.requireProtective && base.fillConfirmed && !brokerProtected) {
      // Align with evaluateUnprotectedFillPolicy: never autonomously close.
      // Explicit closeIfUnprotected=true is an opt-in DEMO cleanup only when
      // the policy would authorize it (currently always false).
      const unprotectedPolicy = evaluateUnprotectedFillPolicy();
      // Policy currently returns literal false; coerce so TS stays valid if policy widens later.
      const policyAllowsAutonomousClose = Boolean(unprotectedPolicy.autonomousCloseAuthorized);
      const shouldClose = policyAllowsAutonomousClose && req.closeIfUnprotected === true;
      base.state = "PROTECTION_FAILED";
      base.protectionStatus = "FAILED";
      base.lastCode = unprotectedPolicy.code;
      base.lastError =
        "Fill observed but broker stop+limit not both confirmed. "
        + unprotectedPolicy.message
        + (shouldClose
          ? " Closing unprotected DEMO trade (explicit opt-in)."
          : " Leaving position open; block additional entries; owner incident policy required.");
      base.evidence = {
        ...base.evidence,
        unprotectedFillPolicy: unprotectedPolicy,
        blockAdditionalEntries: unprotectedPolicy.blockAdditionalEntries,
        raiseCriticalAlert: unprotectedPolicy.raiseCriticalAlert,
        autonomousCloseAuthorized: unprotectedPolicy.autonomousCloseAuthorized,
        closeIfUnprotectedRequested: req.closeIfUnprotected === true,
      };

      if (shouldClose && base.tradeId) {
        base.state = "CLOSE_PENDING";
        const closeResult = await adapter.closeTrade({
          tradeId: base.tradeId,
          instrument: req.instrument,
          accountId: req.accountId,
        });
        base.evidence = { ...base.evidence, unprotectedClose: closeResult.raw };
        base.closeOrderId = closeResult.brokerOrderId ?? null;
        base.closeConfirmed = Boolean(closeResult.closeConfirmed);
        base.remainingAmount = closeResult.remainingAmount ?? (closeResult.stillOpen ? null : 0);
        base.mutatesBroker = true;
        if (closeResult.closeConfirmed && !closeResult.stillOpen) {
          base.state = "CLOSED";
          base.protectionStatus = "CLOSED_UNPROTECTED";
          base.lastCode = "CLOSED_AFTER_PROTECTION_FAILURE";
        } else {
          base.state = "RECONCILIATION_REQUIRED";
          base.lastCode = "UNPROTECTED_CLOSE_UNCONFIRMED";
        }
      }

      this.upsert(base);
      return {
        ok: false,
        code: base.lastCode ?? "PROTECTION_UNVERIFIED",
        error: base.lastError,
        record: base,
      };
    }

    if (brokerProtected) {
      base.state = "PROTECTED";
      base.protectionStatus = "BROKER_CONFIRMED";
    } else if (base.fillConfirmed) {
      base.state = "POSITION_OPEN";
    }

    this.upsert(base);
    return { ok: true, code: result.code, error: null, record: base };
  }

  async closeTrade(req: DemoCloseTradeRequest): Promise<{
    ok: boolean;
    code: string;
    error: string | null;
    record: DemoLifecycleRecord;
  }> {
    const existing = this.records.find((r) => r.idempotencyKey === req.idempotencyKey);
    if (existing && existing.closeConfirmed && existing.state === "CLOSED") {
      return { ok: true, code: "IDEMPOTENT_REPLAY", error: null, record: existing };
    }

    const grantCheck = getDemoExecutionGrantStore().requireActive(req.grantId);
    const rec = existing ?? emptyRecord({
      lifecycleId: randomUUID(),
      state: "CLOSE_PENDING",
      grantId: req.grantId,
      intentId: randomUUID(),
      idempotencyKey: req.idempotencyKey,
      instrument: req.instrument ?? null,
      tradeId: req.tradeId,
      protectionStatus: "NOT_REQUESTED",
    });

    if (!grantCheck.ok) {
      rec.state = "AUTHORIZATION_REJECTED";
      rec.lastCode = grantCheck.code;
      rec.lastError = grantCheck.error;
      this.upsert(rec);
      return { ok: false, code: grantCheck.code, error: grantCheck.error, record: rec };
    }

    const ready = await this.readiness({
      instrument: req.instrument,
      lots: null,
    });
    if (!ready.mayAttemptDemoMutation) {
      const primary = primaryDemoReadinessBlocker(ready.blockers);
      rec.state = "MUTATION_DISABLED";
      rec.lastCode = primary;
      rec.lastError = `DEMO mutation readiness failed: ${(ready.blockers as string[]).join(",")}`;
      rec.evidence = { ...rec.evidence, readiness: ready, readinessPrimaryBlocker: primary };
      this.upsert(rec);
      return { ok: false, code: rec.lastCode, error: rec.lastError, record: rec };
    }

    rec.state = "CLOSE_PENDING";
    this.upsert(rec);

    const result = await getForexConnectDemoMutationAdapter().closeTrade({
      tradeId: req.tradeId,
      instrument: req.instrument,
      accountId: req.accountId,
      amount: req.amount ?? null,
    });

    rec.mutatesBroker = result.mutatesBroker;
    rec.closeOrderId = result.brokerOrderId ?? null;
    rec.lastCode = result.code;
    rec.lastError = result.error ?? null;
    rec.remainingAmount = result.remainingAmount ?? null;
    rec.evidence = { ...rec.evidence, close: result.raw };
    rec.updatedAtUtc = nowIso();

    if (!result.ok) {
      rec.state = result.brokerOrderId ? "RECONCILIATION_REQUIRED" : "BROKER_REJECTED";
      this.upsert(rec);
      return { ok: false, code: result.code, error: result.error ?? result.code, record: rec };
    }

    rec.closeConfirmed = Boolean(result.closeConfirmed);
    if (result.closeConfirmed && result.stillOpen && result.partial) {
      rec.state = "PARTIALLY_CLOSED";
    } else if (result.closeConfirmed && !result.stillOpen) {
      rec.state = "CLOSED";
      rec.remainingAmount = 0;
    } else {
      rec.state = "RECONCILIATION_REQUIRED";
    }
    this.upsert(rec);
    return { ok: true, code: result.code, error: null, record: rec };
  }

  async cancelPending(req: DemoCancelPendingRequest): Promise<{
    ok: boolean;
    code: string;
    error: string | null;
    record: DemoLifecycleRecord;
  }> {
    const existing = this.records.find((r) => r.idempotencyKey === req.idempotencyKey);
    if (existing && existing.cancelConfirmed) {
      return { ok: true, code: "IDEMPOTENT_REPLAY", error: null, record: existing };
    }

    const grantCheck = getDemoExecutionGrantStore().requireActive(req.grantId);
    const rec = existing ?? emptyRecord({
      lifecycleId: randomUUID(),
      state: "CANCEL_PENDING",
      grantId: req.grantId,
      intentId: randomUUID(),
      idempotencyKey: req.idempotencyKey,
      brokerOrderId: req.brokerOrderId,
      protectionStatus: "NOT_REQUESTED",
    });

    if (!grantCheck.ok) {
      rec.state = "AUTHORIZATION_REJECTED";
      rec.lastCode = grantCheck.code;
      rec.lastError = grantCheck.error;
      this.upsert(rec);
      return { ok: false, code: grantCheck.code, error: grantCheck.error, record: rec };
    }

    const ready = await this.readiness();
    if (!ready.mayAttemptDemoMutation) {
      const primary = primaryDemoReadinessBlocker(ready.blockers);
      rec.state = "MUTATION_DISABLED";
      rec.lastCode = primary;
      rec.lastError = `DEMO mutation readiness failed: ${(ready.blockers as string[]).join(",")}`;
      rec.evidence = { ...rec.evidence, readiness: ready, readinessPrimaryBlocker: primary };
      this.upsert(rec);
      return { ok: false, code: rec.lastCode, error: rec.lastError, record: rec };
    }

    rec.state = "CANCEL_PENDING";
    rec.brokerOrderId = req.brokerOrderId;
    this.upsert(rec);

    const result = await getForexConnectDemoMutationAdapter().cancelPending({
      brokerOrderId: req.brokerOrderId,
      accountId: req.accountId,
    });

    rec.mutatesBroker = result.mutatesBroker;
    rec.lastCode = result.code;
    rec.lastError = result.error ?? null;
    rec.cancelConfirmed = Boolean(result.cancelConfirmed);
    rec.evidence = { ...rec.evidence, cancel: result.raw };
    rec.updatedAtUtc = nowIso();

    if (!result.ok) {
      rec.state = "RECONCILIATION_REQUIRED";
      this.upsert(rec);
      return { ok: false, code: result.code, error: result.error ?? result.code, record: rec };
    }

    rec.state = result.cancelConfirmed ? "CANCELLED" : "RECONCILIATION_REQUIRED";
    this.upsert(rec);
    return { ok: true, code: result.code, error: null, record: rec };
  }
}

let orch: DemoLifecycleOrchestrator | null = null;

export function getDemoLifecycleOrchestrator(): DemoLifecycleOrchestrator {
  if (!orch) orch = new DemoLifecycleOrchestrator();
  return orch;
}

export function resetDemoLifecycleOrchestratorForTests(): void {
  orch = null;
}
