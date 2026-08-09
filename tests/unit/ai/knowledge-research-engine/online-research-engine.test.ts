import fs from "node:fs";
import fsPromises from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ConnectivityDetector,
  KnowledgeDownloadEngine,
  KnowledgeExtractionPreviewEngine,
  KnowledgeReviewStagingArea,
  ResearchPlanner,
  ResearchSourceDiscovery,
  listProfessionalResearchDomains,
} from "../../../../ai/knowledge-research-engine/index.js";
import type { RegisteredKnowledgeSource } from "../../../../ai/knowledge-source-manager/types.js";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map(async (root) => {
      try {
        await fsPromises.rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      } catch {
        /* ignore */
      }
    }),
  );
});

describe("Online Research & Knowledge Acquisition Engine (Learning Step 1)", () => {
  it("detects offline and online connectivity modes", async () => {
    const detector = new ConnectivityDetector(async () => ({
      online: false,
      latencyMs: null,
      error: "offline probe",
    }));
    const offline = await detector.detect();
    expect(offline.mode).toBe("offline");
    expect(offline.professionalResearchMode).toBe(false);
    expect(offline.networkQuality).toBe("unavailable");

    detector.setProbe(async () => ({ online: true, latencyMs: 90 }));
    const online = await detector.detect();
    expect(online.mode).toBe("online");
    expect(online.professionalResearchMode).toBe(true);
    expect(online.networkQuality).toBe("excellent");
  });

  it("plans only professional research domains and rejects unrelated topics", () => {
    const planner = new ResearchPlanner();
    const plan = planner.buildPlan("Product Photography Lighting");
    expect(plan.constrainedToProfessionalDomains).toBe(true);
    expect(plan.domains.some((domain) => /photography|lighting/i.test(domain.domain))).toBe(true);
    expect(listProfessionalResearchDomains().length).toBe(18);
    expect(() => planner.buildPlan("Unrelated Quantum Finance")).toThrow(/limited to professional/i);
  });

  it("evaluates sources with authority score and rejects low relevance", () => {
    const discovery = new ResearchSourceDiscovery();
    const planner = new ResearchPlanner();
    const plan = planner.buildPlan("Product Photography Lighting");
    const good: RegisteredKnowledgeSource = {
      id: "lighting-manual",
      name: "Lighting Manual",
      description: "Product photography lighting studio guide",
      type: "technical-manual",
      location: { kind: "local-path", value: "C:/tmp/lighting.md" },
      tags: ["lighting", "product", "photography"],
      status: "approved",
      verification: { verified: true, trustScore: 90, issues: [], verifiedAt: new Date().toISOString() },
      quality: {
        qualityScore: 88,
        trustScore: 90,
        reputationScore: 80,
        completenessScore: 85,
        freshnessScore: 80,
        confidenceScore: 90,
      },
      license: "CC-BY-4.0",
      registeredAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const bad: RegisteredKnowledgeSource = {
      id: "crypto-junk",
      name: "Crypto Junk",
      description: "Unrelated cryptocurrency gambling tips",
      type: "technical-manual",
      location: { kind: "url", value: "https://example.com/junk" },
      tags: ["crypto", "gambling"],
      status: "approved",
      verification: { verified: true, trustScore: 90, issues: [], verifiedAt: new Date().toISOString() },
      quality: {
        qualityScore: 88,
        trustScore: 90,
        reputationScore: 80,
        completenessScore: 85,
        freshnessScore: 80,
        confidenceScore: 90,
      },
      license: "Unknown",
      registeredAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const ranked = discovery.search(plan, [good, bad], () => false);
    expect(ranked.find((item) => item.sourceId === "lighting-manual")?.accepted).toBe(true);
    expect(ranked.find((item) => item.sourceId === "crypto-junk")?.accepted).toBe(false);
    expect(ranked.every((item) => typeof item.authorityScore === "number")).toBe(true);
  });

  it("stages downloads in a temporary review area and extracts without KF import", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-online-research-unit-"));
    roots.push(root);
    const workspace = path.join(root, "workspace");
    fs.mkdirSync(workspace, { recursive: true });
    const fixture = path.join(root, "camera-movement.md");
    fs.writeFileSync(
      fixture,
      [
        "# Camera Movement",
        "Concept: A dolly move changes perspective continuously.",
        "Rule: Always preserve product framing during camera moves.",
        "Best practice: Use slow pushes for product reveals.",
        "Buy now limited offer",
      ].join("\n"),
      "utf8",
    );

    const downloadEngine = new KnowledgeDownloadEngine(async () => {
      throw new Error("network disabled");
    });
    await downloadEngine.initialize(workspace);

    const source: RegisteredKnowledgeSource = {
      id: "camera-move-guide",
      name: "Camera Movement Guide",
      description: "Camera movement techniques for product marketing video.",
      type: "technical-manual",
      location: { kind: "local-path", value: fixture },
      tags: ["camera", "movement"],
      status: "approved",
      verification: { verified: true, trustScore: 90, issues: [], verifiedAt: new Date().toISOString() },
      quality: {
        qualityScore: 90,
        trustScore: 90,
        reputationScore: 80,
        completenessScore: 90,
        freshnessScore: 85,
        confidenceScore: 90,
      },
      license: "CC-BY-4.0",
      registeredAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const pending = await downloadEngine.requestDownload(
      {
        topic: "Camera Movement",
        sourceId: source.id,
        resourceType: "markdown",
        url: `file://${fixture.replace(/\\/g, "/")}`,
        fileName: "camera-movement.md",
        localSourcePath: fixture,
        domainId: "camera-movement-knowledge",
        title: "Camera Movement Guide",
      },
      source,
      "allow",
    );
    expect(pending.status).toBe("pending-approval");
    const completed = await downloadEngine.approveDownload(pending.id, "technical-manual");
    expect(completed.status).toBe("completed");
    expect(completed.filePath).toBeTruthy();

    const staging = new KnowledgeReviewStagingArea();
    await staging.initialize(workspace);
    const staged = await staging.stageCompletedDownload(completed);
    expect(staged.status).toBe("pending-review");
    expect(fs.existsSync(staged.stagedPath)).toBe(true);

    const extraction = new KnowledgeExtractionPreviewEngine();
    const preview = await extraction.extractFromFile({
      downloadId: completed.id,
      topic: "Camera Movement",
      filePath: completed.filePath!,
    });
    expect(preview.importedToKnowledgeFoundation).toBe(false);
    expect(preview.qualityScore).toBeGreaterThanOrEqual(40);
    expect(preview.rules.length + preview.bestPractices.length + preview.concepts.length).toBeGreaterThan(0);
    expect(preview.rejectedSignals.some((signal) => /advertisement|unrelated/i.test(signal))).toBe(true);
  });
});
