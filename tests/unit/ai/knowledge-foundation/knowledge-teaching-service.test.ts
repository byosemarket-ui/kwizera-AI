import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PersistentMemoryCenter } from "../../../../dev/server/persistent-memory-center.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map(async (root) => {
    try {
      await fs.rm(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
    } catch { /* ignore */ }
  }));
});

describe("KWIZERA knowledge teaching (Persistent Memory Center / same knowledge disk)", () => {
  it("validates teach input and rejects corrupt payloads", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-teach-val-"));
    roots.push(root);
    const center = new PersistentMemoryCenter();
    await center.boot(root);

    const missing = await center.saveKnowledge({ title: "", topic: "", content: "short" });
    expect(missing.success).toBe(false);
    expect((missing as { validation?: { message?: string } }).validation?.message).toMatch(/INVALID_KNOWLEDGE/i);

    const projectMissing = await center.saveKnowledge({
      title: "Scoped",
      topic: "scoped-topic",
      content: "Rule: Project knowledge must include a project identifier for isolation.",
      scope: "project",
    });
    expect(projectMissing.success).toBe(false);
    expect((projectMissing as { validation?: { message?: string } }).validation?.message).toMatch(/projectId/i);
  });

  it("stores permanent vs project knowledge separately and persists across restart", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-teach-scope-"));
    roots.push(root);
    const center = new PersistentMemoryCenter();
    await center.boot(root);

    const permanent = await center.saveKnowledge({
      title: "Permanent studio rule",
      topic: "studio lighting",
      content: "Always balance soft key and fill for reflective products in KWIZERA studio workflows.",
      scope: "permanent",
    });
    expect(permanent.success || permanent.action === "updated").toBe(true);

    const projectOnly = await center.saveKnowledge({
      title: "Project Alpha tip",
      topic: "campaign alpha",
      content: "Project Alpha must keep the logo centered in every export frame for this campaign.",
      scope: "project",
      projectId: "alpha-1",
    });
    expect(projectOnly.success || projectOnly.action === "updated").toBe(true);

    const otherProject = await center.saveKnowledge({
      title: "Project Beta tip",
      topic: "campaign beta",
      content: "Project Beta must emphasize shoe sole texture in every hero frame.",
      scope: "project",
      projectId: "beta-2",
    });
    expect(otherProject.success || otherProject.action === "updated").toBe(true);

    const globalOnly = await center.searchKnowledge({ text: "soft key reflective", permanentOnly: true });
    expect(globalOnly.some((r) => r.knowledgeId === permanent.knowledgeId)).toBe(true);
    expect(globalOnly.some((r) => r.knowledgeId === projectOnly.knowledgeId)).toBe(false);

    const alpha = await center.searchKnowledge({ text: "logo centered", projectId: "alpha-1" });
    expect(alpha.some((r) => r.knowledgeId === projectOnly.knowledgeId)).toBe(true);
    expect(alpha.some((r) => r.knowledgeId === otherProject.knowledgeId)).toBe(false);

    const alphaWithGlobal = await center.searchKnowledge({ text: "soft key", projectId: "alpha-1" });
    expect(alphaWithGlobal.some((r) => r.knowledgeId === permanent.knowledgeId)).toBe(true);
    expect(alphaWithGlobal.some((r) => r.knowledgeId === projectOnly.knowledgeId)).toBe(false);

    const center2 = new PersistentMemoryCenter();
    await center2.boot(root);
    const afterRestart = await center2.searchKnowledge({ text: "reflective products", permanentOnly: true });
    expect(afterRestart.some((r) => r.knowledgeId === permanent.knowledgeId)).toBe(true);
  });
});
