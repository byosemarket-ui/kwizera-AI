import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AiLocalAssetLibraryEngine } from "../../../../ai/local-asset-library/index.js";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map(async (root) => {
      try {
        await fs.rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      } catch {
        /* ignore */
      }
    }),
  );
});

describe("AiLocalAssetLibraryEngine (Platform Step 2)", () => {
  it("imports, tags, NL-searches, versions, and detects duplicates without overwriting originals", async () => {
    const root = path.join(os.tmpdir(), `kwizera-lal-${Date.now()}`);
    roots.push(root);
    await fs.mkdir(root, { recursive: true });
    const engine = new AiLocalAssetLibraryEngine();
    engine.initialize(root);

    const fixtures = path.join(root, "fixtures");
    await fs.mkdir(fixtures, { recursive: true });
    const shoe = path.join(fixtures, "black-shoe-studio_1920x1080.jpg");
    const shoeDup = path.join(fixtures, "black-shoe-copy.jpg");
    const edited = path.join(fixtures, "black-shoe-edited.jpg");
    await fs.writeFile(shoe, "unit-shoe-bytes", "utf8");
    await fs.writeFile(shoeDup, "unit-shoe-bytes", "utf8");
    await fs.writeFile(edited, "unit-shoe-edited", "utf8");

    const imported = engine.importAsset({
      filePath: shoe,
      assetName: "Black Shoe Studio Photo",
      category: "shoes",
      productName: "Runner",
      manualTags: ["hero"],
    });
    expect(imported.tags).toEqual(expect.arrayContaining(["shoes", "black", "studio", "hero"]));
    expect(imported.resolution).toBe("1920x1080");

    const hits = engine.search({ naturalLanguage: "Find all black shoe photos." });
    expect(hits.some((a) => a.assetId === imported.assetId)).toBe(true);

    engine.importAsset({ filePath: shoeDup, assetName: "Dup Shoe" });
    expect(engine.detectDuplicates().length).toBeGreaterThanOrEqual(1);

    const versioned = engine.createVersion(imported.assetId, "edited", edited);
    expect(versioned.filePath).not.toBe(imported.filePath);
    expect(await fs.access(imported.filePath).then(() => true).catch(() => false)).toBe(true);
    expect(engine.getVersions(imported.assetId).length).toBeGreaterThanOrEqual(2);

    const awareness = engine.getAiMeAwareness();
    expect(awareness.singleUserOnly).toBe(true);
    expect(awareness.localProductionQueueDeferred).toBe(false);
    expect(awareness.canNaturalLanguageSearch).toBe(true);

    const health = engine.runQualityAssurance();
    expect(health.criticalIssues).toHaveLength(0);
  });
});
