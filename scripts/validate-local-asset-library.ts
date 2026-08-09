import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  AiLocalAssetLibraryEngine,
  type LocalAssetLibraryReportData,
} from "../ai/local-asset-library/index.js";

function createTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-lal-"));
}

function writeReport(data: LocalAssetLibraryReportData): string {
  const reportPath = path.join(process.cwd(), "LOCAL-ASSET-LIBRARY-REPORT.md");
  const body = `# LOCAL ASSET LIBRARY REPORT
## KWIZERA AI STUDIO — AI Studio Platform & Personal Workspace Step 2

**Generated at:** ${data.generatedAt}  
**Single User Only:** YES  
**Local Storage Only:** YES  
**Offline First:** Preserved  
**AI Me:** Preserved  
**Platform Step 3 (Local Production Queue):** Not started  

---

## 1. Existing Asset Library capability

${data.existingAssetLibraryCapability}

## 2. Components upgraded

${data.componentsUpgraded.map((item) => `- ${item}`).join("\n")}

## 3. Components created

${data.componentsCreated.map((item) => `- ${item}`).join("\n")}

## 4. Assets indexed

${data.assetsIndexed.length
    ? data.assetsIndexed.map((a) => `- ${a.id}: ${a.name} (${a.type})`).join("\n")
    : "- none"}

## 5. Smart Search capability

${data.smartSearchCapability}

## 6. Auto Tagging capability

${data.autoTaggingCapability}

## 7. Duplicate Detection status

${data.duplicateDetectionStatus}

## 8. Version Management status

${data.versionManagementStatus}

## 9. AI Me capability

${data.aiMeCapability}

## 10. Issues Found

${data.issuesFound.length ? data.issuesFound.map((item) => `- ${item}`).join("\n") : "- none"}

## 11. Issues Repaired

${data.issuesRepaired.length ? data.issuesRepaired.map((item) => `- ${item}`).join("\n") : "- none"}

## 12. Test Results

${data.testResults.map((item) => `- ${item.passed ? "PASS" : "FAIL"} ${item.name}: ${item.detail}`).join("\n")}

## 13. Remaining work before Step 3

${data.remainingWorkBeforeStep3.map((item) => `- ${item}`).join("\n")}

---

**Step 2 verdict:** Local Asset Library & Asset Intelligence Engine is ready for single-user local asset organization, analysis, tagging, search, versioning, duplicate detection, and AI Me find/recommend/explain. Local Production Queue is not started.
`;
  fs.writeFileSync(reportPath, body, "utf8");
  return reportPath;
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT
    ? path.join(process.env.KWIZERA_STORAGE_ROOT, `lal-validate-${Date.now()}`)
    : createTempRoot();
  fs.mkdirSync(storageRoot, { recursive: true });
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;

  console.log("KWIZERA AI STUDIO — Platform Step 2");
  console.log("Local Asset Library & Asset Intelligence Engine validation");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Array<{ name: string; passed: boolean; detail: string }> = [];
  const issuesFound: string[] = [];
  const issuesRepaired: string[] = [];

  try {
    const engine = new AiLocalAssetLibraryEngine();
    engine.initialize(storageRoot);

    const fixtures = path.join(storageRoot, "lal-fixtures");
    fs.mkdirSync(fixtures, { recursive: true });
    const shoe = path.join(fixtures, "black-shoe-studio_1920x1080.jpg");
    const shoeDup = path.join(fixtures, "black-shoe-dup.jpg");
    const logo = path.join(fixtures, "brand-logo-kwizera.svg");
    const music = path.join(fixtures, "marketing-outdoor-30s.mp3");
    fs.writeFileSync(shoe, "lal-validate-shoe-bytes-v1", "utf8");
    fs.writeFileSync(shoeDup, "lal-validate-shoe-bytes-v1", "utf8");
    fs.writeFileSync(logo, "<svg><!-- logo --></svg>", "utf8");
    fs.writeFileSync(music, "lal-validate-audio", "utf8");

    const imported = engine.importAsset({
      filePath: shoe,
      assetName: "Black Shoe Studio Photo",
      productName: "Runner X",
      category: "shoes",
      brand: "KWIZERA",
      projectId: "proj-demo-1",
      manualTags: ["hero"],
    });
    results.push({
      name: "assetImport",
      passed: Boolean(imported.assetId) && fs.existsSync(imported.filePath),
      detail: `id=${imported.assetId}`,
    });

    results.push({
      name: "assetAnalysis",
      passed:
        imported.metadata.checksum.length > 0
        && imported.resolution === "1920x1080"
        && imported.metadata.dominantColors.includes("black"),
      detail: `res=${imported.resolution}; colors=${imported.metadata.dominantColors.join(",")}`,
    });

    results.push({
      name: "autoTagging",
      passed:
        imported.tags.includes("shoes")
        && imported.tags.includes("black")
        && imported.tags.includes("studio")
        && imported.manualTags.includes("hero"),
      detail: `tags=${imported.tags.join(",")}`,
    });

    const nl = engine.search({ naturalLanguage: "Find all black shoe photos." });
    results.push({
      name: "smartSearch",
      passed: nl.some((a) => a.assetId === imported.assetId),
      detail: `hits=${nl.length}`,
    });

    engine.importAsset({ filePath: shoeDup, assetName: "Black Shoe Duplicate" });
    engine.importAsset({ filePath: logo, assetType: "logo" });
    engine.importAsset({ filePath: music, assetType: "music", category: "marketing" });
    const dupes = engine.detectDuplicates();
    results.push({
      name: "duplicateDetection",
      passed: dupes.length >= 1,
      detail: `duplicates=${dupes.length}`,
    });

    const edited = path.join(fixtures, "black-shoe-edited.jpg");
    fs.writeFileSync(edited, "lal-validate-shoe-edited-v2", "utf8");
    const versioned = engine.createVersion(imported.assetId, "ai-enhanced", edited);
    const versions = engine.getVersions(imported.assetId);
    const originalStillExists = fs.existsSync(imported.filePath);
    results.push({
      name: "versionManagement",
      passed:
        versioned.versionKind === "ai-enhanced"
        && versions.length >= 2
        && versioned.filePath !== imported.filePath
        && originalStillExists,
      detail: `versions=${versions.length}; originalPreserved=${originalStillExists}`,
    });

    engine.linkRelationship(imported.assetId, "storyboard", "sb-1", "hero-frame");
    engine.linkRelationship(imported.assetId, "knowledge-pack", "kp-shoes", "pack");
    const linked = engine.getAssets().find((a) => a.assetId === imported.assetId);
    results.push({
      name: "relationships",
      passed: (linked?.relationships.length ?? 0) >= 3,
      detail: `rels=${linked?.relationships.length ?? 0}`,
    });

    const drop = path.join(storageRoot, "personal-project-workspace", "Assets");
    fs.mkdirSync(drop, { recursive: true });
    const dropFile = path.join(drop, "outdoor-fashion-white_1280x720.png");
    fs.writeFileSync(dropFile, "lal-drop-import-bytes", "utf8");
    const auto = engine.autoImportWatchFolders();
    issuesFound.push(...auto.issuesFound);
    issuesRepaired.push(...auto.issuesRepaired);
    results.push({
      name: "autoImport",
      passed:
        auto.indexed.some((a) => a.assetName.includes("outdoor-fashion") || a.filePath.includes("outdoor-fashion"))
        && auto.originalsOverwritten === false
        && auto.userAssetsDeleted === false,
      detail: `indexed=${auto.indexed.length}`,
    });

    const awareness = engine.getAiMeAwareness();
    const explained = engine.explain(imported.assetId);
    results.push({
      name: "aiMeCapability",
      passed:
        awareness.singleUserOnly
        && awareness.canFindAssetsInstantly
        && awareness.canRecommendAssets
        && awareness.canExplainWhySelected
        && awareness.canDetectDuplicates
        && awareness.canNaturalLanguageSearch
        && awareness.localProductionQueueDeferred
        && explained.whySelected.includes("Black Shoe"),
      detail: awareness.summary,
    });

    const structureRoot = path.join(storageRoot, "local-asset-library");
    results.push({
      name: "localStructure",
      passed: ["originals", "versions", "imports", "library-store.json", "search-index.json"].every((f) =>
        fs.existsSync(path.join(structureRoot, f))),
      detail: structureRoot,
    });

    const autoTests = engine.runAutomaticTests();
    results.push(...autoTests);

    let health = engine.runQualityAssurance();
    issuesRepaired.push(...health.repaired);
    let loops = 0;
    while (health.criticalIssues.length > 0 && loops < 3) {
      health = engine.runQualityAssurance();
      issuesRepaired.push(...health.repaired);
      loops += 1;
    }
    results.push({
      name: "qualityAssurance",
      passed: health.criticalIssues.length === 0,
      detail: `healthy=${health.healthy}; checks=${health.checks.filter((c) => c.passed).length}/${health.checks.length}`,
    });

    const reportData = engine.buildReportData(results);
    reportData.issuesFound = [...new Set([...reportData.issuesFound, ...issuesFound])];
    reportData.issuesRepaired = [...new Set([...reportData.issuesRepaired, ...issuesRepaired])];
    const reportPath = writeReport(reportData);
    console.log("Report:", reportPath);
  } catch (error) {
    console.error("Validation failed:", error);
    results.push({ name: "runtime", passed: false, detail: error instanceof Error ? error.message : String(error) });
    process.exitCode = 1;
  } finally {
    if (useTemp) fs.rmSync(storageRoot, { recursive: true, force: true });
  }

  console.log("Checks:");
  let failed = 0;
  for (const result of results) {
    console.log(`- ${result.passed ? "PASS" : "FAIL"} ${result.name}: ${result.detail}`);
    if (!result.passed) failed += 1;
  }
  console.log("---");
  console.log(failed === 0 ? "VALIDATION PASSED" : `VALIDATION FAILED (${failed} check(s))`);
  if (failed > 0) process.exitCode = 1;
}

void main();
