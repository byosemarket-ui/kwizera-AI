import { describe, expect, it, beforeEach, vi } from "vitest";
import { classifyFormat, formatRejectionMessage, extensionOf, resolveMimeType } from "../../../desktop/product-intake/formats.ts";
import { fingerprintFile } from "../../../desktop/product-intake/hash.ts";
import { validateLocalFile } from "../../../desktop/product-intake/validation.ts";
import { IntakeImportQueue } from "../../../desktop/product-intake/queue.ts";
import { saveHandoff, loadHandoff, saveProjectMeta, loadProjectMeta } from "../../../desktop/product-intake/api.ts";
import type { IntakeAssetMeta } from "../../../desktop/product-intake/types.ts";

function mockStorage() {
  const store: Record<string, string> = {};
  vi.stubGlobal("localStorage", {
    getItem(key: string) { return store[key] ?? null; },
    setItem(key: string, value: string) { store[key] = value; },
    removeItem(key: string) { delete store[key]; },
  });
}

function fakeFile(name: string, type: string, size: number, bytes?: Uint8Array): File {
  const data = bytes ?? new Uint8Array(Math.max(1, Math.min(size, 64)));
  return new File([data], name, { type });
}

describe("Formats", () => {
  it("accepts supported formats and rejects future/unsupported", () => {
    expect(classifyFormat(fakeFile("a.jpg", "image/jpeg", 10))).toBe("supported");
    expect(classifyFormat(fakeFile("a.png", "image/png", 10))).toBe("supported");
    expect(classifyFormat(fakeFile("a.webp", "image/webp", 10))).toBe("supported");
    expect(classifyFormat(fakeFile("a.tiff", "image/tiff", 10))).toBe("supported");
    expect(classifyFormat(fakeFile("a.bmp", "image/bmp", 10))).toBe("supported");
    expect(classifyFormat(fakeFile("a.svg", "image/svg+xml", 10))).toBe("future");
    expect(classifyFormat(fakeFile("a.gif", "image/gif", 10))).toBe("unsupported");
    expect(formatRejectionMessage(fakeFile("x.gif", "image/gif", 1))).toContain("unsupported");
    expect(extensionOf("Front.JPEG")).toBe("jpeg");
    expect(resolveMimeType(fakeFile("x.bmp", "", 1))).toBe("image/bmp");
  });
});

describe("Fingerprint & validation", () => {
  beforeEach(() => {
    mockStorage();
    // Image() may be unavailable — stub dimensions via prototype if needed
    class FakeImage {
      naturalWidth = 1200;
      naturalHeight = 900;
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

  it("fingerprints files stably and detects duplicates", async () => {
    const bytes = new Uint8Array(128).map((_, i) => i);
    const a = fakeFile("front.jpg", "image/jpeg", 128, bytes);
    const b = fakeFile("front.jpg", "image/jpeg", 128, bytes);
    const ha = await fingerprintFile(a);
    const hb = await fingerprintFile(b);
    expect(ha).toBe(hb);

    const first = await validateLocalFile(a, []);
    expect(first.ok).toBe(true);
    expect(first.status).toBe("valid");

    const existing: IntakeAssetMeta[] = [{
      assetId: "1",
      projectId: "p",
      originalFilename: "front.jpg",
      fileType: "image/jpeg",
      width: 1200,
      height: 900,
      fileSize: 128,
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
  });

  it("rejects unsupported and empty files", async () => {
    const bad = await validateLocalFile(fakeFile("x.gif", "image/gif", 10), []);
    expect(bad.ok).toBe(false);
    expect(bad.critical).toBe(true);

    const empty = await validateLocalFile(fakeFile("e.png", "image/png", 0, new Uint8Array(0)), []);
    expect(empty.ok).toBe(false);
  });

  it("warns on low resolution", async () => {
    class TinyImage {
      naturalWidth = 120;
      naturalHeight = 80;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_v: string) { queueMicrotask(() => this.onload?.()); }
    }
    vi.stubGlobal("Image", TinyImage as unknown as typeof Image);
    const result = await validateLocalFile(fakeFile("tiny.jpg", "image/jpeg", 40), []);
    expect(result.ok).toBe(true);
    expect(result.warnings.some((w) => w.code === "low-resolution")).toBe(true);
  });
});

describe("Import queue", () => {
  it("supports pause resume retry cancel without dropping completed", () => {
    const q = new IntakeImportQueue();
    const a = q.enqueue("a.jpg", 10, "image/jpeg");
    const b = q.enqueue("b.jpg", 10, "image/jpeg");
    q.update(a.id, { status: "completed", progress: 100 });
    q.pause();
    expect(q.list().find((i) => i.id === b.id)?.status).toBe("paused");
    q.resume();
    expect(q.nextPending()?.id).toBe(b.id);
    q.update(b.id, { status: "failed" });
    q.cancelAll();
    expect(q.list().find((i) => i.id === a.id)?.status).toBe("completed");
    const progress = q.progress(0, null);
    expect(progress.total).toBe(2);
  });
});

describe("Metadata & handoff persistence", () => {
  beforeEach(() => mockStorage());

  it("persists metadata and step-2 handoff without losing assets", () => {
    const assets: IntakeAssetMeta[] = [{
      assetId: "img-1",
      projectId: "proj-1",
      originalFilename: "front.jpg",
      fileType: "image/jpeg",
      width: 1000,
      height: 800,
      fileSize: 2048,
      importDate: new Date().toISOString(),
      sourceReference: "creative-workspace",
      validationStatus: "valid",
      duplicateStatus: "none",
      processingStatus: "saved",
      checksum: "abc",
      warnings: [],
      localPreviewUrl: "blob:should-strip",
    }];
    saveProjectMeta("proj-1", assets);
    const loaded = loadProjectMeta("proj-1");
    expect(loaded[0]?.assetId).toBe("img-1");
    expect(loaded[0]?.localPreviewUrl).toBeUndefined();

    saveHandoff({
      version: 1,
      step: "step-2-image-organization",
      projectId: "proj-1",
      projectName: "Demo",
      assets: loaded,
      preparedAt: new Date().toISOString(),
    });
    expect(loadHandoff()?.projectId).toBe("proj-1");
    expect(loadHandoff()?.step).toBe("step-2-image-organization");
  });
});
