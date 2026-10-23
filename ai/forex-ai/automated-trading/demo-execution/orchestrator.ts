/**
 * Phase 58.1 — DEMO lifecycle orchestrator.
 * Integrates grant checks + ForexConnect DEMO mutation adapter.
 * Does not enable global Master Trading, placesOrders, or automatic entry.
 */
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getForexConnectBridge } from "../../../market-data/forexconnect/client.js";
import { getDemoExecutionGrantStore } from "./grant-store.js";
import { getForexConnectDemoMutationAdapter } from "./forexconnect-mutation-adapter.js";
import type {
  DemoCloseTradeRequest,
  DemoLifecycleRecord,
  DemoLifecycleState,
  DemoOpenMarketRequest,
} from "./types.js";

function storePath(): string {
  return join(process.cwd(), "data", "forex", "demo-lifecycle-records.json");
}

function nowIso(): string {
  return new Date().toISOString();
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
      this.records = Array.isArray(raw.records) ? raw.records : [];
    } catch {
      this.records = [];
    }
  }

  private save(): void {
    mkdirSync(dirname(storePath()), { recursive: true });
    writeFileSync(
      storePath(),
      JSON.stringify({ schemaVersion: "demo-lifecycle-v1", records: this.records.slice(0, 100) }, null, 2),
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
      phase: "58.1",
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
        "DEMO lifecycle mutations require active grant + sidecar KWIZERA_FOREXCONNECT_ALLOW_DEMO_MUTATION=1 + secret. LIVE remains locked.",
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
    const mutationEnv = Boolean((caps as { mutationEnvEnabled?: boolean }).mutationEnvEnabled);
    const secretOk = Boolean((caps as { mutationSecretConfigured?: boolean }).mutationSecretConfigured);
    const sdkOk = Boolean((caps as { hasCreateOrderRequest?: boolean }).hasCreateOrderRequest)
      && Boolean((caps as { trueMarketOpen?: unknown }).trueMarketOpen != null
        || (caps as { ordersConstants?: string[] }).ordersConstants?.includes?.("TRUE_MARKET_OPEN"));

    const blockers: string[] = [];
    if (!connected) blockers.push("SESSION_NOT_CONNECTED");
    if (!demoOk) blockers.push("ENVIRONMENT_NOT_DEMO");
    if (!mutationEnv) blockers.push("SIDECAR_MUTATION_ENV_DISABLED");
    if (!secretOk) blockers.push("MUTATION_SECRET_NOT_CONFIGURED");
    if (!sdkOk) blockers.push("SDK_MUTATION_SURFACE_UNVERIFIED");
    if (getDemoExecutionGrantStore().listActive().length === 0) blockers.push("NO_ACTIVE_DEMO_GRANT");

    return {
      ok: blockers.length === 0,
      connected,
      environment: env || null,
      demoSession: demoOk,
      mutationEnvEnabled: mutationEnv,
      mutationSecretConfigured: secretOk,
      sdkCapabilities: caps,
      activeGrantCount: getDemoExecutionGrantStore().listActive().length,
      blockers,
      mayAttemptDemoMutation: blockers.length === 0,
      placesOrdersGlobal: false,
      liveLocked: true,
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
      return { ok: existing.state === "POSITION_OPEN" || existing.state === "FILLED", code: "IDEMPOTENT_REPLAY", error: null, record: existing };
    }

    const grantCheck = getDemoExecutionGrantStore().requireActive(
      req.grantId,
      req.instrument,
      req.lots,
    );
    const base: DemoLifecycleRecord = {
      lifecycleId: randomUUID(),
      state: "IDLE",
      grantId: req.grantId,
      intentId: randomUUID(),
      idempotencyKey: req.idempotencyKey,
      instrument: req.instrument,
      direction: req.direction,
      lots: req.lots,
      brokerOrderId: null,
      tradeId: null,
      closeOrderId: null,
      fillConfirmed: false,
      closeConfirmed: false,
      protectionStatus: req.requireProtective ? "UNSUPPORTED" : "NOT_REQUESTED",
      lastError: null,
      lastCode: null,
      mutatesBroker: false,
      placesOrdersGlobal: false,
      acceptsForExecutionGlobal: false,
      createdAtUtc: nowIso(),
      updatedAtUtc: nowIso(),
      evidence: {},
    };

    if (!grantCheck.ok) {
      base.state = "AUTHORIZATION_REJECTED";
      base.lastCode = grantCheck.code;
      base.lastError = grantCheck.error;
      this.upsert(base);
      return { ok: false, code: grantCheck.code, error: grantCheck.error, record: base };
    }

    if (req.requireProtective) {
      // Phase 58.1: broker-attached SL/TP post-fill not yet verified in this adapter.
      // Fail closed when policy requires protection.
      base.state = "PROTECTION_UNSUPPORTED";
      base.lastCode = "PROTECTION_REQUIRED_BUT_UNVERIFIED";
      base.lastError =
        "requireProtective=true but broker-attached SL/TP attach is not yet verified for this adapter. Refusing DEMO open.";
      this.upsert(base);
      return { ok: false, code: base.lastCode, error: base.lastError, record: base };
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

    base.state = "SUBMITTING";
    this.upsert(base);

    const result = await getForexConnectDemoMutationAdapter().openTrueMarket({
      instrument: req.instrument,
      direction: req.direction,
      lots: req.lots,
      accountId: req.accountId,
    });

    base.mutatesBroker = result.mutatesBroker;
    base.brokerOrderId = result.brokerOrderId ?? null;
    base.lastCode = result.code;
    base.lastError = result.error ?? null;
    base.evidence = { open: result.raw };
    base.updatedAtUtc = nowIso();

    if (!result.ok) {
      base.state = result.code.includes("TIMEOUT") || result.code.includes("UNKNOWN")
        ? "SUBMISSION_UNKNOWN"
        : "BROKER_REJECTED";
      if (result.brokerOrderId) base.state = "RECONCILIATION_REQUIRED";
      this.upsert(base);
      return { ok: false, code: result.code, error: result.error ?? result.code, record: base };
    }

    const trade = result.trade;
    if (trade && trade.tradeId) {
      base.tradeId = String(trade.tradeId);
      base.fillConfirmed = true;
      base.state = "POSITION_OPEN";
    } else {
      base.fillConfirmed = false;
      base.state = "ACCEPTED_PENDING";
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
    if (existing && existing.closeConfirmed) {
      return { ok: true, code: "IDEMPOTENT_REPLAY", error: null, record: existing };
    }

    const grantCheck = getDemoExecutionGrantStore().requireActive(req.grantId);
    const rec = existing ?? {
      lifecycleId: randomUUID(),
      state: "CLOSE_PENDING" as DemoLifecycleState,
      grantId: req.grantId,
      intentId: randomUUID(),
      idempotencyKey: req.idempotencyKey,
      instrument: req.instrument ?? null,
      direction: null,
      lots: null,
      brokerOrderId: null,
      tradeId: req.tradeId,
      closeOrderId: null,
      fillConfirmed: false,
      closeConfirmed: false,
      protectionStatus: "NOT_REQUESTED" as const,
      lastError: null,
      lastCode: null,
      mutatesBroker: false,
      placesOrdersGlobal: false as const,
      acceptsForExecutionGlobal: false as const,
      createdAtUtc: nowIso(),
      updatedAtUtc: nowIso(),
      evidence: {},
    };

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
    });

    rec.mutatesBroker = result.mutatesBroker;
    rec.closeOrderId = result.brokerOrderId ?? null;
    rec.lastCode = result.code;
    rec.lastError = result.error ?? null;
    rec.evidence = { ...rec.evidence, close: result.raw };
    rec.updatedAtUtc = nowIso();

    if (!result.ok) {
      rec.state = result.brokerOrderId ? "RECONCILIATION_REQUIRED" : "BROKER_REJECTED";
      this.upsert(rec);
      return { ok: false, code: result.code, error: result.error ?? result.code, record: rec };
    }

    rec.closeConfirmed = Boolean(result.closeConfirmed);
    rec.state = result.closeConfirmed ? "CLOSED" : "RECONCILIATION_REQUIRED";
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
