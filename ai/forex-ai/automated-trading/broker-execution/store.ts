import fs from "node:fs";
import path from "node:path";
import { resolveStorageRoot } from "../../../../storage/paths/storage-paths.js";
import { writeJsonAtomicSync } from "../../../../storage/safe-json.js";
import type {
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
      + "System Master does not authorize execution. HANDOFF_READY is not permission to submit.",
  };
}

function normalize(raw: unknown): AtBrokerExecutionFoundationPersisted {
  const base = defaultFoundation();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  return {
    ...base,
    stateVersion: typeof o.stateVersion === "number" && Number.isFinite(o.stateVersion)
      ? Math.max(1, Math.floor(o.stateVersion))
      : base.stateVersion,
    executionMasterEnabled: false, // Phase 1: never restore ON from disk as armed submit
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
    audit: Array.isArray(o.audit) ? o.audit as AtBrokerExecutionAuditEvent[] : [],
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

  private persist(): void {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      writeJsonAtomicSync(this.file, this.data);
      this.lastWriteError = null;
    } catch (err) {
      this.lastWriteError = err instanceof Error ? err.message : String(err);
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
    };
  }

  appendAudit(event: Omit<AtBrokerExecutionAuditEvent, "placesOrders" | "acceptsForExecution" | "mutatesBroker">): void {
    const stamped: AtBrokerExecutionAuditEvent = {
      ...event,
      placesOrders: false,
      acceptsForExecution: false,
      mutatesBroker: false,
    };
    this.data.audit = [stamped, ...this.data.audit].slice(0, AT_BROKER_EXECUTION_MAX_AUDIT);
    this.data.stateVersion += 1;
    this.data.updatedAtUtc = stamped.atUtc;
    this.data.updatedBy = stamped.actor;
    this.persist();
  }

  /**
   * Phase 1: refuse enabling Execution Master or arming for submission.
   * Records the attempt in audit and returns blockers.
   */
  requestEnableExecutionMaster(actor: string): {
    ok: false;
    code: "PHASE1_SUBMIT_FORBIDDEN";
    message: string;
    foundation: AtBrokerExecutionFoundationPersisted;
  } {
    const atUtc = new Date().toISOString();
    this.appendAudit({
      id: `be-audit-${Date.now().toString(36)}`,
      atUtc,
      actor,
      action: "REQUEST_EXECUTION_MASTER_ON",
      detail: "Rejected — Phase 1 forbids enabling Execution Master / submission.",
      handoffId: this.data.activeHandoffId,
      proposalId: this.data.activeProposalId,
      lifecycle: this.data.lifecycle,
    });
    return {
      ok: false,
      code: "PHASE1_SUBMIT_FORBIDDEN",
      message: "Phase 1 cannot enable Execution Master or arm submission. Wait for later phases + owner review.",
      foundation: this.get(),
    };
  }

  transitionLifecycle(
    to: AtBrokerExecutionLifecycle,
    actor: string,
    detail: string,
  ): { ok: true; foundation: AtBrokerExecutionFoundationPersisted } | {
    ok: false;
    code: string;
    message: string;
    foundation: AtBrokerExecutionFoundationPersisted;
  } {
    const gate = assertPhase1Transition(this.data.lifecycle, to);
    if (!gate.ok) {
      return { ok: false, code: gate.code, message: gate.message, foundation: this.get() };
    }
    const from = this.data.lifecycle;
    this.data.lifecycle = to;
    this.data.stateVersion += 1;
    this.data.updatedAtUtc = new Date().toISOString();
    this.data.updatedBy = actor;
    this.appendAudit({
      id: `be-audit-${Date.now().toString(36)}`,
      atUtc: this.data.updatedAtUtc,
      actor,
      action: "LIFECYCLE_TRANSITION",
      detail: `${from} → ${to}: ${detail}`,
      handoffId: this.data.activeHandoffId,
      proposalId: this.data.activeProposalId,
      lifecycle: to,
    });
    this.persist();
    return { ok: true, foundation: this.get() };
  }

  recordAuthorizationIntent(intent: AtBrokerExecutionAuthorizationIntent, actor: string): AtBrokerExecutionFoundationPersisted {
    const stamped = { ...intent, activatesMutation: false as const };
    this.data.authorizationIntents = [stamped, ...this.data.authorizationIntents].slice(0, 40);
    this.data.activeAuthorizationId = stamped.authorizationId;
    this.data.activeHandoffId = stamped.handoffId;
    this.data.activeProposalId = stamped.proposalId;
    this.data.environmentBound = stamped.environment;
    const hop = assertPhase1Transition(this.data.lifecycle, "AUTHORIZATION_REQUIRED");
    if (hop.ok) this.data.lifecycle = "AUTHORIZATION_REQUIRED";
    this.data.stateVersion += 1;
    this.data.updatedAtUtc = new Date().toISOString();
    this.data.updatedBy = actor;
    this.appendAudit({
      id: `be-audit-${Date.now().toString(36)}`,
      atUtc: this.data.updatedAtUtc,
      actor,
      action: "AUTHORIZATION_INTENT_RECORDED",
      detail: `Intent ${stamped.authorizationId} recorded with activatesMutation=false.`,
      handoffId: stamped.handoffId,
      proposalId: stamped.proposalId,
      lifecycle: this.data.lifecycle,
    });
    this.persist();
    return this.get();
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
