import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  KnowledgeCreativeDirectionStyle,
  KnowledgeCreativeDomain,
  KnowledgeCreativePlatform,
  MonitoredKnowledgeModule,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-knowledge-health-monitor-test-"));
}

describe("AiKnowledgeHealthMonitorEngine", () => {
  let storageRoot: string;

  beforeEach(() => {
    storageRoot = createTempStorageRoot();
  });

  afterEach(() => {
    AiCore.resetInstance();
    if (fs.existsSync(storageRoot)) {
      fs.rmSync(storageRoot, { recursive: true, force: true });
    }
  });

  async function startCore() {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("knowledge-health-monitor-test");
    const foundation = core.getManager().knowledgeFoundation!;
    const creative = foundation.getCreativeKnowledgeEngine();
    const monitor = foundation.getKnowledgeHealthMonitorEngine();
    return { core, foundation, creative, monitor };
  }

  it("initializes with knowledge foundation startup", async () => {
    const { core, monitor } = await startCore();
    expect(monitor.isInitialized()).toBe(true);
    expect(monitor.isStartupComplete()).toBe(true);

    const healthDir = path.join(storageRoot, "knowledge", "health", "engine");
    expect(fs.existsSync(healthDir)).toBe(true);

    await core.stop();
  });

  it("runs health checks with module scores", async () => {
    const { core, creative, monitor } = await startCore();

    await creative.analyzeCreative({
      creativeId: "health-test",
      projectName: "Health Test",
      domain: KnowledgeCreativeDomain.AdvertisingDesign,
      creativeStyle: KnowledgeCreativeDirectionStyle.Premium,
      platform: KnowledgeCreativePlatform.Instagram,
      brandName: "KWIZERA",
      visual: { balance: 85 },
      tags: ["test"],
    });

    const check = await monitor.runHealthCheck();
    expect(check.overallScore).toBeGreaterThanOrEqual(75);
    expect(check.moduleScores.length).toBeGreaterThanOrEqual(18);

    const graph = check.moduleScores.find((m) => m.module === MonitoredKnowledgeModule.GraphEngine);
    expect(graph).toBeDefined();

    await core.stop();
  });

  it("runs audits and maintains health history", async () => {
    const { core, creative, monitor } = await startCore();

    await creative.analyzeCreative({
      creativeId: "audit-test",
      projectName: "Audit Test",
      domain: KnowledgeCreativeDomain.PosterDesign,
      creativeStyle: KnowledgeCreativeDirectionStyle.Bold,
      platform: KnowledgeCreativePlatform.Facebook,
      brandName: "KWIZERA",
      visual: { balance: 80 },
      tags: ["test"],
    });

    const audit = await monitor.runAudit();
    expect(audit.durationMs).toBeGreaterThanOrEqual(0);

    await monitor.runHealthCheck();
    const history = monitor.getHealthHistory();
    expect(history.length).toBeGreaterThanOrEqual(2);

    await core.stop();
  });

  it("provides trend analysis", async () => {
    const { core, monitor } = await startCore();
    const trend = monitor.getTrendAnalysis();
    expect(trend.prediction.length).toBeGreaterThan(0);

    await core.stop();
  });

  it("generates project-state reports", async () => {
    const { core, creative, monitor } = await startCore();

    await creative.analyzeCreative({
      creativeId: "report-test",
      projectName: "Report Test",
      domain: KnowledgeCreativeDomain.SocialMediaDesign,
      creativeStyle: KnowledgeCreativeDirectionStyle.Playful,
      platform: KnowledgeCreativePlatform.TikTok,
      brandName: "KWIZERA",
      visual: { balance: 82 },
      tags: ["test"],
    });

    await monitor.runHealthCheck();
    const paths = monitor.generateReports();

    expect(fs.existsSync(paths.healthReportPath)).toBe(true);
    expect(fs.existsSync(paths.historyReportPath)).toBe(true);
    expect(fs.existsSync(paths.performanceReportPath)).toBe(true);
    expect(fs.existsSync(paths.recommendationsReportPath)).toBe(true);

    await core.stop();
  });

  it("writes logs to storage root logs directory", async () => {
    const { core, monitor } = await startCore();
    const logDir = path.join(storageRoot, "logs");
    const date = new Date().toISOString().slice(0, 10);
    const logFile = path.join(logDir, `knowledge-health-monitor-engine-${date}.jsonl`);

    expect(fs.existsSync(logFile)).toBe(true);
    expect(monitor.logger.getLogDirectory()).toBe(logDir);

    await core.stop();
  });

  it("builds status report with readiness score", async () => {
    const { core, creative, monitor } = await startCore();

    await creative.analyzeCreative({
      creativeId: "status-test",
      projectName: "Status Test",
      domain: KnowledgeCreativeDomain.AdvertisingDesign,
      creativeStyle: KnowledgeCreativeDirectionStyle.Premium,
      platform: KnowledgeCreativePlatform.Instagram,
      brandName: "KWIZERA",
      visual: { balance: 88 },
      tags: ["test"],
    });

    await monitor.runHealthCheck();
    const report = monitor.buildStatusReport();
    expect(report.engineStatus).toBe("operational");
    expect(report.readinessScore).toBe(100);

    await core.stop();
  });
});
