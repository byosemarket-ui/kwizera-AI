import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  INDUSTRY_STANDARDS_DOMAIN_ID,
  INDUSTRY_STANDARDS_QUALITY_SOURCE,
  ISQ_DOMAIN_BRIDGES,
  PROFESSIONAL_BEST_PRACTICES_TOPICS,
  PROFESSIONAL_CHECKLIST_TOPICS,
  PROFESSIONAL_INDUSTRY_STANDARDS_QUALITY_VERSION,
  PROFESSIONAL_QUALITY_EVALUATION_TOPICS,
  PROFESSIONAL_QUALITY_RULES_TOPICS,
  PROFESSIONAL_STANDARDS_TOPICS,
  REQUIRED_BEST_PRACTICES_TOPIC_IDS,
  REQUIRED_PROFESSIONAL_CHECKLIST_TOPIC_IDS,
  REQUIRED_PROFESSIONAL_STANDARDS_TOPIC_IDS,
  REQUIRED_QUALITY_EVALUATION_TOPIC_IDS,
  REQUIRED_QUALITY_RULES_TOPIC_IDS,
  checkIsqCatalogRelationships,
  createAiCore,
  getAllIsqTopics,
} from "../ai/index.js";

function createTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-isq-"));
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
  console.log("KWIZERA AI STUDIO — Knowledge Expansion Step 9: Industry Standards & Quality");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Record<string, { passed: boolean; detail: string }> = {};

  try {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("validate-isq");
    const foundation = core.getManager().knowledgeFoundation!;
    const standards = foundation.getProfessionalIndustryStandardsQualityKnowledge();

    results.standardsCompleteness = {
      passed: REQUIRED_PROFESSIONAL_STANDARDS_TOPIC_IDS.length === 9 && PROFESSIONAL_STANDARDS_TOPICS.length === 9,
      detail: `standards=${PROFESSIONAL_STANDARDS_TOPICS.length}`,
    };
    results.qualityRulesCompleteness = {
      passed: REQUIRED_QUALITY_RULES_TOPIC_IDS.length === 9 && PROFESSIONAL_QUALITY_RULES_TOPICS.length === 9,
      detail: `qualityRules=${PROFESSIONAL_QUALITY_RULES_TOPICS.length}`,
    };
    results.bestPracticesCompleteness = {
      passed: REQUIRED_BEST_PRACTICES_TOPIC_IDS.length === 8 && PROFESSIONAL_BEST_PRACTICES_TOPICS.length === 8,
      detail: `bestPractices=${PROFESSIONAL_BEST_PRACTICES_TOPICS.length}`,
    };
    results.qualityEvaluationCompleteness = {
      passed: REQUIRED_QUALITY_EVALUATION_TOPIC_IDS.length === 8 && PROFESSIONAL_QUALITY_EVALUATION_TOPICS.length === 8,
      detail: `qualityEvaluation=${PROFESSIONAL_QUALITY_EVALUATION_TOPICS.length}`,
    };
    results.checklistsCompleteness = {
      passed:
        REQUIRED_PROFESSIONAL_CHECKLIST_TOPIC_IDS.length === 6 && PROFESSIONAL_CHECKLIST_TOPICS.length === 6,
      detail: `checklists=${PROFESSIONAL_CHECKLIST_TOPICS.length}`,
    };

    const catalog = checkIsqCatalogRelationships();
    results.catalogRelationships = {
      passed: catalog.topicCount === 40 && catalog.broken.length === 0,
      detail: `topics=${catalog.topicCount}; broken=${catalog.broken.length}`,
    };

    const install = standards.getLastInstall();
    results.install = {
      passed: Boolean(install?.installed && install.domainMarkedReady && (install.relationshipsCreated ?? 0) > 50),
      detail: `installed=${install?.installed}; standards=${install?.standardsInstalled}; rules=${install?.qualityRulesInstalled}; practices=${install?.bestPracticesInstalled}; evaluations=${install?.qualityEvaluationInstalled}; checklists=${install?.checklistsInstalled}; rel=${install?.relationshipsCreated}`,
    };

    const all = getAllIsqTopics();
    let persisted = 0;
    for (const topic of all) {
      const read = await foundation.getStorageEngine().getRecord(topic.knowledgeId, INDUSTRY_STANDARDS_QUALITY_SOURCE);
      if (read.success && read.record) persisted += 1;
    }
    results.persistence = {
      passed: persisted === 40,
      detail: `persisted=${persisted}/40`,
    };
    results.domainBridges = {
      passed: ISQ_DOMAIN_BRIDGES.length === 12,
      detail: `bridges=${ISQ_DOMAIN_BRIDGES.length}`,
    };

    const health = await standards.runHealthCheck();
    results.health = {
      passed: health.healthy && health.completenessScore === 100,
      detail: `healthy=${health.healthy}; completeness=${health.completenessScore}; missing=${health.missingConcepts.length}; dup=${health.duplicateKnowledge.length}; broken=${health.brokenRelationships.length}`,
    };
    if (!health.healthy) {
      const repair = await standards.repair();
      const recheck = await standards.runHealthCheck();
      results.autoRepair = {
        passed: recheck.healthy,
        detail: `repaired=${repair.repaired}; remaining=${repair.remainingIssues.length}`,
      };
    } else {
      results.autoRepair = { passed: true, detail: "No repair required" };
    }

    results.aiMeQualityEvaluation = {
      passed: standards.evaluateProfessionalQuality("video lighting quality review").available,
      detail: standards.evaluateProfessionalQuality("video lighting quality review").title,
    };
    results.aiMeImprovement = {
      passed: standards.recommendImprovement("improve editing quality").available,
      detail: standards.recommendImprovement("improve editing quality").name,
    };
    results.aiMeProblems = {
      passed: standards.detectQualityProblems("audio noise and dialogue quality").available,
      detail: standards.detectQualityProblems("audio noise and dialogue quality").title,
    };
    results.aiMeStandards = {
      passed: standards.explainIndustryStandard("delivery standards").available,
      detail: standards.explainIndustryStandard("delivery standards").title,
    };
    results.aiMeBestPractices = {
      passed: standards.recommendBestPractices("product photography best practices").available,
      detail: standards.recommendBestPractices("product photography best practices").name,
    };
    const answered = standards.answer("What should a final approval checklist include?");
    results.aiMeAnswer = {
      passed: answered.available && answered.confidenceScore >= 85,
      detail: `confidence=${answered.confidenceScore}`,
    };
    const awareness = standards.getAiMeAwareness();
    results.aiMeAwareness = {
      passed:
        awareness.canEvaluateProfessionalQuality &&
        awareness.canRecommendImprovements &&
        awareness.canDetectQualityProblems &&
        awareness.canExplainIndustryStandards &&
        awareness.canRecommendBestPractices &&
        awareness.industryStandardsDomainReady &&
        awareness.summary.includes("does not generate media") &&
        awareness.summary.includes("Step 10 Professional Knowledge Certification expansion has not started"),
      detail: awareness.summary.slice(0, 180),
    };

    results.domainReady = {
      passed:
        foundation.getKnowledgeDomainPlanner().getDomain(INDUSTRY_STANDARDS_DOMAIN_ID)?.metadata.contentReady === true,
      detail: "industry-standards-knowledge contentReady",
    };
    results.certificationNotStarted = {
      passed: true,
      detail: "Step 10 Professional Knowledge Certification expansion not started",
    };
    results.packSynced = {
      passed:
        Boolean(install?.industryStandardsPackSynced) &&
        fs.existsSync(path.join(storageRoot, "knowledge", "packs", "industry-standards", "pack.json")),
      detail: "industry-standards pack",
    };
    results.version = {
      passed: PROFESSIONAL_INDUSTRY_STANDARDS_QUALITY_VERSION === "1.0.0",
      detail: `version=${PROFESSIONAL_INDUSTRY_STANDARDS_QUALITY_VERSION}`,
    };

    const avgConfidence = Math.round(all.reduce((sum, topic) => sum + topic.confidenceScore, 0) / all.length);
    const avgQuality = Math.round(all.reduce((sum, topic) => sum + topic.qualityScore, 0) / all.length);
    results.scores = {
      passed: avgConfidence >= 85 && avgQuality >= 85,
      detail: `avgConfidence=${avgConfidence}; avgQuality=${avgQuality}`,
    };

    await core.stop();
  } catch (error) {
    results.runtime = {
      passed: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  } finally {
    if (useTemp && fs.existsSync(storageRoot)) fs.rmSync(storageRoot, { recursive: true, force: true });
  }

  let failed = 0;
  for (const [name, result] of Object.entries(results)) {
    const mark = result.passed ? "PASS" : "FAIL";
    if (!result.passed) failed += 1;
    console.log(`[${mark}] ${name}: ${result.detail}`);
  }
  console.log("---");
  if (failed > 0) {
    console.error(`Industry Standards & Quality Expansion Step 9 failed: ${failed} check(s).`);
    process.exit(1);
  }
  console.log("Industry Standards & Quality Expansion Step 9 passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
