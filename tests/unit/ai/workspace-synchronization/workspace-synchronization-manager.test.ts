import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { WorkspaceSynchronizationManager } from "../../../../ai/workspace-synchronization/workspace-synchronization-manager.js";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))); });

describe("WorkspaceSynchronizationManager", () => {
  it("keeps local files authoritative, queues changes offline, and records local-wins conflicts", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-workspace-sync-")); roots.push(root);
    await fs.mkdir(path.join(root, "creative-workspace", "projects"), { recursive: true });
    await fs.mkdir(path.join(root, "config"), { recursive: true });
    await fs.writeFile(path.join(root, "creative-workspace", "projects", "launch.json"), '{"name":"Launch"}');
    await fs.writeFile(path.join(root, "config", "studio.json"), '{"offline":true}');

    const manager = new WorkspaceSynchronizationManager();
    await manager.initialize(root);
    const initial = await manager.snapshotLocalWorkspace();
    expect(initial).toHaveLength(2);
    expect(manager.getStatus()).toMatchObject({ localSourceOfTruth: true, cloud: { enabled: false, state: "disabled" }, queuedChanges: 2 });

    const tracked = initial.find((entry) => entry.path === "creative-workspace/projects/launch.json")!;
    const conflict = await manager.detectRemoteConflict({ path: tracked.path, checksum: "remote-revision" });
    expect(conflict).toMatchObject({ path: tracked.path, resolution: "local-wins-pending-upload" });
    expect(manager.getQueuedChanges().some((item) => item.reason === "conflict-local-wins")).toBe(true);

    const result = await manager.synchronize();
    expect(result).toMatchObject({ synchronized: false, queuedChanges: 2 });
    expect(result.reason).toContain("disabled");
  });

  it("delegates archives and tracked workspace copies to existing backup owners", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-workspace-sync-")); roots.push(root);
    await fs.mkdir(path.join(root, "creative-workspace"), { recursive: true });
    await fs.writeFile(path.join(root, "creative-workspace", "workspace.json"), "{}");
    const copied: string[] = []; const recovered: string[] = [];
    const manager = new WorkspaceSynchronizationManager({
      backup: { createManualBackup: async () => ({ backupId: "backup-001", success: true }), restore: async () => ({ success: true, diagnostics: [] }) },
      desktop: { backup: async (_rootId, relativePath) => { copied.push(relativePath); return relativePath === "creative-workspace" ? { id: "desktop-001" } : null; }, recoverBackup: async (backupId) => { recovered.push(backupId); } },
    });
    await manager.initialize(root);
    const created = await manager.createBackup();
    expect(created).toMatchObject({ backupId: "backup-001", archiveCreated: true, workspaceCopyCreated: true });
    expect(copied).toContain("creative-workspace");
    expect(await manager.restoreBackup("backup-001")).toMatchObject({ restored: true });
    expect(recovered).toEqual(["desktop-001"]);
  });
});