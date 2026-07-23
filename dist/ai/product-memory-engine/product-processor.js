import crypto from "node:crypto";
import { MemoryStorageType } from "../memory-storage-engine/types.js";
import { ProductStatus, } from "./types.js";
function emptyVisual() {
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
function emptyMarketing() {
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
function emptyVideoRelations() {
    return {
        promotionalVideos: [],
        marketingCampaigns: [],
        posters: [],
        banners: [],
        socialMediaContent: [],
        exportedAssets: [],
    };
}
function emptyCustomerPrefs() {
    return {
        preferredProducts: [],
        preferredCategories: [],
        preferredColors: [],
        preferredPriceRange: "",
        preferredPresentationStyle: "",
        preferredMarketingStyle: "",
    };
}
export function recordFromMemory(record) {
    const payload = (record.payload ?? {});
    return {
        productId: payload.productId ?? record.memoryId,
        memoryId: record.memoryId,
        projectId: record.relatedProject ?? payload.projectId,
        productName: record.title,
        brand: payload.brand ?? "",
        category: payload.category ?? record.category,
        subcategory: payload.subcategory ?? "",
        sku: payload.sku ?? "",
        description: record.description,
        features: payload.features ?? [],
        specifications: payload.specifications ?? {},
        materials: payload.materials ?? [],
        colors: payload.colors ?? [],
        sizes: payload.sizes ?? [],
        price: payload.price ?? 0,
        currency: payload.currency ?? "USD",
        availability: payload.availability ?? "in-stock",
        countryOfOrigin: payload.countryOfOrigin ?? "",
        supplier: payload.supplier ?? "",
        language: payload.language ?? "en",
        marketingGoal: payload.marketingGoal ?? "",
        status: payload.status ?? ProductStatus.Active,
        creationDate: record.creationTime,
        lastUpdated: record.lastUpdate,
        visual: payload.visual ?? emptyVisual(),
        marketing: payload.marketing ?? emptyMarketing(),
        videoRelationships: payload.videoRelationships ?? emptyVideoRelations(),
        customerPreferences: payload.customerPreferences ?? emptyCustomerPrefs(),
        scores: payload.scores ?? {
            profileScore: record.qualityScore,
            visualScore: 0,
            marketingScore: 0,
            learningScore: 0,
            aiConfidenceScore: record.qualityScore,
        },
        patterns: payload.patterns ?? [],
        relatedMemories: payload.relatedMemories ?? [],
        lessonsLearned: payload.lessonsLearned ?? [],
        strengths: payload.strengths ?? [],
        weaknesses: payload.weaknesses ?? [],
        versions: payload.versions ?? [],
        tags: record.tags,
        keywords: record.keywords,
    };
}
export class ProductProcessor {
    foundation;
    history;
    preferenceStore;
    scorer;
    patternDetector;
    linker;
    learner;
    logger;
    products;
    constructor(foundation, history, preferenceStore, scorer, patternDetector, linker, learner, logger, products) {
        this.foundation = foundation;
        this.history = history;
        this.preferenceStore = preferenceStore;
        this.scorer = scorer;
        this.patternDetector = patternDetector;
        this.linker = linker;
        this.learner = learner;
        this.logger = logger;
        this.products = products;
    }
    async create(input) {
        const start = Date.now();
        const productId = input.productId ?? `prod-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
        const now = new Date().toISOString();
        const draft = {
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
        const relationships = this.linker.link(productId, input.projectId, draft.brand, draft.category, draft.tags);
        draft.relatedMemories = relationships.relatedMemories;
        if (input.customerPreferences) {
            this.preferenceStore.learn(input.customerPreferences);
        }
        const storeResult = await this.foundation.getStorageEngine().storeRecord(this.toMemoryInput(draft), "product-memory-engine");
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
    async update(productId, input) {
        const start = Date.now();
        const existing = await this.loadProduct(productId);
        if (!existing)
            return this.fail(productId, start, "Product not found");
        const now = new Date().toISOString();
        const updated = {
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
        const relationships = this.linker.link(productId, updated.projectId, updated.brand, updated.category, updated.tags);
        updated.relatedMemories = [
            ...new Set([...updated.relatedMemories, ...relationships.relatedMemories]),
        ];
        updated.scores = this.scorer.computeScores(updated, input.presentationStyleRating);
        const memoryRead = await this.foundation.getStorageEngine().getRecord(productId);
        const memoryVersion = (memoryRead.record?.version ?? existing.versions.length) + 1;
        const versionInfo = {
            version: existing.versions.length + 1,
            timestamp: now,
            changeSummary: this.summarizeChanges(input),
            memoryVersion,
        };
        updated.versions = [...existing.versions, versionInfo];
        const updateResult = await this.foundation.getStorageEngine().updateRecord(productId, {
            title: updated.productName,
            description: updated.description,
            category: updated.category,
            tags: updated.tags,
            keywords: updated.keywords,
            qualityScore: updated.scores.profileScore,
            payload: this.toPayload(updated),
        }, "product-memory-engine");
        if (!updateResult.success) {
            return this.fail(productId, start, "Failed to update product");
        }
        let patternsDetected = 0;
        const patterns = this.patternDetector.detect(updated);
        if (patterns.length > 0) {
            updated.patterns = [...updated.patterns, ...patterns];
            patternsDetected = patterns.length;
            await this.foundation.getStorageEngine().updateRecord(productId, { payload: this.toPayload(updated) }, "product-memory-engine");
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
    async learnFromProject(productId) {
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
        await this.foundation.getStorageEngine().updateRecord(productId, { payload: this.toPayload(product) }, "product-memory-engine");
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
    async loadProduct(productId) {
        const cached = this.products.get(productId);
        if (cached)
            return cached;
        const read = await this.foundation.getStorageEngine().getRecord(productId);
        if (!read.success || !read.record)
            return null;
        const record = recordFromMemory(read.record);
        this.products.set(productId, record);
        return record;
    }
    mergeVideoRelations(existing, partial) {
        const merged = { ...existing };
        for (const key of Object.keys(partial)) {
            const vals = partial[key];
            if (vals?.length)
                merged[key] = [...new Set([...existing[key], ...vals])];
        }
        return merged;
    }
    appendMarketing(existing, partial) {
        const merged = { ...existing };
        for (const key of Object.keys(partial)) {
            const val = partial[key];
            if (Array.isArray(val) && val.length) {
                merged[key] = [...existing[key], ...val];
            }
            else if (typeof val === "string" && val) {
                merged[key] = val;
            }
        }
        return merged;
    }
    toMemoryInput(product) {
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
    toPayload(product) {
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
    summarizeChanges(input) {
        const parts = [];
        if (input.status)
            parts.push(`status→${input.status}`);
        if (input.visual)
            parts.push("visual updated");
        if (input.marketing || input.marketingAppend)
            parts.push("marketing updated");
        if (input.videoRelationships)
            parts.push("video links updated");
        if (input.price !== undefined)
            parts.push(`price→${input.price}`);
        return parts.length > 0 ? parts.join(", ") : "Product updated";
    }
    fail(productId, start, reason) {
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
//# sourceMappingURL=product-processor.js.map