import path from "node:path";
import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { MemoryStorageType } from "../memory-storage-engine/types.js";
import { MemoryAccessPermission, MemoryCategory, MemoryModuleStatus } from "../memory-foundation/types.js";
import { ProductHistoryStore } from "./product-history-store.js";
import { ProductLearner } from "./product-learner.js";
import { ProductMemoryLogger } from "./product-logger.js";
import { ProductPatternDetector } from "./product-pattern-detector.js";
import { ProductPatternStore } from "./product-pattern-store.js";
import { ProductPreferenceStore } from "./product-preference-store.js";
import { ProductProcessor, recordFromMemory } from "./product-processor.js";
import { ProductRelationshipLinker } from "./product-relationship-linker.js";
import { ProductScorer } from "./product-scorer.js";
import {
  ProductCreateInput,
  ProductCustomerPreferences,
  ProductLearningResult,
  ProductMemoryEngineError,
  ProductMemoryStatusReport,
  ProductPattern,
  ProductProcessResult,
  ProductRecord,
  ProductRelationships,
  ProductUpdateInput,
} from "./types.js";

/**
 * Product Memory Engine — permanent product knowledge storage and learning.
 */
export class AiProductMemoryEngine {
  private foundation: AiMemoryFoundation | null = null;
  private storageRoot = "";
  private initialized = false;
  private startupComplete = false;

  readonly logger = new ProductMemoryLogger();
  readonly history = new ProductHistoryStore();
  readonly patterns = new ProductPatternStore();
  readonly preferences = new ProductPreferenceStore();

  private readonly products = new Map<string, ProductRecord>();
  private readonly scorer = new ProductScorer();
  private linker: ProductRelationshipLinker | null = null;
  private patternDetector: ProductPatternDetector | null = null;
  private learner: ProductLearner | null = null;
  private processor: ProductProcessor | null = null;

  private saveTimes: number[] = [];
  private loadTimes: number[] = [];
  private searchTimes: number[] = [];

  initialize(foundation: AiMemoryFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.storageRoot = storageRoot;

    const logDir = path.join(storageRoot, "logs");
    const productDir = path.join(storageRoot, "memory", "products");
    this.logger.initialize(logDir);
    this.history.initialize(productDir);
    this.patterns.initialize(productDir);
    this.preferences.initialize(productDir);

    this.linker = new ProductRelationshipLinker(foundation, this.logger);
    this.patternDetector = new ProductPatternDetector(this.patterns);
    this.learner = new ProductLearner(foundation, this.logger);
    this.processor = new ProductProcessor(
      foundation,
      this.history,
      this.preferences,
      this.scorer,
      this.patternDetector,
      this.linker,
      this.learner,
      this.logger,
      this.products
    );

    this.initialized = true;
    this.logger.log("info", "startup", "Product Memory Engine initialized", { storageRoot });
  }

  async runStartup(): Promise<void> {
    this.ensureReady();
    const start = Date.now();

    const entries = this.foundation!
      .getStorageEngine()
      .getIndexEntries()
      .filter((e) => e.memoryType === MemoryStorageType.Product);

    for (const entry of entries) {
      const read = await this.foundation!.getStorageEngine().getRecord(entry.memoryId);
      if (read.success && read.record) {
        this.products.set(entry.memoryId, recordFromMemory(read.record));
      }
    }

    this.foundation!.registerMemoryModule({
      memoryId: "product-memory",
      memoryName: "Product Memory",
      category: MemoryCategory.Product,
      version: "0.1.0",
      status: MemoryModuleStatus.Active,
      dependencies: ["memory-engine"],
      storageLocation: path.join(this.storageRoot, "memory", "products"),
      accessPermissions: [MemoryAccessPermission.Read, MemoryAccessPermission.Write],
      implemented: true,
    });

    this.startupComplete = true;
    this.logger.log("info", "startup", "Product Memory Engine startup complete", {
      productsLoaded: this.products.size,
      patternsLoaded: this.patterns.getCount(),
      durationMs: Date.now() - start,
    });
  }

  async createProduct(input: ProductCreateInput): Promise<ProductProcessResult> {
    this.ensureReady();
    const result = await this.processor!.create(input);
    if (result.success) this.saveTimes.push(result.durationMs);
    return result;
  }

  async updateProduct(productId: string, input: ProductUpdateInput): Promise<ProductProcessResult> {
    this.ensureReady();
    const result = await this.processor!.update(productId, input);
    if (result.success) this.saveTimes.push(result.durationMs);
    return result;
  }

  async learnFromProject(productId: string): Promise<ProductLearningResult> {
    this.ensureReady();
    return this.processor!.learnFromProject(productId);
  }

  async getProduct(productId: string): Promise<ProductRecord | null> {
    this.ensureReady();
    const start = Date.now();
    const product = await this.processor!.loadProduct(productId);
    this.loadTimes.push(Date.now() - start);
    return product;
  }

  async listProducts(): Promise<ProductRecord[]> {
    this.ensureReady();
    return [...this.products.values()];
  }

  getCustomerPreferences(): ProductCustomerPreferences {
    return this.preferences.get();
  }

  learnCustomerPreferences(partial: Partial<ProductCustomerPreferences>): ProductCustomerPreferences {
    this.ensureReady();
    const updated = this.preferences.learn(partial);
    this.logger.log("info", "preference", "Customer preferences updated", {
      fields: Object.keys(partial).length,
    });
    return updated;
  }

  getProductRelationships(productId: string): ProductRelationships | null {
    const product = this.products.get(productId);
    if (!product || !this.linker) return null;
    return this.linker.link(
      product.productId,
      product.projectId,
      product.brand,
      product.category,
      product.tags
    );
  }

  getDetectedPatterns(): ProductPattern[] {
    return [...this.patterns.getAll()];
  }

  getReusablePatterns(): ProductPattern[] {
    return this.patterns.getReusable();
  }

  searchProducts(query: {
    name?: string;
    brand?: string;
    category?: string;
    subcategory?: string;
    sku?: string;
    supplier?: string;
    color?: string;
    minPrice?: number;
    maxPrice?: number;
    language?: string;
    marketingGoal?: string;
    tags?: string[];
    keywords?: string[];
  }): ProductRecord[] {
    this.ensureReady();
    const start = Date.now();

    let results = [...this.products.values()];

    if (query.name) {
      const lower = query.name.toLowerCase();
      results = results.filter((p) => p.productName.toLowerCase().includes(lower));
    }
    if (query.brand) {
      const lower = query.brand.toLowerCase();
      results = results.filter((p) => p.brand.toLowerCase().includes(lower));
    }
    if (query.category) results = results.filter((p) => p.category === query.category);
    if (query.subcategory) results = results.filter((p) => p.subcategory === query.subcategory);
    if (query.sku) results = results.filter((p) => p.sku === query.sku);
    if (query.supplier) {
      const lower = query.supplier.toLowerCase();
      results = results.filter((p) => p.supplier.toLowerCase().includes(lower));
    }
    if (query.color) {
      const lower = query.color.toLowerCase();
      results = results.filter(
        (p) =>
          p.colors.some((c) => c.toLowerCase().includes(lower)) ||
          p.visual.colorPalette.some((c) => c.toLowerCase().includes(lower))
      );
    }
    if (query.minPrice !== undefined) results = results.filter((p) => p.price >= query.minPrice!);
    if (query.maxPrice !== undefined) results = results.filter((p) => p.price <= query.maxPrice!);
    if (query.language) results = results.filter((p) => p.language === query.language);
    if (query.marketingGoal) {
      const lower = query.marketingGoal.toLowerCase();
      results = results.filter((p) => p.marketingGoal.toLowerCase().includes(lower));
    }
    if (query.tags?.length) {
      results = results.filter((p) => query.tags!.some((t) => p.tags.includes(t)));
    }
    if (query.keywords?.length) {
      results = results.filter((p) =>
        query.keywords!.some((kw) => p.keywords.some((k) => k.toLowerCase().includes(kw.toLowerCase())))
      );
    }

    const searchMs = Date.now() - start;
    this.searchTimes.push(searchMs);
    this.logger.log("info", "search", "Product search complete", {
      results: results.length,
      searchMs,
    });

    return results;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  isStartupComplete(): boolean {
    return this.startupComplete;
  }

  buildStatusReport(): ProductMemoryStatusReport {
    const products = [...this.products.values()];
    const patterns = this.patterns.getAll();
    const avg = (times: number[]) =>
      times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

    let readinessScore = 100;
    if (!this.initialized) readinessScore = 0;
    if (!this.startupComplete) readinessScore -= 25;

    const learned = products.filter((p) => p.lessonsLearned.length > 0 || p.patterns.length > 0).length;

    return {
      engineStatus: this.startupComplete ? "operational" : "initializing",
      relationshipStatus: `${products.reduce((s, p) => s + p.relatedMemories.length, 0)} relationship link(s)`,
      patternDetectionStatus: `${patterns.length} pattern(s), ${this.patterns.getReusable().length} reusable`,
      learningStatus: `${learned} product(s) with learned experience`,
      totalProducts: products.length,
      totalPatterns: patterns.length,
      totalPreferenceFields: this.preferences.getFieldCount(),
      performance: {
        averageSaveMs: avg(this.saveTimes),
        averageLoadMs: avg(this.loadTimes),
        averageSearchMs: avg(this.searchTimes),
        totalVersions: products.reduce((s, p) => s + p.versions.length, 0),
      },
      knownIssues: [],
      readinessScore: Math.max(0, readinessScore),
      timestamp: new Date().toISOString(),
    };
  }

  private ensureReady(): void {
    if (!this.initialized || !this.foundation) {
      throw new ProductMemoryEngineError(
        "Product Memory Engine not initialized",
        "NOT_INITIALIZED"
      );
    }
  }
}
