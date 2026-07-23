import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAiCore, DecisionPriority, DecisionType, PlanningStatus, PlanningStep, PlanningType, } from "../ai/index.js";
function createTempStorageRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-planning-"));
}
async function main() {
    const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
    const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
    console.log("KWIZERA AI STUDIO — Step 2D Planning Engine Validation");
    console.log("Storage root:", storageRoot);
    console.log("---");
    const core = createAiCore({ storageRootOverride: storageRoot });
    const results = {};
    try {
        await core.start("step-2d-validation");
        const engine = core.getManager().planningEngine;
        results.initialization = {
            passed: Boolean(engine?.isInitialized()),
            detail: engine?.isInitialized()
                ? "Planning Engine initialized via AI Core"
                : "Planning Engine not initialized",
        };
        results.registry = {
            passed: core.getManager().registry.getEntry("planning-engine")?.status === "initialized",
            detail: `planning-engine: ${core.getManager().registry.getEntry("planning-engine")?.status}`,
        };
        const plan = await engine.planFromDecision({
            decisionId: "validation-decision",
            requestId: "validation-request",
            planningType: PlanningType.Backup,
            priority: DecisionPriority.Normal,
            objective: "Complete Step 2D validation",
            userRequest: "Validate planning engine",
            availableData: {
                brandProfile: { name: "KWIZERA AI STUDIO" },
                objective: "Complete Step 2D validation",
            },
            workflowHandoff: {
                workflowId: "workflow-general-validated",
                requiredModules: ["decision-engine"],
                executionPriority: DecisionPriority.Normal,
                objective: "Complete Step 2D validation",
                parameters: {},
                qualityAssessment: {
                    sufficient: true,
                    score: 95,
                    checks: [],
                    recommendations: [],
                },
            },
        });
        results.planGeneration = {
            passed: plan.readyForWorkflow && plan.stepsCompleted.length === 13,
            detail: `Status: ${plan.status}, steps: ${plan.stepsCompleted.length}`,
        };
        results.taskBreakdown = {
            passed: (plan.executionPlan?.taskList.length ?? 0) >= 2,
            detail: `${plan.executionPlan?.taskList.length ?? 0} tasks defined`,
        };
        results.dependencyAnalysis = {
            passed: plan.executionPlan?.dependencies.every((d) => d.satisfied) === true,
            detail: `${plan.executionPlan?.dependencies.length ?? 0} dependencies analyzed`,
        };
        results.resourceEstimation = {
            passed: (plan.executionPlan?.requiredResources.storageBytes ?? 0) > 0 &&
                (plan.executionPlan?.estimatedTime.totalMs ?? 0) > 0,
            detail: `Storage: ${plan.executionPlan?.requiredResources.storageBytes} bytes, time: ${plan.executionPlan?.estimatedTime.humanReadable}`,
        };
        results.riskAnalysis = {
            passed: plan.riskAnalysis.recoveryOptions.length >= 2 &&
                plan.riskAnalysis.expectedSuccessRate > 0,
            detail: `Success rate: ${plan.riskAnalysis.expectedSuccessRate}%`,
        };
        results.recoveryPlanning = {
            passed: (plan.executionPlan?.recoveryStrategy.checkpoints.length ?? 0) > 0 &&
                (plan.executionPlan?.recoveryStrategy.rollbackSteps.length ?? 0) > 0,
            detail: `${plan.executionPlan?.recoveryStrategy.checkpoints.length} checkpoints`,
        };
        const blocked = await engine.planFromDecision({
            decisionId: "validation-blocked",
            requestId: "validation-blocked-req",
            planningType: PlanningType.ProductAnalysis,
            priority: DecisionPriority.High,
            objective: "Analyze product",
            userRequest: "Analyze without product name",
            availableData: {},
            workflowHandoff: {
                workflowId: "workflow-product-analysis",
                requiredModules: ["product-engine"],
                executionPriority: DecisionPriority.High,
                objective: "Analyze product",
                parameters: {},
                qualityAssessment: { sufficient: false, score: 0, checks: [], recommendations: [] },
            },
        });
        results.missingInformation = {
            passed: !blocked.readyForWorkflow && blocked.status === PlanningStatus.AwaitingInput,
            detail: `Blocked with ${blocked.missingInformation.length} missing item(s)`,
        };
        results.planningHistory = {
            passed: engine.history.getCount() >= 2 &&
                fs.existsSync(engine.history.getHistoryPath() ?? ""),
            detail: `${engine.history.getCount()} record(s) at ${engine.history.getHistoryPath()}`,
        };
        const logDir = engine.logger.getLogDirectory();
        results.planningLogging = {
            passed: Boolean(logDir && fs.existsSync(logDir)),
            detail: logDir ?? "no log directory",
        };
        const decisionResult = await core.getManager().decisionEngine.decide({
            requestId: "validation-decision-integration",
            type: DecisionType.General,
            priority: DecisionPriority.Normal,
            userRequest: "Validate full reasoning-decision-planning pipeline",
            statedObjective: "Confirm execution plan generation",
            availableData: {
                objective: "Confirm execution plan generation",
                brandProfile: { name: "KWIZERA AI STUDIO" },
            },
        });
        results.decisionIntegration = {
            passed: decisionResult.approved &&
                Boolean(decisionResult.planningResult) &&
                decisionResult.planningResult.stepsCompleted.includes(PlanningStep.SendToWorkflowEngine),
            detail: decisionResult.approved
                ? "Decision approved with execution plan"
                : "Pipeline blocked",
        };
        const statusReport = engine.buildStatusReport();
        results.performance = {
            passed: statusReport.performance.totalPlans >= 2,
            detail: `avg ${statusReport.performance.averagePlanningMs}ms, total ${statusReport.performance.totalPlans}`,
        };
        results.readiness = {
            passed: statusReport.readinessScore >= 80,
            detail: `Readiness score: ${statusReport.readinessScore}/100`,
        };
        await core.stop("validation complete");
        const allPassed = Object.values(results).every((r) => r.passed);
        const reportPath = path.join(process.cwd(), "STEP-2D-VALIDATION-REPORT.md");
        const markdown = buildMarkdownReport(statusReport, results, storageRoot, allPassed);
        fs.writeFileSync(reportPath, markdown, "utf8");
        console.log(markdown);
        console.log("---");
        console.log(`Report written to: ${reportPath}`);
        if (useTemp && fs.existsSync(storageRoot)) {
            fs.rmSync(storageRoot, { recursive: true, force: true });
        }
        process.exit(allPassed ? 0 : 1);
    }
    catch (error) {
        console.error("Validation failed:", error);
        process.exit(1);
    }
}
function buildMarkdownReport(status, results, storageRoot, allPassed) {
    return `# KWIZERA AI STUDIO — Step 2D Validation Report

**Phase:** 2 — Core AI Engine  
**Step:** 2D — AI Planning Engine  
**Date:** ${new Date().toISOString()}  
**Storage root (validation):** \`${storageRoot}\`

---

## Summary

| Field | Value |
|-------|-------|
| **Planning Engine Status** | ${status.planningEngineStatus} |
| **Planning Quality** | ${status.planningQuality}% |
| **Resource Estimation Accuracy** | ${status.resourceEstimationAccuracy} |
| **Validation Status** | ${status.validationStatus} |
| **Average Planning Time** | ${status.performance.averagePlanningMs}ms |
| **Total Plans (validation run)** | ${status.performance.totalPlans} |
| **Readiness Score** | **${status.readinessScore}/100** |
| **Overall** | ${allPassed ? "✅ PASS" : "❌ FAIL"} |

---

## Validation Checks

${Object.entries(results)
        .map(([name, r]) => `- **${name}**: ${r.passed ? "✅ PASS" : "❌ FAIL"} — ${r.detail}`)
        .join("\n")}

---

## Planning Process (13 Steps)

1. Receive approved decision  
2. Understand the project objective  
3. Analyze available resources  
4. Identify required AI modules  
5. Break work into smaller tasks  
6. Define execution order  
7. Define dependencies  
8. Estimate execution time  
9. Estimate required storage  
10. Estimate required memory  
11. Create recovery plan  
12. Validate the complete plan  
13. Send the execution plan to the AI Workflow Engine  

---

## Known Issues

${status.knownIssues.length > 0 ? status.knownIssues.map((i) => `- ${i}`).join("\n") : "- None identified during validation"}

---

## Components Implemented

- AI Planning Engine (\`ai/planning/planning-engine.ts\`)
- Task Breakdown (\`ai/planning/task-breakdown.ts\`)
- Dependency Analyzer (\`ai/planning/dependency-analyzer.ts\`)
- Resource Estimator (\`ai/planning/resource-estimator.ts\`)
- Plan Risk Analyzer (\`ai/planning/plan-risk-analyzer.ts\`)
- Recovery Planner (\`ai/planning/recovery-planner.ts\`)
- Plan Validator (\`ai/planning/plan-validator.ts\`)
- Planning History Store (\`ai/planning/planning-history-store.ts\`)
- Planning Logger (\`ai/planning/planning-logger.ts\`)

---

## Not Implemented (by design — Step 2D scope)

- User Interface, Product Management, Video, Image, Marketing engines
- Memory Engine, Knowledge Engine (real implementations)
- AI models, AI Workflow Engine execution

---

**KWIZERA AI** — Planning Engine ready for Step 2E upon approval.
`;
}
main();
//# sourceMappingURL=validate-planning-engine.js.map