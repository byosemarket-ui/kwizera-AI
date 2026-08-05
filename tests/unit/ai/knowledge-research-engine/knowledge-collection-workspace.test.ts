import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  KnowledgeCollectionWorkspace,
  KnowledgeDownloadEngine,
  PREPARED_WORKSPACE_DOMAIN_SLUGS,
  domainIdToWorkspaceSlug,
  type DownloadTransportResult,
} from "../../../../ai/knowledge-research-engine/index.js";

describe("Knowledge Collection Workspace & Collection (Step 3)", () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-knowledge-collection-test-"));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("prepares domain and type folders and repairs missing structure", async () => {
    const workspace = new KnowledgeCollectionWorkspace();
    const repair = await workspace.initialize(root);
    expect(repair.repaired).toBe(true);

    for (const slug of ["video-production", "camera", "lighting", "marketing", "storytelling", "animation", "rendering", "editing", "product-photography", "social-media"]) {
      expect(fs.existsSync(path.join(root, slug))).toBe(true);
      expect(fs.existsSync(path.join(root, slug, "official-docs"))).toBe(true);
    }
    expect(fs.existsSync(path.join(root, "metadata"))).toBe(true);
    expect(PREPARED_WORKSPACE_DOMAIN_SLUGS.length).toBeGreaterThan(10);

    fs.rmSync(path.join(root, "camera"), { recursive: true, force: true });
    const auditBefore = await workspace.audit();
    expect(auditBefore.healthy).toBe(false);

    const repaired = await workspace.ensureStructure();
    expect(repaired.repaired).toBe(true);
    expect(fs.existsSync(path.join(root, "camera", "manuals"))).toBe(true);
  });

  it("collects an approved local resource into a domain workspace with full metadata", async () => {
    const fixture = path.join(root, "source-fixture.md");
    fs.writeFileSync(fixture, "# Camera Knowledge\nAperture and shutter fundamentals.\n", "utf8");

    const transport = async (): Promise<DownloadTransportResult> => {
      throw new Error("network should not be used for local collection");
    };
    const engine = new KnowledgeDownloadEngine(transport);
    await engine.initialize(root);

    const source = {
      id: "local-camera-docs",
      name: "Local Camera Docs",
      description: "Offline camera documentation pack.",
      type: "local-documentation" as const,
      location: { kind: "local-path" as const, value: fixture },
      tags: ["camera"],
      status: "approved" as const,
      verification: { verified: true, trustScore: 80, issues: [] as string[], verifiedAt: new Date().toISOString() },
      quality: {
        qualityScore: 82,
        trustScore: 80,
        reputationScore: 70,
        completenessScore: 80,
        freshnessScore: 80,
        confidenceScore: 80,
      },
      license: "Internal",
      version: "1.0.0",
      language: "en" as const,
      domainIds: ["camera-knowledge"],
      registeredAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const pending = await engine.requestDownload(
      {
        topic: "Camera Knowledge",
        sourceId: source.id,
        resourceType: "markdown",
        url: `local://${fixture}`,
        fileName: "camera-fundamentals.md",
        domainId: "camera-knowledge",
        title: "Camera Fundamentals",
        language: "en",
        localSourcePath: fixture,
      },
      source,
      "allow"
    );
    expect(pending.status).toBe("pending-approval");
    expect(pending.title).toBe("Camera Fundamentals");
    expect(pending.domainId).toBe("camera-knowledge");
    expect(pending.trustScore).toBe(80);
    expect(pending.metadataFingerprint).toBeTruthy();

    const completed = await engine.approveDownload(pending.id, source.type);
    expect(completed.status).toBe("completed");
    expect(completed.collectionDate).toBeTruthy();
    expect(completed.localStoragePath).toBeTruthy();

    const slug = domainIdToWorkspaceSlug("camera-knowledge");
    expect(completed.filePath).toBe(path.join(root, slug, "markdown", "camera-fundamentals.md"));
    expect(fs.existsSync(completed.filePath!)).toBe(true);
    expect(fs.readFileSync(completed.filePath!, "utf8")).toContain("Aperture");
  });

  it("blocks duplicate metadata and never stores a second copy", async () => {
    const fixture = path.join(root, "dup.md");
    fs.writeFileSync(fixture, "same doc\n", "utf8");
    const engine = new KnowledgeDownloadEngine(async () => ({ content: Buffer.from("same doc\n") }));
    await engine.initialize(root);

    const source = {
      id: "dup-source",
      name: "Dup Source",
      description: "Duplicate test source.",
      type: "official-documentation" as const,
      location: { kind: "url" as const, value: "https://dup.example.com" },
      tags: [],
      status: "approved" as const,
      verification: { verified: true, trustScore: 90, issues: [] as string[], verifiedAt: new Date().toISOString() },
      quality: null,
      license: "CC-BY-4.0",
      version: "2.0.0",
      registeredAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const request = {
      topic: "Lighting",
      sourceId: source.id,
      resourceType: "markdown" as const,
      url: "https://dup.example.com/doc.md",
      fileName: "lighting.md",
      domainId: "lighting-knowledge",
      title: "Lighting Guide",
      localSourcePath: fixture,
    };

    const first = await engine.requestDownload(request, source, "allow");
    await engine.approveDownload(first.id, source.type);

    const duplicate = await engine.requestDownload(request, source, "allow");
    expect(duplicate.status).toBe("duplicate");
    expect(engine.getStatusReport().duplicateDownloadsBlocked).toBeGreaterThanOrEqual(1);
  });

  it("rejects collection requests for untrusted sources", async () => {
    const engine = new KnowledgeDownloadEngine();
    await engine.initialize(root);
    const pendingSource = {
      id: "pending-source",
      name: "Pending Source",
      description: "Not approved.",
      type: "official-documentation" as const,
      location: { kind: "url" as const, value: "https://pending.example.com" },
      tags: [],
      status: "pending" as const,
      verification: { verified: true, trustScore: 90, issues: [] as string[], verifiedAt: new Date().toISOString() },
      quality: null,
      license: "CC-BY-4.0",
      registeredAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const record = await engine.requestDownload(
      {
        topic: "Marketing",
        sourceId: pendingSource.id,
        resourceType: "documentation",
        url: "https://pending.example.com/doc",
        fileName: "marketing.html",
        domainId: "marketing-knowledge",
      },
      pendingSource,
      "allow"
    );
    expect(record.status).toBe("rejected");
    expect(record.rejectionReason).toMatch(/approved/i);
  });
});
