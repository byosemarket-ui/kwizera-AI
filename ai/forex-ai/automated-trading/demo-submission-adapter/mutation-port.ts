/**
 * Stage 6 — Broker mutation port.
 * Production and dry-run use NoopMutationPort which never calls ForexConnect.
 */
import type { BrokerMutationPort, FxcmTrueMarketOpenPayload } from "./types.js";

export class NoopMutationPort implements BrokerMutationPort {
  readonly name = "noop-mutation-port";
  invokeCount = 0;

  async invokeTrueMarketOpen(_payload: FxcmTrueMarketOpenPayload): Promise<never> {
    this.invokeCount += 1;
    throw new Error(
      "STAGE_6_MUTATION_FORBIDDEN: NoopMutationPort refuses ForexConnect mutation. "
        + "Stage 6 is non-submitting.",
    );
  }
}

/**
 * Guard port used in tests to prove mutation was never invoked.
 * Records calls then throws — never reaches a broker.
 */
export class AssertNeverCalledMutationPort implements BrokerMutationPort {
  readonly name = "assert-never-called-mutation-port";
  calls: FxcmTrueMarketOpenPayload[] = [];

  async invokeTrueMarketOpen(payload: FxcmTrueMarketOpenPayload): Promise<never> {
    this.calls.push(payload);
    throw new Error("ASSERT_MUTATION_CALLED: Stage 6 dry-run must not invoke mutation port.");
  }
}

let defaultPort: BrokerMutationPort = new NoopMutationPort();

export function getDefaultMutationPort(): BrokerMutationPort {
  return defaultPort;
}

/** Test-only swap. */
export function setDefaultMutationPortForTests(port: BrokerMutationPort): void {
  defaultPort = port;
}

export function resetDefaultMutationPortForTests(): void {
  defaultPort = new NoopMutationPort();
}
