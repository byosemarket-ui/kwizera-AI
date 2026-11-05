import fs from "node:fs";
import path from "node:path";
import { resolveStorageRoot } from "../../../../storage/paths/storage-paths.js";
import { writeJsonAtomicSync } from "../../../../storage/safe-json.js";
import type {
  AtBrokerExecutionAuditAppendResult,
  AtBrokerExecutionAuditDecision,
  AtBrokerExecutionAuditEvent,
  AtBrokerExecutionAuthorizationIntent,
  AtBrokerExecutionFoundationPersisted,
  AtBrokerExecutionLifecycle,
} from "./types.js";
import {
  AT_BROKER_EXECUTION_MAX_AUDIT,
  AT_BROKER_EXECUTION_PHASE,
  AT_BROKER_EXECUTION_SCHEMA,
} from "./types.js";
import { assertPhase1Transition } from "./state-machine.js";

function storePath(storageRoot: string): string {
  return path.join(storageRoot, "forex-automated-trading", "broker-execution-foundation.json");
}

function newCorrelationId(prefix = "be"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function defaultFoundation(nowMs = Date.now()): AtBrokerExecutionFoundationPersisted {
  const now = new Date(nowMs).toISOString();
  return {
    schemaVersion: AT_BROKER_EXECUTION_SCHEMA,
    phase: AT_BROKER_EXECUTION_PHASE,
    stateVersion: 1,
    executionMasterEnabled: false,
    armedForSubmission: false,
    lifecycle: "IDLE",
    environmentBound: "UNBOUND",
    activeHandoffId: null,
    activeProposalId: null,
    activeAuthorizationId: null,
    blockers: [
      {
        code: "PHASE1_SUBMIT_FORBIDDEN",
        message: "Phase 1 foundation only — broker submission not implemented.",
      },
      {
        code: "EXECUTION_MASTER_OFF",
        message: "Execution Master defaults to OFF.",
      },
    ],
    authorizationIntents: [],
    audit: [],
    updatedAtUtc: now,
    updatedBy: "system",
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    brokerExecution: "DISABLED",
    phaseNote:
      "Broker Execution Engine Phase 1: architecture + safety foundation. "
      + "placesOrders=false, acceptsForExecution=false, mutatesBroker=false. "
      + "System Master does not authorize execution. HANDOFF_READY is not permission to submit. "
      + "GET status does not write durable audit (see audit-policy).",
  };
}

function normalizeAuditEvent(raw: unknown): AtBrokerExecutionAuditEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.atUtc !== "string" || typeof o.actor !== "string") {
    return null;
  }
  const decision =
    o.decision === "ALLOW" || o.decision === "DENY"
      ? (o.decision as AtBrokerExecutionAuditDecision)
      : null;
  return {
    id: o.id,
    atUtc: o.atUtc,
    actor: o.actor,
    action: typeof o.action === "string" ? o.action : "UNKNOWN",
    detail: typeof o.detail === "string" ? o.detail : "",
    // Legacy rows: leave null — never invent correlation/decision/reason.
    correlationId: typeof o.correlationId === "string" ? o.correlationId : null,
    decision,
    reasonCode: typeof o.reasonCode === "string" ? o.reasonCode : null,
    handoffId: typeof o.handoffId === "string" ? o.handoffId : null,
    proposalId: typeof o.proposalId === "string" ? o.proposalId : null,
    lifecycle: (typeof o.lifecycle === "string" ? o.lifecycle : null) as AtBrokerExecutionLifecycle | null,
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
  };
}

function normalize(raw: unknown): AtBrokerExecutionFoundationPersisted {
  const base = defaultFoundation();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const auditRaw = Array.isArray(o.audit) ? o.audit : [];
  const audit = auditRaw
    .map((row) => normalizeAuditEvent(row))
    .filter((row): row is AtBrokerExecutionAuditEvent => row != null);
  return {
    ...base,
    stateVersion: typeof o.stateVersion === "number" && Number.isFinite(o.stateVersion)
      ? Math.max(1, Math.floor(o.stateVersion))
      : base.stateVersion,
    executionMasterEnabled: false,
    armedForSubmission: false,
    lifecycle: (o.lifecycle === "AUTHORIZATION_REQUIRED"
      || o.lifecycle === "PRECHECK_BLOCKED"
      || o.lifecycle === "SUPERSEDED"
      || o.lifecycle === "IDLE")
      ? o.lifecycle
      : "IDLE",
    environmentBound: o.environmentBound === "DEMO" || o.environmentBound === "LIVE"
      ? o.environmentBound
      : "UNBOUND",
    activeHandoffId: typeof o.activeHandoffId === "string" ? o.activeHandoffId : null,
    activeProposalId: typeof o.activeProposalId === "string" ? o.activeProposalId : null,
    activeAuthorizationId: typeof o.activeAuthorizationId === "string" ? o.activeAuthorizationId : null,
    blockers: Array.isArray(o.blockers) ? o.blockers as AtBrokerExecutionFoundationPersisted["blockers"] : base.blockers,
    authorizationIntents: Array.isArray(o.authorizationIntents)
      ? (o.authorizationIntents as AtBrokerExecutionAuthorizationIntent[]).map((i) => ({
        ...i,
        activatesMutation: false as const,
      }))
      : [],
    audit,
    updatedAtUtc: typeof o.updatedAtUtc === "string" ? o.updatedAtUtc : base.updatedAtUtc,
    updatedBy: typeof o.updatedBy === "string" ? o.updatedBy : base.updatedBy,
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    brokerExecution: "DISABLED",
    phaseNote: base.phaseNote,
    schemaVersion: AT_BROKER_EXECUTION_SCHEMA,
    phase: AT_BROKER_EXECUTION_PHASE,
  };
}

export class AtBrokerExecutionStore {
  readonly file: string;
  private data: AtBrokerExecutionFoundationPersisted;
  lastWriteError: string | null = null;

  constructor(storageRoot?: string) {
    const root = storageRoot ?? resolveStorageRoot();
    this.file = storePath(root);
    this.data = this.load();
  }

  private load(): AtBrokerExecutionFoundationPersisted {
    try {
      if (!fs.existsSync(this.file)) return defaultFoundation();
      const raw = JSON.parse(fs.readFileSync(this.file, "utf8"));
      return normalize(raw);
    } catch {
      return defaultFoundation();
    }
  }

  private persist(): boolean {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      writeJsonAtomicSync(this.file, this.data);
      this.lastWriteError = null;
      return true;
    } catch (err) {
      this.lastWriteError = err instanceof Error ? err.message : String(err);
      return false;
    }
  }

  get(): AtBrokerExecutionFoundationPersisted {
    return {
      ...this.data,
      blockers: [...this.data.blockers],
      authorizationIntents: [...this.data.authorizationIntents],
      audit: [...this.data.audit],
      placesOrders: false,
      acceptsForExecution: false,
      mutatesBroker: false,
      brokerExecution: "DISABLED",
      executionMasterEnabled: false,
      armedForSubmission: false,
    };
  }

  /**
   * Append a structured audit event. On persist failure rolls back the in-memory
   * append so the event is not represented as durably recorded.
   */
  appendAudit(
    event: Omit<AtBrokerExecutionAuditEvent, "placesOrders" | "acceptsForExecution" | "mutatesBroker">,
  ): AtBrokerExecutionAuditAppendResult {
    const stamped: AtBrokerExecutionAuditEvent = {
      ...event,
      correlationId: event.correlationId ?? null,
      decision: event.decision ?? null,
      reasonCode: event.reasonCode ?? null,
      placesOrders: false,
      acceptsForExecution: false,
      mutatesBroker: false,
    };
    const previousAudit = this.data.audit;
    const previousVersion = this.data.stateVersion;
    const previousUpdatedAt = this.data.updatedAtUtc;
    const previousUpdatedBy = this.data.updatedBy;

    this.data.audit = [stamped, ...this.data.audit].slice(0, AT_BROKER_EXECUTION_MAX_AUDIT);
    this.data.stateVersion += 1;
    this.data.updatedAtUtc = stamped.atUtc;
    this.data.updatedBy = stamped.actor;

    if (!this.persist()) {
      this.data.audit = previousAudit;
      this.data.stateVersion = previousVersion;
      this.data.updatedAtUtc = previousUpdatedAt;
      this.data.updatedBy = previousUpdatedBy;
      return {
        ok: false,
        persisted: false,
        code: "AUDIT_PERSIST_FAILED",
        message: `Required audit event could not be persisted: ${this.lastWriteError ?? "unknown write error"}`,
        event: stamped,
      };
    }
    return { ok: true, persisted: true, event: stamped };
  }

  requestEnableExecutionMaster(
    actor: string,
    correlationId?: string,
  ): {
    ok: false;
    code: "PHASE1_SUBMIT_FORBIDDEN" | "AUDIT_PERSIST_FAILED";
    message: string;
    foundation: AtBrokerExecutionFoundationPersisted;
    correlationId: string;
  } {
    const corr = correlationId?.trim() || newCorrelationId("be-deny");
    const atUtc = new Date().toISOString();
    const audit = this.appendAudit({
      id: `be-audit-${Date.now().toString(36)}`,
      atUtc,
      actor,
      action: "REQUEST_EXECUTION_MASTER_ON",
      detail: "Rejected — Phase 1 forbids enabling Execution Master / submission.",
      correlationId: corr,
      decision: "DENY",
      reasonCode: "PHASE1_SUBMIT_FORBIDDEN",
      handoffId: this.data.activeHandoffId,
      proposalId: this.data.activeProposalId,
      lifecycle: this.data.lifecycle,
    });
    // Fail-closed: never enable master even if audit persist fails.
    this.data.executionMasterEnabled = false;
    this.data.armedForSubmission = false;
    if (!audit.ok) {
      return {
        ok: false,
        code: "AUDIT_PERSIST_FAILED",
        message: audit.message,
        foundation: this.get(),
        correlationId: corr,
      };
    }
    return {
      ok: false,
      code: "PHASE1_SUBMIT_FORBIDDEN",
      message: "Phase 1 cannot enable Execution Master or arm submission. Wait for later phases + owner review.",
      foundation: this.get(),
      correlationId: corr,
    };
  }

  transitionLifecycle(
    to: AtBrokerExecutionLifecycle,
    actor: string,
    detail: string,
    correlationId?: string,
  ): {
    ok: true;
    foundation: AtBrokerExecutionFoundationPersisted;
    correlationId: string;
  } | {
    ok: false;
    code: string;
    message: string;
    foundation: AtBrokerExecutionFoundationPersisted;
    correlationId: string;
  } {
    const corr = correlationId?.trim() || newCorrelationId("be-life");
    const gate = assertPhase1Transition(this.data.lifecycle, to);
    if (!gate.ok) {
      const atUtc = new Date().toISOString();
      const audit = this.appendAudit({
        id: `be-audit-${Date.now().toString(36)}`,
        atUtc,
        actor,
        action: "LIFECYCLE_TRANSITION_DENIED",
        detail: `${this.data.lifecycle} → ${to}: ${gate.message}`,
        correlationId: corr,
        decision: "DENY",
        reasonCode: gate.code,
        handoffId: this.data.activeHandoffId,
        proposalId: this.data.activeProposalId,
        lifecycle: this.data.lifecycle,
      });
      if (!audit.ok) {
        return {
          ok: false,
          code: "AUDIT_PERSIST_FAILED",
          message: audit.message,
          foundation: this.get(),
          correlationId: corr,
        };
      }
      return {
        ok: false,
        code: gate.code,
        message: gate.message,
        foundation: this.get(),
        correlationId: corr,
      };
    }

    const from = this.data.lifecycle;
    this.data.lifecycle = to;
    const atUtc = new Date().toISOString();
    const audit = this.appendAudit({
      id: `be-audit-${Date.now().toString(36)}`,
      atUtc,
      actor,
      action: "LIFECYCLE_TRANSITION",
      detail: `${from} → ${to}: ${detail}`,
      correlationId: corr,
      decision: "ALLOW",
      reasonCode: "PHASE1_TRANSITION_OK",
      handoffId: this.data.activeHandoffId,
      proposalId: this.data.activeProposalId,
      lifecycle: to,
    });
    if (!audit.ok) {
      // Roll back lifecycle change if the durable audit could not be written.
      this.data.lifecycle = from;
      return {
        ok: false,
        code: "AUDIT_PERSIST_FAILED",
        message: audit.message,
        foundation: this.get(),
        correlationId: corr,
      };
    }
    return { ok: true, foundation: this.get(), correlationId: corr };
  }

  recordAuthorizationIntent(
    intent: AtBrokerExecutionAuthorizationIntent,
    actor: string,
    correlationId?: string,
  ): {
    ok: true;
    foundation: AtBrokerExecutionFoundationPersisted;
    correlationId: string;
  } | {
    ok: false;
    code: "AUDIT_PERSIST_FAILED";
    message: string;
    foundation: AtBrokerExecutionFoundationPersisted;
    correlationId: string;
  } {
    const corr = correlationId?.trim() || newCorrelationId("be-intent");
    const stamped = { ...intent, activatesMutation: false as const };
    const previous = {
      intents: this.data.authorizationIntents,
      activeAuthorizationId: this.data.activeAuthorizationId,
      activeHandoffId: this.data.activeHandoffId,
      activeProposalId: this.data.activeProposalId,
      environmentBound: this.data.environmentBound,
      lifecycle: this.data.lifecycle,
    };

    this.data.authorizationIntents = [stamped, ...this.data.authorizationIntents].slice(0, 40);
    this.data.activeAuthorizationId = stamped.authorizationId;
    this.data.activeHandoffId = stamped.handoffId;
    this.data.activeProposalId = stamped.proposalId;
    this.data.environmentBound = stamped.environment;
    const hop = assertPhase1Transition(this.data.lifecycle, "AUTHORIZATION_REQUIRED");
    if (hop.ok) this.data.lifecycle = "AUTHORIZATION_REQUIRED";

    const atUtc = new Date().toISOString();
    const audit = this.appendAudit({
      id: `be-audit-${Date.now().toString(36)}`,
      atUtc,
      actor,
      action: "AUTHORIZATION_INTENT_RECORDED",
      detail: `Intent ${stamped.authorizationId} recorded with activatesMutation=false.`,
      correlationId: corr,
      decision: "ALLOW",
      reasonCode: "INTENT_RECORDED_NO_MUTATION",
      handoffId: stamped.handoffId,
      proposalId: stamped.proposalId,
      lifecycle: this.data.lifecycle,
    });
    if (!audit.ok) {
      this.data.authorizationIntents = previous.intents;
      this.data.activeAuthorizationId = previous.activeAuthorizationId;
      this.data.activeHandoffId = previous.activeHandoffId;
      this.data.activeProposalId = previous.activeProposalId;
      this.data.environmentBound = previous.environmentBound;
      this.data.lifecycle = previous.lifecycle;
      return {
        ok: false,
        code: "AUDIT_PERSIST_FAILED",
        message: audit.message,
        foundation: this.get(),
        correlationId: corr,
      };
    }
    return { ok: true, foundation: this.get(), correlationId: corr };
  }

  listAudit(limit = 40): AtBrokerExecutionAuditEvent[] {
    return this.data.audit.slice(0, Math.max(1, Math.min(AT_BROKER_EXECUTION_MAX_AUDIT, limit)));
  }
}

let singleton: AtBrokerExecutionStore | null = null;
const byRoot = new Map<string, AtBrokerExecutionStore>();

export function getAtBrokerExecutionStore(storageRoot?: string): AtBrokerExecutionStore {
  if (storageRoot) {
    const existing = byRoot.get(storageRoot);
    if (existing) return existing;
    const created = new AtBrokerExecutionStore(storageRoot);
    byRoot.set(storageRoot, created);
    return created;
  }
  if (!singleton) singleton = new AtBrokerExecutionStore();
  return singleton;
}

export function resetAtBrokerExecutionStoreForTests(): void {
  singleton = null;
  byRoot.clear();
}
