import fs from "node:fs";
import path from "node:path";
export class ProductPreferenceStore {
    prefsPath = null;
    prefs = {
        preferredProducts: [],
        preferredCategories: [],
        preferredColors: [],
        preferredPriceRange: "",
        preferredPresentationStyle: "",
        preferredMarketingStyle: "",
    };
    initialize(productDir) {
        fs.mkdirSync(productDir, { recursive: true });
        this.prefsPath = path.join(productDir, "customer-preferences.json");
        if (fs.existsSync(this.prefsPath)) {
            this.prefs = JSON.parse(fs.readFileSync(this.prefsPath, "utf8"));
        }
    }
    learn(partial) {
        if (partial.preferredProducts?.length) {
            const set = new Set([...this.prefs.preferredProducts, ...partial.preferredProducts]);
            this.prefs.preferredProducts = [...set];
        }
        if (partial.preferredCategories?.length) {
            const set = new Set([...this.prefs.preferredCategories, ...partial.preferredCategories]);
            this.prefs.preferredCategories = [...set];
        }
        if (partial.preferredColors?.length) {
            const set = new Set([...this.prefs.preferredColors, ...partial.preferredColors]);
            this.prefs.preferredColors = [...set];
        }
        if (partial.preferredPriceRange)
            this.prefs.preferredPriceRange = partial.preferredPriceRange;
        if (partial.preferredPresentationStyle) {
            this.prefs.preferredPresentationStyle = partial.preferredPresentationStyle;
        }
        if (partial.preferredMarketingStyle) {
            this.prefs.preferredMarketingStyle = partial.preferredMarketingStyle;
        }
        this.persist();
        return { ...this.prefs };
    }
    get() {
        return { ...this.prefs };
    }
    getFieldCount() {
        return (this.prefs.preferredProducts.length +
            this.prefs.preferredCategories.length +
            this.prefs.preferredColors.length +
            (this.prefs.preferredPriceRange ? 1 : 0) +
            (this.prefs.preferredPresentationStyle ? 1 : 0) +
            (this.prefs.preferredMarketingStyle ? 1 : 0));
    }
    persist() {
        if (this.prefsPath) {
            fs.writeFileSync(this.prefsPath, JSON.stringify(this.prefs, null, 2), "utf8");
        }
    }
}
//# sourceMappingURL=product-preference-store.js.map