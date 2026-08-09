import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAiCore } from "../ai/index.js";

function createTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-professional-reasoning-cert-"));
}

function writeFinalReport(result: import("../ai/professional-reasoning-certification/professional-reasoning-certification-types.js").ProfessionalReasoningCertificationResult): string {
  const reportPath = path.join(process.cwd(), "PROFESSIONAL-REASONING-DECISION-CERTIFICATION-REPORT.md");
  const yesNo = (value: boolean) => (value ? "YES" : "NO");
  const cap = result.capabilities;
  const kf = result.knowledgeFoundation;
  const health = result.systemHealth;
  const scenarioLines = result.scenarios
    .map(
      (scenario) =>
        `- ${scenario.passed ? "PASS" : "FAIL"} ${scenario.name} (confidence ${scenario.confidenceScore}; domains ${scenario.domainsUsed.length}; ready=${scenario.readyForDelivery})`
    )
    .join("\n");

  const body = `# PROFESSIONAL REASONING & DECISION CERTIFICATION REPORT
## KWIZERA AI STUDIO — Reasoning & Decision Intelligence Step 8 (Final)

**Version:** ${result.version}  
**Verified at:** ${result.verifiedAt}  
**Certified:** ${result.certified ? "YES" : "NO"}  
**Offline First:** Preserved  
**Next development phase:** Not started  

---

## 1. Professional Reasoning status

${cap.professionalReasoning.status.toUpperCase()} — ${cap.professionalReasoning.detail}

## 2. Decision Intelligence status

${cap.decisionIntelligence.status.toUpperCase()} — ${cap.decisionIntelligence.detail}

## 3. Planning Intelligence status

${cap.planningIntelligence.status.toUpperCase()} — ${cap.planningIntelligence.detail}

## 4. Workflow Intelligence status

${cap.workflowIntelligence.status.toUpperCase()} — ${cap.workflowIntelligence.detail}

## 5. Recommendation Intelligence status

${cap.recommendationIntelligence.status.toUpperCase()} — ${cap.recommendationIntelligence.detail}

## 6. Multi-Domain Reasoning status

${cap.multiDomainReasoning.status.toUpperCase()} — ${cap.multiDomainReasoning.detail}

## 7. Self Review status

${cap.selfReview.status.toUpperCase()} / Evaluation: ${cap.professionalEvaluation.status.toUpperCase()}  
${cap.selfReview.detail}

## 8. Knowledge Usage status

- Domains: ${kf.knowledgeDomains.status} (${kf.knowledgeDomains.detail})
- Packs: ${kf.knowledgePacks.status} (${kf.knowledgePacks.detail})
- Graph: ${kf.knowledgeGraph.status} (${kf.knowledgeGraph.detail})
- Semantic search: ${kf.semanticSearch.status}
- Decision rules: ${kf.decisionRules.status}
- Workflow templates: ${kf.workflowTemplates.status}
- Standards: ${kf.professionalStandards.status}
- Quality rules: ${kf.qualityRules.status}
- Scenario knowledge usage score: ${health.knowledgeUsage}/100

## 9. Overall Professional Readiness Score

**${health.professionalReadinessScore}/100**

Supporting scores:
- Reasoning ${health.overallReasoningQuality}
- Decision ${health.overallDecisionQuality}
- Planning ${health.planningQuality}
- Workflow ${health.workflowQuality}
- Recommendation ${health.recommendationQuality}
- Explanation ${health.explanationQuality}
- Self Review ${health.selfReviewQuality}

## 10. Overall Confidence Score

**${health.confidenceScore}/100**

## 11. Issues Found

${result.issuesFound.length ? result.issuesFound.map((item) => `- ${item}`).join("\n") : "- None"}

## 12. Issues Repaired

${result.issuesRepaired.length ? result.issuesRepaired.map((item) => `- ${item}`).join("\n") : "- None required"}

## 13. Remaining Limitations

${result.remainingLimitations.length ? result.remainingLimitations.map((item) => `- ${item}`).join("\n") : "- None recorded"}

## Scenario suite

${scenarioLines}

## Consistency

${Object.values(result.consistency)
  .map((item) => `- ${item.status.toUpperCase()} ${item.label}: ${item.detail}`)
  .join("\n")}

## 14. Can AI Me think professionally?

**${yesNo(result.aiMeAnswers.canThinkProfessionally)}**

## 15. Can AI Me make explainable decisions?

**${yesNo(result.aiMeAnswers.canMakeExplainableDecisions)}**

## 16. Is Professional Reasoning & Decision Intelligence Version 1.0 complete?

**${yesNo(result.aiMeAnswers.isVersionOneComplete)}**

${
  result.certified
    ? `### Certification

**Professional Reasoning & Decision Intelligence Version 1.0**

Certificate: \`${result.certificatePath ?? "n/a"}\`  
Verification: \`${result.verificationPath}\`
`
    : `### Blockers (technical evidence)

${result.blockers.length ? result.blockers.map((item) => `- ${item}`).join("\n") : "- See issues found"}
`
}

---

## Summary

Step 8 orchestrates certification of the Professional Reasoning & Decision Intelligence chain without duplicating engine logic. Next development phase remains disabled.
`;

  fs.writeFileSync(reportPath, body, "utf8");
  return reportPath;
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
  console.log("KWIZERA AI STUDIO — Professional Reasoning & Decision Intelligence Step 8");
  console.log("Professional Reasoning & Decision Certification");
  console.log("Storage root:", storageRoot);
  console.log("---");
  console.log("Starting Knowledge Foundation (cold start may take several minutes)...");

  const results: Record<string, { passed: boolean; detail: string }> = {};

  try {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("validate-professional-reasoning-certification");
    console.log("Knowledge Foundation ready.");
    const engine = core.getManager().professionalReasoningCertification!;
    const selfReviewAwareness = core.getManager().selfReviewEngine!.getAiMeProfessionalSelfReviewAwareness();

    const awareness = engine.getAiMeProfessionalReasoningCertificationAwareness();
    results.aiMeAwareness = {
      passed:
        awareness.available &&
        awareness.enabled &&
        !awareness.nextDevelopmentPhaseEnabled &&
        selfReviewAwareness.professionalReasoningCertificationEnabled,
      detail: `available=${awareness.available}; nextPhase=${awareness.nextDevelopmentPhaseEnabled}; selfReviewFlag=${selfReviewAwareness.professionalReasoningCertificationEnabled}`,
    };

    const certification = await engine.certify({ autoRepair: true });
    const reportPath = writeFinalReport(certification);
    console.log("Final report:", reportPath);

    results.capabilitySuite = {
      passed: Object.values(certification.capabilities).every((item) => item.status === "passed"),
      detail: `passed=${Object.values(certification.capabilities).filter((item) => item.status === "passed").length}/8`,
    };
    results.scenarioSuite = {
      passed: certification.scenarios.filter((item) => item.passed).length >= 7,
      detail: `passed=${certification.scenarios.filter((item) => item.passed).length}/8`,
    };
    results.knowledgeUsage = {
      passed: certification.systemHealth.knowledgeUsage >= 40,
      detail: `knowledgeUsage=${certification.systemHealth.knowledgeUsage}`,
    };
    results.selfReview = {
      passed: certification.capabilities.selfReview.status === "passed" && certification.systemHealth.selfReviewQuality >= 50,
      detail: `selfReviewQuality=${certification.systemHealth.selfReviewQuality}`,
    };
    results.memoryIntegration = {
      passed: certification.scenarios.some((item) => Boolean(item.reviewId && item.recommendationId && item.workflowId)),
      detail: `linkedScenarios=${certification.scenarios.filter((item) => item.reviewId && item.recommendationId && item.workflowId).length}`,
    };
    results.readiness = {
      passed: certification.systemHealth.professionalReadinessScore >= 70,
      detail: `readiness=${certification.systemHealth.professionalReadinessScore}; confidence=${certification.systemHealth.confidenceScore}`,
    };
    results.certificationTruth = {
      passed: certification.certified === certification.aiMeAnswers.isVersionOneComplete,
      detail: `certified=${certification.certified}; versionComplete=${certification.aiMeAnswers.isVersionOneComplete}; certificate=${Boolean(certification.certificatePath)}`,
    };
    results.noNextPhase = {
      passed: !awareness.nextDevelopmentPhaseEnabled,
      detail: "Next development phase intentionally disabled for Step 8",
    };
    results.finalAnswers = {
      passed:
        certification.aiMeAnswers.canThinkProfessionally &&
        certification.aiMeAnswers.canMakeExplainableDecisions &&
        certification.aiMeAnswers.isVersionOneComplete,
      detail: `think=${certification.aiMeAnswers.canThinkProfessionally}; explain=${certification.aiMeAnswers.canMakeExplainableDecisions}; v1=${certification.aiMeAnswers.isVersionOneComplete}`,
    };

    await core.stop();
  } finally {
    if (useTemp) fs.rmSync(storageRoot, { recursive: true, force: true });
  }

  console.log("");
  let failed = 0;
  for (const [name, result] of Object.entries(results)) {
    const mark = result.passed ? "PASS" : "FAIL";
    if (!result.passed) failed += 1;
    console.log(`[${mark}] ${name}: ${result.detail}`);
  }
  console.log("---");
  console.log(failed === 0 ? "VALIDATION PASSED" : `VALIDATION FAILED (${failed} check(s))`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
