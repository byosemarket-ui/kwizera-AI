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
  type AtSimRiskEngine,
  type AtSimDraftResult,
  type AtSimRiskPolicy,
  type AtSimRiskPublicStatus,
  type DraftQuoteSnapshot,
  type SimPosition,
} from "./simulation-risk/index.js";
import type { AtBinaryDirection } from "./analysis/direction.js";
import {
  assembleVerificationResult,
  uiEnvFromFc,
} from "./verification-engine.js";
import type { AutomatedTradingVerificationResult } from "./verification-types.js";
import {
  evaluateVerificationQuoteFreshness,
  withEvaluatedMarketReadiness,
} from "./quote-freshness.js";
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

    const verificationRaw = envState.lastVerification;
    // Re-evaluate cached verification with the same freshness contract as the monitor worker.
    const freshnessEval = evaluateVerificationQuoteFreshness(verificationRaw, {
      expectedInstrument: envState.selectedInstrument,
    });
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
        blockers.push(
          `Market verification snapshot is no longer fresh (${freshnessEval.reasonCode}).`,
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
    // Execution / trading readiness never READY in Phase 52
    if (moduleStatus === "READY") moduleStatus = "BLOCKED";

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
        const rec = reconcileBrokerExposure({
          instrument: String(inst?.symbol ?? selectedFresh.selectedInstrument ?? "XAU/USD"),
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
          // Phase 56.2.8 — normalize m1/5m aliases; never pass SDK period ids into ensure().
          const tf = resolveForexConnectLiveTimeframe(input.timeframe, "1m");
          let series = await live.ensure(instrumentSymbol, tf);
          // Brief settle polls: wait for a genuine Offers change without inventing LIVE.
          for (let i = 0; i < 3 && series.streamState !== "LIVE"; i += 1) {
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

    // Phase 56.2.4 — authoritative Orders/Trades RO for exposure (never mutates broker).
    const instrumentForExposure = String(
      input.instrument
        ?? decision?.instrument
        ?? envState.lastVerification?.instrument?.symbol
        ?? "XAU/USD",
    ).trim();
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
    const instrumentSymbol = String(
      input.instrument
        ?? decision?.instrument
        ?? envState.selectedInstrument
        ?? envState.lastVerification?.instrument?.symbol
        ?? "XAU/USD",
    ).trim();

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
      await life.upsert(next);
      if (becameClosed && next.exitReason) {
        await this.store.appendAudit({
          action: "simulation_position_closed",
          environment: next.environment,
          ok: true,
          code: String(next.exitReason).slice(0, 64),
          detail: `${next.simulationPositionId} ${next.exitReason} @ ${
            next.exitPrice != null ? next.exitPrice : "UNKNOWN"
          }`.slice(0, 160),
        });
      }
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
    });
    mon.resumeFromPersistence();
    serviceSingleton = new AutomatedTradingService(store, engine, mon, decision, simRisk);
  }
  return serviceSingleton;
}

export function resetAutomatedTradingServiceForTests(): void {
  serviceSingleton = null;
}
