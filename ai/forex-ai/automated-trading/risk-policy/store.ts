/**
 * Stage 3 — persisted AT risk-policy document (fail-closed defaults; auditable).
 */
import fs from "node:fs";
import path from "node:path";
import {
  RISK_POLICY_SCHEMA,
  RISK_POLICY_STAGE,
  STAGE3_TRACKED_INSTRUMENTS,
  type AtRiskPolicyDocument,
  type InstrumentRiskPolicy,
  type RiskPolicyAuditEntry,
} from "./types.js";
import {
  applyApprovedSlippage,
  applyApprovedSpread,
  emptyInstrumentPolicy,
  normalizeInstrumentSymbol,
} from "./validate.js";

function storageRoot(): string {
  const root = process.env.KWIZERA_STORAGE_ROOT?.trim();
  return root && root.length > 0 ? root : path.join(process.cwd(), ".kwizera-storage");
}

function storePath(): string {
  return path.join(storageRoot(), "forex-automated-trading", "risk-policy.json");
}

function emptyDocument(nowUtc: string): AtRiskPolicyDocument {
  const instruments: Record<string, InstrumentRiskPolicy> = {};
  for (const inst of STAGE3_TRACKED_INSTRUMENTS) {
    instruments[inst] = emptyInstrumentPolicy(inst);
  }
  return {
    schemaVersion: RISK_POLICY_SCHEMA,
    stage: RISK_POLICY_STAGE,
    version: 1,
    updatedAtUtc: nowUtc,
    instruments,
    audit: [{
      atUtc: nowUtc,
      actor: "system",
      action: "CREATE_EMPTY",
      instrument: null,
      detail: "Initialized empty Stage 3 risk-policy slots (no invented thresholds).",
      previousValue: null,
      nextValue: null,
    }],
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    note:
      "Stage 3 risk-policy store. Instrument spread/slippage limits remain NOT_CONFIGURED "
      + "until explicit owner approval. Never enables broker mutation.",
  };
}

function isPolicyDoc(raw: unknown): raw is AtRiskPolicyDocument {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as AtRiskPolicyDocument;
  return o.schemaVersion === RISK_POLICY_SCHEMA && o.instruments != null && typeof o.instruments === "object";
}

export class AtRiskPolicyStore {
  private doc: AtRiskPolicyDocument;
  private readonly filePath: string;

  constructor(filePath: string = storePath()) {
    this.filePath = filePath;
    this.doc = this.loadOrCreate();
  }

  get(): AtRiskPolicyDocument {
    return structuredClone(this.doc);
  }

  getInstrument(instrument: string | null | undefined): InstrumentRiskPolicy | null {
    const key = normalizeInstrumentSymbol(instrument);
    if (!key) return null;
    const hit = this.doc.instruments[key];
    if (hit) return structuredClone(hit);
    return emptyInstrumentPolicy(key);
  }

  setSpread(input: {
    instrument: string;
    maxSpreadAbsolute: unknown;
    actor?: string;
    pricePrecision?: number | null;
    clear?: boolean;
  }): { ok: true; document: AtRiskPolicyDocument } | { ok: false; status: string; reason: string } {
    const key = normalizeInstrumentSymbol(input.instrument);
    if (!key) return { ok: false, status: "INVALID", reason: "Instrument required." };
    const nowUtc = new Date().toISOString();
    const actor = String(input.actor || "admin").trim() || "admin";
    const prev = this.doc.instruments[key] ?? emptyInstrumentPolicy(key);
    const previousValue = prev.spread.maxSpreadAbsolute;

    if (input.clear) {
      const next = emptyInstrumentPolicy(key);
      next.slippage = prev.slippage;
      this.writeInstrument(key, next, {
        atUtc: nowUtc,
        actor,
        action: "CLEAR_SPREAD",
        instrument: key,
        detail: "Cleared instrument spread policy — NOT_CONFIGURED.",
        previousValue,
        nextValue: null,
      }, nowUtc);
      return { ok: true, document: this.get() };
    }

    const applied = applyApprovedSpread(key, input.maxSpreadAbsolute, actor, nowUtc, input.pricePrecision);
    if (!applied.ok) {
      this.appendAudit({
        atUtc: nowUtc,
        actor,
        action: "REJECT_INVALID",
        instrument: key,
        detail: applied.reason,
        previousValue,
        nextValue: null,
      }, nowUtc);
      return { ok: false, status: applied.status, reason: applied.reason };
    }
    const next: InstrumentRiskPolicy = { ...prev, instrument: key, spread: applied.policy };
    this.writeInstrument(key, next, {
      atUtc: nowUtc,
      actor,
      action: "SET_SPREAD",
      instrument: key,
      detail: `Approved maxSpreadAbsolute=${applied.policy.maxSpreadAbsolute} absolute_price.`,
      previousValue,
      nextValue: applied.policy.maxSpreadAbsolute,
    }, nowUtc);
    return { ok: true, document: this.get() };
  }

  setSlippage(input: {
    instrument: string;
    maxSlippageAbsolute: unknown;
    actor?: string;
    clear?: boolean;
  }): { ok: true; document: AtRiskPolicyDocument } | { ok: false; status: string; reason: string } {
    const key = normalizeInstrumentSymbol(input.instrument);
    if (!key) return { ok: false, status: "INVALID", reason: "Instrument required." };
    const nowUtc = new Date().toISOString();
    const actor = String(input.actor || "admin").trim() || "admin";
    const prev = this.doc.instruments[key] ?? emptyInstrumentPolicy(key);
    const previousValue = prev.slippage.maxSlippageAbsolute;

    if (input.clear) {
      const next = emptyInstrumentPolicy(key);
      next.spread = prev.spread;
      this.writeInstrument(key, next, {
        atUtc: nowUtc,
        actor,
        action: "CLEAR_SLIPPAGE",
        instrument: key,
        detail: "Cleared instrument slippage policy — NOT_CONFIGURED.",
        previousValue,
        nextValue: null,
      }, nowUtc);
      return { ok: true, document: this.get() };
    }

    const applied = applyApprovedSlippage(key, input.maxSlippageAbsolute, actor, nowUtc);
    if (!applied.ok) {
      this.appendAudit({
        atUtc: nowUtc,
        actor,
        action: "REJECT_INVALID",
        instrument: key,
        detail: applied.reason,
        previousValue,
        nextValue: null,
      }, nowUtc);
      return { ok: false, status: applied.status, reason: applied.reason };
    }
    const next: InstrumentRiskPolicy = { ...prev, instrument: key, slippage: applied.policy };
    this.writeInstrument(key, next, {
      atUtc: nowUtc,
      actor,
      action: "SET_SLIPPAGE",
      instrument: key,
      detail: `Approved maxSlippageAbsolute=${applied.policy.maxSlippageAbsolute} absolute_price (entry_vs_executable).`,
      previousValue,
      nextValue: applied.policy.maxSlippageAbsolute,
    }, nowUtc);
    return { ok: true, document: this.get() };
  }

  private writeInstrument(
    key: string,
    policy: InstrumentRiskPolicy,
    audit: RiskPolicyAuditEntry,
    nowUtc: string,
  ): void {
    this.doc = {
      ...this.doc,
      version: this.doc.version + 1,
      updatedAtUtc: nowUtc,
      instruments: { ...this.doc.instruments, [key]: policy },
      audit: [...this.doc.audit, audit].slice(-200),
      placesOrders: false,
      acceptsForExecution: false,
      mutatesBroker: false,
    };
    this.persist();
  }

  private appendAudit(audit: RiskPolicyAuditEntry, nowUtc: string): void {
    this.doc = {
      ...this.doc,
      updatedAtUtc: nowUtc,
      audit: [...this.doc.audit, audit].slice(-200),
    };
    this.persist();
  }

  private persist(): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.doc, null, 2), "utf8");
    fs.renameSync(tmp, this.filePath);
  }

  private loadOrCreate(): AtRiskPolicyDocument {
    const nowUtc = new Date().toISOString();
    try {
      if (!fs.existsSync(this.filePath)) {
        const created = emptyDocument(nowUtc);
        fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
        fs.writeFileSync(this.filePath, JSON.stringify(created, null, 2), "utf8");
        return created;
      }
      const raw = JSON.parse(fs.readFileSync(this.filePath, "utf8")) as unknown;
      if (!isPolicyDoc(raw)) return emptyDocument(nowUtc);
      // Ensure tracked instruments exist without inventing limits.
      for (const inst of STAGE3_TRACKED_INSTRUMENTS) {
        if (!raw.instruments[inst]) raw.instruments[inst] = emptyInstrumentPolicy(inst);
      }
      raw.placesOrders = false;
      raw.acceptsForExecution = false;
      raw.mutatesBroker = false;
      return raw;
    } catch {
      return emptyDocument(nowUtc);
    }
  }
}

let shared: AtRiskPolicyStore | null = null;

export function getAtRiskPolicyStore(): AtRiskPolicyStore {
  shared ??= new AtRiskPolicyStore();
  return shared;
}

export function resetAtRiskPolicyStoreForTests(filePath?: string): AtRiskPolicyStore {
  shared = new AtRiskPolicyStore(
    filePath ?? path.join(process.cwd(), `.kwizera-test-risk-policy-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.json`),
  );
  return shared;
}
