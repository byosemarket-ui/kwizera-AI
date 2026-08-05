import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  AiKnowledgeDomainPlanner,
  CORE_KNOWLEDGE_DOMAINS,
  KnowledgeDomainOrigin,
  REQUIRED_KNOWLEDGE_DOMAIN_IDS,
} from "../ai/knowledge-domain-planning/index.js";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-knowledge-domain-planning-"));
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;

  console.log("KWIZERA AI STUDIO — Knowledge Seeding Step 1: Domain Planning Validation");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Record<string, { passed: boolean; detail: string }> = {};

  try {
    const planner = new AiKnowledgeDomainPlanner();
    planner.initialize(null, storageRoot);
    await planner.runStartup();

    results.startup = {
      passed: planner.isInitialized() && planner.isStartupComplete(),
      detail: planner.isStartupComplete() ? "Domain planner ready" : "Not started",
    };

    const domains = planner.listDomains();
    results.domainCount = {
      passed: domains.length === REQUIRED_KNOWLEDGE_DOMAIN_IDS.length && domains.length === 31,
      detail: `${domains.length} domains registered`,
    };

    const missingRequired = REQUIRED_KNOWLEDGE_DOMAIN_IDS.filter((id) => !planner.getDomain(id));
    results.requiredDomains = {
      passed: missingRequired.length === 0,
      detail: missingRequired.length ? `Missing: ${missingRequired.join(", ")}` : "All required domains present",
    };

    const incomplete = domains.filter(
      (domain) =>
        !domain.domainId ||
        !domain.name ||
        !domain.description ||
        !domain.tags.length ||
        !domain.version ||
        !domain.futureExpansion.acceptsChildDomains
    );
    results.domainSchema = {
      passed: incomplete.length === 0,
      detail: incomplete.length ? `${incomplete.length} incomplete domain(s)` : "All domains have full planning metadata",
    };

    const hierarchy = planner.getHierarchy();
    results.hierarchy = {
      passed: hierarchy.length >= 5 && hierarchy.some((node) => node.children.length > 0),
      detail: `${hierarchy.length} root domain(s), hierarchy built`,
    };

    const relationships = planner.getRelationships();
    results.relationships = {
      passed: relationships.length > 0,
      detail: `${relationships.length} relationship edge(s)`,
    };

    const awareness = planner.getAiMeAwareness();
    results.aiMeAwareness = {
      passed:
        awareness.availableDomainIds.length === 31 &&
        awareness.missingDomainIds.length === 31 &&
        awareness.futureLearningPriorities.length === 31,
      detail: awareness.summary,
    };

    const expanded = planner.registerFutureDomain({
      domainId: "validation-expansion-domain",
      name: "Validation Expansion Domain",
      description: "Temporary domain proving runtime expansion.",
      parentDomainId: "business-knowledge",
      tags: ["validation"],
    });
    results.runtimeExpansion = {
      passed: expanded.domainId === "validation-expansion-domain" && planner.listDomains().length === 32,
      detail: "Runtime domain registered without core catalog mutation",
    };

    results.coreCatalogImmutable = {
      passed: CORE_KNOWLEDGE_DOMAINS.length === 31,
      detail: `Core catalog size remains ${CORE_KNOWLEDGE_DOMAINS.length}`,
    };

    const report = planner.buildPlanningReport();
    results.planningReport = {
      passed:
        report.existingDomainsFound.length > 0 &&
        report.domainsUpgraded.length ===
          CORE_KNOWLEDGE_DOMAINS.filter((domain) => domain.origin === KnowledgeDomainOrigin.Upgraded).length &&
        report.newDomainsCreated.length ===
          CORE_KNOWLEDGE_DOMAINS.filter((domain) => domain.origin === KnowledgeDomainOrigin.New).length &&
        report.futureExpansionCapability.runtimeExpandable,
      detail: `existing=${report.existingDomainsFound.length}, upgraded=${report.domainsUpgraded.length}, new=${report.newDomainsCreated.length}`,
    };

    results.noContentSeeding = {
      passed: domains.every(
        (domain) => domain.metadata.contentReady === false && domain.metadata.architectureOnly === true
      ),
      detail: "Architecture-only: no knowledge content seeded",
    };
  } catch (error) {
    results.fatal = {
      passed: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  } finally {
    if (useTemp && fs.existsSync(storageRoot)) {
      fs.rmSync(storageRoot, { recursive: true, force: true });
    }
  }

  console.log("");
  let failed = 0;
  for (const [name, result] of Object.entries(results)) {
    const mark = result.passed ? "PASS" : "FAIL";
    if (!result.passed) failed += 1;
    console.log(`[${mark}] ${name}: ${result.detail}`);
  }

  console.log("---");
  if (failed > 0) {
    console.error(`Validation failed: ${failed} check(s)`);
    process.exit(1);
  }
  console.log("Knowledge Domain Planning validation passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
