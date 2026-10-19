/**
 * Phase 51/52 — Automated Trading service (status, config, verification).
 * Never places, modifies, or closes broker orders.
 */
import { getForexConnectProfilesManager } from "../../market-data/forexconnect/profiles.js";
import { getForexConnectBridge } from "../../market-data/forexconnect/client.js";
import { getForexConnectLiveCandleService } from "../../market-data/forexconnect/live-service.js";
import { getAutomatedTradingStore, type AutomatedTradingStore } from "./store.js";
import {
  getAtOpenAiAnalysisEngine,
  type AtOpenAiAnalysisEngine,
  type AtOpenAiAnalysisResult,
} from "./analysis/index.js";
import {
  getAtMonitorWorker,
  type AtMonitorWorker,
  type AtMonitorPublicStatus,
} from "./monitoring/index.js";
import {
  getAtDecisionEngine,
  parseDecisionPolicyPatch,
  type AtDecisionEngine,
  type AtDecisionPolicy,
  type AtDecisionPublicStatus,
  type AtDecisionResult,
} from "./decision/index.js";
import {
  assembleVerificationResult,
  uiEnvFromFc,
} from "./verification-engine.js";
import type { AutomatedTradingVerificationResult } from "./verification-types.js";
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

export class AutomatedTradingService {
  private readonly monitor: AtMonitorWorker;
  private readonly decisionEngine: AtDecisionEngine;

  constructor(
    private readonly store: AutomatedTradingStore = getAutomatedTradingStore(),
    private readonly analysisEngine: AtOpenAiAnalysisEngine = getAtOpenAiAnalysisEngine(),
    monitor?: AtMonitorWorker,
    decisionEngine?: AtDecisionEngine,
  ) {
    this.monitor = monitor ?? getAtMonitorWorker();
    this.decisionEngine = decisionEngine ?? getAtDecisionEngine();
  }

  getMonitorStatus(): AtMonitorPublicStatus {
    return this.monitor.getPublicStatus();
  }

  async startMonitoring(input: {
    environment?: unknown;
    expectedEnvironmentEpoch?: unknown;
    instrument?: unknown;
    timeframe?: unknown;
  }): Promise<
    | { ok: true; status: AutomatedTradingPublicStatus; monitor: AtMonitorPublicStatus }
    | { ok: false; code: string; message: string; status: AutomatedTradingPublicStatus; monitor: AtMonitorPublicStatus }
  > {
    const state = this.store.getState();
    const env = parseAutomatedTradingEnvironment(input.environment) ?? state.selectedEnvironment;
    const instrument = String(
      input.instrument ?? state.environments[env].selectedInstrument ?? "",
    ).trim();
    const result = await this.monitor.start({
      environment: env,
      instrument,
      timeframe: input.timeframe,
      expectedEnvironmentEpoch:
        typeof input.expectedEnvironmentEpoch === "number"
          ? input.expectedEnvironmentEpoch
          : Number(input.expectedEnvironmentEpoch),
      currentEnvironment: state.selectedEnvironment,
      currentEnvironmentEpoch: state.environmentEpoch,
    });
    await this.store.appendAudit({
      action: result.ok ? "monitor_started" : "monitor_start_failed",
      environment: env,
      ok: result.ok,
      code: result.ok ? "OK" : result.code,
      detail: result.ok
        ? `${instrument} · ${String(input.timeframe)}`
        : result.message.slice(0, 160),
    });
    const status = await this.buildStatus();
    if (!result.ok) {
      return {
        ok: false,
        code: result.code,
        message: result.message,
        status,
        monitor: result.status,
      };
    }
    return { ok: true, status, monitor: result.status };
  }

  async stopMonitoring(): Promise<{
    ok: true;
    status: AutomatedTradingPublicStatus;
    monitor: AtMonitorPublicStatus;
  }> {
    const monitor = await this.monitor.stop("user_stop");
    await this.store.appendAudit({
      action: "monitor_stopped",
      environment: this.store.getState().selectedEnvironment,
      ok: true,
      code: "OK",
      detail: "Monitoring stopped by admin.",
    });
    return { ok: true, status: await this.buildStatus(), monitor };
  }

  async changeMonitoring(input: {
    environment?: unknown;
    expectedEnvironmentEpoch?: unknown;
    instrument?: unknown;
    timeframe?: unknown;
  }): Promise<
    | { ok: true; status: AutomatedTradingPublicStatus; monitor: AtMonitorPublicStatus }
    | { ok: false; code: string; message: string; status: AutomatedTradingPublicStatus; monitor: AtMonitorPublicStatus }
  > {
    const state = this.store.getState();
    const env = parseAutomatedTradingEnvironment(input.environment) ?? state.selectedEnvironment;
    const instrument = String(
      input.instrument ?? state.environments[env].selectedInstrument ?? "",
    ).trim();
    const result = await this.monitor.changeInstrumentTimeframe({
      environment: env,
      instrument,
      timeframe: input.timeframe,
      expectedEnvironmentEpoch:
        typeof input.expectedEnvironmentEpoch === "number"
          ? input.expectedEnvironmentEpoch
          : Number(input.expectedEnvironmentEpoch),
      currentEnvironment: state.selectedEnvironment,
      currentEnvironmentEpoch: state.environmentEpoch,
    });
    await this.store.appendAudit({
      action: result.ok ? "monitor_config_changed" : "monitor_config_change_failed",
      environment: env,
      ok: result.ok,
      code: result.ok ? "OK" : result.code,
      detail: result.ok
        ? `${instrument} · ${String(input.timeframe)}`
        : result.message.slice(0, 160),
    });
    const status = await this.buildStatus();
    if (!result.ok) {
      return {
        ok: false,
        code: result.code,
        message: result.message,
        status,
        monitor: result.status,
      };
    }
    return { ok: true, status, monitor: result.status };
  }

  async runMonitorAnalysisNow(input: {
    environment?: unknown;
    expectedEnvironmentEpoch?: unknown;
    instrument?: unknown;
    timeframe?: unknown;
  }): Promise<
    | { ok: true; analysisId: string; status: AutomatedTradingPublicStatus; monitor: AtMonitorPublicStatus }
    | { ok: false; code: string; message: string; status: AutomatedTradingPublicStatus; monitor: AtMonitorPublicStatus }
  > {
    const state = this.store.getState();
    const env = parseAutomatedTradingEnvironment(input.environment) ?? state.selectedEnvironment;
    const result = await this.monitor.runManualNow({
      environment: env,
      instrument: input.instrument != null ? String(input.instrument) : undefined,
      timeframe: input.timeframe,
      expectedEnvironmentEpoch:
        typeof input.expectedEnvironmentEpoch === "number"
          ? input.expectedEnvironmentEpoch
          : Number(input.expectedEnvironmentEpoch),
      currentEnvironment: state.selectedEnvironment,
      currentEnvironmentEpoch: state.environmentEpoch,
      verification: state.environments[env].lastVerification,
    });
    await this.store.appendAudit({
      action: result.ok ? "monitor_manual_analysis" : "monitor_manual_analysis_failed",
      environment: env,
      ok: result.ok,
      code: result.ok ? "OK" : result.code,
      detail: result.ok ? result.analysisId : result.message.slice(0, 160),
    });
    const status = await this.buildStatus();
    if (!result.ok) {
      return {
        ok: false,
        code: result.code,
        message: result.message,
        status,
        monitor: result.status,
      };
    }
    return { ok: true, analysisId: result.analysisId, status, monitor: result.status };
  }

  readMonitorChartImage(analysisId: string): Buffer | null {
    return this.monitor.readChartImage(analysisId);
  }

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

    // Hard safety blockers — execution never enabled in Phase 52.
    blockers.push(AUTOMATED_EXECUTION_BANNER);
    if (selected === "LIVE") {
      blockers.push("LIVE execution is disabled throughout Phase 53.3.");
    }
    if (envState.controls.emergencyEntryLock) {
      blockers.push("Emergency entry lock is ON — future automated entries are blocked.");
    }
    if (!envState.controls.masterEnable) {
      blockers.push("Master automated-trading switch is OFF.");
    }

    const verification = envState.lastVerification;
    if (verification) {
      for (const b of verification.blockers) {
        if (b.code !== "EXECUTION_NOT_IMPLEMENTED" && b.code !== "RISK_ENGINE_NOT_IMPLEMENTED") {
          blockers.push(b.message);
        }
      }
      if (verification.account.accountIdMasked) {
        accountIdMasked = verification.account.accountIdMasked;
      }
      accountVerified = verification.identityStatus === "ACCOUNT_VERIFIED";
    }

    let moduleStatus: AutomatedTradingModuleStatus = "READY";
    if (blockers.some((b) => /unavailable|error/i.test(b) && !/PHASE 5[12]/i.test(b))) {
      moduleStatus = connectionStatus === "UNAVAILABLE" ? "ERROR" : "BLOCKED";
    }
    if (
      connectionStatus === "MISMATCH"
      || !credentialsConfigured
      || selected === "LIVE"
      || envState.controls.emergencyEntryLock
      || !envState.controls.masterEnable
      || !verification?.readiness.readyForFutureAnalysis
    ) {
      moduleStatus = moduleStatus === "ERROR" ? "ERROR" : "BLOCKED";
    }
    // Execution / trading readiness never READY in Phase 52
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
          ? "Automated Trading is blocked for execution. Verification and configuration remain available."
          : moduleStatus === "ERROR"
            ? "Automated Trading could not verify broker status."
            : "Status loaded.",
      selectedEnvState: selectedFresh,
      verification: selectedFresh.lastVerification,
      readiness: selectedFresh.lastVerification?.readiness ?? null,
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
      s.environments[target].lastVerification = null;
      return s;
    });
    try {
      await getForexConnectLiveCandleService().clearAllSessions();
    } catch {
      /* best-effort — env-bound quotes must not leak across DEMO/LIVE */
    }

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

  async setSelectedInstrument(input: {
    environment: unknown;
    instrument: unknown;
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
    const state = this.store.getState();
    if (env !== state.selectedEnvironment) {
      return {
        ok: false,
        code: "ENVIRONMENT_MISMATCH",
        message: `Instrument for ${env} rejected while selection is ${state.selectedEnvironment}.`,
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
    const instrument = String(input.instrument ?? "").trim();
    if (!instrument || instrument.length > 64) {
      return {
        ok: false,
        code: "INVALID_INSTRUMENT",
        message: "instrument symbol is required",
        status: await this.buildStatus(),
      };
    }
    await this.store.updateState((s) => {
      s.environments[env].selectedInstrument = instrument;
      s.environments[env].lastVerification = null;
      s.environments[env].lastVerificationStatus = "INSTRUMENT_CHANGED";
      s.configVersion += 1;
      return s;
    });
    await this.store.appendAudit({
      action: "instrument_selected",
      environment: env,
      ok: true,
      code: null,
      detail: `Selected instrument ${instrument} for ${env}.`,
    });
    return { ok: true, status: await this.buildStatus() };
  }

  /**
   * Phase 52 — run read-only account + instrument + market verification.
   * Never places orders. Binds result to selected environment + epoch.
   */
  async runVerification(input: {
    environment?: unknown;
    expectedEnvironmentEpoch?: unknown;
    instrument?: unknown;
    accountId?: unknown;
    timeframe?: unknown;
  }): Promise<
    | { ok: true; verification: AutomatedTradingVerificationResult; status: AutomatedTradingPublicStatus }
    | { ok: false; code: string; message: string; status: AutomatedTradingPublicStatus }
  > {
    const state = this.store.getState();
    const env =
      parseAutomatedTradingEnvironment(input.environment) ?? state.selectedEnvironment;
    if (env !== state.selectedEnvironment) {
      return {
        ok: false,
        code: "ENVIRONMENT_MISMATCH",
        message: `Verification for ${env} rejected while selection is ${state.selectedEnvironment}.`,
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

    const instrumentOverride = String(input.instrument ?? "").trim();
    if (instrumentOverride) {
      await this.store.updateState((s) => {
        s.environments[env].selectedInstrument = instrumentOverride;
        return s;
      });
    }

    const envState = this.store.getState().environments[env];
    const instrumentSymbol = envState.selectedInstrument;
    const expectedAccountId =
      typeof input.accountId === "string" && input.accountId.trim()
        ? input.accountId.trim()
        : envState.lastVerifiedAccountId;

    let credentialsConfigured = envState.credentialsConfigured;
    let connectionStatus = "UNAVAILABLE";
    let sessionEnv: AutomatedTradingEnvironment | null = null;

    try {
      const profilesMgr = await getForexConnectProfilesManager();
      const profiles = profilesMgr.publicState();
      const profile = env === "DEMO" ? profiles.profiles.demo : profiles.profiles.live;
      credentialsConfigured = Boolean(profile.configured);

      const bridge = getForexConnectBridge();
      const fcStatus = await bridge.getStatus();
      connectionStatus = String(fcStatus.status ?? "UNKNOWN");
      sessionEnv = uiEnvFromFc(fcStatus.environmentLabel ?? fcStatus.environment ?? null)
        ?? uiEnvFromFc(profiles.activeEnvironment);

      const accountsResult = await bridge.listAccounts();
      let instruments: Awaited<ReturnType<typeof bridge.listInstruments>>["instruments"] = [];
      try {
        const instRes = await bridge.listInstruments();
        instruments = instRes.ok ? instRes.instruments : [];
      } catch {
        instruments = [];
      }

      let marketInput: Parameters<typeof assembleVerificationResult>[0]["marketInput"] = null;
      if (instrumentSymbol) {
        try {
          const live = getForexConnectLiveCandleService();
          const tf = String(input.timeframe ?? "m1").trim() || "m1";
          const series = await live.ensure(instrumentSymbol, tf);
          const latest = live.getLatestQuoteState(instrumentSymbol);
          const now = Date.now();
          const receiptAgeMs =
            latest?.lastQuoteAtMs != null ? Math.max(0, now - latest.lastQuoteAtMs) : series.lastQuoteAgeMs;
          marketInput = {
            bid: latest?.quote.bid ?? null,
            ask: latest?.quote.ask ?? null,
            streamState: latest?.streamState ?? series.streamState,
            sourceTimestampMs: latest?.quote.sourceTimestampMs ?? null,
            receivedAtMs: latest?.quote.receivedAtMs ?? null,
            // series.lastQuoteAgeMs is honest price-change age used for LIVE gating.
            priceChangeAgeMs: series.lastQuoteAgeMs,
            receiptAgeMs,
            updateCount: latest?.updateCount ?? series.updateCount,
            nowMs: now,
          };
        } catch (err) {
          marketInput = {
            bid: null,
            ask: null,
            streamState: "ERROR",
            updateCount: 0,
            nowMs: Date.now(),
          };
          await this.store.appendAudit({
            action: "market_subscribe_failed",
            environment: env,
            ok: false,
            code: "MARKET_FEED_UNAVAILABLE",
            detail: err instanceof Error ? err.message.slice(0, 160) : "Market subscribe failed",
          });
        }
      }

      const verification = assembleVerificationResult({
        selected: env,
        environmentEpoch: this.store.getState().environmentEpoch,
        credentialsConfigured,
        connectionStatus,
        sessionEnv,
        accountsResult,
        selectedAccountId: expectedAccountId,
        expectedAccountId: envState.lastVerifiedAccountId,
        instrumentSymbol,
        instruments,
        marketInput,
      });

      await this.store.updateState((s) => {
        const bucket = s.environments[env];
        bucket.lastVerification = verification;
        bucket.lastVerificationStatus = verification.identityStatus;
        bucket.lastVerifiedAtUtc = verification.verifiedAtUtc;
        if (verification.identityStatus === "ACCOUNT_VERIFIED" && accountsResult.ok) {
          const acct =
            accountsResult.accounts.find((a) => a.accountId === expectedAccountId)
            ?? (accountsResult.accounts.length === 1 ? accountsResult.accounts[0] : null);
          if (acct?.accountId) {
            bucket.lastVerifiedAccountId = acct.accountId;
          }
        }
        if (verification.identityStatus !== "ACCOUNT_VERIFIED") {
          // Do not keep a verified flag when identity failed.
          if (
            verification.identityStatus === "ENVIRONMENT_MISMATCH"
            || verification.identityStatus === "CONNECTION_FAILED"
            || verification.identityStatus === "CONFIGURATION_MISSING"
          ) {
            bucket.lastVerifiedAccountId = null;
          }
        }
        s.configVersion += 1;
        return s;
      });

      await this.store.appendAudit({
        action: "verification_completed",
        environment: env,
        ok: verification.identityStatus === "ACCOUNT_VERIFIED",
        code: verification.identityStatus,
        detail:
          `Verification ${verification.identityStatus}; instrument=${verification.instrument.level}; `
          + `feed=${verification.market.feedStatus}; readyAnalysis=${verification.readiness.readyForFutureAnalysis}`,
      });

      return {
        ok: true,
        verification,
        status: await this.buildStatus(),
      };
    } catch (err) {
      await this.store.appendAudit({
        action: "verification_failed",
        environment: env,
        ok: false,
        code: "PROVIDER_UNAVAILABLE",
        detail: err instanceof Error ? err.message.slice(0, 160) : "Verification failed",
      });
      return {
        ok: false,
        code: "PROVIDER_UNAVAILABLE",
        message: err instanceof Error ? err.message.slice(0, 200) : "Verification failed",
        status: await this.buildStatus(),
      };
    }
  }

  getLatestVerification(): AutomatedTradingVerificationResult | null {
    const state = this.store.getState();
    return state.environments[state.selectedEnvironment].lastVerification;
  }

  async getOpenAiAnalysisStatus() {
    return this.analysisEngine.providerStatus();
  }

  getLatestOpenAiAnalysis(): AtOpenAiAnalysisResult | null {
    return this.analysisEngine.getLatest();
  }

  getOpenAiAnalysis(id: string): AtOpenAiAnalysisResult | null {
    return this.analysisEngine.getById(id);
  }

  listOpenAiAnalyses(limit = 12): AtOpenAiAnalysisResult[] {
    return this.analysisEngine.listHistory(limit);
  }

  /**
   * Phase 53 — deliberate OpenAI technical analysis (no auto-poll, no Local AI fallback).
   */
  async runOpenAiAnalysis(input: {
    environment?: unknown;
    expectedEnvironmentEpoch?: unknown;
    instrument?: unknown;
    timeframes?: unknown;
    timeoutMs?: unknown;
  }): Promise<
    | { ok: true; analysis: AtOpenAiAnalysisResult; status: AutomatedTradingPublicStatus }
    | { ok: false; code: string; message: string; analysis: AtOpenAiAnalysisResult | null; status: AutomatedTradingPublicStatus }
  > {
    const state = this.store.getState();
    const env =
      parseAutomatedTradingEnvironment(input.environment) ?? state.selectedEnvironment;
    if (env !== state.selectedEnvironment) {
      return {
        ok: false,
        code: "ENVIRONMENT_MISMATCH",
        message: `Analysis for ${env} rejected while selection is ${state.selectedEnvironment}.`,
        analysis: null,
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
        analysis: null,
        status: await this.buildStatus(),
      };
    }

    const envState = state.environments[env];
    const instrument = String(input.instrument ?? envState.selectedInstrument ?? "").trim();
    const timeframes = Array.isArray(input.timeframes)
      ? input.timeframes.map((t) => String(t))
      : undefined;

    const result = await this.analysisEngine.analyze({
      environment: env,
      environmentEpoch: state.environmentEpoch,
      instrument,
      timeframes,
      verification: envState.lastVerification,
      timeoutMs: input.timeoutMs,
    });

    await this.store.appendAudit({
      action: result.ok ? "openai_analysis_completed" : "openai_analysis_failed",
      environment: env,
      ok: result.ok,
      code: result.ok ? result.analysis.lifecycle : result.code,
      detail: result.ok
        ? `OpenAI ${result.analysis.modelUsed ?? result.analysis.modelRequested} · ${result.analysis.directionalBias}`
        : result.message.slice(0, 160),
    });

    if (!result.ok) {
      return {
        ok: false,
        code: result.code,
        message: result.message,
        analysis: result.analysis,
        status: await this.buildStatus(),
      };
    }
    return {
      ok: true,
      analysis: result.analysis,
      status: await this.buildStatus(),
    };
  }

  getAudit(limit = 40): AutomatedTradingAuditEvent[] {
    return this.store.getAudit(limit);
  }

  /**
   * Phase 54 — read-only trading decision validation (never places orders).
   */
  async getDecisionStatus(): Promise<AtDecisionPublicStatus> {
    return this.decisionEngine.publicStatus();
  }

  getLatestDecision(): AtDecisionResult | null {
    return this.decisionEngine.getLatest();
  }

  listDecisions(limit = 12): AtDecisionResult[] {
    return this.decisionEngine.listHistory(limit);
  }

  getDecisionPolicy(): AtDecisionPolicy {
    return this.decisionEngine.getPolicy();
  }

  async updateDecisionPolicy(raw: unknown): Promise<
    | { ok: true; policy: AtDecisionPolicy; status: AutomatedTradingPublicStatus }
    | { ok: false; code: string; message: string; status: AutomatedTradingPublicStatus }
  > {
    const parsed = parseDecisionPolicyPatch(raw);
    if (!parsed.ok) {
      return {
        ok: false,
        code: parsed.code,
        message: parsed.message,
        status: await this.buildStatus(),
      };
    }
    const policy = await this.decisionEngine.updatePolicy(parsed.patch);
    await this.store.appendAudit({
      action: "decision_policy_updated",
      environment: this.store.getState().selectedEnvironment,
      ok: true,
      code: "OK",
      detail:
        `thresholdEnabled=${policy.confidenceThresholdEnabled}`
        + ` min=${policy.minDirectionalConfidencePct}`,
    });
    return { ok: true, policy, status: await this.buildStatus() };
  }

  async evaluateTradingDecision(input: {
    analysisId?: unknown;
    expectedEnvironmentEpoch?: unknown;
  }): Promise<
    | { ok: true; decision: AtDecisionResult; status: AutomatedTradingPublicStatus }
    | { ok: false; code: string; message: string; decision: AtDecisionResult | null; status: AutomatedTradingPublicStatus }
  > {
    const state = this.store.getState();
    const env = state.selectedEnvironment;
    const envState = state.environments[env];
    const expectedEpoch = Number(input.expectedEnvironmentEpoch);
    if (
      Number.isFinite(expectedEpoch)
      && Math.floor(expectedEpoch) !== state.environmentEpoch
    ) {
      return {
        ok: false,
        code: "STALE_EPOCH",
        message: "Stale environment epoch — refresh status and retry.",
        decision: null,
        status: await this.buildStatus(),
      };
    }

    const requestedId = input.analysisId != null ? String(input.analysisId).trim() : "";
    const analysis = requestedId
      ? this.analysisEngine.getById(requestedId)
      : this.analysisEngine.getLatest();
    const latest = this.analysisEngine.getLatest();

    const decision = await this.decisionEngine.evaluateAndPersist({
      analysis,
      latestAnalysis: latest,
      verification: envState.lastVerification,
      currentEnvironment: env,
      currentEnvironmentEpoch: state.environmentEpoch,
      selectedInstrument: envState.selectedInstrument,
      expectedEnvironmentEpoch: Number.isFinite(expectedEpoch) ? expectedEpoch : null,
    });

    await this.store.appendAudit({
      action: decision.decisionStatus === "ACCEPTED_FOR_REVIEW"
        ? "decision_accepted_for_review"
        : "decision_rejected",
      environment: env,
      ok: decision.decisionStatus === "ACCEPTED_FOR_REVIEW",
      code: decision.decisionStatus,
      detail: decision.sourceAnalysisId
        ? `${decision.decisionStatus} · ${decision.direction ?? "—"} · ${decision.sourceAnalysisId}`
        : decision.rejectionReasons[0]?.slice(0, 160) ?? decision.decisionStatus,
    });

    return {
      ok: true,
      decision,
      status: await this.buildStatus(),
    };
  }
}

let serviceSingleton: AutomatedTradingService | null = null;

export function getAutomatedTradingService(storageRoot?: string): AutomatedTradingService {
  if (storageRoot) {
    const store = getAutomatedTradingStore(storageRoot);
    const engine = getAtOpenAiAnalysisEngine(storageRoot);
    const mon = getAtMonitorWorker(storageRoot);
    const decision = getAtDecisionEngine(storageRoot);
    return new AutomatedTradingService(store, engine, mon, decision);
  }
  if (!serviceSingleton) {
    const store = getAutomatedTradingStore();
    const engine = getAtOpenAiAnalysisEngine();
    const mon = getAtMonitorWorker();
    const decision = getAtDecisionEngine();
    // Bind verification/env hooks BEFORE resume so restart recovery can validate safely.
    mon.bindRuntimeHooks({
      getVerification: (env) => store.getState().environments[env].lastVerification,
      getEnvironmentEpoch: () => store.getState().environmentEpoch,
      getSelectedEnvironment: () => store.getState().selectedEnvironment,
    });
    mon.resumeFromPersistence();
    serviceSingleton = new AutomatedTradingService(store, engine, mon, decision);
  }
  return serviceSingleton;
}

export function resetAutomatedTradingServiceForTests(): void {
  serviceSingleton = null;
}
