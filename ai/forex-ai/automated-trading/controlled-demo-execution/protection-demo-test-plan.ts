/**
 * Stage 7.3 — Controlled DEMO post-fill protection test plan (owner approval required).
 * Distinguishes implementation/unit proof from authoritative broker-side proof.
 * A real DEMO fill is NOT authorized by Stage 7.3 continuation alone.
 */
export interface ControlledDemoProtectionTestStep {
  id: string;
  title: string;
  mutatesBroker: boolean;
  requiresOwnerApproval: boolean;
  proofClass: "IMPLEMENTATION" | "BROKER_AUTHORITATIVE";
  acceptance: string;
}

export interface ControlledDemoProtectionTestPlan {
  realDemoFillAuthorizedByThisTask: false;
  placesOrders: false;
  mayCallCreateOrderRequest: false;
  mayCallSendRequest: false;
  implementationCoveredByUnitTests: string[];
  brokerAuthoritativeStepsRequireSeparateApproval: ControlledDemoProtectionTestStep[];
  note: string;
}

export function getControlledDemoProtectionTestPlan(): ControlledDemoProtectionTestPlan {
  return {
    realDemoFillAuthorizedByThisTask: false,
    placesOrders: false,
    mayCallCreateOrderRequest: false,
    mayCallSendRequest: false,
    implementationCoveredByUnitTests: [
      "verifyPostFillProtection — SL/TP present match",
      "verifyPostFillProtection — missing SL/TP → PROTECTION_FAILED",
      "verifyPostFillProtection — non-authoritative evidence blocked",
      "verifyPostFillProtection — partial fill quantity mismatch",
      "verifyPostFillProtection — post-fill 25% / 3R gates",
      "TIF matrix — GTD explicitly rejected; GTC/IOC/FOK/DAY mapped without silent downgrade",
    ],
    brokerAuthoritativeStepsRequireSeparateApproval: [
      {
        id: "demo_fill_once",
        title: "Single authorized DEMO true-market-open fill (one instrument)",
        mutatesBroker: true,
        requiresOwnerApproval: true,
        proofClass: "BROKER_AUTHORITATIVE",
        acceptance:
          "Owner-issued grant + Execution Master conditions as configured; capture brokerOrderId + tradeId.",
      },
      {
        id: "ro_protection_lookup",
        title: "Read-only position/protection lookup after fill",
        mutatesBroker: false,
        requiresOwnerApproval: true,
        proofClass: "BROKER_AUTHORITATIVE",
        acceptance: "Broker SL/TP rates match authorized proposal within tolerance; status VERIFIED.",
      },
      {
        id: "partial_fill_path",
        title: "Partial-fill reconciliation (if broker returns partial)",
        mutatesBroker: false,
        requiresOwnerApproval: true,
        proofClass: "BROKER_AUTHORITATIVE",
        acceptance: "FILL_QUANTITY_MISMATCH or explicit partial handling; never auto-compensate.",
      },
      {
        id: "protection_failure_path",
        title: "Protection missing/mismatch → PROTECTION_FAILED",
        mutatesBroker: false,
        requiresOwnerApproval: true,
        proofClass: "BROKER_AUTHORITATIVE",
        acceptance: "status=FAILED; no auto-close; owner notified.",
      },
      {
        id: "status_reconcile",
        title: "Protection status reconciliation persistence",
        mutatesBroker: false,
        requiresOwnerApproval: true,
        proofClass: "BROKER_AUTHORITATIVE",
        acceptance: "Persisted attempt protection field matches RO broker evidence.",
      },
    ],
    note:
      "Implementation tests prove software behavior with fixtures. "
      + "Authoritative broker-side proof requires a separately approved controlled DEMO fill. "
      + "This Stage 7.3 continuation does not authorize that fill.",
  };
}
