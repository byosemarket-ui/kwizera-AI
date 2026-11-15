import { assertLiveActivationAllowed } from "./live-gate.js";

/** Reject Live environment before any vault/agent Demo operation. */
export function assertBridgeEnvironmentIsDemo(environment: string): asserts environment is "demo" {
  if (environment !== "demo") {
    assertLiveActivationAllowed("login");
  }
}
