/**
 * Phase 51/52 — Automated Trading service (status, config, verification).
 * Never places, modifies, or closes broker orders.
 */
import { getForexConnectProfilesManager } from "../../market-data/forexconnect/profiles.js";
import { getForexConnectBridge } from "../../market-data/forexconnect/client.js";
import { getForexConnectLiveCandleService } from "../../market-data/forexconnect/live-service.js";
import { resolveForexConnectLiveTimeframe } from "../../market-data/forexconnect/timeframes.js";
import { getAutomatedTradingStore, type AutomatedTradingStore } from "./store.js";
import {
  getAtOpenAiAnalysisEngine,
  type AtOpenAiAnalysisEngine,
  type AtOpenAiAnalysisResult,
} from "./analysis/index.js";
import {
  getAtMonitorWorker,
  AT_ANALYSIS_DEFAULT_TIMEFRAME,
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
  getAtSimRiskEngine,
  proposeSimLevels,
  reconcileBrokerExposure,
  resolveXauQuantityConstraints,
  resolveXauQuantitySemantics,
  evaluateSimulationDataReadiness,
  simulationDataReadinessPublicSummary,
  validateOrderAllocationAmount,
  xauSemanticsPublicSummary,
  isDocumentedCondDistMethod,
  buildOffersConversionRateSnapshot,
  evaluateDraftBoundaryQuote,
  enrichDraftRejectionReasons,
  openSimulatedPosition,
  monitorSimulatedPosition as applySimMonitorTick,
  closeSimulatedPositionManual,
  evaluateSimReentryPolicy,
  simulationLifecyclePublicStatus,
  getAtSimLifecycleStore,
  proposeControlledSlCrossingLevels,
  proposeControlledSlApproachLevels,
  recoverSimPositionsAfterProcessRestart,
  type AtSimRiskEngine,
  type AtSimDraftResult,
  type AtSimRiskPolicy,
  type AtSimRiskPublicStatus,
  type DraftQuoteSnapshot,
  type SimPosition,
  type SimRestartRecoveryItem,
} from "./simulation-risk/index.js";
import type { AtBinaryDirection } from "./analysis/direction.js";
import {
  getAtBrokerIntentEngine,
  getAtBrokerIntentStore,
  getDisabledBrokerMutationAdapter,
  reconcileBrokerIntentWithRoObservation,
  dedupeObservedIds,
  type BrokerIntentPreflightInput,
  type BrokerRoObservation,
} from "./broker-intent/index.js";
import {
  getAtAutomationControlStore,
  evaluateAutomationStartReadiness,
  decideAutomationBootRecovery,
  toAutomationPublicStatus,
  type AutomationControlPublicStatus,
} from "./automation-control/index.js";
import {
  getAtSystemMasterStore,
  toSystemMasterPublicStatus,
  AT_SYSTEM_MASTER_OWNED_MODULES,
  type SystemMasterPublicStatus,
  type SystemMasterModuleId,
} from "./system-master/index.js";
import { prepareDemoExecutionPlan as buildDemoExecutionPlan } from "./order-execution/prepare-plan.js";
import type { AtExecutionPlan } from "./order-execution/types.js";
import { getDemoExecutionGrantStore } from "./demo-execution/grant-store.js";
import { deriveOperationalStatus } from "./operational-status.js";
import {
  assembleVerificationResult,
  uiEnvFromFc,
} from "./verification-engine.js";
import type { AutomatedTradingVerificationResult } from "./verification-types.js";
import {
  evaluateLiveOfferQuoteFreshness,
  evaluateVerificationQuoteFreshness,
  withEvaluatedMarketReadiness,
} from "./quote-freshness.js";
import { deriveAtPipelineStatus } from "./pipeline-status.js";
import { buildFeedStatusBreakdown } from "./feed-status-breakdown.js";
import { buildAtPipelineStages } from "./pipeline-stages.js";
import { describeMarketSelectionGap } from "./market-selection.js";
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
  private readonly simRiskEngine: AtSimRiskEngine;

  constructor(
    private readonly store: AutomatedTradingStore = getAutomatedTradingStore(),
    private readonly analysisEngine: AtOpenAiAnalysisEngine = getAtOpenAiAnalysisEngine(),
    monitor?: AtMonitorWorker,
    decisionEngine?: AtDecisionEngine,
    simRiskEngine?: AtSimRiskEngine,
  ) {
    this.monitor = monitor ?? getAtMonitorWorker();
    this.decisionEngine = decisionEngine ?? getAtDecisionEngine();
    this.simRiskEngine = simRiskEngine ?? getAtSimRiskEngine();
  }

  getMonitorStatus(): AtMonitorPublicStatus {
    return this.monitor.getPublicStatus();
  }

  /** Phase 57.1 — authoritative automation START/STOP status. */
  getAutomationControlStatus(): AutomationControlPublicStatus {
    return toAutomationPublicStatus(getAtAutomationControlStore().get());
  }

  /** Phase 4.18F.8R — owner System Master status (analysis lifecycle; never broker). */
  getSystemMasterStatus(): SystemMasterPublicStatus {
    return toSystemMasterPublicStatus(getAtSystemMasterStore().get());
  }

  /**
   * Read-only operational cycle history for evidence correlation.
   * Redacted — no tokens, image bytes, or secrets.
   */
  getOperationalCycleHistory(limit = 12): {
    schemaVersion: "at-operational-cycle-history-v1";
    cycles: Array<Record<string, unknown>>;
    scheduledTerminals: Array<Record<string, unknown>>;
    placesOrders: false;
    acceptsForExecution: false;
    mutatesBroker: false;
  } {
    const n = Math.max(1, Math.min(40, Math.floor(Number(limit) || 12)));
    const mon = this.monitor.getPublicStatus();
    const oa = this.analysisEngine.listHistory(n);
    const slotFromIso = (iso: string | null | undefined): number | null => {
      if (!iso) return null;
      const ms = Date.parse(iso);
      if (!Number.isFinite(ms)) return null;
      return Math.floor(Math.floor(ms / 1000) / 300) * 300;
    };
    const scheduledTerminals = (mon.health.recentCycleTerminals ?? []).slice(0, n).map((t) => ({
      kind: "scheduled_terminal" as const,
      slotSec: t.slotSec,
      scheduledAtUtc: t.scheduledAtUtc,
      startedAtUtc: t.startedAtUtc,
      completedAtUtc: t.completedAtUtc,
      durationMs: t.durationMs,
      terminalStatus: t.terminalStatus,
      trigger: t.trigger,
      analysisId: t.analysisId,
      observationId: t.observationId,
      imageId: t.imageId,
      imageHash: t.imageHash,
      lifecycle: t.lifecycle,
      canonicalFinalOutcome: t.canonicalFinalOutcome,
      blockerCode: t.blockerCode,
      includedImageBytesInRequest: t.includedImageBytesInRequest,
      isTerminal: true,
    }));
    const cycles = oa.map((row) => ({
      kind: "openai_history" as const,
      analysisId: row.analysisId ?? null,
      createdAtUtc: row.createdAtUtc ?? null,
      trigger: row.trigger ?? null,
      instrument: row.instrument ?? null,
      primaryTimeframe: row.primaryTimeframe ?? null,
      lifecycle: row.lifecycle ?? null,
      direction: row.direction ?? null,
      directionalConfidencePct: row.directionalConfidencePct ?? null,
      observationId: row.evidenceDelivery?.observationId ?? row.chartImage?.observationId ?? null,
      imageId: row.evidenceDelivery?.imageId ?? row.chartImage?.imageId ?? null,
      imageHash: row.evidenceDelivery?.imageHash ?? row.chartImage?.imageHash ?? null,
      imageSource: row.chartImage?.imageSourceLabel ?? row.chartImage?.source ?? null,
      includedImageBytesInRequest: row.evidenceDelivery?.includedImageBytesInRequest ?? null,
      imageDeliveryLifecycle: row.evidenceDelivery?.imageDeliveryLifecycle ?? null,
      requestStatus: row.evidenceDelivery?.requestStatus ?? null,
      responseStatus: row.evidenceDelivery?.responseStatus ?? null,
      validationStatus: row.evidenceDelivery?.validationStatus ?? null,
      // Per-row slot from analysis time — never overwrite all rows with latest monitor slot.
      scheduleSlotSec: slotFromIso(row.createdAtUtc ?? null),
      nextScheduledAnalysisAtUtc: mon.health.nextScheduledAnalysisAtUtc ?? null,
      isTerminal: row.lifecycle != null,
    }));
    return {
      schemaVersion: "at-operational-cycle-history-v1",
      cycles,
      scheduledTerminals,
      placesOrders: false,
      acceptsForExecution: false,
      mutatesBroker: false,
    };
  }

  /**
   * Phase 4.18F.8R — Owner SYSTEM ON.
   * Starts all managed analysis modules. Never enables broker execution.
   */
  async requestSystemMasterOn(input?: {
    expectedStateVersion?: number;
    instrument?: unknown;
    timeframe?: unknown;
    operatorHint?: string;
  }): Promise<{
    ok: boolean;
    code: string;
    message: string;
    systemMaster: SystemMasterPublicStatus;
    monitor: AtMonitorPublicStatus;
    status: AutomatedTradingPublicStatus;
    placesOrders: false;
    acceptsForExecution: false;
    mutatesBroker: false;
    brokerExecution: "DISABLED";
  }> {
    const masterStore = getAtSystemMasterStore();
    const before = masterStore.get();
    const expected =
      typeof input?.expectedStateVersion === "number"
        ? input.expectedStateVersion
        : before.stateVersion;
    const operator = String(input?.operatorHint ?? "owner").slice(0, 64);

    // Idempotent: already ON with worker enabled.
    if (
      before.ownerState === "ON"
      && (before.operationalState === "ON" || before.operationalState === "BLOCKED")
      && before.stateVersion === expected
      && this.monitor.getPublicStatus().config?.enabled === true
    ) {
      return {
        ok: true,
        code: "ALREADY_ON",
        message: "System Master already ON (analysis modules managed; broker execution DISABLED).",
        systemMaster: toSystemMasterPublicStatus(before),
        monitor: this.monitor.getPublicStatus(),
        status: await this.buildStatus(),
        placesOrders: false,
        acceptsForExecution: false,
        mutatesBroker: false,
        brokerExecution: "DISABLED",
      };
    }

    const starting = await masterStore.compareAndSet(expected, (prev) => ({
      ...prev,
      masterEnabled: true,
      ownerState: "ON",
      operationalState: "STARTING",
      changedBy: operator,
      lastError: null,
      lastBlockerCode: null,
      blockedModules: [],
      activeModules: [],
      lastStartAtUtc: new Date().toISOString(),
    }));
    if (!starting) {
      return {
        ok: false,
        code: "STALE_STATE_VERSION",
        message: "Stale System Master state version — refresh and retry.",
        systemMaster: toSystemMasterPublicStatus(masterStore.get()),
        monitor: this.monitor.getPublicStatus(),
        status: await this.buildStatus(),
        placesOrders: false,
        acceptsForExecution: false,
        mutatesBroker: false,
        brokerExecution: "DISABLED",
      };
    }

    const activated = await this.activateSystemMasterModules({
      instrument: input?.instrument,
      timeframe: input?.timeframe,
      operator,
    });

    await this.store.appendAudit({
      action: activated.ok ? "system_master_on" : "system_master_on_blocked",
      environment: this.store.getState().selectedEnvironment,
      ok: activated.ok,
      code: activated.code,
      detail: activated.message.slice(0, 160),
    });

    return {
      ok: activated.ok,
      code: activated.code,
      message: activated.message,
      systemMaster: this.getSystemMasterStatus(),
      monitor: this.monitor.getPublicStatus(),
      status: await this.buildStatus(),
      placesOrders: false,
      acceptsForExecution: false,
      mutatesBroker: false,
      brokerExecution: "DISABLED",
    };
  }

  /**
   * Phase 4.18F.8R — Owner SYSTEM OFF.
   * Stops all managed analysis modules. Does not stop shared ForexConnect sidecar/gateway.
   */
  async requestSystemMasterOff(input?: {
    expectedStateVersion?: number;
    operatorHint?: string;
  }): Promise<{
    ok: true;
    code: string;
    message: string;
    systemMaster: SystemMasterPublicStatus;
    monitor: AtMonitorPublicStatus;
    status: AutomatedTradingPublicStatus;
    placesOrders: false;
    acceptsForExecution: false;
    mutatesBroker: false;
    brokerExecution: "DISABLED";
  }> {
    const masterStore = getAtSystemMasterStore();
    const before = masterStore.get();
    const expected =
      typeof input?.expectedStateVersion === "number"
        ? input.expectedStateVersion
        : before.stateVersion;
    const operator = String(input?.operatorHint ?? "owner").slice(0, 64);

    if (before.ownerState === "OFF" && before.operationalState === "OFF" && before.stateVersion === expected) {
      // Ensure worker is stopped even if split-brain.
      if (this.monitor.getPublicStatus().config?.enabled) {
        await this.stopMonitoring().catch(() => undefined);
      }
      return {
        ok: true,
        code: "ALREADY_OFF",
        message: "System Master already OFF. No Automated Trading analysis cycles will start.",
        systemMaster: toSystemMasterPublicStatus(before),
        monitor: this.monitor.getPublicStatus(),
        status: await this.buildStatus(),
        placesOrders: false,
        acceptsForExecution: false,
        mutatesBroker: false,
        brokerExecution: "DISABLED",
      };
    }

    const stopping = await masterStore.compareAndSet(expected, (prev) => ({
      ...prev,
      masterEnabled: false,
      ownerState: "OFF",
      operationalState: "STOPPING",
      changedBy: operator,
      lastStopAtUtc: new Date().toISOString(),
      lastError: null,
      lastBlockerCode: "OPERATOR_STOP",
    }));
    if (!stopping) {
      await masterStore.forceSet((prev) => ({
        ...prev,
        masterEnabled: false,
        ownerState: "OFF",
        operationalState: "STOPPING",
        changedBy: operator,
        lastStopAtUtc: new Date().toISOString(),
        lastBlockerCode: "OPERATOR_STOP",
      }));
    }

    await this.stopMonitoring().catch(() => undefined);

    await masterStore.forceSet((prev) => ({
      ...prev,
      masterEnabled: false,
      ownerState: "OFF",
      operationalState: "OFF",
      activeModules: [],
      blockedModules: [],
      lastError: null,
      lastBlockerCode: "OPERATOR_STOP",
      changedBy: operator,
      lastStopAtUtc: prev.lastStopAtUtc ?? new Date().toISOString(),
    }));

    await this.store.appendAudit({
      action: "system_master_off",
      environment: this.store.getState().selectedEnvironment,
      ok: true,
      code: "OFF",
      detail: "System Master OFF — analysis modules stopped; shared sidecar/gateway left running.",
    });

    return {
      ok: true,
      code: "OFF",
      message:
        "System Master OFF. Automated Trading analysis stopped. Shared ForexConnect sidecar/gateway remain available for other modules. Broker execution DISABLED.",
      systemMaster: this.getSystemMasterStatus(),
      monitor: this.monitor.getPublicStatus(),
      status: await this.buildStatus(),
      placesOrders: false,
      acceptsForExecution: false,
      mutatesBroker: false,
      brokerExecution: "DISABLED",
    };
  }

  private async activateSystemMasterModules(input: {
    instrument?: unknown;
    timeframe?: unknown;
    operator: string;
  }): Promise<{ ok: boolean; code: string; message: string }> {
    const masterStore = getAtSystemMasterStore();
    const env = this.store.getState().selectedEnvironment;
    const monNow = this.monitor.getPublicStatus();
    const instrument = String(
      input.instrument
        ?? this.store.getState().environments[env].selectedInstrument
        ?? monNow.config?.instrument
        ?? "",
    ).trim();

    if (!instrument) {
      await masterStore.forceSet((prev) => ({
        ...prev,
        masterEnabled: true,
        ownerState: "ON",
        operationalState: "BLOCKED",
        activeModules: [],
        blockedModules: [...AT_SYSTEM_MASTER_OWNED_MODULES],
        lastBlockerCode: "INSTRUMENT_NOT_CONFIGURED",
        lastError:
          "System Master ON requested but no ForexConnect instrument is selected — analysis modules blocked.",
        changedBy: input.operator,
      }));
      await this.monitor.markAutomaticAnalysisBlocked({
        code: "INSTRUMENT_NOT_CONFIGURED",
        message: "System Master ON but instrument not configured.",
      });
      return {
        ok: false,
        code: "INSTRUMENT_NOT_CONFIGURED",
        message: "Select a ForexConnect instrument before System Master can activate analysis modules.",
      };
    }

    const timeframe =
      input.timeframe
      ?? (monNow.config?.timeframe && ["5m", "15m", "30m", "1h"].includes(monNow.config.timeframe)
        ? monNow.config.timeframe
        : AT_ANALYSIS_DEFAULT_TIMEFRAME);

    await this.runVerification({ environment: env, instrument, timeframe }).catch(() => undefined);

    const started = await this.startMonitoring({
      environment: env,
      instrument,
      timeframe,
      allowWhileMasterStarting: true,
    });
    if (!started.ok) {
      await masterStore.forceSet((prev) => ({
        ...prev,
        masterEnabled: true,
        ownerState: "ON",
        operationalState: "BLOCKED",
        activeModules: [],
        blockedModules: [...AT_SYSTEM_MASTER_OWNED_MODULES],
        lastBlockerCode: started.code,
        lastError: started.message.slice(0, 240),
        changedBy: input.operator,
      }));
      return { ok: false, code: started.code, message: started.message };
    }

    const active: SystemMasterModuleId[] = [...AT_SYSTEM_MASTER_OWNED_MODULES];
    await masterStore.forceSet((prev) => ({
      ...prev,
      masterEnabled: true,
      ownerState: "ON",
      operationalState: "ON",
      activeModules: active,
      blockedModules: [],
      lastError: null,
      lastBlockerCode: null,
      changedBy: input.operator,
      lastStartAtUtc: prev.lastStartAtUtc ?? new Date().toISOString(),
    }));
    return {
      ok: true,
      code: "ON",
      message: "System Master ON — Automated Trading analysis modules active (broker execution DISABLED).",
    };
  }

  /**
   * Boot recovery for System Master. Never silently defaults to ON.
   * If ownerState=ON → resume modules. If OFF → ensure analysis worker stopped.
   */
  async recoverSystemMasterOnBoot(): Promise<void> {
    const masterStore = getAtSystemMasterStore();
    const cur = masterStore.get();
    if (cur.ownerState !== "ON" || cur.masterEnabled !== true) {
      // Fail closed: stop any residual enabled monitor from prior F.8 auto-enable.
      if (this.monitor.getPublicStatus().config?.enabled) {
        await this.stopMonitoring().catch(() => undefined);
      }
      await masterStore.forceSet((prev) => ({
        ...prev,
        masterEnabled: false,
        ownerState: "OFF",
        operationalState: "OFF",
        activeModules: [],
        blockedModules: [],
        lastBlockerCode: prev.lastBlockerCode === "OPERATOR_STOP" ? "OPERATOR_STOP" : prev.lastBlockerCode,
        changedBy: "boot_recovery",
      }));
      return;
    }

    await masterStore.forceSet((prev) => ({
      ...prev,
      operationalState: "STARTING",
      changedBy: "boot_recovery",
    }));
    await this.activateSystemMasterModules({ operator: "boot_recovery" });
  }

  /**
   * Phase 57.4 / 4.18F.8 — Reconcile automation lifecycle with monitor worker.
   * Never enables broker execution.
   * Analysis-only automatic schedule is independent of automation OFF — do not stop
   * the analysis worker when trading-automation desire is OFF.
   */
  async reconcileAutomationMonitorAlignment(): Promise<void> {
    const autoStore = getAtAutomationControlStore();
    const cur = autoStore.get();
    const mon = this.monitor.getPublicStatus();
    const enabled = Boolean(mon.config?.enabled);

    // Phase 4.18F.8 — automation OFF must not disable the analysis schedule.
    // Trading/entry generation remains disabled separately.

    if (cur.lifecycle === "MONITORING" && cur.requestedMode === "ON" && !enabled) {
      const env = this.store.getState().selectedEnvironment;
      const instrument = String(
        this.store.getState().environments[env].selectedInstrument
          ?? mon.config?.instrument
          ?? "",
      ).trim();
      if (!instrument) {
        await autoStore.forceSet((prev) => ({
          ...prev,
          lifecycle: "BLOCKED",
          reasonCode: "INSTRUMENT_NOT_CONFIGURED",
          reasonMessage:
            "MONITORING reported but worker stopped and instrument missing — realigned to BLOCKED.",
          monitoringDesired: false,
          recoveryStatus: "RECOVERY_BLOCKED",
          entryGenerationEnabled: false,
          placesOrders: false,
          acceptsForExecution: false,
          brokerExecution: "DISABLED",
        }));
        return;
      }
      const started = await this.startMonitoring({
        environment: env,
        instrument,
        timeframe: mon.config?.timeframe ?? "15m",
      });
      if (!started.ok) {
        await autoStore.forceSet((prev) => ({
          ...prev,
          lifecycle: "BLOCKED",
          reasonCode: "MONITOR_START_FAILED",
          reasonMessage: started.message,
          monitoringDesired: false,
          recoveryStatus: "RECOVERY_BLOCKED",
          entryGenerationEnabled: false,
          placesOrders: false,
          acceptsForExecution: false,
          brokerExecution: "DISABLED",
        }));
      }
    }
  }

  /**
   * Phase 57.1 — START AUTO (monitoring/analysis only).
   * Never enables broker execution, masterEnable, or placesOrders.
   */
  async startAutomation(input?: {
    expectedStateVersion?: number;
    instrument?: unknown;
    timeframe?: unknown;
    operatorHint?: string;
  }): Promise<{
    ok: boolean;
    code: string;
    message: string;
    automation: AutomationControlPublicStatus;
    status: AutomatedTradingPublicStatus;
    monitor: AtMonitorPublicStatus;
    placesOrders: false;
    acceptsForExecution: false;
    brokerExecution: "DISABLED";
  }> {
    const autoStore = getAtAutomationControlStore();
    const before = autoStore.get();
    const expected =
      typeof input?.expectedStateVersion === "number"
        ? input.expectedStateVersion
        : before.stateVersion;

    // Idempotent: already MONITORING with requested ON — but heal split-brain if
    // the monitor worker is not actually enabled (Phase 57.3 continuity).
    if (
      before.requestedMode === "ON"
      && before.lifecycle === "MONITORING"
      && before.stateVersion === expected
    ) {
      const monNow = this.monitor.getPublicStatus();
      if (monNow.config?.enabled === true) {
        return {
          ok: true,
          code: "ALREADY_MONITORING",
          message: "Automation already MONITORING (broker execution still DISABLED).",
          automation: toAutomationPublicStatus(before),
          status: await this.buildStatus(),
          monitor: monNow,
          placesOrders: false,
          acceptsForExecution: false,
          brokerExecution: "DISABLED",
        };
      }
      // Fall through to readiness + startMonitoring to realign the worker.
    }

    const starting = await autoStore.compareAndSet(expected, (prev) => ({
      ...prev,
      requestedMode: "ON",
      lifecycle: "STARTING",
      reasonCode: "NONE",
      reasonMessage: "Starting automation readiness checks…",
      lastOperatorHint: String(input?.operatorHint ?? "admin").slice(0, 64),
      monitoringDesired: true,
      recoveryStatus: "RECOVERY_PENDING",
      entryGenerationEnabled: false,
      placesOrders: false,
      acceptsForExecution: false,
      brokerExecution: "DISABLED",
    }));
    if (!starting) {
      return {
        ok: false,
        code: "STALE_STATE_VERSION",
        message: "Stale automation state version — refresh and retry.",
        automation: toAutomationPublicStatus(autoStore.get()),
        status: await this.buildStatus(),
        monitor: this.monitor.getPublicStatus(),
        placesOrders: false,
        acceptsForExecution: false,
        brokerExecution: "DISABLED",
      };
    }

    // Phase 57.3 — Refresh live Offers evidence before readiness. Do not gate START
    // solely on an aged lastVerification snapshot (chicken-and-egg when monitor is OFF).
    const envHint =
      this.store.getState().selectedEnvironment;
    const instrumentHint = String(
      input?.instrument
        ?? this.store.getState().environments[envHint].selectedInstrument
        ?? "",
    ).trim();
    if (instrumentHint) {
      await this.runVerification({
        environment: envHint,
        instrument: instrumentHint,
        timeframe: input?.timeframe,
      }).catch(() => undefined);
    }

    const pub = await this.buildStatus();
    const env = pub.selectedEnvironment;
    const controls = pub.controls;
    const instrument = String(
      input?.instrument
        ?? this.store.getState().environments[env].selectedInstrument
        ?? "",
    ).trim();
    const readiness = evaluateAutomationStartReadiness({
      masterEnable: controls.masterEnable === true,
      emergencyEntryLock: controls.emergencyEntryLock === true,
      placesOrders: false,
      acceptsForExecution: false,
      forexConnectTradingEnabled: false,
      automaticEntryEnabled: false,
      automaticReentryEnabled: false,
      instrumentConfigured: Boolean(instrument),
      quoteFresh: pub.quoteFreshness?.fresh ?? null,
      quoteFreshnessReasonCode: pub.quoteFreshness?.reasonCode ?? null,
      monitorCanStart: true,
    });

    if (!readiness.ok) {
      const blocked = await autoStore.forceSet((prev) => ({
        ...prev,
        requestedMode: "ON",
        lifecycle: "BLOCKED",
        reasonCode: readiness.reasonCode,
        reasonMessage: readiness.reasonMessage,
        monitoringDesired: false,
        recoveryStatus: "RECOVERY_BLOCKED",
        entryGenerationEnabled: false,
        placesOrders: false,
        acceptsForExecution: false,
        brokerExecution: "DISABLED",
      }));
      await this.store.appendAudit({
        action: "automation_start_blocked",
        environment: env,
        ok: false,
        code: readiness.reasonCode,
        detail: String(readiness.reasonMessage ?? readiness.reasonCode).slice(0, 160),
      });
      return {
        ok: false,
        code: readiness.reasonCode,
        message: readiness.reasonMessage ?? "Automation start blocked.",
        automation: toAutomationPublicStatus(blocked),
        status: await this.buildStatus(),
        monitor: this.monitor.getPublicStatus(),
        placesOrders: false,
        acceptsForExecution: false,
        brokerExecution: "DISABLED",
      };
    }

    // Prefer explicit TF; else last monitor config if supported; else 5m (wall-clock schedule).
    const monCfgTf = this.monitor.getPublicStatus().config?.timeframe;
    const timeframe =
      input?.timeframe
      ?? (typeof monCfgTf === "string" && ["5m", "15m", "30m", "1h"].includes(monCfgTf)
        ? monCfgTf
        : "5m");
    const mon = await this.startMonitoring({
      environment: env,
      instrument,
      timeframe,
      expectedEnvironmentEpoch: pub.environmentEpoch,
    });

    if (!mon.ok) {
      const blocked = await autoStore.forceSet((prev) => ({
        ...prev,
        requestedMode: "ON",
        lifecycle: "BLOCKED",
        reasonCode: "MONITOR_START_FAILED",
        reasonMessage: mon.message,
        monitoringDesired: false,
        recoveryStatus: "RECOVERY_BLOCKED",
        entryGenerationEnabled: false,
        placesOrders: false,
        acceptsForExecution: false,
        brokerExecution: "DISABLED",
      }));
      await this.store.appendAudit({
        action: "automation_start_blocked",
        environment: env,
        ok: false,
        code: "MONITOR_START_FAILED",
        detail: mon.message.slice(0, 160),
      });
      return {
        ok: false,
        code: "MONITOR_START_FAILED",
        message: mon.message,
        automation: toAutomationPublicStatus(blocked),
        status: mon.status,
        monitor: mon.monitor,
        placesOrders: false,
        acceptsForExecution: false,
        brokerExecution: "DISABLED",
      };
    }

    const active = await autoStore.forceSet((prev) => ({
      ...prev,
      requestedMode: "ON",
      lifecycle: "MONITORING",
      reasonCode: "NONE",
      reasonMessage:
        "Market monitoring ACTIVE. Broker execution DISABLED. Entry generation DISABLED.",
      monitoringDesired: true,
      lastMonitoringAtUtc: new Date().toISOString(),
      recoveryStatus: "RECOVERED",
      entryGenerationEnabled: false,
      placesOrders: false,
      acceptsForExecution: false,
      brokerExecution: "DISABLED",
    }));
    await this.store.appendAudit({
      action: "automation_started",
      environment: env,
      ok: true,
      code: "MONITORING",
      detail: `${instrument} monitoring; brokerExecution=DISABLED`.slice(0, 160),
    });

    return {
      ok: true,
      code: "MONITORING",
      message:
        "Automation MONITORING — market analysis may run. Broker execution remains DISABLED.",
      automation: toAutomationPublicStatus(active),
      status: mon.status,
      monitor: mon.monitor,
      placesOrders: false,
      acceptsForExecution: false,
      brokerExecution: "DISABLED",
    };
  }

  /**
   * Phase 57.1 / 4.18F.8 — STOP AUTO. Idempotent.
   * Clears trading-automation desire only. Does NOT stop the analysis-only
   * 5-minute schedule (analysis is independent of START/STOP AUTO).
   * Never cancels broker orders (none authorized).
   */
  async stopAutomation(input?: {
    expectedStateVersion?: number;
    operatorHint?: string;
  }): Promise<{
    ok: true;
    code: string;
    message: string;
    automation: AutomationControlPublicStatus;
    status: AutomatedTradingPublicStatus;
    monitor: AtMonitorPublicStatus;
    placesOrders: false;
    acceptsForExecution: false;
    brokerExecution: "DISABLED";
  }> {
    const autoStore = getAtAutomationControlStore();
    const before = autoStore.get();
    const expected =
      typeof input?.expectedStateVersion === "number"
        ? input.expectedStateVersion
        : before.stateVersion;

    if (before.requestedMode === "OFF" && before.lifecycle === "OFF") {
      return {
        ok: true,
        code: "ALREADY_OFF",
        message: "Automation already OFF. Analysis schedule remains independent.",
        automation: toAutomationPublicStatus(before),
        status: await this.buildStatus(),
        monitor: this.monitor.getPublicStatus(),
        placesOrders: false,
        acceptsForExecution: false,
        brokerExecution: "DISABLED",
      };
    }

    const stopping = await autoStore.compareAndSet(expected, (prev) => ({
      ...prev,
      requestedMode: "OFF",
      lifecycle: "STOPPING",
      reasonCode: "OPERATOR_STOP",
      reasonMessage: "Stopping trading-automation desire…",
      lastOperatorHint: String(input?.operatorHint ?? "admin").slice(0, 64),
      monitoringDesired: false,
      entryGenerationEnabled: false,
      placesOrders: false,
      acceptsForExecution: false,
      brokerExecution: "DISABLED",
    }));

    if (!stopping) {
      // Stale version — still force stop for safety (fail closed toward OFF).
      await autoStore.forceSet((prev) => ({
        ...prev,
        requestedMode: "OFF",
        lifecycle: "STOPPING",
        reasonCode: "OPERATOR_STOP",
        reasonMessage: "Stop forced after stale version — fail closed.",
        monitoringDesired: false,
        entryGenerationEnabled: false,
        placesOrders: false,
        acceptsForExecution: false,
        brokerExecution: "DISABLED",
      }));
    }

    // Phase 4.18F.8 — do not stop analysis worker here.
    const off = await autoStore.forceSet((prev) => ({
      ...prev,
      requestedMode: "OFF",
      lifecycle: "OFF",
      reasonCode: "OPERATOR_STOP",
      reasonMessage:
        "Trading-automation OFF. Analysis 5-minute schedule continues independently. Broker execution DISABLED.",
      monitoringDesired: false,
      recoveryStatus: "IDLE",
      entryGenerationEnabled: false,
      placesOrders: false,
      acceptsForExecution: false,
      brokerExecution: "DISABLED",
    }));

    await this.store.appendAudit({
      action: "automation_stopped",
      environment: this.store.getState().selectedEnvironment,
      ok: true,
      code: "OFF",
      detail: "STOP AUTO — trading desire OFF; analysis schedule left running.",
    });

    return {
      ok: true,
      code: "OFF",
      message:
        "Trading-automation OFF. Analysis schedule continues. Broker execution remains DISABLED.",
      automation: toAutomationPublicStatus(off),
      status: await this.buildStatus(),
      monitor: this.monitor.getPublicStatus(),
      placesOrders: false,
      acceptsForExecution: false,
      brokerExecution: "DISABLED",
    };
  }

  /**
   * Phase 57.2 — After process restart: never resume entry generation / broker execution.
   * Soft-resume MONITORING only when readiness revalidation passes; otherwise BLOCKED
   * with a concrete reason and align monitor worker (stop) to avoid split-brain.
   */
  async recoverAutomationControlOnBoot(): Promise<void> {
    const autoStore = getAtAutomationControlStore();
    const cur = autoStore.get();

    let readiness = null as ReturnType<typeof evaluateAutomationStartReadiness> | null;
    try {
      // Phase 57.3 — Obtain post-restart live quote evidence before soft-resume decision.
      const envPre = this.store.getState().selectedEnvironment;
      const instrumentPre = String(
        this.store.getState().environments[envPre].selectedInstrument ?? "",
      ).trim();
      if (instrumentPre) {
        await this.runVerification({
          environment: envPre,
          instrument: instrumentPre,
        }).catch(() => undefined);
      }
      const pub = await this.buildStatus();
      const env = pub.selectedEnvironment;
      const instrument = String(
        this.store.getState().environments[env].selectedInstrument ?? "",
      ).trim();
      readiness = evaluateAutomationStartReadiness({
        masterEnable: pub.controls.masterEnable === true,
        emergencyEntryLock: pub.controls.emergencyEntryLock === true,
        placesOrders: false,
        acceptsForExecution: false,
        forexConnectTradingEnabled: false,
        automaticEntryEnabled: false,
        automaticReentryEnabled: false,
        instrumentConfigured: Boolean(instrument),
        quoteFresh: pub.quoteFreshness?.fresh ?? null,
        quoteFreshnessReasonCode: pub.quoteFreshness?.reasonCode ?? null,
        monitorCanStart: true,
      });
    } catch {
      readiness = {
        ok: false,
        reasonCode: "AMBIGUOUS_RECOVERY",
        reasonMessage: "Boot readiness evaluation failed — monitoring not resumed.",
        placesOrders: false,
        acceptsForExecution: false,
        brokerExecution: "DISABLED",
        entryGenerationEnabled: false,
      };
    }

    const mon = this.monitor.getPublicStatus();
    const monitorEnabled = Boolean(mon.config?.enabled);
    const decision = decideAutomationBootRecovery({
      persisted: cur,
      readiness,
      monitorEnabled,
    });

    if (decision.action === "SOFT_RESUME_MONITORING") {
      // Always (re)start monitor worker on soft-resume so enabled=false cannot
      // leave automation MONITORING while the worker is STOPPED.
      const env = this.store.getState().selectedEnvironment;
      const instrument = String(
        this.store.getState().environments[env].selectedInstrument ?? "",
      ).trim();
      if (!instrument) {
        await this.stopMonitoring().catch(() => undefined);
        await autoStore.forceSet((prev) => ({
          ...prev,
          requestedMode: "ON",
          lifecycle: "BLOCKED",
          reasonCode: "INSTRUMENT_NOT_CONFIGURED",
          reasonMessage:
            "Soft-resume aborted — instrument not configured. Broker execution remains DISABLED.",
          monitoringDesired: false,
          recoveryStatus: "RECOVERY_BLOCKED",
          entryGenerationEnabled: false,
          placesOrders: false,
          acceptsForExecution: false,
          brokerExecution: "DISABLED",
        }));
        return;
      }
      const started = await this.startMonitoring({
        environment: env,
        instrument,
        timeframe: mon.config?.timeframe ?? AT_ANALYSIS_DEFAULT_TIMEFRAME,
      });
      if (!started.ok) {
        await this.stopMonitoring().catch(() => undefined);
        await autoStore.forceSet((prev) => ({
          ...prev,
          requestedMode: "ON",
          lifecycle: "BLOCKED",
          reasonCode: "MONITOR_START_FAILED",
          reasonMessage: started.message,
          monitoringDesired: false,
          recoveryStatus: "RECOVERY_BLOCKED",
          entryGenerationEnabled: false,
          placesOrders: false,
          acceptsForExecution: false,
          brokerExecution: "DISABLED",
        }));
        return;
      }
      await autoStore.forceSet((prev) => ({
        ...prev,
        requestedMode: "ON",
        lifecycle: "MONITORING",
        reasonCode: decision.reasonCode,
        reasonMessage: decision.reasonMessage,
        monitoringDesired: true,
        lastMonitoringAtUtc: new Date().toISOString(),
        recoveryStatus: "RECOVERED",
        entryGenerationEnabled: false,
        placesOrders: false,
        acceptsForExecution: false,
        brokerExecution: "DISABLED",
      }));
      await this.store.appendAudit({
        action: "automation_boot_recovered",
        environment: this.store.getState().selectedEnvironment,
        ok: true,
        code: "RECOVERY_SOFT_RESUMED",
        detail: "Monitoring soft-resumed after restart; broker execution DISABLED.",
      });
      return;
    }

    if (decision.stopMonitorWorker) {
      await this.stopMonitoring().catch(() => undefined);
    }

    if (
      decision.action === "KEEP_OFF"
      || decision.action === "FORCE_OFF_FROM_STOPPING"
      || decision.action === "BLOCK_AND_ALIGN_MONITOR_STOP"
      || decision.action === "NOOP_ENSURE_INVARIANTS"
    ) {
      await autoStore.forceSet((prev) => ({
        ...prev,
        requestedMode: decision.requestedMode,
        lifecycle: decision.nextLifecycle,
        reasonCode: decision.reasonCode,
        reasonMessage: decision.reasonMessage,
        monitoringDesired: decision.monitoringDesired,
        recoveryStatus: decision.recoveryStatus,
        entryGenerationEnabled: false,
        placesOrders: false,
        acceptsForExecution: false,
        brokerExecution: "DISABLED",
      }));
    }
  }

  /**
   * Phase 4.18F.8R — Only resumes analysis when System Master ownerState is ON.
   * Never silently defaults to ON. Never enables broker execution.
   */
  async ensureAutomaticAnalysisScheduleOnBoot(): Promise<AtMonitorPublicStatus> {
    const master = getAtSystemMasterStore().get();
    if (master.ownerState !== "ON" || master.masterEnabled !== true) {
      if (this.monitor.getPublicStatus().config?.enabled) {
        await this.stopMonitoring().catch(() => undefined);
      }
      return this.monitor.getPublicStatus();
    }
    await this.recoverSystemMasterOnBoot();
    return this.monitor.getPublicStatus();
  }

  async startMonitoring(input: {
    environment?: unknown;
    expectedEnvironmentEpoch?: unknown;
    instrument?: unknown;
    timeframe?: unknown;
    /** Internal: allow start while System Master is transitioning to ON. */
    allowWhileMasterStarting?: boolean;
  }): Promise<
    | { ok: true; status: AutomatedTradingPublicStatus; monitor: AtMonitorPublicStatus }
    | { ok: false; code: string; message: string; status: AutomatedTradingPublicStatus; monitor: AtMonitorPublicStatus }
  > {
    const master = getAtSystemMasterStore().get();
    const masterAllows =
      master.ownerState === "ON"
      && (
        master.operationalState === "ON"
        || master.operationalState === "STARTING"
        || master.operationalState === "BLOCKED"
        || input.allowWhileMasterStarting === true
      );
    if (!masterAllows) {
      return {
        ok: false,
        code: "SYSTEM_MASTER_OFF",
        message: "System Master is OFF — analysis modules cannot start until the owner turns SYSTEM ON.",
        status: await this.buildStatus(),
        monitor: this.monitor.getPublicStatus(),
      };
    }
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
    | {
      ok: true;
      analysisId: string;
      status: AutomatedTradingPublicStatus;
      monitor: AtMonitorPublicStatus;
      /** Phase 4.18F.7 — redacted proof (no image bytes / secrets). */
      analysisProof: {
        lifecycle: string | null;
        instrument: string | null;
        timeframes: string[];
        primaryTimeframe: string | null;
        direction: "BUY" | "SELL" | null;
        directionalConfidencePct: number | null;
        confidenceType: "ANALYSIS_CONFIDENCE";
        isCalibratedWinProbability: false;
        chartImageReviewed: boolean;
        chartImage: {
          available: boolean;
          imageHash: string | null;
          includedInOpenAiRequest: boolean;
          imageSourceLabel: string | null;
          observationId: string | null;
          imageId: string | null;
          source: string | null;
          note: string | null;
        } | null;
        evidenceDelivery: Record<string, unknown> | null;
        evidenceIntegrityStatus: string | null;
        canonicalFinalOutcome: string | null;
        canonicalDirection: "BUY" | "SELL" | "NO_TRADE" | null;
        canonicalConfidencePct: number | null;
        placesOrders: false;
        acceptsForExecution: false;
        mutatesBroker: false;
      } | null;
    }
    | { ok: false; code: string; message: string; status: AutomatedTradingPublicStatus; monitor: AtMonitorPublicStatus }
  > {
    const master = getAtSystemMasterStore().get();
    if (master.ownerState !== "ON" || master.masterEnabled !== true) {
      return {
        ok: false,
        code: "SYSTEM_MASTER_OFF",
        message: "System Master is OFF — OpenAI analysis requests are blocked until the owner turns SYSTEM ON.",
        status: await this.buildStatus(),
        monitor: this.monitor.getPublicStatus(),
      };
    }
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
    let analysisProof: {
      lifecycle: string | null;
      instrument: string | null;
      timeframes: string[];
      primaryTimeframe: string | null;
      direction: "BUY" | "SELL" | null;
      directionalConfidencePct: number | null;
      confidenceType: "ANALYSIS_CONFIDENCE";
      isCalibratedWinProbability: false;
      chartImageReviewed: boolean;
      chartImage: {
        available: boolean;
        imageHash: string | null;
        includedInOpenAiRequest: boolean;
        imageSourceLabel: string | null;
        observationId: string | null;
        imageId: string | null;
        source: string | null;
        note: string | null;
      } | null;
      evidenceDelivery: Record<string, unknown> | null;
      evidenceIntegrityStatus: string | null;
      canonicalFinalOutcome: string | null;
      canonicalDirection: "BUY" | "SELL" | "NO_TRADE" | null;
      canonicalConfidencePct: number | null;
      placesOrders: false;
      acceptsForExecution: false;
      mutatesBroker: false;
    } | null = null;
    try {
      const saved = this.analysisEngine.getById(result.analysisId)
        ?? this.analysisEngine.getLatest();
      const row = saved && saved.analysisId === result.analysisId
        ? saved
        : this.analysisEngine.listHistory(12).find((h) => h.analysisId === result.analysisId)
          ?? null;
      const monHealth = result.status?.health;
      if (row) {
        const chart = row.chartImage;
        const imageInRequest = row.evidenceDelivery?.includedImageBytesInRequest === true
          || chart?.includedInOpenAiRequest === true;
        analysisProof = {
          lifecycle: row.lifecycle ?? null,
          instrument: row.instrument ?? null,
          timeframes: Array.isArray(row.timeframes) ? row.timeframes.map(String) : [],
          primaryTimeframe: row.primaryTimeframe ?? null,
          direction: row.direction === "BUY" || row.direction === "SELL" ? row.direction : null,
          directionalConfidencePct: row.directionalConfidencePct ?? null,
          confidenceType: "ANALYSIS_CONFIDENCE",
          isCalibratedWinProbability: false,
          chartImageReviewed: imageInRequest && row.lifecycle === "ANALYSIS_VALID",
          chartImage: chart
            ? {
              available: Boolean(chart.available),
              imageHash: chart.imageHash ?? null,
              includedInOpenAiRequest: chart.includedInOpenAiRequest === true,
              imageSourceLabel: chart.imageSourceLabel ?? null,
              observationId: chart.observationId ?? null,
              imageId: chart.imageId ?? null,
              source: chart.source ?? null,
              note: chart.note ? String(chart.note).slice(0, 160) : null,
            }
            : null,
          evidenceDelivery: row.evidenceDelivery
            ? {
              phase: row.evidenceDelivery.phase ?? null,
              requestStatus: row.evidenceDelivery.requestStatus ?? null,
              responseStatus: row.evidenceDelivery.responseStatus ?? null,
              validationStatus: row.evidenceDelivery.validationStatus ?? null,
              imageDeliveryLifecycle: row.evidenceDelivery.imageDeliveryLifecycle ?? null,
              includedImageBytesInRequest: row.evidenceDelivery.includedImageBytesInRequest === true,
              imageSource: row.evidenceDelivery.imageSource ?? null,
              observationId: row.evidenceDelivery.observationId ?? null,
              imageId: row.evidenceDelivery.imageId ?? null,
              imageHash: row.evidenceDelivery.imageHash ?? null,
              timeframesIncluded: row.evidenceDelivery.timeframesIncluded ?? [],
              categoriesIncluded: row.evidenceDelivery.categoriesIncluded ?? null,
              placesOrders: false,
              acceptsForExecution: false,
              mutatesBroker: false,
              blockers: row.evidenceDelivery.blockers ?? [],
            }
            : null,
          evidenceIntegrityStatus: monHealth?.lastEvidenceIntegrityStatus ?? null,
          canonicalFinalOutcome: monHealth?.lastCanonicalFinalOutcome ?? null,
          canonicalDirection: monHealth?.lastCanonicalDirection ?? null,
          canonicalConfidencePct: monHealth?.lastCanonicalConfidencePct ?? null,
          placesOrders: false,
          acceptsForExecution: false,
          mutatesBroker: false,
        };
      }
    } catch {
      analysisProof = null;
    }
    return {
      ok: true,
      analysisId: result.analysisId,
      status,
      monitor: result.status,
      analysisProof,
    };
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

    const verificationRaw = envState.lastVerification;
    // Re-evaluate cached verification with the same freshness contract as the monitor worker.
    const freshnessEval = evaluateVerificationQuoteFreshness(verificationRaw, {
      expectedInstrument: envState.selectedInstrument,
    });
    // Phase 59.0.11 — independently sample live Offers session so a frozen verification
    // snapshot cannot be mistaken for the current market (and vice versa).
    let liveOfferFreshness: ReturnType<typeof evaluateLiveOfferQuoteFreshness> | null = null;
    try {
      if (envState.selectedInstrument) {
        const liveSvc = getForexConnectLiveCandleService();
        const latest = liveSvc.getLatestQuoteState(envState.selectedInstrument);
        if (latest) {
          const nowMs = Date.now();
          liveOfferFreshness = evaluateLiveOfferQuoteFreshness({
            instrument: envState.selectedInstrument,
            bid: latest.quote.bid,
            ask: latest.quote.ask,
            streamState: latest.streamState,
            priceChangeAgeMs: latest.lastPriceChangeAtMs != null
              ? Math.max(0, nowMs - latest.lastPriceChangeAtMs)
              : null,
            receiptAgeMs: latest.lastQuoteAtMs != null
              ? Math.max(0, nowMs - latest.lastQuoteAtMs)
              : null,
            updateCount: latest.updateCount,
            tradingStatus: latest.quote.tradingStatus ?? null,
            sourceTimestampMs: latest.quote.sourceTimestampMs,
            receivedAtMs: latest.quote.receivedAtMs,
            nowMs,
          });
        }
      }
    } catch {
      liveOfferFreshness = null;
    }
    const verification = verificationRaw
      ? withEvaluatedMarketReadiness(verificationRaw, freshnessEval)
      : null;
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
      if (!freshnessEval.fresh && verificationRaw?.readiness.marketDataHealthVerified) {
        if (liveOfferFreshness?.fresh) {
          blockers.push(
            `Verification snapshot aged (${freshnessEval.reasonCode}); live Offers feed is ${liveOfferFreshness.reasonCode} — re-run Verify to refresh the snapshot.`,
          );
        } else {
          blockers.push(
            `Market verification snapshot is no longer fresh (${freshnessEval.reasonCode}).`,
          );
        }
      }
    }
    if (liveOfferFreshness && !liveOfferFreshness.orderPathMarketReady) {
      const code = liveOfferFreshness.orderPathBlockerCode ?? liveOfferFreshness.reasonCode;
      if (code === "TRADING_STATUS_CLOSED" || code === "TRADING_STATUS_UNKNOWN") {
        blockers.push(liveOfferFreshness.tradingEligibility.message);
      } else if (!liveOfferFreshness.fresh) {
        blockers.push(
          `Live Offers order-path market not ready (${code}).`,
        );
      }
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
    // Execution / trading readiness never READY while broker execution is forbidden.
    // `moduleStatus` remains the execution-posture field (typically BLOCKED).
    if (moduleStatus === "READY") moduleStatus = "BLOCKED";

    const autoPersisted = getAtAutomationControlStore().get();
    const monPublic = this.monitor.getPublicStatus();
    const operationalStatus = deriveOperationalStatus({
      automation: autoPersisted,
      monitorEnabled: Boolean(monPublic.config?.enabled),
      workerActive: Boolean(monPublic.health?.workerActive),
      quoteFresh: freshnessEval.fresh,
      quoteReasonCode: freshnessEval.reasonCode,
    });

    const fresh = this.store.getState();
    const selectedFresh = fresh.environments[fresh.selectedEnvironment];

    const inst = verification?.instrument;
    const semantics = resolveXauQuantitySemantics({
      symbol: inst?.symbol ?? selectedFresh.selectedInstrument,
      instrumentType: inst?.instrumentType,
      pointSize: inst?.pointSize,
      pipCostAccount: inst?.pipCostAccount,
      baseUnitSize: inst?.baseUnitSize,
      contractMultiplier: inst?.contractMultiplier,
      quantityStep: inst?.quantityStep,
      quantityMin: inst?.quantityMin,
      legacyQuantityUnitLabel: inst?.quantityUnit,
      condDistStop: inst?.condDistStop,
      condDistAvailable: Boolean(inst?.condDistAvailable),
      condDistStopUnit: inst?.condDistUnit ?? undefined,
      condDistMethod: inst?.condDistMethod ?? undefined,
      fromDocumentedSdkMethod: isDocumentedCondDistMethod(inst?.condDistMethod),
    });

    let exposureSummary: AutomatedTradingPublicStatus["exposureReconciliation"] = null;
    try {
      if (connectionStatus === "CONNECTED" && sessionMatchesSelection) {
        const bridge = getForexConnectBridge();
        const [openOrders, openTrades] = await Promise.all([
          bridge.listOrders(),
          bridge.listTrades(),
        ]);
        const exposureInstrument = String(inst?.symbol ?? selectedFresh.selectedInstrument ?? "").trim();
        if (exposureInstrument) {
        const rec = reconcileBrokerExposure({
          instrument: exposureInstrument,
          environment: fresh.selectedEnvironment,
          openWorkingOrders: openOrders as Record<string, unknown>,
          openPositions: {
            ...(openTrades as Record<string, unknown>),
            trades: (openTrades as { trades?: unknown[] }).trades ?? [],
          },
        });
        exposureSummary = {
          authoritative: rec.authoritative,
          status: rec.status,
          confirmedZeroExposure: rec.confirmedZeroExposure,
          openPositionsCount: rec.openPositionsCount,
          pendingOrdersCount: rec.pendingOrdersCount,
          note: rec.note,
          ordersCapability: rec.ordersCapability,
          tradesCapability: rec.tradesCapability,
        };
        if (rec.authoritative && typeof rec.openPositionsCount === "number") {
          openPositionsCount = rec.openPositionsCount;
        }
        }
      }
    } catch {
      exposureSummary = {
        authoritative: false,
        status: "UNAVAILABLE",
        confirmedZeroExposure: false,
        openPositionsCount: null,
        pendingOrdersCount: null,
        note: "Orders/Trades RO reconciliation failed — not treated as zero.",
        ordersCapability: null,
        tradesCapability: null,
      };
    }

    const qtyConstraints = resolveXauQuantityConstraints({
      quantityUnit: semantics.resolvedQuantityUnit,
      quantityUnitAmbiguous: semantics.quantityUnitAmbiguous,
      baseUnitSize: inst?.baseUnitSize,
      sdkMinQuantity: inst?.quantityMin,
      legacyLotStep: inst?.quantityStep,
      reportedQuantityStep: inst?.quantityStep,
      reportedQuantityMin: inst?.quantityMin,
    });
    const acctCcy = verification?.account?.accountCurrency ?? null;
    const acctCcyNorm = acctCcy ? String(acctCcy).trim().toUpperCase() : "";
    // Phase 56.4.0 — USD identity is READY; non-USD requires a fresh Offers ConversionRateSnapshot.
    let conversionRequired = Boolean(acctCcyNorm && acctCcyNorm !== "USD");
    let conversionReady = !conversionRequired;
    let conversionReason: string | null = null;
    let conversionEvidence: Record<string, unknown> = conversionRequired
      ? { required: true, ready: false }
      : { required: false, ready: true, path: "IDENTITY", accountCurrency: acctCcyNorm || null };
    if (conversionRequired && connectionStatus === "CONNECTED" && sessionMatchesSelection) {
      try {
        const bridgeFx = getForexConnectBridge();
        const instResFx = await bridgeFx.listInstruments();
        const offers = (instResFx.instruments ?? []).map((row) => ({
          baseAsset: row.baseAsset,
          quoteAsset: row.quoteAsset,
          providerSymbol: row.providerSymbol,
          bid: row.bid ?? null,
          ask: row.ask ?? null,
          observedAtUtc: verification?.verifiedAtUtc ?? new Date().toISOString(),
        }));
        const built = buildOffersConversionRateSnapshot({
          fromCurrency: "USD",
          toCurrency: acctCcyNorm,
          offers,
          observedAtUtc: verification?.verifiedAtUtc ?? new Date().toISOString(),
          maxAgeMs: 30_000,
        });
        if (built.ok) {
          conversionReady = true;
          conversionReason = null;
          conversionEvidence = {
            required: true,
            ready: true,
            path: built.path,
            source: built.snapshot.source,
            direction: built.snapshot.direction,
            observedAtUtc: built.snapshot.observedAtUtc,
            maxAgeMs: built.snapshot.maxAgeMs,
            fromCurrency: built.snapshot.fromCurrency,
            toCurrency: built.snapshot.toCurrency,
            // Rate value omitted from public status — presence + provenance only.
            rateAttested: true,
          };
        } else {
          conversionReady = false;
          conversionReason = built.message;
          conversionEvidence = {
            required: true,
            ready: false,
            code: built.code,
            message: built.message,
          };
        }
      } catch {
        conversionReady = false;
        conversionReason =
          "Non-USD account — Offers FX snapshot unavailable (listInstruments failed).";
        conversionEvidence = { required: true, ready: false, code: "FX_OFFERS_UNAVAILABLE" };
      }
    } else if (conversionRequired) {
      conversionReason =
        "Non-USD account — authoritative FX snapshot requires a matching Connected session.";
      conversionEvidence = {
        required: true,
        ready: false,
        code: "FX_SESSION_REQUIRED",
        message: conversionReason,
      };
    }
    const simReadiness = evaluateSimulationDataReadiness({
      environment: fresh.selectedEnvironment,
      environmentMatches: sessionMatchesSelection,
      quoteFresh: freshnessEval.fresh,
      quoteReasonCode: freshnessEval.reasonCode,
      feedStatus: verification?.market?.feedStatus ?? null,
      bid: verification?.market?.bid ?? null,
      ask: verification?.market?.ask ?? null,
      accountVerified,
      accountCurrency: acctCcy,
      equity: verification?.account?.equity ?? null,
      usableMargin: verification?.account?.usableMargin ?? null,
      accountFresh: verification?.account?.isFresh ?? null,
      quantityUnit: semantics.resolvedQuantityUnit,
      quantityUnitAmbiguous: semantics.quantityUnitAmbiguous,
      quantityMin: qtyConstraints.quantityMin,
      quantityStep: qtyConstraints.quantityStep,
      quantityConstraintsVerified: !qtyConstraints.sizingBlocked,
      minStopDistanceVerified: semantics.minStopDistanceVerified,
      minStopNoPositiveMinimum: semantics.minStopNoPositiveMinimum,
      condDistUnit: semantics.condDistUnit,
      condDistAvailable: Boolean(inst?.condDistAvailable),
      conversionRequired,
      conversionReady,
      conversionReason,
      exposureAuthoritative: exposureSummary?.authoritative ?? null,
      exposureStatus: exposureSummary?.status ?? null,
      confirmedZeroExposure: exposureSummary?.confirmedZeroExposure ?? null,
      masterEnable: selectedFresh.controls.masterEnable,
      emergencyEntryLock: selectedFresh.controls.emergencyEntryLock,
    });

    const pipelineStatus = deriveAtPipelineStatus({
      automationLifecycle: autoPersisted.lifecycle,
      automationReasonCode: autoPersisted.reasonCode,
      recoveryStatus: autoPersisted.recoveryStatus,
      quoteFresh: freshnessEval.fresh,
      quoteFreshnessReasonCode: freshnessEval.reasonCode,
      feedStatus: liveOfferFreshness?.feedStatus
        ?? verification?.market?.feedStatus
        ?? null,
      marketSession: verification?.market?.marketSession ?? null,
      instrumentConfigured: Boolean(selectedFresh.selectedInstrument || inst?.symbol),
      brokerConnected: connectionStatus === "CONNECTED",
      placesOrders: false,
      acceptsForExecution: false,
      instrumentContract: inst
        ? {
          providerSymbol: inst.symbol,
          displaySymbol: inst.displaySymbol,
          baseUnitSize: inst.baseUnitSize,
          minQuantity: inst.quantityMin ?? null,
          lotStep: inst.quantityStep ?? null,
          pointSize: inst.pointSize,
          pipCost: inst.pipCostAccount,
          mmrPerLot: inst.marginPerLotAccount ?? null,
          evidenceSource: "live_broker",
        }
        : (selectedFresh.selectedInstrument
          ? {
            providerSymbol: selectedFresh.selectedInstrument,
            evidenceSource: "inferred",
          }
          : null),
      instrumentContractLive: Boolean(
        inst?.baseUnitSize != null || inst?.marginPerLotAccount != null || inst?.quantityMin != null,
      ),
    });
    if (pipelineStatus.quantityCompatibility && !pipelineStatus.quantityCompatibility.compatible001Lot) {
      blockers.push(
        `Owner 0.01-lot incompatible with selected instrument (${pipelineStatus.quantityCompatibility.blockers.slice(0, 3).join(", ")})`,
      );
    }

    const feedStatusBreakdown = buildFeedStatusBreakdown({
      brokerConnected: connectionStatus === "CONNECTED",
      offersListenerActive: liveOfferFreshness != null ? true : null,
      instrumentSubscribed: selectedFresh.selectedInstrument
        ? (liveOfferFreshness != null ? true : null)
        : false,
      instrument: selectedFresh.selectedInstrument,
      subscriptionSymbols: selectedFresh.selectedInstrument
        ? [selectedFresh.selectedInstrument]
        : [],
      updateCount: liveOfferFreshness?.updateCount ?? null,
      lastQuoteAtMs: liveOfferFreshness?.sourceTimestampMs ?? null,
      lastPriceChangeAtMs:
        liveOfferFreshness?.updateCount && liveOfferFreshness.updateCount > 0
          ? liveOfferFreshness.sourceTimestampMs
          : null,
      lastReceiptAtMs: liveOfferFreshness?.receivedAtMs ?? null,
      bid: liveOfferFreshness?.bid ?? verification?.market?.bid ?? null,
      ask: liveOfferFreshness?.ask ?? verification?.market?.ask ?? null,
      streamState: liveOfferFreshness?.feedStatus ?? verification?.market?.feedStatus ?? null,
      tradingStatus: liveOfferFreshness?.tradingStatus ?? null,
      quoteFreshReasonCode: liveOfferFreshness?.reasonCode ?? freshnessEval.reasonCode ?? null,
      hasSnapshot:
        (liveOfferFreshness?.bid != null && liveOfferFreshness?.ask != null)
        || (verification?.market?.bid != null && verification?.market?.ask != null),
    });

    const selectionGap = describeMarketSelectionGap({
      shellInstrument: null,
      backendInstrument: selectedFresh.selectedInstrument,
    });
    const pipelineStages = buildAtPipelineStages({
      selectionGapCode: selectedFresh.selectedInstrument ? "BACKEND_ONLY" : selectionGap.code,
      provider: selectedFresh.selectedInstrument ? "FOREXCONNECT" : null,
      shellInstrument: null,
      backendInstrument: selectedFresh.selectedInstrument,
      brokerConnected: connectionStatus === "CONNECTED",
      environment: selected,
      feedPipelineState: feedStatusBreakdown.pipelineState,
      subscriptionConfirmed: feedStatusBreakdown.instrumentSubscribed,
      hasSnapshot: feedStatusBreakdown.firstQuoteReceived,
      updateCount: feedStatusBreakdown.updateCount,
      candleStrategyReady: null,
      closedCandleCount: null,
      strategySignal: null,
      strategyReady: null,
      strategyRejection: null,
      quantityCompatible001: pipelineStatus.quantityCompatibility?.compatible001Lot ?? null,
      marginVerified: null,
      accountPermissionVerified: null,
      executionAuthorized: false,
      placesOrders: false,
      acceptsForExecution: false,
      marketClosed: feedStatusBreakdown.marketClosed,
    });

    return {
      schemaVersion: AUTOMATED_TRADING_SCHEMA,
      phase: AUTOMATED_TRADING_PHASE,
      moduleStatus,
      operationalStatus,
      pipelineStatus,
      feedStatusBreakdown,
      pipelineStages,
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
      controls: (() => {
        const pct = selectedFresh.controls.capitalAllocationPercent;
        const equity =
          verification?.account?.equity != null
          && Number.isFinite(verification.account.equity)
          && verification.account.equity > 0
            ? verification.account.equity
            : null;
        let capitalAllocationBudget: number | null = null;
        let capitalAllocationBudgetStatus: "COMPUTED" | "UNAVAILABLE" | "UNSET" = "UNSET";
        if (pct == null) {
          capitalAllocationBudgetStatus = "UNSET";
        } else if (equity == null) {
          capitalAllocationBudgetStatus = "UNAVAILABLE";
        } else {
          // Round to 8 dp to remove IEEE float noise; UI may further format for currency.
          capitalAllocationBudget = Math.round(equity * (pct / 100) * 1e8) / 1e8;
          capitalAllocationBudgetStatus = "COMPUTED";
        }
        return {
          masterEnable: selectedFresh.controls.masterEnable,
          automaticEntry: "DISABLED" as const,
          positionManagement: "NOT_ACTIVE" as const,
          emergencyEntryLock: selectedFresh.controls.emergencyEntryLock,
          automatedExecutionEnabled: false as const,
          capitalAllocationPercent: pct,
          capitalAllocationBudget,
          capitalAllocationBudgetStatus,
          capitalAllocationCurrency: verification?.account?.accountCurrency ?? null,
          verifiedEquity: equity,
        };
      })(),
      quantitySemantics: xauSemanticsPublicSummary(semantics),
      exposureReconciliation: exposureSummary,
      simulationDataReadiness: simulationDataReadinessPublicSummary(simReadiness, {
        quantityEvidence: {
          unit: semantics.resolvedQuantityUnit,
          ambiguous: semantics.quantityUnitAmbiguous,
          baseUnitSize: inst?.baseUnitSize ?? null,
          contractMultiplier: inst?.contractMultiplier ?? null,
          pointSize: inst?.pointSize ?? null,
          pipCostAccount: inst?.pipCostAccount ?? null,
          quantityMin: qtyConstraints.quantityMin,
          quantityStep: qtyConstraints.quantityStep,
          constraintsStatus: qtyConstraints.status,
          sizingBlocked: qtyConstraints.sizingBlocked,
          blockCode: qtyConstraints.blockCode,
        },
        condDistEvidence: {
          available: Boolean(inst?.condDistAvailable),
          rawStop: inst?.condDistStop ?? null,
          unit: semantics.condDistUnit,
          method: inst?.condDistMethod ?? null,
          documentedMethod: isDocumentedCondDistMethod(inst?.condDistMethod),
          minStopDistanceVerified: semantics.minStopDistanceVerified,
          noPositiveMinimum: semantics.minStopNoPositiveMinimum,
          minStopPrice: semantics.minStopDistanceValue,
        },
        conversionEvidence,
      }),
      blockers: [...new Set(blockers)],
      explanation:
        moduleStatus === "BLOCKED"
          ? "Automated Trading is blocked for execution. Verification and configuration remain available."
          : moduleStatus === "ERROR"
            ? "Automated Trading could not verify broker status."
            : "Status loaded.",
      selectedEnvState: selectedFresh,
      verification,
      readiness: verification?.readiness ?? null,
      quoteFreshness: {
        fresh: freshnessEval.fresh,
        reasonCode: freshnessEval.reasonCode,
        thresholdMs: freshnessEval.freshnessThresholdMs,
        verificationAgeMs: freshnessEval.verificationAgeMs,
        effectivePriceChangeAgeMs: freshnessEval.effectivePriceChangeAgeMs,
        effectiveReceiptAgeMs: freshnessEval.effectiveReceiptAgeMs,
        snapshotFingerprint: freshnessEval.snapshotFingerprint,
        evaluatedAtUtc: freshnessEval.evaluatedAtUtc,
        sourceTimestampMs: freshnessEval.sourceTimestampMs,
        receivedAtMs: freshnessEval.receivedAtMs,
      },
      liveOfferFreshness: liveOfferFreshness
        ? {
            source: liveOfferFreshness.source,
            fresh: liveOfferFreshness.fresh,
            reasonCode: liveOfferFreshness.reasonCode,
            thresholdMs: liveOfferFreshness.freshnessThresholdMs,
            bid: liveOfferFreshness.bid,
            ask: liveOfferFreshness.ask,
            feedStatus: liveOfferFreshness.feedStatus,
            effectivePriceChangeAgeMs: liveOfferFreshness.effectivePriceChangeAgeMs,
            effectiveReceiptAgeMs: liveOfferFreshness.effectiveReceiptAgeMs,
            updateCount: liveOfferFreshness.updateCount,
            tradingStatus: liveOfferFreshness.tradingStatus,
            tradingEligibilityCode: liveOfferFreshness.tradingEligibility.code,
            tradingEligible: liveOfferFreshness.tradingEligibility.tradable,
            orderPathMarketReady: liveOfferFreshness.orderPathMarketReady,
            orderPathBlockerCode: liveOfferFreshness.orderPathBlockerCode,
            evaluatedAtUtc: liveOfferFreshness.evaluatedAtUtc,
            sourceTimestampMs: liveOfferFreshness.sourceTimestampMs,
            receivedAtMs: liveOfferFreshness.receivedAtMs,
          }
        : null,
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
    if ("capitalAllocationPercent" in patch) {
      const raw = patch.capitalAllocationPercent;
      if (raw !== null && raw !== undefined) {
        const n = typeof raw === "number" ? raw : Number(raw);
        if (!Number.isFinite(n) || n < 1 || n > 100) {
          return {
            ok: false,
            code: "INVALID_CAPITAL_ALLOCATION_PERCENT",
            message: "capitalAllocationPercent must be a finite number from 1 to 100, or null to clear.",
            status: await this.buildStatus(),
          };
        }
      }
    }
    await this.store.updateState((s) => {
      const c = s.environments[env].controls;
      if (typeof patch.masterEnable === "boolean") c.masterEnable = patch.masterEnable;
      if (typeof patch.automaticEntry === "boolean") c.automaticEntry = patch.automaticEntry;
      if (typeof patch.positionManagement === "boolean") c.positionManagement = patch.positionManagement;
      if (typeof patch.emergencyEntryLock === "boolean") c.emergencyEntryLock = patch.emergencyEntryLock;
      if ("capitalAllocationPercent" in patch) {
        const raw = patch.capitalAllocationPercent;
        if (raw === null || raw === undefined) {
          c.capitalAllocationPercent = null;
        } else {
          const n = typeof raw === "number" ? raw : Number(raw);
          c.capitalAllocationPercent = Number.isFinite(n) ? n : null;
        }
      }
      // Phase 51 — automatic entry never becomes an execution permission.
      if (c.automaticEntry) c.automaticEntry = false;
      if (c.positionManagement) c.positionManagement = false;
      // Saving capital allocation must never enable execution.
      s.configVersion += 1;
      return s;
    });

    await this.store.appendAudit({
      action: "controls_updated",
      environment: env,
      ok: true,
      code: null,
      detail: `Controls updated for ${env} (execution remains unimplemented; placesOrders=false).`,
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
    timeframe?: unknown;
  }): Promise<
    | {
      ok: true;
      status: AutomatedTradingPublicStatus;
      subscription: {
        requested: true;
        confirmed: boolean;
        code: string;
        message: string;
        providerSymbol: string | null;
        timeframe: string;
        placesOrders: false;
        acceptsForExecution: false;
      };
    }
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
        message: "instrument symbol is required — NO_MARKET_SELECTED / refuse silent XAU/USD default.",
        status: await this.buildStatus(),
      };
    }
    const timeframeRaw = String(input.timeframe ?? "1m").trim() || "1m";
    await this.store.updateState((s) => {
      s.environments[env].selectedInstrument = instrument;
      s.environments[env].lastVerification = null;
      s.environments[env].lastVerificationStatus = "INSTRUMENT_CHANGED";
      s.configVersion += 1;
      return s;
    });

    // Phase 4.14B — persist then attempt Offers subscription (never claim confirmed until ensure ok).
    let subscription: {
      requested: true;
      confirmed: boolean;
      code: string;
      message: string;
      providerSymbol: string | null;
      timeframe: string;
      placesOrders: false;
      acceptsForExecution: false;
    } = {
      requested: true,
      confirmed: false,
      code: "SUBSCRIPTION_NOT_ATTEMPTED",
      message: "Subscription not attempted.",
      providerSymbol: null,
      timeframe: timeframeRaw,
      placesOrders: false,
      acceptsForExecution: false,
    };
    try {
      const live = getForexConnectLiveCandleService();
      const tf = resolveForexConnectLiveTimeframe(undefined, timeframeRaw) ?? "1m";
      subscription.timeframe = tf;
      const ensured = await live.ensureValidatedAtInstrument(instrument, tf);
      subscription = {
        requested: true,
        confirmed: Boolean(ensured.ok),
        code: ensured.code,
        message: ensured.message,
        providerSymbol: ensured.ok ? instrument : null,
        timeframe: tf,
        placesOrders: false,
        acceptsForExecution: false,
      };
    } catch (err) {
      subscription = {
        requested: true,
        confirmed: false,
        code: "SUBSCRIPTION_ENSURE_FAILED",
        message: err instanceof Error ? err.message.slice(0, 200) : "Offers ensure failed.",
        providerSymbol: null,
        timeframe: timeframeRaw,
        placesOrders: false,
        acceptsForExecution: false,
      };
    }

    await this.store.appendAudit({
      action: "instrument_selected",
      environment: env,
      ok: true,
      code: subscription.confirmed ? "SUBSCRIBED" : subscription.code,
      detail: `Selected ${instrument}; offersSubscribe confirmed=${subscription.confirmed}`.slice(0, 160),
    });
    return { ok: true, status: await this.buildStatus(), subscription };
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
      // Fill OfferID from live Offers quotes when catalog rows omit it (read-only; never invent).
      try {
        const quotes = await bridge.pollQuotes();
        if (Array.isArray(quotes) && quotes.length > 0 && instruments.length > 0) {
          const bySym = new Map<string, string>();
          const norm = (s: string) => s.replace(/[\s/_-]/g, "").toUpperCase();
          for (const q of quotes) {
            const oid = q.offerId != null ? String(q.offerId).trim() : "";
            if (!oid) continue;
            for (const key of [q.providerSymbol, q.canonicalSymbol, q.displaySymbol]) {
              if (key) bySym.set(norm(String(key)), oid);
            }
          }
          instruments = instruments.map((row) => {
            if (row.offerId != null && String(row.offerId).trim()) return row;
            const hit =
              bySym.get(norm(String(row.providerSymbol ?? "")))
              ?? bySym.get(norm(String(row.canonicalSymbol ?? "")))
              ?? bySym.get(norm(String(row.displaySymbol ?? "")));
            return hit ? { ...row, offerId: hit } : row;
          });
        }
      } catch {
        /* quotes optional for OfferID enrichment */
      }

      let marketInput: Parameters<typeof assembleVerificationResult>[0]["marketInput"] = null;
      if (instrumentSymbol) {
        try {
          const live = getForexConnectLiveCandleService();
          // Phase 56.2.8 — normalize m1/5m aliases; never pass SDK period ids into ensure().
          const tf = resolveForexConnectLiveTimeframe(input.timeframe, "1m");
          let series = await live.ensure(instrumentSymbol, tf);
          // Phase 4.18F.7 remediation — settle up to ~14s for a genuine instrument LIVE label.
          // Do not invent LIVE. getLatestQuoteState prefers LIVE across TF sessions.
          const settleBudgetMs = 14_000;
          const settleStarted = Date.now();
          while (Date.now() - settleStarted < settleBudgetMs) {
            const latestProbe = live.getLatestQuoteState(instrumentSymbol);
            const probeState = latestProbe?.streamState ?? series.streamState;
            if (probeState === "LIVE") break;
            await new Promise((r) => setTimeout(r, 400));
            series = await live.ensure(instrumentSymbol, tf);
          }
          const latest = live.getLatestQuoteState(instrumentSymbol);
          const now = Date.now();
          // Never treat receipt/heartbeat age as priceChangeAge — that conflation
          // can mislabel SUBSCRIBED_WAITING diagnostics as if Bid/Ask were moving.
          const priceChangeAgeMs =
            latest?.lastPriceChangeAtMs != null
              ? Math.max(0, now - latest.lastPriceChangeAtMs)
              : null;
          const receiptAgeMs =
            latest?.lastQuoteAtMs != null
              ? Math.max(0, now - latest.lastQuoteAtMs)
              : null;
          marketInput = {
            bid: latest?.quote.bid ?? null,
            ask: latest?.quote.ask ?? null,
            streamState: latest?.streamState ?? series.streamState,
            sourceTimestampMs: latest?.quote.sourceTimestampMs ?? null,
            receivedAtMs: latest?.quote.receivedAtMs ?? null,
            priceChangeAgeMs,
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
        // Never let an older in-flight verification replace a newer snapshot.
        const existing = bucket.lastVerification;
        const existingMs = existing ? Date.parse(String(existing.verifiedAtUtc ?? "")) : NaN;
        const nextMs = Date.parse(String(verification.verifiedAtUtc ?? ""));
        const keepExisting =
          Number.isFinite(existingMs)
          && Number.isFinite(nextMs)
          && nextMs < existingMs;
        if (!keepExisting) {
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
        }
        s.configVersion += 1;
        return s;
      });

      // Converge monitor health immediately with the new verification snapshot.
      this.monitor.notifyVerificationUpdated();

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
    const masterGate = getAtSystemMasterStore().get();
    if (masterGate.ownerState !== "ON" || masterGate.masterEnabled !== true) {
      return {
        ok: false,
        code: "SYSTEM_MASTER_OFF",
        message: "System Master is OFF — OpenAI analysis is blocked until SYSTEM ON.",
        analysis: null,
        status: await this.buildStatus(),
      };
    }
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

  /**
   * Phase 4.18D — read-only canonical BUY/SELL analysis (no broker mutation).
   */
  async runCanonicalAnalysis(input: {
    environment?: unknown;
    instrument?: unknown;
    timeframe?: unknown;
    includeOpenAi?: unknown;
    persist?: unknown;
  }): Promise<{
    ok: boolean;
    code?: string;
    message?: string;
    result: import("./analysis/canonical-analysis.types.js").CanonicalAnalysisResult | null;
    view: import("./analysis/canonical-analysis.service.js").CanonicalAnalysisPublicView;
    candleQuality: import("./candle-quality.js").CandleQualityReport | null;
    marketEvidence: import("./analysis/market-evidence-builder.js").MarketEvidenceBundle | null;
    history: { saved: boolean; duplicate: boolean; writeError: string | null };
    status: AutomatedTradingPublicStatus;
    placesOrders: false;
    acceptsForExecution: false;
    mutatesBroker: false;
  }> {
    const {
      runCanonicalAnalysis,
      toCanonicalPublicView,
      createCanonicalAnalysisProductionDeps,
      normalizeCanonicalTimeframe,
    } = await import("./analysis/index.js");
    const { resolveAtOperatingInstrument } = await import("./market-selection.js");
    const state = this.store.getState();
    const env =
      parseAutomatedTradingEnvironment(input.environment) ?? state.selectedEnvironment;
    const envState = state.environments[env];
    const resolved = resolveAtOperatingInstrument({
      shellInstrument: input.instrument != null ? String(input.instrument).trim() || null : null,
      backendInstrument: envState.selectedInstrument,
      allowBackendFallback: true,
    });
    if (!resolved.instrument) {
      const emptyView = toCanonicalPublicView(null);
      return {
        ok: false,
        code: "NO_MARKET_SELECTED",
        message: resolved.message,
        result: null,
        view: emptyView,
        candleQuality: null,
        marketEvidence: null,
        history: { saved: false, duplicate: false, writeError: null },
        status: await this.buildStatus(),
        placesOrders: false,
        acceptsForExecution: false,
        mutatesBroker: false,
      };
    }
    const timeframeRaw = input.timeframe != null ? String(input.timeframe).trim() : "15m";
    if (!normalizeCanonicalTimeframe(timeframeRaw)) {
      return {
        ok: false,
        code: "TIMEFRAME_UNSUPPORTED",
        message: `Unsupported timeframe "${timeframeRaw}".`,
        result: null,
        view: toCanonicalPublicView(null),
        candleQuality: null,
        marketEvidence: null,
        history: { saved: false, duplicate: false, writeError: null },
        status: await this.buildStatus(),
        placesOrders: false,
        acceptsForExecution: false,
        mutatesBroker: false,
      };
    }
    const out = await runCanonicalAnalysis(
      {
        environment: env,
        instrument: resolved.instrument,
        timeframe: timeframeRaw,
        includeOpenAi: input.includeOpenAi !== false,
        persist: input.persist !== false,
        trigger: "manual",
      },
      createCanonicalAnalysisProductionDeps(),
    );
    await this.store.appendAudit({
      action: "canonical_analysis_run",
      environment: env,
      ok: out.ok,
      code: out.result.reconciliationCode,
      detail: `${out.result.instrument} ${out.result.primaryTimeframe} ${out.result.finalOutcome} dir=${out.result.direction ?? "null"} conf=${out.result.confidencePct ?? "null"}`.slice(0, 160),
    });
    return {
      ok: out.ok,
      result: out.result,
      view: toCanonicalPublicView(out.result),
      candleQuality: out.candleQuality,
      marketEvidence: out.marketEvidence,
      history: out.history,
      status: await this.buildStatus(),
      placesOrders: false,
      acceptsForExecution: false,
      mutatesBroker: false,
    };
  }

  async getCanonicalAnalysisStatus(): Promise<{
    latest: import("./analysis/canonical-analysis-history.store.js").CanonicalAnalysisHistoryRecord | null;
    historyCount: number;
    view: import("./analysis/canonical-analysis.service.js").CanonicalAnalysisPublicView;
    placesOrders: false;
    acceptsForExecution: false;
  }> {
    const {
      getCanonicalAnalysisHistoryStore,
      toCanonicalPublicView,
      ANALYSIS_CONFIDENCE_TYPE,
      ANALYSIS_CONFIDENCE_MODEL_VERSION,
      CANONICAL_ANALYSIS_SCHEMA,
      CANONICAL_ANALYSIS_VERSION,
    } = await import("./analysis/index.js");
    const store = getCanonicalAnalysisHistoryStore();
    const latest = store.latest();
    if (!latest) {
      return {
        latest: null,
        historyCount: 0,
        view: toCanonicalPublicView(null),
        placesOrders: false,
        acceptsForExecution: false,
      };
    }
    return {
      latest,
      historyCount: store.count(),
      view: {
        schemaVersion: CANONICAL_ANALYSIS_SCHEMA,
        analysisVersion: CANONICAL_ANALYSIS_VERSION,
        available: true,
        displayFreshness:
          latest.finalOutcome === "STALE_DATA"
            ? "STALE"
            : latest.direction
              ? "CURRENT"
              : "BLOCKED",
        analysisId: latest.analysisId,
        instrument: latest.instrument,
        primaryTimeframe: latest.primaryTimeframe,
        direction: latest.direction,
        marketInterpretation:
          latest.direction === "BUY"
            ? "BULLISH"
            : latest.direction === "SELL"
              ? "BEARISH"
              : null,
        finalOutcome: latest.finalOutcome,
        confidencePct: latest.confidencePct,
        confidenceType: ANALYSIS_CONFIDENCE_TYPE,
        confidenceModelVersion: ANALYSIS_CONFIDENCE_MODEL_VERSION,
        confidenceBreakdown: null,
        confidenceLimitations: [
          "History compact view — full confidence breakdown available on /run responses.",
        ],
        isCalibratedWinProbability: false,
        availableConfidenceFactorCount: 0,
        reconciliationCode: latest.reconciliationCode,
        analyzedAtUtc: latest.analyzedAtUtc,
        quote: null,
        fastSma: latest.fastSma,
        slowSma: latest.slowSma,
        atr: latest.atrValue,
        atrMethod: latest.atrMethod,
        htfAgreement: null,
        aiAgreement: latest.aiAnalysisId ? "N_A" : "UNAVAILABLE",
        dataQuality: null,
        quoteFresh: latest.quoteFresh,
        explanation: latest.explanation,
        validationErrors: latest.validationErrors,
        placesOrders: false,
        acceptsForExecution: false,
        analysisIsNotExecution: true,
      },
      placesOrders: false,
      acceptsForExecution: false,
    };
  }

  async listCanonicalAnalyses(limit = 12) {
    const { getCanonicalAnalysisHistoryStore } = await import("./analysis/index.js");
    return getCanonicalAnalysisHistoryStore().list(limit);
  }

  /**
   * Phase 4.18G.1 — AI analysis result intake status (never broker execution).
   */
  async getResultIntakeStatus() {
    const { getResultIntakePublicStatus } = await import("./result-intake/index.js");
    return getResultIntakePublicStatus();
  }

  async listResultIntakeHistory(limit = 12) {
    const { getAtResultIntakeStore } = await import("./result-intake/index.js");
    return getAtResultIntakeStore().list(limit);
  }

  async getOrderPreparationHandoff() {
    const { getAtResultIntakeStore, toOrderPreparationHandoff } = await import("./result-intake/index.js");
    return toOrderPreparationHandoff(getAtResultIntakeStore().latest());
  }

  /**
   * Step 2 — Order proposal status (risk/capital/construction). Never broker execution.
   * API path uses /proposal/ (not /order/) to avoid EXECUTION_FORBIDDEN path gate.
   */
  async getProposalStatus() {
    const { getOrderProposalPublicStatus } = await import("./order-proposal/index.js");
    return getOrderProposalPublicStatus();
  }

  async listProposals(limit = 12) {
    const { getAtOrderProposalStore } = await import("./order-proposal/index.js");
    return getAtOrderProposalStore().list(limit);
  }

  async getProposal(proposalId: string) {
    const { getAtOrderProposalStore } = await import("./order-proposal/index.js");
    return getAtOrderProposalStore().get(String(proposalId || "").trim());
  }

  async getProposalAllocationConfig() {
    const { getAtOrderProposalStore } = await import("./order-proposal/index.js");
    const store = getAtOrderProposalStore();
    const state = this.store.getState();
    const env = state.environments[state.selectedEnvironment];
    const cfg = store.getAllocationConfig();
    return {
      ...cfg,
      strategyAllocationPercent: env.controls.capitalAllocationPercent,
      strategyAllocationBudget:
        env.lastVerification?.account?.equity != null
        && env.controls.capitalAllocationPercent != null
          ? Math.round(
            env.lastVerification.account.equity
              * (env.controls.capitalAllocationPercent / 100)
              * 1e8,
          ) / 1e8
          : null,
      verifiedEquity: env.lastVerification?.account?.equity ?? null,
      accountCurrency: env.lastVerification?.account?.accountCurrency ?? null,
      placesOrders: false as const,
      acceptsForExecution: false as const,
      mutatesBroker: false as const,
    };
  }

  async updateProposalAllocationConfig(raw: unknown) {
    const { getAtOrderProposalStore } = await import("./order-proposal/index.js");
    const body = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const store = getAtOrderProposalStore();
    const state = this.store.getState();
    const env = state.environments[state.selectedEnvironment];

    // Strategy % continues to live in AT controls — never reset on deploy via this path.
    if ("capitalAllocationPercent" in body || "strategyAllocationPercent" in body) {
      const rawPct = body.strategyAllocationPercent ?? body.capitalAllocationPercent;
      let pctPatch: number | null | undefined;
      if (rawPct === null) {
        pctPatch = null;
      } else if (rawPct !== undefined) {
        const n = Number(rawPct);
        if (!Number.isFinite(n) || n < 1 || n > 100) {
          return {
            ok: false as const,
            code: "INVALID_STRATEGY_ALLOCATION_PCT",
            message: "strategyAllocationPercent must be a finite number from 1 to 100, or null to clear.",
            config: await this.getProposalAllocationConfig(),
          };
        }
        pctPatch = n;
      }
      if (pctPatch !== undefined) {
        const ctrl = await this.updateControls({
          environment: state.selectedEnvironment,
          patch: { capitalAllocationPercent: pctPatch },
        });
        if (!ctrl.ok) {
          return {
            ok: false as const,
            code: ctrl.code,
            message: ctrl.message,
            config: await this.getProposalAllocationConfig(),
          };
        }
      }
    }

    const patch: {
      individualOrderAllocation?: number | null;
      allocationCurrency?: string | null;
      strategyAllocationPercentSnapshot?: number | null;
      currency?: string | null;
    } = {};
    if ("individualOrderAllocation" in body) {
      const rawAlloc = body.individualOrderAllocation;
      if (rawAlloc === null || rawAlloc === "") {
        patch.individualOrderAllocation = null;
      } else {
        const n = Number(rawAlloc);
        if (!Number.isFinite(n) || n <= 0) {
          return {
            ok: false as const,
            code: "PER_ORDER_ALLOCATION_INVALID",
            message: "individualOrderAllocation must be a finite positive number, or null to clear.",
            config: await this.getProposalAllocationConfig(),
          };
        }
        patch.individualOrderAllocation = n;
      }
    }
    if (typeof body.allocationCurrency === "string") {
      patch.allocationCurrency = body.allocationCurrency;
    }
    const fresh = this.store.getState();
    const freshEnv = fresh.environments[fresh.selectedEnvironment];
    patch.strategyAllocationPercentSnapshot = freshEnv.controls.capitalAllocationPercent;
    patch.currency = freshEnv.lastVerification?.account?.accountCurrency ?? env.lastVerification?.account?.accountCurrency ?? null;
    store.updateAllocationConfig(patch);
    if (store.lastWriteError) {
      return {
        ok: false as const,
        code: "ALLOCATION_PERSIST_FAILED",
        message: `Allocation config could not be persisted: ${store.lastWriteError}`,
        config: await this.getProposalAllocationConfig(),
      };
    }
    return {
      ok: true as const,
      config: await this.getProposalAllocationConfig(),
    };
  }

  async generateProposal(input: {
    entryPrice?: unknown;
    entryZoneLow?: unknown;
    entryZoneHigh?: unknown;
    stopLoss?: unknown;
    individualOrderAllocation?: unknown;
    expectedEnvironmentEpoch?: unknown;
  } = {}) {
    const {
      generateOrderProposalFromHandoff,
      getAtOrderProposalStore,
    } = await import("./order-proposal/index.js");
    const { getAtResultIntakeStore, toOrderPreparationHandoff } = await import("./result-intake/index.js");
    const { getAtSystemMasterStore, toSystemMasterPublicStatus } = await import("./system-master/index.js");

    const state = this.store.getState();
    const expectedEpoch = Number(input.expectedEnvironmentEpoch);
    if (
      Number.isFinite(expectedEpoch)
      && Math.floor(expectedEpoch) !== state.environmentEpoch
    ) {
      return {
        ok: false as const,
        code: "STALE_EPOCH",
        message: "Stale environment epoch — refresh status and retry.",
        proposal: null,
        duplicate: false,
      };
    }

    const env = state.environments[state.selectedEnvironment];
    const verification = env.lastVerification;
    const account = verification?.account;
    const inst = verification?.instrument;
    const handoff = toOrderPreparationHandoff(getAtResultIntakeStore().latest());
    const master = toSystemMasterPublicStatus(getAtSystemMasterStore().get());
    const systemMasterOn = master.ownerState === "ON" && master.masterEnabled === true;

    const num = (v: unknown): number | null | undefined => {
      if (v === undefined) return undefined;
      if (v === null || v === "") return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const equity =
      account?.equity != null && Number.isFinite(account.equity) && account.equity > 0
        ? account.equity
        : null;
    const equityFresh = Boolean(account?.isFresh && equity != null && account.fields?.equity);
    const marginFresh = Boolean(
      account?.isFresh
      && account?.usableMargin != null
      && Number.isFinite(account.usableMargin)
      && account.fields?.usableMargin,
    );

    const contractVerified = Boolean(
      inst?.contractVerified
      && inst.pointSize != null
      && Number.isFinite(inst.pointSize)
      && inst.pointSize > 0,
    );
    const contract = contractVerified && inst
      ? {
        verified: true as const,
        pointSize: inst.pointSize ?? null,
        tickSize: inst.pointSize ?? null,
        digits: null,
        quantityMin: inst.quantityMin ?? null,
        quantityStep: inst.quantityStep ?? null,
        quantityUnit: inst.quantityUnit ?? "contracts",
        quantityUnitAmbiguous: inst.quantityUnit !== "contracts",
        contractMultiplier: inst.contractMultiplier ?? null,
        baseUnitSize: inst.baseUnitSize ?? null,
        pipCostAccount: inst.pipCostAccount ?? null,
        marginPerLotAccount: inst.marginPerLotAccount ?? null,
        minStopDistance: null,
        minStopDistanceVerified: false,
        source: inst.contractSource ?? "lastVerification.instrument",
        unavailableReason: inst.unavailableReason ?? null,
      }
      : null;

    const allocCfg = getAtOrderProposalStore().getAllocationConfig();
    const perOrder =
      num(input.individualOrderAllocation) !== undefined
        ? num(input.individualOrderAllocation)
        : allocCfg.individualOrderAllocation;

    const { record, duplicate } = generateOrderProposalFromHandoff({
      handoff,
      entryPrice: num(input.entryPrice) ?? null,
      entryZoneLow: num(input.entryZoneLow) ?? null,
      entryZoneHigh: num(input.entryZoneHigh) ?? null,
      stopLoss: num(input.stopLoss) ?? null,
      verifiedEquity: equity,
      accountCurrency: account?.accountCurrency ?? null,
      equityFresh,
      usableMargin: account?.usableMargin ?? null,
      usedMargin: account?.usedMargin ?? null,
      marginFresh,
      accountIdMasked: account?.accountIdMasked ?? state.environments[state.selectedEnvironment].lastVerifiedAccountId,
      strategyAllocationPercent: env.controls.capitalAllocationPercent,
      individualOrderAllocation: perOrder ?? null,
      allocationCurrency: allocCfg.allocationCurrency,
      existingCommittedExposure: 0,
      contract,
      contractFresh: contractVerified && equityFresh,
      sdkMinQuantity: inst?.quantityMin ?? null,
      legacyLotStep: inst?.quantityStep ?? null,
      marginPerUnitAccount: inst?.marginPerLotAccount ?? null,
      exposureAuthoritative: true,
      existingExposure: 0,
      systemMasterOn,
      // Pass authoritative controls (never hardcode permissive values).
      // Proposal construction remains analysis-only: engine records control observations
      // without treating PROPOSAL_READY as execution authorization. Phase 2 precheck enforces locks.
      tradingEnabled: env.controls.masterEnable === true,
      emergencyEntryLock: env.controls.emergencyEntryLock === true,
      environment: state.selectedEnvironment,
      timeframe: handoff?.evidenceReferences?.primaryTimeframe ?? null,
      persist: true,
    });

    return {
      ok: true as const,
      proposal: record,
      duplicate,
      proposalOnly: true as const,
      executionAuthorized: false as const,
      controlsObserved: {
        masterEnable: env.controls.masterEnable === true,
        automaticEntry: env.controls.automaticEntry === true,
        emergencyEntryLock: env.controls.emergencyEntryLock === true,
      },
      placesOrders: false as const,
      acceptsForExecution: false as const,
      mutatesBroker: false as const,
      note:
        "ORDER PROPOSAL only — not broker execution. "
        + "PROPOSAL_READY does not authorize submission. "
        + "Phase 2 precheck + Execution Master + owner authorization required later.",
    };
  }

  /**
   * Step 3 — Broker compatibility / handoff (never submits broker orders).
   * API namespace: /handoff/* (avoids /order/ EXECUTION_FORBIDDEN gate).
   */
  async getHandoffStatus() {
    const { getBrokerHandoffPublicStatus } = await import("./broker-compatibility/index.js");
    return getBrokerHandoffPublicStatus();
  }

  async listHandoffs(limit = 12) {
    const { getAtBrokerHandoffStore } = await import("./broker-compatibility/index.js");
    return getAtBrokerHandoffStore().list(limit);
  }

  async getHandoff(handoffId: string) {
    const { getAtBrokerHandoffStore } = await import("./broker-compatibility/index.js");
    return getAtBrokerHandoffStore().get(String(handoffId || "").trim());
  }

  /**
   * Broker Execution Engine — Phase 1 foundation status only.
   * API namespace: /broker-engine/* (avoids /order|/submit|/execute EXECUTION_FORBIDDEN gate).
   * Never places orders; Execution Master remains OFF.
   */
  async getBrokerExecutionStatus() {
    const { getBrokerExecutionPublicStatus } = await import("./broker-execution/index.js");
    const { getAtSystemMasterStore } = await import("./system-master/index.js");
    const { toSystemMasterPublicStatus } = await import("./system-master/types.js");
    const { getAtBrokerHandoffStore } = await import("./broker-compatibility/index.js");
    const { getAtOrderProposalStore } = await import("./order-proposal/index.js");
    const state = this.store.getState();
    const env = state.environments[state.selectedEnvironment];
    const master = toSystemMasterPublicStatus(getAtSystemMasterStore().get());
    const handoff = getAtBrokerHandoffStore().latest();
    const alloc = getAtOrderProposalStore().getAllocationConfig();
    return getBrokerExecutionPublicStatus({
      environment: state.selectedEnvironment,
      emergencyEntryLock: env.controls.emergencyEntryLock === true,
      handoffLifecycle: handoff?.lifecycle ?? null,
      handoffId: handoff?.provenance?.handoffId ?? null,
      proposalId: handoff?.provenance?.proposalId ?? null,
      quantityLots: handoff?.directionOrder?.normalizedQuantity ?? null,
      capitalAllocationPercent: env.controls.capitalAllocationPercent,
      individualOrderAllocation: alloc.individualOrderAllocation,
      systemMasterOn: master.ownerState === "ON" && master.masterEnabled === true,
    });
  }

  async listBrokerExecutionAudit(limit = 40) {
    const { getAtBrokerExecutionStore } = await import("./broker-execution/index.js");
    return getAtBrokerExecutionStore().listAudit(limit);
  }

  async requestBrokerExecutionMasterOn(actor = "admin", correlationId?: string) {
    const { getAtBrokerExecutionStore } = await import("./broker-execution/index.js");
    return getAtBrokerExecutionStore().requestEnableExecutionMaster(
      String(actor || "admin"),
      correlationId,
    );
  }

  /**
   * Phase 2 — Final pre-execution validator.
   * Revalidates latest (or specified) handoff + proposal against live controls.
   * Never submits, never arms, never enables Execution Master.
   */
  async runBrokerPrecheck(input: {
    handoffId?: string | null;
    proposalId?: string | null;
    applyLifecycle?: boolean;
    correlationId?: string;
    maxSpreadAbsolute?: number | null;
  } = {}) {
    const {
      applyPreExecutionValidation,
      runPreExecutionValidation,
      getAtBrokerExecutionStore,
    } = await import("./broker-execution/index.js");
    const { getAtBrokerHandoffStore } = await import("./broker-compatibility/index.js");
    const { getAtOrderProposalStore } = await import("./order-proposal/index.js");

    const state = this.store.getState();
    const env = state.environments[state.selectedEnvironment];
    const verification = env.lastVerification;
    const account = verification?.account ?? null;
    const market = verification?.market ?? null;
    const inst = verification?.instrument ?? null;
    const live = verification
      ? (verification as { liveOfferFreshness?: {
        bid?: number | null;
        ask?: number | null;
        effectivePriceChangeAgeMs?: number | null;
        tradingEligible?: boolean | null;
        tradingEligibilityCode?: string | null;
      } | null }).liveOfferFreshness
      : null;

    const handoffStore = getAtBrokerHandoffStore();
    const proposalStore = getAtOrderProposalStore();
    const wantedHandoffId = String(input.handoffId || "").trim() || null;
    const wantedProposalId = String(input.proposalId || "").trim() || null;
    const handoff = wantedHandoffId
      ? handoffStore.get(wantedHandoffId)
      : handoffStore.latest();
    const proposalFromId = wantedProposalId
      ? proposalStore.get(wantedProposalId)
      : null;
    const proposal = proposalFromId
      ?? (handoff?.provenance?.proposalId
        ? proposalStore.get(handoff.provenance.proposalId)
        : null)
      ?? proposalStore.latest();

    const foundation = getAtBrokerExecutionStore().get();
    const fetchedAtMs = account?.fetchedAtUtc
      ? Date.parse(account.fetchedAtUtc)
      : (env.lastVerifiedAtUtc ? Date.parse(env.lastVerifiedAtUtc) : null);

    const bid = live?.bid ?? market?.bid ?? null;
    const ask = live?.ask ?? market?.ask ?? null;
    const spread = market?.spread
      ?? (bid != null && ask != null && Number.isFinite(bid) && Number.isFinite(ask) ? ask - bid : null);
    const quoteAgeMs = live?.effectivePriceChangeAgeMs
      ?? (market && typeof (market as { priceChangeAgeMs?: number }).priceChangeAgeMs === "number"
        ? (market as { priceChangeAgeMs: number }).priceChangeAgeMs
        : null);

    const instrumentSymbol = env.selectedInstrument
      ?? handoff?.instrument?.symbol
      ?? proposal?.instrument
      ?? null;

    // Stage 2 — live read-only risk intelligence (never mutates broker).
    const { fetchLiveRiskIntelligence, readConfiguredMaxSpreadAbsolute } = await import(
      "./risk-intelligence/index.js"
    );
    const configuredSpread = readConfiguredMaxSpreadAbsolute(
      input.maxSpreadAbsolute === undefined ? undefined : input.maxSpreadAbsolute,
    );
    const riskIntel = await fetchLiveRiskIntelligence({
      environment: state.selectedEnvironment,
      instrument: instrumentSymbol,
      expectedAccountIdMasked: account?.accountIdMasked ?? null,
      baseUnitSize: inst?.baseUnitSize ?? null,
      contractVerified: inst?.contractVerified === true,
      bid,
      ask,
      quoteAgeMs: quoteAgeMs != null && Number.isFinite(quoteAgeMs)
        ? quoteAgeMs
        : (market?.priceChangeAgeMs ?? null),
      maxSpreadAbsolute: input.maxSpreadAbsolute === undefined
        ? undefined
        : input.maxSpreadAbsolute,
      persistDaily: true,
    });

    const verificationAccount = account
      ? {
        equity: account.equity ?? null,
        balance: account.balance ?? null,
        usableMargin: account.usableMargin ?? null,
        usedMargin: account.usedMargin ?? null,
        currency: account.accountCurrency ?? null,
        accountIdMasked: account.accountIdMasked ?? null,
        fetchedAtMs: Number.isFinite(fetchedAtMs as number) ? (fetchedAtMs as number) : null,
        isFresh: account.isFresh ?? null,
      }
      : null;

    const precheckInput = {
      handoff,
      proposal,
      expectedHandoffId: wantedHandoffId,
      expectedProposalId: wantedProposalId || handoff?.provenance?.proposalId || null,
      environment: state.selectedEnvironment,
      controls: {
        emergencyEntryLock: env.controls.emergencyEntryLock,
        masterEnable: env.controls.masterEnable,
        automaticEntry: env.controls.automaticEntry,
        positionManagement: env.controls.positionManagement,
      },
      foundation: {
        executionMasterEnabled: foundation.executionMasterEnabled,
        armedForSubmission: foundation.armedForSubmission,
        placesOrders: false as const,
        acceptsForExecution: false as const,
        mutatesBroker: false as const,
        lifecycle: foundation.lifecycle,
      },
      // Prefer live RO account snapshot when validated; else last verification (still fail-closed if stale/missing).
      account: riskIntel.precheckAccount ?? verificationAccount,
      market: {
        bid: riskIntel.spread.bid ?? bid,
        ask: riskIntel.spread.ask ?? ask,
        spread: riskIntel.spread.spread
          ?? spread,
        quoteAgeMs: riskIntel.spread.quoteAgeMs != null
          ? riskIntel.spread.quoteAgeMs
          : (quoteAgeMs != null && Number.isFinite(quoteAgeMs)
            ? quoteAgeMs
            : (market?.priceChangeAgeMs ?? null)),
        tradingEligible: live?.tradingEligible
          ?? (market?.marketSession != null
            ? market.marketSession === "ACTIVE"
            : null),
        marketClosed: market?.marketSession != null
          ? market.marketSession === "INACTIVE"
          : null,
        instrument: instrumentSymbol,
      },
      exposure: riskIntel.precheckExposure,
      instrumentContract: inst
        ? {
          baseUnitSize: inst.baseUnitSize ?? null,
          minQuantity: inst.quantityMin ?? null,
          quantityStep: inst.quantityStep ?? null,
          mmrPerLot: inst.marginPerLotAccount ?? null,
          contractVerified: inst.contractVerified === true,
        }
        : null,
      riskLimits: {
        maxSpreadAbsolute: configuredSpread.value,
      },
    };

    const applyLifecycle = input.applyLifecycle !== false;
    if (applyLifecycle) {
      const applied = await applyPreExecutionValidation({
        ...precheckInput,
        actor: "admin-api",
        correlationId: input.correlationId,
      });
      return {
        ...applied,
        riskIntelligence: riskIntel,
        placesOrders: false as const,
        acceptsForExecution: false as const,
        mutatesBroker: false as const,
        executionAuthorized: false as const,
      };
    }
    return {
      validation: runPreExecutionValidation(precheckInput),
      lifecycleBefore: foundation.lifecycle,
      lifecycleAfter: foundation.lifecycle,
      transition: { ok: true as const },
      riskIntelligence: riskIntel,
      placesOrders: false as const,
      acceptsForExecution: false as const,
      mutatesBroker: false as const,
      executionAuthorized: false as const,
    };
  }

  /**
   * Stage 2 — Live read-only risk intelligence snapshot.
   * Never places, modifies, cancels, or closes broker orders.
   */
  async getRiskIntelligenceSnapshot(input: {
    maxSpreadAbsolute?: number | null;
  } = {}) {
    const { fetchLiveRiskIntelligence } = await import("./risk-intelligence/index.js");
    const state = this.store.getState();
    const env = state.environments[state.selectedEnvironment];
    const verification = env.lastVerification;
    const account = verification?.account ?? null;
    const market = verification?.market ?? null;
    const inst = verification?.instrument ?? null;
    const live = verification
      ? (verification as { liveOfferFreshness?: {
        bid?: number | null;
        ask?: number | null;
        effectivePriceChangeAgeMs?: number | null;
      } | null }).liveOfferFreshness
      : null;
    const bid = live?.bid ?? market?.bid ?? null;
    const ask = live?.ask ?? market?.ask ?? null;
    const quoteAgeMs = live?.effectivePriceChangeAgeMs
      ?? (market && typeof (market as { priceChangeAgeMs?: number }).priceChangeAgeMs === "number"
        ? (market as { priceChangeAgeMs: number }).priceChangeAgeMs
        : null);
    return fetchLiveRiskIntelligence({
      environment: state.selectedEnvironment,
      instrument: env.selectedInstrument ?? null,
      expectedAccountIdMasked: account?.accountIdMasked ?? null,
      baseUnitSize: inst?.baseUnitSize ?? null,
      contractVerified: inst?.contractVerified === true,
      bid,
      ask,
      quoteAgeMs,
      maxSpreadAbsolute: input.maxSpreadAbsolute,
      persistDaily: true,
    });
  }

  async getHandoffInstrumentSpecs() {
    const state = this.store.getState();
    const env = state.environments[state.selectedEnvironment];
    const inst = env.lastVerification?.instrument ?? null;
    return {
      instrument: inst,
      placesOrders: false as const,
      acceptsForExecution: false as const,
      mutatesBroker: false as const,
      note:
        "Read-only verified instrument snapshot. Offer ID comes from ForexConnect Offers "
        + "catalog/quotes when present — never invented.",
    };
  }

  /**
   * Step 3 closeout — read-only scan of ForexConnect instruments for owner 0.01-lot compatibility.
   * Path avoids /order/; never mutates broker.
   */
  async scanHandoffCompatibleInstruments() {
    const { getForexConnectBridge } = await import("../../market-data/forexconnect/client.js");
    const {
      discover001LotCompatibleInstruments,
      OWNER_MAX_LOTS_001,
    } = await import("./order-execution/discover-001-lot-instruments.js");
    const bridge = getForexConnectBridge();
    const listed = await bridge.listInstruments();
    let quotes: Awaited<ReturnType<typeof bridge.pollQuotes>> = [];
    try {
      quotes = await bridge.pollQuotes();
    } catch {
      quotes = [];
    }
    const offerBySym = new Map<string, string>();
    const norm = (s: string) => s.replace(/[\s/_-]/g, "").toUpperCase();
    for (const q of quotes) {
      const oid = q.offerId != null ? String(q.offerId).trim() : "";
      if (!oid) continue;
      for (const key of [q.providerSymbol, q.canonicalSymbol, q.displaySymbol]) {
        if (key) offerBySym.set(norm(String(key)), oid);
      }
    }
    const instruments = Array.isArray(listed.instruments) ? listed.instruments : [];
    const rows = instruments.map((i) => {
      const offerFromRow = i.offerId != null ? String(i.offerId).trim() : "";
      const offerFromQuote =
        offerBySym.get(norm(String(i.providerSymbol ?? "")))
        ?? offerBySym.get(norm(String(i.canonicalSymbol ?? "")))
        ?? offerBySym.get(norm(String(i.displaySymbol ?? "")))
        ?? "";
      return {
        providerSymbol: i.providerSymbol,
        displaySymbol: i.displaySymbol,
        canonicalSymbol: i.canonicalSymbol,
        instrumentType: i.instrumentTypeLabel ?? (i.instrumentType != null ? String(i.instrumentType) : null),
        tradingStatus: i.tradingStatus != null ? String(i.tradingStatus) : null,
        baseUnitSize: i.baseUnitSize ?? null,
        minQuantity: i.minQuantity ?? null,
        lotStep: i.lotStep ?? null,
        pointSize: i.pointSize ?? null,
        pipCost: i.pipCost ?? null,
        mmrPerLot: i.mmrPerLot ?? null,
        mmrSource: (i as { mmrSource?: string | null }).mmrSource ?? null,
        condDistStop: i.condDistStop ?? null,
        condDistAvailable: i.condDistAvailable ?? null,
        evidenceSource: "live_broker" as const,
        offerId: offerFromRow || offerFromQuote || null,
      };
    });
    const discovery = discover001LotCompatibleInstruments(rows, { incompatibleSampleLimit: 80 });
    // Score every row once for targeted lookups (compatible list alone may be empty).
    const {
      scoreInstrumentFor001Lots,
      classify001LotScore,
    } = await import("./order-execution/discover-001-lot-instruments.js");
    const scoredAll = rows.map((r) => ({
      row: r,
      score: scoreInstrumentFor001Lots(r, OWNER_MAX_LOTS_001),
    }));
    const mapScore = (c: (typeof scoredAll)[number]["score"], offerId: string | null) => ({
      symbol: c.providerSymbol,
      displaySymbol: c.displaySymbol,
      offerId,
      instrumentType: c.instrumentType,
      tradingStatus: c.tradingStatus,
      contractSize: c.liveFields.baseUnitSize,
      quantityUnit: "contracts" as const,
      minimumQuantity: c.liveFields.minQuantity,
      quantityStep: c.liveFields.amountStep,
      tickSize: c.liveFields.pointSize,
      pipSize: c.liveFields.pointSize,
      marginPerLot: c.liveFields.mmrPerLot,
      conversionFormula: discovery.formula,
      amountAtOwnerMax: c.contract.amountConversion.amount,
      amountConversionOk: c.contract.amountConversion.ok,
      amountConversionCode: c.contract.amountConversion.code,
      minLotsFromBroker: c.contract.minLotsFromBroker,
      ownerMaxBelowBrokerMin: c.contract.ownerMaxBelowBrokerMin,
      compatible001Lot: c.compatible001Lot,
      classification: classify001LotScore(c, offerId),
      blockers: c.blockers,
    });
    const classificationCounts = { ...discovery.classificationCounts };
    // Re-count with Offer ID awareness (discovery path has no offerId).
    for (const key of Object.keys(classificationCounts) as Array<keyof typeof classificationCounts>) {
      classificationCounts[key] = 0;
    }
    for (const x of scoredAll) {
      classificationCounts[classify001LotScore(x.score, x.row.offerId)] += 1;
    }
    const mmrPresent = scoredAll.filter((x) => x.score.liveFields.mmrPerLot != null).length;
    const integerAmountCandidates = scoredAll
      .filter((x) => x.score.contract.amountConversion.ok)
      .map((x) => mapScore(x.score, x.row.offerId))
      .slice(0, 40);
    const majorNames = [
      "EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "USD/CAD", "USD/CHF",
      "EUR/JPY", "EUR/GBP", "XAU/USD", "XAG/USD", "US30", "NAS100", "SPX500",
    ];
    const majors = majorNames.map((sym) => {
      const hit = scoredAll.find((x) => norm(x.row.providerSymbol) === norm(sym)
        || norm(String(x.row.displaySymbol ?? "")) === norm(sym)
        || norm(String(x.row.canonicalSymbol ?? "")) === norm(sym));
      return hit
        ? mapScore(hit.score, hit.row.offerId)
        : { symbol: sym, offerId: null, found: false as const, blockers: ["NOT_IN_CATALOG"] };
    });
    const selected = this.store.getState().environments[
      this.store.getState().selectedEnvironment
    ]?.lastVerification?.instrument ?? null;
    const selectedOffer =
      selected?.offerId
      ?? (selected?.symbol
        ? offerBySym.get(norm(String(selected.symbol))) ?? null
        : null);
    const selectedHit = selected?.symbol
      ? scoredAll.find((x) => norm(x.row.providerSymbol) === norm(String(selected.symbol)))
      : null;
    return {
      ok: listed.ok !== false,
      formula: discovery.formula,
      requestedLots: OWNER_MAX_LOTS_001,
      scanned: discovery.scanned,
      compatibleCount: discovery.compatible.length,
      compatible: discovery.compatible.map((c) => {
        const row = rows.find((r) => norm(String(r.providerSymbol)) === norm(c.providerSymbol));
        return mapScore(c, row?.offerId ?? null);
      }),
      integerAmountCandidates,
      majors,
      incompatibleSample: discovery.incompatibleSample.slice(0, 15).map((c) => {
        const row = rows.find((r) => norm(String(r.providerSymbol)) === norm(c.providerSymbol));
        return {
          symbol: c.providerSymbol,
          offerId: row?.offerId ?? null,
          baseUnitSize: c.liveFields.baseUnitSize,
          minQuantity: c.liveFields.minQuantity,
          mmrPerLot: c.liveFields.mmrPerLot,
          amountAtOwnerMax: c.contract.amountConversion.amount,
          amountConversionCode: c.contract.amountConversion.code,
          minLotsFromBroker: c.contract.minLotsFromBroker,
          blockers: c.blockers,
        };
      }),
      selectedInstrument: selected
        ? {
          symbol: selected.symbol,
          offerId: selectedOffer,
          baseUnitSize: selected.baseUnitSize,
          quantityMin: selected.quantityMin,
          quantityStep: selected.quantityStep,
          quantityUnit: selected.quantityUnit,
          marginPerLotAccount: selected.marginPerLotAccount,
          score: selectedHit
            ? {
              compatible001Lot: selectedHit.score.compatible001Lot,
              blockers: selectedHit.score.blockers,
              amountAtOwnerMax: selectedHit.score.contract.amountConversion.amount,
              amountConversionCode: selectedHit.score.contract.amountConversion.code,
              minLotsFromBroker: selectedHit.score.contract.minLotsFromBroker,
            }
            : null,
        }
        : null,
      summary: discovery.summary,
      mmrCoverage: {
        present: mmrPresent,
        missing: Math.max(0, scoredAll.length - mmrPresent),
        total: scoredAll.length,
      },
      classificationCounts,
      placesOrders: false as const,
      acceptsForExecution: false as const,
      mutatesBroker: false as const,
      note:
        "Read-only Offers/TradingSettings scan (Offers-row MMR fallback when TradingSettings get_mmr is null). "
        + "compatible001Lot requires integer AMOUNT at 0.01 lots, broker min ≤ 0.01 lots, and authoritative MMR. "
        + "Never places orders.",
    };
  }

  async getHandoffAccountCompatibility() {
    const state = this.store.getState();
    const env = state.environments[state.selectedEnvironment];
    const account = env.lastVerification?.account ?? null;
    return {
      account,
      accountConnected: Boolean(env.lastVerification),
      accountAuthenticated: Boolean(env.lastVerifiedAccountId),
      placesOrders: false as const,
      acceptsForExecution: false as const,
      mutatesBroker: false as const,
      note: "Read-only account compatibility snapshot from last verification.",
    };
  }

  async validateHandoff(input: {
    proposalId?: unknown;
    offerId?: unknown;
    protectionAttachVerified?: unknown;
    maxExposureLimit?: unknown;
    expectedEnvironmentEpoch?: unknown;
  } = {}) {
    const {
      validateProposalForBrokerHandoff,
      getAtBrokerHandoffStore,
      isHandoffExpired,
      toFutureExecutionContract,
    } = await import("./broker-compatibility/index.js");
    const { getAtOrderProposalStore } = await import("./order-proposal/index.js");
    const { getAtSystemMasterStore, toSystemMasterPublicStatus } = await import("./system-master/index.js");

    const state = this.store.getState();
    const expectedEpoch = Number(input.expectedEnvironmentEpoch);
    if (
      Number.isFinite(expectedEpoch)
      && Math.floor(expectedEpoch) !== state.environmentEpoch
    ) {
      return {
        ok: false as const,
        code: "STALE_EPOCH",
        message: "Stale environment epoch — refresh status and retry.",
        handoff: null,
        futureContract: null,
        duplicate: false,
      };
    }

    const proposalId = input.proposalId != null ? String(input.proposalId).trim() : "";
    const propStore = getAtOrderProposalStore();
    const proposal = proposalId
      ? propStore.get(proposalId)
      : propStore.latest();

    const env = state.environments[state.selectedEnvironment];
    const verification = env.lastVerification;
    const account = verification?.account ?? null;
    const inst = verification?.instrument ?? null;
    const master = toSystemMasterPublicStatus(getAtSystemMasterStore().get());
    const systemMasterOn = master.ownerState === "ON" && master.masterEnabled === true;

    const offerFromBody =
      input.offerId != null && String(input.offerId).trim()
        ? String(input.offerId).trim()
        : null;
    const offerFromInstrument =
      inst?.offerId != null && String(inst.offerId).trim()
        ? String(inst.offerId).trim()
        : null;
    // Prefer explicit client offerId, else verified instrument OfferID from ForexConnect catalog/quotes.
    const offerId = offerFromBody ?? offerFromInstrument;

    const { record, duplicate, futureContract } = validateProposalForBrokerHandoff(
      {
        proposal,
        account: account
          ? {
            accountIdMasked: account.accountIdMasked,
            accountCurrency: account.accountCurrency,
            equity: account.equity,
            usedMargin: account.usedMargin,
            usableMargin: account.usableMargin,
            isFresh: account.isFresh,
            fetchedAtUtc: account.fetchedAtUtc,
            environment: account.environment,
          }
          : null,
        instrument: inst
          ? {
            symbol: inst.symbol,
            offerId,
            instrumentType: inst.instrumentType,
            baseAsset: inst.baseAsset,
            quoteAsset: inst.quoteAsset,
            pointSize: inst.pointSize,
            pipCostAccount: inst.pipCostAccount,
            contractMultiplier: inst.contractMultiplier,
            baseUnitSize: inst.baseUnitSize,
            quantityMin: inst.quantityMin,
            quantityStep: inst.quantityStep,
            quantityUnit: inst.quantityUnit,
            marginPerLotAccount: inst.marginPerLotAccount,
            contractVerified: inst.contractVerified,
            contractSource: inst.contractSource,
            unavailableReason: inst.unavailableReason,
          }
          : null,
        market: verification?.market
          ? {
            bid: verification.market.bid,
            ask: verification.market.ask,
            marketSession: verification.market.marketSession,
          }
          : null,
        accountConnected: Boolean(verification),
        accountAuthenticated: Boolean(env.lastVerifiedAccountId),
        instrumentFresh: Boolean(inst?.contractVerified && account?.isFresh),
        marginFresh: Boolean(account?.isFresh && account.fields?.usableMargin),
        systemMasterOn,
        protectionAttachVerified: input.protectionAttachVerified === true,
        existingExposure: 0,
        maxExposureLimit:
          input.maxExposureLimit != null && Number.isFinite(Number(input.maxExposureLimit))
            ? Number(input.maxExposureLimit)
            : null,
      },
      { persist: true },
    );

    // Soft expire check for returned ready packages
    if (record.lifecycle === "HANDOFF_READY" && isHandoffExpired(record)) {
      record.lifecycle = "EXPIRED";
      getAtBrokerHandoffStore().upsertHandoff(record);
    }

    return {
      ok: true as const,
      handoff: record,
      futureContract: toFutureExecutionContract(record),
      duplicate,
      placesOrders: false as const,
      acceptsForExecution: false as const,
      mutatesBroker: false as const,
      note: "Validation/handoff only — no broker order submitted.",
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

  /**
   * Phase 56.2 — simulation-only draft validation (never places orders).
   */
  async getSimRiskStatus(): Promise<AtSimRiskPublicStatus> {
    return this.simRiskEngine.publicStatus();
  }

  getSimRiskPolicy(): AtSimRiskPolicy {
    return this.simRiskEngine.getPolicy();
  }

  getLatestSimDraft(): AtSimDraftResult | null {
    return this.simRiskEngine.getLatest();
  }

  listSimDrafts(limit = 12): AtSimDraftResult[] {
    return this.simRiskEngine.listHistory(limit);
  }

  async validateSimulationDraft(input: {
    expectedEnvironmentEpoch?: unknown;
    instrument?: unknown;
    direction?: unknown;
    entryPrice?: unknown;
    stopLoss?: unknown;
    takeProfit?: unknown;
    requestedQuantity?: unknown;
    requestedPerOrderAllocation?: unknown;
    decisionId?: unknown;
    persist?: unknown;
  }): Promise<
    | { ok: true; draft: AtSimDraftResult; status: AutomatedTradingPublicStatus }
    | {
      ok: false;
      code: string;
      message: string;
      draft: AtSimDraftResult | null;
      status: AutomatedTradingPublicStatus;
    }
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
        draft: null,
        status: await this.buildStatus(),
      };
    }

    const publicStatus = await this.buildStatus();
    const decisionId = input.decisionId != null ? String(input.decisionId).trim() : "";
    const decision = decisionId
      ? this.decisionEngine.listHistory(40).find((d) => d.decisionId === decisionId) ?? null
      : this.decisionEngine.getLatest();

    const dirRaw = input.direction != null ? String(input.direction).trim().toUpperCase() : "";
    const direction: AtBinaryDirection | null | undefined =
      dirRaw === "BUY" || dirRaw === "SELL"
        ? dirRaw
        : input.direction === undefined
          ? undefined
          : null;

    const numOrUndef = (v: unknown): number | null | undefined => {
      if (v === undefined) return undefined;
      if (v === null || v === "") return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const requestedPerOrderAllocation = numOrUndef(input.requestedPerOrderAllocation);
    if (requestedPerOrderAllocation !== undefined && requestedPerOrderAllocation !== null) {
      const allocCheck = validateOrderAllocationAmount(requestedPerOrderAllocation);
      if (!allocCheck.ok) {
        return {
          ok: false,
          code: allocCheck.code,
          message: allocCheck.message,
          draft: null,
          status: publicStatus,
        };
      }
    }

    // Phase 56.2.4 / 4.14B — authoritative Orders/Trades RO for exposure (never mutates broker).
    // Never invent XAU/USD when no instrument is selected.
    const instrumentForExposure = String(
      input.instrument
        ?? decision?.instrument
        ?? envState.selectedInstrument
        ?? envState.lastVerification?.instrument?.symbol
        ?? "",
    ).trim();
    if (!instrumentForExposure) {
      return {
        ok: false,
        code: "NO_MARKET_SELECTED",
        message: "Select a ForexConnect instrument before simulation draft validation.",
        draft: null,
        status: publicStatus,
      };
    }
    let exposureReconciliation = null;
    // Phase 56.4.0 — CondDist from verification instrument (never hardcode unverified unit).
    const instMeta = envState.lastVerification?.instrument;
    const rawCond = instMeta?.condDistStop;
    const condDistStop =
      typeof rawCond === "number" && Number.isFinite(rawCond) ? rawCond : null;
    const condDistAvailable = Boolean(instMeta?.condDistAvailable) && condDistStop != null;
    const condDistStopUnit = instMeta?.condDistUnit ?? null;
    const condDistMethod = instMeta?.condDistMethod ?? null;
    const fromDocumentedSdkMethod =
      isDocumentedCondDistMethod(condDistMethod)
      || String(condDistStopUnit ?? "").toLowerCase() === "pips";
    try {
      const bridge = getForexConnectBridge();
      const [openOrders, openTrades] = await Promise.all([
        bridge.listOrders(),
        bridge.listTrades(),
      ]);
      exposureReconciliation = reconcileBrokerExposure({
        instrument: instrumentForExposure,
        environment: env,
        openWorkingOrders: openOrders as Record<string, unknown>,
        openPositions: {
          ...(openTrades as Record<string, unknown>),
          trades: (openTrades as { trades?: unknown[] }).trades
            ?? (openTrades as { positions?: unknown[] }).positions
            ?? [],
        },
      });
    } catch {
      exposureReconciliation = reconcileBrokerExposure({
        instrument: instrumentForExposure,
        environment: env,
        openWorkingOrders: null,
        openPositions: null,
      });
    }

    // Phase 56.4.2 — refresh LIVE Offers quote at draft boundary (do not age lastVerification).
    const resolvedDirection: AtBinaryDirection | null =
      direction === "BUY" || direction === "SELL"
        ? direction
        : decision?.direction === "BUY" || decision?.direction === "SELL"
          ? decision.direction
          : this.analysisEngine.getLatest()?.direction ?? null;
    const analysis = this.analysisEngine.getLatest();
    const instrumentSymbol = instrumentForExposure;

    let draftQuote: DraftQuoteSnapshot | null = null;
    let quoteFresh: boolean | null = null;
    let freshnessReasonCode: string | null = null;
    let quoteAgeMs: number | null = null;
    let bid: number | null = null;
    let ask: number | null = null;
    let mid: number | null = null;
    let verificationForDraft = envState.lastVerification;

    try {
      const live = getForexConnectLiveCandleService();
      const tf = resolveForexConnectLiveTimeframe(undefined, "1m");
      let series = await live.ensure(instrumentSymbol, tf);
      for (let i = 0; i < 2 && series.streamState !== "LIVE"; i += 1) {
        await new Promise((r) => setTimeout(r, 350));
        series = await live.ensure(instrumentSymbol, tf);
      }
      const latest = live.getLatestQuoteState(instrumentSymbol);
      const now = Date.now();
      const priceChangeAgeMs =
        latest?.lastPriceChangeAtMs != null
          ? Math.max(0, now - latest.lastPriceChangeAtMs)
          : null;
      const receiptAgeMs =
        latest?.lastQuoteAtMs != null ? Math.max(0, now - latest.lastQuoteAtMs) : null;
      const refreshed = evaluateDraftBoundaryQuote({
        instrument: instrumentSymbol,
        bid: latest?.quote.bid ?? null,
        ask: latest?.quote.ask ?? null,
        streamState: latest?.streamState ?? series.streamState,
        sourceTimestampMs: latest?.quote.sourceTimestampMs ?? null,
        receivedAtMs: latest?.quote.receivedAtMs ?? null,
        priceChangeAgeMs,
        receiptAgeMs,
        updateCount: latest?.updateCount ?? series.updateCount,
        nowMs: now,
      });
      draftQuote = refreshed.snapshot;
      quoteFresh = refreshed.ok ? true : false;
      freshnessReasonCode = refreshed.ok
        ? "LIVE_FRESH"
        : refreshed.code;
      quoteAgeMs = draftQuote?.priceChangeAgeMs ?? null;
      bid = draftQuote?.bid ?? null;
      ask = draftQuote?.ask ?? null;
      mid = draftQuote?.mid ?? null;

      // Overlay fresh market onto lastVerification for assemble (instrument/account stay authoritative).
      if (verificationForDraft && draftQuote) {
        verificationForDraft = {
          ...verificationForDraft,
          verifiedAtUtc: draftQuote.observedAtUtc,
          market: {
            ...verificationForDraft.market,
            bid: draftQuote.bid,
            ask: draftQuote.ask,
            spread: draftQuote.ask - draftQuote.bid,
            feedStatus: draftQuote.fresh ? "LIVE" : mapFeedFromDraft(draftQuote.reasonCode),
            sourceTimestampMs: draftQuote.sourceTimestampMs,
            receivedAtMs: draftQuote.receivedAtMs,
            priceChangeAgeMs: draftQuote.priceChangeAgeMs,
            receiptAgeMs: draftQuote.receiptAgeMs,
            updateCount: draftQuote.updateCount,
          },
        };
      }
    } catch {
      // Fail closed — do not invent a quote from aged verification alone.
      const fallback = evaluateDraftBoundaryQuote({
        instrument: instrumentSymbol,
        bid: null,
        ask: null,
        streamState: "ERROR",
        nowMs: Date.now(),
      });
      draftQuote = fallback.snapshot;
      quoteFresh = false;
      freshnessReasonCode = "QUOTE_MISSING";
      quoteAgeMs = null;
      bid = null;
      ask = null;
      mid = null;
    }

    const pointSize = verificationForDraft?.instrument?.pointSize ?? null;
    const digits =
      typeof pointSize === "number" && pointSize > 0
        ? Math.max(0, Math.round(-Math.log10(pointSize)))
        : null;

    const entryIn = numOrUndef(input.entryPrice);
    const slIn = numOrUndef(input.stopLoss);
    const tpIn = numOrUndef(input.takeProfit);
    const needsPropose =
      (entryIn === undefined || entryIn === null)
      || (slIn === undefined || slIn === null)
      || (tpIn === undefined || tpIn === null);

    let derivedEntry = entryIn === undefined ? undefined : entryIn;
    let derivedSl = slIn === undefined ? undefined : slIn;
    let derivedTp = tpIn === undefined ? undefined : tpIn;

    if (needsPropose) {
      const proposed = proposeSimLevels({
        direction: resolvedDirection,
        bid,
        ask,
        mid,
        quoteFresh,
        supportLevels: analysis?.supportLevels ?? [],
        resistanceLevels: analysis?.resistanceLevels ?? [],
        digits,
        entryOverride: entryIn === undefined ? null : entryIn,
        stopLossOverride: slIn === undefined ? null : slIn,
        takeProfitOverride: tpIn === undefined ? null : tpIn,
      });
      if (proposed.ok) {
        if (derivedEntry === undefined || derivedEntry === null) derivedEntry = proposed.entryPrice;
        if (derivedSl === undefined || derivedSl === null) derivedSl = proposed.stopLoss;
        if (derivedTp === undefined || derivedTp === null) derivedTp = proposed.takeProfit;
      }
      // If propose fails, leave nulls — engine will BLOCK with missing SL/TP (no invented levels).
    }

    let draft = await this.simRiskEngine.validateFromContext({
      environment: env,
      environmentEpoch: state.environmentEpoch,
      decision,
      verification: verificationForDraft,
      quoteFresh,
      freshnessReasonCode,
      quoteAgeMs,
      sessionEnvironment: publicStatus.broker.activeSessionEnvironment,
      sessionMatchesSelection: publicStatus.broker.sessionMatchesSelection,
      persist: input.persist !== false,
      capitalAllocationPercent: envState.controls.capitalAllocationPercent,
      requestedPerOrderAllocation:
        requestedPerOrderAllocation === undefined ? null : requestedPerOrderAllocation,
      reservedStrategyBudgetActive: this.simRiskEngine.sumActiveReserved(env),
      exposureReconciliation,
      condDistStop,
      condDistStopUnit,
      condDistAvailable,
      condDistMethod,
      fromDocumentedSdkMethod,
      overrides: {
        instrument: input.instrument != null ? String(input.instrument) : instrumentSymbol,
        direction: resolvedDirection ?? direction,
        entryPrice: derivedEntry,
        stopLoss: derivedSl,
        takeProfit: derivedTp,
        requestedQuantity: numOrUndef(input.requestedQuantity),
      },
    });

    draft = {
      ...draft,
      quoteSnapshot: draftQuote
        ? {
          snapshotId: draftQuote.snapshotId,
          observedAtUtc: draftQuote.observedAtUtc,
          source: draftQuote.source,
          streamState: draftQuote.streamState,
          bid: draftQuote.bid,
          ask: draftQuote.ask,
          priceChangeAgeMs: draftQuote.priceChangeAgeMs,
          fresh: draftQuote.fresh,
          reasonCode: draftQuote.reasonCode,
        }
        : null,
      actionableRejections: enrichDraftRejectionReasons(draft.checks, draft.reasons),
      revalidatedOnLoad: false,
    };

    await this.store.appendAudit({
      action: "simulation_draft_validated",
      environment: env,
      ok: draft.overallStatus === "VALIDATION_PASSED" || draft.structuralOk,
      code: draft.overallStatus,
      detail: `${draft.direction ?? "—"} ${draft.instrument} · ${draft.overallStatus}`.slice(0, 160),
    });

    return {
      ok: true,
      draft,
      status: await this.buildStatus(),
    };
  }

  /** Reopen a persisted draft (by id or latest) and force revalidation against current LIVE quote/budget. */
  async reopenAndRevalidateLatestDraft(input?: {
    draftId?: unknown;
    expectedEnvironmentEpoch?: unknown;
    requestedPerOrderAllocation?: unknown;
  }): Promise<
    | { ok: true; draft: AtSimDraftResult; status: AutomatedTradingPublicStatus }
    | { ok: false; code: string; message: string; draft: AtSimDraftResult | null; status: AutomatedTradingPublicStatus }
  > {
    const draftId = input?.draftId != null ? String(input.draftId).trim() : "";
    const source = draftId
      ? this.simRiskEngine.getById(draftId)
      : this.simRiskEngine.getLatest();
    if (!source) {
      return {
        ok: false,
        code: "DRAFT_NOT_FOUND",
        message: draftId
          ? `No persisted simulation draft with id ${draftId.slice(0, 40)}.`
          : "No persisted simulation draft to reopen.",
        draft: null,
        status: await this.buildStatus(),
      };
    }
    const result = await this.validateSimulationDraft({
      expectedEnvironmentEpoch: input?.expectedEnvironmentEpoch,
      instrument: source.instrument,
      direction: source.direction,
      entryPrice: source.entryPrice,
      stopLoss: source.stopLoss,
      takeProfit: source.takeProfit,
      requestedQuantity: source.proposedQuantity,
      requestedPerOrderAllocation:
        input?.requestedPerOrderAllocation
        ?? source.capitalBudgetAnalysis?.perOrderAllocation
        ?? undefined,
      persist: true,
    });
    if (!result.ok) return result;
    return {
      ok: true,
      draft: { ...result.draft, revalidatedOnLoad: true },
      status: result.status,
    };
  }

  getSimLifecycleStatus() {
    const store = getAtSimLifecycleStore();
    return simulationLifecyclePublicStatus(store.list());
  }

  /** Phase 57.0 — broker-intent status (never execution). */
  getBrokerIntentStatus() {
    return getAtBrokerIntentEngine().getPublicStatus();
  }

  /**
   * Phase 57.0 — validate/persist a broker intent. Never submits.
   * Disabled mutation adapter is probed only to prove EXECUTION_FORBIDDEN.
   */
  /**
   * Phase 59.0 — Build a DEMO open-market plan from decision + simulation draft.
   * Non-mutating: never calls ForexConnect, never creates grants, never flips placesOrders.
   */
  prepareDemoExecutionPlan(input: {
    decisionId?: unknown;
    draftId?: unknown;
    grantId?: unknown;
    lotsOverride?: unknown;
    maxDecisionAgeMs?: unknown;
  }): AtExecutionPlan {
    const decisionId = input.decisionId != null ? String(input.decisionId).trim() : "";
    const draftId = input.draftId != null ? String(input.draftId).trim() : "";
    const decision = decisionId
      ? this.decisionEngine.listHistory(40).find((d) => d.decisionId === decisionId) ?? null
      : this.decisionEngine.getLatest();
    const draft = draftId
      ? this.simRiskEngine.getById(draftId)
      : this.simRiskEngine.getLatest();

    const grantStore = getDemoExecutionGrantStore();
    const grantId = String(input.grantId ?? "").trim();
    const grantCheck = grantId
      ? grantStore.requireActive(grantId)
      : { ok: false as const, code: "GRANT_ID_REQUIRED" as const, error: "grantId is required." };
    const grant = grantCheck.ok ? grantCheck.grant : null;

    const lotsOverrideRaw = input.lotsOverride;
    const lotsOverride = lotsOverrideRaw == null || lotsOverrideRaw === ""
      ? null
      : Math.floor(Number(lotsOverrideRaw));
    const maxAgeRaw = input.maxDecisionAgeMs;
    const maxDecisionAgeMs = maxAgeRaw == null || maxAgeRaw === ""
      ? null
      : Number(maxAgeRaw);

    const env = this.store.getState().selectedEnvironment;

    return buildDemoExecutionPlan({
      decision,
      draft,
      grantId: grant?.grantId ?? grantId,
      grantActive: Boolean(grantCheck.ok && grant),
      grantMaxLots: grant?.maxLots ?? 1,
      grantInstrumentAllowlist: grant?.instrumentAllowlist ?? [],
      environment: env,
      lotsOverride: Number.isFinite(lotsOverride as number) ? (lotsOverride as number) : null,
      maxDecisionAgeMs: Number.isFinite(maxDecisionAgeMs as number)
        ? (maxDecisionAgeMs as number)
        : null,
      requireProtective: true,
    });
  }

  async validateBrokerIntent(input: BrokerIntentPreflightInput) {
    const engine = getAtBrokerIntentEngine();
    const result = await engine.validateAndPersist({
      ...input,
      ownerExecutionAuthorized: false,
    });
    const mutationProbe = getDisabledBrokerMutationAdapter().submit(result.intent);
    await this.store.appendAudit({
      action: "broker_intent_validated",
      environment: result.intent.environment,
      ok: true,
      code: result.intent.state,
      detail: `${result.intent.intentId} ${result.intent.state} maySubmit=false`.slice(0, 160),
    });
    return {
      ok: true as const,
      preflightPassed: result.preflightPassed,
      maySubmitToBroker: false as const,
      intent: result.intent,
      duplicated: result.duplicated,
      mutationProbe,
      placesOrders: false as const,
      acceptsForExecution: false as const,
      mutatesBroker: false as const,
      status: await this.buildStatus(),
    };
  }

  /**
   * Phase 57.0 — RO reconcile only. Never mutates broker.
   */
  async reconcileBrokerIntent(intentId: string | null) {
    const store = getAtBrokerIntentStore();
    const record = intentId
      ? store.get(intentId)
      : getAtBrokerIntentEngine().getPublicStatus().latest;

    let observation: BrokerRoObservation = {
      observedAtUtc: new Date().toISOString(),
      openOrdersCount: null,
      openPositionsCount: null,
      ordersCapability: "UNKNOWN",
      tradesCapability: "UNKNOWN",
      observedOrderIds: [],
      observedPositionIds: [],
      placesOrders: false,
      mutatesBroker: false,
    };
    try {
      const bridge = getForexConnectBridge();
      const [orders, trades] = await Promise.all([bridge.listOrders(), bridge.listTrades()]);
      const ordersOk = orders.ok === true;
      const tradesOk = trades.ok === true;
      const orderRows = Array.isArray(orders.orders) ? (orders.orders as Array<Record<string, unknown>>) : [];
      const tradeRows = Array.isArray(trades.trades) ? (trades.trades as Array<Record<string, unknown>>) : [];
      observation = {
        observedAtUtc: new Date().toISOString(),
        openOrdersCount: ordersOk ? orderRows.length : null,
        openPositionsCount: tradesOk ? tradeRows.length : null,
        ordersCapability: ordersOk ? "AVAILABLE" : "UNAVAILABLE",
        tradesCapability: tradesOk ? "AVAILABLE" : "UNAVAILABLE",
        observedOrderIds: dedupeObservedIds(
          orderRows.map((o) => String(o.orderId ?? o.id ?? "") || null),
        ),
        observedPositionIds: dedupeObservedIds(
          tradeRows.map((t) => String(t.tradeId ?? t.id ?? "") || null),
        ),
        placesOrders: false,
        mutatesBroker: false,
      };
    } catch {
      // Keep UNKNOWN capabilities — fail closed, never invent.
    }

    const reconcile = reconcileBrokerIntentWithRoObservation({
      intent: record,
      observation,
    });
    return {
      ok: true as const,
      reconcile,
      placesOrders: false as const,
      mutatesBroker: false as const,
      status: await this.buildStatus(),
    };
  }

  /**
   * Phase 56.4.7 — Idempotent simulation-only recovery after process restart.
   * Persisted open/monitoring positions become STALE_INTERRUPTED (await fresh quote).
   * Closed positions stay closed. Never fabricates fills or broker orders.
   */
  async recoverSimLifecycleFromPersistence(input?: {
    environment?: string;
  }): Promise<{
    ok: true;
    recovered: true;
    changedCount: number;
    results: SimRestartRecoveryItem[];
    lifecycle: ReturnType<typeof simulationLifecyclePublicStatus>;
    placesOrders: false;
    acceptsForExecution: false;
    autoReentryEnabled: false;
    simulationOnly: true;
  }> {
    const life = getAtSimLifecycleStore();
    const before = life.list();
    const batch = recoverSimPositionsAfterProcessRestart(before);
    for (let i = 0; i < batch.results.length; i++) {
      if (!batch.results[i]?.changed) continue;
      const next = batch.positions[i];
      if (next) await life.upsert(next);
    }
    if (batch.changedCount > 0) {
      const env =
        input?.environment
        || before[0]?.environment
        || this.store.getState().selectedEnvironment
        || "DEMO";
      await this.store.appendAudit({
        action: "simulation_lifecycle_recovered",
        environment: env,
        ok: true,
        code: "PROCESS_RESTART_RECOVERY",
        detail: `sim recovery: ${batch.changedCount} position(s) STALE_INTERRUPTED; awaiting fresh LIVE quote`.slice(
          0,
          160,
        ),
      });
    }
    return {
      ok: true,
      recovered: true,
      changedCount: batch.changedCount,
      results: batch.results,
      lifecycle: simulationLifecyclePublicStatus(life.list()),
      placesOrders: false,
      acceptsForExecution: false,
      autoReentryEnabled: false,
      simulationOnly: true,
    };
  }

  async openSimulatedFromLatestDraft(): Promise<
    | { ok: true; position: SimPosition; status: AutomatedTradingPublicStatus }
    | { ok: false; code: string; message: string; status: AutomatedTradingPublicStatus }
  > {
    const draft = this.simRiskEngine.getLatest();
    const status = await this.buildStatus();
    if (!draft || draft.overallStatus !== "VALIDATION_PASSED") {
      return {
        ok: false,
        code: "SIM_OPEN_DRAFT_NOT_VALIDATED",
        message: "Latest draft is not VALIDATION_PASSED — simulation open refused.",
        status,
      };
    }
    const life = getAtSimLifecycleStore();
    const dup = life.findOpenByDraft(draft.draftId);
    if (dup) {
      return {
        ok: false,
        code: "SIM_OPEN_DUPLICATE",
        message: "An open simulated position already exists for this draft.",
        status,
      };
    }
    // Re-fetch LIVE Offers at open boundary — never trust an aged draft.quoteSnapshot alone.
    let quote: DraftQuoteSnapshot | null = null;
    try {
      const live = getForexConnectLiveCandleService();
      const tf = resolveForexConnectLiveTimeframe(undefined, "1m");
      await live.ensure(draft.instrument, tf);
      const latest = live.getLatestQuoteState(draft.instrument);
      const now = Date.now();
      const refreshed = evaluateDraftBoundaryQuote({
        instrument: draft.instrument,
        bid: latest?.quote.bid ?? null,
        ask: latest?.quote.ask ?? null,
        streamState: latest?.streamState ?? "DISCONNECTED",
        sourceTimestampMs: latest?.quote.sourceTimestampMs ?? null,
        receivedAtMs: latest?.quote.receivedAtMs ?? null,
        priceChangeAgeMs:
          latest?.lastPriceChangeAtMs != null
            ? Math.max(0, now - latest.lastPriceChangeAtMs)
            : null,
        receiptAgeMs:
          latest?.lastQuoteAtMs != null ? Math.max(0, now - latest.lastQuoteAtMs) : null,
        updateCount: latest?.updateCount ?? 0,
        nowMs: now,
      });
      if (!refreshed.ok || !refreshed.snapshot.fresh) {
        return {
          ok: false,
          code: refreshed.ok ? "SIM_OPEN_QUOTE_NOT_FRESH" : refreshed.code,
          message: refreshed.ok
            ? "Quote not fresh at simulated open boundary."
            : refreshed.message,
          status,
        };
      }
      quote = refreshed.snapshot;
    } catch (err) {
      return {
        ok: false,
        code: "QUOTE_MISSING",
        message:
          err instanceof Error
            ? err.message.slice(0, 200)
            : "Failed to refresh quote at simulated open.",
        status,
      };
    }
    const opened = openSimulatedPosition({ draft, quote });
    if (!opened.ok) {
      return { ok: false, code: opened.code, message: opened.message, status };
    }
    await life.upsert(opened.position);
    await this.store.appendAudit({
      action: "simulation_position_opened",
      environment: draft.environment,
      ok: true,
      code: "SIMULATED_OPEN",
      detail: `${opened.position.simulationPositionId} ${draft.instrument}`.slice(0, 160),
    });
    return { ok: true, position: opened.position, status: await this.buildStatus() };
  }

  async monitorSimulatedPosition(positionId: string): Promise<
    | { ok: true; position: SimPosition; status: AutomatedTradingPublicStatus }
    | { ok: false; code: string; message: string; status: AutomatedTradingPublicStatus }
  > {
    const life = getAtSimLifecycleStore();
    const existing = life.get(String(positionId));
    const status = await this.buildStatus();
    if (!existing) {
      return { ok: false, code: "SIM_POSITION_NOT_FOUND", message: "Simulated position not found.", status };
    }
    const reentry = evaluateSimReentryPolicy();
    void reentry; // documented: auto re-entry disabled
    try {
      const live = getForexConnectLiveCandleService();
      const tf = resolveForexConnectLiveTimeframe(undefined, "1m");
      await live.ensure(existing.instrument, tf);
      const latest = live.getLatestQuoteState(existing.instrument);
      const now = Date.now();
      const refreshed = evaluateDraftBoundaryQuote({
        instrument: existing.instrument,
        bid: latest?.quote.bid ?? null,
        ask: latest?.quote.ask ?? null,
        streamState: latest?.streamState ?? "DISCONNECTED",
        priceChangeAgeMs:
          latest?.lastPriceChangeAtMs != null ? Math.max(0, now - latest.lastPriceChangeAtMs) : null,
        receiptAgeMs:
          latest?.lastQuoteAtMs != null ? Math.max(0, now - latest.lastQuoteAtMs) : null,
        updateCount: latest?.updateCount ?? 0,
        nowMs: now,
      });
      if (!refreshed.snapshot) {
        return { ok: false, code: "QUOTE_MISSING", message: "No quote for monitoring.", status };
      }
      const next = applySimMonitorTick({
        position: existing,
        quote: refreshed.snapshot,
      });
      const becameClosed =
        existing.state !== "SIMULATED_CLOSED" && next.state === "SIMULATED_CLOSED";
      // Audit before upsert so a failed audit cannot leave a closed position without
      // a durable automatic-close record (fail closed — position remains open).
      if (becameClosed && next.exitReason) {
        const rLabel =
          next.achievedR != null && Number.isFinite(next.achievedR)
            ? ` R=${Number(next.achievedR).toFixed(3)}`
            : "";
        const qRef = next.exitQuoteSnapshotId ? ` q=${next.exitQuoteSnapshotId}` : "";
        await this.store.appendAudit({
          action: "simulation_position_closed",
          environment: next.environment,
          ok: true,
          code: String(next.exitReason).slice(0, 64),
          detail: `${next.simulationPositionId} ${next.exitReason} @ ${
            next.exitPrice != null ? next.exitPrice : "UNKNOWN"
          }${rLabel}${qRef}`.slice(0, 160),
        });
      }
      await life.upsert(next);
      return { ok: true, position: next, status: await this.buildStatus() };
    } catch (err) {
      return {
        ok: false,
        code: "SIM_MONITOR_FAILED",
        message: err instanceof Error ? err.message.slice(0, 200) : "Monitor failed.",
        status,
      };
    }
  }

  /**
   * Phase 56.4.6 — Admin-gated controlled monitor tick for simulation acceptance.
   * Injects a synthetic LIVE-fresh Offers snapshot (never broker quotes / never orders).
   * mode=sl_cross crosses SL; mode=sl_approach approaches without closing; mode=stale
   * forces STALE_INTERRUPTED without a fill.
   */
  async injectControlledSimMonitorTick(input: {
    positionId: string;
    mode: "sl_cross" | "sl_approach" | "stale";
  }): Promise<
    | {
      ok: true;
      position: SimPosition;
      controlled: true;
      placesOrders: false;
      acceptsForExecution: false;
      status: AutomatedTradingPublicStatus;
    }
    | { ok: false; code: string; message: string; status: AutomatedTradingPublicStatus }
  > {
    const life = getAtSimLifecycleStore();
    const existing = life.get(String(input.positionId));
    const status = await this.buildStatus();
    if (!existing) {
      return { ok: false, code: "SIM_POSITION_NOT_FOUND", message: "Simulated position not found.", status };
    }
    if (existing.state === "SIMULATED_CLOSED" || existing.state === "REJECTED") {
      return {
        ok: false,
        code: "SIM_INJECT_INVALID_STATE",
        message: `Cannot inject controlled tick into state ${existing.state}.`,
        status,
      };
    }
    const now = Date.now();
    let bid: number;
    let ask: number;
    let fresh = true;
    let streamState = "LIVE";
    let priceChangeAgeMs: number | null = 50;
    if (input.mode === "sl_cross") {
      const lv = proposeControlledSlCrossingLevels(existing);
      bid = lv.bid;
      ask = lv.ask;
    } else if (input.mode === "sl_approach") {
      const lv = proposeControlledSlApproachLevels(existing);
      bid = lv.bid;
      ask = lv.ask;
    } else {
      const lv = proposeControlledSlApproachLevels(existing);
      bid = lv.bid;
      ask = lv.ask;
      fresh = false;
      streamState = "LIVE";
      priceChangeAgeMs = 90_000;
    }
    const evaluated = evaluateDraftBoundaryQuote({
      instrument: existing.instrument,
      bid,
      ask,
      streamState,
      priceChangeAgeMs,
      receiptAgeMs: 40,
      updateCount: 99,
      sourceTimestampMs: now,
      receivedAtMs: now,
      nowMs: now,
    });
    // For sl_cross / sl_approach we require a fresh snapshot; for stale mode we require !fresh.
    if (input.mode === "stale") {
      if (!evaluated.snapshot || evaluated.snapshot.fresh) {
        return {
          ok: false,
          code: "SIM_INJECT_STALE_FIXTURE_FAILED",
          message: "Failed to build a non-fresh controlled stale snapshot.",
          status,
        };
      }
    } else if (!evaluated.ok || !evaluated.snapshot.fresh) {
      return {
        ok: false,
        code: evaluated.ok ? "SIM_INJECT_QUOTE_NOT_FRESH" : evaluated.code,
        message: evaluated.ok
          ? "Controlled inject quote was not fresh."
          : evaluated.message,
        status,
      };
    }
    void fresh;
    const next = applySimMonitorTick({
      position: existing,
      quote: evaluated.snapshot!,
    });
    const becameClosed =
      existing.state !== "SIMULATED_CLOSED" && next.state === "SIMULATED_CLOSED";
    if (becameClosed && next.exitReason) {
      const rLabel =
        next.achievedR != null && Number.isFinite(next.achievedR)
          ? ` R=${Number(next.achievedR).toFixed(3)}`
          : "";
      const qRef = next.exitQuoteSnapshotId ? ` q=${next.exitQuoteSnapshotId}` : "";
      await this.store.appendAudit({
        action: "simulation_position_closed",
        environment: next.environment,
        ok: true,
        code: String(next.exitReason).slice(0, 64),
        detail: `CONTROLLED_INJECT ${next.simulationPositionId} ${next.exitReason} @ ${
          next.exitPrice != null ? next.exitPrice : "UNKNOWN"
        }${rLabel}${qRef}`.slice(0, 160),
      });
    } else if (input.mode === "stale" || input.mode === "sl_approach") {
      await this.store.appendAudit({
        action: "simulation_controlled_inject",
        environment: existing.environment,
        ok: true,
        code: `CONTROLLED_${input.mode.toUpperCase()}`,
        detail: `${existing.simulationPositionId} mode=${input.mode} state=${next.state}`.slice(0, 160),
      });
    }
    await life.upsert(next);
    return {
      ok: true,
      position: next,
      controlled: true,
      placesOrders: false,
      acceptsForExecution: false,
      status: await this.buildStatus(),
    };
  }

  /** User-requested simulated close — never a broker close. Idempotent when already closed. */
  async closeSimulatedPosition(positionId: string): Promise<
    | { ok: true; position: SimPosition; idempotent: boolean; status: AutomatedTradingPublicStatus }
    | { ok: false; code: string; message: string; status: AutomatedTradingPublicStatus }
  > {
    const life = getAtSimLifecycleStore();
    const existing = life.get(String(positionId));
    const status = await this.buildStatus();
    if (!existing) {
      return { ok: false, code: "SIM_POSITION_NOT_FOUND", message: "Simulated position not found.", status };
    }
    let bid: number | null = existing.latestBid;
    let ask: number | null = existing.latestAsk;
    try {
      const live = getForexConnectLiveCandleService();
      const tf = resolveForexConnectLiveTimeframe(undefined, "1m");
      await live.ensure(existing.instrument, tf);
      const latest = live.getLatestQuoteState(existing.instrument);
      bid = latest?.quote.bid ?? bid;
      ask = latest?.quote.ask ?? ask;
    } catch {
      // Close may proceed without a fill price when quote unavailable (exitPrice null).
    }
    const closed = closeSimulatedPositionManual({
      position: existing,
      bid,
      ask,
    });
    if (!closed.ok) {
      return { ok: false, code: closed.code, message: closed.message, status };
    }
    await life.upsert(closed.position);
    if (!closed.idempotent) {
      await this.store.appendAudit({
        action: "simulation_position_closed",
        environment: closed.position.environment,
        ok: true,
        code: "MANUAL_SIM_CLOSE",
        detail: `${closed.position.simulationPositionId} MANUAL_SIM_CLOSE`.slice(0, 160),
      });
    }
    return {
      ok: true,
      position: closed.position,
      idempotent: closed.idempotent,
      status: await this.buildStatus(),
    };
  }

  /**
   * Phase 4.12 — Strategy analysis + isolated SIMULATED lifecycle.
   * Loads RO candles when available; never calls broker mutation.
   */
  async runPhase412StrategyDryRun(input: {
    instrument?: unknown;
    timeframe?: unknown;
    includeDeterministicFixtureLifecycle?: unknown;
  }): Promise<
    | {
      ok: true;
      dryRun: import("./strategy-dry-run/index.js").DryRunLifecycleResult;
      candleQuality: import("./candle-quality.js").CandleQualityReport;
      /** Phase 4.18D — additive canonical BUY/SELL analysis (read-only). */
      canonicalAnalysis: {
        result: import("./analysis/canonical-analysis.types.js").CanonicalAnalysisResult;
        view: import("./analysis/canonical-analysis.service.js").CanonicalAnalysisPublicView;
        placesOrders: false;
        acceptsForExecution: false;
        simulationOnly: true;
      } | null;
      feedSnapshot: {
        instrument: string;
        bid: number | null;
        ask: number | null;
        feedStatus: string | null;
        tradingStatus: string | null;
        quoteFresh: boolean;
        reasonCode: string | null;
        sourceTimestampMs: number | null;
        receivedAtMs: number | null;
        priceChangeAgeMs: number | null;
        candleLastOpenSec: number | null;
        realDemoQuotesObserved: boolean;
        breakdown: import("./feed-status-breakdown.js").FeedStatusBreakdown;
      };
      status: AutomatedTradingPublicStatus;
      placesOrders: false;
      acceptsForExecution: false;
      mutatesBroker: false;
    }
    | {
      ok: false;
      code: "NO_MARKET_SELECTED";
      message: string;
      status: AutomatedTradingPublicStatus;
      placesOrders: false;
      acceptsForExecution: false;
      mutatesBroker: false;
    }
  > {
    const { runIsolatedStrategyDryRunLifecycle } = await import("./strategy-dry-run/index.js");
    const { evaluateLiveOfferQuoteFreshness } = await import("./quote-freshness.js");
    const { buildFeedStatusBreakdown } = await import("./feed-status-breakdown.js");
    const { resolveAtOperatingInstrument } = await import("./market-selection.js");
    const state = this.store.getState();
    const env = state.selectedEnvironment;
    const envState = state.environments[env];
    const resolved = resolveAtOperatingInstrument({
      shellInstrument: input.instrument != null ? String(input.instrument).trim() || null : null,
      backendInstrument: envState.selectedInstrument,
      allowBackendFallback: true,
    });
    if (!resolved.instrument) {
      return {
        ok: false,
        code: "NO_MARKET_SELECTED",
        message: resolved.message,
        status: await this.buildStatus(),
        placesOrders: false,
        acceptsForExecution: false,
        mutatesBroker: false,
      };
    }
    const instrument = resolved.instrument;
    const timeframe = String(input.timeframe ?? "1h").trim() || "1h";
    const includeFixture = input.includeDeterministicFixtureLifecycle !== false;

    let candles: Array<{
      time: number;
      open: number;
      high: number;
      low: number;
      close: number;
      closed?: boolean;
    }> = [];
    let pointSize: number | null = null;
    try {
      const bridge = getForexConnectBridge();
      const hist = await bridge.getHistoricalCandles({
        symbol: instrument,
        timeframe: timeframe as never,
        limit: 120,
      });
      const raw = Array.isArray(hist?.candles) ? hist.candles : [];
      candles = raw.map((c: Record<string, unknown>) => ({
        time: Number(c.time ?? c.timestamp ?? 0),
        open: Number(c.open),
        high: Number(c.high),
        low: Number(c.low),
        close: Number(c.close),
        closed: c.closed === false ? false : true,
      })).filter((c) =>
        Number.isFinite(c.time)
        && Number.isFinite(c.open)
        && Number.isFinite(c.high)
        && Number.isFinite(c.low)
        && Number.isFinite(c.close)
      );
      const listed = await bridge.listInstruments();
      if (listed.ok && Array.isArray(listed.instruments)) {
        const want = instrument.replace(/\s+/g, "").toUpperCase();
        for (const row of listed.instruments) {
          const r = row as Record<string, unknown>;
          const keys = [r.providerSymbol, r.displaySymbol, r.canonicalSymbol, r.symbol]
            .map((s) => String(s ?? "").replace(/\s+/g, "").toUpperCase());
          if (!keys.includes(want)) continue;
          const ps = Number(r.pointSize ?? r.PointSize);
          if (Number.isFinite(ps) && ps > 0) pointSize = ps;
          break;
        }
      }
    } catch {
      candles = [];
    }

    let bid: number | null = null;
    let ask: number | null = null;
    let feedStatus: string | null = null;
    let tradingStatus: string | null = null;
    let sourceTimestampMs: number | null = null;
    let receivedAtMs: number | null = null;
    let priceChangeAgeMs: number | null = null;
    let lastPriceChangeAtMs: number | null = null;
    let lastReceiptAtMs: number | null = null;
    let updateCount = 0;
    let quoteFresh = false;
    let reasonCode: string | null = null;
    let realDemoQuotesObserved = false;
    let brokerConnected = false;
    let offersListenerActive: boolean | null = null;
    let subscriptionSymbols: string[] = [];
    let streamStateGlobal: string | null = null;
    try {
      const bridge = getForexConnectBridge();
      const stream = await bridge.getStreamStatus().catch(() => null);
      if (stream && typeof stream === "object") {
        const sessionStatus = String(stream.sessionStatus ?? "").toUpperCase();
        brokerConnected = sessionStatus === "CONNECTED";
        offersListenerActive = Boolean(stream.offersListenerActive);
        if (Array.isArray(stream.subscriptions)) {
          subscriptionSymbols = stream.subscriptions.map(String);
        }
        if (stream.streamState) streamStateGlobal = String(stream.streamState);
      }
      const profilesMgr = await getForexConnectProfilesManager();
      const profiles = profilesMgr.publicState();
      if (
        profiles.activeSessionStatus === "CONNECTED"
        || profiles.profiles.demo.lastAuthStatus === "CONNECTED"
      ) {
        brokerConnected = true;
      }
    } catch {
      /* stream status optional */
    }
    try {
      const live = getForexConnectLiveCandleService();
      const tf = resolveForexConnectLiveTimeframe(undefined, "1m");
      await live.ensure(instrument, tf);
      const latest = live.getLatestQuoteState(instrument);
      if (latest?.quote) {
        bid = latest.quote.bid;
        ask = latest.quote.ask;
        feedStatus = latest.streamState ?? streamStateGlobal;
        tradingStatus = latest.quote.tradingStatus ?? null;
        sourceTimestampMs = latest.quote.sourceTimestampMs ?? null;
        receivedAtMs = latest.quote.receivedAtMs ?? null;
        updateCount = latest.updateCount ?? 0;
        lastPriceChangeAtMs = latest.lastPriceChangeAtMs ?? null;
        lastReceiptAtMs = latest.lastQuoteAtMs ?? null;
        const now = Date.now();
        priceChangeAgeMs =
          lastPriceChangeAtMs != null ? Math.max(0, now - lastPriceChangeAtMs) : null;
        const receiptAgeMs =
          lastReceiptAtMs != null ? Math.max(0, now - lastReceiptAtMs) : null;
        const evalFresh = evaluateLiveOfferQuoteFreshness({
          bid,
          ask,
          streamState: feedStatus,
          priceChangeAgeMs,
          receiptAgeMs,
          updateCount,
          tradingStatus,
          sourceTimestampMs,
          receivedAtMs,
          instrument,
          nowMs: now,
        });
        quoteFresh = evalFresh.fresh;
        reasonCode = evalFresh.reasonCode;
        realDemoQuotesObserved =
          typeof bid === "number"
          && typeof ask === "number"
          && bid > 0
          && ask >= bid
          && updateCount > 0;
      }
    } catch {
      /* feed optional for strategy dry-run */
    }
    if (!feedStatus && streamStateGlobal) feedStatus = streamStateGlobal;

    const breakdown = buildFeedStatusBreakdown({
      brokerConnected,
      offersListenerActive,
      instrumentSubscribed: null,
      subscriptionSymbols,
      instrument,
      updateCount,
      lastQuoteAtMs: lastPriceChangeAtMs,
      lastPriceChangeAtMs,
      lastReceiptAtMs,
      bid,
      ask,
      streamState: feedStatus,
      tradingStatus,
      quoteFreshReasonCode: reasonCode,
    });

    const dryRun = runIsolatedStrategyDryRunLifecycle({
      instrument,
      candles,
      pointSize,
      quantityContract: {
        requestedLots: 0.01,
        baseUnitSize: 1,
        minQuantity: 1,
        mmrPerLot: null,
        maxLotsPerOrder: 0.01,
      },
      forceSimulatedTpExit: true,
      includeDeterministicFixtureLifecycle: includeFixture,
    });

    const { auditCandleQuality } = await import("./candle-quality.js");
    const candleQuality = auditCandleQuality({
      candles,
      instrument,
      timeframe,
      source: candles.length ? "forexconnect_get_history" : "unavailable",
      requestedBars: 120,
      strategyClosedBarsRequired: 23,
    });

    await this.store.appendAudit({
      action: "strategy_dry_run",
      environment: env,
      ok: true,
      code: dryRun.usedDeterministicFixture ? "SIMULATED_FIXTURE_DRY_RUN" : "SIMULATED_DRY_RUN",
      detail: `${instrument} signal=${dryRun.strategy.code} steps=${dryRun.steps.length}`.slice(0, 160),
    });

    // Phase 4.18D — additive canonical analysis using the same candles/quote (no broker mutation).
    let canonicalAnalysis: {
      result: import("./analysis/canonical-analysis.types.js").CanonicalAnalysisResult;
      view: import("./analysis/canonical-analysis.service.js").CanonicalAnalysisPublicView;
      placesOrders: false;
      acceptsForExecution: false;
      simulationOnly: true;
    } | null = null;
    try {
      const {
        runCanonicalAnalysis,
        toCanonicalPublicView,
        normalizeCanonicalTimeframe,
      } = await import("./analysis/index.js");
      const tfNorm = normalizeCanonicalTimeframe(timeframe);
      if (tfNorm) {
        const nowMs = Date.now();
        const nowIso = new Date(nowMs).toISOString();
        const receiptAgeMs =
          lastReceiptAtMs != null ? Math.max(0, nowMs - lastReceiptAtMs) : null;
        const evalFresh = evaluateLiveOfferQuoteFreshness({
          bid,
          ask,
          streamState: feedStatus,
          priceChangeAgeMs,
          receiptAgeMs,
          updateCount,
          tradingStatus,
          sourceTimestampMs,
          receivedAtMs,
          instrument,
          nowMs,
        });
        const canon = await runCanonicalAnalysis(
          {
            environment: env,
            instrument,
            timeframe: tfNorm,
            trigger: "manual",
            persist: true,
            includeOpenAi: true,
            nowMs,
          },
          {
            loadCandles: async () => candles,
            getQuoteSnapshot: async () => ({
              instrument: instrument.replace(/\s+/g, "").toUpperCase(),
              bid,
              ask,
              quoteFresh: evalFresh.fresh,
              freshnessReasonCode: evalFresh.reasonCode,
              effectivePriceChangeAgeMs: evalFresh.effectivePriceChangeAgeMs,
              snapshotFingerprint: evalFresh.snapshotFingerprint,
              evaluatedAtUtc: evalFresh.evaluatedAtUtc ?? nowIso,
            }),
            getPointSize: async () => pointSize,
            getLatestOpenAi: (sym) => {
              const latest = this.getLatestOpenAiAnalysis();
              if (!latest) return null;
              const a = String(latest.instrument ?? "").replace(/\s+/g, "").toUpperCase();
              const b = String(sym ?? "").replace(/\s+/g, "").toUpperCase();
              return a === b ? latest : null;
            },
          },
        );
        canonicalAnalysis = {
          result: canon.result,
          view: toCanonicalPublicView(canon.result, { nowMs }),
          placesOrders: false,
          acceptsForExecution: false,
          simulationOnly: true,
        };
      }
    } catch {
      canonicalAnalysis = null;
    }

    return {
      ok: true,
      dryRun,
      candleQuality,
      canonicalAnalysis,
      feedSnapshot: {
        instrument,
        bid,
        ask,
        feedStatus,
        tradingStatus,
        quoteFresh,
        reasonCode,
        sourceTimestampMs,
        receivedAtMs,
        priceChangeAgeMs,
        candleLastOpenSec: dryRun.candleDiagnostics.lastOpenSec,
        realDemoQuotesObserved,
        breakdown,
      },
      status: await this.buildStatus(),
      placesOrders: false,
      acceptsForExecution: false,
      mutatesBroker: false,
    };
  }
}

function mapFeedFromDraft(
  reason: string,
): AutomatedTradingVerificationResult["market"]["feedStatus"] {
  if (reason === "LIVE_FRESH") return "LIVE";
  if (reason === "QUOTE_AGE_EXCEEDED" || reason === "PRICE_CHANGE_AGE_UNKNOWN") return "STALE";
  if (reason === "FEED_NOT_LIVE") return "NO_RECENT_MARKET_UPDATES";
  return "ERROR";
}

let serviceSingleton: AutomatedTradingService | null = null;

export function getAutomatedTradingService(storageRoot?: string): AutomatedTradingService {
  if (storageRoot) {
    const store = getAutomatedTradingStore(storageRoot);
    const engine = getAtOpenAiAnalysisEngine(storageRoot);
    const mon = getAtMonitorWorker(storageRoot);
    const decision = getAtDecisionEngine(storageRoot);
    const simRisk = getAtSimRiskEngine(storageRoot);
    return new AutomatedTradingService(store, engine, mon, decision, simRisk);
  }
  if (!serviceSingleton) {
    const store = getAutomatedTradingStore();
    const engine = getAtOpenAiAnalysisEngine();
    const mon = getAtMonitorWorker();
    const decision = getAtDecisionEngine();
    const simRisk = getAtSimRiskEngine();
    // Bind verification/env hooks BEFORE resume so restart recovery can validate safely.
    mon.bindRuntimeHooks({
      getVerification: (env) => store.getState().environments[env].lastVerification,
      getEnvironmentEpoch: () => store.getState().environmentEpoch,
      getSelectedEnvironment: () => store.getState().selectedEnvironment,
      isSystemMasterOn: () => {
        const m = getAtSystemMasterStore().get();
        return m.ownerState === "ON" && m.masterEnabled === true;
      },
      refreshVerification: async ({ environment, instrument, timeframe }) => {
        if (!serviceSingleton) return null;
        try {
          await serviceSingleton.runVerification({
            environment,
            instrument,
            timeframe,
          });
        } catch {
          /* freshness gate will fail closed on aged snapshot */
        }
        return store.getState().environments[environment].lastVerification ?? null;
      },
    });
    mon.resumeFromPersistence();
    serviceSingleton = new AutomatedTradingService(store, engine, mon, decision, simRisk);
    // Phase 56.4.7 — fail-closed sim lifecycle recovery (never broker; never fabricate fills).
    void serviceSingleton.recoverSimLifecycleFromPersistence().catch(() => {
      // Recovery errors must not block service construction; positions remain on disk.
    });
    // Phase 57.1 — automation control fail-closed recovery (never resume entry generation).
    void serviceSingleton.recoverAutomationControlOnBoot().catch(() => undefined);
    // Phase 4.18F.8R — System Master owns analysis lifecycle (never silently default ON).
    void serviceSingleton.recoverSystemMasterOnBoot().catch(() => {
      /* OFF preserved / blocker recorded */
    });
    // Phase 59.0.13 — auto DEMO grant lifecycle (mode=off by default; never broker orders).
    void import("./demo-execution/auto-grant-lifecycle.js")
      .then(({ resumeAutoDemoGrantLifecycleFromPersistence }) => {
        resumeAutoDemoGrantLifecycleFromPersistence();
      })
      .catch(() => {
        /* keep grant lifecycle manual until module loads */
      });
  }
  return serviceSingleton;
}

export function resetAutomatedTradingServiceForTests(): void {
  serviceSingleton = null;
}
