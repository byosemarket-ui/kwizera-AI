import type { AiMePerformanceContext, PerformanceSnapshot } from "./types";
import { predictBottleneck } from "./memory-optimizer";

export function buildAiMePerformanceContext(snapshot: PerformanceSnapshot | null): AiMePerformanceContext {
  if (!snapshot) {
    return {
      mode: "balanced",
      effectiveMode: "balanced",
      fps: 60,
      ramUsage: 0,
      gpuUsage: 0,
      productionActive: false,
      alertCount: 0,
      recommendation: "Start the performance monitor to track workspace health.",
      bottleneck: null,
      explanation: "Performance engine has not published a sample yet.",
    };
  }

  const bottleneck = predictBottleneck(snapshot.metrics);
  const recommendation = snapshot.recommendation
    || (bottleneck
      ? `Predicted bottleneck: ${bottleneck}. Switch toward Performance or Power Saving mode.`
      : "Workspace resources look healthy. Stay on Balanced unless production load rises.");

  const explanation = [
    `Performance mode: ${snapshot.mode} (effective ${snapshot.effectiveMode}).`,
    `UI ${snapshot.metrics.fps} FPS · responsiveness ${snapshot.responsiveness}.`,
    `RAM ${snapshot.metrics.ramUsage}% · GPU ${snapshot.metrics.gpuUsage}% · Disk ${snapshot.metrics.diskUsage}%.`,
    snapshot.productionActive
      ? `Production is active (${snapshot.metrics.activeProductionTasks} tasks) — background work is throttled.`
      : "No active production tasks — background maintenance may run.",
    snapshot.alerts[0] ? `Alert: ${snapshot.alerts[0].message}` : "No critical performance alerts.",
    recommendation,
  ].join(" ");

  return {
    mode: snapshot.mode,
    effectiveMode: snapshot.effectiveMode,
    fps: snapshot.metrics.fps,
    ramUsage: snapshot.metrics.ramUsage,
    gpuUsage: snapshot.metrics.gpuUsage,
    productionActive: snapshot.productionActive,
    alertCount: snapshot.alerts.length,
    recommendation,
    bottleneck,
    explanation,
  };
}
