export type StoryboardLogLevel = "debug" | "info" | "warn" | "error";
export type StoryboardLogEvent = "startup" | "shutdown" | "storyboard-creation" | "scene-planning" | "relationship" | "validation" | "recommendation" | "search" | "performance" | "warning" | "error";
export interface StoryboardLogEntry {
    timestamp: string;
    level: StoryboardLogLevel;
    event: StoryboardLogEvent;
    message: string;
    data?: Record<string, unknown>;
}
//# sourceMappingURL=storyboard-log-types.d.ts.map