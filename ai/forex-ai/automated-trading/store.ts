/**
 * Phase 51 — Persist Automated Trading config (no credentials).
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { resolveStorageRoot } from "../../../storage/paths/storage-paths.js";
import { readJsonSafeSync, writeJsonAtomic } from "../../../storage/safe-json.js";
import {
  AUTOMATED_TRADING_SCHEMA,
  defaultEnvControls,
  defaultPersistedState,
  parseAutomatedTradingEnvironment,
  type AutomatedTradingAuditEvent,
  type AutomatedTradingEnvControls,
  type AutomatedTradingEnvironment,
  type AutomatedTradingEnvState,
  type AutomatedTradingPersistedState,
} from "./types.js";

interface StoreFile {
  state: AutomatedTradingPersistedState;
  audit: AutomatedTradingAuditEvent[];
}

const MAX_AUDIT = 200;

function storePath(storageRoot?: string): string {
  return path.join(storageRoot ?? resolveStorageRoot(), "forex-automated-trading", "settings.json");
}

function normalizeControls(raw: unknown): AutomatedTradingEnvControls {
  const base = defaultEnvControls();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  return {
    masterEnable: Boolean(o.masterEnable),
    automaticEntry: Boolean(o.automaticEntry),
    positionManagement: Boolean(o.positionManagement),
    emergencyEntryLock: o.emergencyEntryLock === false ? false : true,
  };
}

function normalizeState(raw: unknown): AutomatedTradingPersistedState {
  const defaults = defaultPersistedState();
  if (!raw || typeof raw !== "object") return defaults;
  const o = raw as Record<string, unknown>;
  const selected =
    parseAutomatedTradingEnvironment(o.selectedEnvironment) ?? defaults.selectedEnvironment;
  const envsRaw = (o.environments && typeof o.environments === "object")
    ? (o.environments as Record<string, unknown>)
    : {};
  const normEnv = (key: AutomatedTradingEnvironment) => {
    const e = envsRaw[key];
    if (!e || typeof e !== "object") return defaults.environments[key];
    const er = e as Record<string, unknown>;
    return {
      environment: key,
      controls: normalizeControls(er.controls),
      lastVerifiedAccountId:
        typeof er.lastVerifiedAccountId === "string" ? er.lastVerifiedAccountId : null,
      lastVerifiedAtUtc: typeof er.lastVerifiedAtUtc === "string" ? er.lastVerifiedAtUtc : null,
      lastVerificationStatus:
        typeof er.lastVerificationStatus === "string" ? er.lastVerificationStatus : null,
      credentialsConfigured: Boolean(er.credentialsConfigured),
      usernameHint: typeof er.usernameHint === "string" ? er.usernameHint : null,
      selectedInstrument: typeof er.selectedInstrument === "string" ? er.selectedInstrument : null,
      lastVerification:
        er.lastVerification && typeof er.lastVerification === "object"
          ? (er.lastVerification as AutomatedTradingEnvState["lastVerification"])
          : null,
    };
  };
  const configVersion = Number(o.configVersion);
  const environmentEpoch = Number(o.environmentEpoch);
  return {
    schemaVersion: AUTOMATED_TRADING_SCHEMA,
    phase: "54",
    configVersion: Number.isFinite(configVersion) && configVersion >= 1 ? Math.floor(configVersion) : 1,
    selectedEnvironment: selected,
    environmentEpoch:
      Number.isFinite(environmentEpoch) && environmentEpoch >= 1
        ? Math.floor(environmentEpoch)
        : 1,
    environments: {
      DEMO: normEnv("DEMO"),
      LIVE: normEnv("LIVE"),
    },
    updatedAtUtc: typeof o.updatedAtUtc === "string" ? o.updatedAtUtc : defaults.updatedAtUtc,
  };
}

export class AutomatedTradingStore {
  private readonly root: string;
  private cache: StoreFile | null = null;

  constructor(storageRoot?: string) {
    this.root = storageRoot ?? resolveStorageRoot();
  }

  private file(): string {
    return storePath(this.root);
  }

  private load(): StoreFile {
    if (this.cache) return this.cache;
    try {
      const raw = readJsonSafeSync<Partial<StoreFile> | null>(this.file(), null).value;
      const state = normalizeState(raw?.state ?? raw);
      const audit = Array.isArray(raw?.audit)
        ? (raw!.audit as AutomatedTradingAuditEvent[]).slice(0, MAX_AUDIT)
        : [];
      this.cache = { state, audit };
      return this.cache;
    } catch {
      this.cache = { state: defaultPersistedState(), audit: [] };
      return this.cache;
    }
  }

  private async persist(next: StoreFile): Promise<void> {
    const dir = path.dirname(this.file());
    fs.mkdirSync(dir, { recursive: true });
    await writeJsonAtomic(this.file(), next);
    this.cache = next;
  }

  getState(): AutomatedTradingPersistedState {
    return structuredClone(this.load().state);
  }

  getAudit(limit = 40): AutomatedTradingAuditEvent[] {
    return this.load().audit.slice(0, Math.max(1, Math.min(limit, MAX_AUDIT)));
  }

  async appendAudit(
    partial: Omit<AutomatedTradingAuditEvent, "id" | "atUtc" | "configVersion" | "environmentEpoch">
      & { configVersion?: number; environmentEpoch?: number },
  ): Promise<AutomatedTradingAuditEvent> {
    const file = this.load();
    const event: AutomatedTradingAuditEvent = {
      id: randomUUID(),
      atUtc: new Date().toISOString(),
      action: partial.action,
      environment: partial.environment,
      ok: partial.ok,
      code: partial.code,
      detail: partial.detail.slice(0, 400),
      configVersion: partial.configVersion ?? file.state.configVersion,
      environmentEpoch: partial.environmentEpoch ?? file.state.environmentEpoch,
    };
    const next: StoreFile = {
      state: file.state,
      audit: [event, ...file.audit].slice(0, MAX_AUDIT),
    };
    await this.persist(next);
    return event;
  }

  async updateState(
    mutator: (state: AutomatedTradingPersistedState) => AutomatedTradingPersistedState,
  ): Promise<AutomatedTradingPersistedState> {
    const file = this.load();
    const mutated = mutator(structuredClone(file.state));
    mutated.schemaVersion = AUTOMATED_TRADING_SCHEMA;
    mutated.phase = "51";
    mutated.updatedAtUtc = new Date().toISOString();
    mutated.configVersion = Math.max(1, Math.floor(Number(mutated.configVersion) || 1));
    mutated.environmentEpoch = Math.max(1, Math.floor(Number(mutated.environmentEpoch) || 1));
    await this.persist({ state: mutated, audit: file.audit });
    return structuredClone(mutated);
  }
}

let singleton: AutomatedTradingStore | null = null;

export function getAutomatedTradingStore(storageRoot?: string): AutomatedTradingStore {
  if (storageRoot) return new AutomatedTradingStore(storageRoot);
  if (!singleton) singleton = new AutomatedTradingStore();
  return singleton;
}

/** Test helper — reset process singleton. */
export function resetAutomatedTradingStoreForTests(): void {
  singleton = null;
}
