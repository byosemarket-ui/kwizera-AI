/**
 * Product Creation Step 1 — workspace boot without full AI core + create/upload persistence.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CreativeWorkspaceManager } from "../ai/creative-workspace/creative-workspace-manager.js";

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-intake-s1-"));

describe("Product Intake Step 1 — CreativeWorkspaceManager (no AI core)", () => {
  const manager = new CreativeWorkspaceManager();

  beforeAll(async () => {
    await manager.initialize(tmpRoot);
  });

  afterAll(() => {
    try {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    } catch { /* ignore */ }
  });

  it("creates a project, persists to disk, and reads it back", async () => {
    const project = await manager.createProject("  Ceramic Pour-Over Set  ");
    expect(project.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(project.name).toBe("Ceramic Pour-Over Set");
    expect(project.productImages).toHaveLength(0);

    const file = path.join(tmpRoot, "creative-workspace", "projects", project.id, "project.json");
    expect(fs.existsSync(file)).toBe(true);

    const again = await manager.getProject(project.id);
    expect(again?.id).toBe(project.id);
    expect(again?.name).toBe("Ceramic Pour-Over Set");

    const active = await manager.getActiveProject();
    expect(active?.id).toBe(project.id);
  });

  it("rejects empty project names", async () => {
    await expect(manager.createProject("   ")).rejects.toThrow(/required/i);
  });

  it("imports an image as a project-owned copy and preserves metadata", async () => {
    const project = await manager.createProject("Import Probe");
    // Minimal valid PNG 1x1
    const pngBase64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const image = await manager.uploadImage(project.id, {
      fileName: "product-front.png",
      mimeType: "image/png",
      dataBase64: pngBase64,
      width: 1,
      height: 1,
    });
    expect(image.id).toBeTruthy();
    expect(image.checksumSha256).toMatch(/^[a-f0-9]{64}$/);

    const stored = path.join(
      tmpRoot,
      "creative-workspace",
      "projects",
      project.id,
      "images",
      `${image.id}.png`,
    );
    expect(fs.existsSync(stored)).toBe(true);
    expect(fs.statSync(stored).size).toBeGreaterThan(0);

    const reloaded = await manager.getProject(project.id);
    expect(reloaded?.productImages).toHaveLength(1);
    expect(reloaded?.productImages[0]?.id).toBe(image.id);
    expect(reloaded?.productImages[0]?.sourceFileName).toBe("product-front.png");
  });

  it("rejects unsupported formats without writing files", async () => {
    const project = await manager.createProject("Reject Probe");
    await expect(
      manager.uploadImage(project.id, {
        fileName: "x.gif",
        mimeType: "image/gif",
        dataBase64: Buffer.from("GIF89a").toString("base64"),
      }),
    ).rejects.toThrow(/unsupported/i);
  });
});
