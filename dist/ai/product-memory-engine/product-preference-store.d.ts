import { ProductCustomerPreferences } from "./types.js";
export declare class ProductPreferenceStore {
    private prefsPath;
    private prefs;
    initialize(productDir: string): void;
    learn(partial: Partial<ProductCustomerPreferences>): ProductCustomerPreferences;
    get(): ProductCustomerPreferences;
    getFieldCount(): number;
    private persist;
}
//# sourceMappingURL=product-preference-store.d.ts.map