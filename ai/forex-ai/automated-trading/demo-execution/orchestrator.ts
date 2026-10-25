/**
 * Phase 58.3 — DEMO lifecycle orchestrator.
 * Grant checks + quote/preflight + ForexConnect DEMO mutation (open/protect/cancel/close).
 * Does not enable global Master Trading, placesOrders, or automatic entry.
 */
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getForexConnectBridge } from "../../../market-data/forexconnect/client.js";
import { evaluateProtectiveGeometry } from "../broker-intent/protective-geometry.js";
import { getDemoExecutionGrantStore } from "./grant-store.js";
import {
  getForexConnectDemoMutationAdapter,
  nodeDemoMutationEnvEnabled,
} from "./forexconnect-mutation-adapter.js";
import { evaluateDemoLifecyclePreflight } from "./preflight.js";
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

  async readiness(): Promise<Record<string, unknown>> {
    const bridge = getForexConnectBridge();
    const status = await bridge.getStatus();
    const caps = await getForexConnectDemoMutationAdapter().probeSdkCapabilities();
    const env = String((status as { environment?: string }).environment || "").toLowerCase();
    const connected = String((status as { status?: string }).status || "") === "CONNECTED";
    const demoOk = env === "demo";
    const sidecarMutationEnv = Boolean((caps as { mutationEnvEnabled?: boolean }).mutationEnvEnabled);
    const nodeMutationEnv = nodeDemoMutationEnvEnabled();
    const mutationEnv = sidecarMutationEnv && nodeMutationEnv;
    const secretOk = Boolean((caps as { mutationSecretConfigured?: boolean }).mutationSecretConfigured)
      && Boolean(String(process.env.KWIZERA_FOREXCONNECT_DEMO_MUTATION_SECRET || "").trim());
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

    const blockers: string[] = [];
    if (!connected) blockers.push("SESSION_NOT_CONNECTED");
    if (!demoOk) blockers.push("ENVIRONMENT_NOT_DEMO");
    if (!sidecarMutationEnv) blockers.push("SIDECAR_MUTATION_ENV_DISABLED");
    if (!nodeMutationEnv) blockers.push("NODE_MUTATION_ENV_DISABLED");
    if (!secretOk) blockers.push("MUTATION_SECRET_NOT_CONFIGURED");
    if (!sdkOk) blockers.push("SDK_MUTATION_SURFACE_UNVERIFIED");
    if (!protectiveSurface) blockers.push("SDK_PROTECTIVE_SURFACE_UNVERIFIED");
    if (getDemoExecutionGrantStore().listActive().length === 0) blockers.push("NO_ACTIVE_DEMO_GRANT");

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
    if (getDemoExecutionGrantStore().listActive().length === 0) {
      ownerActionChecklist.push(
        "Authenticate with Admin API token, then POST /demo-lifecycle/grant (short ttl, maxLots=1, instrument allowlist).",
      );
    }
    ownerActionChecklist.push(
      "Confirm offer-quote for the test instrument via POST /demo-lifecycle/quote-probe before open.",
    );
    ownerActionChecklist.push(
      "After one controlled lifecycle: revoke grant and set ALLOW_DEMO_MUTATION back to off.",
    );

    return {
      ok: blockers.length === 0,
      phase: "58.5",
      connected,
      environment: env || null,
      demoSession: demoOk,
      mutationEnvEnabled: mutationEnv,
      sidecarMutationEnvEnabled: sidecarMutationEnv,
      nodeMutationEnvEnabled: nodeMutationEnv,
      mutationSecretConfigured: secretOk,
      protectiveSurfaceDocumented: protectiveSurface,
      cancelSurfaceDocumented: cancelSurface,
      partialCloseDocumented: Boolean((caps as { supportsPartialClose?: boolean }).supportsPartialClose),
      sdkCapabilities: caps,
      activeGrantCount: getDemoExecutionGrantStore().listActive().length,
      blockers,
      ownerActionChecklist,
      mayAttemptDemoMutation: blockers.length === 0,
      placesOrdersGlobal: false,
      liveLocked: true,
      note:
        "Unauthenticated 403 on this route is correct. Mutation remains fail-closed until Node+sidecar flags, secret, and grant are all valid.",
    };
  }

  /**
   * Phase 58.5 — best-effort subscribe + Offers snapshot for DEMO preflight evidence.
   * Does not mutate broker orders.
   */
  async probeQuote(instrument: string): Promise<Record<string, unknown>> {
    const bridge = getForexConnectBridge();
    const symbol = String(instrument || "").trim();
    let subscribe: Record<string, unknown> | null = null;
    try {
      subscribe = await bridge.subscribeQuotes(symbol) as unknown as Record<string, unknown>;
    } catch (error) {
      subscribe = {
        ok: false,
        error: error instanceof Error ? error.message : "subscribe failed",
      };
    }
    const quote = await getForexConnectDemoMutationAdapter().getOfferQuote(symbol);
    return {
      ok: Boolean(quote.ok) && Boolean(quote.quotePresent),
      phase: "58.5",
      instrument: symbol,
      subscribe,
      quote,
      mutatesBroker: false,
      placesOrdersGlobal: false,
      note: "Offer table snapshot is the DEMO open preflight source; stream subscribe is best-effort.",
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

    const ready = await this.readiness();
    if (!ready.mayAttemptDemoMutation) {
      base.state = "MUTATION_DISABLED";
      base.lastCode = "READINESS_BLOCKED";
      base.lastError = `DEMO mutation readiness failed: ${(ready.blockers as string[]).join(",")}`;
      base.evidence = { readiness: ready };
      this.upsert(base);
      return { ok: false, code: base.lastCode, error: base.lastError, record: base };
    }

    const adapter = getForexConnectDemoMutationAdapter();
    // Best-effort Offers subscription so snapshot is more likely current.
    try {
      await getForexConnectBridge().subscribeQuotes(req.instrument);
    } catch {
      /* offer-quote snapshot remains authoritative for preflight */
    }
    const quoteRaw = await adapter.getOfferQuote(req.instrument);
    const quotePresent = Boolean(quoteRaw.quotePresent ?? quoteRaw.ok);
    const quoteBid = quoteRaw.bid == null ? null : Number(quoteRaw.bid);
    const quoteAsk = quoteRaw.ask == null ? null : Number(quoteRaw.ask);

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
      const shouldClose = req.closeIfUnprotected !== false;
      base.state = "PROTECTION_FAILED";
      base.protectionStatus = "FAILED";
      base.lastCode = "PROTECTION_NOT_CONFIRMED";
      base.lastError =
        "Fill observed but broker stop+limit not both confirmed. "
        + (shouldClose ? "Closing unprotected DEMO test trade." : "Leaving position open per closeIfUnprotected=false.");

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
        code: base.lastCode ?? "PROTECTION_NOT_CONFIRMED",
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

    const ready = await this.readiness();
    if (!ready.mayAttemptDemoMutation) {
      rec.state = "MUTATION_DISABLED";
      rec.lastCode = "READINESS_BLOCKED";
      rec.lastError = `DEMO mutation readiness failed: ${(ready.blockers as string[]).join(",")}`;
      rec.evidence = { ...rec.evidence, readiness: ready };
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
      rec.state = "MUTATION_DISABLED";
      rec.lastCode = "READINESS_BLOCKED";
      rec.lastError = `DEMO mutation readiness failed: ${(ready.blockers as string[]).join(",")}`;
      rec.evidence = { ...rec.evidence, readiness: ready };
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
