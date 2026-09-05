/**
 * STEP 13 — Product image intake repair: originals-only hydrate semantics,
 * card URL preference, unclassified views, MIME content types, isolation.
 */
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CreativeWorkspaceManager } from "../../../../ai/creative-workspace/creative-workspace-manager.js";
import {
  isOriginalProductImage,
  listOriginalProductImages,
} from "../../../../ai/creative-workspace/project-asset.js";
import { fingerprintFile, sha256File } from "../../../../desktop/product-intake/hash.ts";
import { validateLocalFile } from "../../../../desktop/product-intake/validation.ts";
import type { IntakeAssetMeta, IntakeSnapshot } from "../../../../desktop/product-intake/types.ts";
import { buildImageCards } from "../../../../desktop/product-setup/readiness.ts";
import { confidenceLabel, viewDisplayLabel } from "../../../../desktop/product-setup/view-labels.ts";
import type { OrganizationSnapshot } from "../../../../desktop/image-organization/types.ts";

const PNG_1X1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const PNG_RED =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwEFHwGaAAAAAElFTkSuQmCC";

const storageRoots: string[] = [];

afterEach(async () => {
  await Promise.all(storageRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

function fakeFile(name: string, type: string, bytes: Uint8Array): File {
  return new File([bytes], name, { type });
}

function baseIntake(assets: IntakeAssetMeta[]): IntakeSnapshot {
  return {
    version: 1,
    projectId: "proj-1",
    projectName: "Step13",
    assets,
    queue: [],
    progress: {
      total: 0, completed: 0, failed: 0, cancelled: 0, percent: 100,
      running: false, paused: false, remaining: 0, statusLabel: "Idle",
      bytesPerSecond: 0, currentFile: null,
    },
    canContinue: true,
    continueBlockedReason: null,
    handoffReady: false,
    recommendation: "",
    updatedAt: new Date().toISOString(),
  };
}

const emptyOrg = (): OrganizationSnapshot => ({
  version: 1,
  projectId: "proj-1",
  projectName: "Step13",
  progress: {
    total: 0, completed: 0, percent: 100, running: false,
    currentFile: null, currentClassification: "UNKNOWN", currentConfidence: 0, statusLabel: "Idle",
  },
  productImageSet: null,
  canContinue: false,
  continueBlockedReason: null,
  handoffReady: false,
  recommendation: "",
  updatedAt: new Date().toISOString(),
});

describe("STEP 13 — originals vs derived in gallery", () => {
  it("filters derived thumbnails out of product image cards source list", () => {
    const images = [
      { id: "o1", fileName: "shoe.jpg", mimeType: "image/jpeg", origin: "upload" as const },
      {
        id: "t1", fileName: "shoe-thumb.webp", mimeType: "image/webp",
        origin: "derived" as const, parentAssetId: "o1", derivedKind: "thumbnail" as const,
      },
      {
        id: "v1", fileName: "product-video.mp4", mimeType: "video/mp4",
        origin: "generated" as const, assetType: "video" as const,
      },
    ];
    const originals = listOriginalProductImages(images);
    expect(originals).toHaveLength(1);
    expect(originals[0]!.id).toBe("o1");
    expect(isOriginalProductImage(images[1]!)).toBe(false);
  });
});

describe("STEP 13 — card URL + view metadata", () => {
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

  it("prefers local preview while handoff is pending", () => {
    const cards = buildImageCards(baseIntake([{
      assetId: "a1",
      clientKey: "ck1",
      projectId: "proj-1",
      originalFilename: "front.jpg",
      fileType: "image/jpeg",
      width: 800,
      height: 600,
      fileSize: 1000,
      importDate: new Date().toISOString(),
      sourceReference: "x",
      validationStatus: "valid",
      duplicateStatus: "none",
      processingStatus: "saved",
      checksum: "abc",
      warnings: [],
      remoteUrl: "/api/projects/p/images/a1",
      thumbnailUrl: "/api/projects/p/images/a1",
      localPreviewUrl: "blob:local-preview",
      previewConfirmed: false,
    }]), emptyOrg());
    expect(cards).toHaveLength(1);
    expect(cards[0]!.url).toBe("blob:local-preview");
    expect(cards[0]!.usingLocalPreview).toBe(true);
    expect(cards[0]!.clientKey).toBe("ck1");
    expect(cards[0]!.displayLabel).toBe("Unclassified");
    expect(cards[0]!.needsReview).toBe(false);
  });

  it("does not mark saved-but-unanalyzed images as needs review", () => {
    const cards = buildImageCards(baseIntake([{
      assetId: "a1",
      projectId: "proj-1",
      originalFilename: "front.jpg",
      fileType: "image/jpeg",
      width: 800,
      height: 600,
      fileSize: 1000,
      importDate: new Date().toISOString(),
      sourceReference: "x",
      validationStatus: "valid",
      duplicateStatus: "none",
      processingStatus: "saved",
      checksum: "abc",
      warnings: [],
      remoteUrl: "/api/img",
      thumbnailUrl: "/api/img",
      previewConfirmed: true,
    }]), emptyOrg());
    expect(cards[0]!.needsReview).toBe(false);
    expect(cards[0]!.finalViewType).toBe("UNKNOWN");
    expect(viewDisplayLabel("UNKNOWN")).toBe("Unclassified");
    expect(confidenceLabel(0)).toBe("Unclassified");
  });

  it("rejects zero-byte and unsupported files", async () => {
    const empty = fakeFile("empty.jpg", "image/jpeg", new Uint8Array(0));
    const bad = await validateLocalFile(empty, []);
    expect(bad.ok).toBe(false);

    const txt = fakeFile("notes.txt", "text/plain", new TextEncoder().encode("hi"));
    const unsupported = await validateLocalFile(txt, []);
    expect(unsupported.ok).toBe(false);
  });

  it("keeps different content with the same filename as separate checksums", async () => {
    const a = fakeFile("product.png", "image/png", Buffer.from(PNG_1X1, "base64"));
    const b = fakeFile("product.png", "image/png", Buffer.from(PNG_RED, "base64"));
    const ha = await sha256File(a);
    const hb = await sha256File(b);
    expect(ha).not.toBe(hb);
    expect(await fingerprintFile(a)).not.toBe(await fingerprintFile(b));
  });
});

describe("STEP 13 — server upload isolation + dedupe", () => {
  it("project A and B stay isolated; duplicate content reuses one asset per project", async () => {
    const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-step13-"));
    storageRoots.push(storageRoot);
    const workspace = new CreativeWorkspaceManager();
    await workspace.initialize(storageRoot);
    const projectA = await workspace.createProject("STEP13-A");
    const projectB = await workspace.createProject("STEP13-B");

    const dataA = PNG_1X1;
    const dataB = PNG_RED;
    const a1 = await workspace.uploadImage(projectA.id, {
      fileName: "shared-name.png",
      mimeType: "image/png",
      dataBase64: dataA,
    });
    const aDup = await workspace.uploadImage(projectA.id, {
      fileName: "shared-name-again.png",
      mimeType: "image/png",
      dataBase64: dataA,
    });
    expect(aDup.id).toBe(a1.id);
    expect(aDup.reused).toBe(true);

    const b1 = await workspace.uploadImage(projectB.id, {
      fileName: "shared-name.png",
      mimeType: "image/png",
      dataBase64: dataB,
    });
    expect(b1.id).not.toBe(a1.id);

    const reA = await workspace.getProject(projectA.id);
    const reB = await workspace.getProject(projectB.id);
    const origA = listOriginalProductImages(reA?.productImages ?? []);
    const origB = listOriginalProductImages(reB?.productImages ?? []);
    expect(origA).toHaveLength(1);
    expect(origB).toHaveLength(1);
    expect(origA[0]!.checksumSha256).toBe(
      createHash("sha256").update(Buffer.from(dataA, "base64")).digest("hex"),
    );
    expect(origB[0]!.checksumSha256).toBe(
      createHash("sha256").update(Buffer.from(dataB, "base64")).digest("hex"),
    );
    expect(origA[0]!.id).not.toBe(origB[0]!.id);
  });

  it("same filename different bytes produces two assets in one project", async () => {
    const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-step13-fn-"));
    storageRoots.push(storageRoot);
    const workspace = new CreativeWorkspaceManager();
    await workspace.initialize(storageRoot);
    const project = await workspace.createProject("STEP13-SameName");
    const first = await workspace.uploadImage(project.id, {
      fileName: "product.png",
      mimeType: "image/png",
      dataBase64: PNG_1X1,
    });
    const second = await workspace.uploadImage(project.id, {
      fileName: "product.png",
      mimeType: "image/png",
      dataBase64: PNG_RED,
    });
    expect(second.id).not.toBe(first.id);
    expect(second.reused).toBeFalsy();
    const reloaded = await workspace.getProject(project.id);
    expect(listOriginalProductImages(reloaded?.productImages ?? [])).toHaveLength(2);
  });
});
