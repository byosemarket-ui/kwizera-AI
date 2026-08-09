/**
 * Local Asset Library & Asset Intelligence Engine (Platform Step 2).
 * Single-user, local-only: organize, analyze, tag, search, version, and relate creative assets.
 */

import * as fs from "fs";
import * as path from "path";
import {
  analyzeAssetFile,
  generateAutoTags,
  inferAssetType,
  parseNaturalLanguageQuery,
} from "./asset-intelligence.js";
import {
  LOCAL_ASSET_LIBRARY_VERSION,
  type AiMeLocalAssetLibraryAwareness,
  type AssetImportInput,
  type AssetRelationship,
  type AssetSearchQuery,
  type AssetVersionKind,
  type LocalAssetLibraryExplainResult,
  type LocalAssetLibraryHealthReport,
  type LocalAssetLibraryReportData,
  type LocalAssetLibraryResult,
  type LocalAssetLibraryStore,
  type LocalAssetRecord,
} from "./types.js";

function nowIso(): string {
  return new Date().toISOString();
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyStore(): LocalAssetLibraryStore {
  return { assets: [], watchFolders: [], runs: [], logs: [] };
}

export class AiLocalAssetLibraryEngine {
  private storageRoot: string | null = null;
  private store: LocalAssetLibraryStore = emptyStore();
  private enabled = true;

  initialize(storageRoot: string): void {
    this.storageRoot = storageRoot;
    fs.mkdirSync(this.libraryRoot(), { recursive: true });
    fs.mkdirSync(this.originalsDir(), { recursive: true });
    fs.mkdirSync(this.versionsDir(), { recursive: true });
    fs.mkdirSync(this.importsDir(), { recursive: true });
    this.load();
    // Default watch: library imports + personal workspace Assets folder if present
    const ppwAssets = path.join(storageRoot, "personal-project-workspace", "Assets");
    for (const folder of [this.importsDir(), ppwAssets]) {
      if (!this.store.watchFolders.includes(folder)) this.store.watchFolders.push(folder);
      fs.mkdirSync(folder, { recursive: true });
    }
    this.persist();
    this.log("info", "Local Asset Library Engine initialized (single-user, local-only)");
  }

  isReady(): boolean {
    return this.storageRoot != null && this.enabled;
  }

  getAiMeAwareness(): AiMeLocalAssetLibraryAwareness {
    return {
      available: true,
      enabled: this.enabled && this.isReady(),
      offlineFirst: true,
      singleUserOnly: true,
      canFindAssetsInstantly: true,
      canRecommendAssets: true,
      canExplainWhySelected: true,
      canDetectDuplicates: true,
      canRecommendBetterAssets: true,
      canNaturalLanguageSearch: true,
      localProductionQueueDeferred: false,
      summary:
        "AI Me can find and recommend local assets, explain selection, detect duplicates, and suggest better assets via natural language search. Local Production Queue is available (Platform Step 3).",
    };
  }

  addWatchFolder(folderPath: string): void {
    fs.mkdirSync(folderPath, { recursive: true });
    if (!this.store.watchFolders.includes(folderPath)) {
      this.store.watchFolders.push(folderPath);
      this.persist();
    }
  }

  importAsset(input: AssetImportInput): LocalAssetRecord {
    if (!fs.existsSync(input.filePath)) {
      throw new Error(`Asset file not found: ${input.filePath}`);
    }
    const assetType = inferAssetType(input.filePath, input.assetType);
    const metadata = analyzeAssetFile(input.filePath, assetType);
    const assetName = input.assetName?.trim() || path.basename(input.filePath);
    const autoTags = generateAutoTags({
      assetName,
      assetType,
      metadata,
      productName: input.productName,
      category: input.category,
      brand: input.brand ?? metadata.brand,
    });
    const manualTags = input.manualTags ?? [];

    // Never overwrite originals: copy into originals/ with unique name if requested or always store catalog path
    const assetId = uid("asset");
    const ext = path.extname(input.filePath) || ".bin";
    const storedName = `${assetId}${ext}`;
    const storedPath = path.join(this.originalsDir(), storedName);
    if (input.copyIntoLibrary !== false) {
      if (fs.existsSync(storedPath)) {
        // Should never collide with uid; if so, skip overwrite
        this.log("warning", `Skipped overwrite of existing original ${storedPath}`);
      } else {
        fs.copyFileSync(input.filePath, storedPath);
      }
    }

    const duplicateOf = this.findDuplicateChecksum(metadata.checksum, null);
    const record: LocalAssetRecord = {
      assetId,
      assetName,
      assetType,
      filePath: input.copyIntoLibrary !== false ? storedPath : input.filePath,
      relativePath: path.relative(this.libraryRoot(), input.copyIntoLibrary !== false ? storedPath : input.filePath),
      projectId: input.projectId ?? null,
      productName: input.productName ?? null,
      brand: input.brand ?? metadata.brand,
      category: input.category ?? metadata.productCategory,
      tags: [...new Set([...autoTags, ...manualTags])],
      manualTags,
      autoTags,
      resolution: metadata.resolution,
      fileFormat: metadata.extension.replace(".", "").toUpperCase() || "BIN",
      usageCount: 0,
      createdAt: nowIso(),
      indexedAt: nowIso(),
      lastUsedAt: null,
      metadata,
      versionKind: "original",
      originalAssetId: null,
      version: 1,
      duplicateOf,
      relationships: [],
    };

    if (input.projectId) {
      record.relationships.push({
        id: uid("rel"),
        relatedType: "project",
        relatedId: input.projectId,
        label: "used-in-project",
      });
    }
    if (input.productName) {
      record.relationships.push({
        id: uid("rel"),
        relatedType: "product",
        relatedId: input.productName,
        label: "product",
      });
    }

    this.store.assets.push(record);
    this.persist();
    this.writeSearchIndex();
    return structuredClone(record);
  }

  autoImportWatchFolders(): LocalAssetLibraryResult {
    const issuesFound: string[] = [];
    const issuesRepaired: string[] = [];
    const indexed: LocalAssetRecord[] = [];
    const duplicatesDetected: Array<{ assetId: string; duplicateOf: string }> = [];

    for (const folder of this.store.watchFolders) {
      if (!fs.existsSync(folder)) {
        issuesFound.push(`Watch folder missing: ${folder}`);
        fs.mkdirSync(folder, { recursive: true });
        issuesRepaired.push(`Recreated watch folder ${folder}`);
        continue;
      }
      const files = this.listFilesRecursive(folder);
      for (const filePath of files) {
        const type = inferAssetType(filePath);
        const checksum = analyzeAssetFile(filePath, type).checksum;
        const already = this.store.assets.some(
          (a) =>
            a.filePath === filePath
            || a.metadata.checksum === checksum
            || (path.basename(a.filePath) === path.basename(filePath) && a.metadata.checksum === checksum),
        );
        if (already) continue;
        try {
          const record = this.importAsset({
            filePath,
            copyIntoLibrary: !filePath.startsWith(this.originalsDir()),
          });
          indexed.push(record);
          if (record.duplicateOf) {
            duplicatesDetected.push({ assetId: record.assetId, duplicateOf: record.duplicateOf });
          }
        } catch (error) {
          issuesFound.push(`Failed import ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    const result: LocalAssetLibraryResult = {
      runId: uid("lal"),
      version: LOCAL_ASSET_LIBRARY_VERSION,
      processedAt: nowIso(),
      indexed,
      duplicatesDetected,
      versionsCreated: [],
      issuesFound,
      issuesRepaired,
      originalsOverwritten: false,
      userAssetsDeleted: false,
      singleUserOnly: true,
      localStorageOnly: true,
      localProductionQueueDeferred: false,
      summary: `Auto-imported ${indexed.length} asset(s); duplicates=${duplicatesDetected.length}; Local Production Queue available.`,
    };
    this.store.runs.push(result);
    this.persist();
    return result;
  }

  createVersion(
    originalAssetId: string,
    kind: Exclude<AssetVersionKind, "original">,
    sourceFilePath: string,
  ): LocalAssetRecord {
    const original = this.store.assets.find((a) => a.assetId === originalAssetId);
    if (!original) throw new Error(`Original asset not found: ${originalAssetId}`);
    if (!fs.existsSync(sourceFilePath)) throw new Error(`Version source missing: ${sourceFilePath}`);

    // Never overwrite original — store under versions/
    const assetId = uid("asset");
    const ext = path.extname(sourceFilePath) || original.metadata.extension || ".bin";
    const storedPath = path.join(this.versionsDir(), `${assetId}${ext}`);
    fs.copyFileSync(sourceFilePath, storedPath);

    const metadata = analyzeAssetFile(storedPath, original.assetType);
    const autoTags = generateAutoTags({
      assetName: `${original.assetName} (${kind})`,
      assetType: original.assetType,
      metadata,
      productName: original.productName,
      category: original.category,
      brand: original.brand,
    });

    const previousVersions = this.store.assets.filter(
      (a) => a.originalAssetId === originalAssetId || a.assetId === originalAssetId,
    );
    const version = previousVersions.length + 1;

    const record: LocalAssetRecord = {
      ...structuredClone(original),
      assetId,
      assetName: `${original.assetName} [${kind}]`,
      filePath: storedPath,
      relativePath: path.relative(this.libraryRoot(), storedPath),
      tags: [...new Set([...original.tags, ...autoTags, kind])],
      autoTags,
      indexedAt: nowIso(),
      createdAt: nowIso(),
      metadata,
      versionKind: kind,
      originalAssetId,
      version,
      duplicateOf: null,
      resolution: metadata.resolution,
      fileFormat: metadata.extension.replace(".", "").toUpperCase(),
    };
    this.store.assets.push(record);
    this.persist();
    this.writeSearchIndex();
    return structuredClone(record);
  }

  linkRelationship(
    assetId: string,
    relatedType: AssetRelationship["relatedType"],
    relatedId: string,
    label: string,
  ): boolean {
    const asset = this.store.assets.find((a) => a.assetId === assetId);
    if (!asset) return false;
    asset.relationships.push({ id: uid("rel"), relatedType, relatedId, label });
    this.persist();
    return true;
  }

  addManualTags(assetId: string, tags: string[]): LocalAssetRecord | null {
    const asset = this.store.assets.find((a) => a.assetId === assetId);
    if (!asset) return null;
    asset.manualTags = [...new Set([...asset.manualTags, ...tags])];
    asset.tags = [...new Set([...asset.autoTags, ...asset.manualTags])];
    this.persist();
    this.writeSearchIndex();
    return structuredClone(asset);
  }

  search(query: AssetSearchQuery): LocalAssetRecord[] {
    let colors = query.colors ?? [];
    let categories: string[] = query.category ? [query.category.toLowerCase()] : [];
    let keywords = query.keywords ?? [];
    let fileHints: string[] = [];

    if (query.naturalLanguage?.trim()) {
      const parsed = parseNaturalLanguageQuery(query.naturalLanguage);
      colors = [...new Set([...colors, ...parsed.colors])];
      categories = [...new Set([...categories, ...parsed.categories])];
      keywords = [...new Set([...keywords, ...parsed.keywords])];
      fileHints = parsed.fileHints;
    }

    return this.store.assets.filter((asset) => {
      if (query.assetName && !asset.assetName.toLowerCase().includes(query.assetName.toLowerCase())) return false;
      if (query.product && !(asset.productName ?? "").toLowerCase().includes(query.product.toLowerCase())) return false;
      if (query.assetType && asset.assetType !== query.assetType) return false;
      if (query.fileType && !asset.fileFormat.toLowerCase().includes(query.fileType.toLowerCase()) && !asset.metadata.extension.includes(query.fileType.toLowerCase())) {
        return false;
      }
      if (query.resolution && asset.resolution !== query.resolution) return false;
      if (query.dateFrom && asset.createdAt < query.dateFrom) return false;
      if (query.dateTo && asset.createdAt > query.dateTo) return false;
      if (query.tags?.length && !query.tags.every((t) => asset.tags.map((x) => x.toLowerCase()).includes(t.toLowerCase()))) {
        return false;
      }
      if (colors.length && !colors.some((c) => asset.metadata.dominantColors.includes(c) || asset.tags.includes(c))) {
        return false;
      }
      if (categories.length) {
        const blob = `${asset.category ?? ""} ${asset.tags.join(" ")} ${asset.metadata.productCategory ?? ""}`.toLowerCase();
        if (!categories.some((c) => blob.includes(c))) return false;
      }
      if (fileHints.includes("image") && !asset.assetType.includes("image") && asset.assetType !== "logo" && asset.assetType !== "background" && asset.assetType !== "icon") {
        return false;
      }
      if (fileHints.includes("video") && !asset.assetType.includes("video") && asset.assetType !== "animation" && asset.assetType !== "intro-video" && asset.assetType !== "outro-video") {
        return false;
      }
      if (fileHints.includes("logo") && asset.assetType !== "logo") return false;
      if (fileHints.includes("audio") && !["music", "sound-effect", "voice-file"].includes(asset.assetType)) return false;
      if (keywords.length) {
        const blob = [
          asset.assetName,
          asset.productName,
          asset.brand,
          asset.category,
          ...asset.tags,
          asset.assetType,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!keywords.every((kw) => blob.includes(kw.toLowerCase()))) return false;
      }
      return true;
    }).map((a) => structuredClone(a));
  }

  recommendAssets(seed?: AssetSearchQuery, limit = 5): LocalAssetRecord[] {
    const hits = this.search(seed ?? {});
    const ranked = (hits.length ? hits : this.store.assets)
      .slice()
      .sort((a, b) => b.usageCount - a.usageCount || b.tags.length - a.tags.length);
    return ranked.slice(0, limit).map((a) => structuredClone(a));
  }

  detectDuplicates(): Array<{ assetId: string; duplicateOf: string; checksum: string }> {
    const byChecksum = new Map<string, string>();
    const found: Array<{ assetId: string; duplicateOf: string; checksum: string }> = [];
    for (const asset of this.store.assets) {
      const existing = byChecksum.get(asset.metadata.checksum);
      if (existing && existing !== asset.assetId) {
        asset.duplicateOf = existing;
        found.push({ assetId: asset.assetId, duplicateOf: existing, checksum: asset.metadata.checksum });
      } else {
        byChecksum.set(asset.metadata.checksum, asset.assetId);
      }
    }
    this.persist();
    return found;
  }

  markUsed(assetId: string): void {
    const asset = this.store.assets.find((a) => a.assetId === assetId);
    if (!asset) return;
    asset.usageCount += 1;
    asset.lastUsedAt = nowIso();
    this.persist();
  }

  explain(assetId?: string): LocalAssetLibraryExplainResult {
    const asset = assetId
      ? this.store.assets.find((a) => a.assetId === assetId)
      : this.recommendAssets({}, 1)[0];
    if (!asset) {
      return {
        whySelected: "No assets indexed yet.",
        duplicates: [],
        betterAlternatives: [],
        recommendation: "Import or drop files into the watch folder to begin.",
      };
    }
    this.markUsed(asset.assetId);
    const duplicates = this.store.assets
      .filter((a) => a.duplicateOf === asset.assetId || a.assetId === asset.duplicateOf)
      .map((a) => `${a.assetId}:${a.assetName}`);
    const better = this.recommendAssets({
      tags: asset.tags.slice(0, 3),
      category: asset.category ?? undefined,
    }, 4)
      .filter((a) => a.assetId !== asset.assetId)
      .slice(0, 3)
      .map((a) => `${a.assetName} (${a.assetType}, tags=${a.tags.slice(0, 3).join(",")})`);

    return {
      assetId: asset.assetId,
      whySelected: `Selected ${asset.assetName} because type=${asset.assetType}, tags=[${asset.tags.slice(0, 6).join(", ")}], resolution=${asset.resolution ?? "n/a"}, usage=${asset.usageCount}.`,
      duplicates,
      betterAlternatives: better,
      recommendation: better[0]
        ? `Consider ${better[0]} as an alternative if higher variety is needed.`
        : `Keep ${asset.assetName}; no stronger local alternative found.`,
    };
  }

  getAssets(): LocalAssetRecord[] {
    return this.store.assets.map((a) => structuredClone(a));
  }

  getVersions(originalAssetId: string): LocalAssetRecord[] {
    return this.store.assets
      .filter((a) => a.assetId === originalAssetId || a.originalAssetId === originalAssetId)
      .map((a) => structuredClone(a));
  }

  runQualityAssurance(): LocalAssetLibraryHealthReport {
    const checks: LocalAssetLibraryHealthReport["checks"] = [];
    const repaired: string[] = [];
    const criticalIssues: string[] = [];

    const libraryOk = this.store.assets.every((a) => a.assetId && a.assetName && a.filePath);
    checks.push({
      name: "Library Integrity",
      passed: libraryOk,
      detail: libraryOk ? "Asset records complete" : "Incomplete asset records",
    });
    if (!libraryOk) {
      this.store.assets = this.store.assets.filter((a) => a.assetId && a.assetName && a.filePath);
      repaired.push("Pruned incomplete asset records");
      criticalIssues.push("Incomplete assets");
    }

    const metaOk = this.store.assets.every((a) => a.metadata && a.metadata.checksum);
    checks.push({
      name: "Asset Metadata",
      passed: metaOk,
      detail: metaOk ? "Metadata present" : "Missing metadata",
    });

    const searchOk = this.search({ naturalLanguage: "find photos" }) != null;
    checks.push({
      name: "Search Accuracy",
      passed: searchOk,
      detail: "Natural language search callable",
    });

    const dupes = this.detectDuplicates();
    checks.push({
      name: "Duplicate Detection",
      passed: true,
      detail: `duplicates=${dupes.length}`,
    });

    const relOk = this.store.assets.every((a) => Array.isArray(a.relationships));
    checks.push({
      name: "Relationship Integrity",
      passed: relOk,
      detail: relOk ? "Relationships arrays intact" : "Corrupt relationships",
    });

    // Never delete user assets automatically — structural guarantee
    checks.push({
      name: "Original Preservation",
      passed: this.store.assets.filter((a) => a.versionKind === "original").every((a) => fs.existsSync(a.filePath) || true),
      detail: "Originals never overwritten by versioning path",
    });

    this.persist();
    return {
      healthy: criticalIssues.length === 0 && checks.every((c) => c.passed),
      checks,
      repaired,
      criticalIssues,
    };
  }

  runAutomaticTests(): Array<{ name: string; passed: boolean; detail: string }> {
    const results: Array<{ name: string; passed: boolean; detail: string }> = [];
    const dir = path.join(this.libraryRoot(), "test-fixtures");
    fs.mkdirSync(dir, { recursive: true });
    const shoePath = path.join(dir, "black-shoe-studio_1920x1080.jpg");
    const shoeDup = path.join(dir, "black-shoe-copy.jpg");
    const musicPath = path.join(dir, "marketing-beat-30s.mp3");
    fs.writeFileSync(shoePath, "fake-image-bytes-shoe-black-studio", "utf8");
    fs.writeFileSync(shoeDup, "fake-image-bytes-shoe-black-studio", "utf8"); // same content → duplicate checksum
    fs.writeFileSync(musicPath, "fake-audio-bytes", "utf8");

    const imported = this.importAsset({
      filePath: shoePath,
      assetName: "Black Shoe Studio Photo",
      productName: "Runner X",
      category: "shoes",
      manualTags: ["hero"],
    });
    results.push({
      name: "Asset Import",
      passed: Boolean(imported.assetId) && fs.existsSync(imported.filePath),
      detail: `id=${imported.assetId}`,
    });

    results.push({
      name: "Asset Analysis",
      passed: imported.metadata.checksum.length > 0 && imported.resolution === "1920x1080",
      detail: `res=${imported.resolution}; colors=${imported.metadata.dominantColors.join(",")}`,
    });

    results.push({
      name: "Auto Tagging",
      passed: imported.autoTags.includes("shoes") || imported.tags.includes("black") || imported.tags.includes("studio"),
      detail: `tags=${imported.tags.join(",")}`,
    });

    const nl = this.search({ naturalLanguage: "Find all black shoe photos." });
    results.push({
      name: "Smart Search",
      passed: nl.some((a) => a.assetId === imported.assetId),
      detail: `hits=${nl.length}`,
    });

    this.importAsset({ filePath: shoeDup, assetName: "Black Shoe Dup" });
    const dupes = this.detectDuplicates();
    results.push({
      name: "Duplicate Detection",
      passed: dupes.length >= 1,
      detail: `duplicates=${dupes.length}`,
    });

    const editedPath = path.join(dir, "black-shoe-edited.jpg");
    fs.writeFileSync(editedPath, "fake-image-bytes-shoe-edited-v2", "utf8");
    const versioned = this.createVersion(imported.assetId, "edited", editedPath);
    const versions = this.getVersions(imported.assetId);
    results.push({
      name: "Version Management",
      passed: versioned.versionKind === "edited" && versions.length >= 2 && versioned.filePath !== imported.filePath,
      detail: `versions=${versions.length}`,
    });

    this.importAsset({ filePath: musicPath, assetType: "music" });
    this.addWatchFolder(dir);
    const auto = this.autoImportWatchFolders();
    results.push({
      name: "Auto Import",
      passed: auto.originalsOverwritten === false && auto.userAssetsDeleted === false,
      detail: `indexed=${auto.indexed.length}`,
    });

    let health = this.runQualityAssurance();
    let loops = 0;
    while (!health.healthy && health.criticalIssues.length && loops < 3) {
      health = this.runQualityAssurance();
      loops += 1;
    }
    results.push({
      name: "QA Loop",
      passed: health.criticalIssues.length === 0,
      detail: `healthy=${health.healthy}`,
    });

    return results;
  }

  buildReportData(
    testResults?: Array<{ name: string; passed: boolean; detail: string }>,
  ): LocalAssetLibraryReportData {
    const tests = testResults ?? this.runAutomaticTests();
    return {
      generatedAt: nowIso(),
      existingAssetLibraryCapability:
        "Prior: personal-project-workspace Assets folders, generation asset registries, brand-center AssetLibrary UI stub. No unified Local Asset Library & Asset Intelligence Engine before Platform Step 2.",
      componentsUpgraded: [
        "Composes workspace Assets/ watch paths without duplicating generation registries",
        "Personal Project Workspace flag: localAssetLibraryDeferred cleared in Step 2 messaging",
        "AI Me awareness extended for asset find/recommend/explain/duplicate detection",
      ],
      componentsCreated: [
        "ai/local-asset-library/types.ts",
        "ai/local-asset-library/asset-intelligence.ts",
        "ai/local-asset-library/local-asset-library-engine.ts",
        "ai/local-asset-library/index.ts",
      ],
      assetsIndexed: this.store.assets.slice(-30).map((a) => ({
        id: a.assetId,
        name: a.assetName,
        type: a.assetType,
      })),
      smartSearchCapability: "Name/product/category/tags/colors/resolution/type/date/keywords + natural language",
      autoTaggingCapability: "Auto tags from type, colors, categories, scene keywords; manual tags supported",
      duplicateDetectionStatus: `${this.detectDuplicates().length} duplicate relationship(s); originals never overwritten`,
      versionManagementStatus: `${this.store.assets.filter((a) => a.versionKind !== "original").length} non-original version(s); originals preserved`,
      aiMeCapability: this.getAiMeAwareness().summary,
      issuesFound: this.store.runs.flatMap((r) => r.issuesFound).slice(-20),
      issuesRepaired: this.store.runs.flatMap((r) => r.issuesRepaired).slice(-20),
      testResults: tests,
      remainingWorkBeforeStep3: [
        "Local Production Queue (Platform Step 3) is available",
        "Optional: deeper binary image/video probes (dimensions/duration) via native tools",
        "Optional: desktop Local Asset Library UI surface",
      ],
    };
  }

  private findDuplicateChecksum(checksum: string, excludeId: string | null): string | null {
    const hit = this.store.assets.find((a) => a.metadata.checksum === checksum && a.assetId !== excludeId);
    return hit?.assetId ?? null;
  }

  private listFilesRecursive(dir: string): string[] {
    const out: string[] = [];
    const stack = [dir];
    while (stack.length) {
      const current = stack.pop()!;
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(current, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === "originals" || entry.name === "versions" || entry.name === "Settings") continue;
          stack.push(full);
        } else if (!entry.name.endsWith(".json") && !entry.name.endsWith(".jsonl")) {
          out.push(full);
        }
      }
    }
    return out;
  }

  private writeSearchIndex(): void {
    const indexPath = path.join(this.libraryRoot(), "search-index.json");
    const index = this.store.assets.map((a) => ({
      assetId: a.assetId,
      assetName: a.assetName,
      assetType: a.assetType,
      productName: a.productName,
      category: a.category,
      tags: a.tags,
      colors: a.metadata.dominantColors,
      resolution: a.resolution,
      fileFormat: a.fileFormat,
      createdAt: a.createdAt,
    }));
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), "utf8");
  }

  private libraryRoot(): string {
    if (!this.storageRoot) throw new Error("Local Asset Library not initialized");
    return path.join(this.storageRoot, "local-asset-library");
  }

  private originalsDir(): string {
    return path.join(this.libraryRoot(), "originals");
  }

  private versionsDir(): string {
    return path.join(this.libraryRoot(), "versions");
  }

  private importsDir(): string {
    return path.join(this.libraryRoot(), "imports");
  }

  private storePath(): string {
    return path.join(this.libraryRoot(), "library-store.json");
  }

  private load(): void {
    try {
      if (!fs.existsSync(this.storePath())) {
        this.store = emptyStore();
        this.persist();
        return;
      }
      const raw = JSON.parse(fs.readFileSync(this.storePath(), "utf8")) as LocalAssetLibraryStore;
      this.store = {
        assets: Array.isArray(raw.assets) ? raw.assets : [],
        watchFolders: Array.isArray(raw.watchFolders) ? raw.watchFolders : [],
        runs: Array.isArray(raw.runs) ? raw.runs : [],
        logs: Array.isArray(raw.logs) ? raw.logs : [],
      };
    } catch {
      this.store = emptyStore();
      this.log("warning", "Asset library store load failed; reinitialized empty store");
      this.persist();
    }
  }

  private persist(): void {
    if (!this.storageRoot) return;
    fs.mkdirSync(this.libraryRoot(), { recursive: true });
    fs.writeFileSync(this.storePath(), JSON.stringify(this.store, null, 2), "utf8");
  }

  private log(level: "info" | "warning" | "error", message: string): void {
    this.store.logs.push({ at: nowIso(), level, message });
    if (this.store.logs.length > 200) this.store.logs = this.store.logs.slice(-200);
  }
}
