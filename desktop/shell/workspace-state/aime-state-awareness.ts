import { sessionStore } from "./session-store";
import { projectMemoryStore } from "./project-memory";
import type { AiMeStateContext, AutoSaveStatus, RestoreReport } from "./types";

export function buildAiMeStateContext(
  autoSave: AutoSaveStatus,
  restore?: RestoreReport | null,
): AiMeStateContext {
  const session = sessionStore.getCurrent() ?? sessionStore.getLatestValid();
  const memory = projectMemoryStore.load();
  const history = sessionStore.loadHistory();
  const durationMs = session?.durationMs ?? 0;
  const mins = Math.floor(durationMs / 60_000);
  const sessionDurationLabel = session
    ? (mins < 1 ? "just started" : `${mins} min`)
    : "no active session";

  const recommendation = !autoSave.enabled
    ? "Enable auto save to protect production progress."
    : autoSave.dirty
      ? "Workspace has unsaved changes — a background save is scheduled."
      : restore?.recoveredFromCrash
        ? "Review restored panels and confirm the active project before continuing production."
        : "Session is healthy. Ask me to restore a previous layout or project session anytime.";

  const explanation = [
    session ? `Current session ${session.id.slice(0, 14)}… has been active for ${sessionDurationLabel}.` : "No workspace session is active yet.",
    memory.projectName ? `Project memory holds “${memory.projectName}” (production ${memory.productionProgress}%, storyboard ${memory.storyboardProgress}%).` : "No project is stored in project memory.",
    autoSave.enabled
      ? `Auto save is on${autoSave.lastSavedAt ? ` — last saved ${new Date(autoSave.lastSavedAt).toLocaleTimeString()}` : ""}.`
      : "Auto save is off.",
    restore?.explanation ?? "",
    `Workspace history has ${history.entries.length} entries.`,
    recommendation,
  ].filter(Boolean).join(" ");

  return {
    sessionId: session?.id ?? null,
    sessionDurationLabel,
    lastSavedAt: autoSave.lastSavedAt,
    autoSaveEnabled: autoSave.enabled,
    dirty: autoSave.dirty,
    projectName: memory.projectName,
    restoreExplanation: restore?.explanation ?? "No restore performed this launch.",
    historyCount: history.entries.length,
    recommendation,
    explanation,
  };
}

export function explainAutoSaveForAiMe(status: AutoSaveStatus): string {
  if (status.inProgress) return "A background save is in progress and will not interrupt production.";
  if (status.lastError) return `Last save failed: ${status.lastError}. Manual save is recommended.`;
  if (status.dirty) return "Workspace is dirty — smart auto save will flush shortly.";
  return status.lastSavedAt
    ? `Workspace was saved at ${new Date(status.lastSavedAt).toLocaleString()}.`
    : "No save has completed in this session yet.";
}
