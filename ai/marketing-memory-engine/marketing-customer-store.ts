import fs from "node:fs";
import path from "node:path";
import { CustomerMemoryProfile } from "./types.js";

export class MarketingCustomerStore {
  private profilePath: string | null = null;
  private profile: CustomerMemoryProfile = {
    customerInterests: [],
    customerBehaviour: [],
    customerPreferences: [],
    productCategories: [],
    preferredMarketingStyles: [],
    preferredVideoStyles: [],
    preferredLanguages: [],
  };

  initialize(marketingDir: string): void {
    fs.mkdirSync(marketingDir, { recursive: true });
    this.profilePath = path.join(marketingDir, "customer-memory.json");
    if (fs.existsSync(this.profilePath)) {
      this.profile = JSON.parse(
        fs.readFileSync(this.profilePath, "utf8")
      ) as CustomerMemoryProfile;
    }
  }

  learn(partial: Partial<CustomerMemoryProfile>): CustomerMemoryProfile {
    for (const key of Object.keys(partial) as (keyof CustomerMemoryProfile)[]) {
      const values = partial[key];
      if (values?.length) {
        const existing = new Set(this.profile[key]);
        for (const v of values) existing.add(v);
        this.profile[key] = [...existing];
      }
    }
    this.persist();
    return { ...this.profile };
  }

  get(): CustomerMemoryProfile {
    return { ...this.profile };
  }

  getFieldCount(): number {
    return Object.values(this.profile).reduce((sum, arr) => sum + arr.length, 0);
  }

  private persist(): void {
    if (this.profilePath) {
      fs.writeFileSync(this.profilePath, JSON.stringify(this.profile, null, 2), "utf8");
    }
  }
}
