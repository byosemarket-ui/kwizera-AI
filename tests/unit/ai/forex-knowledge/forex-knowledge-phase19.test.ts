import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createForexKnowledgeService } from "../../../../ai/forex-knowledge/index.js";

const tempDirs: string[] = [];

function tempRoot(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fx-kb-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("Phase 19 Forex Knowledge Base", () => {
  it("supports draft/publish/archive and blocks draft retrieval", async () => {
    const service = createForexKnowledgeService(tempRoot());
    await service.ensureReady();
    const cats = await service.listCategories();
    expect(cats.length).toBeGreaterThan(0);

    const draft = await service.createDocument({
      title: "Understanding Break of Structure",
      summary: "Market structure concept",
      content: "A Break of Structure occurs when price breaks an established market-structure swing and confirms a directional shift.",
      categoryId: cats[0]!.id,
      knowledgeType: "CONCEPT",
      tags: ["bos", "market structure"],
      status: "DRAFT",
    });
    expect(draft.status).toBe("DRAFT");
    expect(draft.indexingStatus).toBe("NOT_INDEXED");

    let hits = await service.retrieveRelevantForexKnowledge({ query: "Break of Structure", limit: 5 });
    expect(hits.every((h) => h.documentId !== draft.id)).toBe(true);

    const published = await service.publishDocument(draft.id);
    expect(published.status).toBe("PUBLISHED");
    expect(published.indexingStatus).toBe("INDEXED");
    expect((await service.listChunks(published.id)).length).toBeGreaterThan(0);

    hits = await service.retrieveRelevantForexKnowledge({ query: "Break of Structure", limit: 5 });
    expect(hits.some((h) => h.documentId === published.id)).toBe(true);

    const updated = await service.updateDocument(published.id, {
      content: "A Break of Structure (BOS) is confirmed only after a decisive close beyond the swing.",
    });
    expect(updated.indexingStatus).toBe("STALE");

    const reindexed = await service.reindexDocument(updated.id);
    expect(reindexed.indexingStatus).toBe("INDEXED");
    hits = await service.retrieveRelevantForexKnowledge({ query: "decisive close beyond the swing", limit: 5 });
    expect(hits.some((h) => h.documentId === reindexed.id && /decisive close/i.test(h.content))).toBe(true);

    const archived = await service.archiveDocument(reindexed.id);
    expect(archived.status).toBe("ARCHIVED");
    hits = await service.retrieveRelevantForexKnowledge({ query: "Break of Structure", limit: 5 });
    expect(hits.every((h) => h.documentId !== archived.id)).toBe(true);
  });

  it("prevents duplicate category slugs and reports overview zeros for empty store stats shape", async () => {
    const service = createForexKnowledgeService(tempRoot());
    await service.ensureReady();
    const overview = await service.getOverview();
    expect(overview.documents).toBe(0);
    expect(overview.published).toBe(0);
    expect(overview.indexed).toBe(0);
    await service.createCategory({ name: "Custom Alpha" });
    await expect(service.createCategory({ name: "Custom Alpha" })).rejects.toThrow(/already exists/i);
  });
});
