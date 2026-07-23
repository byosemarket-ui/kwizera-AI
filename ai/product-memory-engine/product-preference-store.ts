import fs from "node:fs";
import path from "node:path";
import { ProductCustomerPreferences } from "./types.js";

export class ProductPreferenceStore {
  private prefsPath: string | null = null;
  private prefs: ProductCustomerPreferences = {
    preferredProducts: [],
    preferredCategories: [],
    preferredColors: [],
    preferredPriceRange: "",
    preferredPresentationStyle: "",
    preferredMarketingStyle: "",
  };

  initialize(productDir: string): void {
    fs.mkdirSync(productDir, { recursive: true });
    this.prefsPath = path.join(productDir, "customer-preferences.json");
    if (fs.existsSync(this.prefsPath)) {
      this.prefs = JSON.parse(
        fs.readFileSync(this.prefsPath, "utf8")
      ) as ProductCustomerPreferences;
    }
  }

  learn(partial: Partial<ProductCustomerPreferences>): ProductCustomerPreferences {
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
    if (partial.preferredPriceRange) this.prefs.preferredPriceRange = partial.preferredPriceRange;
    if (partial.preferredPresentationStyle) {
      this.prefs.preferredPresentationStyle = partial.preferredPresentationStyle;
    }
    if (partial.preferredMarketingStyle) {
      this.prefs.preferredMarketingStyle = partial.preferredMarketingStyle;
    }
    this.persist();
    return { ...this.prefs };
  }

  get(): ProductCustomerPreferences {
    return { ...this.prefs };
  }

  getFieldCount(): number {
    return (
      this.prefs.preferredProducts.length +
      this.prefs.preferredCategories.length +
      this.prefs.preferredColors.length +
      (this.prefs.preferredPriceRange ? 1 : 0) +
      (this.prefs.preferredPresentationStyle ? 1 : 0) +
      (this.prefs.preferredMarketingStyle ? 1 : 0)
    );
  }

  private persist(): void {
    if (this.prefsPath) {
      fs.writeFileSync(this.prefsPath, JSON.stringify(this.prefs, null, 2), "utf8");
    }
  }
}
