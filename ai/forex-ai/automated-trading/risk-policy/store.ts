/**
 * Stage 3/4 — persisted AT risk-policy (propose ≠ approve; auditable).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  RISK_POLICY_SCHEMA,
  RISK_POLICY_STAGE,
  STAGE3_TRACKED_INSTRUMENTS,
  type AtRiskPolicyDocument,
  type InstrumentRiskPolicy,
  type InstrumentSlippagePolicy,
  type InstrumentSpreadPolicy,
  type RiskPolicyAuditEntry,
} from "./types.js";
import {
  emptyInstrumentPolicy,
  migrateInstrumentPolicy,
  normalizeInstrumentSymbol,
  validateAbsolutePriceLimit,
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
    instruments[inst] = emptyInstrumentPolicy(inst, nowUtc);
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
      kind: null,
      detail: "Initialized empty Stage 4 risk-policy slots (propose then approve; no invented thresholds).",
      previousValue: null,
      nextValue: null,
      policyVersion: 1,
      configVersion: 0,
    }],
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    note:
      "Stage 4 risk-policy store. Proposed values are not active until explicit admin approval. "
      + "Never enables broker mutation.",
  };
}

function isPolicyDoc(raw: unknown): raw is AtRiskPolicyDocument {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as AtRiskPolicyDocument;
  return o.schemaVersion === RISK_POLICY_SCHEMA && o.instruments != null && typeof o.instruments === "object";
}

type StoreResult =
  | { ok: true; document: AtRiskPolicyDocument }
  | { ok: false; status: string; reason: string };

export class AtRiskPolicyStore {
  private doc: AtRiskPolicyDocument;
  private readonly filePath: string;

  constructor(filePath: string = storePath()) {
    this.filePath = filePath;
    this.doc = this.loadOrCreate();
  }

  /** Absolute persistence path (diagnostics / tests). */
  get persistencePath(): string {
    return this.filePath;
  }

  get(): AtRiskPolicyDocument {
    return structuredClone(this.doc);
  }

  getHistory(limit = 80): RiskPolicyAuditEntry[] {
    return structuredClone(this.doc.audit.slice(-Math.max(1, Math.min(200, limit))));
  }

  getInstrument(instrument: string | null | undefined): InstrumentRiskPolicy | null {
    const key = normalizeInstrumentSymbol(instrument);
    if (!key) return null;
    const hit = this.doc.instruments[key];
    if (hit) return structuredClone(hit);
    return emptyInstrumentPolicy(key);
  }

  /**
   * Stage 4 — propose a spread limit (does NOT activate).
   * Legacy alias: setSpread → proposeSpread (clear clears active+proposed).
   */
  setSpread(input: {
    instrument: string;
    maxSpreadAbsolute: unknown;
    actor?: string;
    pricePrecision?: number | null;
    clear?: boolean;
  }): StoreResult {
    if (input.clear) return this.clearSpread(input);
    return this.proposeSpread(input);
  }

  setSlippage(input: {
    instrument: string;
    maxSlippageAbsolute: unknown;
    actor?: string;
    clear?: boolean;
  }): StoreResult {
    if (input.clear) return this.clearSlippage(input);
    return this.proposeSlippage(input);
  }

  proposeSpread(input: {
    instrument: string;
    maxSpreadAbsolute: unknown;
    actor?: string;
    pricePrecision?: number | null;
    note?: string | null;
    expectedVersion?: number | null;
  }): StoreResult {
    const key = normalizeInstrumentSymbol(input.instrument);
    if (!key) return { ok: false, status: "INVALID", reason: "Instrument required." };
    const conflict = this.versionConflict(input.expectedVersion);
    if (conflict) return conflict;
    const v = validateAbsolutePriceLimit(input.maxSpreadAbsolute);
    if (!v.ok) {
      this.appendReject(key, "spread", input.actor, v.reason);
      return { ok: false, status: v.status, reason: v.reason };
    }
    const nowUtc = new Date().toISOString();
    const actor = String(input.actor || "admin").trim() || "admin";
    const prev = this.doc.instruments[key] ?? emptyInstrumentPolicy(key, nowUtc);
    const precision = input.pricePrecision == null
      ? prev.spread.pricePrecision
      : (Number.isInteger(input.pricePrecision) && input.pricePrecision >= 0
        ? input.pricePrecision
        : prev.spread.pricePrecision);
    const nextSpread: InstrumentSpreadPolicy = {
      ...prev.spread,
      instrument: key,
      // Keep active approved value unchanged.
      proposed: {
        value: v.value,
        units: "absolute_price",
        pricePrecision: precision,
        proposedAtUtc: nowUtc,
        proposedBy: actor,
        note: input.note ?? null,
      },
      approvalState: "PENDING_APPROVAL",
      // Active resolve status stays based on approved value.
      status: prev.spread.approvalState === "APPROVED" && prev.spread.maxSpreadAbsolute != null
        ? "VERIFIED"
        : "NOT_CONFIGURED",
      reason: "PENDING_APPROVAL — proposed spread is not active until approved.",
      updatedAtUtc: nowUtc,
    };
    this.writeInstrument(key, { ...prev, instrument: key, spread: nextSpread }, {
      atUtc: nowUtc,
      actor,
      action: "PROPOSE_SPREAD",
      instrument: key,
      kind: "spread",
      detail: `Proposed maxSpreadAbsolute=${v.value} (pending approval; active unchanged).`,
      previousValue: prev.spread.proposed?.value ?? prev.spread.maxSpreadAbsolute,
      nextValue: v.value,
      policyVersion: this.doc.version + 1,
      configVersion: prev.spread.configVersion,
    }, nowUtc);
    return { ok: true, document: this.get() };
  }

  proposeSlippage(input: {
    instrument: string;
    maxSlippageAbsolute: unknown;
    actor?: string;
    note?: string | null;
    expectedVersion?: number | null;
  }): StoreResult {
    const key = normalizeInstrumentSymbol(input.instrument);
    if (!key) return { ok: false, status: "INVALID", reason: "Instrument required." };
    const conflict = this.versionConflict(input.expectedVersion);
    if (conflict) return conflict;
    const v = validateAbsolutePriceLimit(input.maxSlippageAbsolute);
    if (!v.ok) {
      this.appendReject(key, "slippage", input.actor, v.reason);
      return { ok: false, status: v.status, reason: v.reason };
    }
    const nowUtc = new Date().toISOString();
    const actor = String(input.actor || "admin").trim() || "admin";
    const prev = this.doc.instruments[key] ?? emptyInstrumentPolicy(key, nowUtc);
    const nextSlip: InstrumentSlippagePolicy = {
      ...prev.slippage,
      instrument: key,
      proposed: {
        value: v.value,
        units: "absolute_price",
        pricePrecision: prev.slippage.pricePrecision,
        proposedAtUtc: nowUtc,
        proposedBy: actor,
        note: input.note ?? null,
      },
      approvalState: "PENDING_APPROVAL",
      status: prev.slippage.approvalState === "APPROVED" && prev.slippage.maxSlippageAbsolute != null
        ? "VERIFIED"
        : "NOT_CONFIGURED",
      reason: "PENDING_APPROVAL — proposed slippage is not active until approved.",
      updatedAtUtc: nowUtc,
    };
    this.writeInstrument(key, { ...prev, instrument: key, slippage: nextSlip }, {
      atUtc: nowUtc,
      actor,
      action: "PROPOSE_SLIPPAGE",
      instrument: key,
      kind: "slippage",
      detail: `Proposed maxSlippageAbsolute=${v.value} (pending approval; active unchanged).`,
      previousValue: prev.slippage.proposed?.value ?? prev.slippage.maxSlippageAbsolute,
      nextValue: v.value,
      policyVersion: this.doc.version + 1,
      configVersion: prev.slippage.configVersion,
    }, nowUtc);
    return { ok: true, document: this.get() };
  }

  approveSpread(input: {
    instrument: string;
    actor?: string;
    expectedVersion?: number | null;
    confirm?: boolean;
  }): StoreResult {
    if (input.confirm !== true) {
      return { ok: false, status: "CONFIRMATION_REQUIRED", reason: "Approval requires confirm=true." };
    }
    const key = normalizeInstrumentSymbol(input.instrument);
    if (!key) return { ok: false, status: "INVALID", reason: "Instrument required." };
    const conflict = this.versionConflict(input.expectedVersion);
    if (conflict) return conflict;
    const nowUtc = new Date().toISOString();
    const actor = String(input.actor || "admin").trim() || "admin";
    const prev = this.doc.instruments[key] ?? emptyInstrumentPolicy(key, nowUtc);
    if (!prev.spread.proposed || !validateAbsolutePriceLimit(prev.spread.proposed.value).ok) {
      return { ok: false, status: "NOT_CONFIGURED", reason: "No valid pending spread proposal to approve." };
    }
    if (prev.spread.approvalState !== "PENDING_APPROVAL") {
      return { ok: false, status: "INVALID", reason: `Spread approvalState is ${prev.spread.approvalState}, not PENDING_APPROVAL.` };
    }
    const proposed = prev.spread.proposed;
    const previousActive = prev.spread.maxSpreadAbsolute;
    const configVersion = prev.spread.configVersion + 1;
    const history = [...prev.spread.history];
    if (previousActive != null && prev.spread.approvalState === "APPROVED") {
      // already approved previous — still push current before overwrite if present
    }
    if (prev.spread.maxSpreadAbsolute != null && prev.spread.approvedAtUtc && prev.spread.approvedBy) {
      history.push({
        value: prev.spread.maxSpreadAbsolute,
        units: "absolute_price",
        pricePrecision: prev.spread.pricePrecision,
        approvedAtUtc: prev.spread.approvedAtUtc,
        approvedBy: prev.spread.approvedBy,
        configVersion: prev.spread.configVersion,
        documentVersion: this.doc.version,
      });
    }
    const nextSpread: InstrumentSpreadPolicy = {
      ...prev.spread,
      maxSpreadAbsolute: proposed.value,
      pricePrecision: proposed.pricePrecision ?? prev.spread.pricePrecision,
      status: "VERIFIED",
      approvalState: "APPROVED",
      reason: null,
      configVersion,
      updatedAtUtc: nowUtc,
      approvedAtUtc: nowUtc,
      approvedBy: actor,
      effectiveAtUtc: nowUtc,
      proposed: null,
      history: history.slice(-40),
    };
    this.writeInstrument(key, { ...prev, instrument: key, spread: nextSpread }, {
      atUtc: nowUtc,
      actor,
      action: "APPROVE_SPREAD",
      instrument: key,
      kind: "spread",
      detail: `Approved maxSpreadAbsolute=${proposed.value} (was active=${previousActive}).`,
      previousValue: previousActive,
      nextValue: proposed.value,
      policyVersion: this.doc.version + 1,
      configVersion,
    }, nowUtc);
    return { ok: true, document: this.get() };
  }

  approveSlippage(input: {
    instrument: string;
    actor?: string;
    expectedVersion?: number | null;
    confirm?: boolean;
  }): StoreResult {
    if (input.confirm !== true) {
      return { ok: false, status: "CONFIRMATION_REQUIRED", reason: "Approval requires confirm=true." };
    }
    const key = normalizeInstrumentSymbol(input.instrument);
    if (!key) return { ok: false, status: "INVALID", reason: "Instrument required." };
    const conflict = this.versionConflict(input.expectedVersion);
    if (conflict) return conflict;
    const nowUtc = new Date().toISOString();
    const actor = String(input.actor || "admin").trim() || "admin";
    const prev = this.doc.instruments[key] ?? emptyInstrumentPolicy(key, nowUtc);
    if (!prev.slippage.proposed || !validateAbsolutePriceLimit(prev.slippage.proposed.value).ok) {
      return { ok: false, status: "NOT_CONFIGURED", reason: "No valid pending slippage proposal to approve." };
    }
    if (prev.slippage.approvalState !== "PENDING_APPROVAL") {
      return { ok: false, status: "INVALID", reason: `Slippage approvalState is ${prev.slippage.approvalState}, not PENDING_APPROVAL.` };
    }
    const proposed = prev.slippage.proposed;
    const previousActive = prev.slippage.maxSlippageAbsolute;
    const configVersion = prev.slippage.configVersion + 1;
    const history = [...prev.slippage.history];
    if (prev.slippage.maxSlippageAbsolute != null && prev.slippage.approvedAtUtc && prev.slippage.approvedBy) {
      history.push({
        value: prev.slippage.maxSlippageAbsolute,
        units: "absolute_price",
        pricePrecision: prev.slippage.pricePrecision,
        approvedAtUtc: prev.slippage.approvedAtUtc,
        approvedBy: prev.slippage.approvedBy,
        configVersion: prev.slippage.configVersion,
        documentVersion: this.doc.version,
      });
    }
    const nextSlip: InstrumentSlippagePolicy = {
      ...prev.slippage,
      maxSlippageAbsolute: proposed.value,
      status: "VERIFIED",
      approvalState: "APPROVED",
      reason: null,
      configVersion,
      updatedAtUtc: nowUtc,
      approvedAtUtc: nowUtc,
      approvedBy: actor,
      effectiveAtUtc: nowUtc,
      proposed: null,
      history: history.slice(-40),
    };
    this.writeInstrument(key, { ...prev, instrument: key, slippage: nextSlip }, {
      atUtc: nowUtc,
      actor,
      action: "APPROVE_SLIPPAGE",
      instrument: key,
      kind: "slippage",
      detail: `Approved maxSlippageAbsolute=${proposed.value} (was active=${previousActive}).`,
      previousValue: previousActive,
      nextValue: proposed.value,
      policyVersion: this.doc.version + 1,
      configVersion,
    }, nowUtc);
    return { ok: true, document: this.get() };
  }

  rejectSpread(input: {
    instrument: string;
    actor?: string;
    reason?: string;
    expectedVersion?: number | null;
  }): StoreResult {
    const key = normalizeInstrumentSymbol(input.instrument);
    if (!key) return { ok: false, status: "INVALID", reason: "Instrument required." };
    const conflict = this.versionConflict(input.expectedVersion);
    if (conflict) return conflict;
    const nowUtc = new Date().toISOString();
    const actor = String(input.actor || "admin").trim() || "admin";
    const prev = this.doc.instruments[key] ?? emptyInstrumentPolicy(key, nowUtc);
    const proposedVal = prev.spread.proposed?.value ?? null;
    const nextSpread: InstrumentSpreadPolicy = {
      ...prev.spread,
      proposed: null,
      approvalState: prev.spread.maxSpreadAbsolute != null ? "APPROVED" : "REJECTED",
      status: prev.spread.maxSpreadAbsolute != null ? "VERIFIED" : "NOT_CONFIGURED",
      reason: prev.spread.maxSpreadAbsolute != null
        ? null
        : (input.reason || "Proposed spread rejected — no active approved limit."),
      updatedAtUtc: nowUtc,
    };
    this.writeInstrument(key, { ...prev, instrument: key, spread: nextSpread }, {
      atUtc: nowUtc,
      actor,
      action: "REJECT_SPREAD",
      instrument: key,
      kind: "spread",
      detail: input.reason || "Rejected pending spread proposal.",
      previousValue: proposedVal,
      nextValue: prev.spread.maxSpreadAbsolute,
      policyVersion: this.doc.version + 1,
      configVersion: prev.spread.configVersion,
    }, nowUtc);
    return { ok: true, document: this.get() };
  }

  rejectSlippage(input: {
    instrument: string;
    actor?: string;
    reason?: string;
    expectedVersion?: number | null;
  }): StoreResult {
    const key = normalizeInstrumentSymbol(input.instrument);
    if (!key) return { ok: false, status: "INVALID", reason: "Instrument required." };
    const conflict = this.versionConflict(input.expectedVersion);
    if (conflict) return conflict;
    const nowUtc = new Date().toISOString();
    const actor = String(input.actor || "admin").trim() || "admin";
    const prev = this.doc.instruments[key] ?? emptyInstrumentPolicy(key, nowUtc);
    const proposedVal = prev.slippage.proposed?.value ?? null;
    const nextSlip: InstrumentSlippagePolicy = {
      ...prev.slippage,
      proposed: null,
      approvalState: prev.slippage.maxSlippageAbsolute != null ? "APPROVED" : "REJECTED",
      status: prev.slippage.maxSlippageAbsolute != null ? "VERIFIED" : "NOT_CONFIGURED",
      reason: prev.slippage.maxSlippageAbsolute != null
        ? null
        : (input.reason || "Proposed slippage rejected — no active approved limit."),
      updatedAtUtc: nowUtc,
    };
    this.writeInstrument(key, { ...prev, instrument: key, slippage: nextSlip }, {
      atUtc: nowUtc,
      actor,
      action: "REJECT_SLIPPAGE",
      instrument: key,
      kind: "slippage",
      detail: input.reason || "Rejected pending slippage proposal.",
      previousValue: proposedVal,
      nextValue: prev.slippage.maxSlippageAbsolute,
      policyVersion: this.doc.version + 1,
      configVersion: prev.slippage.configVersion,
    }, nowUtc);
    return { ok: true, document: this.get() };
  }

  rollbackSpread(input: {
    instrument: string;
    actor?: string;
    expectedVersion?: number | null;
  }): StoreResult {
    const key = normalizeInstrumentSymbol(input.instrument);
    if (!key) return { ok: false, status: "INVALID", reason: "Instrument required." };
    const conflict = this.versionConflict(input.expectedVersion);
    if (conflict) return conflict;
    const nowUtc = new Date().toISOString();
    const actor = String(input.actor || "admin").trim() || "admin";
    const prev = this.doc.instruments[key] ?? emptyInstrumentPolicy(key, nowUtc);
    const prior = prev.spread.history[prev.spread.history.length - 1];
    if (!prior || !validateAbsolutePriceLimit(prior.value).ok) {
      return { ok: false, status: "NOT_CONFIGURED", reason: "No prior approved spread revision to roll back to." };
    }
    const history = prev.spread.history.slice(0, -1);
    const configVersion = prev.spread.configVersion + 1;
    const nextSpread: InstrumentSpreadPolicy = {
      ...prev.spread,
      maxSpreadAbsolute: prior.value,
      pricePrecision: prior.pricePrecision,
      status: "VERIFIED",
      approvalState: "APPROVED",
      reason: null,
      configVersion,
      updatedAtUtc: nowUtc,
      approvedAtUtc: nowUtc,
      approvedBy: actor,
      effectiveAtUtc: nowUtc,
      proposed: null,
      history,
    };
    this.writeInstrument(key, { ...prev, instrument: key, spread: nextSpread }, {
      atUtc: nowUtc,
      actor,
      action: "ROLLBACK_SPREAD",
      instrument: key,
      kind: "spread",
      detail: `Rolled back spread to prior approved value=${prior.value} (configVersion ${prior.configVersion}).`,
      previousValue: prev.spread.maxSpreadAbsolute,
      nextValue: prior.value,
      policyVersion: this.doc.version + 1,
      configVersion,
    }, nowUtc);
    return { ok: true, document: this.get() };
  }

  rollbackSlippage(input: {
    instrument: string;
    actor?: string;
    expectedVersion?: number | null;
  }): StoreResult {
    const key = normalizeInstrumentSymbol(input.instrument);
    if (!key) return { ok: false, status: "INVALID", reason: "Instrument required." };
    const conflict = this.versionConflict(input.expectedVersion);
    if (conflict) return conflict;
    const nowUtc = new Date().toISOString();
    const actor = String(input.actor || "admin").trim() || "admin";
    const prev = this.doc.instruments[key] ?? emptyInstrumentPolicy(key, nowUtc);
    const prior = prev.slippage.history[prev.slippage.history.length - 1];
    if (!prior || !validateAbsolutePriceLimit(prior.value).ok) {
      return { ok: false, status: "NOT_CONFIGURED", reason: "No prior approved slippage revision to roll back to." };
    }
    const history = prev.slippage.history.slice(0, -1);
    const configVersion = prev.slippage.configVersion + 1;
    const nextSlip: InstrumentSlippagePolicy = {
      ...prev.slippage,
      maxSlippageAbsolute: prior.value,
      pricePrecision: prior.pricePrecision,
      status: "VERIFIED",
      approvalState: "APPROVED",
      reason: null,
      configVersion,
      updatedAtUtc: nowUtc,
      approvedAtUtc: nowUtc,
      approvedBy: actor,
      effectiveAtUtc: nowUtc,
      proposed: null,
      history,
    };
    this.writeInstrument(key, { ...prev, instrument: key, slippage: nextSlip }, {
      atUtc: nowUtc,
      actor,
      action: "ROLLBACK_SLIPPAGE",
      instrument: key,
      kind: "slippage",
      detail: `Rolled back slippage to prior approved value=${prior.value} (configVersion ${prior.configVersion}).`,
      previousValue: prev.slippage.maxSlippageAbsolute,
      nextValue: prior.value,
      policyVersion: this.doc.version + 1,
      configVersion,
    }, nowUtc);
    return { ok: true, document: this.get() };
  }

  clearSpread(input: {
    instrument: string;
    actor?: string;
    expectedVersion?: number | null;
  }): StoreResult {
    const key = normalizeInstrumentSymbol(input.instrument);
    if (!key) return { ok: false, status: "INVALID", reason: "Instrument required." };
    const conflict = this.versionConflict(input.expectedVersion);
    if (conflict) return conflict;
    const nowUtc = new Date().toISOString();
    const actor = String(input.actor || "admin").trim() || "admin";
    const prev = this.doc.instruments[key] ?? emptyInstrumentPolicy(key, nowUtc);
    const previousValue = prev.spread.maxSpreadAbsolute;
    const next = emptyInstrumentPolicy(key, nowUtc);
    next.slippage = prev.slippage;
    next.spread = {
      ...emptyInstrumentPolicy(key, nowUtc).spread,
      createdAtUtc: prev.spread.createdAtUtc,
      history: prev.spread.history,
    };
    this.writeInstrument(key, next, {
      atUtc: nowUtc,
      actor,
      action: "CLEAR_SPREAD",
      instrument: key,
      kind: "spread",
      detail: "Cleared active and proposed spread — NOT_CONFIGURED.",
      previousValue,
      nextValue: null,
      policyVersion: this.doc.version + 1,
      configVersion: prev.spread.configVersion,
    }, nowUtc);
    return { ok: true, document: this.get() };
  }

  clearSlippage(input: {
    instrument: string;
    actor?: string;
    expectedVersion?: number | null;
  }): StoreResult {
    const key = normalizeInstrumentSymbol(input.instrument);
    if (!key) return { ok: false, status: "INVALID", reason: "Instrument required." };
    const conflict = this.versionConflict(input.expectedVersion);
    if (conflict) return conflict;
    const nowUtc = new Date().toISOString();
    const actor = String(input.actor || "admin").trim() || "admin";
    const prev = this.doc.instruments[key] ?? emptyInstrumentPolicy(key, nowUtc);
    const previousValue = prev.slippage.maxSlippageAbsolute;
    const next = emptyInstrumentPolicy(key, nowUtc);
    next.spread = prev.spread;
    next.slippage = {
      ...emptyInstrumentPolicy(key, nowUtc).slippage,
      createdAtUtc: prev.slippage.createdAtUtc,
      history: prev.slippage.history,
    };
    this.writeInstrument(key, next, {
      atUtc: nowUtc,
      actor,
      action: "CLEAR_SLIPPAGE",
      instrument: key,
      kind: "slippage",
      detail: "Cleared active and proposed slippage — NOT_CONFIGURED.",
      previousValue,
      nextValue: null,
      policyVersion: this.doc.version + 1,
      configVersion: prev.slippage.configVersion,
    }, nowUtc);
    return { ok: true, document: this.get() };
  }

  private versionConflict(expected: number | null | undefined): StoreResult | null {
    if (expected == null) return null;
    if (!Number.isInteger(expected)) {
      return { ok: false, status: "VERSION_CONFLICT", reason: "expectedVersion must be an integer." };
    }
    if (expected !== this.doc.version) {
      return {
        ok: false,
        status: "VERSION_CONFLICT",
        reason: `Document version is ${this.doc.version}, expected ${expected}.`,
      };
    }
    return null;
  }

  private appendReject(
    instrument: string,
    kind: "spread" | "slippage",
    actor: string | undefined,
    reason: string,
  ): void {
    const nowUtc = new Date().toISOString();
    this.appendAudit({
      atUtc: nowUtc,
      actor: String(actor || "admin").trim() || "admin",
      action: "REJECT_INVALID",
      instrument,
      kind,
      detail: reason,
      previousValue: null,
      nextValue: null,
      policyVersion: this.doc.version,
      configVersion: null,
    }, nowUtc);
  }

  private writeInstrument(
    key: string,
    policy: InstrumentRiskPolicy,
    audit: RiskPolicyAuditEntry,
    nowUtc: string,
  ): void {
    this.doc = {
      ...this.doc,
      stage: RISK_POLICY_STAGE,
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
      const instruments: Record<string, InstrumentRiskPolicy> = {};
      for (const inst of STAGE3_TRACKED_INSTRUMENTS) {
        instruments[inst] = migrateInstrumentPolicy(inst, raw.instruments[inst], nowUtc);
      }
      for (const [key, val] of Object.entries(raw.instruments || {})) {
        if (!instruments[key]) instruments[key] = migrateInstrumentPolicy(key, val, nowUtc);
      }
      return {
        schemaVersion: RISK_POLICY_SCHEMA,
        stage: RISK_POLICY_STAGE,
        version: typeof raw.version === "number" ? raw.version : 1,
        updatedAtUtc: raw.updatedAtUtc || nowUtc,
        instruments,
        audit: Array.isArray(raw.audit)
          ? raw.audit.map((a) => ({
            ...a,
            kind: a.kind ?? null,
            policyVersion: a.policyVersion ?? null,
            configVersion: a.configVersion ?? null,
          })).slice(-200)
          : [],
        placesOrders: false,
        acceptsForExecution: false,
        mutatesBroker: false,
        note: raw.note || emptyDocument(nowUtc).note,
      };
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
  // Always default to OS temp — never leak disposable stores into the repo cwd.
  shared = new AtRiskPolicyStore(
    filePath ?? path.join(
      os.tmpdir(),
      `.kwizera-test-risk-policy-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.json`,
    ),
  );
  return shared;
}
