import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AiCore, AiLifecycleState, AiLifecycleManager, FUTURE_MODULE_IDS, createAiCore, } from "../../ai/core/index.js";
function createTempStorageRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-ai-core-test-"));
}
describe("AiLifecycleManager", () => {
    it("transitions through startup lifecycle", () => {
        const lifecycle = new AiLifecycleManager();
        lifecycle.reset();
        lifecycle.transition(AiLifecycleState.Initializing);
        lifecycle.transition(AiLifecycleState.Loading);
        lifecycle.transition(AiLifecycleState.Ready);
        expect(lifecycle.getState()).toBe(AiLifecycleState.Ready);
        expect(lifecycle.isOperational()).toBe(true);
    });
    it("rejects invalid transitions", () => {
        const lifecycle = new AiLifecycleManager();
        lifecycle.reset();
        expect(() => lifecycle.transition(AiLifecycleState.Running)).toThrow();
    });
});
describe("AiModuleRegistry", () => {
    it("reserves all future module slots", async () => {
        const storageRoot = createTempStorageRoot();
        const core = createAiCore({ storageRootOverride: storageRoot });
        try {
            await core.start("test-correlation");
            const entries = core.getManager().registry.getAllEntries();
            expect(entries).toHaveLength(FUTURE_MODULE_IDS.length);
            expect(entries.every((e) => e.status === "slot-reserved")).toBe(true);
        }
        finally {
            await core.stop("test cleanup");
            fs.rmSync(storageRoot, { recursive: true, force: true });
            AiCore.resetInstance();
        }
    });
});
describe("AiCore foundation", () => {
    let storageRoot;
    beforeEach(() => {
        storageRoot = createTempStorageRoot();
    });
    afterEach(() => {
        AiCore.resetInstance();
        if (fs.existsSync(storageRoot)) {
            fs.rmSync(storageRoot, { recursive: true, force: true });
        }
    });
    it("starts and reaches ready lifecycle", async () => {
        const core = createAiCore({ storageRootOverride: storageRoot });
        await core.start("validation-run");
        expect(core.getManager().getLifecycleState()).toBe(AiLifecycleState.Ready);
        expect(core.getManager().runtime.isInitialized()).toBe(true);
        expect(core.getManager().configuration.isLoaded()).toBe(true);
    });
    it("writes structured logs to storage logs directory", async () => {
        const core = createAiCore({ storageRootOverride: storageRoot });
        await core.start("log-test");
        const logDir = core.getManager().logger.getLogDirectory();
        expect(logDir).toBe(path.join(storageRoot, "logs"));
        expect(fs.existsSync(logDir)).toBe(true);
        const logFile = core.getManager().logger.getLogFilePath();
        expect(logFile).toBeTruthy();
        expect(fs.existsSync(logFile)).toBe(true);
        const content = fs.readFileSync(logFile, "utf8");
        expect(content).toContain("KWIZERA AI Core startup complete");
    });
    it("shuts down cleanly", async () => {
        const core = createAiCore({ storageRootOverride: storageRoot });
        await core.start();
        await core.stop("test shutdown");
        expect(core.getManager().getLifecycleState()).toBe(AiLifecycleState.Stopped);
        expect(core.getManager().isStarted()).toBe(false);
    });
    it("produces healthy status report when ready", async () => {
        const core = createAiCore({ storageRootOverride: storageRoot });
        await core.start();
        const report = core.getStatusReport();
        expect(report.initializationStatus).toBe("complete");
        expect(report.configurationStatus).toBe("loaded");
        expect(report.loggingStatus).toContain("active");
        expect(report.registryStatus).toContain("10 slots reserved");
        expect(report.readinessScore).toBeGreaterThanOrEqual(80);
        await core.stop();
    });
    it("tracks sessions via coordinator without future modules", async () => {
        const core = createAiCore({ storageRootOverride: storageRoot });
        await core.start();
        const sessionId = core.getManager().coordinator.beginSession({ purpose: "test" });
        expect(sessionId).toBeTruthy();
        expect(core.getManager().getLifecycleState()).toBe(AiLifecycleState.Running);
        core.getManager().coordinator.endSession(sessionId);
        expect(core.getManager().getLifecycleState()).toBe(AiLifecycleState.Ready);
        await core.stop();
    });
});
//# sourceMappingURL=ai-core-foundation.test.js.map