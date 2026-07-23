import fs from "node:fs";
import path from "node:path";
export class BrandingDesignRecordStore {
    storePath = "";
    records = new Map();
    initialize(engineDir) {
        fs.mkdirSync(engineDir, { recursive: true });
        this.storePath = path.join(engineDir, "branding-design-records.json");
        if (fs.existsSync(this.storePath)) {
            const list = JSON.parse(fs.readFileSync(this.storePath, "utf8"));
            for (const record of list) {
                this.records.set(record.brandDesignId, record);
            }
        }
    }
    upsert(record) {
        this.records.set(record.brandDesignId, record);
        fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
    }
    get(brandDesignId) {
        return this.records.get(brandDesignId);
    }
    getByProduct(productId) {
        return this.getAll().filter((r) => r.profile.productId === productId);
    }
    getByBrand(brandId) {
        return this.getAll().filter((r) => r.profile.brandId === brandId);
    }
    getAll() {
        return [...this.records.values()];
    }
    getCount() {
        return this.records.size;
    }
}
//# sourceMappingURL=branding-design-stores.js.map