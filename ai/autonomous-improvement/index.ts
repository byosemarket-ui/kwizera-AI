export { AiAutonomousImprovementEngine } from "./autonomous-improvement-engine.js";
export {
  inferModule,
  inferStrategy,
  scoreOpportunity,
  verifySafety,
} from "./safety-verifier.js";
export type {
  AiMeAutonomousImprovementAwareness,
  AutonomousImprovementCycleInput,
  AutonomousImprovementExplainResult,
  AutonomousImprovementHealthReport,
  AutonomousImprovementReportData,
  AutonomousImprovementResult,
  ImprovementMemoryEntry,
  ImprovementSignalInput,
  ImprovementStrategy,
  ImprovementTargetModule,
} from "./types.js";
export { AUTONOMOUS_IMPROVEMENT_VERSION } from "./types.js";
