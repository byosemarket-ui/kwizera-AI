/**
 * Phase 58.3 — DEMO lifecycle orchestrator.
 * Grant checks + quote/preflight + ForexConnect DEMO mutation (open/protect/cancel/close).
 * Does not enable global Master Trading, placesOrders, or automatic entry.
 */
import { randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { getForexConnectBridge } from "../../../market-data/forexconnect/client.js";
import { readJsonSafeSync, writeJsonAtomicSync } from "../../../../storage/safe-json.js";
import { resolveStorageRoot } from "../../../../storage/paths/storage-paths.js";
import {
  evaluateProtectiveGeometry,
  evaluateUnprotectedFillPolicy,
} from "../broker-intent/protective-geometry.js";
import { getDemoExecutionGrantStore, resolveDemoExecutionGrantsPath } from "./grant-store.js";
import {
  getForexConnectDemoMutationAdapter,
  nodeDemoMutationEnvEnabled,
  nodeMutationSecretFingerprint,
} from "./forexconnect-mutation-adapter.js";
import { evaluateDemoLifecyclePreflight } from "./preflight.js";
import {
  countOpenPositionsFromTradesPayload,
  evaluateDemoOpenMarketRisk,
  loadDemoOpenMarketRiskLimitsDetailed,
  sumOpenExposureLotsFromTradesPayload,
  type DemoOpenMarketAccountSnapshot,
  type DemoOpenMarketInstrumentSpecs,
} from "./open-market-risk.js";
import {
  assessOpenFillAmount,
  blocksAdditionalDemoEntries,
} from "./open-fill-assessment.js";
import { emitCriticalAlert } from "./critical-alert.js";
import {
  buildDemoReadinessComponents,
  evaluateDemoGrantCoverage,
  groupDemoReadinessBlockers,
  primaryDemoReadinessBlocker,
} from "./readiness-blockers.js";
import { getAutoDemoGrantLifecycleWorker } from "./auto-grant-lifecycle.js";
import { normalizeGrantInstrument } from "./grant-store.js";
import type {
  DemoCancelPendingRequest,
  DemoCloseTradeRequest,
  DemoLifecycleRecord,
  DemoLifecycleState,
  DemoOpenMarketRequest,
  DemoProtectionStatus,
} from "./types.js";
import type { ForexConnectAccountRow, ForexConnectInstrument } from "../../../market-data/forexconnect/types.js";

const MAX_LIFECYCLE_RECORDS = 200;
const UNCERTAIN_STATES: DemoLifecycleState[] = [
  "SUBMITTING",
  "SUBMISSION_UNKNOWN",
  "RECONCILIATION_REQUIRED",
  "ACCEPTED_PENDING",
  "PROTECTION_PENDING",
  "CLOSE_PENDING",
  "CANCEL_PENDING",
];
const SUCCESS_OPEN_STATES: DemoLifecycleState[] = ["POSITION_OPEN", "FILLED", "PROTECTED"];

function storePath(): string {
  const primary = join(resolveStorageRoot(), "forex", "demo-lifecycle-records.json");
  const legacy = join(process.cwd(), "data", "forex", "demo-lifecycle-records.json");
  if (!existsSync(primary) && existsSync(legacy)) {
    try {
      mkdirSync(dirname(primary), { recursive: true });
      copyFileSync(legacy, primary);
    } catch {
      /* keep primary */
    }
  }
  return primary;
}

function prioritizeLifecycleRecords(records: DemoLifecycleRecord[]): DemoLifecycleRecord[] {
  // Prefer uncertain/open records so truncation cannot drop duplicate-order protection.
  const rank = (r: DemoLifecycleRecord): number => {
    if (UNCERTAIN_STATES.includes(r.state)) return 0;
    if (SUCCESS_OPEN_STATES.includes(r.state) || r.fillConfirmed) return 1;
    if (r.state === "PROTECTION_FAILED") return 2;
    return 3;
  };
  return [...records]
    .sort((a, b) => {
      const d = rank(a) - rank(b);
      if (d !== 0) return d;
      return String(b.updatedAtUtc).localeCompare(String(a.updatedAtUtc));
    })
    .slice(0, MAX_LIFECYCLE_RECORDS);
}

function nowIso(): string {
  return new Date().toISOString();
}

function selectDemoRiskAccount(
  accounts: ForexConnectAccountRow[],
  requestedAccountId: string | null | undefined,
  fetchedAtUtc: string | null,
): DemoOpenMarketAccountSnapshot | null {
  if (!Array.isArray(accounts) || accounts.length === 0) return null;
  const want = String(requestedAccountId ?? "").trim();
  const row = want
    ? accounts.find((a) => a.accountId === want) ?? null
    : accounts.length === 1
      ? accounts[0]!
      : accounts[0]!;
  if (!row) return null;
  return {
    accountId: row.accountId,
    accountIdMasked: row.accountIdMasked ?? null,
    environment: row.environment,
    accountCurrency: row.accountCurrency,
    equity: row.equity,
    usableMargin: row.usableMargin,
    balance: row.balance,
    usedMargin: row.usedMargin,
    missingFields: row.missingFields,
    fetchedAtUtc,
    equityIncludesFloatingPl: row.equityIncludesFloatingPl,
  };
}

function selectDemoRiskInstrumentSpecs(
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
  /** True when store load quarantined corrupt JSON — block new broker mutations until recovered. */
  private persistenceDegraded = false;
  private persistenceError: string | null = null;
  private readonly inflightIdempotency = new Set<string>();

  constructor() {
    this.load();
  }

  private load(): void {
    const loaded = readJsonSafeSync<{ schemaVersion?: string; records?: DemoLifecycleRecord[] }>(
      storePath(),
      { schemaVersion: "demo-lifecycle-v3", records: [] },
    );
    if (loaded.recovered) {
      // Fail closed: corrupt store must not silently erase idempotency protection for new submits.
      this.persistenceDegraded = true;
      this.persistenceError = loaded.error
        ? `Lifecycle store recovered from corrupt file: ${loaded.error}`
        : "Lifecycle store recovered from corrupt/unreadable file.";
      this.records = [];
      return;
    }
    this.persistenceDegraded = false;
    this.persistenceError = null;
    const raw = loaded.value;
    this.records = Array.isArray(raw.records)
      ? raw.records
        .filter((r) => r && typeof r.lifecycleId === "string" && typeof r.idempotencyKey === "string")
        .map((r) => emptyRecord({
          ...r,
          lifecycleId: r.lifecycleId,
          idempotencyKey: r.idempotencyKey,
        }))
      : [];
  }

  private save(): void {
    const records = prioritizeLifecycleRecords(this.records);
    this.records = records;
    writeJsonAtomicSync(storePath(), {
      schemaVersion: "demo-lifecycle-v4",
      records,
      persistenceDegraded: this.persistenceDegraded,
      updatedAtUtc: nowIso(),
    });
    // A successful atomic write clears prior degradation after operator-driven recovery path
    // that restored a valid file and constructed a fresh orchestrator; keep flag if set mid-process.
  }

  private upsert(rec: DemoLifecycleRecord): DemoLifecycleRecord {
    rec.updatedAtUtc = nowIso();
    const idx = this.records.findIndex((r) => r.lifecycleId === rec.lifecycleId);
    if (idx >= 0) this.records[idx] = rec;
    else this.records.unshift(rec);
    this.save();
    return rec;
  }

  private rejectPersistenceDegraded(req: {
    idempotencyKey: string;
    grantId?: string;
    instrument?: string | null;
  }): {
    ok: false;
    code: "PERSISTENCE_DEGRADED";
    error: string;
    record: DemoLifecycleRecord;
  } {
    const record = emptyRecord({
      lifecycleId: randomUUID(),
      state: "EXECUTION_DISABLED",
      grantId: req.grantId ?? null,
      idempotencyKey: req.idempotencyKey,
      instrument: req.instrument ?? null,
      lastCode: "PERSISTENCE_DEGRADED",
      lastError: this.persistenceError
        ?? "DEMO lifecycle persistence is degraded; refusing broker mutation to protect idempotency.",
    });
    return {
      ok: false,
      code: "PERSISTENCE_DEGRADED",
      error: record.lastError ?? "PERSISTENCE_DEGRADED",
      record,
    };
  }

  private replayIdempotent(
    existing: DemoLifecycleRecord,
  ): {
    ok: boolean;
    code: string;
    error: string | null;
    record: DemoLifecycleRecord;
  } {
    if (UNCERTAIN_STATES.includes(existing.state)) {
      return {
        ok: false,
        code: "IDEMPOTENT_RECONCILIATION_REQUIRED",
        error:
          `Prior submission for this idempotencyKey is unresolved (state=${existing.state}). `
          + "Reconcile broker state before retrying; do not resubmit blindly.",
        record: existing,
      };
    }
    const ok = SUCCESS_OPEN_STATES.includes(existing.state) || existing.fillConfirmed;
    return {
      ok,
      code: ok ? "IDEMPOTENT_REPLAY" : (existing.lastCode ?? "IDEMPOTENT_REPLAY"),
      error: ok ? null : (existing.lastError ?? existing.lastCode),
      record: existing,
    };
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
      autoDemoGrantLifecycle: getAutoDemoGrantLifecycleWorker().getStatus(),
      persistenceDegraded: this.persistenceDegraded,
      persistenceError: this.persistenceError,
      lifecycleRecordCount: this.records.length,
      note:
        "DEMO lifecycle: grant + quote preflight + sidecar mutation flag/secret. Supports open/protect/cancel-pending/partial-close. LIVE locked. Auto grant mode defaults to off. Corrupt lifecycle store fails closed (PERSISTENCE_DEGRADED).",
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
    const nodeFp = nodeMutationSecretFingerprint();
    const sideFpRaw = (caps as { mutationSecretFingerprint?: string | null }).mutationSecretFingerprint;
    const sideFp = sideFpRaw != null && String(sideFpRaw).trim()
      ? String(sideFpRaw).trim().toLowerCase()
      : null;
    // true = proven match; false = proven mismatch; null = unknown (missing or pre-fingerprint sidecar).
    let mutationSecretsConsistent: boolean | null = null;
    if (nodeFp && sideFp) {
      mutationSecretsConsistent = nodeFp === sideFp;
    }

    const sdkOk = Boolean((caps as { hasCreateOrderRequest?: boolean }).hasCreateOrderRequest)
      && Boolean((caps as { trueMarketOpen?: unknown }).trueMarketOpen != null
        || (caps as { ordersConstants?: string[] }).ordersConstants?.includes?.("TRUE_MARKET_OPEN"));
    const protectiveSurface = Boolean(
      (caps as { supportsAttachedRateStopLimit?: boolean }).supportsAttachedRateStopLimit
      || (caps as { supportsPostFillStopLimitTradeId?: boolean }).supportsPostFillStopLimitTradeId
      || (caps as { stopOrder?: unknown }).stopOrder != null
      || (caps as { ordersConstants?: string[] }).ordersConstants?.includes?.("STOP"),
    );
    // Cancel is DELETE_ORDER — do not treat STOP as cancel capability.
    const cancelSurface = Boolean((caps as { supportsDeleteOrder?: boolean }).supportsDeleteOrder);
    const closeSurface = Boolean(
      (caps as { trueMarketClose?: unknown }).trueMarketClose != null
      || (caps as { supportsPartialClose?: boolean }).supportsPartialClose
      || (caps as { ordersConstants?: string[] }).ordersConstants?.includes?.("TRUE_MARKET_CLOSE"),
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
    if (mutationSecretsConsistent === false && nodeMutationSecretConfigured && sidecarMutationSecretConfigured) {
      blockers.push("MUTATION_SECRET_MISMATCH");
    }
    if (!sdkOk) blockers.push("SDK_MUTATION_SURFACE_UNVERIFIED");
    if (!protectiveSurface) blockers.push("SDK_PROTECTIVE_SURFACE_UNVERIFIED");
    if (!cancelSurface) blockers.push("SDK_CANCEL_SURFACE_UNVERIFIED");
    if (!closeSurface) blockers.push("SDK_CLOSE_SURFACE_UNVERIFIED");
    for (const code of grantCoverage.blockers) {
      if (!blockers.includes(code)) blockers.push(code);
    }

    const ownerActionChecklist: string[] = [];
    if (!sidecarMutationEnv || !nodeMutationEnv) {
      ownerActionChecklist.push(
        "Set KWIZERA_FOREXCONNECT_ALLOW_DEMO_MUTATION=1 on both Node app and ForexConnect sidecar, then restart those processes only if authorized.",
      );
    }
    if (!secretOk || mutationSecretsConsistent === false) {
      ownerActionChecklist.push(
        "Set identical KWIZERA_FOREXCONNECT_DEMO_MUTATION_SECRET on Node + sidecar (never in browser/git). Presence on both sides is not enough — values must match.",
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
    // Prefer readiness ?instrument= over AT configured instrument when provided.
    let quoteSubscriptionReadiness: Record<string, unknown> | null = null;
    let quoteReady = false;
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
      const optsInstrument = opts?.instrument != null ? String(opts.instrument).trim() : "";
      const requested = optsInstrument || configured.instruments[0]?.symbol || null;

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
        configuredInstrumentCount: Math.max(
          configured.instruments.length,
          requested ? 1 : 0,
        ),
        intendedCount: Math.max(life.intendedCount, requested ? 1 : 0),
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
      quoteReady = Boolean(readinessEval.readyForExecutionQuote);
      quoteSubscriptionReadiness = {
        ...readinessEval,
        configuredInstruments: configured.instruments,
        readinessInstrument: requested,
      };
      if (!readinessEval.readyForExecutionQuote) {
        blockers.push(readinessEval.code);
        ownerActionChecklist.push(
          requested
            ? `Ensure Offers subscription and a fresh bid/ask for ${requested} (CONNECTED alone is not quote-ready).`
            : "Ensure an AT selectedInstrument (or pass ?instrument=) then restore/subscribe Offers until a fresh bid/ask is observed.",
        );
      }
    } catch {
      quoteSubscriptionReadiness = {
        code: "SUBSCRIPTION_FAILED",
        readyForExecutionQuote: false,
        message: "Quote subscription readiness diagnostics unavailable.",
      };
      blockers.push("SUBSCRIPTION_FAILED");
      quoteReady = false;
    }

    const componentReport = buildDemoReadinessComponents({
      blockers,
      connected,
      demoSession: demoOk,
      nodeMutationEnvEnabled: nodeMutationEnv,
      sidecarMutationEnvEnabled: sidecarMutationEnv,
      nodeMutationSecretConfigured,
      sidecarMutationSecretConfigured,
      mutationSecretsConsistent,
      grantCoverageOk: grantCoverage.ok,
      quoteReady,
      sdkMutationOk: sdkOk,
      sdkProtectiveOk: protectiveSurface,
      sdkCancelOk: cancelSurface,
      sdkCloseOk: closeSurface,
    });

    const blockerCategories = groupDemoReadinessBlockers(blockers);
    const primaryBlocker = primaryDemoReadinessBlocker(blockers);

    // Strip fingerprint from capabilities echoed to clients (boolean consistency only).
    const capsSafe = { ...(caps as Record<string, unknown>) };
    delete capsSafe.mutationSecretFingerprint;

    return {
      ok: blockers.length === 0 && componentReport.mayAttemptDemoMutation,
      phase: "59.0.12I",
      connected,
      environment: env || null,
      demoSession: demoOk,
      mutationEnvEnabled: mutationEnv,
      sidecarMutationEnvEnabled: sidecarMutationEnv,
      nodeMutationEnvEnabled: nodeMutationEnv,
      mutationSecretConfigured: secretOk,
      sidecarMutationSecretConfigured,
      nodeMutationSecretConfigured,
      mutationSecretsConsistent,
      protectiveSurfaceDocumented: protectiveSurface,
      cancelSurfaceDocumented: cancelSurface,
      closeSurfaceDocumented: closeSurface,
      partialCloseDocumented: Boolean((caps as { supportsPartialClose?: boolean }).supportsPartialClose),
      sdkCapabilities: capsSafe,
      activeGrantCount: activeGrants.length,
      grantCoverage,
      grantStorePath: resolveDemoExecutionGrantsPath(),
      quoteSubscriptionReadiness,
      components: componentReport.components,
      blockers,
      blockerCategories,
      primaryBlocker: blockers.length ? primaryBlocker : null,
      ownerActionChecklist,
      mayAttemptDemoMutation: componentReport.mayAttemptDemoMutation,
      mayAttemptDemoCancel: componentReport.mayAttemptDemoCancel,
      mayAttemptDemoClose: componentReport.mayAttemptDemoClose,
      placesOrdersGlobal: false,
      liveLocked: true,
      autoDemoGrantLifecycle: getAutoDemoGrantLifecycleWorker().getStatus(),
      note:
        "Unauthenticated 403 on this route is correct. CONNECTED or live quotes alone never authorize mutation. components[] scores connection / marketData / mutationConfig / secret / grant / orderSubmission / modificationCancellation / positionCloseMonitor separately. Secrets are presence + consistency booleans only — never values. Auto grant mode defaults to off and never places orders.",
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
    if (this.persistenceDegraded) {
      return this.rejectPersistenceDegraded(req);
    }

    const existing = this.records.find((r) => r.idempotencyKey === req.idempotencyKey);
    if (existing) {
      return this.replayIdempotent(existing);
    }

    if (!req.idempotencyKey || !String(req.idempotencyKey).trim()) {
      const record = emptyRecord({
        lifecycleId: randomUUID(),
        state: "VALIDATION_FAILED",
        grantId: req.grantId,
        idempotencyKey: "missing",
        instrument: req.instrument,
        lastCode: "IDEMPOTENCY_KEY_REQUIRED",
        lastError: "idempotencyKey is required for DEMO open-market submissions.",
      });
      return { ok: false, code: "IDEMPOTENCY_KEY_REQUIRED", error: record.lastError, record };
    }

    if (this.inflightIdempotency.has(req.idempotencyKey)) {
      const record = emptyRecord({
        lifecycleId: randomUUID(),
        state: "RECONCILIATION_REQUIRED",
        grantId: req.grantId,
        idempotencyKey: req.idempotencyKey,
        instrument: req.instrument,
        lastCode: "IDEMPOTENCY_IN_FLIGHT",
        lastError: "A submission with this idempotencyKey is already in flight.",
      });
      return { ok: false, code: "IDEMPOTENCY_IN_FLIGHT", error: record.lastError, record };
    }

    this.inflightIdempotency.add(req.idempotencyKey);
    try {
      return await this.openMarketLocked(req);
    } finally {
      this.inflightIdempotency.delete(req.idempotencyKey);
    }
  }

  private async openMarketLocked(req: DemoOpenMarketRequest): Promise<{
    ok: boolean;
    code: string;
    error: string | null;
    record: DemoLifecycleRecord;
  }> {
    const existing = this.records.find((r) => r.idempotencyKey === req.idempotencyKey);
    if (existing) {
      return this.replayIdempotent(existing);
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

    // Phase 3.5 — fail-closed equity / margin / max-loss / exposure before any broker mutation.
    const bridge = getForexConnectBridge();
    const accountsResult = await bridge.listAccounts();
    const instrumentsResult = await bridge.listInstruments();
    const tradesResult = await bridge.listTrades();
    const accountSnap = selectDemoRiskAccount(
      accountsResult.ok ? accountsResult.accounts : [],
      req.accountId,
      accountsResult.fetchedAt ?? null,
    );
    const specs = selectDemoRiskInstrumentSpecs(
      instrumentsResult.ok ? instrumentsResult.instruments : [],
      req.instrument,
    );
    const openExposureLots = sumOpenExposureLotsFromTradesPayload(
      tradesResult as Record<string, unknown>,
      {
        instrument: req.instrument,
        baseUnitSize: specs?.baseUnitSize ?? null,
        scope: "instrument",
      },
    );
    const openPositionCount = countOpenPositionsFromTradesPayload(
      tradesResult as Record<string, unknown>,
      {
        instrument: req.instrument,
        scope: "instrument",
      },
    );
    const entryPrice =
      req.entryHint != null && Number.isFinite(req.entryHint)
        ? Number(req.entryHint)
        : preflight.entryHintUsed;
    const hasUnresolvedUnprotectedFill = this.records.some((r) => blocksAdditionalDemoEntries(r));
    const riskLimitsLoad = loadDemoOpenMarketRiskLimitsDetailed();
    // Day PnL / day-start equity / loss-cooldown telemetry are not yet authoritative
    // on this path. When those optional limits are unset (defaults), evaluation proceeds.
    // When env enables them without telemetry, risk fails closed (by design).
    const risk = evaluateDemoOpenMarketRisk({
      instrument: req.instrument,
      direction: req.direction,
      lots: req.lots,
      stopLoss: req.stopLoss ?? null,
      takeProfit: req.takeProfit ?? null,
      entryPrice,
      requireProtective: req.requireProtective === true,
      grantMaxLots: grantCheck.grant.maxLots,
      requestedAccountId: req.accountId ?? null,
      account: accountSnap,
      accountFetchOk: Boolean(accountsResult.ok),
      accountCount: Array.isArray(accountsResult.accounts) ? accountsResult.accounts.length : 0,
      instrumentSpecs: specs,
      openExposureLots,
      openPositionCount,
      tradesFetchOk: Boolean((tradesResult as { ok?: boolean }).ok),
      hasUnresolvedUnprotectedFill,
      quoteTimestamp: (quoteRaw.offerTime as string | number | null | undefined) ?? null,
      quoteMaxAgeMs: MARKET_QUOTE_STALE_MS,
      dayRealizedPnlAccount: null,
      dayStartEquity: null,
      cooldownUntilMs: riskLimitsLoad.limits.cooldownAfterLossMs > 0 ? null : 0,
      limits: riskLimitsLoad.limits,
      limitsConfigInvalid: riskLimitsLoad.configInvalid,
      limitsInvalidKeys: riskLimitsLoad.invalidKeys,
      nowMs: Date.now(),
    });
    base.evidence = {
      ...base.evidence,
      openMarketRisk: {
        ok: risk.ok,
        code: risk.code,
        blockers: risk.blockers,
        details: risk.details,
        accountIdMasked: accountSnap?.accountIdMasked ?? null,
        accountsFetchedAt: accountsResult.fetchedAt ?? null,
        instrumentsOk: Boolean(instrumentsResult.ok),
        tradesOk: Boolean((tradesResult as { ok?: boolean }).ok),
      },
    };
    if (!risk.maySubmitDemoMutation) {
      base.state = "VALIDATION_FAILED";
      base.lastCode = risk.code;
      base.lastError = `DEMO open-market risk blocked: ${risk.blockers.join(",")}`;
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
    let fillAssessment: ReturnType<typeof assessOpenFillAmount> | null = null;
    if (trade && trade.tradeId) {
      base.tradeId = String(trade.tradeId);
      base.fillConfirmed = true;
      base.state = "POSITION_OPEN";
      if (trade.amount != null) base.remainingAmount = Number(trade.amount);
      fillAssessment = assessOpenFillAmount({
        requestedLots: req.lots,
        baseUnitSize: specs?.baseUnitSize ?? null,
        filledAmount: trade.amount == null ? null : Number(trade.amount),
      });
      base.evidence = { ...base.evidence, fillAssessment };
      if (!fillAssessment.ok) {
        // Fail closed: do not invent a successful full-fill state for partial/unknown amounts.
        // Streaming multi-partial fills are not supported by this orchestrator.
        base.state = "RECONCILIATION_REQUIRED";
        base.lastCode = fillAssessment.code;
        base.lastError = fillAssessment.message;
      }
    } else {
      base.fillConfirmed = false;
      base.state = "ACCEPTED_PENDING";
      base.lastCode = result.code || "ACCEPTED_PENDING_UNCONFIRMED";
      base.lastError =
        "Broker open returned without a confirmed tradeId/fill. "
        + "Do not treat as a filled position; reconcile before retrying.";
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
      const criticalAlert = unprotectedPolicy.raiseCriticalAlert
        ? await emitCriticalAlert({
          code: unprotectedPolicy.code,
          message: unprotectedPolicy.message,
          lifecycleId: base.lifecycleId,
          tradeId: base.tradeId,
          instrument: req.instrument,
          dedupeKey: `unprotected:${base.tradeId || base.lifecycleId}`,
          evidence: { state: base.state, brokerProtected, fillAssessment },
        })
        : null;
      base.evidence = {
        ...base.evidence,
        unprotectedFillPolicy: unprotectedPolicy,
        blockAdditionalEntries: unprotectedPolicy.blockAdditionalEntries,
        raiseCriticalAlert: unprotectedPolicy.raiseCriticalAlert,
        criticalAlert,
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

    // Preserve fill-amount fail-closed state; do not overwrite with PROTECTED/POSITION_OPEN.
    if (fillAssessment && !fillAssessment.ok) {
      base.state = "RECONCILIATION_REQUIRED";
      base.lastCode = fillAssessment.code;
      base.lastError = fillAssessment.message;
      const criticalAlert = await emitCriticalAlert({
        code: fillAssessment.code,
        message: fillAssessment.message,
        lifecycleId: base.lifecycleId,
        tradeId: base.tradeId,
        instrument: req.instrument,
        dedupeKey: `fill-mismatch:${base.tradeId || base.lifecycleId}`,
        evidence: { fillAssessment, brokerProtected },
      });
      base.evidence = { ...base.evidence, criticalAlert };
      this.upsert(base);
      return {
        ok: false,
        code: fillAssessment.code,
        error: fillAssessment.message,
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
    // Unconfirmed fills must not be reported as successful opens (idempotency still blocks resubmit).
    if (!base.fillConfirmed || base.state === "ACCEPTED_PENDING") {
      return {
        ok: false,
        code: base.lastCode ?? "ACCEPTED_PENDING_UNCONFIRMED",
        error: base.lastError
          ?? "Open remains unconfirmed; reconcile broker state before treating as success.",
        record: base,
      };
    }
    return { ok: true, code: result.code, error: null, record: base };
  }

  async closeTrade(req: DemoCloseTradeRequest): Promise<{
    ok: boolean;
    code: string;
    error: string | null;
    record: DemoLifecycleRecord;
  }> {
    if (this.persistenceDegraded) {
      return this.rejectPersistenceDegraded(req);
    }

    const existing = this.records.find((r) => r.idempotencyKey === req.idempotencyKey);
    if (existing && existing.closeConfirmed && existing.state === "CLOSED") {
      return { ok: true, code: "IDEMPOTENT_REPLAY", error: null, record: existing };
    }
    if (existing && UNCERTAIN_STATES.includes(existing.state) && existing.state !== "CLOSE_PENDING") {
      return {
        ok: false,
        code: "IDEMPOTENT_RECONCILIATION_REQUIRED",
        error: `Prior operation unresolved (state=${existing.state}). Reconcile before retry.`,
        record: existing,
      };
    }

    const grantCheck = getDemoExecutionGrantStore().requireActive(
      req.grantId,
      req.instrument ?? undefined,
    );
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
    // Close must require close-surface readiness, not open+protective submission gates.
    if (!ready.mayAttemptDemoClose) {
      const primary = primaryDemoReadinessBlocker(ready.blockers);
      rec.state = "MUTATION_DISABLED";
      rec.lastCode = primary;
      rec.lastError = `DEMO close readiness failed: ${(ready.blockers as string[]).join(",")}`;
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
    if (this.persistenceDegraded) {
      return this.rejectPersistenceDegraded(req);
    }

    const existing = this.records.find((r) => r.idempotencyKey === req.idempotencyKey);
    if (existing && existing.cancelConfirmed) {
      return { ok: true, code: "IDEMPOTENT_REPLAY", error: null, record: existing };
    }
    if (existing && UNCERTAIN_STATES.includes(existing.state) && existing.state !== "CANCEL_PENDING") {
      return {
        ok: false,
        code: "IDEMPOTENT_RECONCILIATION_REQUIRED",
        error: `Prior operation unresolved (state=${existing.state}). Reconcile before retry.`,
        record: existing,
      };
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
    // Cancel must require cancel-surface readiness, not open+protective submission gates.
    if (!ready.mayAttemptDemoCancel) {
      const primary = primaryDemoReadinessBlocker(ready.blockers);
      rec.state = "MUTATION_DISABLED";
      rec.lastCode = primary;
      rec.lastError = `DEMO cancel readiness failed: ${(ready.blockers as string[]).join(",")}`;
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
