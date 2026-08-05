import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AiCore, createAiCore } from "@ai";
import { KnowledgeSourceWarningType, TRUSTED_SOURCE_LIBRARY } from "@ai/knowledge-source-manager/index.js";

describe("Knowledge Source Trusted Verification & Quality Engine (Step 2)", () => {
  let storageRoot: string;

  beforeEach(() => {
    storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-knowledge-source-quality-test-"));
  });

  afterEach(() => {
    AiCore.resetInstance();
    fs.rmSync(storageRoot, { recursive: true, force: true });
  });

  it("computes a composite quality score reflecting completeness and freshness", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("knowledge-source-quality-test");
    const manager = core.getManager().knowledgeFoundation!.getKnowledgeSourceManager();

    const rich = await manager.register({
      id: "rich-metadata-source",
      name: "Rich Metadata Source",
      description: "A source with complete metadata.",
      type: "official-api-documentation",
      location: { kind: "url", value: "https://docs.example.com/api" },
      publisher: "Example Corp",
      license: "CC-BY-4.0",
      version: "3.2.0",
      lastUpdated: new Date().toISOString(),
      tags: ["api"],
    });
    expect(rich.quality).not.toBeNull();
    expect(rich.quality!.completenessScore).toBeGreaterThanOrEqual(90);
    expect(rich.quality!.freshnessScore).toBe(100);

    const sparse = await manager.register({
      id: "sparse-metadata-source",
      name: "Sparse Metadata Source",
      description: "A source with minimal metadata.",
      type: "approved-website",
      location: { kind: "url", value: "https://sparse.example.com" },
    });
    expect(sparse.quality!.completenessScore).toBeLessThan(rich.quality!.completenessScore);
    expect(sparse.quality!.qualityScore).toBeLessThan(rich.quality!.qualityScore);

    await core.stop();
  });

  it("enforces policy decisions and blocks approval of policy-blocked sources", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("knowledge-source-quality-test");
    const manager = core.getManager().knowledgeFoundation!.getKnowledgeSourceManager();

    await manager.register({
      id: "blocked-source",
      name: "Blocked Source",
      description: "A source explicitly blocked by policy.",
      type: "approved-website",
      location: { kind: "url", value: "https://blocked.example.com" },
    });

    await manager.updatePolicy({ blocked: ["blocked-source"] });
    const evaluation = manager.evaluatePolicy("blocked-source");
    expect(evaluation.decision).toBe("block");

    await expect(manager.approve("blocked-source")).rejects.toThrow(/blocked by policy/);

    await core.stop();
  });

  it("gives policy-preferred sources a reputation and quality boost", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("knowledge-source-quality-test");
    const manager = core.getManager().knowledgeFoundation!.getKnowledgeSourceManager();

    await manager.register({
      id: "neutral-source",
      name: "Neutral Source",
      description: "A source with no policy classification.",
      type: "approved-website",
      location: { kind: "url", value: "https://neutral.example.com" },
    });
    await manager.register({
      id: "preferred-source",
      name: "Preferred Source",
      description: "A source explicitly preferred by policy.",
      type: "approved-website",
      location: { kind: "url", value: "https://preferred.example.com" },
    });

    await manager.updatePolicy({ preferred: ["preferred-source"], priorityOrder: ["preferred-source", "neutral-source"] });

    const preferredQuality = manager.assessQuality("preferred-source");
    const neutralQuality = manager.assessQuality("neutral-source");
    expect(preferredQuality.reputationScore).toBeGreaterThan(neutralQuality.reputationScore);

    await core.stop();
  });

  it("runs health checks and raises warnings for unavailable sources", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("knowledge-source-quality-test");
    const manager = core.getManager().knowledgeFoundation!.getKnowledgeSourceManager();

    await manager.register({
      id: "health-check-source",
      name: "Health Check Source",
      description: "A source used to validate health monitoring.",
      type: "approved-website",
      location: { kind: "url", value: "https://health.example.com" },
    });

    const record = await manager.checkSourceHealth("health-check-source");
    expect(record.checked).toBe(true);
    expect(record.available).toBe(false); // offline-first default: unapproved sources report unavailable

    const report = await manager.checkAllSourcesHealth();
    expect(report.records.length).toBeGreaterThanOrEqual(1);
    const warning = report.warnings.find((w) => w.sourceId === "health-check-source");
    expect(warning?.type).toBe(KnowledgeSourceWarningType.Unavailable);

    await core.stop();
  });

  it("compares sources and recommends the highest quality one, with explanations", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("knowledge-source-quality-test");
    const manager = core.getManager().knowledgeFoundation!.getKnowledgeSourceManager();

    await manager.register({
      id: "strong-source",
      name: "Strong Source",
      description: "A well-documented, complete source.",
      type: "official-documentation",
      location: { kind: "url", value: "https://strong.example.com" },
      publisher: "Strong Publisher",
      license: "MIT",
      version: "1.0.0",
      lastUpdated: new Date().toISOString(),
    });
    await manager.approve("strong-source");

    await manager.register({
      id: "weak-source",
      name: "Weak Source",
      description: "A source with minimal metadata.",
      type: "approved-website",
      location: { kind: "url", value: "https://weak.example.com" },
    });

    const comparison = manager.compareSources(["strong-source", "weak-source"]);
    expect(comparison.rankedSourceIds[0]).toBe("strong-source");

    const recommendation = manager.recommendSource(["strong-source", "weak-source"]);
    expect(recommendation?.sourceId).toBe("strong-source");

    const approvalExplanation = manager.explainDecision("strong-source");
    expect(approvalExplanation.summary).toMatch(/trusted/);

    const rejectionExplanation = manager.explainDecision("weak-source");
    expect(rejectionExplanation.rejectedAlternatives.length).toBeGreaterThan(0);

    await core.stop();
  });

  it("seeds the curated trusted source library without auto-approving entries", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("knowledge-source-quality-test");
    const manager = core.getManager().knowledgeFoundation!.getKnowledgeSourceManager();

    // Startup already seeds the discovery catalog; re-seed must remain idempotent and never auto-approve.
    await manager.seedTrustedSourceLibrary();

    const report = manager.getStatusReport();
    expect(report.totalSources).toBe(TRUSTED_SOURCE_LIBRARY.length);
    expect(report.approved).toBe(0);

    for (const entry of TRUSTED_SOURCE_LIBRARY) {
      const source = manager.get(entry.definition.id);
      expect(source?.status).toBe("pending");
      expect(source?.verification.verified).toBe(true);
      expect(source?.trustClass).toBeTruthy();
      expect(source?.category).toBeTruthy();
      expect(source?.domainIds?.length).toBeGreaterThan(0);
    }

    await core.stop();
  });
});
