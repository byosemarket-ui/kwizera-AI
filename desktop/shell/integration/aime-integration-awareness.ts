import type { IntegrationSnapshot } from "./types";

export function buildAiMeIntegrationContext(snapshot: IntegrationSnapshot | null) {
  if (!snapshot) {
    return {
      busOnline: false,
      aiBusBridged: false,
      queueDepth: 0,
      lastEventType: null,
      workflowSummary: "Integration engine not started.",
      recommendation: "Start the workspace integration bus to monitor module communication.",
      explanation: "No integration snapshot yet.",
    };
  }

  const last = snapshot.lastEvents[0];
  const recommendation = snapshot.failedCount > 0
    ? "Repair failed queue messages and inspect error.propagated diagnostics before restarting blocked steps."
    : snapshot.workflow.some((s) => s.status === "blocked")
      ? "A workflow dependency is blocked — complete upstream steps first."
      : snapshot.aiBusBridged
        ? "AI Communication Bus is bridged. Keep emitting production events for full AI Me awareness."
        : "Running offline-first on the local workspace bus. AI bus bridge activates when the core reports communicationBus ready.";

  const explanation = [
    `Workspace event bus is ${snapshot.busOnline ? "online" : "offline"}.`,
    snapshot.aiBusBridged ? "Bridged to AI Communication Bus." : "Local shell bus only (offline-first).",
    `Queue depth ${snapshot.queueDepth} · delivered ${snapshot.deliveredCount} · failed ${snapshot.failedCount}.`,
    last ? `Last event: ${last.type} from ${last.source}.` : "No events yet.",
    `Workflow: ${snapshot.workflow.filter((s) => s.status === "completed").length}/${snapshot.workflow.length} complete · progress ${snapshot.shared.progress}%.`,
    recommendation,
  ].join(" ");

  return {
    busOnline: snapshot.busOnline,
    aiBusBridged: snapshot.aiBusBridged,
    queueDepth: snapshot.queueDepth,
    lastEventType: last?.type ?? null,
    workflowSummary: `${snapshot.workflow.filter((s) => s.status === "completed").length}/${snapshot.workflow.length} steps`,
    recommendation,
    explanation,
  };
}
