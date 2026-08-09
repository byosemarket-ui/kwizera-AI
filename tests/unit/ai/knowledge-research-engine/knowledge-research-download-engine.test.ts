import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AiCore, createAiCore } from "@ai";
import {
  KnowledgeDownloadEngine,
  resolveDownloadFolder,
  type DownloadRequest,
  type DownloadTransportResult,
} from "@ai/knowledge-research-engine/index.js";

describe("Knowledge Research, Discovery & Intelligent Download Engine (Step 3)", () => {
  let storageRoot: string;

  beforeEach(() => {
    storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-knowledge-research-test-"));
  });

  afterEach(() => {
    AiCore.resetInstance();
    fs.rmSync(storageRoot, { recursive: true, force: true });
  });

  it("builds a research plan constrained to professional creative domains", { timeout: 300_000 }, async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("knowledge-research-test");
    const engine = core.getManager().knowledgeFoundation!.getKnowledgeResearchEngine();
    expect(engine.isStartupComplete()).toBe(true);

    const plan = await engine.planResearch("Product Photography Lighting");
    expect(plan.topic).toBe("Product Photography Lighting");
    expect(plan.constrainedToProfessionalDomains).toBe(true);
    expect(plan.domains.length).toBeGreaterThan(0);
    expect(plan.tasks.length).toBe(plan.domains.length);
    expect(plan.estimatedSourceCount).toBeGreaterThan(0);
    expect(plan.domains.some((domain) => /photography|lighting/i.test(domain.domain))).toBe(true);
    expect(engine.getPlan(plan.id)?.id).toBe(plan.id);
    await expect(engine.planResearch("Unrelated Quantum Finance")).rejects.toThrow(/limited to professional/i);

    await core.stop();
  });

  it("discovers only approved, non-blocked sources ranked by composite score and generates a research preview", { timeout: 300_000 }, async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("knowledge-research-test");
    const foundation = core.getManager().knowledgeFoundation!;
    const sourceManager = foundation.getKnowledgeSourceManager();
    const engine = foundation.getKnowledgeResearchEngine();

    await sourceManager.register({
      id: "approved-docs",
      name: "Approved Official Docs",
      description: "Official documentation for underwater photography equipment.",
      type: "official-documentation",
      location: { kind: "url", value: "https://docs.example.com/uw-photo" },
      license: "CC-BY-4.0",
    });
    await sourceManager.approve("approved-docs");

    await sourceManager.register({
      id: "blocked-docs",
      name: "Blocked Docs",
      description: "Blocked documentation source.",
      type: "official-documentation",
      location: { kind: "url", value: "https://blocked.example.com/uw-photo" },
      license: "CC-BY-4.0",
    });
    await sourceManager.approve("blocked-docs");
    await sourceManager.updatePolicy({ blocked: ["blocked-docs"] });

    const plan = await engine.planResearch("Product Photography");
    const candidates = engine.discoverSources(plan.id);
    expect(candidates.some((candidate) => candidate.sourceId === "approved-docs")).toBe(true);
    expect(candidates.some((candidate) => candidate.sourceId === "blocked-docs")).toBe(false);
    expect(candidates.every((candidate) => typeof candidate.authorityScore === "number")).toBe(true);

    const preview = await engine.previewResearch(plan.id);
    expect(preview.planId).toBe(plan.id);
    expect(preview.candidates.every((candidate) => candidate.accepted !== false)).toBe(true);

    await core.stop();
  });

  it("rejects download requests for untrusted, blocked, or unlicensed sources", { timeout: 300_000 }, async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("knowledge-research-test");
    const foundation = core.getManager().knowledgeFoundation!;
    const sourceManager = foundation.getKnowledgeSourceManager();
    const engine = foundation.getKnowledgeResearchEngine();

    await sourceManager.register({
      id: "unlicensed-source",
      name: "Unlicensed Source",
      description: "A source with no license metadata.",
      type: "official-documentation",
      location: { kind: "url", value: "https://unlicensed.example.com" },
    });
    await sourceManager.approve("unlicensed-source");

    const request: DownloadRequest = {
      topic: "Underwater Photography",
      sourceId: "unlicensed-source",
      resourceType: "pdf",
      url: "https://unlicensed.example.com/manual.pdf",
      fileName: "manual.pdf",
    };
    const record = await engine.requestDownload(request);
    expect(record.status).toBe("rejected");
    expect(record.rejectionReason).toMatch(/license/i);

    const unregisteredRequest: DownloadRequest = {
      topic: "Underwater Photography",
      sourceId: "never-registered",
      resourceType: "pdf",
      url: "https://never-registered.example.com/manual.pdf",
      fileName: "manual.pdf",
    };
    const unregisteredRecord = await engine.requestDownload(unregisteredRequest);
    expect(unregisteredRecord.status).toBe("rejected");

    await core.stop();
  });

  it("blocks duplicate download requests for the same source and file name", { timeout: 300_000 }, async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("knowledge-research-test");
    const foundation = core.getManager().knowledgeFoundation!;
    const sourceManager = foundation.getKnowledgeSourceManager();
    const engine = foundation.getKnowledgeResearchEngine();

    await sourceManager.register({
      id: "licensed-source",
      name: "Licensed Source",
      description: "A properly licensed documentation source.",
      type: "official-documentation",
      location: { kind: "url", value: "https://licensed.example.com" },
      license: "CC-BY-4.0",
    });
    await sourceManager.approve("licensed-source");

    const request: DownloadRequest = {
      topic: "Underwater Photography",
      sourceId: "licensed-source",
      resourceType: "pdf",
      url: "https://licensed.example.com/manual.pdf",
      fileName: "manual.pdf",
    };
    const first = await engine.requestDownload(request);
    expect(first.status).toBe("pending-approval");

    const duplicate = await engine.requestDownload(request);
    expect(duplicate.status).toBe("duplicate");

    await core.stop();
  });
});

describe("KnowledgeDownloadEngine (direct, injectable transport)", () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-download-engine-test-"));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  const approvedSource = {
    id: "trusted-source",
    name: "Trusted Source",
    description: "A trusted, approved source.",
    type: "official-documentation" as const,
    location: { kind: "url" as const, value: "https://trusted.example.com" },
    tags: [],
    status: "approved" as const,
    verification: { verified: true, trustScore: 90, issues: [] as string[], verifiedAt: new Date().toISOString() },
    quality: null,
    license: "CC-BY-4.0",
    version: "1.0.0",
    registeredAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it("creates the exact Local Knowledge Workspace folder structure on initialize", async () => {
    const engine = new KnowledgeDownloadEngine();
    await engine.initialize(root);
    for (const folder of ["official-docs", "pdf", "books", "manuals", "research", "examples", "api", "images", "metadata"]) {
      expect(fs.existsSync(path.join(root, folder))).toBe(true);
    }
  });

  it("moves a download from pending-approval through approval to completed, writing the file and recording metadata", async () => {
    const content = Buffer.from("trusted resource content");
    const transport = async (): Promise<DownloadTransportResult> => ({ content, contentType: "application/pdf" });
    const engine = new KnowledgeDownloadEngine(transport);
    await engine.initialize(root);

    const request: DownloadRequest = {
      topic: "Test Topic",
      sourceId: approvedSource.id,
      resourceType: "pdf",
      url: "https://trusted.example.com/doc.pdf",
      fileName: "doc.pdf",
    };
    const pending = await engine.requestDownload(request, approvedSource, "allow");
    expect(pending.status).toBe("pending-approval");

    const completed = await engine.approveDownload(pending.id, approvedSource.type);
    expect(completed.status).toBe("completed");
    expect(completed.userApproved).toBe(true);
    expect(completed.license).toBe("CC-BY-4.0");
    expect(completed.version).toBe("1.0.0");
    expect(completed.checksumSha256).toBeTruthy();
    expect(completed.fileSizeBytes).toBe(content.byteLength);

    const expectedFolder = resolveDownloadFolder(approvedSource.type, "pdf");
    expect(completed.filePath).toBe(path.join(root, expectedFolder, "doc.pdf"));
    expect(fs.readFileSync(completed.filePath!, "utf8")).toBe(content.toString());

    expect(engine.getDownload(pending.id)?.status).toBe("completed");
    expect(engine.getHistory().length).toBe(1);

    const report = engine.getStatusReport();
    expect(report.completedDownloads).toBe(1);
    expect(report.totalStorageBytes).toBe(content.byteLength);
  });

  it("detects duplicate content by checksum and does not overwrite or double-store the file", async () => {
    const content = Buffer.from("identical bytes for both downloads");
    const transport = async (): Promise<DownloadTransportResult> => ({ content });
    const engine = new KnowledgeDownloadEngine(transport);
    await engine.initialize(root);

    const firstRequest: DownloadRequest = {
      topic: "Test Topic",
      sourceId: approvedSource.id,
      resourceType: "pdf",
      url: "https://trusted.example.com/a.pdf",
      fileName: "a.pdf",
    };
    const firstPending = await engine.requestDownload(firstRequest, approvedSource, "allow");
    const firstCompleted = await engine.approveDownload(firstPending.id, approvedSource.type);
    expect(firstCompleted.status).toBe("completed");

    const secondRequest: DownloadRequest = {
      topic: "Test Topic",
      sourceId: approvedSource.id,
      resourceType: "pdf",
      url: "https://trusted.example.com/b.pdf",
      fileName: "b.pdf",
    };
    const secondPending = await engine.requestDownload(secondRequest, approvedSource, "allow");
    const secondApproved = await engine.approveDownload(secondPending.id, approvedSource.type);
    expect(secondApproved.status).toBe("duplicate");
    expect(secondApproved.filePath).toBeNull();
    expect(fs.existsSync(path.join(root, "official-docs", "b.pdf"))).toBe(false);

    const report = engine.getStatusReport();
    expect(report.completedDownloads).toBe(1);
    expect(report.duplicateDownloadsBlocked).toBe(1);
  });

  it("marks a download as failed when the transport throws", async () => {
    const engine = new KnowledgeDownloadEngine(async () => {
      throw new Error("network unavailable");
    });
    await engine.initialize(root);

    const request: DownloadRequest = {
      topic: "Test Topic",
      sourceId: approvedSource.id,
      resourceType: "pdf",
      url: "https://trusted.example.com/doc.pdf",
      fileName: "doc.pdf",
    };
    const pending = await engine.requestDownload(request, approvedSource, "allow");
    const failed = await engine.approveDownload(pending.id, approvedSource.type);
    expect(failed.status).toBe("failed");
    expect(failed.rejectionReason).toMatch(/network unavailable/);
  });

  it("persists and restores download history across a re-initialize", async () => {
    const content = Buffer.from("persisted content");
    const transport = async (): Promise<DownloadTransportResult> => ({ content });
    const engine = new KnowledgeDownloadEngine(transport);
    await engine.initialize(root);

    const request: DownloadRequest = {
      topic: "Test Topic",
      sourceId: approvedSource.id,
      resourceType: "pdf",
      url: "https://trusted.example.com/doc.pdf",
      fileName: "doc.pdf",
    };
    const pending = await engine.requestDownload(request, approvedSource, "allow");
    await engine.approveDownload(pending.id, approvedSource.type);

    const restoredEngine = new KnowledgeDownloadEngine(transport);
    await restoredEngine.initialize(root);
    expect(restoredEngine.getHistory().length).toBe(1);
    expect(restoredEngine.getDownload(pending.id)?.status).toBe("completed");
  });
});
