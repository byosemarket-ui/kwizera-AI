export { workspacePerformanceEngine, WorkspacePerformanceEngine } from "./performance-engine";
export { smartCacheManager } from "./smart-cache";
export { backgroundTaskManager } from "./background-tasks";
export { fpsMonitor } from "./fps-monitor";
export { PERFORMANCE_MODE_POLICIES, resolveEffectiveMode, getModePolicy } from "./mode-policies";
export { buildAiMePerformanceContext } from "./aime-performance-awareness";
export {
  detectPerformanceAlerts, optimizeMemory, scoreResponsiveness, predictBottleneck,
} from "./memory-optimizer";
export type * from "./types";
