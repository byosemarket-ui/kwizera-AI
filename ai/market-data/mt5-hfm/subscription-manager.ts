/**
 * STEP 2B — HFM subscription lifecycle manager.
 * Does not auto-activate the full catalog. Defaults preserve the nine-symbol set.
 */
import { createHash } from "node:crypto";
import { getHfmCatalogService } from "./catalog-service.js";
import { HFM_DEFAULT_QUOTE_SYMBOLS } from "./quote-types.js";
import {
  HFM_PRIORITY_WEIGHT,
  HFM_SUB_ENVIRONMENT,
  HFM_SUB_PROVIDER,
  HFM_SUBSCRIPTION_DEFAULTS,
  HFM_SUBSCRIPTION_TRANSITIONS,
  type HfmSubscriptionCapacity,
  type HfmSubscriptionConfig,
  type HfmSubscriptionPriority,
  type HfmSubscriptionRecord,
  type HfmSubscriptionStatus,
} from "./subscription-types.js";
import { HfmSubscriptionStore } from "./subscription-store.js";

export type HfmSubscriptionEventType =
  | "subscription.created"
  | "subscription.activated"
  | "subscription.paused"
  | "subscription.resumed"
  | "subscription.removed"
  | "subscription.failed"
  | "subscription.recovering"
  | "subscription.priority_changed";

export interface HfmSubscriptionEvent {
  type: HfmSubscriptionEventType;
  provider: typeof HFM_SUB_PROVIDER;
  environment: typeof HFM_SUB_ENVIRONMENT;
  symbol: string;
  subscriptionId: string;
  previousStatus: HfmSubscriptionStatus | null;
  newStatus: HfmSubscriptionStatus;
  reason: string | null;
  timestamp: string;
}

type EventListener = (ev: HfmSubscriptionEvent) => void;

function defaultConfig(): HfmSubscriptionConfig {
  return {
    acquisitionIntervalMs: null,
    freshnessThresholdMs: null,
    allowEngineSelect: true,
  };
}

function canTransition(from: HfmSubscriptionStatus, to: HfmSubscriptionStatus): boolean {
  if (from === to) return true;
  return HFM_SUBSCRIPTION_TRANSITIONS[from].includes(to);
}

function priorityFromWeight(weight: number): HfmSubscriptionPriority {
  if (weight >= HFM_PRIORITY_WEIGHT.CRITICAL) return "CRITICAL";
  if (weight >= HFM_PRIORITY_WEIGHT.HIGH) return "HIGH";
  if (weight >= HFM_PRIORITY_WEIGHT.NORMAL) return "NORMAL";
  return "LOW";
}

function normalizePriority(
  input: HfmSubscriptionPriority | number | undefined,
): { priority: HfmSubscriptionPriority; weight: number } {
  if (typeof input === "number" && Number.isFinite(input)) {
    const weight = Math.max(1, Math.min(10_000, Math.floor(input)));
    return { priority: priorityFromWeight(weight), weight };
  }
  const priority = (input as HfmSubscriptionPriority | undefined) ?? "NORMAL";
  if (!(priority in HFM_PRIORITY_WEIGHT)) {
    return { priority: "NORMAL", weight: HFM_PRIORITY_WEIGHT.NORMAL };
  }
  return { priority, weight: HFM_PRIORITY_WEIGHT[priority] };
}

export class HfmSubscriptionManager {
  private readonly bySymbol = new Map<string, HfmSubscriptionRecord>();
  private readonly listeners = new Set<EventListener>();
  private readonly store: HfmSubscriptionStore;
  private readonly maxActive: number;
  private readonly maxPendingOps: number;
  private pendingOps = 0;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private loaded = false;

  constructor(opts?: { maxActive?: number; seedDefaults?: boolean; store?: HfmSubscriptionStore }) {
    this.maxActive = Math.min(
      HFM_SUBSCRIPTION_DEFAULTS.maxActive,
      Math.max(1, opts?.maxActive ?? HFM_SUBSCRIPTION_DEFAULTS.defaultActiveCap),
    );
    this.maxPendingOps = HFM_SUBSCRIPTION_DEFAULTS.maxPendingOps;
    this.store = opts?.store ?? new HfmSubscriptionStore();
    if (opts?.seedDefaults !== false) {
      for (const [i, symbol] of HFM_DEFAULT_QUOTE_SYMBOLS.entries()) {
        const now = new Date().toISOString();
        const weight = 1000 - i;
        this.bySymbol.set(symbol, {
          subscriptionId: this.idFor(symbol),
          provider: HFM_SUB_PROVIDER,
          environment: HFM_SUB_ENVIRONMENT,
          symbol,
          status: "ACTIVE",
          priority: priorityFromWeight(weight),
          priorityWeight: weight,
          requestedBy: "default",
          createdAt: now,
          updatedAt: now,
          lastAcquiredAt: null,
          lastValidQuoteAt: null,
          lastError: null,
          subscriptionConfig: defaultConfig(),
          engineSelected: false,
          previousStatus: null,
          statusReason: "DEFAULT_SEED",
          delayedForCapacity: false,
        });
      }
    }
  }

  onEvent(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(ev: HfmSubscriptionEvent): void {
    for (const l of this.listeners) {
      try {
        l(ev);
      } catch {
        /* isolate listener failures */
      }
    }
  }

  private idFor(symbol: string): string {
    const h = createHash("sha1").update(`HFM_MT5:demo:${symbol}`).digest("hex").slice(0, 12);
    return `hfm-sub-${h}`;
  }

  private schedulePersist(): void {
    if (this.persistTimer) return;
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      void this.persist();
    }, 250);
    if (typeof this.persistTimer === "object" && "unref" in this.persistTimer) {
      (this.persistTimer as NodeJS.Timeout).unref();
    }
  }

  async persist(recovery: import("./subscription-types.js").HfmRecoveryState | null = null): Promise<void> {
    const lkg: import("./subscription-store.js").HfmPersistedLkgRef[] = [];
    // LKG quotes are persisted by the orchestrator; subscription rows only here.
    await this.store.save({
      provider: HFM_SUB_PROVIDER,
      environment: HFM_SUB_ENVIRONMENT,
      updatedAt: new Date().toISOString(),
      subscriptions: this.listAll(),
      lastKnownGood: lkg,
      recovery,
    });
  }

  async restoreFromDisk(): Promise<{ restored: number; skipped: number; reason: string | null }> {
    if (this.loaded) return { restored: 0, skipped: 0, reason: "ALREADY_LOADED" };
    this.loaded = true;
    const payload = await this.store.load();
    if (!payload) return { restored: 0, skipped: 0, reason: "NO_PERSISTED_STATE" };

    let catalogSymbols: Set<string> | null = null;
    try {
      const snap = await getHfmCatalogService().load();
      if (snap?.symbols?.length) {
        catalogSymbols = new Set(snap.symbols.map((s) => s.symbol));
      }
    } catch {
      catalogSymbols = null;
    }

    let restored = 0;
    let skipped = 0;
    this.bySymbol.clear();
    for (const row of payload.subscriptions) {
      if (row.provider !== HFM_SUB_PROVIDER || row.environment !== HFM_SUB_ENVIRONMENT) {
        skipped += 1;
        continue;
      }
      if (catalogSymbols && !catalogSymbols.has(row.symbol)) {
        skipped += 1;
        continue;
      }
      if (row.status === "UNSUBSCRIBED") {
        skipped += 1;
        continue;
      }
      if (this.bySymbol.size >= this.maxActive && row.status === "ACTIVE") {
        skipped += 1;
        continue;
      }
      // Never restore as LIVE quote owner — mark paused/recovering for re-acquire.
      const status: HfmSubscriptionStatus =
        row.status === "ACTIVE" || row.status === "RECOVERING" ? "RECOVERING" : row.status;
      this.bySymbol.set(row.symbol, {
        ...row,
        status,
        previousStatus: row.status,
        statusReason: "RESTORED_FROM_DISK",
        updatedAt: new Date().toISOString(),
        delayedForCapacity: false,
      });
      restored += 1;
    }
    if (this.bySymbol.size === 0) {
      for (const [i, symbol] of HFM_DEFAULT_QUOTE_SYMBOLS.entries()) {
        const now = new Date().toISOString();
        const weight = 1000 - i;
        this.bySymbol.set(symbol, {
          subscriptionId: this.idFor(symbol),
          provider: HFM_SUB_PROVIDER,
          environment: HFM_SUB_ENVIRONMENT,
          symbol,
          status: "ACTIVE",
          priority: priorityFromWeight(weight),
          priorityWeight: weight,
          requestedBy: "default",
          createdAt: now,
          updatedAt: now,
          lastAcquiredAt: null,
          lastValidQuoteAt: null,
          lastError: null,
          subscriptionConfig: defaultConfig(),
          engineSelected: false,
          previousStatus: null,
          statusReason: "DEFAULT_AFTER_EMPTY_RESTORE",
          delayedForCapacity: false,
        });
      }
    }
    return { restored, skipped, reason: null };
  }

  capacity(): HfmSubscriptionCapacity {
    let active = 0;
    let paused = 0;
    let pending = 0;
    let failed = 0;
    let recovering = 0;
    for (const s of this.bySymbol.values()) {
      switch (s.status) {
        case "ACTIVE":
          active += 1;
          break;
        case "PAUSED":
          paused += 1;
          break;
        case "PENDING":
          pending += 1;
          break;
        case "FAILED":
          failed += 1;
          break;
        case "RECOVERING":
          recovering += 1;
          break;
        default:
          break;
      }
    }
    return {
      maxActive: this.maxActive,
      maxBatch: HFM_SUBSCRIPTION_DEFAULTS.maxBatch,
      maxPendingOps: this.maxPendingOps,
      maxRetrying: HFM_SUBSCRIPTION_DEFAULTS.maxRetrying,
      maxDiagnosticHistory: HFM_SUBSCRIPTION_DEFAULTS.maxDiagnosticHistory,
      active,
      paused,
      pending,
      failed,
      recovering,
      utilization: this.maxActive > 0 ? active / this.maxActive : 0,
    };
  }

  listAll(): HfmSubscriptionRecord[] {
    return [...this.bySymbol.values()].sort((a, b) => b.priorityWeight - a.priorityWeight);
  }

  listActiveSymbols(): string[] {
    return this.listAll()
      .filter((s) => s.status === "ACTIVE" || s.status === "RECOVERING")
      .map((s) => s.symbol);
  }

  /** STEP 2A compatibility: symbols that should receive acquisition. */
  listAcquisitionSymbols(): string[] {
    return this.listAll()
      .filter((s) => s.status === "ACTIVE" || s.status === "RECOVERING")
      .map((s) => s.symbol);
  }

  get(symbol: string): HfmSubscriptionRecord | null {
    const direct = this.bySymbol.get(symbol);
    if (direct) return direct;
    const u = symbol.toUpperCase();
    for (const [k, v] of this.bySymbol) {
      if (k.toUpperCase() === u) return v;
    }
    return null;
  }

  isAcquisitionEligible(symbol: string): boolean {
    const s = this.get(symbol);
    return Boolean(s && (s.status === "ACTIVE" || s.status === "RECOVERING"));
  }

  private beginOp(): string | null {
    if (this.pendingOps >= this.maxPendingOps) return "PENDING_OPS_LIMIT";
    this.pendingOps += 1;
    return null;
  }

  private endOp(): void {
    this.pendingOps = Math.max(0, this.pendingOps - 1);
  }

  private async assertCatalogSymbol(symbol: string): Promise<{ ok: boolean; reason: string | null; exact: string }> {
    try {
      const snap = await getHfmCatalogService().load();
      if (!snap?.symbols?.length) {
        // Catalog unavailable: allow default nine only (preserve existing pipeline).
        if ((HFM_DEFAULT_QUOTE_SYMBOLS as readonly string[]).includes(symbol)) {
          return { ok: true, reason: null, exact: symbol };
        }
        return { ok: false, reason: "CATALOG_UNAVAILABLE", exact: symbol };
      }
      const hit = snap.symbols.find((s) => s.symbol === symbol || s.symbol.toUpperCase() === symbol.toUpperCase());
      if (!hit) return { ok: false, reason: "SYMBOL_NOT_IN_CATALOG", exact: symbol };
      if (hit.lifecycle && hit.lifecycle !== "ACTIVE" && hit.lifecycle !== "DISCOVERED") {
        return { ok: false, reason: "SYMBOL_LIFECYCLE_BLOCKED", exact: hit.symbol };
      }
      return { ok: true, reason: null, exact: hit.symbol };
    } catch {
      if ((HFM_DEFAULT_QUOTE_SYMBOLS as readonly string[]).includes(symbol)) {
        return { ok: true, reason: null, exact: symbol };
      }
      return { ok: false, reason: "CATALOG_ERROR", exact: symbol };
    }
  }

  private transition(
    row: HfmSubscriptionRecord,
    to: HfmSubscriptionStatus,
    reason: string | null,
    event: HfmSubscriptionEventType,
  ): { ok: boolean; reason: string | null; record: HfmSubscriptionRecord } {
    if (!canTransition(row.status, to)) {
      return { ok: false, reason: `INVALID_TRANSITION_${row.status}_TO_${to}`, record: row };
    }
    const previous = row.status;
    row.previousStatus = previous;
    row.status = to;
    row.statusReason = reason;
    row.updatedAt = new Date().toISOString();
    this.bySymbol.set(row.symbol, row);
    this.emit({
      type: event,
      provider: HFM_SUB_PROVIDER,
      environment: HFM_SUB_ENVIRONMENT,
      symbol: row.symbol,
      subscriptionId: row.subscriptionId,
      previousStatus: previous,
      newStatus: to,
      reason,
      timestamp: row.updatedAt,
    });
    this.schedulePersist();
    return { ok: true, reason: null, record: row };
  }

  async subscribe(
    symbol: string,
    opts?: {
      priority?: HfmSubscriptionPriority | number;
      requestedBy?: string;
      config?: Partial<HfmSubscriptionConfig>;
      requireCatalog?: boolean;
    },
  ): Promise<{ ok: boolean; reason: string | null; record: HfmSubscriptionRecord | null }> {
    const gate = this.beginOp();
    if (gate) return { ok: false, reason: gate, record: null };
    try {
      const raw = String(symbol ?? "").trim();
      if (!raw) return { ok: false, reason: "SYMBOL_EMPTY", record: null };

      const requireCatalog = opts?.requireCatalog !== false;
      const catalog = requireCatalog
        ? await this.assertCatalogSymbol(raw)
        : { ok: true, reason: null, exact: raw };
      if (!catalog.ok) return { ok: false, reason: catalog.reason, record: null };
      const exact = catalog.exact;
      const { priority, weight } = normalizePriority(opts?.priority);

      const existing = this.get(exact);
      if (existing && existing.status !== "UNSUBSCRIBED") {
        // Idempotent: already subscribed / paused / recovering.
        if (existing.status === "PAUSED") {
          return this.resume(exact);
        }
        if (existing.status === "ACTIVE" || existing.status === "RECOVERING" || existing.status === "PENDING") {
          existing.priority = priority;
          existing.priorityWeight = weight;
          existing.requestedBy = opts?.requestedBy ?? existing.requestedBy;
          existing.updatedAt = new Date().toISOString();
          if (opts?.config) existing.subscriptionConfig = { ...existing.subscriptionConfig, ...opts.config };
          this.bySymbol.set(existing.symbol, existing);
          this.emit({
            type: "subscription.priority_changed",
            provider: HFM_SUB_PROVIDER,
            environment: HFM_SUB_ENVIRONMENT,
            symbol: existing.symbol,
            subscriptionId: existing.subscriptionId,
            previousStatus: existing.status,
            newStatus: existing.status,
            reason: "IDEMPOTENT_SUBSCRIBE",
            timestamp: existing.updatedAt,
          });
          this.schedulePersist();
          return { ok: true, reason: null, record: existing };
        }
        if (existing.status === "FAILED") {
          return this.transition(existing, "PENDING", "RESUBSCRIBE_AFTER_FAIL", "subscription.created");
        }
      }

      const activeLike = [...this.bySymbol.values()].filter(
        (s) => s.status === "ACTIVE" || s.status === "PENDING" || s.status === "RECOVERING",
      ).length;
      if (activeLike >= this.maxActive) {
        return { ok: false, reason: "SUBSCRIPTION_LIMIT", record: null };
      }

      const now = new Date().toISOString();
      const row: HfmSubscriptionRecord = {
        subscriptionId: existing?.subscriptionId ?? this.idFor(exact),
        provider: HFM_SUB_PROVIDER,
        environment: HFM_SUB_ENVIRONMENT,
        symbol: exact,
        status: "PENDING",
        priority,
        priorityWeight: weight,
        requestedBy: opts?.requestedBy ?? "manual",
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        lastAcquiredAt: existing?.lastAcquiredAt ?? null,
        lastValidQuoteAt: existing?.lastValidQuoteAt ?? null,
        lastError: null,
        subscriptionConfig: { ...defaultConfig(), ...(opts?.config ?? {}) },
        engineSelected: existing?.engineSelected ?? false,
        previousStatus: existing?.status ?? null,
        statusReason: "SUBSCRIBE_REQUESTED",
        delayedForCapacity: false,
      };
      this.bySymbol.set(exact, row);
      this.emit({
        type: "subscription.created",
        provider: HFM_SUB_PROVIDER,
        environment: HFM_SUB_ENVIRONMENT,
        symbol: exact,
        subscriptionId: row.subscriptionId,
        previousStatus: row.previousStatus,
        newStatus: "PENDING",
        reason: "SUBSCRIBE_REQUESTED",
        timestamp: now,
      });
      const activated = this.transition(row, "ACTIVE", "ACTIVATED", "subscription.activated");
      return { ok: activated.ok, reason: activated.reason, record: activated.record };
    } finally {
      this.endOp();
    }
  }

  async subscribeMany(
    symbols: string[],
    opts?: { priority?: HfmSubscriptionPriority | number; requestedBy?: string },
  ): Promise<{
    ok: boolean;
    accepted: HfmSubscriptionRecord[];
    rejected: Array<{ symbol: string; reason: string }>;
  }> {
    const accepted: HfmSubscriptionRecord[] = [];
    const rejected: Array<{ symbol: string; reason: string }> = [];
    for (const sym of symbols) {
      const r = await this.subscribe(sym, opts);
      if (r.ok && r.record) accepted.push(r.record);
      else rejected.push({ symbol: String(sym), reason: r.reason ?? "UNKNOWN" });
    }
    return { ok: rejected.length === 0, accepted, rejected };
  }

  async unsubscribe(symbol: string): Promise<{ ok: boolean; reason: string | null; record: HfmSubscriptionRecord | null }> {
    const gate = this.beginOp();
    if (gate) return { ok: false, reason: gate, record: null };
    try {
      const row = this.get(symbol);
      if (!row || row.status === "UNSUBSCRIBED") {
        return { ok: true, reason: null, record: row }; // idempotent
      }
      if (row.status !== "UNSUBSCRIBING") {
        const mid = this.transition(row, "UNSUBSCRIBING", "UNSUBSCRIBE_REQUESTED", "subscription.removed");
        if (!mid.ok && row.status !== "UNSUBSCRIBED") {
          // Force path for FAILED/PENDING
          row.previousStatus = row.status;
          row.status = "UNSUBSCRIBED";
          row.statusReason = "UNSUBSCRIBE_FORCED";
          row.updatedAt = new Date().toISOString();
          this.bySymbol.set(row.symbol, row);
          this.schedulePersist();
          return { ok: true, reason: null, record: row };
        }
      }
      const done = this.transition(row, "UNSUBSCRIBED", "UNSUBSCRIBED", "subscription.removed");
      return { ok: done.ok, reason: done.reason, record: done.record };
    } finally {
      this.endOp();
    }
  }

  async unsubscribeMany(symbols: string[]): Promise<{ ok: boolean; removed: string[]; rejected: Array<{ symbol: string; reason: string }> }> {
    const removed: string[] = [];
    const rejected: Array<{ symbol: string; reason: string }> = [];
    for (const sym of symbols) {
      const r = await this.unsubscribe(sym);
      if (r.ok) removed.push(String(sym));
      else rejected.push({ symbol: String(sym), reason: r.reason ?? "UNKNOWN" });
    }
    return { ok: rejected.length === 0, removed, rejected };
  }

  pause(symbol: string): { ok: boolean; reason: string | null; record: HfmSubscriptionRecord | null } {
    const row = this.get(symbol);
    if (!row) return { ok: false, reason: "NOT_FOUND", record: null };
    if (row.status === "PAUSED") return { ok: true, reason: null, record: row };
    return this.transition(row, "PAUSED", "PAUSED", "subscription.paused");
  }

  resume(symbol: string): { ok: boolean; reason: string | null; record: HfmSubscriptionRecord | null } {
    const row = this.get(symbol);
    if (!row) return { ok: false, reason: "NOT_FOUND", record: null };
    if (row.status === "ACTIVE") return { ok: true, reason: null, record: row };
    if (row.status === "PAUSED" || row.status === "FAILED" || row.status === "RECOVERING") {
      return this.transition(row, "ACTIVE", "RESUMED", "subscription.resumed");
    }
    return { ok: false, reason: `INVALID_TRANSITION_${row.status}_TO_ACTIVE`, record: row };
  }

  setPriority(
    symbol: string,
    priority: HfmSubscriptionPriority | number,
  ): { ok: boolean; reason: string | null; record: HfmSubscriptionRecord | null } {
    const row = this.get(symbol);
    if (!row) return { ok: false, reason: "NOT_FOUND", record: null };
    const next = normalizePriority(priority);
    row.priority = next.priority;
    row.priorityWeight = next.weight;
    row.updatedAt = new Date().toISOString();
    this.bySymbol.set(row.symbol, row);
    this.emit({
      type: "subscription.priority_changed",
      provider: HFM_SUB_PROVIDER,
      environment: HFM_SUB_ENVIRONMENT,
      symbol: row.symbol,
      subscriptionId: row.subscriptionId,
      previousStatus: row.status,
      newStatus: row.status,
      reason: `PRIORITY_${next.priority}`,
      timestamp: row.updatedAt,
    });
    this.schedulePersist();
    return { ok: true, reason: null, record: row };
  }

  markAcquired(symbol: string, atIso: string, valid: boolean): void {
    const row = this.get(symbol);
    if (!row) return;
    row.lastAcquiredAt = atIso;
    if (valid) {
      row.lastValidQuoteAt = atIso;
      row.lastError = null;
      if (row.status === "RECOVERING") {
        this.transition(row, "ACTIVE", "QUOTE_RECOVERED", "subscription.activated");
        return;
      }
    }
    row.updatedAt = atIso;
    this.bySymbol.set(row.symbol, row);
  }

  markFailed(symbol: string, error: string): void {
    const row = this.get(symbol);
    if (!row) return;
    row.lastError = error.slice(0, 300);
    if (row.status === "ACTIVE" || row.status === "RECOVERING") {
      this.transition(row, "FAILED", error.slice(0, 120), "subscription.failed");
    } else {
      row.updatedAt = new Date().toISOString();
      this.bySymbol.set(row.symbol, row);
    }
  }

  markRecovering(symbol: string, reason: string): void {
    const row = this.get(symbol);
    if (!row) return;
    if (row.status === "ACTIVE" || row.status === "FAILED") {
      this.transition(row, "RECOVERING", reason, "subscription.recovering");
    }
  }

  markEngineSelected(symbol: string, selected: boolean): void {
    const row = this.get(symbol);
    if (!row) return;
    row.engineSelected = selected;
    row.updatedAt = new Date().toISOString();
    this.bySymbol.set(row.symbol, row);
  }

  markDelayedForCapacity(symbol: string, delayed: boolean): void {
    const row = this.get(symbol);
    if (!row) return;
    row.delayedForCapacity = delayed;
    row.updatedAt = new Date().toISOString();
    this.bySymbol.set(row.symbol, row);
  }

  /**
   * Synchronous bounded replace of the active set (tests + STEP 2A facade).
   * Empty input restores the default nine-symbol universe.
   */
  replaceActiveSet(symbols: string[], requestedBy = "manual"): HfmSubscriptionRecord[] {
    const unique: string[] = [];
    const seen = new Set<string>();
    for (const s of symbols) {
      const sym = String(s ?? "").trim();
      if (!sym) continue;
      const key = sym.toUpperCase();
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(sym);
      if (unique.length >= this.maxActive) break;
    }
    const seed = unique.length > 0 ? unique : [...HFM_DEFAULT_QUOTE_SYMBOLS];
    this.bySymbol.clear();
    const now = new Date().toISOString();
    for (const [i, symbol] of seed.entries()) {
      const weight = 1000 - i;
      this.bySymbol.set(symbol, {
        subscriptionId: this.idFor(symbol),
        provider: HFM_SUB_PROVIDER,
        environment: HFM_SUB_ENVIRONMENT,
        symbol,
        status: "ACTIVE",
        priority: priorityFromWeight(weight),
        priorityWeight: weight,
        requestedBy: unique.length > 0 ? requestedBy : "default",
        createdAt: now,
        updatedAt: now,
        lastAcquiredAt: null,
        lastValidQuoteAt: null,
        lastError: null,
        subscriptionConfig: defaultConfig(),
        engineSelected: false,
        previousStatus: null,
        statusReason: "REPLACE_ACTIVE_SET",
        delayedForCapacity: false,
      });
    }
    this.schedulePersist();
    return this.listAll();
  }

  /**
   * Synchronous activate used by the STEP 2A facade / unit tests (no catalog I/O).
   */
  activateSync(
    symbol: string,
    opts?: { priority?: number; requestedBy?: string },
  ): { ok: boolean; reason: string | null; record: HfmSubscriptionRecord | null } {
    const sym = String(symbol ?? "").trim();
    if (!sym) return { ok: false, reason: "SYMBOL_EMPTY", record: null };
    const existing = this.get(sym);
    if (existing && existing.status !== "UNSUBSCRIBED") {
      if (opts?.priority != null) this.setPriority(existing.symbol, opts.priority);
      if (existing.status === "PAUSED") this.resume(existing.symbol);
      return { ok: true, reason: null, record: this.get(existing.symbol) };
    }
    const activeLike = [...this.bySymbol.values()].filter(
      (s) => s.status === "ACTIVE" || s.status === "PENDING" || s.status === "RECOVERING",
    ).length;
    if (activeLike >= this.maxActive) {
      return { ok: false, reason: "SUBSCRIPTION_LIMIT", record: null };
    }
    const weight = opts?.priority ?? HFM_PRIORITY_WEIGHT.NORMAL;
    const now = new Date().toISOString();
    const row: HfmSubscriptionRecord = {
      subscriptionId: this.idFor(sym),
      provider: HFM_SUB_PROVIDER,
      environment: HFM_SUB_ENVIRONMENT,
      symbol: sym,
      status: "ACTIVE",
      priority: priorityFromWeight(weight),
      priorityWeight: weight,
      requestedBy: opts?.requestedBy ?? "manual",
      createdAt: now,
      updatedAt: now,
      lastAcquiredAt: null,
      lastValidQuoteAt: null,
      lastError: null,
      subscriptionConfig: defaultConfig(),
      engineSelected: false,
      previousStatus: null,
      statusReason: "ACTIVATE_SYNC",
      delayedForCapacity: false,
    };
    this.bySymbol.set(sym, row);
    this.emit({
      type: "subscription.activated",
      provider: HFM_SUB_PROVIDER,
      environment: HFM_SUB_ENVIRONMENT,
      symbol: sym,
      subscriptionId: row.subscriptionId,
      previousStatus: null,
      newStatus: "ACTIVE",
      reason: "ACTIVATE_SYNC",
      timestamp: now,
    });
    this.schedulePersist();
    return { ok: true, reason: null, record: row };
  }

  deactivateSync(symbol: string): void {
    const row = this.get(symbol);
    if (!row) return;
    row.previousStatus = row.status;
    row.status = "UNSUBSCRIBED";
    row.statusReason = "DEACTIVATE_SYNC";
    row.updatedAt = new Date().toISOString();
    this.bySymbol.delete(row.symbol);
    this.schedulePersist();
  }
}

let singleton: HfmSubscriptionManager | null = null;

export function getHfmSubscriptionManager(): HfmSubscriptionManager {
  if (!singleton) singleton = new HfmSubscriptionManager();
  return singleton;
}

export function resetHfmSubscriptionManagerForTests(): void {
  singleton = null;
}

/** Test helper — create manager without disk side effects. */
export function createHfmSubscriptionManagerForTests(
  opts?: ConstructorParameters<typeof HfmSubscriptionManager>[0],
): HfmSubscriptionManager {
  return new HfmSubscriptionManager({ seedDefaults: false, ...opts });
}
