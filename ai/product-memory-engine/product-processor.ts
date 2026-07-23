import crypto from "node:crypto";
import type { MemoryRecord } from "../memory-storage-engine/types.js";
import { MemoryStorageType } from "../memory-storage-engine/types.js";
import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { ProductHistoryStore } from "./product-history-store.js";
import { ProductLearner } from "./product-learner.js";
import { ProductMemoryLogger } from "./product-logger.js";
import { ProductPatternDetector } from "./product-pattern-detector.js";
import { ProductPreferenceStore } from "./product-preference-store.js";
import { ProductRelationshipLinker } from "./product-relationship-linker.js";
import { ProductScorer } from "./product-scorer.js";
import {
  ProductCreateInput,
  ProductCustomerPreferences,
  ProductLearningResult,
  ProductMarketingMemory,
  ProductProcessResult,
  ProductRecord,
  ProductStatus,
  ProductUpdateInput,
  ProductVersionInfo,
  ProductVideoRelationships,
  ProductVisualMemory,
} from "./types.js";

function emptyVisual(): ProductVisualMemory {
  return {
    productImages: [],
    productBackgrounds: [],
    productAngles: [],
    lightingStyle: "",
    presentationStyle: "",
    colorPalette: [],
    packagingStyle: "",
    productLayout: "",
  };
}

function emptyMarketing(): ProductMarketingMemory {
  return {
    bestHeadlines: [],
    bestHooks: [],
    bestCta: [],
    bestDescriptions: [],
    bestSellingPoints: [],
    emotionalMarketingStyle: "",
    storytellingStyle: "",
  };
}

function emptyVideoRelations(): ProductVideoRelationships {
  return {
    promotionalVideos: [],
    marketingCampaigns: [],
    posters: [],
    banners: [],
    socialMediaContent: [],
    exportedAssets: [],
  };
}

function emptyCustomerPrefs(): ProductCustomerPreferences {
  return {
    preferredProducts: [],
    preferredCategories: [],
    preferredColors: [],
    preferredPriceRange: "",
    preferredPresentationStyle: "",
    preferredMarketingStyle: "",
  };
}

export function recordFromMemory(record: MemoryRecord): ProductRecord {
  const payload = (record.payload ?? {}) as Record<string, unknown>;
  return {
    productId: (payload.productId as string) ?? record.memoryId,
    memoryId: record.memoryId,
    projectId: record.relatedProject ?? (payload.projectId as string),
    productName: record.title,
    brand: (payload.brand as string) ?? "",
    category: (payload.category as string) ?? record.category,
    subcategory: (payload.subcategory as string) ?? "",
    sku: (payload.sku as string) ?? "",
    description: record.description,
    features: (payload.features as string[]) ?? [],
    specifications: (payload.specifications as Record<string, string>) ?? {},
    materials: (payload.materials as string[]) ?? [],
    colors: (payload.colors as string[]) ?? [],
    sizes: (payload.sizes as string[]) ?? [],
    price: (payload.price as number) ?? 0,
    currency: (payload.currency as string) ?? "USD",
    availability: (payload.availability as string) ?? "in-stock",
    countryOfOrigin: (payload.countryOfOrigin as string) ?? "",
    supplier: (payload.supplier as string) ?? "",
    language: (payload.language as string) ?? "en",
    marketingGoal: (payload.marketingGoal as string) ?? "",
    status: (payload.status as ProductStatus) ?? ProductStatus.Active,
    creationDate: record.creationTime,
    lastUpdated: record.lastUpdate,
    visual: (payload.visual as ProductVisualMemory) ?? emptyVisual(),
    marketing: (payload.marketing as ProductMarketingMemory) ?? emptyMarketing(),
    videoRelationships: (payload.videoRelationships as ProductVideoRelationships) ?? emptyVideoRelations(),
    customerPreferences: (payload.customerPreferences as ProductCustomerPreferences) ?? emptyCustomerPrefs(),
    scores: (payload.scores as ProductRecord["scores"]) ?? {
      profileScore: record.qualityScore,
      visualScore: 0,
      marketingScore: 0,
      learningScore: 0,
      aiConfidenceScore: record.qualityScore,
    },
    patterns: (payload.patterns as ProductRecord["patterns"]) ?? [],
    relatedMemories: (payload.relatedMemories as string[]) ?? [],
    lessonsLearned: (payload.lessonsLearned as string[]) ?? [],
    strengths: (payload.strengths as string[]) ?? [],
    weaknesses: (payload.weaknesses as string[]) ?? [],
    versions: (payload.versions as ProductVersionInfo[]) ?? [],
    tags: record.tags,
    keywords: record.keywords,
  };
}

export class ProductProcessor {
  constructor(
    private readonly foundation: AiMemoryFoundation,
    private readonly history: ProductHistoryStore,
    private readonly preferenceStore: ProductPreferenceStore,
    private readonly scorer: ProductScorer,
    private readonly patternDetector: ProductPatternDetector,
    private readonly linker: ProductRelationshipLinker,
    private readonly learner: ProductLearner,
    private readonly logger: ProductMemoryLogger,
    private readonly products: Map<string, ProductRecord>
  ) {}

  async create(input: ProductCreateInput): Promise<ProductProcessResult> {
    const start = Date.now();
    const productId =
      input.productId ?? `prod-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const now = new Date().toISOString();

    const draft: ProductRecord = {
      productId,
      memoryId: productId,
      projectId: input.projectId,
      productName: input.productName,
      brand: input.brand ?? "",
      category: input.category ?? "general",
      subcategory: input.subcategory ?? "",
      sku: input.sku ?? "",
      description: input.description ?? "",
      features: input.features ?? [],
      specifications: input.specifications ?? {},
      materials: input.materials ?? [],
      colors: input.colors ?? [],
      sizes: input.sizes ?? [],
      price: input.price ?? 0,
      currency: input.currency ?? "USD",
      availability: input.availability ?? "in-stock",
      countryOfOrigin: input.countryOfOrigin ?? "",
      supplier: input.supplier ?? "",
      language: input.language ?? "en",
      marketingGoal: input.marketingGoal ?? "",
      status: ProductStatus.Active,
      creationDate: now,
      lastUpdated: now,
      visual: { ...emptyVisual(), ...input.visual },
      marketing: { ...emptyMarketing(), ...input.marketing },
      videoRelationships: { ...emptyVideoRelations(), ...input.videoRelationships },
      customerPreferences: { ...emptyCustomerPrefs(), ...input.customerPreferences },
      scores: {
        profileScore: 0,
        visualScore: 0,
        marketingScore: 0,
        learningScore: 0,
        aiConfidenceScore: 0,
      },
      patterns: [],
      relatedMemories: [],
      lessonsLearned: [],
      strengths: [],
      weaknesses: [],
      versions: [{ version: 1, timestamp: now, changeSummary: "Product created", memoryVersion: 1 }],
      tags: input.tags ?? [],
      keywords: input.keywords ?? [input.productName.toLowerCase(), input.brand ?? ""].filter(Boolean),
    };

    draft.scores = this.scorer.computeScores(draft);
    const relationships = this.linker.link(
      productId,
      input.projectId,
      draft.brand,
      draft.category,
      draft.tags
    );
    draft.relatedMemories = relationships.relatedMemories;

    if (input.customerPreferences) {
      this.preferenceStore.learn(input.customerPreferences);
    }

    const storeResult = await this.foundation.getStorageEngine().storeRecord(
      this.toMemoryInput(draft),
      "product-memory-engine"
    );

    if (!storeResult.success || !storeResult.record) {
      return this.fail(productId, start, "Failed to store product");
    }

    this.products.set(productId, draft);
    this.history.append({
      timestamp: now,
      event: "create",
      productId,
      detail: `Created product: ${input.productName}`,
      version: 1,
    });

    this.logger.log("info", "product-create", "Product memory created", { productId });

    return {
      success: true,
      productId,
      memoryId: storeResult.record.memoryId,
      version: 1,
      durationMs: Date.now() - start,
      patternsDetected: 0,
    };
  }

  async update(productId: string, input: ProductUpdateInput): Promise<ProductProcessResult> {
    const start = Date.now();
    const existing = await this.loadProduct(productId);
    if (!existing) return this.fail(productId, start, "Product not found");

    const now = new Date().toISOString();
    const updated: ProductRecord = {
      ...existing,
      productName: input.productName ?? existing.productName,
      status: input.status ?? existing.status,
      brand: input.brand ?? existing.brand,
      category: input.category ?? existing.category,
      subcategory: input.subcategory ?? existing.subcategory,
      sku: input.sku ?? existing.sku,
      description: input.description ?? existing.description,
      features: input.features ?? (input.featuresAppend ? [...existing.features, ...input.featuresAppend] : existing.features),
      specifications: input.specifications ?? existing.specifications,
      materials: input.materials ?? existing.materials,
      colors: input.colors ?? existing.colors,
      sizes: input.sizes ?? existing.sizes,
      price: input.price ?? existing.price,
      currency: input.currency ?? existing.currency,
      availability: input.availability ?? existing.availability,
      countryOfOrigin: input.countryOfOrigin ?? existing.countryOfOrigin,
      supplier: input.supplier ?? existing.supplier,
      language: input.language ?? existing.language,
      marketingGoal: input.marketingGoal ?? existing.marketingGoal,
      visual: input.visual ? { ...existing.visual, ...input.visual } : existing.visual,
      marketing: input.marketing
        ? { ...existing.marketing, ...input.marketing }
        : input.marketingAppend
          ? this.appendMarketing(existing.marketing, input.marketingAppend)
          : existing.marketing,
      videoRelationships: input.videoRelationships
        ? this.mergeVideoRelations(existing.videoRelationships, input.videoRelationships)
        : existing.videoRelationships,
      customerPreferences: input.customerPreferences
        ? { ...existing.customerPreferences, ...input.customerPreferences }
        : existing.customerPreferences,
      tags: input.tags ?? existing.tags,
      keywords: input.keywords ?? existing.keywords,
      lessonsLearned: input.lessonsLearned
        ? [...existing.lessonsLearned, ...input.lessonsLearned]
        : existing.lessonsLearned,
      strengths: input.strengths ? [...existing.strengths, ...input.strengths] : existing.strengths,
      weaknesses: input.weaknesses
        ? [...existing.weaknesses, ...input.weaknesses]
        : existing.weaknesses,
      lastUpdated: now,
    };

    if (input.customerPreferences) {
      this.preferenceStore.learn(input.customerPreferences);
    }

    const relationships = this.linker.link(
      productId,
      updated.projectId,
      updated.brand,
      updated.category,
      updated.tags
    );
    updated.relatedMemories = [
      ...new Set([...updated.relatedMemories, ...relationships.relatedMemories]),
    ];

    updated.scores = this.scorer.computeScores(updated, input.presentationStyleRating);

    const memoryRead = await this.foundation.getStorageEngine().getRecord(productId);
    const memoryVersion = (memoryRead.record?.version ?? existing.versions.length) + 1;

    const versionInfo: ProductVersionInfo = {
      version: existing.versions.length + 1,
      timestamp: now,
      changeSummary: this.summarizeChanges(input),
      memoryVersion,
    };
    updated.versions = [...existing.versions, versionInfo];

    const updateResult = await this.foundation.getStorageEngine().updateRecord(
      productId,
      {
        title: updated.productName,
        description: updated.description,
        category: updated.category,
        tags: updated.tags,
        keywords: updated.keywords,
        qualityScore: updated.scores.profileScore,
        payload: this.toPayload(updated),
      },
      "product-memory-engine"
    );

    if (!updateResult.success) {
      return this.fail(productId, start, "Failed to update product");
    }

    let patternsDetected = 0;
    const patterns = this.patternDetector.detect(updated);
    if (patterns.length > 0) {
      updated.patterns = [...updated.patterns, ...patterns];
      patternsDetected = patterns.length;
      await this.foundation.getStorageEngine().updateRecord(
        productId,
        { payload: this.toPayload(updated) },
        "product-memory-engine"
      );
    }

    this.products.set(productId, updated);
    this.history.append({
      timestamp: now,
      event: patternsDetected > 0 ? "pattern" : "update",
      productId,
      detail: versionInfo.changeSummary,
      version: versionInfo.version,
    });

    return {
      success: true,
      productId,
      memoryId: productId,
      version: versionInfo.version,
      durationMs: Date.now() - start,
      patternsDetected,
    };
  }

  async learnFromProject(productId: string): Promise<ProductLearningResult> {
    const product = await this.loadProduct(productId);
    if (!product) {
      return {
        success: false,
        productId,
        patternsStored: 0,
        recommendations: [],
        lessons: [],
      };
    }

    const patterns = this.patternDetector.detect(product);
    product.patterns = [...product.patterns, ...patterns];

    await this.foundation.getStorageEngine().updateRecord(
      productId,
      { payload: this.toPayload(product) },
      "product-memory-engine"
    );
    this.products.set(productId, product);

    const learning = await this.learner.learnFromCompletedProject(product, patterns.length);

    this.history.append({
      timestamp: new Date().toISOString(),
      event: "learn",
      productId,
      detail: `Learned ${patterns.length} pattern(s) from project`,
    });

    this.logger.log("info", "product-learn", "Product project learning complete", { productId });

    return learning;
  }

  async loadProduct(productId: string): Promise<ProductRecord | null> {
    const cached = this.products.get(productId);
    if (cached) return cached;

    const read = await this.foundation.getStorageEngine().getRecord(productId);
    if (!read.success || !read.record) return null;

    const record = recordFromMemory(read.record);
    this.products.set(productId, record);
    return record;
  }

  private mergeVideoRelations(
    existing: ProductVideoRelationships,
    partial: Partial<ProductVideoRelationships>
  ): ProductVideoRelationships {
    const merged = { ...existing };
    for (const key of Object.keys(partial) as (keyof ProductVideoRelationships)[]) {
      const vals = partial[key];
      if (vals?.length) merged[key] = [...new Set([...existing[key], ...vals])];
    }
    return merged;
  }

  private appendMarketing(
    existing: ProductMarketingMemory,
    partial: Partial<ProductMarketingMemory>
  ): ProductMarketingMemory {
    const merged = { ...existing };
    for (const key of Object.keys(partial) as (keyof ProductMarketingMemory)[]) {
      const val = partial[key];
      if (Array.isArray(val) && val.length) {
        merged[key] = [...(existing[key] as string[]), ...val] as never;
      } else if (typeof val === "string" && val) {
        merged[key] = val as never;
      }
    }
    return merged;
  }

  private toMemoryInput(product: ProductRecord) {
    return {
      memoryId: product.productId,
      memoryType: MemoryStorageType.Product,
      category: product.category,
      title: product.productName,
      description: product.description || `${product.brand} ${product.category} product`,
      source: "product-memory-engine",
      tags: product.tags,
      keywords: product.keywords,
      relatedProject: product.projectId,
      qualityScore: product.scores.profileScore,
      payload: this.toPayload(product),
    };
  }

  private toPayload(product: ProductRecord): Record<string, unknown> {
    return {
      productId: product.productId,
      projectId: product.projectId,
      brand: product.brand,
      category: product.category,
      subcategory: product.subcategory,
      sku: product.sku,
      status: product.status,
      features: product.features,
      specifications: product.specifications,
      materials: product.materials,
      colors: product.colors,
      sizes: product.sizes,
      price: product.price,
      currency: product.currency,
      availability: product.availability,
      countryOfOrigin: product.countryOfOrigin,
      supplier: product.supplier,
      language: product.language,
      marketingGoal: product.marketingGoal,
      visual: product.visual,
      marketing: product.marketing,
      videoRelationships: product.videoRelationships,
      customerPreferences: product.customerPreferences,
      scores: product.scores,
      patterns: product.patterns,
      relatedMemories: product.relatedMemories,
      lessonsLearned: product.lessonsLearned,
      strengths: product.strengths,
      weaknesses: product.weaknesses,
      versions: product.versions,
    };
  }

  private summarizeChanges(input: ProductUpdateInput): string {
    const parts: string[] = [];
    if (input.status) parts.push(`status→${input.status}`);
    if (input.visual) parts.push("visual updated");
    if (input.marketing || input.marketingAppend) parts.push("marketing updated");
    if (input.videoRelationships) parts.push("video links updated");
    if (input.price !== undefined) parts.push(`price→${input.price}`);
    return parts.length > 0 ? parts.join(", ") : "Product updated";
  }

  private fail(productId: string, start: number, reason: string): ProductProcessResult {
    this.logger.log("error", "error", reason, { productId });
    return {
      success: false,
      productId,
      memoryId: productId,
      version: 0,
      durationMs: Date.now() - start,
      patternsDetected: 0,
      reason,
    };
  }
}
