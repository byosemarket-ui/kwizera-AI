import fs from "node:fs";
import path from "node:path";
export class MarketingCustomerStore {
    profilePath = null;
    profile = {
        customerInterests: [],
        customerBehaviour: [],
        customerPreferences: [],
        productCategories: [],
        preferredMarketingStyles: [],
        preferredVideoStyles: [],
        preferredLanguages: [],
    };
    initialize(marketingDir) {
        fs.mkdirSync(marketingDir, { recursive: true });
        this.profilePath = path.join(marketingDir, "customer-memory.json");
        if (fs.existsSync(this.profilePath)) {
            this.profile = JSON.parse(fs.readFileSync(this.profilePath, "utf8"));
        }
    }
    learn(partial) {
        for (const key of Object.keys(partial)) {
            const values = partial[key];
            if (values?.length) {
                const existing = new Set(this.profile[key]);
                for (const v of values)
                    existing.add(v);
                this.profile[key] = [...existing];
            }
        }
        this.persist();
        return { ...this.profile };
    }
    get() {
        return { ...this.profile };
    }
    getFieldCount() {
        return Object.values(this.profile).reduce((sum, arr) => sum + arr.length, 0);
    }
    persist() {
        if (this.profilePath) {
            fs.writeFileSync(this.profilePath, JSON.stringify(this.profile, null, 2), "utf8");
        }
    }
}
//# sourceMappingURL=marketing-customer-store.js.map