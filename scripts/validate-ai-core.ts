import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAiCore, AiLifecycleState, AiCoreStatusReport } from "../ai/index.js";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-"));
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;

  console.log("KWIZERA AI STUDIO — Step 2A AI Core Validation");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const core = createAiCore({ storageRootOverride: storageRoot });
  const results: Record<string, { passed: boolean; detail: string }> = {};

  try {
    await core.start("step-2a-validation");
    results.initialization = {
      passed: core.getManager().runtime.isInitialized(),
      detail: core.getManager().runtime.isInitialized()
        ? "Runtime initialized"
        : "Runtime failed",
    };
    results.startup = {
      passed: core.getManager().getLifecycleState() === AiLifecycleState.Ready,
      detail: `Lifecycle: ${core.getManager().getLifecycleState()}`,
    };
    results.configuration = {
      passed: core.getManager().configuration.isLoaded(),
      detail: core.getManager().configuration.isLoaded()
        ? "Configuration loaded"
        : "Configuration missing",
    };
    results.registry = {
      passed: core.getManager().registry.getSlotCount() === 17,
      detail: `${core.getManager().registry.getSlotCount()} module slots reserved`,
    };
    results.logging = {
      passed: core.getManager().logger.isInitialized(),
      detail: core.getManager().logger.getLogDirectory() ?? "No log directory",
    };

    const health = core.getManager().controller.getHealthReport();
    results.health = {
      passed: health.healthy,
      detail: health.checks.map((c) => `${c.name}:${c.passed}`).join(", "),
    };

    const report = core.getStatusReport();
    results.lifecycle = {
      passed: core.getManager().getLifecycleState() === AiLifecycleState.Ready,
      detail: `Lifecycle before shutdown: ${core.getManager().getLifecycleState()}`,
    };

    await core.stop("validation complete");
    results.shutdown = {
      passed: core.getManager().getLifecycleState() === AiLifecycleState.Stopped,
      detail: `Lifecycle: ${core.getManager().getLifecycleState()}`,
    };

    const allPassed = Object.values(results).every((r) => r.passed);
    const reportPath = path.join(process.cwd(), "STEP-2A-VALIDATION-REPORT.md");

    const markdown = buildMarkdownReport(report, results, storageRoot, allPassed);
    fs.writeFileSync(reportPath, markdown, "utf8");

    console.log(markdown);
    console.log("---");
    console.log(`Report written to: ${reportPath}`);

    if (useTemp && fs.existsSync(storageRoot)) {
      fs.rmSync(storageRoot, { recursive: true, force: true });
    }

    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error("Validation failed:", error);
    process.exit(1);
  }
}

function buildMarkdownReport(
  status: AiCoreStatusReport,
  results: Record<string, { passed: boolean; detail: string }>,
  storageRoot: string,
  allPassed: boolean
): string {
  return `# KWIZERA AI STUDIO — Step 2A Validation Report

**Phase:** 2 — Core AI Engine  
**Step:** 2A — AI Core Foundation  
**Date:** ${new Date().toISOString()}  
**Storage root (validation):** \`${storageRoot}\`

---

## Summary

| Field | Value |
|-------|-------|
| **AI Core Status** | ${status.aiCoreStatus} |
| **Initialization Status** | ${status.initializationStatus} |
| **Lifecycle Status** | ${status.lifecycleStatus} |
| **Registry Status** | ${status.registryStatus} |
| **Configuration Status** | ${status.configurationStatus} |
| **Logging Status** | ${status.loggingStatus} |
| **Health Status** | ${status.healthStatus} |
| **Readiness Score** | **${status.readinessScore}/100** |
| **Overall** | ${allPassed ? "✅ PASS" : "❌ FAIL"} |

---

## Validation Checks

${Object.entries(results)
  .map(
    ([name, r]) =>
      `- **${name}**: ${r.passed ? "✅ PASS" : "❌ FAIL"} — ${r.detail}`
  )
  .join("\n")}

---

## Registered Module Slots (not implemented — registry only)

| Module ID | Name | Status |
|-----------|------|--------|
${status.registeredModules.map((m) => `| ${m.id} | ${m.name} | ${m.status} |`).join("\n")}

---

## Startup Diagnostics

${status.diagnostics.map((d) => `- **${d.stage}**: ${d.success ? "OK" : "FAIL"} — ${d.message}`).join("\n")}

---

## Components Implemented

- AI Core (\`ai/core/ai-core.ts\`)
- AI Runtime (\`ai/core/ai-runtime.ts\`)
- AI Core Manager (\`ai/core/ai-core-manager.ts\`)
- AI Coordinator (\`ai/core/ai-coordinator.ts\`)
- AI Controller (\`ai/core/ai-controller.ts\`)
- AI Context Manager (\`ai/core/ai-context-manager.ts\`)
- AI Session Manager (\`ai/core/ai-session-manager.ts\`)
- AI Configuration Manager (\`ai/core/ai-configuration-manager.ts\`)
- AI Startup Manager (\`ai/core/ai-startup-manager.ts\`)
- AI Shutdown Manager (\`ai/core/ai-shutdown-manager.ts\`)
- AI Health Monitor (\`ai/core/ai-health-monitor.ts\`)
- Module Registry (\`ai/core/module-registry.ts\`)

---

## Not Implemented (by design — Step 2A scope)

- Product Management, Video, Image, Marketing engines
- Memory Engine, Knowledge Engine
- User Interface
- AI models

---

**KWIZERA AI** — AI Core Foundation ready for Step 2B upon approval.
`;
}

main();
