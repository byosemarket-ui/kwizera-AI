export interface RuntimeHealthInput {
  ready: boolean;
  booting: boolean;
  restored: boolean;
  message: string;
}

/** HTTP health derived from persistent runtime — never reports healthy on a failed boot. */
export function coreHttpHealth(runtime: RuntimeHealthInput | null): {
  status: "healthy" | "starting" | "unhealthy";
  runtimeReady: boolean;
  sessionRestored: boolean;
  message: string;
} {
  if (!runtime) {
    return {
      status: "starting",
      runtimeReady: false,
      sessionRestored: false,
      message: "Persistent runtime has not started",
    };
  }
  if (runtime.ready) {
    return {
      status: "healthy",
      runtimeReady: true,
      sessionRestored: runtime.restored,
      message: runtime.message,
    };
  }
  if (runtime.booting) {
    return {
      status: "starting",
      runtimeReady: false,
      sessionRestored: runtime.restored,
      message: runtime.message,
    };
  }
  return {
    status: "unhealthy",
    runtimeReady: false,
    sessionRestored: runtime.restored,
    message: runtime.message,
  };
}
