import fs from "node:fs";
import path from "node:path";
import { BrandingDesignRecord } from "./types.js";

export class BrandingDesignRecordStore {
  private storePath = "";
  private records = new Map<string, BrandingDesignRecord>();

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "branding-design-records.json");
    if (fs.existsSync(this.storePath)) {
      const list = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as BrandingDesignRecord[];
      for (const record of list) {
        this.records.set(record.brandDesignId, record);
      }
    }
  }

  upsert(record: BrandingDesignRecord): void {
    this.records.set(record.brandDesignId, record);
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }

  get(brandDesignId: string): BrandingDesignRecord | undefined {
    return this.records.get(brandDesignId);
  }

  getByProduct(productId: string): BrandingDesignRecord[] {
    return this.getAll().filter((r) => r.profile.productId === productId);
  }

  getByBrand(brandId: string): BrandingDesignRecord[] {
    return this.getAll().filter((r) => r.profile.brandId === brandId);
  }

  getAll(): BrandingDesignRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }
}
