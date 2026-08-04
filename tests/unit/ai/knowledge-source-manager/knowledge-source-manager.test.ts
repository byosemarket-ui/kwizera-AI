import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AiCore, createAiCore } from "@ai";

describe("AiKnowledgeSourceManager", () => {
  let storageRoot: string;

  beforeEach(() => {
    storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-knowledge-source-manager-test-"));
  });

  afterEach(() => {
    AiCore.resetInstance();
    fs.rmSync(storageRoot, { recursive: true, force: true });
  });

  it("registers, verifies, and approves a trusted knowledge source", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("knowledge-source-manager-test");
    const manager = core.getManager().knowledgeFoundation!.getKnowledgeSourceManager();

    const registered = await manager.register({
      id: "official-lighting-docs",
      name: "Official Lighting Documentation",
      description: "Vendor-published documentation on studio lighting equipment.",
      type: "official-documentation",
      location: { kind: "url", value: "https://docs.example.com/lighting" },
    });

    expect(registered.status).toBe("pending");
    expect(registered.verification.verified).toBe(true);
    expect(registered.verification.trustScore).toBeGreaterThanOrEqual(60);

    const approved = await manager.approve("official-lighting-docs");
    expect(approved.status).toBe("approved");
    expect(approved.approvedAt).toBeTruthy();

    const approvedSources = manager.getApprovedSources("official-documentation");
    expect(approvedSources).toHaveLength(1);
    expect(approvedSources[0].id).toBe("official-lighting-docs");

    await core.stop();
  });

  it("rejects sources that fail static verification", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("knowledge-source-manager-test");
    const manager = core.getManager().knowledgeFoundation!.getKnowledgeSourceManager();

    const registered = await manager.register({
      id: "insecure-source",
      name: "Insecure Source",
      description: "A source with an insecure endpoint.",
      type: "approved-website",
      location: { kind: "url", value: "http://user:pass@example.com/page?query=1" },
    });

    expect(registered.status).toBe("rejected");
    expect(registered.verification.verified).toBe(false);
    expect(registered.verification.issues.length).toBeGreaterThan(0);

    await expect(manager.approve("insecure-source")).rejects.toThrow(/failed verification/);

    await core.stop();
  });

  it("rejects local paths containing traversal segments", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("knowledge-source-manager-test");
    const manager = core.getManager().knowledgeFoundation!.getKnowledgeSourceManager();

    const registered = await manager.register({
      id: "traversal-source",
      name: "Traversal Source",
      description: "A source pointing outside the project directory.",
      type: "local-documentation",
      location: { kind: "local-path", value: "../../secrets/config.json" },
    });

    expect(registered.status).toBe("rejected");
    expect(registered.verification.issues).toContain(
      "Source local path must not contain parent directory traversal segments."
    );

    await core.stop();
  });

  it("supports suspend, reject, and remove lifecycle transitions", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("knowledge-source-manager-test");
    const manager = core.getManager().knowledgeFoundation!.getKnowledgeSourceManager();

    await manager.register({
      id: "technical-manual-source",
      name: "Technical Manual",
      description: "A locally stored technical manual.",
      type: "technical-manual",
      location: { kind: "local-path", value: "docs/manual.pdf" },
    });
    await manager.approve("technical-manual-source");

    const suspended = await manager.suspend("technical-manual-source", "Under review");
    expect(suspended.status).toBe("suspended");
    expect(suspended.lastError).toBe("Under review");

    await expect(manager.suspend("technical-manual-source", "Again")).rejects.toThrow(
      "Only approved sources can be suspended"
    );

    const rejected = await manager.reject("technical-manual-source", "No longer needed");
    expect(rejected.status).toBe("rejected");

    await manager.remove("technical-manual-source");
    expect(manager.get("technical-manual-source")).toBeNull();

    await core.stop();
  });

  it("discovers only new sources in bulk and reports aggregate status", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("knowledge-source-manager-test");
    const manager = core.getManager().knowledgeFoundation!.getKnowledgeSourceManager();

    const definitions = [
      {
        id: "book-source-1",
        name: "Book Source 1",
        description: "A published reference book.",
        type: "book" as const,
        location: { kind: "local-path" as const, value: "library/book-1.pdf" },
      },
      {
        id: "book-source-2",
        name: "Book Source 2",
        description: "A published reference book.",
        type: "book" as const,
        location: { kind: "local-path" as const, value: "library/book-2.pdf" },
      },
    ];

    const firstPass = await manager.discover(definitions);
    expect(firstPass).toBe(2);

    const secondPass = await manager.discover(definitions);
    expect(secondPass).toBe(0);

    const report = manager.getStatusReport();
    expect(report.totalSources).toBe(2);
    expect(report.pending).toBe(2);
    expect(report.averageTrustScore).toBeGreaterThan(0);

    await core.stop();
  });

  it("persists registered sources across a foundation restart", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("knowledge-source-manager-test");
    let manager = core.getManager().knowledgeFoundation!.getKnowledgeSourceManager();
    await manager.register({
      id: "persisted-source",
      name: "Persisted Source",
      description: "A source that should survive a restart.",
      type: "research-paper",
      location: { kind: "url", value: "https://research.example.com/paper" },
    });
    await core.stop();
    AiCore.resetInstance();

    const restarted = createAiCore({ storageRootOverride: storageRoot });
    await restarted.start("knowledge-source-manager-test");
    manager = restarted.getManager().knowledgeFoundation!.getKnowledgeSourceManager();

    const restored = manager.get("persisted-source");
    expect(restored).not.toBeNull();
    expect(restored?.status).toBe("pending");

    await restarted.stop();
  });
});
