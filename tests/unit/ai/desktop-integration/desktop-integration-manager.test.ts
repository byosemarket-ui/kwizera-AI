import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { AiCoreManager } from "../../../../ai/core/ai-core-manager.js";
import { AiDesktopIntegrationManager } from "../../../../ai/desktop-integration/desktop-integration-manager.js";
import type { DesktopPermission } from "../../../../ai/desktop-integration/types.js";
import { AiToolManager } from "../../../../ai/tool-management/tool-manager.js";

const roots: string[] = [];
const permissions: DesktopPermission[] = ["filesystem.read", "filesystem.write", "filesystem.delete", "filesystem.watch", "folder.manage", "project.access", "system.resources.read"];
const core = (): AiCoreManager => ({ registry: { getEntry: () => undefined } } as unknown as AiCoreManager);
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))); });

describe("AiDesktopIntegrationManager", () => {
  it("keeps file operations root-bounded, backed up, recoverable, and integrity checked", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-desktop-")); roots.push(root);
    const tools = new AiToolManager(); await tools.initialize(core(), root);
    const manager = new AiDesktopIntegrationManager(); await manager.initialize(core(), tools, root);
    await manager.files.create("studio", "workspace/note.txt", "first", permissions);
    expect((await manager.files.read("studio", "workspace/note.txt", permissions)).toString()).toBe("first");
    await manager.files.update("studio", "workspace/note.txt", "second", permissions);
    const backup = manager.listBackups().find((item) => item.operation === "update");
    expect(backup).toBeDefined();
    await manager.recoverBackup(backup!.id, permissions);
    expect((await manager.files.read("studio", "workspace/note.txt", permissions)).toString()).toBe("first");
    expect(await manager.files.verifyIntegrity("studio", "workspace/note.txt", permissions)).toMatchObject({ algorithm: "sha256", sizeBytes: 5 });
    expect((await manager.files.search("studio", "workspace", "note", permissions)).map((item) => item.relativePath)).toContain("workspace/note.txt");
    await expect(manager.files.create("studio", "workspace/../../outside.txt", "blocked", permissions)).rejects.toThrow("Path escapes registered root");

    await manager.files.create("studio", "projects/important.json", "{}", permissions);
    await expect(manager.files.delete("studio", "projects/important.json", permissions)).rejects.toThrow("filesystem.critical-delete");
    await manager.files.delete("studio", "workspace/note.txt", permissions);
    expect(manager.listBackups().length).toBeGreaterThanOrEqual(2);
    expect((await manager.monitorResources()).operatingSystem.platform).toBe(process.platform);
    expect(manager.getStatus()).toMatchObject({ initialized: true, rootCount: 1 });
    await manager.shutdown();
    expect(manager.getStatus().initialized).toBe(false);
  });
});