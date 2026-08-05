import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  AiCore,
  BRANDING_DOMAIN_ID,
  createAiCore,
  CUSTOMER_PSYCHOLOGY_DOMAIN_ID,
  MARKETING_DOMAIN_ID,
  MBP_DOMAIN_BRIDGES,
  PROFESSIONAL_BRANDING_TOPICS,
  PROFESSIONAL_CUSTOMER_PSYCHOLOGY_TOPICS,
  PROFESSIONAL_MARKETING_BRANDING_PSYCHOLOGY_VERSION,
  PROFESSIONAL_MARKETING_TOPICS,
  PROFESSIONAL_SALES_PSYCHOLOGY_TOPICS,
  PROFESSIONAL_VIDEO_MARKETING_TOPICS,
  REQUIRED_BRANDING_TOPIC_IDS,
  REQUIRED_CUSTOMER_PSYCHOLOGY_TOPIC_IDS,
  REQUIRED_MARKETING_TOPIC_IDS,
  REQUIRED_SALES_PSYCHOLOGY_TOPIC_IDS,
  REQUIRED_VIDEO_MARKETING_TOPIC_IDS,
  SALES_PSYCHOLOGY_DOMAIN_ID,
} from "../ai/index.js";

function createTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-mbp-"));
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
  console.log("KWIZERA AI STUDIO — Knowledge Expansion Step 7: Marketing, Branding & Psychology");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Record<string, { passed: boolean; detail: string }> = {};

  try {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("validate-mbp");
    const foundation = core.getManager().knowledgeFoundation!;
    const mbp = foundation.getProfessionalMarketingBrandingPsychologyKnowledge();

    results.marketingCompleteness = {
      passed: REQUIRED_MARKETING_TOPIC_IDS.length === 12 && PROFESSIONAL_MARKETING_TOPICS.length === 12,
      detail: `marketing=${PROFESSIONAL_MARKETING_TOPICS.length}`,
    };
    results.brandingCompleteness = {
      passed: REQUIRED_BRANDING_TOPIC_IDS.length === 10 && PROFESSIONAL_BRANDING_TOPICS.length === 10,
      detail: `branding=${PROFESSIONAL_BRANDING_TOPICS.length}`,
    };
    results.customerPsychologyCompleteness = {
      passed:
        REQUIRED_CUSTOMER_PSYCHOLOGY_TOPIC_IDS.length === 10 && PROFESSIONAL_CUSTOMER_PSYCHOLOGY_TOPICS.length === 10,
      detail: `customerPsychology=${PROFESSIONAL_CUSTOMER_PSYCHOLOGY_TOPICS.length}`,
    };
    results.salesPsychologyCompleteness = {
      passed: REQUIRED_SALES_PSYCHOLOGY_TOPIC_IDS.length === 10 && PROFESSIONAL_SALES_PSYCHOLOGY_TOPICS.length === 10,
      detail: `salesPsychology=${PROFESSIONAL_SALES_PSYCHOLOGY_TOPICS.length}`,
    };
    results.videoMarketingCompleteness = {
      passed: REQUIRED_VIDEO_MARKETING_TOPIC_IDS.length === 8 && PROFESSIONAL_VIDEO_MARKETING_TOPICS.length === 8,
      detail: `videoMarketing=${PROFESSIONAL_VIDEO_MARKETING_TOPICS.length}`,
    };

    const install = mbp.getLastInstall();
    results.install = {
      passed: Boolean(install?.installed && install.domainsMarkedReady),
      detail: `installed=${install?.installed}; mkt=${install?.marketingInstalled}; brand=${install?.brandingInstalled}; cust=${install?.customerPsychologyInstalled}; sales=${install?.salesPsychologyInstalled}; vmkt=${install?.videoMarketingInstalled}; rel=${install?.relationshipsCreated}`,
    };

    const all = [
      ...PROFESSIONAL_MARKETING_TOPICS,
      ...PROFESSIONAL_BRANDING_TOPICS,
      ...PROFESSIONAL_CUSTOMER_PSYCHOLOGY_TOPICS,
      ...PROFESSIONAL_SALES_PSYCHOLOGY_TOPICS,
      ...PROFESSIONAL_VIDEO_MARKETING_TOPICS,
    ];
    let persisted = 0;
    for (const topic of all) {
      const read = await foundation.getStorageEngine().getRecord(topic.knowledgeId, "validate");
      if (read.success && read.record) persisted += 1;
    }
    results.persistence = { passed: persisted === all.length, detail: `persisted=${persisted}/${all.length}` };

    results.domainBridges = {
      passed: MBP_DOMAIN_BRIDGES.length === 10,
      detail: `bridges=${MBP_DOMAIN_BRIDGES.length}`,
    };

    const health = await mbp.runHealthCheck();
    results.health = {
      passed:
        health.healthy &&
        health.missingConcepts.length === 0 &&
        health.duplicateKnowledge.length === 0 &&
        health.brokenRelationships.length === 0,
      detail: `healthy=${health.healthy}; completeness=${health.completenessScore}`,
    };

    if (!health.healthy) {
      const repair = await mbp.repair();
      const recheck = await mbp.runHealthCheck();
      results.autoRepair = {
        passed: recheck.healthy,
        detail: `repaired=${repair.repaired}; remaining=${repair.remainingIssues.length}`,
      };
    } else {
      results.autoRepair = { passed: true, detail: "No repair required" };
    }

    results.aiMeMarketing = {
      passed: mbp.recommendMarketingStrategy("video marketing funnel").available,
      detail: mbp.recommendMarketingStrategy("video marketing funnel").name,
    };
    results.aiMeBranding = {
      passed: mbp.recommendBrandingStrategy("visual identity system").available,
      detail: mbp.recommendBrandingStrategy("visual identity system").name,
    };
    results.aiMeCustomerPsych = {
      passed: mbp.explainCustomerPsychology("buying motivation").available,
      detail: mbp.explainCustomerPsychology("buying motivation").title,
    };
    results.aiMeSalesPsych = {
      passed: mbp.explainSalesPsychology("objection handling").available,
      detail: mbp.explainSalesPsychology("objection handling").title,
    };
    results.aiMeCta = {
      passed: mbp.recommendCta("call to action for cold traffic").available,
      detail: mbp.recommendCta("call to action for cold traffic").name,
    };
    results.aiMeProductPresentation = {
      passed: mbp.recommendProductPresentation("benefit presentation in demo").available,
      detail: mbp.recommendProductPresentation("benefit presentation in demo").name,
    };
    results.aiMeAnswer = {
      passed: mbp.answer("What is the first 3 seconds strategy?").available,
      detail: `confidence=${mbp.answer("What is the first 3 seconds strategy?").confidenceScore}`,
    };

    const awareness = mbp.getAiMeAwareness();
    results.aiMeAwareness = {
      passed:
        awareness.canRecommendMarketingStrategies &&
        awareness.canRecommendBrandingStrategies &&
        awareness.canExplainCustomerPsychology &&
        awareness.canExplainSalesPsychology &&
        awareness.canRecommendCtas &&
        awareness.canRecommendProductPresentation &&
        awareness.canAnswerQuestions,
      detail: awareness.summary.slice(0, 160),
    };

    results.domainsReady = {
      passed:
        foundation.getKnowledgeDomainPlanner().getDomain(MARKETING_DOMAIN_ID)?.metadata.contentReady === true &&
        foundation.getKnowledgeDomainPlanner().getDomain(BRANDING_DOMAIN_ID)?.metadata.contentReady === true &&
        foundation.getKnowledgeDomainPlanner().getDomain(CUSTOMER_PSYCHOLOGY_DOMAIN_ID)?.metadata.contentReady ===
          true &&
        foundation.getKnowledgeDomainPlanner().getDomain(SALES_PSYCHOLOGY_DOMAIN_ID)?.metadata.contentReady === true,
      detail: "marketing + branding + customer/sales psychology contentReady",
    };

    results.socialMediaHandledByStep8 = {
      passed: true,
      detail: "Social Media Professional Knowledge is Expansion Step 8 (separate installer)",
    };

    results.packsSynced = {
      passed:
        fs.existsSync(path.join(storageRoot, "knowledge", "packs", "marketing", "pack.json")) &&
        fs.existsSync(path.join(storageRoot, "knowledge", "packs", "branding", "pack.json")) &&
        fs.existsSync(path.join(storageRoot, "knowledge", "packs", "customer-psychology", "pack.json")) &&
        fs.existsSync(path.join(storageRoot, "knowledge", "packs", "sales-psychology", "pack.json")),
      detail: "marketing + branding + psychology packs",
    };

    results.version = {
      passed: PROFESSIONAL_MARKETING_BRANDING_PSYCHOLOGY_VERSION === "1.0.0",
      detail: `version=${PROFESSIONAL_MARKETING_BRANDING_PSYCHOLOGY_VERSION}`,
    };

    const avgConfidence = Math.round(all.reduce((sum, t) => sum + t.confidenceScore, 0) / all.length);
    const avgQuality = Math.round(all.reduce((sum, t) => sum + t.qualityScore, 0) / all.length);
    results.scores = {
      passed: avgConfidence >= 85 && avgQuality >= 85,
      detail: `avgConfidence=${avgConfidence}; avgQuality=${avgQuality}`,
    };

    await core.stop();
    AiCore.resetInstance();
  } catch (error) {
    results.fatal = {
      passed: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  } finally {
    if (useTemp && fs.existsSync(storageRoot)) fs.rmSync(storageRoot, { recursive: true, force: true });
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
  console.log("Professional Marketing, Branding & Psychology Knowledge Expansion Step 7 passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
