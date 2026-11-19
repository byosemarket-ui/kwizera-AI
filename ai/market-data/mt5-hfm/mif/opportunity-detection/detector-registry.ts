/**
 * Phase 5D Step 2 — immutable Opportunity Detector Registry.
 * Empty by default — no fake detectors. Does not invent opportunities.
 */
import {
  getDefaultMifStrategyIntelligenceRegistry,
  type MifStrategyIntelligenceRegistry,
} from "../strategy-intelligence/registry.js";
import type { MifStrategyId } from "../strategy-intelligence/types.js";
import { MIF_OD_DETECTOR_DUPLICATE } from "./codes.js";
import {
  MIF_OPPORTUNITY_DETECTION_POLICY_ID,
  MIF_OPPORTUNITY_DETECTION_POLICY_VERSION,
} from "./contracts.js";
import type {
  MifDetectorAvailabilityStatus,
  MifOpportunityDetector,
} from "./types.js";
import { validateOpportunityDetector } from "./validate-detector.js";

function compareId(a: string, b: string): number {
  return a.localeCompare(b);
}

export interface MifDetectorRegistryDiagnostics {
  policyId: string;
  policyVersion: string;
  detectorCount: number;
  activeCount: number;
  disabledCount: number;
  unavailableCount: number;
  validationOk: boolean;
  validationErrors: string[];
  strategiesWithoutDetector: MifStrategyId[];
  overallStatusReason: string;
}

export class MifOpportunityDetectorRegistry {
  private readonly byId = new Map<string, MifOpportunityDetector>();
  private readonly strategyRegistry: MifStrategyIntelligenceRegistry;

  constructor(
    detectors: readonly MifOpportunityDetector[] = [],
    strategyRegistry: MifStrategyIntelligenceRegistry = getDefaultMifStrategyIntelligenceRegistry(),
  ) {
    this.strategyRegistry = strategyRegistry;
    for (const d of detectors) {
      const v = validateOpportunityDetector(d, strategyRegistry);
      if (!v.ok) {
        throw new Error(`invalid detector ${d?.detectorId ?? "?"}: ${v.errors.join("; ")}`);
      }
      if (this.byId.has(d.detectorId)) {
        throw new Error(`${MIF_OD_DETECTOR_DUPLICATE}: ${d.detectorId}`);
      }
      this.byId.set(
        d.detectorId,
        Object.freeze({
          ...d,
          supportedTimeframeRoles: Object.freeze([...d.supportedTimeframeRoles]),
          supportedSymbols: d.supportedSymbols
            ? Object.freeze([...d.supportedSymbols])
            : null,
        }) as MifOpportunityDetector,
      );
    }
  }

  getPolicyId(): string {
    return MIF_OPPORTUNITY_DETECTION_POLICY_ID;
  }

  getPolicyVersion(): string {
    return MIF_OPPORTUNITY_DETECTION_POLICY_VERSION;
  }

  getStrategyRegistry(): MifStrategyIntelligenceRegistry {
    return this.strategyRegistry;
  }

  listDetectors(): MifOpportunityDetector[] {
    return [...this.byId.values()].sort((a, b) => compareId(a.detectorId, b.detectorId));
  }

  getDetector(detectorId: string): MifOpportunityDetector | null {
    return this.byId.get(String(detectorId || "").trim()) ?? null;
  }

  findByStrategyId(strategyId: string): MifOpportunityDetector[] {
    const id = String(strategyId || "").trim();
    return this.listDetectors().filter((d) => d.strategyId === id);
  }

  filterByAvailability(status: MifDetectorAvailabilityStatus): MifOpportunityDetector[] {
    return this.listDetectors().filter((d) => d.availabilityStatus === status);
  }

  validateDetector(detector: MifOpportunityDetector) {
    return validateOpportunityDetector(detector, this.strategyRegistry);
  }

  diagnostics(): MifDetectorRegistryDiagnostics {
    const all = this.listDetectors();
    const errors: string[] = [];
    for (const d of all) {
      const v = validateOpportunityDetector(d, this.strategyRegistry);
      if (!v.ok) errors.push(`${d.detectorId}: ${v.errors.join("; ")}`);
    }
    const strategies = this.strategyRegistry.listStrategies();
    const strategiesWithoutDetector = strategies
      .map((s) => s.strategyId)
      .filter((id) => this.findByStrategyId(id).length === 0);

    return {
      policyId: this.getPolicyId(),
      policyVersion: this.getPolicyVersion(),
      detectorCount: all.length,
      activeCount: all.filter((d) => d.availabilityStatus === "ACTIVE").length,
      disabledCount: all.filter((d) => d.availabilityStatus === "DISABLED").length,
      unavailableCount: all.filter((d) => d.availabilityStatus === "UNAVAILABLE").length,
      validationOk: errors.length === 0,
      validationErrors: errors,
      strategiesWithoutDetector,
      overallStatusReason:
        errors.length === 0
          ? `detector registry: ${all.length} detectors; ${strategiesWithoutDetector.length} strategies without detector`
          : `detector registry validation errors: ${errors.join(" | ")}`,
    };
  }
}

let defaultRegistry: MifOpportunityDetectorRegistry | null = null;

/** Default empty detector registry — STEP 2 does not ship strategy detectors. */
export function getDefaultMifOpportunityDetectorRegistry(): MifOpportunityDetectorRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new MifOpportunityDetectorRegistry([]);
  }
  return defaultRegistry;
}

export function createMifOpportunityDetectorRegistry(
  detectors?: readonly MifOpportunityDetector[],
  strategyRegistry?: MifStrategyIntelligenceRegistry,
): MifOpportunityDetectorRegistry {
  return new MifOpportunityDetectorRegistry(detectors ?? [], strategyRegistry);
}
