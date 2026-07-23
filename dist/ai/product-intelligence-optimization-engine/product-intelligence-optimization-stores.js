import fs from "node:fs";
import path from "node:path";
export class ProductIntelligenceOptimizationRecordStore {
    storePath = "";
    recoveryPath = "";
    cachePath = "";
    records = new Map();
    recoveryPoints = new Map();
    activeCache = {
        products: [],
        brands: [],
        creativeStyles: [],
        campaignTypes: [],
        audienceProfiles: [],
        storyboards: [],
        visualPlans: [],
        audioPlans: [],
        hitRate: 0,
    };
    initialize(engineDir) {
        fs.mkdirSync(engineDir, { recursive: true });
        this.storePath = path.join(engineDir, "optimization-records.json");
        this.recoveryPath = path.join(engineDir, "recovery-points.json");
        this.cachePath = path.join(engineDir, "optimization-cache.json");
        if (fs.existsSync(this.storePath)) {
            const list = JSON.parse(fs.readFileSync(this.storePath, "utf8"));
            for (const record of list) {
                this.records.set(record.optimizationId, record);
            }
        }
        if (fs.existsSync(this.recoveryPath)) {
            const list = JSON.parse(fs.readFileSync(this.recoveryPath, "utf8"));
            for (const point of list) {
                this.recoveryPoints.set(point.recoveryId, point);
            }
        }
        if (fs.existsSync(this.cachePath)) {
            this.activeCache = JSON.parse(fs.readFileSync(this.cachePath, "utf8"));
        }
    }
    upsert(record) {
        this.records.set(record.optimizationId, record);
        fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
    }
    saveRecoveryPoint(point) {
        this.recoveryPoints.set(point.recoveryId, point);
        fs.writeFileSync(this.recoveryPath, JSON.stringify([...this.recoveryPoints.values()], null, 2), "utf8");
    }
    getRecoveryPoint(recoveryId) {
        return this.recoveryPoints.get(recoveryId);
    }
    updateCache(cache) {
        this.activeCache = cache;
        fs.writeFileSync(this.cachePath, JSON.stringify(cache, null, 2), "utf8");
    }
    getCache() {
        return this.activeCache;
    }
    restoreCache(snapshot) {
        this.updateCache(snapshot);
    }
    get(optimizationId) {
        return this.records.get(optimizationId);
    }
    getByProduct(productId) {
        return this.getAll().filter((r) => r.productId === productId);
    }
    getAll() {
        return [...this.records.values()];
    }
    getCount() {
        return this.records.size;
    }
}
//# sourceMappingURL=product-intelligence-optimization-stores.js.map