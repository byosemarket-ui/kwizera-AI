/**
 * Eager Automated Trading boot — Phase 4 coordinator.
 * Resumes analysis schedule only when System Master ownerState is ON.
 * Never overrides owner OFF. Never enables broker execution.
 */
import { getAutomatedTradingService } from "../../ai/forex-ai/automated-trading/index.js";
import { getAtSystemMasterStore } from "../../ai/forex-ai/automated-trading/system-master/index.js";
import {
  getAtBootAuditStore,
} from "../../ai/forex-ai/automated-trading/observability/index.js";

export async function bootAutomatedTrading(): Promise<void> {
  const bootStore = getAtBootAuditStore();
  const master = getAtSystemMasterStore().get();
  const audit = bootStore.begin({
    systemMasterOwnerState:
      master.ownerState === "ON" || master.ownerState === "OFF" ? master.ownerState : "UNKNOWN",
  });

  try {
    await bootStore.appendStep(audit.bootId, {
      step: "load_system_master",
      ok: true,
      code: master.ownerState,
      detail: `System Master ownerState=${master.ownerState} operational=${master.operationalState} gen=${master.analysisGeneration}`,
    });

    await bootStore.appendStep(audit.bootId, {
      step: "execution_safety",
      ok: true,
      code: "EXECUTION_DISABLED",
      detail: "placesOrders=false acceptsForExecution=false mutatesBroker=false brokerExecution=DISABLED",
    });

    const service = getAutomatedTradingService();
    await bootStore.appendStep(audit.bootId, {
      step: "service_singleton",
      ok: true,
      detail: "AutomatedTradingService ready (idle/standby allowed while System Master OFF).",
    });

    const monitor = await service.ensureAutomaticAnalysisScheduleOnBoot();
    const scheduleResumed = Boolean(monitor.config?.enabled);
    await bootStore.appendStep(audit.bootId, {
      step: "analysis_schedule",
      ok: true,
      code: scheduleResumed ? "RESUMED" : "STANDBY",
      detail: scheduleResumed
        ? "System Master ON — analysis schedule/monitor resume attempted."
        : "System Master OFF or blocked — schedule left inactive (no AI requests).",
    });

    await bootStore.complete(audit.bootId, {
      status: "COMPLETED",
      analysisScheduleResumed: scheduleResumed,
      monitorEnabled: scheduleResumed,
      systemMasterOwnerState:
        master.ownerState === "ON" || master.ownerState === "OFF" ? master.ownerState : "UNKNOWN",
      note: `Phase 4 boot ${audit.bootId} complete. Broker execution remains DISABLED.`,
    });

    console.info(
      "[KWIZERA] Automated Trading boot:",
      scheduleResumed ? "schedule resume attempted" : "standby (System Master OFF)",
      `bootId=${audit.bootId}`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    try {
      await bootStore.appendStep(audit.bootId, {
        step: "boot_failed",
        ok: false,
        code: "BOOT_ERROR",
        detail: message.slice(0, 200),
      });
      await bootStore.complete(audit.bootId, {
        status: "FAILED",
        analysisScheduleResumed: false,
        monitorEnabled: false,
        note: `Phase 4 boot failed: ${message.slice(0, 160)}`,
      });
    } catch {
      /* ignore secondary audit failure */
    }
    console.warn("[KWIZERA] Automated Trading boot error:", message);
  }
}
