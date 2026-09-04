/**
 * STEP 5 — product image intake: dedupe, idempotency, queue concurrency.
 */
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CreativeWorkspaceManager } from "../../../../ai/creative-workspace/creative-workspace-manager.js";
import { fingerprintFile, isSha256Hex, sha256File } from "../../../../desktop/product-intake/hash.ts";
import { INTAKE_UPLOAD_CONCURRENCY, IntakeImportQueue } from "../../../../desktop/product-intake/queue.ts";
import { validateLocalFile } from "../../../../desktop/product-intake/validation.ts";
import type { IntakeAssetMeta } from "../../../../desktop/product-intake/types.ts";

const PNG_1X1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const storageRoots: string[] = [];

afterEach(async () => {
  await Promise.all(storageRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

function fakeFile(name: string, type: string, bytes: Uint8Array): File {
  return new File([bytes], name, { type });
}

describe("STEP 5 product image intake", () => {
  beforeEach(() => {
    class FakeImage {
      naturalWidth = 800;
      naturalHeight = 600;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_v: string) { queueMicrotask(() => this.onload?.()); }
    }
    vi.stubGlobal("Image", FakeImage as unknown as typeof Image);
    vi.stubGlobal("URL", {
      createObjectURL: () => "blob:mock",
      revokeObjectURL: () => undefined,
    });
  });

  it("TEST A/C — SHA-256 checksum is stable and detects duplicates without uploading twice on client", async () => {
    const bytes = Buffer.from(PNG_1X1, "base64");
    const a = fakeFile("lamp.png", "image/png", bytes);
    const b = fakeFile("lamp.png", "image/png", bytes);
    const ha = await sha256File(a);
    const hb = await sha256File(b);
    expect(isSha256Hex(ha)).toBe(true);
    expect(ha).toBe(hb);

    const first = await validateLocalFile(a, []);
    expect(first.ok).toBe(true);
    expect(first.status).not.toBe("duplicate");

    const existing: IntakeAssetMeta[] = [{
      assetId: "asset-1",
      projectId: "p1",
      originalFilename: "lamp.png",
      fileType: "image/png",
      width: 800,
      height: 600,
      fileSize: bytes.length,
      importDate: new Date().toISOString(),
      sourceReference: "x",
      validationStatus: "valid",
      duplicateStatus: "none",
      processingStatus: "saved",
      checksum: first.checksum,
      warnings: [],
    }];
    const dup = await validateLocalFile(b, existing);
    expect(dup.status).toBe("duplicate");
    expect(dup.duplicateOf?.assetId).toBe("asset-1");
  });

  it("TEST D — server upload is idempotent for same content in same project", async () => {
    const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-step5-intake-"));
    storageRoots.push(storageRoot);
    const workspace = new CreativeWorkspaceManager();
    await workspace.initialize(storageRoot);
    const project = await workspace.createProject("STEP5-Intake-A");
    const dataBase64 = PNG_1X1;
    const first = await workspace.uploadImage(project.id, {
      fileName: "a.png",
      mimeType: "image/png",
      dataBase64,
    });
    const second = await workspace.uploadImage(project.id, {
      fileName: "a-again.png",
      mimeType: "image/png",
      dataBase64,
    });
    expect(second.id).toBe(first.id);
    expect(second.reused).toBe(true);
    const reloaded = await workspace.getProject(project.id);
    const originals = (reloaded?.productImages ?? []).filter((img) => !img.parentAssetId && img.origin !== "derived");
    expect(originals).toHaveLength(1);
    expect(originals[0]!.checksumSha256).toBe(createHash("sha256").update(Buffer.from(dataBase64, "base64")).digest("hex"));
  });

  it("TEST G/N — same bytes in different projects stay isolated", async () => {
    const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-step5-iso-"));
    storageRoots.push(storageRoot);
    const workspace = new CreativeWorkspaceManager();
    await workspace.initialize(storageRoot);
    const a = await workspace.createProject("Proj-A");
    const b = await workspace.createProject("Proj-B");
    const imgA = await workspace.uploadImage(a.id, { fileName: "x.png", mimeType: "image/png", dataBase64: PNG_1X1 });
    const imgB = await workspace.uploadImage(b.id, { fileName: "x.png", mimeType: "image/png", dataBase64: PNG_1X1 });
    expect(imgA.id).not.toBe(imgB.id);
    expect(imgA.projectId).toBe(a.id);
    expect(imgB.projectId).toBe(b.id);
    const projA = await workspace.getProject(a.id);
    const projB = await workspace.getProject(b.id);
    expect(projA?.productImages.some((i) => i.id === imgB.id)).toBe(false);
    expect(projB?.productImages.some((i) => i.id === imgA.id)).toBe(false);
  });

  it("TEST H — queue claims are atomic and concurrency is capped", () => {
    expect(INTAKE_UPLOAD_CONCURRENCY).toBeGreaterThanOrEqual(1);
    expect(INTAKE_UPLOAD_CONCURRENCY).toBeLessThanOrEqual(3);
    const queue = new IntakeImportQueue();
    queue.enqueue("a.png", 10, "image/png");
    queue.enqueue("b.png", 10, "image/png");
    queue.enqueue("c.png", 10, "image/png");
    const first = queue.claimNext();
    const second = queue.claimNext();
    const third = queue.claimNext();
    const fourth = queue.claimNext();
    expect(first?.fileName).toBe("a.png");
    expect(second?.fileName).toBe("b.png");
    expect(third?.fileName).toBe("c.png");
    expect(fourth).toBeNull();
    expect(new Set([first!.id, second!.id, third!.id]).size).toBe(3);
  });

  it("keeps FNV fingerprint available as fallback helper", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const file = fakeFile("tiny.bin", "application/octet-stream", bytes);
    const fp = await fingerprintFile(file);
    expect(fp.startsWith("fnv1a-")).toBe(true);
  });
});
