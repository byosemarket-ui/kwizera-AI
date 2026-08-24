import type { WorkspaceEvent, WorkspaceModuleId } from "./types";

const RELATED: Partial<Record<string, WorkspaceModuleId[]>> = {
  "product-analysis": ["knowledge", "marketing", "ai-me"],
  marketing: ["storytelling", "ai-me"],
  storytelling: ["creative", "image", "audio", "ai-me"],
  image: ["video", "rendering", "output"],
  audio: ["video", "rendering", "output"],
  video: ["rendering", "output"],
  rendering: ["output", "notifications"],
  export: ["output", "notifications", "ai-me"],
};

export function relatedModulesForError(event: WorkspaceEvent): WorkspaceModuleId[] {
  const fromPayload = event.payload.module as string | undefined;
  const key = fromPayload ?? event.source;
  const mapped = RELATED[key] ?? RELATED[event.type.split(".")[0]] ?? ["workspace", "ai-me", "notifications"];
  return [...new Set([event.source, ...mapped, "notifications", "ai-me"])];
}

export function buildErrorPropagationEvent(
  source: WorkspaceEvent,
  error: string,
): WorkspaceEvent {
  return {
    id: `err-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    type: "error.propagated",
    source: "integration",
    targets: relatedModulesForError(source),
    at: new Date().toISOString(),
    correlationId: source.correlationId,
    priority: "high",
    payload: {
      relatedEvent: source.type,
      relatedEventId: source.id,
      error,
      diagnostics: {
        source: source.source,
        payload: source.payload,
        at: source.at,
      },
      recovery: recommendRecovery(source.type, error),
    },
    notify: {
      tone: "error",
      title: "Module error",
      detail: `${source.type}: ${error}. ${recommendRecovery(source.type, error)}`,
      category: "errors",
    },
  };
}

export function recommendRecovery(eventType: string, error: string): string {
  if (error.toLowerCase().includes("disk")) return "Free disk space, then resume from the last completed workflow step.";
  if (eventType.includes("rendering")) return "Retry render after freeing GPU memory; production queue is preserved.";
  if (eventType.includes("export")) return "Re-export using the last successful render; source assets were not deleted.";
  if (eventType.includes("analysis")) return "Re-run product analysis after verifying uploaded images.";
  return "Inspect diagnostics, then resume from the last completed workflow step. Cascading starts are blocked.";
}
