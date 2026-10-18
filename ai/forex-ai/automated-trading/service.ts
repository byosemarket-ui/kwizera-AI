/**
 * Phase 51 — Automated Trading service (status + safe configuration).
 * Never places, modifies, or closes broker orders.
 */
import { getForexConnectProfilesManager } from "../../market-data/forexconnect/profiles.js";
import { getForexConnectBridge } from "../../market-data/forexconnect/client.js";
// getForexConnectProfilesManager is async (vault init).
import { getAutomatedTradingStore, type AutomatedTradingStore } from "./store.js";
import {
  AUTOMATED_EXECUTION_BANNER,
  AUTOMATED_TRADING_PHASE,
  AUTOMATED_TRADING_SCHEMA,
  maskAccountId,
  parseAutomatedTradingEnvironment,
  type AutomatedTradingAuditEvent,
  type AutomatedTradingEnvironment,
  type AutomatedTradingEnvControls,
  type AutomatedTradingModuleStatus,
  type AutomatedTradingPublicStatus,
} from "./types.js";

function uiEnvFromFc(raw: string | null | undefined): AutomatedTradingEnvironment | null {
  const v = String(raw ?? "").trim().toLowerCase();
  if (v === "demo") return "DEMO";
  if (v === "live" || v === "real") return "LIVE";
  return null;
}

export class AutomatedTradingService {
  constructor(private readonly store: AutomatedTradingStore = getAutomatedTradingStore()) {}

  async buildStatus(): Promise<AutomatedTradingPublicStatus> {
    const state = this.store.getState();
    const selected = state.selectedEnvironment;
    const envState = state.environments[selected];
    const blockers: string[] = [];

    let connectionStatus: AutomatedTradingPublicStatus["broker"]["connectionStatus"] = "UNAVAILABLE";
    let activeSessionEnvironment: AutomatedTradingEnvironment | null = null;
    let sessionMatchesSelection: boolean | null = null;
    let accountIdMasked: string | null = null;
    let openPositionsCount: number | null = null;
    let lastStatusAtUtc: string | null = null;
    let credentialsConfigured = envState.credentialsConfigured;
    let usernameHint = envState.usernameHint;
    let accountVerified = Boolean(envState.lastVerifiedAccountId && envState.lastVerifiedAtUtc);

    try {
      const profilesMgr = await getForexConnectProfilesManager();
      const profiles = profilesMgr.publicState();
      const demo = profiles.profiles.demo;
      const live = profiles.profiles.live;
      const profile = selected === "DEMO" ? demo : live;
      credentialsConfigured = Boolean(profile.configured);
      usernameHint = profile.usernameHint;
      activeSessionEnvironment = uiEnvFromFc(profiles.activeEnvironment);

      // Refresh credential flags into isolated env buckets (no secrets).
      await this.store.updateState((s) => {
        s.environments.DEMO.credentialsConfigured = Boolean(demo.configured);
        s.environments.DEMO.usernameHint = demo.usernameHint;
        s.environments.LIVE.credentialsConfigured = Boolean(live.configured);
        s.environments.LIVE.usernameHint = live.usernameHint;
        return s;
      });

      const bridge = getForexConnectBridge();
      const status = await bridge.getStatus();
      lastStatusAtUtc = new Date().toISOString();
      const st = String(status.status ?? "").toUpperCase();
      if (st === "CONNECTED") connectionStatus = "CONNECTED";
      else if (st === "DISCONNECTED" || st === "IDLE") connectionStatus = "DISCONNECTED";
      else connectionStatus = "UNKNOWN";

      const sessionEnv = uiEnvFromFc(status.environmentLabel ?? status.environment ?? null)
        ?? activeSessionEnvironment;
      activeSessionEnvironment = sessionEnv;
      if (connectionStatus === "CONNECTED" && sessionEnv) {
        sessionMatchesSelection = sessionEnv === selected;
        if (!sessionMatchesSelection) {
          connectionStatus = "MISMATCH";
          blockers.push(
            `Active ForexConnect session is ${sessionEnv} but Automated Trading selection is ${selected}.`,
          );
        }
      } else if (connectionStatus === "CONNECTED" && !sessionEnv) {
        blockers.push("Connected session environment could not be verified.");
        sessionMatchesSelection = false;
      }

      if (!credentialsConfigured) {
        blockers.push(`${selected} credentials are not configured in ForexConnect profiles.`);
      }

      // Positions: only when session matches and bridge exposes a verified count.
      const rawPositions = (status as { openPositionsCount?: unknown; positionsCount?: unknown });
      const countCandidate = rawPositions.openPositionsCount ?? rawPositions.positionsCount;
      if (
        connectionStatus === "CONNECTED"
        && sessionMatchesSelection
        && typeof countCandidate === "number"
        && Number.isFinite(countCandidate)
      ) {
        openPositionsCount = Math.max(0, Math.floor(countCandidate));
      } else {
        openPositionsCount = null;
      }

      // Account identity from profile verification metadata only (masked).
      if (envState.lastVerifiedAccountId && sessionMatchesSelection) {
        accountIdMasked = maskAccountId(envState.lastVerifiedAccountId);
        accountVerified = true;
      } else if (connectionStatus === "CONNECTED" && sessionMatchesSelection && usernameHint) {
        accountIdMasked = usernameHint;
        accountVerified = false;
        blockers.push("Account identity is not verified for Automated Trading — complete session verification.");
      }
    } catch (err) {
      connectionStatus = "UNAVAILABLE";
      blockers.push(
        `Broker status unavailable: ${err instanceof Error ? err.message.slice(0, 160) : "unknown error"}`,
      );
    }

    // Phase 51 hard safety blockers
    blockers.push(AUTOMATED_EXECUTION_BANNER);
    if (selected === "LIVE") {
      blockers.push("LIVE execution is disabled throughout Phase 51.");
    }
    if (envState.controls.emergencyEntryLock) {
      blockers.push("Emergency entry lock is ON — future automated entries are blocked.");
    }
    if (!envState.controls.masterEnable) {
      blockers.push("Master automated-trading switch is OFF.");
    }

    let moduleStatus: AutomatedTradingModuleStatus = "READY";
    if (blockers.some((b) => /unavailable|error/i.test(b) && !/PHASE 51/i.test(b))) {
      moduleStatus = connectionStatus === "UNAVAILABLE" ? "ERROR" : "BLOCKED";
    }
    if (
      connectionStatus === "MISMATCH"
      || !credentialsConfigured
      || selected === "LIVE"
      || envState.controls.emergencyEntryLock
      || !envState.controls.masterEnable
    ) {
      moduleStatus = moduleStatus === "ERROR" ? "ERROR" : "BLOCKED";
    }
    // Execution never ready in Phase 51
    if (moduleStatus === "READY") moduleStatus = "BLOCKED";

    const fresh = this.store.getState();
    const selectedFresh = fresh.environments[fresh.selectedEnvironment];

    return {
      schemaVersion: AUTOMATED_TRADING_SCHEMA,
      phase: AUTOMATED_TRADING_PHASE,
      moduleStatus,
      selectedEnvironment: fresh.selectedEnvironment,
      environmentEpoch: fresh.environmentEpoch,
      configVersion: fresh.configVersion,
      banner: AUTOMATED_EXECUTION_BANNER,
      broker: {
        connectionStatus,
        activeSessionEnvironment,
        sessionMatchesSelection,
        accountIdMasked,
        openPositionsCount,
        lastStatusAtUtc,
        credentialsConfigured: selectedFresh.credentialsConfigured || credentialsConfigured,
        usernameHint: selectedFresh.usernameHint ?? usernameHint,
        accountVerified,
      },
      controls: {
        masterEnable: selectedFresh.controls.masterEnable,
        automaticEntry: "DISABLED",
        positionManagement: "NOT_ACTIVE",
        emergencyEntryLock: selectedFresh.controls.emergencyEntryLock,
        automatedExecutionEnabled: false,
      },
      blockers: [...new Set(blockers)],
      explanation:
        moduleStatus === "BLOCKED"
          ? "Automated Trading is blocked for execution. Configuration and environment isolation remain available."
          : moduleStatus === "ERROR"
            ? "Automated Trading could not verify broker status."
            : "Status loaded.",
      selectedEnvState: selectedFresh,
      updatedAtUtc: fresh.updatedAtUtc,
      placesOrders: false,
    };
  }

  async selectEnvironment(input: {
    environment: unknown;
    confirm: unknown;
    expectedCurrentEnvironment?: unknown;
    expectedEnvironmentEpoch?: unknown;
  }): Promise<
    | { ok: true; status: AutomatedTradingPublicStatus }
    | { ok: false; code: string; message: string; status: AutomatedTradingPublicStatus }
  > {
    const target = parseAutomatedTradingEnvironment(input.environment);
    if (!target) {
      const status = await this.buildStatus();
      await this.store.appendAudit({
        action: "environment_switch_rejected",
        environment: null,
        ok: false,
        code: "INVALID_ENVIRONMENT",
        detail: "environment must be DEMO or LIVE",
      });
      return { ok: false, code: "INVALID_ENVIRONMENT", message: "environment must be DEMO or LIVE", status };
    }
    if (input.confirm !== true) {
      const status = await this.buildStatus();
      await this.store.appendAudit({
        action: "environment_switch_rejected",
        environment: target,
        ok: false,
        code: "CONFIRMATION_REQUIRED",
        detail: "Explicit confirm:true is required to switch environments.",
      });
      return {
        ok: false,
        code: "CONFIRMATION_REQUIRED",
        message: "Explicit confirm:true is required to switch environments.",
        status,
      };
    }

    const state = this.store.getState();
    const expectedCurrent = parseAutomatedTradingEnvironment(input.expectedCurrentEnvironment);
    if (expectedCurrent && expectedCurrent !== state.selectedEnvironment) {
      const status = await this.buildStatus();
      await this.store.appendAudit({
        action: "environment_switch_rejected",
        environment: target,
        ok: false,
        code: "STALE_ENVIRONMENT",
        detail: `Client expected ${expectedCurrent} but server selection is ${state.selectedEnvironment}.`,
      });
      return {
        ok: false,
        code: "STALE_ENVIRONMENT",
        message: `Selection changed. Refresh and retry (server is ${state.selectedEnvironment}).`,
        status,
      };
    }
    const expectedEpoch = Number(input.expectedEnvironmentEpoch);
    if (
      Number.isFinite(expectedEpoch)
      && Math.floor(expectedEpoch) !== state.environmentEpoch
    ) {
      const status = await this.buildStatus();
      await this.store.appendAudit({
        action: "environment_switch_rejected",
        environment: target,
        ok: false,
        code: "STALE_EPOCH",
        detail: `Client epoch ${expectedEpoch} != server ${state.environmentEpoch}.`,
      });
      return {
        ok: false,
        code: "STALE_EPOCH",
        message: "Stale environment epoch — refresh status and retry.",
        status,
      };
    }

    if (target === state.selectedEnvironment) {
      const status = await this.buildStatus();
      return { ok: true, status };
    }

    // Never silently fall back — switch only the selection; session must be revalidated separately.
    await this.store.updateState((s) => {
      s.selectedEnvironment = target;
      s.environmentEpoch += 1;
      s.configVersion += 1;
      // Invalidate verification on the newly selected env until revalidated.
      s.environments[target].lastVerifiedAccountId = null;
      s.environments[target].lastVerifiedAtUtc = null;
      s.environments[target].lastVerificationStatus = "PENDING_REVALIDATION";
      return s;
    });

    await this.store.appendAudit({
      action: "environment_switched",
      environment: target,
      ok: true,
      code: null,
      detail: `Selected environment set to ${target}. Broker session was not automatically switched.`,
    });

    const status = await this.buildStatus();
    return { ok: true, status };
  }

  async updateControls(input: {
    environment: unknown;
    expectedEnvironmentEpoch?: unknown;
    patch: Partial<AutomatedTradingEnvControls>;
  }): Promise<
    | { ok: true; status: AutomatedTradingPublicStatus }
    | { ok: false; code: string; message: string; status: AutomatedTradingPublicStatus }
  > {
    const env = parseAutomatedTradingEnvironment(input.environment);
    if (!env) {
      return {
        ok: false,
        code: "INVALID_ENVIRONMENT",
        message: "environment must be DEMO or LIVE",
        status: await this.buildStatus(),
      };
    }
    const state = this.store.getState();
    if (env !== state.selectedEnvironment) {
      return {
        ok: false,
        code: "ENVIRONMENT_MISMATCH",
        message: `Controls for ${env} rejected while selection is ${state.selectedEnvironment}.`,
        status: await this.buildStatus(),
      };
    }
    const expectedEpoch = Number(input.expectedEnvironmentEpoch);
    if (
      Number.isFinite(expectedEpoch)
      && Math.floor(expectedEpoch) !== state.environmentEpoch
    ) {
      return {
        ok: false,
        code: "STALE_EPOCH",
        message: "Stale environment epoch — refresh status and retry.",
        status: await this.buildStatus(),
      };
    }

    const patch = input.patch ?? {};
    await this.store.updateState((s) => {
      const c = s.environments[env].controls;
      if (typeof patch.masterEnable === "boolean") c.masterEnable = patch.masterEnable;
      if (typeof patch.automaticEntry === "boolean") c.automaticEntry = patch.automaticEntry;
      if (typeof patch.positionManagement === "boolean") c.positionManagement = patch.positionManagement;
      if (typeof patch.emergencyEntryLock === "boolean") c.emergencyEntryLock = patch.emergencyEntryLock;
      // Phase 51 — automatic entry never becomes an execution permission.
      if (c.automaticEntry) c.automaticEntry = false;
      if (c.positionManagement) c.positionManagement = false;
      s.configVersion += 1;
      return s;
    });

    await this.store.appendAudit({
      action: "controls_updated",
      environment: env,
      ok: true,
      code: null,
      detail: `Controls updated for ${env} (execution remains unimplemented).`,
    });

    return { ok: true, status: await this.buildStatus() };
  }

  async setEmergencyLock(input: {
    environment: unknown;
    locked: unknown;
    expectedEnvironmentEpoch?: unknown;
  }): Promise<
    | { ok: true; status: AutomatedTradingPublicStatus }
    | { ok: false; code: string; message: string; status: AutomatedTradingPublicStatus }
  > {
    if (typeof input.locked !== "boolean") {
      return {
        ok: false,
        code: "INVALID_LOCK",
        message: "locked must be a boolean",
        status: await this.buildStatus(),
      };
    }
    return this.updateControls({
      environment: input.environment,
      expectedEnvironmentEpoch: input.expectedEnvironmentEpoch,
      patch: { emergencyEntryLock: input.locked },
    });
  }

  /**
   * Bind a verified account id for the selected environment after an external session check.
   * Does not activate ForexConnect — only records verification metadata.
   */
  async recordAccountVerification(input: {
    environment: unknown;
    accountId: unknown;
    status: unknown;
    expectedEnvironmentEpoch?: unknown;
  }): Promise<
    | { ok: true; status: AutomatedTradingPublicStatus }
    | { ok: false; code: string; message: string; status: AutomatedTradingPublicStatus }
  > {
    const env = parseAutomatedTradingEnvironment(input.environment);
    if (!env) {
      return {
        ok: false,
        code: "INVALID_ENVIRONMENT",
        message: "environment must be DEMO or LIVE",
        status: await this.buildStatus(),
      };
    }
    const accountId = String(input.accountId ?? "").trim();
    if (!accountId || accountId.length > 128) {
      return {
        ok: false,
        code: "INVALID_ACCOUNT",
        message: "accountId is required",
        status: await this.buildStatus(),
      };
    }
    const state = this.store.getState();
    if (env !== state.selectedEnvironment) {
      return {
        ok: false,
        code: "ENVIRONMENT_MISMATCH",
        message: "Cannot verify an account for a non-selected environment.",
        status: await this.buildStatus(),
      };
    }
    const expectedEpoch = Number(input.expectedEnvironmentEpoch);
    if (
      Number.isFinite(expectedEpoch)
      && Math.floor(expectedEpoch) !== state.environmentEpoch
    ) {
      return {
        ok: false,
        code: "STALE_EPOCH",
        message: "Stale environment epoch — refresh status and retry.",
        status: await this.buildStatus(),
      };
    }

    const verificationStatus = String(input.status ?? "VERIFIED").slice(0, 80);
    await this.store.updateState((s) => {
      s.environments[env].lastVerifiedAccountId = accountId;
      s.environments[env].lastVerifiedAtUtc = new Date().toISOString();
      s.environments[env].lastVerificationStatus = verificationStatus;
      s.configVersion += 1;
      return s;
    });
    await this.store.appendAudit({
      action: "account_verified",
      environment: env,
      ok: true,
      code: null,
      detail: `Account verification recorded for ${env} (${maskAccountId(accountId)}).`,
    });
    return { ok: true, status: await this.buildStatus() };
  }

  getAudit(limit = 40): AutomatedTradingAuditEvent[] {
    return this.store.getAudit(limit);
  }
}

let serviceSingleton: AutomatedTradingService | null = null;

export function getAutomatedTradingService(storageRoot?: string): AutomatedTradingService {
  if (storageRoot) return new AutomatedTradingService(getAutomatedTradingStore(storageRoot));
  if (!serviceSingleton) serviceSingleton = new AutomatedTradingService();
  return serviceSingleton;
}

export function resetAutomatedTradingServiceForTests(): void {
  serviceSingleton = null;
}
