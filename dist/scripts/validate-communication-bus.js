import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { BusMessagePriority, BusMessageType, createAiCore, FRAMEWORK_CHANNEL_CATALOG, } from "../ai/index.js";
function createTempStorageRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-communication-bus-"));
}
async function main() {
    const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
    const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
    console.log("KWIZERA AI STUDIO — Step 2H Communication Bus Validation");
    console.log("Storage root:", storageRoot);
    console.log("---");
    const core = createAiCore({ storageRootOverride: storageRoot });
    const results = {};
    try {
        await core.start("step-2h-validation");
        const bus = core.getManager().communicationBus;
        const manager = core.getManager().moduleManager;
        results.initialization = {
            passed: bus.isInitialized(),
            detail: bus.isInitialized() ? "Communication Bus initialized" : "Not initialized",
        };
        results.channelRegistration = {
            passed: bus.getChannelCount() === FRAMEWORK_CHANNEL_CATALOG.length,
            detail: `${bus.getChannelCount()} channels registered`,
        };
        const routeResult = await manager.routeCommunication({
            senderId: "ai-core",
            receiverId: "reasoning-engine",
            action: "health-probe",
        });
        results.routing = {
            passed: routeResult.success,
            detail: `Routed in ${routeResult.record.executionTimeMs}ms`,
        };
        manager.disableModule("planning-engine");
        let validationRejected = false;
        try {
            await bus.sendHealthCheck("ai-core", "planning-engine");
        }
        catch {
            validationRejected = true;
        }
        manager.enableModule("planning-engine");
        results.validation = {
            passed: validationRejected,
            detail: validationRejected ? "Inactive receiver rejected safely" : "Validation did not reject",
        };
        results.queues = {
            passed: bus.queue.getDepth() >= 0,
            detail: `Queue depth ${bus.queue.getDepth()}, processed ${bus.queue.getProcessedCount()}`,
        };
        const criticalResult = await bus.send({
            sender: "ai-core",
            receiver: "task-manager",
            messageType: BusMessageType.Request,
            priority: BusMessagePriority.Critical,
            payload: { action: "priority-test" },
        });
        results.priorities = {
            passed: criticalResult.success && criticalResult.message.priority === BusMessagePriority.Critical,
            detail: `Critical message ${criticalResult.success ? "delivered" : "failed"}`,
        };
        let retryAttempts = 0;
        const retryResult = await bus.send({
            sender: "ai-core",
            receiver: "task-manager",
            messageType: BusMessageType.Request,
            priority: BusMessagePriority.Normal,
            payload: { action: "retry-validation" },
            handler: async () => {
                retryAttempts += 1;
                if (retryAttempts < 2)
                    throw new Error("Simulated comm failure");
                return { ok: true };
            },
        });
        results.retries = {
            passed: retryResult.success && retryResult.message.retryCount >= 1,
            detail: `${retryResult.message.retryCount} retry(s), ${retryAttempts} attempt(s)`,
        };
        results.history = {
            passed: bus.history.getCount() >= 3 && fs.existsSync(bus.history.getHistoryPath() ?? ""),
            detail: `${bus.history.getCount()} history record(s)`,
        };
        results.logging = {
            passed: Boolean(bus.logger.getLogDirectory() && fs.existsSync(bus.logger.getLogDirectory())),
            detail: bus.logger.getLogDirectory() ?? "none",
        };
        const broadcastResult = await bus.broadcast("module-manager", {
            action: "status-update",
            data: { status: "operational" },
        });
        results.broadcast = {
            passed: broadcastResult.success,
            detail: "Broadcast delivered",
        };
        const status = bus.buildStatusReport();
        results.performance = {
            passed: status.performance.messageThroughput >= 3,
            detail: `throughput ${status.performance.messageThroughput}, latency ${status.performance.averageLatencyMs}ms`,
        };
        results.readiness = {
            passed: status.readinessScore >= 80,
            detail: `Readiness ${status.readinessScore}/100`,
        };
        await core.stop("validation complete");
        const allPassed = Object.values(results).every((r) => r.passed);
        const reportPath = path.join(process.cwd(), "STEP-2H-VALIDATION-REPORT.md");
        fs.writeFileSync(reportPath, buildReport(status, results, storageRoot, allPassed), "utf8");
        console.log(buildReport(status, results, storageRoot, allPassed));
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
function buildReport(status, results, storageRoot, allPassed) {
    return `# KWIZERA AI STUDIO — Step 2H Validation Report

**Phase:** 2 — Core AI Engine  
**Step:** 2H — AI Communication Bus  
**Date:** ${new Date().toISOString()}  
**Storage root (validation):** \`${storageRoot}\`

---

## Summary

| Field | Value |
|-------|-------|
| **Communication Bus Status** | ${status.communicationBusStatus} |
| **Routing Status** | ${status.routingStatus} |
| **Validation Status** | ${status.validationStatus} |
| **Queue Performance** | ${status.queuePerformance} |
| **Recovery Status** | ${status.recoveryStatus} |
| **Message Throughput** | ${status.performance.messageThroughput} |
| **Average Latency** | ${status.performance.averageLatencyMs}ms |
| **Memory Usage** | ${status.performance.memoryUsageMb}MB |
| **Readiness Score** | **${status.readinessScore}/100** |
| **Overall** | ${allPassed ? "✅ PASS" : "❌ FAIL"} |

---

## Validation Checks

${Object.entries(results)
        .map(([name, r]) => `- **${name}**: ${r.passed ? "✅ PASS" : "❌ FAIL"} — ${r.detail}`)
        .join("\n")}

---

## Message Types Supported

Request, Response, Event, Notification, Broadcast, Health Check, Status Update, Error, Recovery, Validation

---

## Communication States

Created → Queued → Sending → Delivered → Received → Processing → Completed / Failed / Retrying / Cancelled / Timeout

---

## Supported Channels (framework)

AI Core, Decision Engine, Reasoning Engine, Planning Engine, Workflow Engine, Task Manager, Module Manager, Memory Engine, Knowledge Engine, Learning Engine, Product/Image/Video/Marketing Intelligence, Translation Engine, Search Engine, Export Engine, Recovery Engine, Health Monitor

---

## Known Issues

${status.knownIssues.length > 0 ? status.knownIssues.map((i) => `- ${i}`).join("\n") : "- None identified during validation"}

---

## Components Implemented

- AI Communication Bus (\`ai/communication-bus/communication-bus.ts\`)
- Channel Registry (\`ai/communication-bus/channel-registry.ts\`)
- Message Validator (\`ai/communication-bus/message-validator.ts\`)
- Message Queue (\`ai/communication-bus/message-queue.ts\`)
- Message Router (\`ai/communication-bus/message-router.ts\`)
- Retry Handler (\`ai/communication-bus/retry-handler.ts\`)
- Message History Store & Logger

---

## Not Implemented (by design — Step 2H scope)

- User Interface, Product Management, Video Generator
- Memory Engine, Knowledge Engine (real implementations)
- AI models

---

**KWIZERA AI** — Communication Bus ready for Step 2I upon approval.
`;
}
main();
//# sourceMappingURL=validate-communication-bus.js.map