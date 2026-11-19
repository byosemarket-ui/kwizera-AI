/**
 * Phase 5D Step 1 — immutable Strategy Intelligence Registry.
 * Static catalog lookup — no mutable runtime registration of conflicting IDs.
 */
import { MIF_STRATEGY_CATALOG } from "./catalog.js";
import {
  MIF_STRATEGY_CATALOG_VERSION,
  MIF_STRATEGY_INTELLIGENCE_POLICY_ID,
  MIF_STRATEGY_INTELLIGENCE_POLICY_VERSION,
} from "./contracts.js";
import { evaluateStrategyEligibility } from "./eligibility.js";
import { validateStrategyLifecycleTransition } from "./lifecycle.js";
import type {
  MifStrategyCategory,
  MifStrategyDefinition,
  MifStrategyEligibilityResult,
  MifStrategyEvidenceSummary,
  MifStrategyId,
  MifStrategyLifecycleStatus,
  MifStrategyRegistryDiagnostics,
} from "./types.js";
import { validateMifStrategyDefinition } from "./validate-definition.js";

function compareStrategyId(a: string, b: string): number {
  return a.localeCompare(b);
}

export class MifStrategyIntelligenceRegistry {
  private readonly byId = new Map<string, MifStrategyDefinition>();
  private readonly catalogVersion: string;

  constructor(definitions: readonly MifStrategyDefinition[] = MIF_STRATEGY_CATALOG, catalogVersion = MIF_STRATEGY_CATALOG_VERSION) {
    this.catalogVersion = catalogVersion;
    for (const def of definitions) {
      const v = validateMifStrategyDefinition(def);
      if (!v.ok) {
        throw new Error(`invalid strategy ${def.strategyId}: ${v.errors.join("; ")}`);
      }
      const key = def.strategyId;
      if (this.byId.has(key)) {
        const existing = this.byId.get(key)!;
        // Same ID + same definitionVersion is a hard duplicate conflict for this catalog model.
        if (existing.definitionVersion === def.definitionVersion) {
          throw new Error(`duplicate strategy id ${key}@${def.definitionVersion}`);
        }
        // Different versions: keep highest semver-like by string compare of patch-level — for Step 1
        // catalog all are 1.0.0; reject mixed versions in one immutable catalog instance.
        throw new Error(
          `conflicting versions for ${key}: ${existing.definitionVersion} vs ${def.definitionVersion}`,
        );
      }
      this.byId.set(key, Object.freeze({ ...def }) as MifStrategyDefinition);
    }
  }

  getCatalogVersion(): string {
    return this.catalogVersion;
  }

  getPolicyId(): string {
    return MIF_STRATEGY_INTELLIGENCE_POLICY_ID;
  }

  getPolicyVersion(): string {
    return MIF_STRATEGY_INTELLIGENCE_POLICY_VERSION;
  }

  listStrategies(): MifStrategyDefinition[] {
    return [...this.byId.values()].sort((a, b) => compareStrategyId(a.strategyId, b.strategyId));
  }

  getStrategy(strategyId: string): MifStrategyDefinition | null {
    return this.byId.get(String(strategyId || "").trim()) ?? null;
  }

  getStrategyVersion(strategyId: string, definitionVersion: string): MifStrategyDefinition | null {
    const found = this.getStrategy(strategyId);
    if (!found) return null;
    return found.definitionVersion === definitionVersion ? found : null;
  }

  filterByCategory(category: MifStrategyCategory): MifStrategyDefinition[] {
    return this.listStrategies().filter((s) => s.categories.includes(category));
  }

  filterByLifecycle(status: MifStrategyLifecycleStatus): MifStrategyDefinition[] {
    return this.listStrategies().filter((s) => s.lifecycleStatus === status);
  }

  validateDefinition(def: MifStrategyDefinition): ReturnType<typeof validateMifStrategyDefinition> {
    return validateMifStrategyDefinition(def);
  }

  validateLifecycleTransition(
    from: MifStrategyLifecycleStatus,
    to: MifStrategyLifecycleStatus,
  ): ReturnType<typeof validateStrategyLifecycleTransition> {
    return validateStrategyLifecycleTransition(from, to);
  }

  evaluateEligibility(
    strategyId: string,
    summary: MifStrategyEvidenceSummary,
  ): MifStrategyEligibilityResult {
    const def = this.getStrategy(strategyId);
    return evaluateStrategyEligibility({ definition: def, summary });
  }

  diagnostics(): MifStrategyRegistryDiagnostics {
    const all = this.listStrategies();
    const errors: string[] = [];
    for (const s of all) {
      const v = validateMifStrategyDefinition(s);
      if (!v.ok) errors.push(`${s.strategyId}: ${v.errors.join("; ")}`);
    }
    const ids = all.map((s) => s.strategyId);
    if (new Set(ids).size !== ids.length) errors.push("duplicate strategy ids in catalog");
    return {
      catalogVersion: this.catalogVersion,
      strategyCount: all.length,
      activeCount: all.filter((s) => s.lifecycleStatus === "ACTIVE").length,
      draftCount: all.filter((s) => s.lifecycleStatus === "DRAFT").length,
      disabledCount: all.filter((s) => s.lifecycleStatus === "DISABLED").length,
      deprecatedCount: all.filter((s) => s.lifecycleStatus === "DEPRECATED").length,
      validationOk: errors.length === 0,
      validationErrors: errors,
      overallStatusReason:
        errors.length === 0
          ? `catalog ${this.catalogVersion}: ${all.length} strategies valid`
          : `catalog validation errors: ${errors.join(" | ")}`,
    };
  }
}

let defaultRegistry: MifStrategyIntelligenceRegistry | null = null;

/** Default immutable registry over the built-in ten-strategy catalog. */
export function getDefaultMifStrategyIntelligenceRegistry(): MifStrategyIntelligenceRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new MifStrategyIntelligenceRegistry();
  }
  return defaultRegistry;
}

export function createMifStrategyIntelligenceRegistry(
  definitions?: readonly MifStrategyDefinition[],
): MifStrategyIntelligenceRegistry {
  return new MifStrategyIntelligenceRegistry(definitions ?? MIF_STRATEGY_CATALOG);
}

export type { MifStrategyId };
