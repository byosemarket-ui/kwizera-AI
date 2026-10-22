/**
 * Phase 56.2 / 56.2.3 — Persist simulation drafts + strategy capital reservations.
 * Reservations are simulation accounting only — not broker margin holds.
 */
import fs from "node:fs";
import path from "node:path";
import { resolveStorageRoot } from "../../../../storage/paths/storage-paths.js";
import { readJsonSafeSync, writeJsonAtomic } from "../../../../storage/safe-json.js";
import {
  sumActiveReservations,
  type CapitalBudgetReservation,
} from "./capital-budget.js";
import { normalizeSimRiskPolicy } from "./engine.js";
import {
  AT_SIM_RISK_PHASE,
  AT_SIM_RISK_SCHEMA,
  defaultSimRiskPolicy,
  type AtSimDraftResult,
  type AtSimRiskPolicy,
} from "./types.js";

const MAX_HISTORY = 20;
const MAX_RESERVATIONS = 100;

interface StoreFile {
  schemaVersion: typeof AT_SIM_RISK_SCHEMA;
  phase: typeof AT_SIM_RISK_PHASE;
  policy: AtSimRiskPolicy;
  latestId: string | null;
  history: AtSimDraftResult[];
  capitalReservations: CapitalBudgetReservation[];
}

function storePath(storageRoot?: string): string {
  return path.join(
    storageRoot ?? resolveStorageRoot(),
    "forex-automated-trading",
    "simulation-drafts.json",
  );
}

function normalizeReservation(raw: unknown): CapitalBudgetReservation | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.draftId !== "string" || !o.draftId) return null;
  const amount = Number(o.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const status = o.status === "RELEASED" ? "RELEASED" : "ACTIVE";
  return {
    draftId: o.draftId,
    environment: typeof o.environment === "string" ? o.environment : "DEMO",
    amount,
    status,
    createdAtUtc: typeof o.createdAtUtc === "string" ? o.createdAtUtc : new Date().toISOString(),
    releasedAtUtc: typeof o.releasedAtUtc === "string" ? o.releasedAtUtc : null,
  };
}

function normalize(raw: unknown): StoreFile {
  const defaults: StoreFile = {
    schemaVersion: AT_SIM_RISK_SCHEMA,
    phase: AT_SIM_RISK_PHASE,
    policy: defaultSimRiskPolicy(),
    latestId: null,
    history: [],
    capitalReservations: [],
  };
  if (!raw || typeof raw !== "object") return defaults;
  const o = raw as Record<string, unknown>;
  const history = Array.isArray(o.history)
    ? (o.history as AtSimDraftResult[])
      .filter((x) => x && typeof x === "object" && typeof x.draftId === "string")
      .slice(0, MAX_HISTORY)
    : [];
  const capitalReservations = Array.isArray(o.capitalReservations)
    ? o.capitalReservations
      .map(normalizeReservation)
      .filter((x): x is CapitalBudgetReservation => x != null)
      .slice(0, MAX_RESERVATIONS)
    : [];
  return {
    schemaVersion: AT_SIM_RISK_SCHEMA,
    phase: AT_SIM_RISK_PHASE,
    policy: normalizeSimRiskPolicy(o.policy ?? defaults.policy),
    latestId: typeof o.latestId === "string" ? o.latestId : history[0]?.draftId ?? null,
    history,
    capitalReservations,
  };
}

export class AtSimRiskStore {
  private data: StoreFile;
  private readonly file: string;

  constructor(storageRoot?: string) {
    this.file = storePath(storageRoot);
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    this.data = normalize(readJsonSafeSync(this.file, null).value);
  }

  getPolicy(): AtSimRiskPolicy {
    return { ...this.data.policy };
  }

  async setPolicy(policy: AtSimRiskPolicy): Promise<AtSimRiskPolicy> {
    this.data = {
      ...this.data,
      schemaVersion: AT_SIM_RISK_SCHEMA,
      phase: AT_SIM_RISK_PHASE,
      policy: normalizeSimRiskPolicy(policy),
    };
    await writeJsonAtomic(this.file, this.data);
    return this.getPolicy();
  }

  getLatest(): AtSimDraftResult | null {
    const id = this.data.latestId;
    if (!id) return this.data.history[0] ?? null;
    return this.data.history.find((h) => h.draftId === id) ?? this.data.history[0] ?? null;
  }

  getById(draftId: string): AtSimDraftResult | null {
    const id = String(draftId ?? "").trim();
    if (!id) return null;
    return this.data.history.find((h) => h.draftId === id) ?? null;
  }

  listHistory(limit = 12): AtSimDraftResult[] {
    return this.data.history.slice(0, Math.max(1, Math.min(MAX_HISTORY, limit)));
  }

  historyCount(): number {
    return this.data.history.length;
  }

  listReservations(): CapitalBudgetReservation[] {
    return this.data.capitalReservations.map((r) => ({ ...r }));
  }

  sumActiveReserved(environment: string, excludeDraftId?: string | null): number {
    return sumActiveReservations(this.data.capitalReservations, environment, excludeDraftId);
  }

  /**
   * Atomic reserve: fails if amount would exceed remainingBudget.
   * Releases any prior ACTIVE reservation for the same draftId first.
   */
  async tryReserve(input: {
    draftId: string;
    environment: string;
    amount: number;
    capitalAllocationBudget: number;
  }): Promise<{ ok: true; reservedActive: number } | { ok: false; code: string; message: string }> {
    const amount = input.amount;
    const budget = input.capitalAllocationBudget;
    if (!(Number.isFinite(amount) && amount > 0) || !(Number.isFinite(budget) && budget > 0)) {
      return { ok: false, code: "RESERVE_INVALID", message: "Invalid reservation amount or budget." };
    }
    const now = new Date().toISOString();
    const withoutDraft = this.data.capitalReservations.map((r) =>
      r.draftId === input.draftId && r.status === "ACTIVE"
        ? { ...r, status: "RELEASED" as const, releasedAtUtc: now }
        : r,
    );
    const reservedOthers = sumActiveReservations(withoutDraft, input.environment);
    if (reservedOthers + amount > budget + 1e-9) {
      return {
        ok: false,
        code: "STRATEGY_BUDGET_EXHAUSTED",
        message: `Reservation ${amount} would exceed remaining strategy budget ${budget - reservedOthers}.`,
      };
    }
    const next: CapitalBudgetReservation = {
      draftId: input.draftId,
      environment: input.environment,
      amount,
      status: "ACTIVE",
      createdAtUtc: now,
      releasedAtUtc: null,
    };
    this.data = {
      ...this.data,
      capitalReservations: [next, ...withoutDraft].slice(0, MAX_RESERVATIONS),
    };
    await writeJsonAtomic(this.file, this.data);
    return { ok: true, reservedActive: reservedOthers + amount };
  }

  async releaseReservation(draftId: string): Promise<void> {
    const now = new Date().toISOString();
    this.data = {
      ...this.data,
      capitalReservations: this.data.capitalReservations.map((r) =>
        r.draftId === draftId && r.status === "ACTIVE"
          ? { ...r, status: "RELEASED", releasedAtUtc: now }
          : r,
      ),
    };
    await writeJsonAtomic(this.file, this.data);
  }

  async append(result: AtSimDraftResult): Promise<AtSimDraftResult> {
    const history = [result, ...this.data.history.filter((h) => h.draftId !== result.draftId)]
      .slice(0, MAX_HISTORY);
    // Rejected / blocked drafts release any prior reservation for this draftId.
    const shouldRelease =
      result.overallStatus === "REJECTED_LOCAL"
      || result.overallStatus === "BLOCKED_INSUFFICIENT_DATA"
      || result.overallStatus === "BLOCKED_POLICY_UNDECIDED"
      || result.capitalBudgetAnalysis?.perOrderAllocation == null
      || result.capitalBudgetAnalysis?.perOrderLossLimitPass === false;

    let capitalReservations = this.data.capitalReservations;
    const now = new Date().toISOString();
    if (shouldRelease) {
      capitalReservations = capitalReservations.map((r) =>
        r.draftId === result.draftId && r.status === "ACTIVE"
          ? { ...r, status: "RELEASED" as const, releasedAtUtc: now }
          : r,
      );
    } else if (
      result.capitalBudgetAnalysis?.perOrderAllocation != null
      && result.capitalBudgetAnalysis.perOrderAllocation > 0
      && result.capitalBudgetAnalysis.capitalAllocationBudget != null
    ) {
      const amount = result.capitalBudgetAnalysis.perOrderAllocation;
      const budget = result.capitalBudgetAnalysis.capitalAllocationBudget;
      const withoutDraft = capitalReservations.map((r) =>
        r.draftId === result.draftId && r.status === "ACTIVE"
          ? { ...r, status: "RELEASED" as const, releasedAtUtc: now }
          : r,
      );
      const reservedOthers = sumActiveReservations(withoutDraft, result.environment);
      if (reservedOthers + amount <= budget + 1e-9) {
        capitalReservations = [
          {
            draftId: result.draftId,
            environment: result.environment,
            amount,
            status: "ACTIVE",
            createdAtUtc: now,
            releasedAtUtc: null,
          },
          ...withoutDraft,
        ].slice(0, MAX_RESERVATIONS);
      }
    }

    this.data = {
      ...this.data,
      schemaVersion: AT_SIM_RISK_SCHEMA,
      phase: AT_SIM_RISK_PHASE,
      latestId: result.draftId,
      history,
      capitalReservations,
    };
    await writeJsonAtomic(this.file, this.data);
    return result;
  }
}

let storeSingleton: AtSimRiskStore | null = null;

export function getAtSimRiskStore(storageRoot?: string): AtSimRiskStore {
  if (storageRoot) return new AtSimRiskStore(storageRoot);
  if (!storeSingleton) storeSingleton = new AtSimRiskStore();
  return storeSingleton;
}

export function resetAtSimRiskStoreForTests(): void {
  storeSingleton = null;
}
