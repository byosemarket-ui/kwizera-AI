/**
 * Stage 6 — FXCM DEMO submission adapter (public surface).
 * Non-submitting: dry-run + readiness only. Never places broker orders.
 */
export * from "./types.js";
export { verifyDemoEnvironment } from "./demo-environment.js";
export {
  buildFxcmTrueMarketOpenPayload,
  redactFxcmPayloadForAudit,
} from "./fxcm-payload.js";
export { evaluateStage5ProposalIntegrity } from "./proposal-integrity.js";
export {
  evaluateAuthorizationRequirements,
  type PerSubmissionAuthorizationGrant,
} from "./authorization.js";
export {
  buildDryRunAcknowledgement,
  parseBrokerAcknowledgementFixture,
} from "./acknowledgement.js";
export {
  NoopMutationPort,
  AssertNeverCalledMutationPort,
  getDefaultMutationPort,
  setDefaultMutationPortForTests,
  resetDefaultMutationPortForTests,
} from "./mutation-port.js";
export {
  DemoSubmissionAdapterStore,
  getDemoSubmissionAdapterStore,
  resetDemoSubmissionAdapterStoreForTests,
} from "./store.js";
export {
  runDemoAdapterDryRun,
  getDemoAdapterPublicStatus,
  createAssertNeverCalledPort,
  type DryRunAdapterInput,
  type DryRunAdapterResult,
} from "./dry-run.js";
